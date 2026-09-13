#!/usr/bin/env node
/* localhost.mjs — the whole site on your own machine, with the REAL functions and
   nothing touching production.

     node --import ./test/register.mjs tools/localhost.mjs          # http://localhost:8950/dev
     node --import ./test/register.mjs tools/localhost.mjs --port 9000

   `netlify dev` cannot run a write path (its Blobs sandbox returns no version tag,
   so every write after the first is "busy" — AGENTS.md § Build and test). This
   serves `public/` with the redirects read out of netlify.toml, and answers
   `/api/<name>` by calling `netlify/functions/<name>.mjs` directly — through the
   same module hook the suite uses, so `@netlify/blobs` is the in-memory store
   with working etags and `stripe` is the fake. Every write lands; nothing leaves
   the process; a restart forgets everything.

   It seeds one Bar Star artist with a residency, a few one-off gigs, filed nights
   (some with Stripe money, one Stripe never answered, one MySet ran with no gig on
   the calendar), a run default and some logged nights, merch and two app orders,
   a connected account with a year of balance transactions — enough to walk every
   screen of the business dashboard (decision 0065). Open /dev to sign the browser
   in; /dev?plan=pro or ?plan=free switches the plan; /dev?reset reseeds.

   On the phone: the LAN address is printed — open /dev there too. */
import http from 'node:http';
import os from 'node:os';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PUBLIC = join(ROOT, 'public');
const args = process.argv.slice(2);
const PORT = Number((args[args.indexOf('--port') + 1]) || 0) || 8950;

/* The fakes are "on" only when a key is present — the same switch production reads. */
process.env.STRIPE_SECRET_KEY ||= 'sk_test_localhost_fake_key';
process.env.URL ||= `http://localhost:${PORT}`;

