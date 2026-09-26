/* EVERY SHOW ON THE PLATFORM — the register  (_register.mjs, _nightrule.mjs, registercron.mjs,
   moneymodel.mjs /moneymodel/shows + live.json; decision 0095, INVARIANT 0gi)

   One row per night any artist has filed, in month shards under a head with the roll-ups
   and the block the money model reads — built by walking the registries and each artist's
   own index (never Blobs list()). This pins:
     · the night rules agree with tools/actuals.py on two snapshots of production — the same
       five nights count on 11 Sep; the same fifteen on 25 Sep, two unused, thirteen refused,
       $1.037 a head — and every `why` is the tracker's own sentence;
     · where a night was: country from the record, the calendar, the venue registry or the
       "City, Country" string, in that order;
     · hidden is a flag beside the status: the totals follow the rule on both sides;
     · nothing in the register names a device, an email, a note or a name a fan typed;
     · counts the store forgets (requests, RSVPs, ratings) are frozen and never go down;
     · the fold is one writer under a lock, incremental (a second fold reads no detail),
       leaves the register's marks cleared, keeps a departed artist's nights nameless;
     · the dashboard, its data, its CSV and the model's feed sit behind the passcode on
       every path, and the page reaches the browser with no external script. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const R = await import('../netlify/functions/_register.mjs');
const N = await import('../netlify/functions/_nightrule.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + '\n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const fixture = (dir) => {
  const FIX = path.resolve('finance/fixtures', dir);
  const fx = (k) => (existsSync(path.join(FIX, k + '.json')) ? JSON.parse(readFileSync(path.join(FIX, k + '.json'), 'utf8')) : null);
  const registry = fx('artists');
  const parts = {};
  for (const aid of Object.keys(registry.byId)) {
    const nights = Object.fromEntries(readdirSync(FIX).filter((f) => f.startsWith(`hist_${aid}_`)).map((f) => { const d = fx(f.slice(0, -5)); return [d.showId, R.slimNight(d)]; }));
    parts[aid] = { nights, idx: ((fx(`histidx_${aid}`) || {}).shows) || [], ev: fx(`ev_${aid}`), reqs: fx(`req_${aid}`), fb: fx(`fb_${aid}`), rsvp: fx(`rsvp_${aid}`), feats: fx(`feats_${aid}`), meta: null };
  }
  return { FIX, fx, registry, venues: fx('venues') || { byId: {} }, parts };
};

console.log('\nTHE NIGHT RULES, 11 Sep snapshot — the same answers as tools/actuals.py');
{
  const NOW = 1788975620987 + 86400e3;
  const { registry, parts } = fixture('2026-09-11');
  registry.byId.samcole = { slug: 'samcole', name: 'Sam Cole', plan: 'free', createdAt: 1 };   // the load-test account of 31 Aug, judged too
  const { FIX, fx } = fixture('2026-09-11');
  parts.samcole = { nights: Object.fromEntries(readdirSync(FIX).filter((f) => f.startsWith('hist_samcole_')).map((f) => { const d = fx(f.slice(0, -5)); return [d.showId, R.slimNight(d)]; })), idx: [] };
  const reg = R.buildRegister({ registry, venues: { byId: {} }, parts, now: NOW });
  const counted = reg.rows.filter((r) => r.status === 'counted');
  eq('five nights count (30 Aug, 6/7/8/9 Sep)', counted.map((r) => r.showId).sort(), ['2026-08-30-1210', '2026-09-06-1130-gzbi', '2026-09-07-1330-nc5m', '2026-09-08-1153-qkrd', '2026-09-09-1130-l6ru']);
  eq('the 4 Sep Seaflower night is on the calendar but unused', reg.rows.filter((r) => r.status === 'unused').map((r) => r.showId), ['2026-09-04-1150-svmm']);
  eq('fourteen records are refused', reg.rows.filter((r) => r.status === 'refused').length, 14);
  const H = Object.fromEntries(counted.map((r) => [r.showId, r.hours]));
  eq('a night ended inside its slot keeps its record length (Sun 2.53, Mon 2.81)', [H['2026-09-06-1130-gzbi'], H['2026-09-07-1330-nc5m']], [2.53, 2.81]);
  eq('a record that overran the slot is the later of the slot and the last song (Tue 2.09 of 4.23 h)', H['2026-09-08-1153-qkrd'], 2.09);
  eq('a room still voting past the slot is still a room (Wed 4.07 of a 6.0 h record, 3 h slot)', H['2026-09-09-1130-l6ru'], 4.07);
  const why = Object.fromEntries(reg.rows.map((r) => [r.showId, r.why]));
  eq('a test at a random hour is named as such, in the calendar\'s own clock', why['2026-09-07-0223-g9u3'], 'not on the published calendar — started 2026-09-07 09:23 local, no gig within 90 min; a test or an accident');
  ok('31/44/26 phones on one network in minutes is a load test', reg.rows.filter((r) => r.artist.id === 'samcole').every((r) => /load test from one machine/.test(r.why)), reg.rows.filter((r) => r.artist.id === 'samcole').map((r) => r.why));
  eq('nobody there', why['2026-08-30-1855'], 'nobody there');
  eq('interactions = votes + requests per phone (Mon: 27 + 4 over 14 phones)', counted.find((r) => r.showId === '2026-09-07-1330-nc5m').interactions, Math.round(31 / 14 * 100) / 100);
  eq('room money comes only from the night Stripe answered ($0.375 a head, one night)', [reg.act.roomPerHead, reg.act.moneyKnownNights], [0.375, 1]);
  eq('a night Stripe could not be asked about is unknown, never $0', counted.find((r) => r.showId === '2026-09-06-1130-gzbi').money.total, null);
  eq('silent nights: five published gigs left no record', reg.silent.map((s) => [s.eventId, s.date]), [['g3ei0k6l3', '2026-09-10'], ['g3ei0k6l3', '2026-09-03'], ['g9zst3nmn', '2026-09-02'], ['gimj34ujp', '2026-09-01'], ['gx78yyhxp', '2026-08-31']]);
  eq('the model block: shows, gigs on the calendar, used, silent', [reg.act.shows, reg.act.gigsOnCalendar, reg.act.gigsUsed, reg.act.gigsSilent], [5, 11, 5, 5]);
  const avg = (k) => Math.round(counted.reduce((a, r) => a + r[k], 0) / counted.length * 100) / 100;
  eq('the model block averages the counted nights (people, hours, votes, songs)', [reg.act.people, reg.act.hours, reg.act.votes, reg.act.songs], [avg('people'), avg('hours'), avg('votes'), avg('songsPlayed')]);
  console.log('\nWHERE A NIGHT WAS');
  eq('country comes off the calendar gig when the record has none', [...new Set(counted.map((r) => r.country))], ['Thailand']);
  eq('city is the gig\'s city, not the joined string; and the placing says so', [[...new Set(counted.map((r) => r.city))], [...new Set(counted.map((r) => r.placedBy))]], [['Koh Phangan'], ['calendar']]);
  const t = reg.rows.find((r) => r.showId === '2026-09-07-0223-g9u3');
  eq('a night with no gig reads its country off the "City, Country" string', [t.country, t.city, t.placedBy], ['Thailand', 'Koh Phangan', 'city']);
  const one = R.buildRegister({ registry, venues: { byId: { v1: { name: 'The Lantern', city: 'Haad Rin', country: 'Thailand' } } }, parts, now: NOW });
  const s = one.rows.find((r) => r.artist.id === 'samcole');
  eq('or off a venue in the registry with the same name (the only match)', [s.country, s.city, s.placedBy, s.venueId], ['Thailand', 'Haad Rin', 'venue', 'v1']);
  const two = R.buildRegister({ registry, venues: { byId: { v1: { name: 'The Lantern', city: 'Haad Rin', country: 'Thailand' }, v2: { name: 'Lantern', city: 'Hanoi', country: 'Vietnam' } } }, parts, now: NOW });
  eq('two registry matches: neither is trusted', two.rows.find((r) => r.artist.id === 'samcole').placedBy, 'none');
  const stamped = R.buildRegister({ registry, venues: { byId: {} }, parts: { ...parts, samcole: { nights: Object.fromEntries(Object.entries(parts.samcole.nights).map(([k, d]) => [k, { ...d, country: 'Laos', tz: 'Asia/Vientiane', plan: 'plus' }])), idx: [] } }, now: NOW });
  eq('a country, zone and plan stamped on the record win', [...new Set(stamped.rows.filter((r) => r.artist.id === 'samcole').map((r) => `${r.country}/${r.placedBy}/${r.tz}/${r.artist.plan}`))], ['Laos/record/Asia/Vientiane/plus']);
  eq('roll-ups: one country, one city, three venues (two spellings of the Ugly Duckling are one venue)', [reg.byCountry.map((c) => [c.country, c.nights]), reg.byCity.map((c) => [c.city, c.nights]), reg.byVenue.length], [[['Thailand', 5]], [['Koh Phangan', 5]], 3]);
  eq('by artist: the founder has five nights and five silent gigs, the load-test account none and is still listed', reg.byArtist.map((a) => [a.id, a.nights, a.silent, a.published]), [['perry-idyll', 5, 5, 11], ['samcole', 0, 0, 0]]);
}

console.log('\nTHE NIGHT RULES, 25 Sep snapshot — fifteen nights, as the fortnight audit counted them');
{
  const NOW = Date.parse('2026-09-25T04:00:00Z');
  const { registry, venues, parts } = fixture('2026-09-25');
  const reg = R.buildRegister({ registry, venues, parts, now: NOW });
  const counted = reg.rows.filter((r) => r.status === 'counted');
  eq('fifteen counted, two unused, thirteen refused — the tracker\'s answer (finance/actuals.json: shows 15)', [counted.length, reg.totals.unused, reg.totals.refused], [15, 2, 13]);
  eq('$1.037 a head over eleven money-known nights (the audit\'s $85 / 82 phones)', [reg.act.roomPerHead, reg.act.moneyKnownNights], [1.037, 11]);
  eq('8.6 phones, 2.73 h, 2.09 actions a phone, 10 songs — the seed the model carries', [reg.act.people, reg.act.hours, reg.act.interactions, reg.act.songs], [8.6, 2.73, 2.09, 10]);
  eq('22 gigs on the calendar: 15 used, 2 unused, 5 silent', [reg.act.gigsOnCalendar, reg.act.gigsUsed, reg.act.gigsUnused, reg.act.gigsSilent], [22, 15, 2, 5]);
  const hidden = reg.rows.filter((r) => r.hidden);
  eq('twelve nights the founder hid from his Money tab are flagged, not dropped, and none of them counted', [hidden.length, hidden.filter((r) => r.status === 'counted').length, reg.totals.hidden], [12, 0, 12]);
  eq('every counted night is in Thailand and the money note says so — a floor, not a ceiling', [reg.totals.knownCountries, /all in Thailand — where pay is close to nothing/.test(reg.act.moneyNote)], [['Thailand'], true]);
  eq('six artists on the platform, one with nights; five signed up this month', [reg.totals.artistsOnPlatform, reg.totals.artistsWithNights, reg.signups.artistsByMonth.find((m) => m.month === '2026-09').artists], [6, 1, 5]);
  ok('the platform\'s most-played songs come from the counted nights\' tallies', reg.topSongs.length >= 10 && reg.topSongs[0].plays >= 5, reg.topSongs.slice(0, 3));
  eq('a merged view of two records in one slot is one night', reg.totals.merged, 0);
  ok('the request the room made on 7 Sep is on that night (the fixture\'s req_ list)', counted.find((r) => r.showId === '2026-09-07-1330-nc5m').requests.count === 4, counted.find((r) => r.showId === '2026-09-07-1330-nc5m').requests);
}

console.log('\nTWO RECORDS IN ONE SLOT, AND THE WINDOW FIGURE');
{
  const { registry, venues, parts } = fixture('2026-09-11');
  const a = parts['perry-idyll'].nights['2026-09-06-1130-gzbi'];
  const b = { ...JSON.parse(JSON.stringify(a)), showId: 'again', startedAt: a.endedAt + 60e3, endedAt: a.endedAt + 40 * 60e3, stats: { ...a.stats, room: 3, totalVotes: 4, songsPlayed: 2 },
    money: { ...a.money, source: 'stripe', gross: 5, unattributed: 3 } };
  const a2 = { ...JSON.parse(JSON.stringify(a)), money: { ...a.money, source: 'stripe', gross: 10, unattributed: 3 } };
  const p = { ...parts, 'perry-idyll': { ...parts['perry-idyll'], nights: { ...parts['perry-idyll'].nights, '2026-09-06-1130-gzbi': a2, again: b } } };
  const reg = R.buildRegister({ registry, venues, parts: p, now: 1788975620987 + 86400e3 });
  const m = reg.rows.find((r) => r.mergedFrom);
  ok('the two are one night in the view', m && m.mergedFrom.length === 2 && reg.rows.filter((r) => r.showId === 'again').length === 0, m && m.mergedFrom);
  eq('votes and songs summed, the larger room kept', [m.votes, m.songsPlayed, m.people], [25 + 4, 7 + 2, 8]);
  eq('tagged money summed; untagged money (a window figure) taken once, not twice', [m.money.gross, m.money.unattributed, m.money.total], [15, 3, 18]);
  eq('the night\'s length runs to the second record\'s end (inside the slot)', m.recordHours, Math.round((b.endedAt - a.startedAt) / 3600e3 * 100) / 100);
}

console.log('\nNOTHING ABOUT A FAN');
{
  const { registry, venues, parts, fx } = fixture('2026-09-11');
  const doc = fx('hist_perry-idyll_2026-09-09-1130-l6ru');
  doc.money.tips.recent = [{ amount: 10, note: 'love you — from DEVICE-abc', at: 1 }];
  doc.played[0].round = [{ songId: 'x', title: 'X', votes: 1 }];
  const slim = R.slimNight(doc);
  ok('tip notes and the per-song board are not kept', !JSON.stringify(slim).includes('DEVICE-abc') && !JSON.stringify(slim).includes('"round"'), Object.keys(slim));
  const p = { ...parts, 'perry-idyll': { ...parts['perry-idyll'],
    fb: { list: [{ fan: 'DEVICE-fb', stars: 5, note: 'DEVICE-note', at: 1, show: '2026-09-09-1130-l6ru' }] },
    meta: { tips: [{ fan: 'DEVICE-tip', amount: 10, at: 1, show: '2026-09-09-1130-l6ru', note: 'DEVICE-said' }], paid: { cs_1: { kind: 'votes', amount: 5, granted: 3, fan: 'DEVICE-pay', at: 1, show: '2026-09-09-1130-l6ru' } }, orders: [{ sid: 'cs_2', fan: 'DEVICE-buyer', show: '2026-09-09-1130-l6ru', title: 'Tee', qty: 2, amount: 40, cents: 3600, post: 400, at: doc.startedAt + 60e3 }] },
    reqs: { list: [{ id: 'r1', kind: 'birthday', name: 'DEVICE-NAME', fan: 'DEVICE-req', showId: '2026-09-09-1130-l6ru', status: 'added' }, { id: 'r2', kind: 'song', title: 'Zombie', fan: 'DEVICE-req2', showId: '2026-09-09-1130-l6ru', status: 'played' }] },
    rsvp: { occ: { 'g9zst3nmn|2026-09-09': { n: 4, fans: { 'DEVICE-r': 1 } } } } } };
  const reg = R.buildRegister({ registry, venues, parts: p, now: 1788975620987 + 86400e3 });
  const s = JSON.stringify(reg);
  ok('no device id, no note, no name, no email reaches the register', !/DEVICE|example\.com/.test(s), s.match(/DEVICE[^"]*/g));
  const w = reg.rows.find((r) => r.showId === '2026-09-09-1130-l6ru');
  eq('but the merch (goods and postage apart), the rating, the requests by kind and the RSVPs are counted on the night', [w.money.merch.orders, w.money.merch.items, w.money.merch.goods, w.money.merch.postage, w.money.merch.atShow, w.rating, w.requests.count, w.requests.birthdays, w.requests.accepted, w.rsvps], [1, 2, 36, 4, 1, { avg: 5, n: 1 }, 2, 1, 2, 4]);
  eq('the app\'s own tip and pack marks, tagged with the night, are kept beside the Stripe answer (which is unknown here)', [w.money.known, w.money.store], [false, { tips: 1, tipsAmount: 10, packs: 1, votes: 3 }]);
  const csv = R.registerCsv(reg);
  ok('the CSV names nothing a fan typed either', !/DEVICE/.test(csv) && csv.split('\n').length === reg.rows.length + 2, csv.split('\n').length);
}

