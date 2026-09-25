import { baseHeaders } from './_passgate.mjs';

/* EVERY SHOW ON MYSET — myset.vip/moneymodel/shows (decision 0095)

   The founder's dashboard of every night every artist has filed: who played and
   where (artist, venue, city, country), how long it ran, how many phones were in the
   room, the votes, the votes bought, the tips, the requests, the merch, the songs —
   one row per show, roll-ups by artist, venue, country and month, and the block the
   money model reads. The numbers are the register's (`_register.mjs`); this module
   only hands them over. It is served by moneymodel.mjs, behind the model's own
   passcode, on every path (the gate runs before this is reached):

     GET  /moneymodel/shows                     the page (finance/shows.html, localised like the model)
     GET  /moneymodel/shows.json?months=all|N   the head + the rows of those months, merged
     GET  /moneymodel/shows.csv                 every filed night, one line each
     GET  /moneymodel/shows/night.json?a=&id=   one night's songs and money lines, nothing a fan typed
     POST /moneymodel/shows/refresh             fold now, under the register's own lock
   `myset.vip/shows` 301s here so the founder has a short address to remember. */

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: baseHeaders('application/json; charset=utf-8') });
const REFRESH_GAP_MS = 60e3;

export async function handleShows(req, url, { bundledPage, localised }) {
  const path = url.pathname.replace(/\/+$/, '');
  const R = await import('./_register.mjs');
  if (/\/shows\.json$/.test(path)) {
    const months = url.searchParams.get('months') || 'all';
    const view = await R.readView({ months: months === 'all' ? 'all' : Number(months) || 3 });
    if (!view) return json({ ok: true, built: false, why: 'The register has not been built yet — tap Refresh now, or wait for the ten-minute bell.' });
    return json({ ok: true, built: true, ...view });
  }
  if (/\/shows\.csv$/.test(path)) {
    const view = await R.readView({ months: 'all' });
    return new Response(R.registerCsv(view), { status: 200, headers: { ...baseHeaders('text/csv; charset=utf-8'), 'content-disposition': `attachment; filename="myset-every-show-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }
  if (/\/shows\/night\.json$/.test(path)) {
    const aid = String(url.searchParams.get('a') || '').replace(/[^a-z0-9-]/g, '').slice(0, 40);
    const id = String(url.searchParams.get('id') || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
    const d = await R.nightDetail(aid, id);
    return d ? json({ ok: true, ...d }) : json({ ok: false, error: 'unknown night' }, 404);
  }
  if (/\/shows\/refresh$/.test(path)) {
    if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405);
    /* a person asked, so the fold runs now — under the same lock as the bell, with a
       short gap so a double tap does not walk the store twice, and an answer either way */
    const state = await R.readState();
    const since = Date.now() - (Number(state.lastRunAt) || 0);
    if (since < REFRESH_GAP_MS) return json({ ok: true, skipped: true, why: `built ${Math.round(since / 1000)} s ago — nothing new yet`, lastRunAt: state.lastRunAt });
    const r = await R.foldRegister({ full: true, reason: 'refresh' });
    if (r.busy) return json({ ok: true, skipped: true, why: 'a fold is running now — try again in a minute' });
    return json(r);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('GET or POST', { status: 405, headers: baseHeaders('text/plain; charset=utf-8') });
  let html;
  try { html = localised(bundledPage('finance/shows.html', 'moneymodel')); }
  catch (e) { return new Response('The dashboard is not in this deploy: ' + e.message, { status: 500, headers: baseHeaders('text/plain; charset=utf-8') }); }
  return new Response(html, { status: 200, headers: baseHeaders() });
}
