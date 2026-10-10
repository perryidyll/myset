import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { casDoc, readDoc } from './_lib.mjs';
import { scriptSrc } from './_csp.mjs';

/* THE FOUNDER'S PASSCODE — one door for the pages that are his and nobody else's.

   moneymodel.mjs has kept the money model behind a four-digit code since 5 Sep
   (the founder: "a simple passcode to view it that is 2068"). The register's
   dashboard (/shows, decision 0095) and the model's live feed sit behind the SAME
   code, so this is the one copy of the door and both functions call it. The rules
   have not changed and are worth restating, because they are what the code is for:

   · The page lives OUTSIDE the published folder and is bundled into its function;
     nothing leaves the server until the code has been given. A code checked in the
     browser is not a code — the file would already be on the phone.
   · The code lives in FINMODEL_CODE. On Netlify that variable is REQUIRED: the
     repository is public (decision 0047), so a default written into this file is a
     passcode anybody can read, and a door with a published key is not a door. With
     no variable the gate says so and opens for nobody. Off Netlify (the test
     harness, tools/localhost.mjs) the founder's original code stands in.
   · The cookie carries an HMAC of the code under the site's signing key, never the
     code. It used to be a plain hash of the code with a salt written in this file,
     so every possible cookie for a short code could be computed offline from the
     public repository and tried straight at the page — round the lock below. Under a
     keyed MAC a cookie can only be minted by a server that saw the code.
   · Thirty days, HttpOnly, Secure, SameSite=Lax, scoped to the page's own path —
     `/moneymodel` — which a browser also sends to everything under it: the dashboard
     at /moneymodel/shows, its data and the model's live feed (RFC 6265 §5.1.4). One
     sign-in, one cookie, and it never rides the room's polls.
   · Wrong codes are counted, in ONE document with a computable key (`fmgate`,
     INVARIANT 1), and after TRIES of them inside WINDOW the door shuts for LOCK_FOR
     — doubling on every further lockout up to LOCK_CAP, so a script guessing is
     looking at years, not a night. The lock is on the DOOR, not on a network address
     (a guesser has many; the founder has one door), and while it is shut even the
     right code is refused, said plainly. A cookie already held still opens the page.
     A right code writes nothing unless there is something to clear.
   · A passcode is a courtesy lock, not a vault: it keeps a page off search
     engines and away from anybody who stumbles on the address, and it says plainly
     "this is not public". Anything that would ruin the business if seen does not
     belong behind it, whatever the server does. Decision 0112. */

const FALLBACK = '2068';
const onNetlify = () => !!(process.env.SITE_NAME || process.env.NETLIFY || process.env.DEPLOY_ID);
/** The code, or '' when the door has no key: on Netlify with FINMODEL_CODE unset. */
export const CODE = () => {
  const set = String(process.env.FINMODEL_CODE || '').trim();
  if (set) return set;
  return onNetlify() ? '' : FALLBACK;
};
export const COOKIE = 'fm';
export const MAX_AGE = 30 * 86400;
export const MAX_CODE = 200;             // the box's own maxlength
export const GATE_KEY = 'fmgate';
export const TRIES = 10;                 // wrong codes…
export const WINDOW = 15 * 60e3;         // …inside this long…
export const LOCK_FOR = 15 * 60e3;       // …shut the door for this long, the first time
export const LOCK_CAP = 24 * 3600e3;     // …and at most this long, however many times

const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};
/** Constant-time, whatever the lengths: both sides are hashed first. */
const sha = (v) => createHash('sha256').update(String(v)).digest();
const sameCode = (given, want) => !!want && timingSafeEqual(sha(given), sha(want));

/* The cookie's value for a code under one key: a MAC, cut to forty hex characters. */
const stampWith = (key, code) => createHmac('sha256', key).update('myset-finmodel|v2|' + code).digest('hex').slice(0, 40);
/** The cookie's value for a code, under the key everything new is signed with
 *  (_auth.mjs — cut from MYSET_SECRET when it is set, else the store-kept one). */
export async function stamp(code) {
  const { signingKeys } = await import('./_auth.mjs');
  return stampWith((await signingKeys()).sign, code);
}

/* The same policy netlify.toml puts on static files, restated because custom headers
   do not reach a function's response. Nothing external, nothing that can phone home.
   A page this file family sends names its own inline scripts by hash (SEC-006, decision 0209,
   _csp.mjs): pass the page as `html` and script-src is worked out from it, so the door, the
   Show log's lock and the money model run their own code and nothing injected into them. */
export const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'none'; manifest-src 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'";
export const cspFor = (html) => CSP.replace("script-src 'self' 'unsafe-inline'", `script-src ${scriptSrc(html)}`);
export const baseHeaders = (type = 'text/html; charset=utf-8', html = null) => ({
  'content-type': type,
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
  'content-security-policy': html == null ? CSP : cspFor(html),
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
});