console.log('\nCOUNTS THE STORE FORGETS ARE FROZEN AND NEVER GO DOWN');
{
  const { registry, venues, parts } = fixture('2026-09-11');
  const id = '2026-09-09-1130-l6ru';
  const ctx = R.artistContext(parts['perry-idyll'].ev, 1788975620987 + 86400e3, [parts['perry-idyll'].nights[id].startedAt, parts['perry-idyll'].nights[id].endedAt]);
  const full = { ...ctx, reqs: { list: [{ kind: 'song', showId: id, status: 'added' }, { kind: 'vibe', showId: id, status: 'pending' }] }, fb: { list: [{ stars: 4, show: id }, { stars: 5, show: id }] }, rsvp: { occ: { 'g9zst3nmn|2026-09-09': { n: 6 } } } };
  const first = R.buildRow('perry-idyll', registry.byId['perry-idyll'], parts['perry-idyll'].nights[id], full, [], {});
  eq('first observation: two requests, a 4.5 rating over two, six RSVPs', [first.requests.count, first.rating, first.rsvps], [2, { avg: 4.5, n: 2 }, 6]);
  const later = R.buildRow('perry-idyll', registry.byId['perry-idyll'], parts['perry-idyll'].nights[id], { ...ctx, reqs: { list: [] }, fb: { list: [{ stars: 1, show: id }] }, rsvp: { occ: {} } }, [], { observed: first._observed });
  eq('after the request list forgot, a device re-rated and the RSVPs were pruned, the night keeps what was seen', [later.requests.count, later.rating, later.rsvps], [2, { avg: 4.5, n: 2 }, 6]);
  const filed = R.buildRow('perry-idyll', registry.byId['perry-idyll'], { ...parts['perry-idyll'].nights[id], requests: { count: 3, songs: 2, birthdays: 1, vibes: 0, accepted: 2, played: 1 }, rsvps: 9 }, { ...ctx, reqs: { list: [] } }, [], { observed: first._observed });
  eq('a count filed with the night itself (0095) wins when it is larger', [filed.requests.count, filed.requests.known, filed.rsvps], [3, true, 9]);
}

