import { createHash, createVerify, createPublicKey, randomBytes, timingSafeEqual } from 'node:crypto';
import { readDoc, casDoc } from './_lib.mjs';

/* PASSKEYS — signing in with Face ID instead of a code from an email.

   Perry: "how much extra load will creating an actual account system add? ...
   implement the best option only for me."

   WHAT A PASSKEY IS, IN ONE LINE. The phone keeps a private key it will only use
   after it has seen your face or your thumb; the server keeps the matching public
   key. Signing in is a signature, so there is no password to steal, no code to
   type on stage, and nothing an attacker can phish — the browser refuses to sign
   for the wrong domain, which no human ever gets right on their own.

   WHY THIS IS THE RIGHT NEXT STEP AND NOT A REWRITE. MySet's sign-in today is a
   six-digit code by email, and that is genuinely fine — it is the same thing a
   password reset is, without the password. What it is NOT is fast: on a dark stage,
   between songs, "open your email, find the code, type it" is a minute. A passkey
   is a look at the phone. So this is added ALONGSIDE the code, never instead of it:
   the code is the recovery path a passkey needs anyway, and an account with one way
   in is an account that can be locked. ACCOUNTS.md §9 has the whole argument.

   NO DEPENDENCY. WebAuthn verification is four things Node already does — SHA-256,
   an ECDSA or RSA signature check, base64url, and enough CBOR to read two maps.
   The npm libraries are convenience, not capability, and a dependency in the
   sign-in path is a dependency that can be taken over.

   WHAT IS DELIBERATELY NOT VERIFIED: attestation. Passkeys are created with
   `attestation: "none"` because MySet does not care WHICH brand of authenticator a
   musician owns — only that the same one comes back next time. Checking a vendor
   certificate chain here would add real complexity to reject nothing we want to
   reject. Named out loud so nobody later mistakes it for an oversight.

   THE FIVE THINGS THAT MUST BE CHECKED, and each is a real attack if skipped:
     1. type      — 'webauthn.create' on register, 'webauthn.get' on sign-in.
                    Without it a registration ceremony can be replayed as a login.
     2. challenge — ours, recent, and USED ONCE. This is the whole replay defence.
     3. origin    — exactly our site. This is the anti-phishing property; skipping
                    it throws away the only real advantage over a password.
     4. rpIdHash  — the authenticator's own view of the domain, which must agree.
     5. signature — over authData || SHA-256(clientDataJSON), no exceptions. */

export const PK = (owner) => `pkeys_${owner}`;
export const CHAL_TTL = 5 * 60e3;
export const MAX_KEYS = 8;

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s || ''), 'base64url');
const sha256 = (b) => createHash('sha256').update(b).digest();
const eq = (a, b) => a.length === b.length && timingSafeEqual(a, b);

/* ---------- just enough CBOR ------------------------------------------------
   Two structures are ever decoded here: the attestation object (a 3-key map) and
   a COSE key (a small integer-keyed map). Major types 0-5 cover both. Anything
   else throws rather than being guessed at — a parser that shrugs is a parser
   that can be fed something surprising. */
function cbor(buf, p = 0) {
  const b = buf[p], major = b >> 5, minor = b & 31;
  let len = minor, q = p + 1;
  if (minor === 24) { len = buf[q]; q += 1; }
  else if (minor === 25) { len = buf.readUInt16BE(q); q += 2; }
  else if (minor === 26) { len = buf.readUInt32BE(q); q += 4; }
  else if (minor === 27) { len = Number(buf.readBigUInt64BE(q)); q += 8; }
  else if (minor > 27) throw new Error('cbor');

  if (major === 0) return [len, q];
  if (major === 1) return [-1 - len, q];
  if (major === 2) return [buf.subarray(q, q + len), q + len];
  if (major === 3) return [buf.toString('utf8', q, q + len), q + len];
  if (major === 4) {
    const out = [];
    for (let i = 0; i < len; i++) { const [v, n] = cbor(buf, q); out.push(v); q = n; }
    return [out, q];
  }
  if (major === 5) {
    const out = new Map();
    for (let i = 0; i < len; i++) {
      const [k, n1] = cbor(buf, q); const [v, n2] = cbor(buf, n1);
      out.set(k, v); q = n2;
    }
    return [out, q];
  }
  throw new Error('cbor major ' + major);
}

/* ---------- COSE public key -> something Node can verify with ---------------
   Built as DER by hand. For P-256 the SPKI prefix is fixed, so the key is the
   prefix plus the uncompressed point; for RSA the modulus and exponent are
   wrapped in a minimal SEQUENCE. */
