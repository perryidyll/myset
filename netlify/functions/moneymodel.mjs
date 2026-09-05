import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* THE MONEY MODEL, BEHIND A PASSCODE — myset.vip/moneymodel

   Perry, 2026-09-05: "push it live to myset.vip/financialmodel with a simple
   passcode to view it that is 2068." Renamed to /moneymodel on his ask the next
   day; the old address 301s to the new one in netlify.toml so a saved link still
   lands. The form action and the cookie scope are taken from the request path
   rather than written down, so the next rename is a routing change and nothing
   else — the hard-coded /financialmodel in both was the whole cost of this one.

   WHY A FUNCTION AND NOT A STATIC FILE. A passcode checked in the browser is not a
   passcode: the file is already on the phone before the prompt appears. So the
   dashboard lives OUTSIDE the published folder (finance/model.html — netlify.toml
   publishes public/ only) and is bundled into this function with `included_files`.
   Nothing leaves the server until the code has been given, and the code is then
   remembered in a cookie for thirty days so a reload does not ask again.

   WHAT THIS IS AND IS NOT. A four-digit code is a courtesy lock, not a vault: it
   keeps the page off search engines and away from anyone who stumbles on the URL,
   and it says plainly "this is not public". It would not stop somebody determined
   enough to try ten thousand codes. Anything that would ruin the business if seen
   does not belong on a page with a four-digit code, whatever the server does.

   THE CODE lives in FINMODEL_CODE if that env var is set (production context),
   otherwise it is the one Perry gave. The cookie carries a hash of the code, not
   the code, so a copied cookie is as good as knowing the code and no better.

   The page is the same file as the published artifact. Two things are rewritten on
   the way out so the site's Content Security Policy (default-src 'self', no
   external script/font/stylesheet — SECURITY.md) stays exactly as it is: the
   charting library and the two typefaces come from /vendor/ on this site instead of
   their CDNs. The artifact keeps the CDN links because the artifact host allows
   only those. */

const CODE = () => String(process.env.FINMODEL_CODE || '2068');
const SALT = 'myset-finmodel|v1|';
const COOKIE = 'fm';
const MAX_AGE = 30 * 86400;
const stamp = (code) => createHash('sha256').update(SALT + code).digest('hex').slice(0, 40);

/* The bundled copy of finance/model.html. zip-it-and-ship-it keeps included files
   at their repo-relative path, and the function runs with that root as its
   working directory; the other candidates cover a local `netlify dev` and the
   test harness, which import this file from the repo itself. */
function pageHtml() {
  const here = fileURLToPath(import.meta.url);
  const candidates = [
    resolve(process.cwd(), 'finance/model.html'),
    resolve(process.env.LAMBDA_TASK_ROOT || '', 'finance/model.html'),
    resolve(here, '../../../finance/model.html'),
    resolve(here, '../finance/model.html'),
  ];
  for (const p of candidates) { try { if (existsSync(p)) return readFileSync(p, 'utf8'); } catch {} }
  throw new Error('finance/model.html is not in the bundle — check [functions.moneymodel] included_files in netlify.toml');
}
const CDN_CHART = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
const FONT_LINK = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/;
const PRECONNECT = /<link rel="preconnect"[^>]*>\s*/g;
function localised(html) {
  return html.replace(CDN_CHART, '/vendor/chart.umd.min.js')
             .replace(FONT_LINK, '<link rel="stylesheet" href="/vendor/model-fonts.css">')
             .replace(PRECONNECT, '');
}

/* The same policy netlify.toml puts on static files, restated here because custom
   headers do not reach a function's response. Nothing external, nothing inline
   that can phone home. */
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'none'; manifest-src 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'";
const baseHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

const gate = (wrong, action) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>MySet Money Model</title>
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
  <div class="k">MySet · Money Model</div>
  <h1>Enter the passcode</h1>
  <p>This page is not public. Ask Perry if you need it.</p>
  <input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="12" autofocus aria-label="passcode" required>
  <button type="submit">Open the model</button>
  ${wrong ? '<p class="no">That is not the passcode.</p>' : ''}
</form></body></html>`;

const readCookie = (req) => {
  const raw = req.headers.get('cookie') || '';
  const m = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : '';
};
const allowed = (req) => readCookie(req) === stamp(CODE());

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === 'POST') {
    let code = '';
    const ct = req.headers.get('content-type') || '';
    try {
      if (ct.includes('application/json')) code = String((await req.json()).code || '');
      else code = String(new URLSearchParams(await req.text()).get('code') || '');
    } catch { code = ''; }
    code = code.trim();
    if (code && code === CODE()) {
      return new Response(null, { status: 303, headers: { ...baseHeaders, location: url.pathname,
        'set-cookie': `${COOKIE}=${stamp(code)}; Path=${url.pathname}; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` } });
    }
    return new Response(gate(true, url.pathname), { status: 200, headers: baseHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('GET or POST', { status: 405, headers: baseHeaders });
  if (url.searchParams.get('signout') === '1') {
    return new Response(null, { status: 303, headers: { ...baseHeaders, location: url.pathname,
      'set-cookie': `${COOKIE}=; Path=${url.pathname}; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }
  if (!allowed(req)) return new Response(gate(false, url.pathname), { status: 200, headers: baseHeaders });
  let html;
  try { html = localised(pageHtml()); }
  catch (e) { return new Response('The model is not in this deploy: ' + e.message, { status: 500, headers: { ...baseHeaders, 'content-type': 'text/plain; charset=utf-8' } }); }
  return new Response(html, { status: 200, headers: baseHeaders });
};
