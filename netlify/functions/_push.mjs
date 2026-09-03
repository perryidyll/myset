import { createHmac, createHash, createPrivateKey, createPublicKey, createSign,
         createCipheriv, diffieHellman, randomBytes, createECDH } from 'node:crypto';
import { casDoc, readDoc } from './_lib.mjs';

/* WEB PUSH — a notification the server can send to an artist's phone without the
   app being open, and without an App Store.

   WHY IT IS HAND-WRITTEN. Everything the spec needs is in node:crypto, and this
   project's smallest attack surface is its two dependencies. The usual objection —
   "don't roll your own crypto" — is answered here by the specs being exhaustively
   worked: RFC 8291 ships a full test vector, and test/push.mjs reproduces it byte
   for byte. If that test passes, this is correct; if somebody breaks it, the test
   says so immediately. That is a better guarantee than a dependency nobody reads.

   RFC 8291 (Message Encryption for Web Push) over RFC 8188 (aes128gcm), with
   RFC 8292 (VAPID) for the Authorization header.

   WHAT IT IS FOR. The ARTIST, not the room. The audience never signs in
   (INVARIANT 9g) and would have to install the app before it could be notified,
   which is a non-starter in a bar. But an artist installs the Studio — it is their
   tool — so they can be told a song was requested while their screen is off.
   That also removes the reason for the Studio to poll at all, which is ~20% of a
   gig's cost from one device (INVARIANT 9d8). */

const b64u = (b) => Buffer.from(b).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');

/* A P-256 public key in X9.62 uncompressed form (0x04 || X || Y) — the shape both
   the browser and the spec speak. Node wants DER/JWK, so convert rather than
   hand-splice bytes. */
const rawToPublicKey = (raw) => {
  const b = Buffer.from(raw);
  return createPublicKey({ key: { kty: 'EC', crv: 'P-256',
    x: b64u(b.subarray(1, 33)), y: b64u(b.subarray(33, 65)) }, format: 'jwk' });
};
/* A P-256 scalar IS 32 bytes, but every minimal big-endian encoding of one drops
   its leading zeroes — so roughly one key in 256 comes out 31 bytes, one in 65,000
   at 30, and so on. RFC 7518 6.2.2.1 requires JWK `d` to be the FULL coordinate
   size, so a short one is out of spec and Node may take it, mangle it, or throw
   depending on version. Left-padding is the whole fix, and it has to happen on
   both sides: where a key is made, and where one that was made elsewhere (an env
   var Perry pasted months ago) is read back. */
const pad32 = (buf) => {
  const b = Buffer.from(buf);
  if (b.length === 32) return b;
  if (b.length > 32) return b.subarray(b.length - 32);
  return Buffer.concat([Buffer.alloc(32 - b.length), b]);
};
const rawToPrivateKey = (rawPriv, rawPub) => {
  const p = Buffer.from(rawPub);
  return createPrivateKey({ key: { kty: 'EC', crv: 'P-256',
    x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)),
    d: b64u(pad32(rawPriv)) }, format: 'jwk' });
};
const publicKeyToRaw = (key) => {
  const j = key.export({ format: 'jwk' });
  return Buffer.concat([Buffer.from([4]), unb64u(j.x), unb64u(j.y)]);
};

/** HKDF, written out rather than using crypto.hkdfSync so the two steps read the
 *  way the RFC does and a mismatch is visible against the spec text. */
function hkdf(salt, ikm, info, len) {
  const prk = createHmac('sha256', salt).update(ikm).digest();
  const out = createHmac('sha256', prk)
    .update(Buffer.concat([Buffer.from(info), Buffer.from([1])])).digest();
  return out.subarray(0, len);
}

/** RFC 8291 §3.4 + RFC 8188. Returns the complete body: header || ciphertext. */
export function encryptPayload(plaintext, uaPublicRaw, authSecret, opts = {}) {
  const uaPublic = Buffer.from(uaPublicRaw);
  const auth = Buffer.from(authSecret);
  const salt = opts.salt ? Buffer.from(opts.salt) : randomBytes(16);

  // the application server's ephemeral key for this message
  let asPrivKey, asPublic;
  if (opts.asPrivate && opts.asPublic) {           // fixed, for the spec's test vector
    asPublic = Buffer.from(opts.asPublic);
    asPrivKey = rawToPrivateKey(opts.asPrivate, asPublic);
  } else {
    const ec = createECDH('prime256v1'); ec.generateKeys();
    asPublic = ec.getPublicKey();
    asPrivKey = rawToPrivateKey(ec.getPrivateKey(), asPublic);
  }

  const shared = diffieHellman({ privateKey: asPrivKey, publicKey: rawToPublicKey(uaPublic) });

  // §3.3 — the receiver's key comes FIRST. Swapping these is the classic bug, and
  // it fails silently: the push is accepted and the phone shows nothing.
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdf(auth, shared, keyInfo, 32);

  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  // 0x02 is the last-record delimiter (RFC 8188 §2); a single record is all we send
  const padded = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]);
  const c = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(padded), c.final(), c.getAuthTag()]);

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic]);
  return Buffer.concat([header, body]);
}

