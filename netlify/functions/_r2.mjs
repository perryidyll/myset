import { createHash, createHmac } from 'node:crypto';

/* CLOUDFLARE R2, SIGNED BY HAND.

   WHY R2 AT ALL. Clips are the one thing in MySet that can move the bill on their
   own: Netlify charges ~$0.134/GB to send bytes to a phone, and a cache HIT is
   billed like anything else (INVARIANT 0ev). R2 charges nothing to send bytes out.
   So the BYTES of a clip live here; everything else — the post, the poster frame,
   the pending list — stays in Blobs exactly as it was.

   WHY NO SDK. There are exactly two dependencies in this project and it stays
   that way (AGENTS.md). R2 speaks S3, and S3 wants AWS Signature Version 4, which
   is a page of HMACs — `node:crypto` is the whole of it. The algorithm is pinned
   in `test/clips.mjs` against the worked example in Amazon's own documentation
   (`AKIAIOSFODNN7EXAMPLE`, 2013-05-24, `examplebucket/test.txt`), intermediate
   hashes included, so a wrong byte in the canonical request fails a test rather
   than a fetch.

   HOW A PHONE GETS A CLIP. `myset.vip`'s DNS is on Netlify, not Cloudflare, so a
   custom domain in front of the bucket is not available without moving the zone;
   and `r2.dev` is rate-limited and explicitly not for production. So `/api/vid`
   answers a 302 to a short-lived PRESIGNED GET on the bucket's own S3 endpoint.
   Public access on the bucket stays OFF; the signature is what opens the door,
   for a few hours, for one object. The browser is expected to follow the redirect
   with its Range header intact so R2 answers the 206 itself (INVARIANT 0dr) —
   checked against the fake in the suite, not yet on a phone.

   EVERYTHING HERE CAN FAIL AND NOTHING HERE MAY BREAK THE GIG. Every call has a
   timeout, every caller in `_video.mjs` falls back to Blobs, and a missing
   variable simply means "R2 is off" — the app behaves as it did before this file
   existed. Never log a key, never log a URL that carries a signature. */

const cfg = () => ({
  account: process.env.R2_ACCOUNT_ID || '',
  bucket: process.env.R2_BUCKET || '',
  key: process.env.R2_ACCESS_KEY_ID || '',
  secret: process.env.R2_SECRET_ACCESS_KEY || '',
});
/** All four variables present, or R2 is simply off. */
export const r2Enabled = () => { const c = cfg(); return !!(c.account && c.bucket && c.key && c.secret); };
const host = (c) => `${c.account}.r2.cloudflarestorage.com`;
const REGION = 'auto', SERVICE = 's3';

/* ---------- Signature Version 4 ---------- */
const hex = (b) => Buffer.from(b).toString('hex');
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
export const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** S3's URI encoding: RFC 3986 unreserved characters pass, everything else is
    %XX, and a `/` in the object key is a path separator, not data. */
export const uriEncode = (s, keepSlash = false) =>
  String(s).split('').map((ch) => {
    if (/[A-Za-z0-9\-_.~]/.test(ch) || (keepSlash && ch === '/')) return ch;
    return Array.from(Buffer.from(ch, 'utf8')).map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
  }).join('');

const amzDate = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const scopeOf = (stamp, region, service) => `${stamp.slice(0, 8)}/${region}/${service}/aws4_request`;
const signingKey = (secret, stamp, region, service) =>
  hmac(hmac(hmac(hmac('AWS4' + secret, stamp.slice(0, 8)), region), service), 'aws4_request');

const canonicalQuery = (q) => Object.keys(q).sort()
  .map((k) => `${uriEncode(k)}=${uriEncode(q[k])}`).join('&');

/** The canonical request, the string to sign and the signature, in one place so a
    test can check each stage against the published example. `headers` is a plain
    object of the headers that will be SENT; all of them are signed. */
