/* An in-memory stand-in for a Cloudflare R2 bucket, the way test/stripe-fake.mjs
   stands in for Stripe. Installed by replacing `globalThis.fetch` for the one host
   `_r2.mjs` talks to; every other URL goes to whatever fetch was there before.

   IT CHECKS THE SIGNATURE. A stub that stored whatever arrived would let a wrong
   canonical request through 80 tests and fail on the first real upload. So each
   request is re-signed here from what was actually SENT — method, path, the
   headers named in `SignedHeaders`, the payload hash — and refused with a 403 if
   the signature the code computed does not match. Together with the published
   AWS vectors in test/clips.mjs (which pin the algorithm itself) that is the
   whole of what can be checked without a bucket.

   It also answers a Range on GET, because that is what a phone will do to the
   presigned URL after the redirect — and a redirect to a store that answered a
   200 to `bytes=0-1` would be a black box on every iPhone (INVARIANT 0dr). */
import { sigv4, sha256 } from '../netlify/functions/_r2.mjs';

export const ENV = {
  R2_ACCOUNT_ID: 'acct0123456789abcdef',
  R2_BUCKET: 'myset-clips-test',
  R2_ACCESS_KEY_ID: 'TESTKEYID0000000000',
  R2_SECRET_ACCESS_KEY: 'test/secret+key/that/never/leaves/the/test',
};
const HOST = `${ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const objects = new Map();          // key -> { bytes, type }
let failing = false;                // every call becomes a 503, after a real round trip
let down = false;                   // every call throws, as a network failure would
const calls = [];                   // { method, key, status }

export const __r2 = {
  objects, calls,
  reset() { objects.clear(); calls.length = 0; failing = false; down = false; },
  fail(on) { failing = !!on; },
  down(on) { down = !!on; },
  install() { for (const [k, v] of Object.entries(ENV)) process.env[k] = v; },
  uninstall() { for (const k of Object.keys(ENV)) delete process.env[k]; },
};

const parseAuth = (h) => {
  const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/.exec(h || '');
  return m && { key: m[1], date: m[2], region: m[3], service: m[4], signed: m[5].split(';'), signature: m[6] };
};

/** Re-derive the signature from the request as sent, header-style. */
function verifyHeaders(method, url, headers) {
  const a = parseAuth(headers.get('authorization'));
  if (!a || a.key !== ENV.R2_ACCESS_KEY_ID || a.region !== 'auto' || a.service !== 's3') return 'bad credential';
  const stamp = headers.get('x-amz-date') || '';
  if (!stamp.startsWith(a.date)) return 'date mismatch';
  const signedHeaders = {};
  for (const n of a.signed) { if (n === 'host') continue; signedHeaders[n] = headers.get(n); }
  const { signature } = sigv4({ method, host: HOST, path: decodeURIComponent(url.pathname),
    query: Object.fromEntries(url.searchParams), headers: signedHeaders,
    payloadHash: headers.get('x-amz-content-sha256'), key: ENV.R2_ACCESS_KEY_ID,
    secret: ENV.R2_SECRET_ACCESS_KEY, stamp });
  return signature === a.signature ? null : 'signature mismatch';
}

/** The same, query-style, for a presigned link — and the link's own expiry. */
function verifyQuery(method, url, now) {
  const q = url.searchParams;
  const cred = /^([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request$/.exec(q.get('X-Amz-Credential') || '');
  if (!cred || cred[1] !== ENV.R2_ACCESS_KEY_ID) return 'bad credential';
  const stamp = q.get('X-Amz-Date') || '';
  const t = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(9, 11), +stamp.slice(11, 13), +stamp.slice(13, 15));
  const expires = Number(q.get('X-Amz-Expires'));
  if (!(expires > 0) || expires > 7 * 86400) return 'bad expiry';
  if (now > t + expires * 1000) return 'expired';
  const query = {};
  for (const [k, v] of q) if (k !== 'X-Amz-Signature') query[k] = v;
  const { signature } = sigv4({ method, host: HOST, path: decodeURIComponent(url.pathname), query, headers: {},
    payloadHash: 'UNSIGNED-PAYLOAD', key: ENV.R2_ACCESS_KEY_ID, secret: ENV.R2_SECRET_ACCESS_KEY, stamp });
  return signature === q.get('X-Amz-Signature') ? null : 'signature mismatch';
}

const keyOf = (url) => {
  const p = decodeURIComponent(url.pathname);
  const pre = `/${ENV.R2_BUCKET}/`;
  return p.startsWith(pre) ? p.slice(pre.length) : null;
};

const reply = (method, key, status, body = '', headers = {}) => {
  calls.push({ method, key, status });
  const bodiless = method === 'HEAD' || status === 204 || status === 304;
  return new Response(bodiless ? null : body, { status, headers });
};

/** `now` is injectable so a test can walk the clock past a link's expiry. */
export let clock = () => Date.now();
export const __setClock = (fn) => { clock = fn || (() => Date.now()); };

export async function r2Fetch(input, init = {}) {
  const url = new URL(String(input));
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});
  if (down) throw new TypeError('fetch failed');
  const key = keyOf(url);
  if (key === null) return reply(method, '', 404);
  if (failing) return reply(method, key, 503);

  const presigned = url.searchParams.has('X-Amz-Signature');
  const why = presigned ? verifyQuery(method, url, clock()) : verifyHeaders(method, url, headers);
  if (why) return reply(method, key, 403, why);

  if (method === 'PUT') {
    const bytes = Buffer.from(await new Response(init.body).arrayBuffer());
    if (sha256(bytes) !== headers.get('x-amz-content-sha256')) return reply(method, key, 400, 'XAmzContentSHA256Mismatch');
    objects.set(key, { bytes, type: headers.get('content-type') || 'application/octet-stream' });
    return reply(method, key, 200);
  }
  const o = objects.get(key);
  if (method === 'DELETE') { objects.delete(key); return reply(method, key, 204); }
  if (!o) return reply(method, key, 404);
  if (method === 'HEAD') return reply(method, key, 200, '', { 'content-length': String(o.bytes.length), 'content-type': o.type });
  if (method === 'GET') {
    const n = o.bytes.length;
    const m = /^bytes=(\d*)-(\d*)$/.exec(headers.get('range') || '');
    const base = { 'content-type': o.type, 'accept-ranges': 'bytes' };
    if (!m) return reply(method, key, 200, o.bytes, { ...base, 'content-length': String(n) });
    let start, end;
    if (m[1] === '') { start = Math.max(0, n - Number(m[2])); end = n - 1; }
    else { start = Number(m[1]); end = m[2] === '' ? n - 1 : Math.min(Number(m[2]), n - 1); }
    if (start > end || start >= n) return reply(method, key, 416, '', { 'content-range': `bytes */${n}` });
    const slice = o.bytes.subarray(start, end + 1);
    return reply(method, key, 206, slice, { ...base, 'content-length': String(slice.length), 'content-range': `bytes ${start}-${end}/${n}` });
  }
  return reply(method, key, 405);
}

/** Route the R2 host here; everything else keeps going wherever it went. */
const before = globalThis.fetch;
globalThis.fetch = (input, init) => (String(input).startsWith(`https://${HOST}/`) ? r2Fetch(input, init) : before(input, init));
