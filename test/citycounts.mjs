/* THE CITY INDEX CARRIES ITS GIGS  (decision 0174, INVARIANT 0in)

   The front door's picker read forty calendars a city, one after another; a city's
   feed and a venue page read every owner in the city and the whole registry once
   per owner. They run inside the function that serves live rooms. Now the write
   that puts an owner in a city keeps their rules there beside the id, and:

     · the picker is ONE read, and its counts are what reading every calendar says
     · a feed reads the calendars of the owners with something on, and nobody else
     · a venue page reads the artists with a rule at that venue, and nobody else —
       and an artist past the sixtieth in the city is no longer dropped
     · an index written before this still answers, the old way
     · a lost write is healed by the bell, never by a page, and a save that lands
       while the heal is reading is never overwritten by it */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const events = (await import('../netlify/functions/events.mjs')).default;
const venueFn = (await import('../netlify/functions/venue.mjs')).default;
const admin = (await import('../netlify/functions/admin.mjs')).default;
const citycron = (await import('../netlify/functions/citycron.mjs')).default;
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { createVenue } = await import('../netlify/functions/_venues.mjs');
const { readEvents, mutateEvents, normEvent, reindexCities, readCityIndex, occurrencesFor, healCityIndex } = await import('../netlify/functions/_events.mjs');
const { casDoc, readDoc } = await import('../netlify/functions/_lib.mjs');
const { localDate, addDays } = await import('../netlify/functions/_time.mjs');
const { __opsStart, __opsStop, __failWrites, __slowReads } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail).slice(0, 700)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const get = async (h, url) => { const r = await h(new Request(url)); return { status: r.status, ...(await r.json()) }; };
const day = (n) => addDays(localDate(Date.now(), 'Asia/Bangkok'), n);
const TH = 'Thailand', A = 'Koh Phangan', B = 'Chaweng', C = 'Haad Rin';

