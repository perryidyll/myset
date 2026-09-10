/* WHERE A NIGHT HAPPENED  (_lifecycle.mjs, _history.mjs, history.mjs)

   `show.venue` is ONE field, typed once in Settings, and every night copies it as
   it is filed. An artist with three residencies therefore ends up with a Money tab
   that names the same venue over and over — Perry's said "The Ugly Duckling Irish
   Pub" for five nights at three different places, all of which were sitting on his
   own calendar the whole time.

   Two halves, both pinned here:
     · starting a show takes the place from the gig that is on now
     · and the nights already filed can be renamed from the same calendar

   The dangerous direction is over-eagerness. A confidently wrong venue is worse
   than an out-of-date one, so most of this file is about what it must NOT rename. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const history = (await import('../netlify/functions/history.mjs')).default;
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { getShow, mutateShow, casDoc, KEY } = await import('../netlify/functions/_lib.mjs');
const { readHistIndex } = await import('../netlify/functions/_history.mjs');

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

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const hm = (ms) => { const d = new Date(ms); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
const H = 3600e3, DAY = 86400000;
const NOW = Date.now();

console.log('\nSETUP  an artist with the wrong venue in Settings and a real calendar');
const jo = await createArtist({ email: 'jo@example.com', name: 'Jo Reed', slug: 'jo-reed' });
const TJ = await signToken('jo@example.com', revOf(await readArtists(), jo.artistId));
await mutateArtists((r) => { r.byId[jo.artistId].plan = 'plus'; return true; });
await mutateShow(jo.artistId, (s) => { s.venue = 'The Ugly Duckling'; s.city = 'Koh Phangan, Thailand'; return true; });
ok('she has a song', (await AS(TJ, 'addSong', { title: 'Valerie', artist: 'Amy Winehouse' })).ok);

/* A weekly residency that started three weeks ago and is running RIGHT NOW: it
   began ten minutes ago and has two hours left. */
const START = NOW - 10 * 60e3;
const ev = await AS(TJ, 'eventSave', { event: {
  id: 'gjo', venue: 'Seaflower Bungalows', city: 'Koh Phangan', country: 'Thailand', tz: 'UTC',
  date: ymd(START - 21 * DAY), time: hm(START), endTime: hm(START + 2 * H),
  repeat: { freq: 'weekly', until: null } } });
ok('and a weekly gig somewhere else entirely', ev.ok, ev);

console.log('\nSTARTING A SHOW TAKES THE PLACE FROM THE CALENDAR');
{
  const r = await AS(TJ, 'newShow');
  ok('the show starts', r.ok, r);
  const sh = await getShow(jo.artistId);
  eq('and it is filed under tonight’s gig, not the old Settings value', sh.venue, 'Seaflower Bungalows');
  eq('with the gig’s city', sh.city, 'Koh Phangan, Thailand');
  ok('and she is TOLD, rather than it happening quietly',
    /Seaflower/.test(r.note || ''), r.note);
}