/** Every `fm` cookie on the request — a browser may hold one per path. */
export const readCookies = (req) => (req.headers.get('cookie') || '').split(/;\s*/)
  .filter((c) => c.startsWith(COOKIE + '=')).map((c) => decodeURIComponent(c.slice(COOKIE.length + 1)));
export const readCookie = (req) => readCookies(req)[0] || '';
/** Is this request carrying the code? Any matching cookie will do, under any key a
 *  cookie may have been stamped with (the store key keeps its month after the switch,
 *  so the founder is not asked again the day MYSET_SECRET arrives), each compared in
 *  constant time. */
export async function allowed(req) {
  const code = CODE();
  if (!code) return false;
  const cookies = readCookies(req);
  if (!cookies.length) return false;
  const { signingKeys } = await import('./_auth.mjs');
  const wants = (await signingKeys()).verify.map((k) => stampWith(k, code));
  return cookies.some((c) => wants.some((w) => same(c, w)));
}

const setCookie = (value, maxAge, path = '/') => `${COOKIE}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

/* ---------- the lock on the door ----------
   `fmgate`: { fails: [when…], until, locks }. Read on every POST of a code; written
   on a wrong code, and on a right one only when there are failures to clear. */
const emptyGate = () => ({ v: 1, fails: [], until: 0, locks: 0 });
export const lockedUntil = async () => {
  const { data } = await readDoc(GATE_KEY, null);
  const until = Number((data || {}).until) || 0;
  return until > Date.now() ? until : 0;
};
export async function noteWrong(now = Date.now()) {
  let until = 0;
  await casDoc(GATE_KEY, emptyGate, (d) => {
    d.fails = (Array.isArray(d.fails) ? d.fails : []).filter((t) => now - t < WINDOW);
    d.fails.push(now);
    if (d.fails.length >= TRIES) {
      const locks = Math.max(0, Number(d.locks) || 0);
      until = now + Math.min(LOCK_CAP, LOCK_FOR * 2 ** Math.min(locks, 10));
      d.until = until; d.locks = locks + 1; d.fails = [];
    }
    return true;
  }, null, 5).catch(() => {});
  return until;
}
/** A right code: forget the misses. Writes nothing when there is nothing to forget. */
export const noteRight = () =>
  casDoc(GATE_KEY, emptyGate, (d) => {
    if (!(d.fails || []).length && !d.until && !d.locks) return false;
    d.fails = []; d.until = 0; d.locks = 0;
    return true;
  }, null, 5).catch(() => {});

const minutes = (ms) => Math.max(1, Math.ceil(ms / 60e3));
/* Show / Hide on the passcode field — wired here, not in an onclick=, so the page's policy can
   name it by hash (decision 0209). */
const PEEK = "document.getElementById('peek').addEventListener('click',function(){const i=document.getElementById('code'),on=i.type==='password';i.type=on?'text':'password';this.textContent=on?'Hide':'Show';this.setAttribute('aria-pressed',on);i.focus()});";
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export const gatePage = ({ wrong = false, locked = 0, unset = false, action = '/', title = 'MySet Money Model', kicker = 'MySet · Money Model', button = 'Open the model' } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23000'/><g fill='%23FF5650'><rect x='24' y='42' width='11' height='34' rx='5'/><rect x='44' y='24' width='11' height='52' rx='5'/><rect x='64' y='54' width='11' height='22' rx='5'/></g></svg>" />
<style>
  :root { color-scheme: light dark; --ground:#f2f1ee; --surface:#fff; --ink:#131312; --muted:#6d6c67; --rule:#b9b7b0; --accent:#ec3013; }
  @media (prefers-color-scheme: dark) { :root { --ground:#0f0f0e; --surface:#171716; --ink:#ecebe7; --muted:#9b9a93; --rule:#3f3e3a; --accent:#ff5236; } }
  * { box-sizing: border-box; } body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--ground); color:var(--ink); font:15px/1.5 "Helvetica Neue", Arial, sans-serif; padding:24px; }
  form { background:var(--surface); border:2px solid var(--ink); padding:28px 28px 24px; width:min(420px,100%); }
  .k { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
  h1 { font-size:26px; margin:0 0 6px; letter-spacing:-.01em; } p { margin:0 0 18px; color:var(--muted); }
  .pw { position:relative; }
  input { width:100%; font:600 20px/1 ui-monospace, Menlo, monospace; letter-spacing:.08em; padding:12px 64px 12px 12px; border:1px solid var(--rule); background:var(--surface); color:var(--ink); }
  input:focus { outline:2px solid var(--accent); outline-offset:2px; border-color:var(--ink); }
  .pw button { position:absolute; right:6px; top:50%; transform:translateY(-50%); width:auto; margin:0; padding:8px 10px; font:600 13px/1 inherit; background:none; color:var(--muted); border:0; }
  .pw button:focus-visible { outline:2px solid var(--accent); }
  button { margin-top:12px; width:100%; font:600 15px/1 inherit; padding:13px; background:var(--accent); color:#fff; border:2px solid var(--accent); cursor:pointer; }
  .no { color:var(--accent); font-weight:600; margin:10px 0 0; }
</style></head><body>
<form method="post" action="${esc(action)}" autocomplete="off">
  <div class="k">${esc(kicker)}</div>
  <h1>Enter the passcode</h1>
  <p>This page is not public. Ask Perry if you need it.</p>
  <div class="pw"><input id="code" name="code" type="password" maxlength="200" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" autofocus aria-label="passcode" required${locked || unset ? ' disabled' : ''}><button type="button" id="peek" aria-controls="code" aria-pressed="false">Show</button></div>
  <button type="submit"${locked || unset ? ' disabled' : ''}>${esc(button)}</button>
  ${unset ? '<p class="no">This door has no passcode set. Set FINMODEL_CODE in Netlify and redeploy.</p>'
    : locked ? `<p class="no">Too many tries. The door is shut for about ${minutes(locked - Date.now())} minute${minutes(locked - Date.now()) === 1 ? '' : 's'}.</p>`
    : wrong ? '<p class="no">That is not the passcode.</p>' : ''}
</form>
<script>${PEEK}</script></body></html>`;

