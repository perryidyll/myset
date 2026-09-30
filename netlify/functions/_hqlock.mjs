import { scrypt, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { readDoc, casDoc } from './_lib.mjs';
import { authSecret } from './_auth.mjs';

/* CRM'S PASSCODE (decision 0108, INVARIANT 0hk). The founder, 2026-09-28: "make the url
   www.myset.vip/crm and put a legit passcode lock on it". CRM opens to the founding
   page's owner seat AND this passcode: two locks, because CRM sends mail as the founder
   and can erase a contact forever. A signed-in phone left on a table is not enough, and
   neither is a guessed passcode.

   This is not _passgate.mjs, the money model's door. That one is a courtesy lock: a
   short code, with a fallback written into this repository, which is public. This one:
   · Is checked here on the server, never in the browser. The page never holds the
     passcode or the proof that it was given.
   · Stores only a salted scrypt hash, in Netlify's HQ_PASSCODE for production, never
     in the repository. While that is unset, CRM stays shut. A deploy preview reads and
     writes production data, so it cannot be opened at all.
   · Answers a right passcode with `hqk`, a cookie that is HttpOnly, SameSite=Strict,
     limited to /api/hq and good for UNLOCK_HOURS. It is signed with the site's auth
     secret and bound to the account and to this passcode, so a new passcode locks
     every open CRM.
   · Shuts the door for LOCK_MINUTES after LOCK_TRIES wrong tries in a row, and tells
     the founder's phone. Only a signed-in owner seat can try at all.
   `node tools/hqpass.mjs` sets a new passcode. */

export const UNLOCK_HOURS = 12;   // how long one right passcode keeps CRM open in that browser
export const LOCK_TRIES = 5;      // wrong tries in a row before the door shuts
export const LOCK_MINUTES = 15;   // how long it stays shut, and how long a wrong try is remembered
export const LOCK_DOC = 'hqlock';
export const COOKIE = 'hqk';
const PATH = '/api/hq';
const N = 1 << 15, R = 8, P = 1, LEN = 32;   // scrypt: 32 MiB and tens of milliseconds a try

const kdf = (code, salt, n = N, r = R, p = P) => new Promise((ok, no) =>
  scrypt(String(code).normalize('NFC'), salt, LEN, { N: n, r, p, maxmem: 256 * n * r }, (e, k) => (e ? no(e) : ok(k))));

/** What HQ_PASSCODE holds: `scrypt$N$r$p$salt$hash`, base64url. */
export async function hashPasscode(code) {
  const salt = randomBytes(16);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${(await kdf(code, salt)).toString('base64url')}`;
}
function stored(env) {
  const m = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]{16,})\$([\w-]{32,})$/.exec(String(env.HQ_PASSCODE || '').trim());
  if (!m) return null;
  const s = { n: +m[1], r: +m[2], p: +m[3], salt: Buffer.from(m[4], 'base64url'), hash: Buffer.from(m[5], 'base64url') };
  // a pasted value that would eat the function's memory is not a passcode
  return s.n >= 1 << 14 && s.n <= 1 << 17 && (s.n & (s.n - 1)) === 0 && s.r >= 1 && s.r <= 16 && s.p >= 1 && s.p <= 4 ? s : null;
}
export const ready = (env = process.env) => !!stored(env);

export async function checkPasscode(code, env = process.env) {
  const s = stored(env);
  const c = String(code == null ? '' : code).slice(0, 200);
  if (!s || !c) return false;
  const k = await kdf(c, s.salt, s.n, s.r, s.p).catch(() => null);
  return !!k && k.length === s.hash.length && timingSafeEqual(k, s.hash);
}

/* The cookie is `<expiry>.<mac>`. The mac covers the account, the expiry and a
   fingerprint of the stored hash, so a copied cookie opens nothing for another
   account, and a new passcode invalidates every earlier one. */
const fingerprint = (env) => createHash('sha256').update(String(env.HQ_PASSCODE || '').trim()).digest('base64url').slice(0, 16);
const mac = async (aid, exp, env) => createHmac('sha256', await authSecret()).update(`hq-unlock|${aid}|${exp}|${fingerprint(env)}`).digest('base64url');
const attrs = (maxAge, secure) => `Path=${PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;

export async function unlockCookie(aid, { now = Date.now(), secure = true, env = process.env } = {}) {
  const exp = now + UNLOCK_HOURS * 3600e3;
  return { exp, header: `${COOKIE}=${exp}.${await mac(aid, exp, env)}; ${attrs(UNLOCK_HOURS * 3600, secure)}` };
}
export const clearCookie = (secure = true) => `${COOKIE}=; ${attrs(0, secure)}`;

/** Does this request carry a live unlock for this account? */
export async function unlocked(req, aid, { now = Date.now(), env = process.env } = {}) {
  if (!ready(env)) return false;
  for (const c of (req.headers.get('cookie') || '').split(/;\s*/)) {
    if (!c.startsWith(COOKIE + '=')) continue;
    const [exp, sig] = c.slice(COOKIE.length + 1).split('.');
    const e = Number(exp);
    if (!sig || !(e > now) || e > now + UNLOCK_HOURS * 3600e3) continue;
    const want = Buffer.from(await mac(aid, e, env)), got = Buffer.from(sig);
    if (want.length === got.length && timingSafeEqual(want, got)) return true;
  }
  return false;
}

/** When the door opens again after too many wrong tries (0 while it is open). */
export async function shutUntil(now = Date.now()) {
  const { data } = await readDoc(LOCK_DOC, null);
  return data && data.until > now ? data.until : 0;
}

/** One try: { ok: true } | { ok: false, left } | { ok: false, until, shut }. `shut` is
 *  true on the try that shut the door, so the founder's phone hears it once. */
export async function tryPasscode(code, { now = Date.now(), env = process.env } = {}) {
  const until = await shutUntil(now);
  if (until) return { ok: false, until };
  const good = await checkPasscode(code, env);
  let out = null;
  await casDoc(LOCK_DOC, () => ({}), (d) => {
    if (d.until > now) { out = { ok: false, until: d.until }; return false; }
    if (good) { out = { ok: true }; if (!d.fails) return false; d.fails = 0; return true; }
    d.fails = (d.last && now - d.last < LOCK_MINUTES * 60e3 ? d.fails || 0 : 0) + 1;
    d.last = now;
    if (d.fails >= LOCK_TRIES) { d.fails = 0; d.until = now + LOCK_MINUTES * 60e3; out = { ok: false, until: d.until, shut: true }; }
    else out = { ok: false, left: LOCK_TRIES - d.fails };
    return true;
  });
  return out;
}