console.log('\nTHE ONE RULE, SHARED');
{
  eq('judgeNight is what the stats page and the Sheet use too', typeof N.judgeNight, 'function');
  const M = await import('../netlify/functions/_metrics.mjs');
  ok('the stats page re-exports the rule\'s helpers', typeof M.placeNight === 'function' && typeof M.occurrences === 'function' && M.EARLY_MS === N.EARLY_MS);
  eq('a 20-minute record is a demo everywhere', N.judgeNight({ people: 5, votes: 9, startedAt: 0, endedAt: 20 * 60e3, nets: 3, gig: { startsAt: 0, endsAt: 3 * 3600e3 }, hasCalendar: true }).status, 'refused');
}


/* ────────────────────────────────────────────────────────────────────────────────────
   END TO END on the fake store: the fold, the marks, the door, the bell, the feed.
   ──────────────────────────────────────────────────────────────────────────────────── */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
delete process.env.STRIPE_SECRET_KEY;
const admin = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const meFn = (await import('../netlify/functions/me.mjs')).default;
const moneymodel = (await import('../netlify/functions/moneymodel.mjs')).default;
const cron = (await import('../netlify/functions/registercron.mjs')).default;
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { mutateShow, readDoc, casDoc } = await import('../netlify/functions/_lib.mjs');
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');
const { stamp, CODE } = await import('../netlify/functions/_passgate.mjs');

