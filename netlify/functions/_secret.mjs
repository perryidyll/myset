import { hkdfSync } from 'node:crypto';

/* THE ONE SECRET THE SERVER IS GIVEN, AND THE KEYS CUT FROM IT (decision 0112).

   Until 2026-09-28 the only key MySet had was generated once into the Blobs store
   (`authsecret`): private to the site, but sitting in the SAME store as the sessions,
   the recovery codes and the registry it protects. A leaked Netlify token, a store
   dump, a copy on the mirror or a laptop backup: whoever held the data also held the
   key that mints a session for any account on the platform.

   This file reads ONE environment variable, `MYSET_SECRET`, and cuts every key the
   server needs from it with HKDF (RFC 5869), each under its own label, so keys for
   different jobs are unrelated even though the founder sets a single value:

     auth   HMAC key for session tokens, tickets, one-time codes, the passcode cookie
     room   HMAC key for the network hash (roomHash), so an address cannot be read
            back out of a document by trying all four billion of them
     wrap   AES-256-GCM key that wraps the keyring the records are sealed with
            (_seal.mjs) — never a record key itself, which is what makes a new
            secret a one-document change instead of a re-encryption of the store

   ROTATION (HARDENING.md §0). Put the value in use into `MYSET_SECRET_PREVIOUS`, a new
   one into `MYSET_SECRET`, redeploy. The previous value is used for exactly one thing:
   to open the keyring once and wrap it again under the new one (_seal.mjs does it on
   the first request that needs it). It never verifies a token, so a rotation signs
   every device out once — which is what a rotation after a leak must do, and a
   routine one costs a sign-in. Recovery codes, Studio codes and passwords are slow
   salted hashes that depend on no key at all, and every sealed record opens under
   the re-wrapped keyring, so nothing is stranded when the previous value is removed.

   NOTHING HERE CAN BREAK A GIG. With no `MYSET_SECRET` the server behaves exactly as
   it did before this file existed: _auth.mjs signs with the store-kept key and
   _seal.mjs writes plain records. A value shorter than MIN_LENGTH is ignored, and said
   so once in the log — never echoed. Once set it must never be removed: the records
   sealed under it would read as missing until it came back (they are kept, never
   written over).

   The value is read by nothing but this file, never logged, never sent, never written
   anywhere. INVARIANT 11: the variable is named in documents, its value never. */

export const ENV = 'MYSET_SECRET';
export const ENV_PREVIOUS = 'MYSET_SECRET_PREVIOUS';
export const MIN_LENGTH = 32;
const SALT = 'myset|keys|v1';
const KEY_BYTES = 32;

const raw = (name) => String(process.env[name] || '').trim();
const value = (name) => { const v = raw(name); return v.length >= MIN_LENGTH ? v : ''; };
/** Is the server holding its own secret? False means "the old way, from the store". */
export const configured = () => !!value(ENV);

let warned = '';
const warnOnce = (name) => {
  if (warned.includes(name + ' ')) return;
  warned += name + ' ';
  console.warn(`${name} is set but shorter than ${MIN_LENGTH} characters and is being ignored`);
};

/* Derived keys are cached against the value they came from (already in this
   process's memory, in its environment) — a test flips the variables between
   sections, and a warm function sees a new value only at its next cold start, which
   is what a deploy is. roomHash asks on a fan's request, so a hit is one map lookup. */
const cache = new Map();
function derive(ikm, label) {
  const id = `${label}|${ikm}`;
  let k = cache.get(id);
  if (!k) { k = Buffer.from(hkdfSync('sha256', ikm, SALT, `myset|${label}`, KEY_BYTES)); cache.set(id, k); }
  return k;
}

/** The key for one purpose: `sign` (cut from the current value) and `previous` (cut
 *  from MYSET_SECRET_PREVIOUS while it is set, else null). null when no secret is
 *  configured. Only the keyring reads `previous` (see the header). */
export function keysFor(label) {
  const cur = value(ENV);
  if (!cur) { if (raw(ENV)) warnOnce(ENV); return null; }
  const prev = value(ENV_PREVIOUS);
  if (!prev && raw(ENV_PREVIOUS)) warnOnce(ENV_PREVIOUS);
  return { sign: derive(cur, label), previous: prev && prev !== cur ? derive(prev, label) : null };
}
