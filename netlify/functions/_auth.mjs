import { createHash, createHmac, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import { casDoc, readDoc, cleanArtistId } from './_lib.mjs';

/* Magic-link sign-in for ARTISTS. The audience never signs in — that is the
   whole reason the app works in a bar — so this exists only for the Studio.

   Email + 6-digit code rather than Google/Apple: no OAuth consent screen, no
   Google Cloud project, no verification review, and it works for people who
   don't have a Google account. */

const CODE_TTL = 10 * 60e3;          // a code is good for ten minutes
const TOKEN_TTL = 30 * 24 * 3600e3;  // a session lasts a month
const MAX_TRIES = 5;                 // wrong guesses before the code is burned
const MAX_SENDS = 5;                 // codes per email per hour

const sha = (v) => createHash('sha256').update(String(v)).digest('hex');
const eq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};
export const normEmail = (v) =>
  String(v || '').trim().toLowerCase().slice(0, 160);
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v);

/* The signing secret is generated once and kept in Blobs — private to the site,
   same exposure as an env var, and one less thing to configure by hand. */
export async function authSecret() { return secret(); }
async function secret() {
  const { data } = await readDoc('authsecret', null);
  if (data && data.k) return data.k;
  const k = randomBytes(32).toString('hex');
  await casDoc('authsecret', () => ({}), (d) => { if (d.k) return false; d.k = k; return true; })
    .catch(() => {});
  const again = await readDoc('authsecret', null);
  return (again.data && again.data.k) || k;
}

/* ---------- the artist registry ----------
   One global document. Everything else in the store belongs to exactly one
   artist; this is the only thing that maps between them.
     byId    artistId -> { slug, name, createdAt, plan }
     bySlug  slug     -> artistId      (so myset.vip/perryidyll resolves)
     byEmail email    -> { artistId, role }   (who can sign in, and as whom)
*/
const emptyRegistry = () => ({ v: 2, rev: 1, byId: {}, bySlug: {}, byEmail: {} });

export async function readArtists() {
  const { data } = await readDoc('artists', null);
  const a = { ...emptyRegistry(), ...(data || {}) };
  a.byId ||= {}; a.bySlug ||= {}; a.byEmail ||= {}; a.rev ||= 1;
  return a;
}
export const mutateArtists = (fn) =>
  casDoc('artists', emptyRegistry, (a) => {
    a.v ||= 2; a.rev ||= 1; a.byId ||= {}; a.bySlug ||= {}; a.byEmail ||= {};
    return fn(a);
  });

/** Slugs live in public URLs, so they get the strictest cleaning of anything. */
export const cleanSlug = (v) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 32);

const RESERVED = new Set(['api','studio','vote','artist','admin','app','www','static','img',
  'v','venue','venues','venuestudio',
  'assets','stage','about','help','support','login','signup','signin','terms','privacy',
  'settings','account','new','index','home','myset','null','undefined']);

export async function artistBySlug(slug) {
  const a = await readArtists();
  return a.bySlug[cleanSlug(slug)] || null;
}
export async function artistById(aid) {
  const a = await readArtists();
  return a.byId[aid] || null;
}

/** Turn a name into a free slug. Deterministic given the registry it is handed,
    so a CAS retry can't produce a different one mid-flight. */
export function pickSlug(name, reg, wanted) {
  let base = cleanSlug(wanted || name) || 'artist';
  if (base.length < 3) base = base + 'live';
  // also skip anything already used as an ID: a slug can be renamed away, but the
  // id it was created from lives on in every blob key, so reusing it collides
  const free = (v) => !RESERVED.has(v) && !reg.bySlug[v] && !reg.byId[v];
  if (free(base)) return base;
  for (let i = 2; i < 500; i++) {
    const t = `${base}${i}`;
    if (free(t)) return t;
  }
  return null;
}