const hit = async (h, url, body, token, extra = {}) => {
  const headers = { 'content-type': 'application/json', ...(extra.headers || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers, method: extra.method || 'GET' } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { j = null; }
  return { status: r.status, headers: r.headers, text: t, ...(j || {}) };
};
const AS = (token, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);
const H = 3600e3;

console.log('\nEND TO END  an artist with a calendar plays a night; the register learns it');
const kai = await createArtist({ email: 'kai@example.com', name: 'Kai Rivers', slug: 'kai-rivers' });
const TK = await signToken('kai@example.com', revOf(await readArtists(), kai.artistId));
await mutateArtists((r) => { r.byId[kai.artistId].plan = 'plus'; return true; });
const bkk = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }; };
const g = bkk(Date.now() - 125 * 60e3);
ok('a gig on the calendar, two hours ago, in Koh Phangan, Thailand', (await AS(TK, 'eventSave', { event: { venue: 'Seaflower Bungalows', city: 'Koh Phangan', country: 'Thailand', date: g.date, time: g.time, tz: 'Asia/Bangkok', durationMin: 180 } })).ok);
for (const t of ['Valerie', 'Zombie', 'Wonderwall']) await AS(TK, 'addSong', { title: t, artist: 'Cover' });
ok('the show starts (a hand start near the gig)', (await AS(TK, 'newShow')).ok);
await mutateShow(kai.artistId, (s) => { s.startedAt = Date.now() - 120 * 60e3; return true; });   // it has run two hours
for (const f of ['ann', 'bob', 'cy']) { await hit(meFn, `https://x/api/me?a=kai-rivers&fan=${f}&in=1`); await hit(voteFn, 'https://x/api/vote?a=kai-rivers', { fan: f, song: 'valerie' }); }
await AS(TK, 'play', { song: 'valerie' });
await hit(voteFn, 'https://x/api/vote?a=kai-rivers', { fan: 'ann', song: 'zombie' });
const marksBefore = ((await readDoc('gigsched', null)).data || {}).regdirty || {};
ok('starting left the register a mark, with no fold on the tap', !!marksBefore[kai.artistId] && !(await R.readRegister()), marksBefore);
ok('the show ends', (await AS(TK, 'status', { status: 'ended' })).ok);
const show = (await readDoc(`show_${kai.artistId}`, null)).data;
eq('the night was stamped with the gig\'s country, zone and the plan it was played on', [show.country, show.tz, show.plan], ['Thailand', 'Asia/Bangkok', 'plus']);
const filed = (await readDoc(`hist_${kai.artistId}_${show.showId}`, null)).data;
eq('…and filed with them, who started and ended it, and the request count', [filed.country, filed.tz, filed.plan, filed.startedBy, filed.endedBy, filed.requests && filed.requests.count], ['Thailand', 'Asia/Bangkok', 'plus', 'artist', 'artist', 0]);