export function sigv4({ method, host: h, path, query = {}, headers = {}, payloadHash,
                        key, secret, region = REGION, service = SERVICE, stamp }) {
  const low = {};
  for (const [k, v] of Object.entries(headers)) low[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  low.host = h;
  const names = Object.keys(low).sort();
  const canonical = [
    method,
    uriEncode(path, true),
    canonicalQuery(query),
    names.map((n) => `${n}:${low[n]}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = scopeOf(stamp, region, service);
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
  const signature = hex(hmac(signingKey(secret, stamp, region, service), toSign));
  return { canonical, toSign, signature, scope, signedHeaders: names.join(';') };
}

/** A URL that fetches `path` from `host` until `expires` seconds after `stamp`.
    Query-string auth: the payload is declared unsigned, only `host` is signed. */
export function presign({ method = 'GET', host: h, path, key, secret, stamp, expires,
                          region = REGION, service = SERVICE }) {
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${key}/${scopeOf(stamp, region, service)}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const { signature } = sigv4({ method, host: h, path, query, headers: {},
                                payloadHash: 'UNSIGNED-PAYLOAD', key, secret, region, service, stamp });
  return `https://${h}${uriEncode(path, true)}?${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
}

/* ---------- the bucket ---------- */
const objectPath = (c, k) => `/${c.bucket}/${k}`;

/** One signed request to the bucket. Throws on a network failure or a timeout;
    returns the Response otherwise, so each caller decides what a 404 means. */
async function call(method, k, { body = null, type = '', timeout = 8000 } = {}) {
  const c = cfg();
  const stamp = amzDate(Date.now());
  const payloadHash = body ? sha256(body) : EMPTY_SHA;
  const headers = { 'x-amz-content-sha256': payloadHash, 'x-amz-date': stamp };
  if (body) headers['content-type'] = type || 'application/octet-stream';
  const path = objectPath(c, k);
  const { signature, scope, signedHeaders } = sigv4({ method, host: host(c), path, headers, payloadHash,
                                                      key: c.key, secret: c.secret, stamp });
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${c.key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetch(`https://${host(c)}${uriEncode(path, true)}`, {
    method, headers, body: body || undefined, signal: AbortSignal.timeout(timeout),
  });
}

/** Store bytes under `k`. Throws unless R2 said 2xx — the caller falls back. */
export async function r2Put(k, bytes, type) {
  /* A 75MB clip has to cross to Cloudflare inside the function's own budget —
     Netlify's documented default for a synchronous function is 10 seconds, and
     the `end` step has already read every piece back before this runs. 8s so a
     stalled R2 gives up with room left for the Blobs fallback, rather than eating
     the whole budget and failing both ways. NOT MEASURED against the real bucket
     yet; the first deploy is the measurement (docs/sessions/2026-09-11-clips-to-r2.md).
     The hash over the body is what lets a store that checks it refuse a transfer
     that got mangled; the test fake checks it, and R2 documents the header. */
  const r = await call('PUT', k, { body: bytes, type, timeout: 8000 });
  if (!r.ok) throw new Error(`r2 put ${r.status}`);
}

/** true if the object exists, false if R2 says it does not; throws on anything
    else so "R2 could not be asked" is never mistaken for "not there". */
export async function r2Head(k) {
  const r = await call('HEAD', k, { timeout: 4000 });
  if (r.status === 200) return true;
  if (r.status === 404) return false;
  throw new Error(`r2 head ${r.status}`);
}

/** The bytes and their type, or null if R2 has no such object. No production
    caller — `/api/vid` redirects rather than reads — so the 20s here is the test
    suite's budget, not a function's. */
export async function r2Get(k) {
  const r = await call('GET', k, { timeout: 20000 });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`r2 get ${r.status}`);
  return { bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'application/octet-stream' };
}

/** Best effort: a 404 is already what we wanted. */
export async function r2Delete(k) {
  const r = await call('DELETE', k, { timeout: 6000 });
  if (!r.ok && r.status !== 404) throw new Error(`r2 delete ${r.status}`);
}

/* HOW LONG A LINK LIVES, AND WHY THE CLOCK IS ROUNDED. The redirect from
   `/api/vid` is cached at Netlify's edge for CACHE_SECS, so a link has to outlive
   the cache by a margin or a phone could be handed a URL with seconds left on it.
   Signing from the top of the current hour rather than from "now" makes the URL
   identical for every request inside that hour, which is what lets the edge and
   the browser treat it as one thing. A link is therefore good for between
   LINK_SECS − 3600 and LINK_SECS seconds, always more than CACHE_SECS. */
export const LINK_SECS = 4 * 3600;
export const CACHE_SECS = 3600;
export const ROUND_MS = 3600e3;                     // links are signed from the top of this
export function r2PresignGet(k, now = Date.now()) {
  const c = cfg();
  const top = Math.floor(now / ROUND_MS) * ROUND_MS;
  return presign({ host: host(c), path: objectPath(c, k), key: c.key, secret: c.secret,
                   stamp: amzDate(top), expires: LINK_SECS });
}