let n = 0;
async function artist(name, gigs) {
  const email = `a${++n}@city.example`;
  const r = await createArtist({ email, name: name || `Act ${n}` });
  const token = await signToken(email, revOf(await readArtists(), r.artistId));
  for (const ev of gigs) {
    const res = await admin(new Request('https://x/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'eventSave', event: { tz: 'Asia/Bangkok', time: '20:00', ...ev } }) }));
    if (res.status !== 200) throw new Error('eventSave ' + res.status + ' ' + (await res.text()));
  }
  return r.artistId;
}
const weekly = (city, venue, from = 1) => ({ city, country: TH, venue, date: day(from), repeat: { freq: 'weekly' } });
const once = (city, venue, d) => ({ city, country: TH, venue, date: day(d) });

/* The old way, as an oracle: every calendar in the city read, that city's nights counted. */
async function oracle(country, city, days = 7) {
  const idx = await readCityIndex();
  const now = Date.now();
  let count = 0; const nights = [];
  for (const id of ((idx.countries[country] || {})[city] || [])) {
    const ev = await readEvents(id);
    const tz = ((ev.list || []).find((x) => x.tz) || {}).tz || 'UTC';
    const from = localDate(now, tz);
    const os = occurrencesFor(ev, addDays(from, -1), addDays(from, days)).filter((o) => o.endsAt > now && o.city === city && o.country === country);
    count += days === 7 ? os.length : 0;
    nights.push(...os.map((o) => `${o.eventId}@${o.date}`));
  }
  return { count, nights: nights.sort() };
}
const reads = (ops) => ops.filter((o) => o.startsWith('get ')).map((o) => o.slice(4));

console.log('\nA CITY OF ARTISTS, MOST OF THEM NOT ON THIS WEEK');
const later = [];
for (let i = 0; i < 20; i++) later.push(await artist(`Later ${i}`, [once(A, 'The Pier', 20)]));       // three weeks out
const onNow = [];
for (let i = 0; i < 4; i++) onNow.push(await artist(`Weekly ${i}`, [weekly(A, 'Cafe Del Sol', 1 + i)]));
const lamp = [await artist('Lamp One', [weekly(A, 'The Lamp', 2)]), await artist('Lamp Two', [weekly(A, 'the lamp ', 3)])];
const both = await artist('Both Towns', [weekly(A, 'Cafe Del Sol', 4), weekly(B, 'Ark Bar', 5)]);
const v = await createVenue({ email: 'owner@thelamp.example', name: 'The Lamp', city: A, country: TH });
const vid = v.venueId;
await mutateEvents(`v_${vid}`, (d) => { d.list.push(normEvent({ id: 'quiz', title: 'Quiz night', venue: 'The Lamp', city: A, country: TH, tz: 'Asia/Bangkok', date: day(1), time: '19:00', repeat: { freq: 'weekly' } })); return true; });
await reindexCities(`v_${vid}`, await readEvents(`v_${vid}`));
const idx = await readCityIndex();
eq('everyone is in the city', idx.countries[TH][A].length, 20 + 4 + 2 + 1 + 1);
ok('and the index keeps each one\'s rules there, venue and all', idx.gigs[TH][A][lamp[0]].r[0].venue === 'The Lamp' && idx.gigs[TH][A][later[0]].r[0].date === day(20) && idx.gigs[TH][B][both].r.length === 1);
ok('only the rules in that city: Both Towns has one in each', idx.gigs[TH][A][both].r.length === 1 && idx.gigs[TH][A][both].r[0].venue === 'Cafe Del Sol');

console.log('\nTHE FRONT DOOR IS ONE READ');
{
  __opsStart();
  const p = await get(events, 'https://x/api/events?places=1');
  const r = reads(__opsStop());
  eq('the picker read one document', r, ['cityindex']);
  const th = p.countries.find((c) => c.country === TH);
  const a = th.cities.find((c) => c.city === A), b = th.cities.find((c) => c.city === B);
  eq('and its counts are what reading every calendar says', [a.gigs, b.gigs], [(await oracle(TH, A)).count, (await oracle(TH, B)).count]);
  eq('with the artists and venues counted as before', [a.artists, a.venues], [27, 1]);
  ok('Both Towns counts once in each city, not twice in both', b.gigs === 1, b);
}

console.log('\nA CITY\'S FEED READS ONLY WHO IS ON');
{
  __opsStart();
  const f = await get(events, `https://x/api/events?country=${encodeURIComponent(TH)}&city=${encodeURIComponent(A)}`);
  const r = reads(__opsStop());
  const evReads = r.filter((k) => k.startsWith('ev_'));
  eq('the nights are the ones every calendar has', f.days.flatMap((d) => [...d.gigs, ...(d.featured || [])]).map((g) => `${g.eventId}@${g.date}`).sort(), (await oracle(TH, A, 7)).nights);
  eq('and no calendar of an artist with nothing on this week was read', later.filter((aid) => evReads.includes(`ev_${aid}`)), []);
  eq('the registry was read once, not once an owner', r.filter((k) => k === 'artists').length, 1);
  ok(`${evReads.length} calendars read of ${idx.countries[TH][A].length} in the city`, evReads.length === 4 + 2 + 1 + 1, evReads);
  const four = await get(events, `https://x/api/events?country=${encodeURIComponent(TH)}&city=${encodeURIComponent(A)}&days=28`);
  ok('a wider window reaches the nights three weeks out', four.days.some((d) => d.gigs.some((g) => g.venue === 'The Pier')));
}

console.log('\nA VENUE PAGE READS ONLY THE ARTISTS WHO NAME IT');
{
  __opsStart();
  const p = await get(venueFn, `https://x/api/venue?v=${v.slug}`);
  const r = reads(__opsStop());
  const evReads = r.filter((k) => k.startsWith('ev_') && k !== `ev_v_${vid}`);
  eq('the two artists at The Lamp, and nobody else', evReads.sort(), lamp.map((aid) => `ev_${aid}`).sort());
  ok('both are listed, the quiz night too', lamp.every((aid) => p.gigs.some((g) => g.kind === 'gig' && g.slug === aid)) && p.gigs.some((g) => g.kind === 'event'), p.gigs.map((g) => g.slug || g.title));
  // the sixty-first artist in a city used to be dropped without a word
  for (let i = 0; i < 60; i++) await artist(`Crowd ${i}`, [weekly(C, 'Somewhere Else', 1)]);
  const last = await artist('The Sixty-First', [weekly(C, 'The Back Room', 2)]);
  const room = await createVenue({ email: 'owner@backroom.example', name: 'The Back Room', city: C, country: TH });
  const q = await get(venueFn, `https://x/api/venue?v=${room.slug}`);
  ok('the sixty-first artist in a city is on the page of the venue it names', q.gigs.some((g) => g.slug === last), q.gigs.length);
}

console.log('\nAN INDEX WRITTEN BEFORE THIS STILL ANSWERS');
{
  const saved = (await readDoc('cityindex', null)).data;
  await casDoc('cityindex', () => ({}), (d) => { delete d.gigs; return true; });
  const p = await get(events, 'https://x/api/events?places=1');
  const a = p.countries.find((c) => c.country === TH).cities.find((c) => c.city === A);
  eq('with no rules on the index, the picker reads the calendars and counts the same', a.gigs, (await oracle(TH, A)).count);
  const f = await get(events, `https://x/api/events?country=${encodeURIComponent(TH)}&city=${encodeURIComponent(A)}`);
  eq('and the feed shows the same nights', f.days.flatMap((d) => [...d.gigs, ...(d.featured || [])]).map((g) => `${g.eventId}@${g.date}`).sort(), (await oracle(TH, A, 7)).nights);
  const q = await get(venueFn, `https://x/api/venue?v=${v.slug}`);
  ok('and the venue page lists The Lamp\'s artists', lamp.every((aid) => q.gigs.some((g) => g.slug === aid)));
  /* the heal puts the rules back, and nothing a page does writes the index */
  __opsStart();
  await get(events, 'https://x/api/events?places=1');
  await get(events, `https://x/api/events?country=${encodeURIComponent(TH)}&city=${encodeURIComponent(A)}`);
  await get(venueFn, `https://x/api/venue?v=${v.slug}`);
  eq('no page writes anything', __opsStop().filter((o) => o.startsWith('set ')), []);
  process.env.MYSET_CITY_HEAL_BUDGET_MS = '60000';
  await citycron(new Request('https://x/.netlify/functions/citycron', { method: 'POST', body: '{}' }));
  delete process.env.MYSET_CITY_HEAL_BUDGET_MS;
  const healed = await readCityIndex();
  ok('the bell puts every owner\'s rules back', Object.keys(healed.gigs[TH][A]).length === saved.countries[TH][A].length && healed.heal.passAt > 0, healed.heal);
  eq('the same rules a save wrote', JSON.stringify(healed.gigs[TH][A][lamp[0]].r), JSON.stringify(saved.gigs[TH][A][lamp[0]].r));
  ok('and the next ring inside the day is one read and a return', (await healCityIndex()).idle === true);
}

console.log('\nA LOST WRITE LASTS A DAY AT MOST');
{
  __failWrites(/^cityindex$/);
  const lost = await artist('Lost Write', [weekly(A, 'Cafe Del Sol', 1)]);
  __failWrites(null);
  const idx1 = await readCityIndex();
  ok('the save\'s write to the index was lost', !idx1.countries[TH][A].includes(lost));
  const before = (await get(events, 'https://x/api/events?places=1')).countries.find((c) => c.country === TH).cities.find((c) => c.city === A).gigs;
  await casDoc('cityindex', () => ({}), (d) => { d.heal = { cursor: 0, passAt: Date.now() - 21 * 3600e3 }; return true; });
  process.env.MYSET_CITY_HEAL_BUDGET_MS = '60000';
  const r = await healCityIndex();
  delete process.env.MYSET_CITY_HEAL_BUDGET_MS;
  ok('a day on, the heal finds the calendar and puts it back', r.done && r.fixed >= 1 && (await readCityIndex()).countries[TH][A].includes(lost), r);
  const after = (await get(events, 'https://x/api/events?places=1')).countries.find((c) => c.country === TH).cities.find((c) => c.city === A).gigs;
  ok('and the front door counts it', after === before + 1 && after === (await oracle(TH, A)).count, { before, after });
}

console.log('\nAN ACCOUNT ON ITS WAY OUT STAYS OUT');
{
  const { startDeletion } = await import('../netlify/functions/_account.mjs');
  const leaving = onNow[0];
  await startDeletion(leaving, 'x');
  await casDoc('cityindex', () => ({}), (d) => { d.heal = { cursor: 0, passAt: 1 }; return true; });
  process.env.MYSET_CITY_HEAL_BUDGET_MS = '60000';
  await healCityIndex();
  delete process.env.MYSET_CITY_HEAL_BUDGET_MS;
  ok('the heal does not put a deleted account\'s gigs back (0dh)', !(await readCityIndex()).countries[TH][A].includes(leaving) && !(await readCityIndex()).gigs[TH][A][leaving]);
}

console.log('\nA SAVE THAT LANDS WHILE THE HEAL IS READING IS NEWER, AND KEPT');
{
  /* First in the heal's order, so its calendar is read in the first batch; the save
     then lands, index and all, before the heal writes. */
  const early = await artist('Aaa Early Bird', [weekly(A, 'Cafe Del Sol', 1)]);
  ok('it sorts first, so the heal reads it first', Object.keys((await readArtists()).byId).sort()[0] === early, Object.keys((await readArtists()).byId).sort()[0]);
  await casDoc('cityindex', () => ({}), (d) => { d.heal = { cursor: 0, passAt: 1 }; return true; });
  process.env.MYSET_CITY_HEAL_BUDGET_MS = '60000';
  __slowReads(15);
  const heal = healCityIndex();
  await new Promise((r) => setTimeout(r, 40));
  const email = Object.entries((await readArtists()).byEmail).find(([, l]) => l.artistId === early)[0];
  const token = await signToken(email, revOf(await readArtists(), early));
  await admin(new Request('https://x/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ action: 'eventSave', event: { tz: 'Asia/Bangkok', time: '21:00', city: A, country: TH, venue: 'The Late Bar', date: day(2) } }) }));
  const r = await heal;
  __slowReads(0);
  delete process.env.MYSET_CITY_HEAL_BUDGET_MS;
  const rules = (await readCityIndex()).gigs[TH][A][early].r;
  ok('the heal left the newer save alone', r.kept >= 1 && rules.some((x) => x.venue === 'The Late Bar'), { r, rules: rules.map((x) => x.venue) });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