console.log('\nTHE FOLD  one writer, incremental, marks cleared');
{
  const ops = __opsStart();
  const r1 = await R.foldRegister({ reason: 'test' });
  const o1 = __opsStop();
  ok('the first fold builds the register', r1.ok && r1.shows === 1 && r1.artistsWalked >= 1, r1);
  const head = await R.readRegister();
  eq('the head has one counted night in Thailand, by a Plus artist, 3 phones, 2 songs\' worth of votes', [head.totals.counted, head.byCountry[0].country, head.byArtist[0].plan, head.rows === undefined, head.months.length], [1, 'Thailand', 'plus', true, 1]);
  const view = await R.readView({ months: 'all' });
  const row = view.rows.find((r) => r.showId === show.showId);
  eq('the row: 3 phones, 4 votes, 1 song, plan stamped, placed by the record', [row.people, row.votes, row.songsPlayed, row.artist.planStamped, row.placedBy, row.status, row.hidden], [3, 4, 1, true, 'record', 'counted', false]);
  eq('money unknown (payments off), never zero', [row.money.known, row.money.total, row.money.source], [false, null, 'off']);
  eq('the mark was cleared', (((await readDoc('gigsched', null)).data || {}).regdirty || {})[kai.artistId], undefined);
  const ops2 = __opsStart();
  const r2 = await R.foldRegister({ reason: 'test-again' });
  const o2 = __opsStop();
  const detailReads = (o) => o.filter((l) => /get .*hist_kai/.test(l) && !/histidx|histids/.test(l)).length;
  eq('a second fold with nothing changed reads no night\'s detail', [r2.ok, detailReads(o2)], [true, 0]);
  ok('…and far fewer documents than the first', o2.length < o1.length, [o1.length, o2.length]);
  eq('the model\'s block: 1 show, 3 phones, room money unknown', [head.act.shows, head.act.people, head.act.roomPerHead, head.act.moneyKnownNights], [1, 3, null, 0]);
  ok('the head names nothing about a fan', !/ann|bob|"cy"|example\.com/.test(JSON.stringify(head)) && !/ann|bob|example\.com/.test(JSON.stringify(view)));
}

