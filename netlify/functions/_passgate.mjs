import { createHash } from 'node:crypto';

/* THE FOUNDER'S PASSCODE — one door for the pages that are his and nobody else's.

   moneymodel.mjs has kept the money model behind a four-digit code since 5 Sep
   (the founder: "a simple passcode to view it that is 2068"). The register's
   dashboard (/shows, decision 0095) and the model's live feed sit behind the SAME
   code, so this is the one copy of the door and both functions call it. The rules
   have not changed and are worth restating, because they are what the code is for:

   · The page lives OUTSIDE the published folder and is bundled into its function;
     nothing leaves the server until the code has been given. A code checked in the
     browser is not a code — the file would already be on the phone.
   · The code lives in FINMODEL_CODE when that env var is set (production), else it is
     the one the founder gave. The cookie carries a HASH of the code, never the code.
   · Thirty days, HttpOnly, Secure, SameSite=Lax, scoped to the page's own path —
     `/moneymodel` — which a browser also sends to everything under it: the dashboard
     at /moneymodel/shows, its data and the model's live feed (RFC 6265 §5.1.4). One
     sign-in, one cookie, and it never rides the room's polls.
   · A four-digit code is a courtesy lock, not a vault: it keeps a page off search
     engines and away from anybody who stumbles on the address, and it says plainly
     "this is not public". Anything that would ruin the business if seen does not
     belong behind it, whatever the server does. */

export const CODE = () => String(process.env.FINMODEL_CODE || '2068');
const SALT = 'myset-finmodel|v1|';
export const COOKIE = 'fm';
export const MAX_AGE = 30 * 86400;
export const stamp = (code) => createHash('sha256').update(SALT + code).digest('hex').slice(0, 40);

/* The same policy netlify.toml puts on static files, restated because custom headers
   do not reach a function's response. Nothing external, nothing that can phone home. */
export const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'none'; manifest-src 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'";
export const baseHeaders = (type = 'text/html; charset=utf-8') => ({
  'content-type': type,
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
});

/** Every `fm` cookie on the request — a browser may hold one per path. */
export const readCookies = (req) => (req.headers.get('cookie') || '').split(/;\s*/)
  .filter((c) => c.startsWith(COOKIE + '=')).map((c) => decodeURIComponent(c.slice(COOKIE.length + 1)));
export const readCookie = (req) => readCookies(req)[0] || '';
/** Is this request carrying the code? Any matching cookie will do; timing is not a concern on a 40-char hash of a courtesy lock. */
export const allowed = (req) => readCookies(req).includes(stamp(CODE()));

const setCookie = (value, maxAge, path = '/') => `${COOKIE}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

export const gatePage = ({ wrong = false, action = '/', title = 'MySet Money Model', kicker = 'MySet · Money Model', button = 'Open the model' } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title>
<style>
  :root { color-scheme: light dark; --ground:#f2f1ee; --surface:#fff; --ink:#131312; --muted:#6d6c67; --rule:#b9b7b0; --accent:#ec3013; }
  @media (prefers-color-scheme: dark) { :root { --ground:#0f0f0e; --surface:#171716; --ink:#ecebe7; --muted:#9b9a93; --rule:#3f3e3a; --accent:#ff5236; } }
  * { box-sizing: border-box; } body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--ground); color:var(--ink); font:15px/1.5 "Helvetica Neue", Arial, sans-serif; padding:24px; }
  form { background:var(--surface); border:2px solid var(--ink); padding:28px 28px 24px; width:min(420px,100%); }
  .k { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
  h1 { font-size:26px; margin:0 0 6px; letter-spacing:-.01em; } p { margin:0 0 18px; color:var(--muted); }
  input { width:100%; font:600 26px/1 ui-monospace, Menlo, monospace; letter-spacing:.3em; text-align:center; padding:12px; border:1px solid var(--rule); background:var(--surface); color:var(--ink); }
  input:focus { outline:2px solid var(--accent); outline-offset:2px; border-color:var(--ink); }
  button { margin-top:12px; width:100%; font:600 15px/1 inherit; padding:13px; background:var(--accent); color:#fff; border:2px solid var(--accent); cursor:pointer; }
  .no { color:var(--accent); font-weight:600; margin:10px 0 0; }
</style></head><body>
<form method="post" action="${action}" autocomplete="off">
  <div class="k">${kicker}</div>
  <h1>Enter the passcode</h1>
  <p>This page is not public. Ask Perry if you need it.</p>
  <input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="12" autofocus aria-label="passcode" required>
  <button type="submit">${button}</button>
  ${wrong ? '<p class="no">That is not the passcode.</p>' : ''}
</form></body></html>`;

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
    if (ct.includes('application/json')) return String(((await req.clone().json()) || {}).code || '').trim();
    if (ct.includes('form')) return String(new URLSearchParams(await req.clone().text()).get('code') || '').trim();
  } catch { /* not a code */ }
  return '';
}

export async function gate(req, { landing, page = {} } = {}) {
  const url = new URL(req.url);
  const to = landing || url.pathname;
  /* a POST that carries a code is the form; a POST without one is the page's own
     action (Refresh now) and falls through to the cookie check like any GET */
  if (req.method === 'POST') {
    const code = await codeFrom(req);
    if (code) {
      if (code === CODE()) {
        return new Response(null, { status: 303, headers: { ...baseHeaders(), location: to, 'set-cookie': setCookie(stamp(code), MAX_AGE, cookiePath(to)) } });
      }
      return new Response(gatePage({ wrong: true, action: to, ...page }), { status: 200, headers: baseHeaders() });
    }
  }
  if (url.searchParams.get('signout') === '1') {
    return new Response(null, { status: 303, headers: { ...baseHeaders(), location: to, 'set-cookie': setCookie('', 0, cookiePath(to)) } });
  }
  if (allowed(req)) return null;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') return new Response('GET or POST', { status: 405, headers: baseHeaders('text/plain; charset=utf-8') });
  /* a JSON address that is not signed in gets a JSON refusal, not a login page —
     the model's own script asks /moneymodel/live.json and must be able to tell */
  if (/\.(json|csv)$/.test(url.pathname) || (req.headers.get('accept') || '').includes('application/json')) {
    return new Response(JSON.stringify({ ok: false, error: 'passcode' }), { status: 401, headers: baseHeaders('application/json; charset=utf-8') });
  }
  return new Response(gatePage({ action: to, ...page }), { status: 200, headers: baseHeaders() });
}