const P256_SPKI = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
const der = (tag, body) => {
  const n = body.length;
  const len = n < 128 ? Buffer.from([n])
    : n < 256 ? Buffer.from([0x81, n])
      : Buffer.from([0x82, n >> 8, n & 255]);
  return Buffer.concat([Buffer.from([tag]), len, body]);
};
const uint = (b) => der(0x02, b[0] & 0x80 ? Buffer.concat([Buffer.from([0]), b]) : b);

export function coseToKey(cose) {
  const kty = cose.get(1), alg = cose.get(3);
  if (kty === 2) {                                  // EC2
    if (alg !== -7) throw new Error('unsupported curve algorithm');
    const x = Buffer.from(cose.get(-2)), y = Buffer.from(cose.get(-3));
    if (x.length !== 32 || y.length !== 32) throw new Error('bad point');
    const spki = Buffer.concat([P256_SPKI, Buffer.from([0x04]), x, y]);
    return { key: createPublicKey({ key: spki, format: 'der', type: 'spki' }), alg: -7 };
  }
  if (kty === 3) {                                  // RSA
    if (alg !== -257) throw new Error('unsupported rsa algorithm');
    const n = Buffer.from(cose.get(-1)), e = Buffer.from(cose.get(-2));
    const rsa = der(0x30, Buffer.concat([uint(n), uint(e)]));
    const spki = der(0x30, Buffer.concat([
      Buffer.from('300d06092a864886f70d0101010500', 'hex'),
      der(0x03, Buffer.concat([Buffer.from([0]), rsa])),
    ]));
    return { key: createPublicKey({ key: spki, format: 'der', type: 'spki' }), alg: -257 };
  }
  throw new Error('unsupported key type');
}

/* authenticatorData: 32 bytes rpIdHash, 1 flag byte, 4 bytes counter, then —
   when the AT flag is set — the AAGUID, the credential id and the COSE key. */
export function readAuthData(buf) {
  if (buf.length < 37) throw new Error('short authData');
  const flags = buf[32];
  const out = {
    rpIdHash: buf.subarray(0, 32),
    up: !!(flags & 0x01), uv: !!(flags & 0x04),
    at: !!(flags & 0x40), count: buf.readUInt32BE(33),
  };
  if (out.at) {
    const idLen = buf.readUInt16BE(53);
    out.credId = buf.subarray(55, 55 + idLen);
    out.cose = cbor(buf, 55 + idLen)[0];
  }
  return out;
}

/* ---------- what we keep ---------- */
const empty = () => ({ v: 1, keys: [], chal: null });
export async function readKeys(owner) {
  const { data } = await readDoc(PK(owner), null);
  const d = { ...empty(), ...(data || {}) };
  d.keys = Array.isArray(d.keys) ? d.keys : [];
  return d;
}
export const hasPasskey = async (owner) => (await readKeys(owner)).keys.length > 0;

/** A fresh challenge, kept on the server. One at a time, and it expires. */
export async function newChallenge(owner, kind) {
  const c = b64u(randomBytes(32));
  await casDoc(PK(owner), empty, (d) => {
    d.chal = { c, kind, at: Date.now() };
    return true;
  });
  return c;
}
/** Take the challenge, ONCE. Returns false if it is missing, stale or the wrong kind. */
async function spendChallenge(owner, kind, given) {
  let okc = false;
  await casDoc(PK(owner), empty, (d) => {
    const ch = d.chal;
    if (!ch || ch.kind !== kind || Date.now() - ch.at > CHAL_TTL) { d.chal = null; return true; }
    /* Compared as bytes, and cleared whether or not it matched — a challenge that
       survives a wrong answer is a challenge an attacker can keep guessing at. */
    okc = ch.c === String(given || '');
    d.chal = null;
    return true;
  });
  return okc;
}

/* ---------- the two ceremonies ---------- */
function checkClientData(raw, kind, expectOrigin) {
  let cd;
  try { cd = JSON.parse(Buffer.from(raw).toString('utf8')); } catch { return { error: 'unreadable' }; }
  if (cd.type !== kind) return { error: 'wrong ceremony' };
  const origin = String(cd.origin || '');
  if (origin !== expectOrigin) return { error: 'wrong site' };
  return { challenge: String(cd.challenge || '') };
}

/**
 * Finish registering a passkey. `owner` is already signed in — this is a thing you
 * add to an account, never a way to create one.
 */