console.log('\nA RENAME AND A HIDE reach the register; a departed artist stays, nameless');
{
  const history = (await import('../netlify/functions/history.mjs')).default;
  ok('the artist names the night', (await hit(history, 'https://x/api/history', { action: 'rename', show: show.showId, title: 'Seaflower sunset' }, TK)).ok);
  ok('…which marks the register', !!((((await readDoc('gigsched', null)).data || {}).regdirty || {})[kai.artistId]));
  await R.foldRegister({ reason: 'after-rename' });
  eq('the title is on the row', (await R.readView()).rows.find((r) => r.showId === show.showId).title, 'Seaflower sunset');
  ok('the artist hides it', (await hit(history, 'https://x/api/history', { action: 'hide', show: show.showId }, TK)).ok);
  await R.foldRegister({ reason: 'after-hide' });
  const v = await R.readView();
  eq('hidden is a flag; the night still counts', [v.rows.find((r) => r.showId === show.showId).hidden, v.totals.counted, v.totals.hidden], [true, 1, 1]);
  await mutateArtists((reg) => { delete reg.byId[kai.artistId]; delete reg.bySlug['kai-rivers']; return true; });
  await R.foldRegister({ full: true, reason: 'after-leaving' });
  const gone = await R.readView();
  eq('the account left: the night stays, the name does not, the totals do not move', [gone.rows.length, gone.rows[0].artist.name, gone.rows[0].artist.left, gone.totals.counted, gone.totals.artistsLeft], [1, '', true, 1, 1]);
}

