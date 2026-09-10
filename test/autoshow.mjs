/* SHOWS THAT START AND END THEMSELVES  (_auto.mjs, autocron.mjs, _lifecycle.mjs)

   Perry's rule, 2026-09-04: a gig on the calendar starts its show at the gig's
   start time if the artist hasn't already, and ends it three hours after the
   gig's scheduled end if the artist hasn't already. This suite pins:
     · nothing happens before the gig, and a start lands once it begins
     · the same gig is never started twice, and a night the artist ended stays ended
     · the free cap refuses a scheduled start with the same words as a tap, and the
       refusal is not retried every two minutes
     · the end waits for the grace, waits for a song still playing, then archives
     · the index is maintained by the calendar actions and read by the cron
     · venue-owned events never become shows
     · what it all costs, against the fake store */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const cron   = await import('../netlify/functions/autocron.mjs');
const { autoTick, sweep, sweepIdle, readSched, currentOccurrence, nextWindow, END_GRACE_MS, IDLE_MS, SHOW_IDLE_MS, SCHED }
  = await import('../netlify/functions/_auto.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { PLANS } = await import('../netlify/functions/_plan.mjs');
const { getShow, mutateShow, casDoc } = await import('../netlify/functions/_lib.mjs');
const { readHistIndex } = await import('../netlify/functions/_history.mjs');
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const AS = (token, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);
const count = async (fn) => {
  __opsStart(); await fn(); const log = __opsStop();
  return { reads: log.filter((l) => l.startsWith('get')).length,
           writes: log.filter((l) => l.startsWith('set')).length,
           globals: log.filter((l) => / (artists|promos|flags|cityindex|acctindex|idqueue|sheetsync|gigsched)$/.test(l)).length };
};
const under = (name, got, ceiling) => ok(`${name} — ${got} (ceiling ${ceiling})`, got <= ceiling, { got, ceiling });

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const hm = (ms) => { const d = new Date(ms); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
const H = 3600e3;
/* A fixed clock, on the hour, two days out, so the calendar maths is exact and a
   real midnight cannot walk under the test. tz is UTC on purpose. */
const T0 = Math.floor((Date.now() + 2 * 86400000) / H) * H;      // gig start
const T1 = T0 + 2 * H;                                            // gig end

console.log('\nSETUP  an artist with one gig on the calendar');
const mia = await createArtist({ email: 'mia@example.com', name: 'Mia Song', slug: 'mia-song' });
const TM = await signToken('mia@example.com', revOf(await readArtists(), mia.artistId));
await mutateArtists((r) => { r.byId[mia.artistId].plan = 'plus'; return true; });   // no cap for the first half
ok('she can add a song', (await AS(TM, 'addSong', { title: 'Valerie', artist: 'Amy Winehouse' })).ok);
const saved = await AS(TM, 'eventSave', { event: { id: 'gmia', venue: 'The Corner', city: 'Koh Phangan', country: 'Thailand',
  tz: 'UTC', date: ymd(T0), time: hm(T0), endTime: hm(T1) } });
ok('and a gig', saved.ok, saved);

console.log('\nTHE INDEX  the calendar keeps it, the cron reads it');
let sched = await readSched();
const entry = sched.byArtist[mia.artistId];
ok('saving a gig indexes its window', !!entry, sched);
eq('with the right start', entry && entry.s, T0);
eq('and the right end', entry && entry.e, T1);
const w = nextWindow({ list: [] }, T0);
eq('an empty calendar has no window', w, null);

console.log('\nBEFORE THE GIG  nothing happens');
let r = await autoTick(mia.artistId, { now: T0 - 60e3 });
eq('a minute before: nothing', r.did, null);
eq('and the show is not live', (await getShow(mia.artistId)).status, 'pre');
const idle = await sweep({ now: T0 - 60e3 });
eq('the cron checks nobody', idle.checked, 0);

console.log('\nAT THE GIG  the show starts itself');
r = await autoTick(mia.artistId, { now: T0 + 60e3 });
eq('one minute in: it starts', r.did, 'start');
let sh = await getShow(mia.artistId);
eq('the show is live', sh.status, 'live');
eq('started by the schedule', sh.startedBy, 'schedule');
ok('with a fresh showId', /^\d{4}-\d{2}-\d{2}-\d{4}-/.test(sh.showId || ''), sh.showId);
eq('and it counted as a gig', sh.gigCount, 1);
ok('the Studio is told who started it', (await hit(stageFn, 'https://x/api/stage', undefined, TM)).show.startedBy === 'schedule');

r = await autoTick(mia.artistId, { now: T0 + 5 * 60e3 });
eq('a second tick does nothing', r.did, null);
eq('and does not count another gig', (await getShow(mia.artistId)).gigCount, 1);

console.log('\nTHE ARTIST ENDS IT EARLY  the schedule does not overrule a person');
ok('she ends the show herself', (await AS(TM, 'status', { status: 'ended' })).ok);
r = await autoTick(mia.artistId, { now: T0 + 30 * 60e3 });
eq('the schedule leaves it ended', r.did, null);
eq('the show stays ended', (await getShow(mia.artistId)).status, 'ended');
ok('and says why', /already started|ended/.test(r.why || ''), r.why);

console.log('\nMANUAL AND IDLE ENDINGS  save a useful title');
{
  const manual = await createArtist({ email: 'manual@example.com', name: 'Manual', slug: 'manual' });
  const TMan = await signToken('manual@example.com', revOf(await readArtists(), manual.artistId));
  ok('a manual show starts', (await AS(TMan, 'status', { status: 'live' })).ok);
  await mutateShow(manual.artistId, (s) => { s.log = [{ songId: 'one', title: 'One', roundVotes: 1, at: Date.now() }]; return true; });
  ok('and ends with its chosen title', (await AS(TMan, 'status', { status: 'ended', title: 'Sunday at The Corner' })).ok);
  eq('the chosen title is in history', ((await readHistIndex(manual.artistId)).shows[0] || {}).title, 'Sunday at The Corner');
  ok('another manual show starts clean', (await AS(TMan, 'newShow')).ok);
  await mutateShow(manual.artistId, (s) => { s.log = [{ songId: 'two', title: 'Two', roundVotes: 1, at: Date.now() }]; return true; });
  ok('it can be discarded when ended', (await AS(TMan, 'status', { status: 'ended', discard: true })).ok);
  eq('discard adds no Past show', (await readHistIndex(manual.artistId)).shows.length, 1);

  const idleArtist = await createArtist({ email: 'idle@example.com', name: 'Idle', slug: 'idle' });
  const TIdle = await signToken('idle@example.com', revOf(await readArtists(), idleArtist.artistId));
  ok('an unscheduled show starts', (await AS(TIdle, 'status', { status: 'live' })).ok);
  await mutateShow(idleArtist.artistId, (s) => { s.log = [{ songId: 'one', title: 'One', roundVotes: 1, at: Date.now() }]; return true; });
  const swept = await sweepIdle({ now: Date.now() + SHOW_IDLE_MS + 1000 });
  eq('three idle hours end it', swept.ended, 1);
  const idleShow = await getShow(idleArtist.artistId);
  eq('the reason is recorded', idleShow.endedBy, 'inactivity');
  const idleHist = await readHistIndex(idleArtist.artistId);
  ok('and it files an automatic dated title', /^Untitled show – \d{4}-\d{2}-\d{2}$/.test((idleHist.shows[0] || {}).title || ''), idleHist.shows[0]);
}

console.log('\nENDING  three hours after the scheduled end, and never mid-song');
ok('she starts it again by hand', (await AS(TM, 'status', { status: 'live' })).ok);
// a phone in the room votes, so this is a night that happened and will be archived
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const sh0 = await getShow(mia.artistId);
const songId0 = (sh0.songs[0] || {}).id;
ok('a fan votes', (await hit(voteFn, 'https://x/api/vote?a=mia-song', { fan: 'phoneA', song: songId0 })).ok);
r = await autoTick(mia.artistId, { now: T1 + END_GRACE_MS - 60e3 });
eq('a minute before the grace runs out: still live', r.did, null);
// a song started just now means the set is still on
await mutateShow(mia.artistId, (s) => { s.nowPlayingAt = T1 + END_GRACE_MS - 10 * 60e3; return true; });
r = await autoTick(mia.artistId, { now: T1 + END_GRACE_MS });
eq('at the grace, with a song ten minutes old: deferred', r.did, null);
eq('and says so', r.why, 'still playing');
await mutateShow(mia.artistId, (s) => { s.nowPlayingAt = T1 + END_GRACE_MS - IDLE_MS - 60e3; return true; });
r = await autoTick(mia.artistId, { now: T1 + END_GRACE_MS });
eq('once the set has been quiet: it ends', r.did, 'end');
sh = await getShow(mia.artistId);
eq('the show is ended', sh.status, 'ended');
eq('ended by the schedule', sh.endedBy, 'schedule');
const hist = await readHistIndex(mia.artistId);
ok('and the night is in the history', hist.shows.some((x) => x.showId === sh.showId), hist.shows.map((x) => x.showId));
r = await autoTick(mia.artistId, { now: T1 + END_GRACE_MS + 60e3 });
eq('a later tick does nothing', r.did, null);

console.log('\nA LATER SHOW  a night started after the grace is not the gig’s');
ok('she starts a brand new show later', (await AS(TM, 'newShow')).ok);
/* The lifecycle stamps startedAt from the real clock; this suite runs on a fixed
   one, so the stamp is moved to where a real later show would sit. */
await mutateShow(mia.artistId, (s) => { s.startedAt = T1 + END_GRACE_MS + 10 * 60e3; return true; });
r = await autoTick(mia.artistId, { now: T1 + END_GRACE_MS + 30 * 60e3 });
eq('the schedule does not end it', r.did, null);
ok('she ends it herself', (await AS(TM, 'status', { status: 'ended' })).ok);

console.log('\nTHE FREE CAP  refused with the same words, and not retried all night');
const CAP = PLANS.free.gigs;
const leo = await createArtist({ email: 'leo@example.com', name: 'Leo Cap', slug: 'leo-cap' });
const TL = await signToken('leo@example.com', revOf(await readArtists(), leo.artistId));
ok('he has a song switched on', (await AS(TL, 'addSong', { title: 'Wonderwall', artist: 'Oasis' })).ok);
for (let i = 0; i < CAP; i++) { ok(`show ${i + 1} of ${CAP}`, (await AS(TL, 'newShow')).ok); await AS(TL, 'status', { status: 'ended' }); }
ok('he adds a gig', (await AS(TL, 'eventSave', { event: { id: 'gleo', venue: 'The Corner', city: 'Koh Phangan', country: 'Thailand',
  tz: 'UTC', date: ymd(T0), time: hm(T0), endTime: hm(T1) } })).ok);
const sw = await sweep({ now: T0 + 60e3 });
const leoR = sw.results.find((x) => x.aid === leo.artistId);
ok('the cron tried him', !!leoR, sw);
eq('and was refused', leoR && leoR.refused, true);
ok('with the words a tap gets', /this month/i.test((leoR && leoR.why) || '') && /on the 1st/i.test((leoR && leoR.why) || ''), leoR);
ok('his show is not live', (await getShow(leo.artistId)).status !== 'live', (await getShow(leo.artistId)).status);
sched = await readSched();
eq('the refusal is remembered on his entry', sched.byArtist[leo.artistId].skip, sched.byArtist[leo.artistId].k);
const sw2 = await sweep({ now: T0 + 3 * 60e3 });
ok('so the next tick does not try again', !sw2.results.some((x) => x.aid === leo.artistId), sw2);
await mutateArtists((r) => { r.byId[leo.artistId].plan = 'plus'; return true; });
ok('a cancelled night is un-indexed', (await AS(TL, 'eventSkip', { id: 'gleo', date: ymd(T0), on: true })).ok);
eq('so nothing is due for him', (await readSched()).byArtist[leo.artistId], undefined);

console.log('\nTHE HEAL  a calendar the index never saw is found once a day');
await casDoc(SCHED, () => ({ v: 1, byArtist: {} }), (d) => { delete d.byArtist[mia.artistId]; d.healedAt = 0; return true; });
eq('mia is missing from the index', (await readSched()).byArtist[mia.artistId], undefined);
const { heal } = await import('../netlify/functions/_auto.mjs');
const h = await heal({ now: T0 - 5 * H });
ok('the heal walks the registry', h.looked >= 2 && h.complete, h);
ok('and finds her gig again', !!(await readSched()).byArtist[mia.artistId], (await readSched()).byArtist);
ok('and stamps the pass', (await readSched()).healedAt > 0);

console.log('\nVENUES  a venue’s own events are never shows');
r = await autoTick('v_somebar', { now: T0 });
eq('a venue owner is skipped', r.why, 'venue');

console.log('\nTHE CRON  rings, rate-limits itself, and takes the lock');
eq('it runs every two minutes', cron.config.schedule, '*/2 * * * *');
await casDoc(SCHED, () => ({ v: 1, byArtist: {} }), (d) => { d.lastRunAt = 0; d.runningSince = 0; return true; });
let res = await cron.default(new Request('https://x/.netlify/functions/autocron', { method: 'POST', body: JSON.stringify({ next_run: '2026-09-05T00:02:00Z' }) }));
eq('a ring runs', await res.text(), 'ok');
res = await cron.default(new Request('https://x/.netlify/functions/autocron', { method: 'POST' }));
eq('a ring straight after is too soon', await res.text(), 'too soon');
eq('and the lock is released', (await readSched()).runningSince, 0);

console.log('\nWHAT IT COSTS  (INVARIANT 9d13)');
await casDoc(SCHED, () => ({ v: 1, byArtist: {} }), (d) => { d.lastRunAt = 0; return true; });
const quiet = await count(() => sweep({ now: T0 - 5 * H }));
under('a ring with nothing due, reads', quiet.reads, 1);
eq('and touches exactly one global', quiet.globals, 1);
eq('and writes nothing', quiet.writes, 0);
// a ring that starts one show: her calendar, her show, the lifecycle's own reads
await mutateShow(mia.artistId, (s) => { s.autoKey = null; s.status = 'pre'; return true; });
ok('mia has a second gig', (await AS(TM, 'eventSave', { event: { id: 'gmia2', venue: 'The Corner', city: 'Koh Phangan', country: 'Thailand',
  tz: 'UTC', date: ymd(T0 + 86400000), time: hm(T0), endTime: hm(T1) } })).ok);
const busy = await count(() => sweep({ now: T0 + 86400000 + 60e3 }));
under('a ring that starts one show, reads', busy.reads, 60);
eq('and it did start it', (await getShow(mia.artistId)).status, 'live');

console.log('\nLAST NIGHT’S SHOW MUST NOT SWALLOW TONIGHT');
/* THE BUG PERRY REPORTED as "I'm not seeing all of my past shows". Once a show
   failed to end itself, `autoTick`'s start branch answered a flat "already live"
   for every following gig — so five nights at five venues were appended to one
   show that had started on 30 August, and the Money tab correctly showed one row.
   Nothing was lost by the archive; the nights were never separate. */
{
  const zoe = await createArtist({ email: 'zoe@example.com', name: 'Zoe', slug: 'zoe' });
  const TZ = await signToken('zoe@example.com', revOf(await readArtists(), zoe.artistId));
  await mutateArtists((a2) => { a2.byId[zoe.artistId].plan = 'pro'; a2.byId[zoe.artistId].planUntil = Date.now() + 30 * 86400e3; return true; });
  ok('she has songs', (await AS(TZ, 'addSong', { title: 'Wires', artist: 'Z' })).ok);
  const D1 = T0, D2 = T0 + 86400000;
  ok('two nights on the calendar', (await AS(TZ, 'eventSave', { event: { id: 'gz1', venue: 'Bar One', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: ymd(D1), time: hm(D1), endTime: hm(D1 + 3 * 3600e3) } })).ok);
  ok('and the second', (await AS(TZ, 'eventSave', { event: { id: 'gz2', venue: 'Bar Two', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: ymd(D2), time: hm(D2), endTime: hm(D2 + 3 * 3600e3) } })).ok);
  let z = await autoTick(zoe.artistId, { now: D1 + 60e3 });
  eq('night one starts', z.did, 'start');
  const night1 = (await getShow(zoe.artistId)).showId;
  // a night with something in it, so the archive has something worth filing
  await mutateShow(zoe.artistId, (sh2) => {
    sh2.log = [{ songId: 'wires', title: 'Wires', votes: 4, roundVotes: 6, voters: 5, at: D1 + 120e3 }];
    return true;
  });
  /* Now simulate the failure that started it all: the end never happened, so the
     show is still live when the next night comes round. */
  z = await autoTick(zoe.artistId, { now: D2 + 60e3 });
  eq('THE BUG: night two used to answer "already live" and do nothing', z.did, 'start');
  const night2 = (await getShow(zoe.artistId)).showId;
  ok('so it is a different night, not a continuation', night1 !== night2, { night1, night2 });
  const h = await readHistIndex(zoe.artistId);
  ok('and night one is filed on its own', h.shows.some((x) => x.showId === night1), h.shows.map((x) => x.showId));

  console.log('\nA DEFERRED END IS TRIED AGAIN, NOT FORGOTTEN');
  /* `sweep` re-pointed the artist's entry at their NEXT gig after a "still
     playing" deferral, so tonight was never due again and the show stayed live
     for ever. That is the loop that produced the bug above. */
  await mutateShow(zoe.artistId, (sh2) => { sh2.nowPlayingAt = D2 + 3 * 3600e3 + END_GRACE_MS - 60e3; return true; });
  const before = (await readSched()).byArtist[zoe.artistId];
  await sweep({ now: D2 + 3 * 3600e3 + END_GRACE_MS });
  const after = (await readSched()).byArtist[zoe.artistId];
  eq('the entry still points at tonight, so the next ring tries again', after && after.k, before && before.k);
  eq('and the show is still live, correctly — somebody is playing', (await getShow(zoe.artistId)).status, 'live');
  /* Six hours of a stale nowPlayingAt is not "still playing", it is somebody who
     walked away from the tablet. */
  await sweep({ now: D2 + 3 * 3600e3 + END_GRACE_MS + 7 * 3600e3 });
  eq('but hours later the backstop files it anyway', (await getShow(zoe.artistId)).status, 'ended');
}

console.log('\nTHE HEAL  a night on disk with no row pointing at it');
{
  const { healHistory } = await import('../netlify/functions/_history.mjs');
  const { casDoc: cas, KEY } = await import('../netlify/functions/_lib.mjs');
  const lost = await createArtist({ email: 'lost@example.com', name: 'Lost', slug: 'lost' });
  const aid = lost.artistId;
  // a real night, written the way archiveShow writes one, with no index row
  await cas(KEY.hist(aid, 'n1'), () => ({}), (d) => {
    Object.assign(d, { v: 1, showId: 'n1', artistId: aid, venue: 'The Ugly Duckling', city: 'Koh Phangan',
      startedAt: 1, endedAt: 2, played: [], requested: [],
      stats: { songsPlayed: 9, totalVotes: 40, peakVoters: 12, room: 20, nets: 6, topSong: null },
      money: { gross: 0, unattributed: 3 } });
    return true;
  });
  await cas('histids_' + aid, () => ({ v: 1, ids: [] }), (d) => { d.ids = ['n1']; return true; });
  eq('the Studio cannot see it', (await readHistIndex(aid)).shows.length, 0);
  const heal = await healHistory(aid, { force: true });
  eq('the heal finds it', heal.added, 1);
  const rows = (await readHistIndex(aid)).shows;
  eq('and files it with its real numbers', rows[0] && rows[0].songsPlayed, 9);
  eq('including the money that carried no show tag', rows[0] && rows[0].unattributed, 3);
  eq('running it again adds nothing', (await healHistory(aid, { force: true })).added, 0);
  /* And the heal obeys the same rule the archive does: a 151-second show with no
     song, no vote and nobody in the room is not a night, whenever it happened. */
  await cas(KEY.hist(aid, 'n2'), () => ({}), (d) => {
    Object.assign(d, { v: 1, showId: 'n2', artistId: aid, venue: 'Empty', startedAt: 1, endedAt: 2,
      stats: { songsPlayed: 0, totalVotes: 0, peakVoters: 0, room: 0 }, money: {} });
    return true;
  });
  await cas('histids_' + aid, () => ({ v: 1, ids: [] }), (d) => { d.ids = ['n1', 'n2']; return true; });
  await healHistory(aid, { force: true });
  eq('a night where nothing happened is still not a night', (await readHistIndex(aid)).shows.length, 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