/** Creates the artist AND their first login in one atomic write. */
/* Where a signup came from, kept short and boring. It is a MARKETING fact, not
   an identity: no full URL, no query string, no path — just the label the link
   carried or the host that sent them, so the Growth sheet can answer "is the
   about page working" without keeping a browsing trail on anybody. */
export const cleanSource = (v) => {
  const raw = String(v || '').trim().toLowerCase();
  /* REJECT, don't mangle. Stripping the punctuation out of a pasted URL left a
     40-character run of host-plus-path-plus-query with the slashes removed — which
     is not a label, still carries the trail the comment above promises not to
     keep, and would sit in the sheet forever. A source is a short handle or a
     hostname; anything URL-shaped is somebody putting the wrong thing in the box. */
  if (!raw || /[:/?#=&%\s]/.test(raw)) return '';
  const out = raw.replace(/[^a-z0-9._-]/g, '');
  return out.length > 40 ? '' : out;
};

export async function createArtist({ email, name, slug, ref, src }) {
  const clean = String(name || '').trim().slice(0, 60) || 'New artist';
  let made = null, err = null;
  await mutateArtists((reg) => {
    if (reg.byEmail[email]) { err = 'already'; return false; }
    const s = pickSlug(clean, reg, slug);
    if (!s) { err = 'no-slug'; return false; }
    const aid = cleanArtistId(s) || s;
    if (reg.byId[aid]) { err = 'no-slug'; return false; }
    // who sent them, recorded at signup and never editable afterwards
    const referrer = ref && reg.bySlug[cleanSlug(ref)] && reg.bySlug[cleanSlug(ref)] !== aid
      ? reg.bySlug[cleanSlug(ref)] : null;
    reg.byId[aid] = { slug: s, name: clean, createdAt: Date.now(), plan: 'free',
                      referredBy: referrer,
                      // first touch, recorded once and never edited afterwards
                      src: cleanSource(src), refSlug: cleanSlug(ref || '') || '' };
    reg.bySlug[s] = aid;
    reg.byEmail[email] = { artistId: aid, role: 'owner' };
    made = { artistId: aid, slug: s, name: clean };
    return true;
  });
  return made ? { ok: true, ...made } : { ok: false, error: err || 'failed' };
}

export { RESERVED };

/* A short-lived proof that someone just redeemed a code for this address.
   Lets "you have no account yet, pick a name" be said AFTER they proved they own
   the inbox — the only point at which it is safe to say it. */
export async function signTicket(email) {
  const exp = Date.now() + 15 * 60e3;
  const body = `t|${email}|${exp}`;
  const mac = createHmac('sha256', await secret()).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${mac}`;
}
export async function readTicket(t) {
  if (typeof t !== 'string' || t.length > 400) return null;
  const [b64, mac] = t.split('.');
  if (!b64 || !mac) return null;
  let body;
  try { body = Buffer.from(b64, 'base64url').toString(); } catch { return null; }
  const want = createHmac('sha256', await secret()).update(body).digest('base64url');
  if (!eq(mac, want)) return null;
  const [tag, email, exp] = body.split('|');
  if (tag !== 't' || !email || Number(exp) < Date.now()) return null;
  return email;
}

/* ---------- session tokens ---------- */
/** The rev a token is signed against: this artist's own, falling back to the
 *  registry-wide one for records that predate per-artist revs. One definition,
 *  used by both the signer and the verifier, so they cannot drift. */
export const revOf = (reg, aid) =>
  ((reg.byId || {})[aid] || {}).rev ?? reg.rev ?? 1;
export async function signToken(email, rev) {
  const exp = Date.now() + TOKEN_TTL;
  const body = `${email}|${exp}|${rev}`;
  const mac = createHmac('sha256', await secret()).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${mac}`;
}
export async function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 500) return null;
  const [b64, mac] = token.split('.');
  if (!b64 || !mac) return null;
  let body;
  try { body = Buffer.from(b64, 'base64url').toString(); } catch { return null; }
  const want = createHmac('sha256', await secret()).update(body).digest('base64url');
  if (!eq(mac, want)) return null;
  const [email, exp, rev] = body.split('|');
  if (!email || Number(exp) < Date.now()) return null;
  const reg = await readArtists();
  const link = reg.byEmail[email];
  if (!link || !reg.byId[link.artistId]) return null;       // access removed
  /* PER-ARTIST. `reg.rev` is one global counter, and "Sign out every device" bumped
     it — so any artist (or any stranger who signed up, since signup is open) could
     sign out every artist AND every venue on the platform, repeatably.
     The `?? reg.rev` fallback matters as much as the fix: an artist record created
     before this change has no `rev` of its own, and comparing against a bare
     `undefined` would reject every token in existence — i.e. do the exact thing we
     are fixing. It reads the global value until that artist first revokes. */
  if (String(revOf(reg, link.artistId)) !== String(rev)) return null;   // signed out
  return { email, artistId: link.artistId, role: link.role,
           artist: reg.byId[link.artistId] };
}