console.log('\nTHE DOOR  the dashboard, its data, its CSV, the feed — every path, every address');
{
  const cookie = `fm=${stamp(CODE())}`;
  for (const p of ['/moneymodel/shows', '/moneymodel/shows.json', '/moneymodel/shows.csv', '/moneymodel/shows/night.json?a=x&id=y', '/moneymodel/live.json', '/api/moneymodel/shows.json', '/.netlify/functions/moneymodel/shows.csv']) {
    const r = await moneymodel(new Request('https://myset.vip' + p, { headers: { accept: /json|csv/.test(p) ? 'application/json' : 'text/html' } }));
    const t = await r.text();
    ok(`without the code, ${p} gives nothing away`, (/json|csv/.test(p) ? r.status === 401 : /Enter the passcode/.test(t)) && !/Seaflower/.test(t), [r.status, t.slice(0, 80)]);
  }
  const refresh = await moneymodel(new Request('https://myset.vip/moneymodel/shows/refresh', { method: 'POST', headers: { accept: 'application/json' } }));
  eq('nor does a refresh without the code', refresh.status, 401);
  const page = await moneymodel(new Request('https://myset.vip/moneymodel/shows', { headers: { cookie } }));
  const html = await page.text();
  ok('with it, the page comes through the model\'s door', page.status === 200 && /Every show on MySet/.test(html));
  ok('…with no external script, stylesheet or font (the CSP): the chart from /vendor/, the type is the system\'s (the /mediadash look)', !/<script src="http/.test(html) && !/<link rel="stylesheet" href="http/.test(html) && !/fonts\.googleapis/.test(html) && /\/vendor\/chart\.umd\.min\.js/.test(html));
  eq('…and never cached or indexed', [page.headers.get('cache-control'), page.headers.get('x-robots-tag')], ['private, no-store', 'noindex, nofollow']);
  const data = await (await moneymodel(new Request('https://myset.vip/moneymodel/shows.json?months=all', { headers: { cookie, accept: 'application/json' } }))).json();
  eq('the data: built, one row, with the roll-ups', [data.ok, data.built, data.rows.length, data.totals.counted, Array.isArray(data.byArtist)], [true, true, 1, 1, true]);
  const csv = await (await moneymodel(new Request('https://myset.vip/moneymodel/shows.csv', { headers: { cookie } }))).text();
  ok('the CSV: a header and one line, no fan', csv.split('\n').filter(Boolean).length === 2 && !/ann|bob/.test(csv), csv.slice(0, 120));
  const night = await (await moneymodel(new Request(`https://myset.vip/moneymodel/shows/night.json?a=${kai.artistId}&id=${show.showId}`, { headers: { cookie, accept: 'application/json' } }))).json();
  eq('the night\'s own page: the song played and what was asked for, no fan', [night.ok, night.played.length, night.played[0].title, /ann|bob/.test(JSON.stringify(night))], [true, 1, 'Valerie', false]);
  const feed = await (await moneymodel(new Request('https://myset.vip/moneymodel/live.json', { headers: { cookie, accept: 'application/json' } }))).json();
  eq('the model\'s feed: live, one show, the block and the totals', [feed.ok, feed.live, feed.act.shows, feed.act.people, typeof feed.builtAt], [true, true, 1, 3, 'number']);
  ok('the feed carries none of the meters', ['pollsPerPhoneHour', 'creditsPerShow', 'deploys', 'shipping', 'traffic', 'meters'].every((k) => !(k in feed.act)));
  const again = await (await moneymodel(new Request('https://myset.vip/moneymodel/shows/refresh', { method: 'POST', headers: { cookie, accept: 'application/json' } }))).json();
  ok('a refresh straight after a fold says so instead of walking the store again', again.ok && again.skipped && /ago/.test(again.why), again);
  const old = await moneymodel(new Request('https://myset.vip/moneymodel', { headers: { cookie: `fm=stale; fm=${stamp(CODE())}` } }));
  eq('two fm cookies (an old path and the new): any matching one opens the door', old.status, 200);
  const signin = await moneymodel(new Request('https://myset.vip/moneymodel/shows', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `code=${CODE()}` }));
  eq('the code typed on the dashboard lands on the dashboard, with a cookie scoped to the model', [signin.status, signin.headers.get('location'), /Path=\/moneymodel;/.test(signin.headers.get('set-cookie') || '')], [303, '/moneymodel/shows', true]);
}

console.log('\nTHE BELL  idle rings are cheap; a mark or a stale walk makes it fold');
{
  const ring = async () => (await cron(new Request('https://x/', { method: 'POST', body: '{}' }))).text();
  await casDoc('registersync', () => ({}), (d) => { d.lastRunAt = Date.now() - 6 * 60e3; d.lastFullAt = Date.now(); return true; });
  const ops = __opsStart(); const idle = await ring(); const o = __opsStop();
  eq('nothing dirty, a fresh full walk: idle, two reads', [idle, o.filter((l) => /^get /.test(l)).length], ['idle', 2]);
  await casDoc('gigsched', () => ({}), (d) => { d.regdirty = { nobody: Date.now() }; return true; });
  await casDoc('registersync', () => ({}), (d) => { d.lastRunAt = Date.now() - 6 * 60e3; return true; });
  eq('a mark makes it fold', await ring(), 'ok');
  eq('…and a ring inside the gap is a no-op', await ring(), 'too soon');
  await casDoc('registersync', () => ({}), (d) => { d.lastRunAt = Date.now() - 6 * 60e3; d.runningSince = Date.now(); return true; });
  eq('a fold in progress makes the ring wait', await ring(), 'busy');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