console.log('\nBUT ONLY WHEN THE CALENDAR ACTUALLY SAYS SO');
{
  /* A fresh manual show has no presumed venue. Settings-era text and a gig more
     than an hour away must not tell the room the artist is already there. */
  const zed = await createArtist({ email: 'zed@example.com', name: 'Zed', slug: 'zed' });
  const TZ = await signToken('zed@example.com', revOf(await readArtists(), zed.artistId));
  await mutateArtists((r) => { r.byId[zed.artistId].plan = 'plus'; return true; });
  await mutateShow(zed.artistId, (s) => { s.venue = 'My Living Room'; return true; });
  await AS(TZ, 'addSong', { title: 'Valerie', artist: 'Amy Winehouse' });
  await AS(TZ, 'newShow');
  eq('an empty calendar leaves a fresh manual show blank', (await getShow(zed.artistId)).venue, '');
}
{
  const far = await createArtist({ email: 'far@example.com', name: 'Far', slug: 'far' });
  const TF = await signToken('far@example.com', revOf(await readArtists(), far.artistId));
  await mutateArtists((r) => { r.byId[far.artistId].plan = 'plus'; return true; });
  await AS(TF, 'addSong', { title: 'Valerie', artist: 'Amy Winehouse' });
  const later=NOW+2*H;
  await AS(TF, 'eventSave', { event: { id:'gfar', venue:'Later Hall', city:'Bangkok', country:'Thailand',
    tz:'UTC', date:ymd(later), time:hm(later), endTime:hm(later+2*H) } });
  await AS(TF, 'newShow');
  eq('a gig two hours away does not label a manual show', (await getShow(far.artistId)).venue, '');
}
{
  /* And a RESUME must not relabel a night that is already under way — the artist
     tapped End by mistake, the night is the same night. */
  await mutateShow(jo.artistId, (s) => { s.venue = 'Hand-typed Tonight'; s.status = 'ended'; return true; });
  await AS(TJ, 'status', { status: 'live' });
  eq('resuming leaves the name alone', (await getShow(jo.artistId)).venue, 'Hand-typed Tonight');
}

console.log('\nTHE NIGHTS ALREADY FILED CAN BE RENAMED FROM THE SAME CALENDAR');
/* Three filed nights, all wearing the one wrong name:
     A  two weeks ago, during the residency        -> renameable
     B  one week ago, during the residency         -> renameable
     C  one week ago but at four in the morning    -> nothing was on, leave it */
const A = START - 14 * DAY, B = START - 7 * DAY, C = START - 7 * DAY - 9 * H;
const NIGHTS = [['n-a', A], ['n-b', B], ['n-c', C]];
for (const [id, at] of NIGHTS) {
  await casDoc(KEY.hist(jo.artistId, id), () => ({}), (d) => {
    Object.assign(d, { showId: id, venue: 'The Ugly Duckling', city: 'Koh Phangan, Thailand',
      startedAt: at, endedAt: at + 2 * H, stats: { songsPlayed: 9, totalVotes: 20, peakVoters: 7, room: 7, nets: 3 },
      money: { gross: 12, unattributed: 0 }, played: [] });
    return true;
  });
}
await casDoc(KEY.histIdx(jo.artistId), () => ({ shows: [] }), (d) => {
  d.shows = NIGHTS.map(([id, at]) => ({ showId: id, venue: 'The Ugly Duckling', city: 'Koh Phangan, Thailand',
    startedAt: at, endedAt: at + 2 * H, songsPlayed: 9, totalVotes: 20, peakVoters: 7, room: 7, nets: 3,
    gross: 12, unattributed: 0 }));
  d.healedAt = Date.now();
  return true;
});

{
  const r = await hit(history, 'https://x/api/history', { action: 'place' }, TJ);
  ok('the repair runs', r.ok, r);
  eq('and renames exactly the two it can prove', r.placed, 2);
  const idx = await readHistIndex(jo.artistId);
  const by = Object.fromEntries((idx.shows || []).map((x) => [x.showId, x.venue]));
  eq('the night during the residency is renamed', by['n-a'], 'Seaflower Bungalows');
  eq('so is the other one', by['n-b'], 'Seaflower Bungalows');
  eq('and a night with no gig under it is LEFT ALONE', by['n-c'], 'The Ugly Duckling');

  /* The row is a summary of the detail document — if only the row moved, opening
     the night would still show the old name. */
  const one = await hit(history, 'https://x/api/history?show=n-a', undefined, TJ);
  eq('the night itself agrees, not just the list', one.show.venue, 'Seaflower Bungalows');

  /* Nothing but the name. This repair touches money and counts in no way at all. */
  eq('the money is untouched', one.show.money.gross, 12);
  eq('and so are the counts', one.show.stats.totalVotes, 20);
}
{
  const again = await hit(history, 'https://x/api/history', { action: 'place' }, TJ);
  eq('running it a second time renames nothing', again.placed, 0);
  ok('and says so without pretending it failed', again.ok);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