/** RFC 8292 — proves to the push service who is sending, without a shared secret. */
export async function vapidHeaders(endpoint, subject, publicRaw, privateRaw) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({
    aud, sub: subject, exp: Math.floor(Date.now() / 1000) + 12 * 3600,
  }));
  const signer = createSign('SHA256');
  signer.update(`${head}.${body}`);
  // ES256 wants the raw r||s pair, not the DER wrapper Node emits by default
  const sig = signer.sign({ key: rawToPrivateKey(privateRaw, publicRaw), dsaEncoding: 'ieee-p1363' });
  return {
    authorization: `vapid t=${head}.${body}.${b64u(sig)}, k=${b64u(publicRaw)}`,
    'content-encoding': 'aes128gcm',
    'content-type': 'application/octet-stream',
  };
}

/* ---------- storage: one document per artist, holding their devices ---------- */
const SUBS = (aid) => `push_${aid}`;
const MAX_DEVICES = 8;

export async function readSubs(aid) {
  const { data } = await readDoc(SUBS(aid), null);
  const d = data || { v: 1, subs: [] };
  d.subs = (Array.isArray(d.subs) ? d.subs : []).filter((s) => s && s.endpoint);
  return d;
}
export const mutateSubs = (aid, fn) =>
  casDoc(SUBS(aid), () => ({ v: 1, subs: [] }), (d) => {
    d.subs = Array.isArray(d.subs) ? d.subs : []; return fn(d);
  });

export async function saveSub(aid, sub) {
  const endpoint = String((sub && sub.endpoint) || '');
  const keys = (sub && sub.keys) || {};
  if (!/^https:\/\//.test(endpoint) || !keys.p256dh || !keys.auth) return false;
  await mutateSubs(aid, (d) => {
    d.subs = d.subs.filter((s) => s.endpoint !== endpoint);
    d.subs.push({ endpoint, p256dh: String(keys.p256dh), auth: String(keys.auth), at: Date.now() });
    // newest wins; an artist with nine phones is a lost device, not a fleet
    if (d.subs.length > MAX_DEVICES) d.subs = d.subs.slice(-MAX_DEVICES);
    return true;
  });
  return true;
}
export const dropSub = (aid, endpoint) =>
  mutateSubs(aid, (d) => {
    const n = d.subs.length;
    d.subs = d.subs.filter((s) => s.endpoint !== endpoint);
    return d.subs.length !== n;
  }).catch(() => {});

/** Fire and forget, to every device the artist has. Never throws: a notification
 *  that fails must never break the thing that triggered it (INVARIANT 16). */
export async function notify(aid, { title, body, url = '/studio', tag = 'myset' }) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@myset.vip';
  if (!pub || !priv) return { ok: false, reason: 'not-configured' };

  const { subs } = await readSubs(aid);
  if (!subs.length) return { ok: true, sent: 0 };

  const payload = JSON.stringify({ title, body, url, tag });
  let sent = 0, gone = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const enc = encryptPayload(payload, unb64u(s.p256dh), unb64u(s.auth));
      const h = await vapidHeaders(s.endpoint, subject, unb64u(pub), unb64u(priv));
      const r = await fetch(s.endpoint, {
        method: 'POST', headers: { ...h, ttl: '900' }, body: enc,
      });
      if (r.status === 404 || r.status === 410) { await dropSub(aid, s.endpoint); gone++; }
      else if (r.ok) sent++;
    } catch { /* a dead push service is not the artist's problem */ }
  }));
  return { ok: true, sent, gone };
}

/** Generate a VAPID pair. Perry runs this once and sets the two env vars himself;
 *  the private key must never be in the repo or pass through a chat window. */
export function generateVapidKeys() {
  const ec = createECDH('prime256v1'); ec.generateKeys();
  /* pad32, because getPrivateKey() strips leading zeroes — see the note on
     rawToPrivateKey. Without it about one generated key in 256 is 31 bytes, which
     is an invalid JWK scalar, and the only symptom would be that push quietly
     stopped working for whoever happened to generate that key. */
  return { publicKey: b64u(ec.getPublicKey()), privateKey: b64u(pad32(ec.getPrivateKey())) };
}
