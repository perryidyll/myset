import { createHash, createHmac, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import { casDoc, readDoc } from './_lib.mjs';

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
async function secret() {
  const { data } = await readDoc('authsecret', null);
  if (data && data.k) return data.k;
  const k = randomBytes(32).toString('hex');
  await casDoc('authsecret', () => ({}), (d) => { if (d.k) return false; d.k = k; return true; })
    .catch(() => {});
  const again = await readDoc('authsecret', null);
  return (again.data && again.data.k) || k;
}

/* ---------- who is allowed in ---------- */
export async function readArtists() {
  const { data } = await readDoc('artists', null);
  const a = data || {};
  a.emails ||= {};
  a.rev ||= 1;                       // bump to sign every session out at once
  return a;
}
export const mutateArtists = (fn) =>
  casDoc('artists', () => ({ emails: {}, rev: 1 }), (a) => {
    a.emails ||= {}; a.rev ||= 1; return fn(a);
  });

/* ---------- session tokens ---------- */
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
  const artists = await readArtists();
  if (String(artists.rev) !== String(rev)) return null;     // revoked
  if (!artists.emails[email]) return null;                  // access removed
  return { email, artist: artists.emails[email] };
}

/* ---------- one-time codes ---------- */
const codeKey = (email) => `authc_${sha(email).slice(0, 32)}`;

export async function issueCode(email) {
  const key = codeKey(email);
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
    return true;
  });
  return tooMany ? null : code;
}

export async function checkCode(email, given) {
  const key = codeKey(email);
  const salt = await secret();
  const want = createHmac('sha256', salt).update(String(given || '')).digest('hex');
  let ok = false;

  await casDoc(key, () => ({}), (d) => {
    if (!d.hash || !d.exp || d.exp < Date.now()) return false;
    if ((d.tries || 0) >= MAX_TRIES) { d.hash = null; return true; }
    d.tries = (d.tries || 0) + 1;
    if (eq(d.hash, want)) { ok = true; d.hash = null; }      // burn it on success
    return true;
  }).catch(() => {});
  return ok;
}

/* ---------- delivery ---------- */
export async function sendCode(email, code, artistName) {
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
  <p style="font-size:15px;color:#6E6E73;margin:0 0 22px">Hi${artistName ? ' ' + escapeHtml(artistName) : ''}, here's your sign-in code for the MySet Artist Studio.</p>
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