/* ---------- the redirects, read from netlify.toml so this cannot drift ---------- */
function redirects() {
  const toml = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
  const out = [];
  for (const block of toml.split('[[redirects]]').slice(1)) {
    const body = block.split(/\n\[\[/)[0];
    const from = (body.match(/^\s*from\s*=\s*"([^"]+)"/m) || [])[1];
    const to = (body.match(/^\s*to\s*=\s*"([^"]+)"/m) || [])[1];
    if (!from || !to) continue;
    const names = [];
    const re = new RegExp('^' + from.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, () => { names.push('splat'); return '(.*)'; })
      .replace(/:([a-zA-Z_]+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    out.push({ from, to, re, names });
  }
  return out;
}
const REDIRECTS = redirects();
const resolveRedirect = (path) => {
  for (const r of REDIRECTS) {
    const m = path.match(r.re);
    if (!m) continue;
    let to = r.to;
    r.names.forEach((n, i) => { to = to.replace(':' + n, m[i + 1]); });
    return to;
  }
  return null;
};

/* ---------- the functions, called the way Netlify calls them ---------- */
const FN = new Map();
async function fn(name) {
  if (!/^[a-z0-9_-]+$/i.test(name)) return null;
  if (!FN.has(name)) {
    const file = join(ROOT, 'netlify', 'functions', name + '.mjs');
    if (!existsSync(file)) return null;
    FN.set(name, (await import(pathToFileURL(file).href)).default);
  }
  return FN.get(name);
}
const CTX = { ip: '127.0.0.1', geo: { city: '', country: { code: 'TH', name: 'Thailand' } }, site: { url: process.env.URL } };

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };
const fileAt = (p) => { const f = join(PUBLIC, p); return f.startsWith(PUBLIC) && existsSync(f) && statSync(f).isFile() ? f : null; };
function serveFile(res, f) {
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(f));
}

/* ---------- the seed ---------- */
let SEED = null;   // { token, slug, aid }
const H = 3600e3, D = 24 * H;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
/* Local wall clock → ms, using this machine's zone (the seed's gigs use it too). */
const at = (dateIso, hh, mm = 0) => new Date(`${dateIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`).getTime();
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

async function seed(plan = 'plus') {
  const { __reset } = await import(pathToFileURL(join(ROOT, 'test', 'blobs-fake.mjs')).href);
  const { __stripe, __resetStripe } = await import(pathToFileURL(join(ROOT, 'test', 'stripe-fake.mjs')).href);
  __reset(); __resetStripe(); FN.clear();
  const admin = await fn('admin');
  const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import(pathToFileURL(join(ROOT, 'netlify/functions/_auth.mjs')).href);
  const { archiveShow } = await import(pathToFileURL(join(ROOT, 'netlify/functions/_history.mjs')).href);
  const { mutateConnect } = await import(pathToFileURL(join(ROOT, 'netlify/functions/_connect.mjs')).href);
  const { casDoc, KEY, mutateShow } = await import(pathToFileURL(join(ROOT, 'netlify/functions/_lib.mjs')).href);

  const made = await createArtist({ email: 'demo@myset.local', name: 'Demo Artist', slug: 'demo-artist' });
  const aid = made.artistId;
  await mutateArtists((r) => { r.byId[aid].plan = plan; return true; });
  const token = await signToken('demo@myset.local', revOf(await readArtists(), aid));
  const A = async (action, extra = {}) => {
    const r = await admin(new Request(`${process.env.URL}/api/admin`, { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ action, ...extra }) }), CTX);
    const t = await r.text(); try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
  };

  // a library
  const SONGS = [['Valerie', 'Amy Winehouse'], ['Dreams', 'Fleetwood Mac'], ['Wonderwall', 'Oasis'], ['Ho Hey', 'The Lumineers'],
    ['Riptide', 'Vance Joy'], ['Hey Ya!', 'OutKast'], ['Creep', 'Radiohead'], ['Budapest', 'George Ezra'], ['Sweet Caroline', 'Neil Diamond'],
    ['Mr. Brightside', 'The Killers'], ['Redemption Song', 'Bob Marley'], ['Yellow', 'Coldplay'], ['Tennessee Whiskey', 'Chris Stapleton'],
    ['Fast Car', 'Tracy Chapman'], ['Zombie', 'The Cranberries'], ['Hallelujah', 'Jeff Buckley']];
  for (const [title, artist] of SONGS) await A('addSong', { title, artist });

  // a connected account, so money through the app is the artist's
  const acct = 'acct_localdemo1';
  __stripe.accounts.set(acct, { id: acct, charges_enabled: true, payouts_enabled: true, details_submitted: true, country: 'TH',
    individual: { first_name: 'Demo', last_name: 'Artist', verification: { status: 'verified' } }, business_profile: { name: 'Demo Artist' }, metadata: { artist: aid } });
  await mutateConnect(aid, (c) => { c.acct = acct; c.chargesEnabled = true; c.payoutsEnabled = true; c.detailsSubmitted = true; c.country = 'TH'; return true; });

  // the calendar: a Thursday residency for two months, a Saturday one-off last week, last night, next Friday
  const now = Date.now();
  const thursday = (weeksAgo) => { const d = new Date(now); d.setHours(12, 0, 0, 0); const back = (d.getDay() + 3) % 7; d.setDate(d.getDate() - back - 7 * weeksAgo); return iso(d.getTime()); };
  const RES = 'gres001', SAT = 'gsat001', LAST = 'glast01', NEXT = 'gnext01', GONE = 'ggone01';
  await A('eventSave', { event: { id: RES, venue: 'The Ugly Duckling Irish Pub', city: 'Koh Phangan', country: 'Thailand', tz: TZ,
    date: thursday(8), time: '20:00', endTime: '23:00', repeat: { freq: 'weekly' } } });
  const satDate = iso(now - 8 * D - ((new Date(now - 8 * D).getDay() + 1) % 7) * D);
  await A('eventSave', { event: { id: SAT, venue: 'Beach House Koh Phangan', city: 'Koh Phangan', country: 'Thailand', tz: TZ, date: satDate, time: '19:30', endTime: '22:30' } });
  const lastDate = iso(now - D);
  await A('eventSave', { event: { id: LAST, venue: 'Baan Tai Beach Bar', city: 'Koh Phangan', country: 'Thailand', tz: TZ, date: lastDate, time: '20:00', endTime: '23:00' } });
  await A('eventSave', { event: { id: NEXT, venue: 'Jungle Experience', city: 'Koh Phangan', country: 'Thailand', tz: TZ, date: iso(now + 5 * D), time: '21:00', endTime: '01:00' } });

  // the run's default: what the pub pays every Thursday, the band, the drive, the set-up
  await A('bizSave', { rule: RES, gig: { pay: 30000, band: [{ name: 'Sam', cents: 10000 }, { name: 'Kim', cents: 8000 }], costs: [{ name: 'Petrol', cents: 800 }],
    min: { perform: 180, break: null, travel: 50, setup: 40 }, gear: ['Taylor 314ce', 'Bose S1 Pro', 'Shure SM58', 'Pedalboard + looper'], note: '' } });

  /* Filed nights. archiveShow stamps endedAt = Date.now(), so the clock is set to
     the night while each one is filed — the same trick the scheduler tests use. */
  const play = (titles, start) => titles.map((t, i) => ({ songId: 's' + i, title: t, artist: '', votes: 3 + ((i * 7) % 9), voters: 12 + i,
    roundVotes: 3 + ((i * 7) % 9), replay: false, at: start + (i + 1) * 11 * 60e3,
    // the round's leaderboard when the song started: what the room wanted that never got played
    round: i % 3 ? [] : [{ songId: 'w' + i, title: ['Zombie', 'Hallelujah', 'Tennessee Whiskey'][i % 3], artist: '', votes: 2 + i }] }));
  const file = async ({ showId, key, dateIso, hh, venue, songs, phones = 24, money }) => {
    const started = at(dateIso, hh, 4), ended = started + 3 * H + 12 * 60e3;
    if (money) for (const [i, [kind, cents]] of money.entries())
      __stripe.sessions.set(`cs_${showId}_${i}`, { onAccount: acct, session: { id: `cs_${showId}_${i}`, mode: 'payment', payment_status: 'paid',
        created: Math.floor((started + (i + 1) * 25 * 60e3) / 1000), amount_total: cents, metadata: { kind, artist: aid, show: showId, votes: kind === 'votes' ? String(Math.round(cents / 100)) : kind === 'song_votes' ? '5' : '', title: kind === 'request_hold' ? 'Wagon Wheel' : '' } } });
    const real = Date.now; Date.now = () => ended;
    try {
      const log = play(songs, started);
      const fans = {}; for (let i = 0; i < phones; i++) fans['f' + i] = { v: i % 4 ? ['s0'] : [], lastAt: started + 60e3 * i };
      await archiveShow(aid, { showId, venue, city: 'Koh Phangan', startedAt: started, autoKey: key || undefined, songs: log.map((p) => ({ id: p.songId, title: p.title })),
        log, nowPlaying: null, archiveTitle: '', status: 'ended', endedAt: ended }, fans);
    } finally { Date.now = real; }
    return { started, ended };
  };
  const bar = ['Valerie', 'Dreams', 'Wonderwall', 'Ho Hey', 'Riptide', 'Hey Ya!', 'Creep', 'Budapest', 'Sweet Caroline', 'Mr. Brightside', 'Yellow', 'Fast Car'];
  const nights = [];
  for (const w of [6, 5, 4, 3, 2, 1]) {
    const d = thursday(w); const showId = `${d}-2004-th${w}`;
    const money = w === 3 ? null : [['votes', 500 + w * 300], ['tip', 700], ['votes', 300], w % 2 ? ['tip', 1200] : ['votes', 500], ...(w === 1 || w === 4 ? [['request_hold', 500], ['song_votes', 250]] : [])];
    nights.push({ w, d, showId, ...(await file({ showId, key: `${RES}@${d}`, dateIso: d, hh: 20, venue: 'The Ugly Duckling Irish Pub', songs: bar.slice(0, 8 + (w % 4)), phones: 20 + w * 3, money })) });
  }
  // the Saturday one-off (money known), last night (just ended — "Log tonight"), and a Tuesday MySet ran with no gig on the calendar
  await file({ showId: `${satDate}-1934-sat`, key: `${SAT}@${satDate}`, dateIso: satDate, hh: 19, venue: 'Beach House Koh Phangan', songs: bar.slice(2, 12), phones: 41, money: [['votes', 1500], ['tip', 2000], ['votes', 800], ['request_hold', 500], ['request_hold', 500]] });
  const lastNight = await file({ showId: `${lastDate}-2003-last`, key: `${LAST}@${lastDate}`, dateIso: lastDate, hh: 20, venue: 'Baan Tai Beach Bar', songs: bar.slice(1, 10), phones: 33, money: [['votes', 900], ['tip', 500]] });
  const tueDate = iso(now - 12 * D - ((new Date(now - 12 * D).getDay() + 5) % 7) * D);
  const tueId = `${tueDate}-2102-tue`;
  await file({ showId: tueId, dateIso: tueDate, hh: 21, venue: 'Private party', songs: bar.slice(4, 11), phones: 9, money: [['tip', 2500]] });

  /* One Thursday Stripe never answered (the 2–11 Sep 2026 shape, INVARIANT 0fc):
     its money reads unknown until Re-check. */
  const unreach = nights.find((n) => n.w === 3);
  await casDoc(KEY.hist(aid, unreach.showId), () => ({}), (d) => { d.money = { ...(d.money || {}), source: 'stripe-unreachable', gross: 0 }; return true; });
  await casDoc(KEY.histIdx(aid), () => ({ shows: [] }), (idx) => { const r = (idx.shows || []).find((x) => x.showId === unreach.showId); if (r) { r.source = 'stripe-unreachable'; r.gross = 0; } return true; });

  // the live show document: the last night, ended
  await mutateShow(aid, (s) => { s.status = 'ended'; s.showId = `${lastDate}-2003-last`; s.startedAt = lastNight.started; s.endedAt = lastNight.ended; s.endedBy = 'artist';
    s.venue = 'Baan Tai Beach Bar'; s.city = 'Koh Phangan'; s.autoKey = `${LAST}@${lastDate}`; s.autoEvent = LAST;
    s.log = play(bar.slice(1, 10), lastNight.started); s.played = s.log.map((e) => e.songId); return true; });

  // logged nights: four of the six Thursdays (one differs from the run), the Saturday, the Tuesday under its showId
  const logged = {
    6: { pay: 30000, band: [{ name: 'Sam', cents: 10000 }, { name: 'Kim', cents: 8000 }], tips: 3200, merch: [{ name: 'T-shirt', qty: 2, cents: 8000 }], costs: [{ name: 'Petrol', cents: 800 }, { name: 'Strings', cents: 900 }], min: { perform: 180, break: 30, travel: 50, setup: 40 }, gear: ['Taylor 314ce', 'Bose S1 Pro', 'Shure SM58'], note: '' },
    5: { pay: 30000, band: [{ name: 'Sam', cents: 10000 }, { name: 'Kim', cents: 8000 }], tips: 4500, merch: [{ name: 'T-shirt', qty: 1, cents: 4000 }, { name: 'Cap', qty: 2, cents: 5000 }], costs: [{ name: 'Petrol', cents: 800 }], min: { perform: 180, break: 25, travel: 50, setup: 40 }, gear: ['Taylor 314ce', 'Bose S1 Pro', 'Shure SM58'], note: 'Packed — the Irish crowd' },
    4: { pay: 35000, band: [{ name: 'Sam', cents: 10000 }, { name: 'Kim', cents: 8000 }, { name: 'Dep drummer', cents: 6000 }], tips: 2100, merch: [], costs: [{ name: 'Petrol', cents: 800 }, { name: 'Parking', cents: 400 }], min: { perform: 195, break: 30, travel: 50, setup: 45 }, gear: ['Taylor 314ce', 'Bose S1 Pro', 'Shure SM58', 'Cajón'], note: 'Extra hour, dep on drums' },
    1: { pay: 30000, band: [{ name: 'Sam', cents: 10000 }, { name: 'Kim', cents: 8000 }], tips: 5100, merch: [{ name: 'T-shirt', qty: 3, cents: 12000 }], costs: [{ name: 'Petrol', cents: 800 }], min: { perform: 180, break: 30, travel: 50, setup: 40 }, gear: ['Taylor 314ce', 'Bose S1 Pro', 'Shure SM58'], note: '' },
  };
  for (const n of nights) if (logged[n.w]) await A('bizSave', { key: `${RES}@${n.d}`, gig: logged[n.w] });
  await A('bizSave', { key: `${SAT}@${satDate}`, gig: { pay: 45000, band: [{ name: 'Sam', cents: 15000 }, { name: 'Kim', cents: 12000 }], tips: 6800, merch: [{ name: 'T-shirt', qty: 4, cents: 16000 }, { name: 'Vinyl', qty: 1, cents: 3000 }],
    costs: [{ name: 'Taxi boat', cents: 2500 }, { name: 'Dinner for the band', cents: 3600 }], min: { perform: 170, break: 20, travel: 90, setup: 60 }, gear: ['Taylor 314ce', 'Bose S1 Pro ×2', 'Shure SM58 ×2', 'Cajón'], note: 'Wedding party' } });
  await A('bizSave', { key: tueId, gig: { pay: 25000, band: [], tips: 0, merch: [], costs: [{ name: 'Petrol', cents: 600 }], min: { perform: 120, break: null, travel: 40, setup: 30 }, gear: ['Taylor 314ce', 'Bose S1 Pro'], note: 'Solo, private villa' } });
  // a night logged under a gig that was later deleted — listed as "Logged show", still counted
  await A('eventSave', { event: { id: GONE, venue: 'Secret Garden', city: 'Koh Phangan', country: 'Thailand', tz: TZ, date: iso(now - 20 * D), time: '19:00', endTime: '21:00' } });
  await A('bizSave', { key: `${GONE}@${iso(now - 20 * D)}`, gig: { pay: 15000, band: [], tips: 1500, merch: [], costs: [], min: { perform: 120, break: null, travel: 30, setup: 20 }, gear: [], note: 'The gig came off the calendar afterwards' } });
  await A('eventDelete', { id: GONE });

  // merch on the page, and two orders through the app
  for (const [title, cents, blurb] of [['T-shirt', 4000, 'Black, the logo in pink-orange'], ['Cap', 2500, 'One size'], ['Vinyl — Live at the Duckling', 3000, 'Twelve songs, one night']])
    await A('merchSave', { item: { title, cents, blurb, ship: 'pickup' } });
  await casDoc(KEY.meta(aid), () => ({ tips: [], paid: {}, gifts: [], orders: [], fees: {} }), (m) => {
    m.orders ||= [];
    m.orders.push({ sid: 'cs_order1', item: 'mdemo01', title: 'T-shirt', qty: 2, amount: 80, fan: 'f3', at: nights[5].started + 90 * 60e3, ship: 'pickup', status: 'done' });
    m.orders.push({ sid: 'cs_order2', item: 'mdemo02', title: 'Cap', qty: 1, amount: 25, fan: 'f9', at: now - 26 * H, ship: 'ship', status: 'new' });
    return true;
  });

  // a year of balance transactions on the connected account, for "Your earnings"
  let seq = 0;
  const bt = (o) => { const id = `txn_local${++seq}`; __stripe.bts.set(id, { id, currency: 'usd', fee: 0, net: o.amount, fee_details: [], __account: acct, ...o }); };
  for (let m = 0; m < 12; m++) {
    const d = new Date(now); d.setMonth(d.getMonth() - m, 8); d.setHours(21, 0, 0, 0);
    const gross = 4200 + ((m * 1730) % 6100);
    const sf = Math.round(gross * 0.029) + 30 * (3 + (m % 3)), af = Math.round(gross * 0.10);
    bt({ created: Math.floor(d.getTime() / 1000), type: 'charge', amount: gross, fee: sf + af, net: gross - sf - af,
      fee_details: [{ type: 'stripe_fee', amount: sf }, { type: 'application_fee', amount: af }] });
    if (m > 0) bt({ created: Math.floor(d.getTime() / 1000) + 3 * 86400, type: 'payout', amount: -(gross - sf - af), fee: 0, net: -(gross - sf - af) });
  }

  SEED = { token, slug: 'demo-artist', aid, plan };
  return SEED;
}

