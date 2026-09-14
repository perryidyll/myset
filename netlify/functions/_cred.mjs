import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readDoc, casDoc, store, sha } from './_lib.mjs';

/* A PASSWORD, PER PERSON. Decision 0070 (the founder, 2026-09-14): "the fully
   standard shape" — the email address is the username, a password sits under it,
   and the sign-in screen looks like every other one. ACCOUNTS.md §9b had said
   "never passwords"; this revises it, on his call, and keeps what made that
   answer right: the email code is still the front door for a new account and
   the whole of "forgot", so nothing new has to be recovered.

   ONE PER EMAIL ROW, never per page. A Rock Star page has five people on it and
   each keeps their own password and their own role — the shared page secret is
   the Studio code, which stays as the small door it became on 2026-09-12.

   HASHED LIKE A PASSWORD. scrypt from node:crypto (no dependency), a 16-byte
   salt per record, N=2^14 r=8 p=1 — about 40 ms on a function, paid ONCE at
   sign-in, because a correct password is exchanged for the same 30-day session
   token every other door mints. It never travels on a request after that, which
   is the one thing the Studio code cannot say for itself. Compared in constant
   time. The document is `cred_<owner>_<hash of email>`: computable (INVARIANT 1),
   off every hot path, in `keysFor` for export-less delete (a hash is not data an
   artist takes with them), skipped by nothing else.

   WHAT A PASSWORD MAY NOT BE: shorter than 8 or longer than 128 characters, the
   email address itself, one character repeated, or one of the handful everybody
   tries first. No breach-list lookup — that is an outbound call to a third party
   on the sign-in path, and the lockout (five wrong, then a wait) is the guard
   that matters against guessing. */

const scrypt = promisify(scryptCb);
export const PW_MIN = 8, PW_MAX = 128;
const N = 16384, R = 8, P = 1, LEN = 32;
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'iloveyou', 'letmein1', 'welcome1', 'admin123', 'abc12345', 'football',
  'baseball', 'sunshine', 'princess', 'trustno1', 'monkey12', 'dragon12', 'myset123', 'mysetvip']);

export const credKey = (owner, email) => `cred_${owner}_${sha(`myset-cred|${email}`).slice(0, 24)}`;

/** Why a password is refused, in a sentence for the person, or null when it is fine. */
export function weakPassword(pw, email = '') {
  const s = String(pw || '');
  if (s.length < PW_MIN) return `At least ${PW_MIN} characters`;
  if (s.length > PW_MAX) return `At most ${PW_MAX} characters`;
  if (/^(.)\1+$/.test(s)) return 'Not the same character over and over';
  const low = s.toLowerCase();
  if (email && (low === String(email).toLowerCase() || low === String(email).toLowerCase().split('@')[0])) return 'Not your email address';
  if (COMMON.has(low)) return 'That one is too easy to guess';
  return null;
}

const derive = async (pw, salt) => scrypt(String(pw).normalize('NFKC'), salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });

export async function setPassword(owner, email, pw) {
  const salt = randomBytes(16);
  const hash = await derive(pw, salt);
  const doc = { v: 1, alg: 'scrypt', N, r: R, p: P, salt: salt.toString('base64'), hash: hash.toString('base64'), setAt: Date.now() };
  await store().set(credKey(owner, email), JSON.stringify(doc));
  return true;
}

export async function hasPassword(owner, email) {
  const { data } = await readDoc(credKey(owner, email), null);
  return !!(data && data.hash);
}

/** True only for the right password. A missing record costs the same time as a
 *  wrong password, so the door cannot say which addresses have one. */
export async function checkPassword(owner, email, pw) {
  const { data } = await readDoc(credKey(owner, email), null);
  const salt = data && data.salt ? Buffer.from(data.salt, 'base64') : Buffer.alloc(16, 7);
  const want = data && data.hash ? Buffer.from(data.hash, 'base64') : Buffer.alloc(LEN, 0);
  const got = await scrypt(String(pw || '').normalize('NFKC'), salt, LEN,
    { N: (data && data.N) || N, r: (data && data.r) || R, p: (data && data.p) || P, maxmem: 64 * 1024 * 1024 });
  return !!(data && data.hash) && got.length === want.length && timingSafeEqual(got, want);
}

export async function clearPassword(owner, email) {
  try { await store().delete(credKey(owner, email)); } catch {}
}

/* Five wrong passwords on one address and it waits. Keyed by the address, not
   the page, so a guess at a band mate's password never locks the owner's door. */
export const LOCK_TRIES = 5, LOCK_FOR = 15 * 60e3, LOCK_WINDOW = 15 * 60e3;
const lockKey = (email, realm = '') => `lock_pw_${sha(`myset-pwlock|${realm}|${email}`).slice(0, 24)}`;
export async function passwordLocked(email, realm = '') {
  const { data } = await readDoc(lockKey(email, realm), null);
  return !!(data && data.until && data.until > Date.now());
}
export async function notePasswordFailure(email, realm = '') {
  await casDoc(lockKey(email, realm), () => ({}), (d) => {
    const now = Date.now();
    d.fails = (d.fails || []).filter((t) => now - t < LOCK_WINDOW);
    d.fails.push(now);
    if (d.fails.length >= LOCK_TRIES) { d.until = now + LOCK_FOR; d.fails = []; }
    return true;
  }).catch(() => {});
}
export const clearPasswordFailures = (email, realm = '') =>
  casDoc(lockKey(email, realm), () => ({}), (d) => { d.fails = []; d.until = 0; return true; }).catch(() => {});