/**
 * The door. Returns a Response to send when the request is not (yet) allowed in, or
 * null when it is. Handles the POST of the code, `?signout=1`, and the two methods.
 *   landing   where the form posts to and where a good code lands (the page's own path)
 *   page      words for the gate page (title, kicker, button)
 */
/* The cookie's scope is the first segment of the landing path (`/moneymodel`), so a
   dashboard under it is covered and the next rename is a routing change alone. */
const cookiePath = (landing) => '/' + String(landing || '').split('/').filter(Boolean)[0] || '/';

async function codeFrom(req) {
  const ct = req.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) return String(((await req.clone().json()) || {}).code || '').trim().slice(0, MAX_CODE);
    if (ct.includes('form')) return String(new URLSearchParams(await req.clone().text()).get('code') || '').trim().slice(0, MAX_CODE);
  } catch { /* not a code */ }
  return '';
}

const gateAnswer = (status, opts, more = {}) => { const html = gatePage(opts); return new Response(html, { status, headers: { ...baseHeaders(undefined, html), ...more } }); };

export async function gate(req, { landing, page = {} } = {}) {
  const url = new URL(req.url);
  const to = landing || url.pathname;
  const code = CODE();
  /* a POST that carries a code is the form; a POST without one is the page's own
     action (Refresh now) and falls through to the cookie check like any GET */
  if (req.method === 'POST') {
    const given = await codeFrom(req);
    if (given) {
      if (!code) return gateAnswer(503, { unset: true, action: to, ...page });
      const shut = await lockedUntil();
      if (shut) return gateAnswer(429, { locked: shut, action: to, ...page }, { 'retry-after': String(Math.ceil((shut - Date.now()) / 1000)) });
      if (sameCode(given, code)) {
        await noteRight();
        return new Response(null, { status: 303, headers: { ...baseHeaders(), location: to, 'set-cookie': setCookie(await stamp(code), MAX_AGE, cookiePath(to)) } });
      }
      const until = await noteWrong();
      if (until) return gateAnswer(429, { locked: until, action: to, ...page }, { 'retry-after': String(Math.ceil((until - Date.now()) / 1000)) });
      return gateAnswer(200, { wrong: true, action: to, ...page });
    }
  }
  if (url.searchParams.get('signout') === '1') {
    return new Response(null, { status: 303, headers: { ...baseHeaders(), location: to, 'set-cookie': setCookie('', 0, cookiePath(to)) } });
  }
  if (await allowed(req)) return null;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') return new Response('GET or POST', { status: 405, headers: baseHeaders('text/plain; charset=utf-8') });
  /* a JSON address that is not signed in gets a JSON refusal, not a login page —
     the model's own script asks /moneymodel/live.json and must be able to tell */
  if (/\.(json|csv)$/.test(url.pathname) || (req.headers.get('accept') || '').includes('application/json')) {
    return new Response(JSON.stringify({ ok: false, error: 'passcode' }), { status: 401, headers: baseHeaders('application/json; charset=utf-8') });
  }
  if (!code) return gateAnswer(503, { unset: true, action: to, ...page });
  return gateAnswer(200, { action: to, ...page });
}