/* ---------- one-time codes ---------- */
const codeKey = (email, realm) => `authc_${realm ? realm + '_' : ''}${sha(email).slice(0, 32)}`;

export async function issueCode(email, pendingName, realm) {
  const key = codeKey(email, realm);
  const now = Date.now();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = await secret();
  let tooMany = false;

  await casDoc(key, () => ({}), (d) => {
    d.sends = (d.sends || []).filter((t) => now - t < 3600e3);
    if (d.sends.length >= MAX_SENDS) { tooMany = true; return false; }
    d.sends.push(now);
    d.hash = createHmac('sha256', salt).update(code).digest('hex');
    d.exp = now + CODE_TTL;
    d.tries = 0;
    // the name they typed on the way in, so a brand-new account can be created
    // when the code comes back without asking twice
    d.name = pendingName ? String(pendingName).slice(0, 60) : null;
    return true;
  });
  return tooMany ? null : code;
}

/** Returns { ok, name } — name is whatever they typed when the code was sent. */
export async function checkCode(email, given, realm) {
  const key = codeKey(email, realm);
  const salt = await secret();
  const want = createHmac('sha256', salt).update(String(given || '')).digest('hex');
  let ok = false, name = null;

  await casDoc(key, () => ({}), (d) => {
    if (!d.hash || !d.exp || d.exp < Date.now()) return false;
    if ((d.tries || 0) >= MAX_TRIES) { d.hash = null; return true; }
    d.tries = (d.tries || 0) + 1;
    if (eq(d.hash, want)) { ok = true; name = d.name || null; d.hash = null; }   // burn on success
    return true;
  }).catch(() => {});
  return { ok, name };
}

/* ---------- delivery ---------- */
export async function sendCode(email, code, artistName, which = 'Artist Studio') {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM || 'MySet <onboarding@resend.dev>';
  if (!key) return { ok: false, why: 'email-not-configured' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${code} is your MySet sign-in code`,
        text: `Your MySet sign-in code is ${code}\n\nIt works for ten minutes and once only.\nIf you didn't ask for it, you can ignore this — nobody can get in without it.`,
        html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;padding:28px 8px">
  <p style="font-size:15px;color:#6E6E73;margin:0 0 22px">Hi${artistName ? ' ' + escapeHtml(artistName) : ''}, here's your sign-in code for the MySet ${escapeHtml(which)}.</p>
  <div style="font-size:40px;font-weight:700;letter-spacing:.16em;text-align:center;padding:22px;border-radius:16px;background:#F5F5F7;color:#1D1D1F">${code}</div>
  <p style="font-size:14px;color:#6E6E73;margin:22px 0 0">It works for ten minutes, once. If you didn't ask for it, ignore this — nobody can get in without it.</p>
</div>`,
      }),
    });
    if (!r.ok) return { ok: false, why: 'send-failed' };
    return { ok: true };
  } catch {
    return { ok: false, why: 'send-failed' };
  }
}
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export { validEmail };
