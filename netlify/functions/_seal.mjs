import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { keysFor } from './_secret.mjs';

/* SEALED AT REST (decision 0113).

   Netlify encrypts the store's disks, and that protects the disks. It does nothing
   about the ways a document actually leaks: a Netlify token that reads the store, a
   copy on R2 made by the nightly mirror, a backup on a laptop, a preview deploy
   pointed at the live store. Until 2026-09-28 every one of those handed over the
   booker's email and phone, the ID photos waiting for review, the password hashes,
   the recovery codes, every session, the error log and HQ's contacts — in the clear.

   So the few documents that hold something personal are SEALED before they are
   written and opened after they are read. Everything that copies raw bytes — the
   mirror, the backup, a version — copies ciphertext and inherits the protection
   without a line changing.

   WHAT IS SEALED, and what never is. `protectedKey` is a short allow-list of key
   prefixes: the booker threads and inbox, the credentials, the recovery codes, the
   sessions, the activity log, the push subscriptions, the bug and error logs, the
   ID review queue and the ID photo itself, and HQ's contacts and its Gmail record.
   Nothing the room's poll reads is on it — not the show, not a fan shard, not the
   registry, not a profile — and test/seal.mjs holds that list against the poll's
   keys, because a microsecond on the hot path is a microsecond on every phone.

   THE KEYRING. Records are not sealed with a key cut from `MYSET_SECRET` directly.
   They are sealed with a random data key kept in ONE document, `sealkeys`, and that
   document holds its keys only WRAPPED (AES-256-GCM) under the `wrap` key the secret
   gives (_secret.mjs). A copy of the store is a copy of wrapped keys nobody can open.
   What this buys is rotation: a new `MYSET_SECRET` re-wraps one document — the first
   request that needs the ring opens it with `MYSET_SECRET_PREVIOUS`, adds a fresh data
   key for everything written from then on, wraps them all under the new secret and
   writes it back — and no record anywhere has to be re-encrypted. Old data keys are
   kept in the ring for ever, so a record written years ago still opens. Once the ring
   is re-wrapped the previous value can be removed and nothing is stranded.

   THE SHAPE of a sealed record: `MS1:` + the data key's four-hex id + `:`, then a
   12-byte IV, the 16-byte GCM tag, then the ciphertext. The record's own blob key is
   the additional authenticated data, so bytes copied under another key refuse to
   open. Thirty-seven bytes of overhead, microseconds a document.

   NOTHING HERE CAN BREAK A GIG. With no secret configured `seal` writes plaintext and
   `open` reads it: the store is exactly as it was. A plaintext record under a
   protected key still reads, and is sealed the next time it is written — that IS the
   migration, with no batch and no list(). A sealed record that cannot be opened (the
   secret is gone, or wrong, or the bytes were touched) reads as MISSING and refuses
   to be written over: the door it guards fails closed, the record is kept for the day
   the key comes back, and the room, which never reads one, keeps voting. The keyring
   is never made twice: if `sealkeys` exists and cannot be opened, nothing is sealed
   and nothing is written until it can. */

export const MAGIC = 'MS1:';
export const RING_KEY = 'sealkeys';
const HEAD = 9, IV = 12, TAG = 16, DEK = 32;          // "MS1:kkkk:" + iv + tag, then the ciphertext
const PREFIXES = ['msg_', 'inbox_', 'inboxarch_', 'cred_', 'rec_', 'sess_', 'log_', 'push_', 'bugs_', 'err_', 'crm'];
const EXACT = new Set(['idqueue', 'suggest']);   // suggest: the Studios' suggestions box (0127), a name and free text
/* A version (`ver_<key>_<ts>`) is sealed when the document it copies is. */
const inner = (key) => String(key || '').replace(/^ver_/, '');
/** The sealed families, as the master overview names them (tools/overview.mjs). */
export const FAMILIES = [...PREFIXES, ...EXACT, 'img_<owner>_idcheck'];
export function protectedKey(key) {
  const k = inner(key);
  return EXACT.has(k) || PREFIXES.some((p) => k.startsWith(p)) || /^img_.+_idcheck$/.test(k);
}

/** Four hex characters that name a key without saying anything about it. */
export const kidOf = (k) => createHash('sha256').update(k).digest('hex').slice(0, 4);
export const isSealed = (b) => Buffer.isBuffer(b) && b.length >= HEAD + IV + TAG
  && b.subarray(0, 4).toString('latin1') === MAGIC && b[8] === 0x3a;

const gcm = (key, iv, aad) => { const c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(aad)); return c; };
const wrap = (kek, id, dek) => {
  const iv = randomBytes(IV), c = gcm(kek, iv, `myset-sealkeys|${id}`);
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
};
const unwrap = (kek, id, w) => {
  const b = Buffer.from(String(w || ''), 'base64url');
  if (b.length !== IV + TAG + DEK) throw new Error('shape');
  const d = createDecipheriv('aes-256-gcm', kek, b.subarray(0, IV));
  d.setAAD(Buffer.from(`myset-sealkeys|${id}`));
  d.setAuthTag(b.subarray(IV, IV + TAG));
  return Buffer.concat([d.update(b.subarray(IV + TAG)), d.final()]);
};
/** A fresh data key whose id is not already in the ring. */
const freshKey = (taken) => {
  for (;;) { const k = randomBytes(DEK), id = kidOf(k); if (!taken[id]) return { k, id }; }
};

/* ---------- the ring, read once per warm instance ----------
   RING: { kek, cur, keys: Map(id -> data key), at } when it opened, or { kek, fail, at }
   when it did not (tried again after a minute, never written over). */