/* ---------- /dev: the door, and the switches ---------- */
function devPage(q) {
  const t = SEED.token, s = SEED.slug;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MySet localhost</title><style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#1d1d1f}
a{color:#FF375F}code{background:#f0f0f2;padding:1px 5px;border-radius:5px}h1{font-size:22px}li{margin:6px 0}</style>
<h1>MySet on this machine</h1>
<p>Signed in as <b>Demo Artist</b> on <b>${SEED.plan === 'pro' ? 'Rock Star' : SEED.plan === 'plus' ? 'Bar Star' : 'Hobbyist'}</b>. Nothing here touches production; a restart forgets it all.</p>
<ul>
<li><a href="/studio">The Studio</a> — Money tab: the dashboard</li>
<li><a href="/report?hours=1">The report</a> (this month) · <a href="/report?from=${new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}&hours=1">last 60 days</a></li>
<li><a href="/demo-artist">The artist page</a> · <a href="/demo-artist/vote">the vote page</a></li>
</ul>
<p>Switch the plan: <a href="/dev?plan=plus">Bar Star</a> · <a href="/dev?plan=pro">Rock Star</a> · <a href="/dev?plan=free">Hobbyist</a> · <a href="/dev?reset=1">reseed everything</a></p>
<p style="color:#6e6e73;font-size:13px">Seeded: a Thursday residency (six nights filed, four logged, one Stripe never answered), a Saturday wedding, last night at Baan Tai (tap <i>Log tonight</i>), a Tuesday MySet ran with no gig on the calendar, a night whose gig was deleted, merch and two app orders, a connected account with a year of statements.</p>
<script>
try{localStorage.setItem('myset.token',${JSON.stringify(t)});localStorage.setItem('myset.aslug',${JSON.stringify(s)});localStorage.removeItem('myset.admin');
${q.get('tab') ? `localStorage.setItem('myset.tab',${JSON.stringify(q.get('tab'))});` : ''}}catch(e){}
${q.get('go') ? `location.replace(${JSON.stringify(q.get('go'))});` : ''}
</script>`;
}

/* ---------- the server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, process.env.URL);
    let path = decodeURIComponent(url.pathname);
    if (path === '/dev') {
      if (url.searchParams.get('reset') || url.searchParams.get('plan')) await seed(url.searchParams.get('plan') || SEED.plan);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(devPage(url.searchParams));
    }
    // real files win over the redirects, as on Netlify
    if (path === '/') path = '/index.html';
    let f = fileAt(path);
    let target = f ? null : resolveRedirect(path);
    if (!f && target) {
      if (target.startsWith('/.netlify/functions/')) {
        const name = target.slice('/.netlify/functions/'.length).split('/')[0];
        const h = await fn(name);
        if (!h) { res.writeHead(404); return res.end('no such function: ' + name); }
        const chunks = []; for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks);
        const headers = {}; for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
        const request = new Request(process.env.URL + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
        const out = await h(request, CTX);
        const hdrs = {}; out.headers.forEach((v, k) => { hdrs[k] = v; }); hdrs['cache-control'] = 'no-store';
        res.writeHead(out.status, hdrs);
        return res.end(Buffer.from(await out.arrayBuffer()));
      }
      f = fileAt(target.split('?')[0]);
    }
    if (!f) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found: ' + path); }
    return serveFile(res, f);
  } catch (e) {
    console.error('[localhost]', req.url, e);
    res.writeHead(500, { 'content-type': 'text/plain' }); res.end('localhost error: ' + (e && e.message));
  }
});

await seed(args.includes('--plan') ? args[args.indexOf('--plan') + 1] : 'plus');
server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
  console.log(`\nMySet localhost — the real functions on an in-memory store; nothing touches production.\n`);
  console.log(`  open  http://localhost:${PORT}/dev           (signs this browser in, then tap The Studio)`);
  if (lan) console.log(`  phone http://${lan.address}:${PORT}/dev      (same Wi-Fi)`);
  console.log(`\n  plan: ${SEED.plan} · switch with /dev?plan=pro|plus|free · /dev?reset=1 reseeds\n`);
});