export async function register(owner, { id, clientDataJSON, attestationObject, label }, { origin, rpId }) {
  const cd = checkClientData(unb64u(clientDataJSON), 'webauthn.create', origin);
  if (cd.error) return { ok: false, error: 'That didn’t come from this site.' };
  if (!(await spendChallenge(owner, 'create', cd.challenge)))
    return { ok: false, error: 'That took too long — try again.' };

  let att, auth, pub;
  try {
    att = cbor(unb64u(attestationObject))[0];
    auth = readAuthData(Buffer.from(att.get('authData')));
    if (!auth.at || !auth.cose) return { ok: false, error: 'Your phone didn’t send a key.' };
    if (!eq(auth.rpIdHash, sha256(Buffer.from(rpId)))) return { ok: false, error: 'That key is for a different site.' };
    if (!auth.up) return { ok: false, error: 'That wasn’t confirmed on the device.' };
    pub = coseToKey(auth.cose);
  } catch (e) { return { ok: false, error: 'Couldn’t read that key.' }; }

  const credId = b64u(auth.credId);
  if (id && String(id) !== credId) return { ok: false, error: 'That key didn’t match itself.' };

  let full = false;
  await casDoc(PK(owner), empty, (d) => {
    d.keys = Array.isArray(d.keys) ? d.keys : [];
    if (d.keys.some((k) => k.id === credId)) return false;         // already have it
    if (d.keys.length >= MAX_KEYS) { full = true; return false; }
    d.keys.push({
      id: credId,
      pub: pub.key.export({ format: 'der', type: 'spki' }).toString('base64url'),
      alg: pub.alg, count: auth.count,
      label: String(label || 'This device').replace(/\s+/g, ' ').trim().slice(0, 40) || 'This device',
      at: Date.now(), lastAt: 0,
    });
    return true;
  });
  if (full) return { ok: false, error: `That’s ${MAX_KEYS} devices — remove one first.` };
  return { ok: true, id: credId };
}

/**
 * Verify a sign-in. Returns { ok, id } — the caller mints the session, because
 * minting a session is the caller's job and this file must never be the thing
 * that decides somebody is signed in.
 */
export async function assert(owner, { id, clientDataJSON, authenticatorData, signature }, { origin, rpId }) {
  const cd = checkClientData(unb64u(clientDataJSON), 'webauthn.get', origin);
  if (cd.error) return { ok: false, error: 'That didn’t come from this site.' };
  if (!(await spendChallenge(owner, 'get', cd.challenge)))
    return { ok: false, error: 'That took too long — try again.' };

  const store = await readKeys(owner);
  const rec = store.keys.find((k) => k.id === String(id || ''));
  if (!rec) return { ok: false, error: 'That key isn’t registered here.' };

  let auth;
  const authBytes = unb64u(authenticatorData);
  try { auth = readAuthData(authBytes); } catch { return { ok: false, error: 'Couldn’t read that.' }; }
  if (!eq(auth.rpIdHash, sha256(Buffer.from(rpId)))) return { ok: false, error: 'That key is for a different site.' };
  if (!auth.up) return { ok: false, error: 'That wasn’t confirmed on the device.' };

  const signed = Buffer.concat([authBytes, sha256(unb64u(clientDataJSON))]);
  const key = createPublicKey({ key: unb64u(rec.pub), format: 'der', type: 'spki' });
  let good = false;
  try {
    const v = createVerify('SHA256');
    v.update(signed); v.end();
    good = v.verify(key, unb64u(signature));
  } catch { good = false; }
  if (!good) return { ok: false, error: 'That didn’t check out.' };

  /* THE COUNTER, and why it only ever warns. An authenticator that keeps a signature
     counter increments it every time; a counter that goes BACKWARDS means the key
     was cloned. But passkeys synced through iCloud or Google deliberately report
     zero for ever, so refusing on "not greater" would lock out exactly the devices
     this feature exists for. So: reject only when BOTH sides are non-zero and it
     went backwards, which is the real signal and nothing else. */
  if (rec.count > 0 && auth.count > 0 && auth.count <= rec.count)
    return { ok: false, error: 'That key looks copied. Sign in with a code instead.' };

  await casDoc(PK(owner), empty, (d) => {
    const k = (d.keys || []).find((x) => x.id === rec.id);
    if (!k) return false;
    k.count = auth.count; k.lastAt = Date.now();
    return true;
  }).catch(() => {});
  return { ok: true, id: rec.id, label: rec.label };
}

export async function forget(owner, id) {
  let gone = false;
  await casDoc(PK(owner), empty, (d) => {
    const before = (d.keys || []).length;
    d.keys = (d.keys || []).filter((k) => k.id !== String(id || ''));
    gone = d.keys.length < before;
    return gone;
  });
  return { ok: gone, error: gone ? '' : 'That key is already gone.' };
}

export const listKeys = async (owner) => (await readKeys(owner)).keys
  .map(({ id, label, at, lastAt }) => ({ id, label, at, lastAt }));