let RING = null;
const RETRY_MS = 60e3;
const ABSENT = Symbol('absent');     // what casDoc hands the callback when there is no document at all
/** For tests only: forget the ring so the next call reads it again. */
export const __resetRing = () => { RING = null; };

/* One line per reason per warm instance — never the bytes, never a key. */
const said = new Set();
const sayOnce = (what) => { if (!said.has(what)) { said.add(what); console.error(what); } };

/** The keyring: null when no secret is configured (plaintext mode), else the ring or
 *  a `{ fail }` naming why it cannot be opened. */
export async function ring() {
  const ks = keysFor('wrap');
  if (!ks) return null;
  const kek = kidOf(ks.sign);
  if (RING && RING.kek === kek && (!RING.fail || Date.now() - RING.at < RETRY_MS)) return RING;
  const { casDoc, isStoreError } = await import('./_lib.mjs');
  let out = null;
  try {
    await casDoc(RING_KEY, () => ({ [ABSENT]: true }), (d) => {
      const now = Date.now();
      /* No ring yet: make one. Written only if nobody else made one first (casDoc's
         onlyIfNew), so two cold instances agree on the same keys. ONLY when the
         document is truly absent: one that exists but is not a ring is never
         replaced — that would throw away every key it held. */
      if (d[ABSENT]) {
        delete d[ABSENT];
        const { k, id } = freshKey({});
        d.v = 1; d.kek = kek; d.cur = id; d.keys = { [id]: wrap(ks.sign, id, k) }; d.at = now; d.made = now;
        out = { kek, cur: id, keys: new Map([[id, k]]), at: now };
        return true;
      }
      if (!d.keys || typeof d.keys !== 'object' || !d.kek || !d.cur) { out = { kek, fail: 'malformed', at: now }; return false; }
      const open = (kk) => {
        const keys = new Map();
        for (const [id, w] of Object.entries(d.keys)) keys.set(id, unwrap(kk, id, w));
        return keys;
      };
      if (d.kek === kek) {
        try { out = { kek, cur: d.cur, keys: open(ks.sign), at: now }; }
        catch { out = { kek, fail: 'unwrap', at: now }; }
        if (out.keys && !out.keys.has(out.cur)) out = { kek, fail: 'no-current', at: now };
        return false;                                      // nothing to write
      }
      /* THE ROTATION. The ring is wrapped under the previous secret: open it with
         that, add a fresh key for everything written from now on, wrap them all
         under the new secret and write it back. One document; no record moves. */
      if (ks.previous && d.kek === kidOf(ks.previous)) {
        let keys;
        try { keys = open(ks.previous); } catch { out = { kek, fail: 'unwrap-previous', at: now }; return false; }
        const { k, id } = freshKey(d.keys);
        keys.set(id, k);
        d.keys = Object.fromEntries([...keys].map(([i, kk]) => [i, wrap(ks.sign, i, kk)]));
        d.kek = kek; d.cur = id; d.at = now; d.rotations = (Number(d.rotations) || 0) + 1;
        out = { kek, cur: id, keys, at: now, rewrapped: true };
        return true;
      }
      out = { kek, fail: 'unknown-secret', at: now };
      return false;
    }, null, 8);
  } catch (e) {
    /* The store not answering is not a ring that cannot be opened (decision 0142):
       nothing is remembered, and the caller gets the StoreError — guard() answers
       503 "busy", and the next request reads the ring again. */
    if (isStoreError(e)) throw e;
    out = { kek, fail: 'unreadable', at: Date.now() };
  }
  if (!out) out = { kek, fail: 'unreadable', at: Date.now() };
  if (out.fail) sayOnce(`the sealing keyring could not be opened (${out.fail}) — sealed records read as missing, nothing sealed is written`);
  else if (out.rewrapped) console.log('the sealing keyring was wrapped under the new MYSET_SECRET; MYSET_SECRET_PREVIOUS may now be removed');
  return (RING = out);
}

/** The bytes to store for `key`: sealed when a secret is configured, else as given.
 *  Throws when a secret is set but the ring cannot be opened — never writes in the
 *  clear what should be sealed. */
export async function seal(key, plain) {
  const p = Buffer.isBuffer(plain) ? plain : Buffer.from(String(plain));
  const r = await ring();
  if (!r) return p;
  if (r.fail) throw new Error('sealed');
  const iv = randomBytes(IV);
  const c = gcm(r.keys.get(r.cur), iv, String(key));
  const ct = Buffer.concat([c.update(p), c.final()]);
  return Buffer.concat([Buffer.from(`${MAGIC}${r.cur}:`, 'latin1'), iv, c.getAuthTag(), ct]);
}

/** What was stored under `key`, opened: { data } — with `plain` when it was never
 *  sealed (sealed on its next write) and `stale` when an older data key sealed it —
 *  or { fail } when it is sealed and cannot be opened. */
export async function open(key, buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (!isSealed(b)) return { data: b, plain: true };
  const r = await ring();
  if (!r) return { fail: 'no-key' };
  if (r.fail) return { fail: r.fail };
  const id = b.subarray(4, 8).toString('latin1');
  const k = r.keys.get(id);
  if (!k) return { fail: 'unknown-key' };
  try {
    const d = createDecipheriv('aes-256-gcm', k, b.subarray(HEAD, HEAD + IV));
    d.setAAD(Buffer.from(String(key)));
    d.setAuthTag(b.subarray(HEAD + IV, HEAD + IV + TAG));
    return { data: Buffer.concat([d.update(b.subarray(HEAD + IV + TAG)), d.final()]), stale: id !== r.cur };
  } catch { return { fail: 'tamper' }; }
}

/* One line per key per warm instance — the key's name and the reason, never the bytes. */
export function sealFailed(key, why) {
  sayOnce(`sealed record ${key} could not be opened (${why}) — read as missing, writes refused`);
}
