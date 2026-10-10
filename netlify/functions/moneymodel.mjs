import { guard } from './_errlog.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseHeaders } from './_passgate.mjs';

/* THE MONEY MODEL — myset.vip/moneymodel

   OPEN SINCE 2026-09-30 (decision 0130). The founder: "remove the pass code on the money
   model for now, there's nothing there that needs security. but the shows log, that
   definitely needs one". So /moneymodel and its live feed answer anyone, and every
   /moneymodel/shows address stands behind the CRM's passcode (_showlock.mjs). The
   history below is how it got here; the courtesy code (_passgate.mjs) now only lends
   its headers.

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
   remembered in a cookie for thirty days so a reload does not ask again. The door
   itself — the code, the hash, the cookie, the gate page — is `_passgate.mjs`
   since decision 0095, because the register's dashboard (/shows) stands behind
   the same code; one sign-in opens both.

   THE DASHBOARD (0095). `/moneymodel/shows` — every show on the platform, the
   founder's register — is served from here too (`_showsdash.mjs`), with its data,
   its CSV, a night's own page and its Refresh, so the one cookie opens the model
   and the dashboard alike. `myset.vip/shows` 301s to it.

   THE LIVE FEED (0095). `/moneymodel/live.json` answers, behind the same cookie,
   the block of real-show figures the register keeps (`act` in `_register.mjs`):
   nights counted, phones and hours a night, votes, songs, room money a head by
   plan. The page asks for it on load and lays it over its baked seed, keeping the
   seed's METERS (ticks per phone-hour, credits a night, deploys) — no function can
   read Netlify's dashboard, so those stay the tracker's. If the feed is off or
   the register is empty the page keeps its seed, exactly as before.

   The page is the same file as the published artifact. Two things are rewritten on
   the way out so the site's Content Security Policy (default-src 'self', no
   external script/font/stylesheet — SECURITY.md) stays exactly as it is: the
   charting library and the two typefaces come from /vendor/ on this site instead of
   their CDNs. The artifact keeps the CDN links because the artifact host allows
   only those. */

/* The bundled copy of finance/model.html. zip-it-and-ship-it keeps included files
   at their repo-relative path, and the function runs with that root as its
   working directory; the other candidates cover a local `netlify dev` and the
   test harness, which import this file from the repo itself. */
export function bundledPage(rel, what) {
  const here = fileURLToPath(import.meta.url);
  const candidates = [
    resolve(process.cwd(), rel),
    resolve(process.env.LAMBDA_TASK_ROOT || '', rel),
    resolve(here, '../../../' + rel),
    resolve(here, '../' + rel),
  ];
  for (const p of candidates) { try { if (existsSync(p)) return readFileSync(p, 'utf8'); } catch {} }
  throw new Error(`${rel} is not in the bundle — check [functions.${what}] included_files in netlify.toml`);
}
const CDN_CHART = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
const FONT_LINK = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/;
const PRECONNECT = /<link rel="preconnect"[^>]*>\s*/g;
export function localised(html) {
  return html.replace(CDN_CHART, '/vendor/chart.umd.min.js')
             .replace(FONT_LINK, '<link rel="stylesheet" href="/vendor/model-fonts.css">')
             .replace(PRECONNECT, '');
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: baseHeaders('application/json; charset=utf-8') });

/* THE SHOW LOG'S DOOR (decision 0130): the CRM's passcode, its lock screen, its count of
   wrong tries. Returns a Response while the door is shut, or null once it is open. */
async function showDoor(req, url) {
  const L = await import('./_showlock.mjs');
  const secure = url.protocol === 'https:';
  if (/\/shows\/unlock$/.test(url.pathname)) {
    if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405);
    if (!L.ready()) return json({ ok: false, error: 'not-set-up' }, 401);
    let code = '';
    try { code = String(((await req.json()) || {}).code || ''); } catch { code = ''; }
    const r = await L.tryPasscode(code);
    if (r.ok) { const res = json({ ok: true }); res.headers.append('set-cookie', await L.unlockCookie({ secure })); return res; }
    if (r.shut) {
      try {
        const [{ notify }, { DEFAULT_ARTIST }] = await Promise.all([import('./_push.mjs'), import('./_lib.mjs')]);
        await notify(DEFAULT_ARTIST, { title: '🔒 The Show log is locked', body: `${L.LOCK_TRIES} wrong passcodes in a row, so it stays shut for ${L.LOCK_MINUTES} minutes. If that wasn’t you, change the CRM passcode.`, url: '/moneymodel/shows', tag: 'show-lock' }, { owner: true });
      } catch {}
    }
    return r.until ? json({ ok: false, error: 'locked-out', until: r.until }, 429) : json({ ok: false, error: 'wrong', left: r.left }, 401);
  }
  if (url.searchParams.get('lock') === '1') {
    return new Response(null, { status: 303, headers: { ...baseHeaders(), location: '/moneymodel/shows', 'set-cookie': L.clearCookie(secure) } });
  }
  if (await L.unlocked(req)) return null;
  const until = L.ready() ? await L.shutUntil() : 0;
  /* data addresses and the page's own actions get a JSON refusal; the page gets the lock screen */
  if (/\.(json|csv)$/.test(url.pathname) || req.method === 'POST' || (req.headers.get('accept') || '').includes('application/json')) {
    return json({ ok: false, error: 'locked', ready: L.ready(), until }, 401);
  }
  const lock = L.lockPage({ ready: L.ready(), until });
  return new Response(lock, { status: 200, headers: baseHeaders(undefined, lock) });
}

const main = async (req) => {
  const url = new URL(req.url);
  const onShows = /\/shows(\.|\/|$)/.test(url.pathname);
  if (onShows) { const shut = await showDoor(req, url); if (shut) return shut; }

  /* the founder's register dashboard and its data (decision 0095) — _showsdash.mjs */
  if (/\/moneymodel\/shows(\.|\/|$)/.test(url.pathname) || /\/moneymodel\/shows$/.test(url.pathname)) {
    const { handleShows } = await import('./_showsdash.mjs');
    return handleShows(req, url, { bundledPage, localised });
  }

  /* the register's block for the Real shows panel — see the header */
  if (/\/live\.json$/.test(url.pathname)) {
    try {
      const { readRegister } = await import('./_register.mjs');
      const reg = await readRegister();
      if (!reg || !reg.act) return new Response(JSON.stringify({ ok: true, live: false, why: 'the register has not been built yet' }), { status: 200, headers: baseHeaders('application/json; charset=utf-8') });
      return new Response(JSON.stringify({ ok: true, live: true, builtAt: reg.builtAt, act: reg.act, totals: reg.totals }), { status: 200, headers: baseHeaders('application/json; charset=utf-8') });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, live: false, error: String((e && e.message) || e) }), { status: 200, headers: baseHeaders('application/json; charset=utf-8') });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('GET or POST', { status: 405, headers: baseHeaders('text/plain; charset=utf-8') });
  let html;
  try { html = localised(bundledPage('finance/model.html', 'moneymodel')); }
  catch (e) { return new Response('The model is not in this deploy: ' + e.message, { status: 500, headers: baseHeaders('text/plain; charset=utf-8') }); }
  return new Response(html, { status: 200, headers: baseHeaders(undefined, html) });
};
/* guard(): a store that does not answer is a 503 "busy", never an empty page or a crash (decision 0142). */
export default guard('moneymodel', main);
