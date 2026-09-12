/* WHO SAYS THEY ARE COMING  (_rsvp.mjs, rsvp.mjs, the `rsvp` field on every feed row)

   Pins, in order:
     · a fan can say they are coming to a listed night with nothing but the vote
       page's anonymous id — no account, no sign-in
     · the reply is the fan's state and the night's count; saying it twice counts
       once; taking it back takes one off
     · the artist's diary AND the city feed carry the count on the row, from the
       same document, in the same hop as the events
     · a venue's own event counts under the venue, separately from any artist
     · a night that does not exist, or has finished, is a 404 — never a count on
       a gig nobody listed
     · the stored document holds a HASH of the fan, never the id itself, and lives
       under a computable key (INVARIANT 1)
     · nights more than three days gone are pruned on write
     · a night holds at most MAX_FANS; past that 'on' is a no-op that still answers */
process.env.ADMIN_CODE = 'devlocal';

const admin     = (await import('../netlify/functions/admin.mjs')).default;
const venueAdmin = (await import('../netlify/functions/venueadmin.mjs')).default;
const rsvpFn    = (await import('../netlify/functions/rsvp.mjs')).default;
const eventsFn  = (await import('../netlify/functions/events.mjs')).default;
const fanFn     = (await import('../netlify/functions/fan.mjs')).default;
const R = await import('../netlify/functions/_rsvp.mjs');
const { casDoc, sha } = await import('../netlify/functions/_lib.mjs');
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const V = await import('../netlify/functions/_venues.mjs');
const { __dump } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const rsvp = (q, body) => hit(rsvpFn, 'https://x/api/rsvp' + q, body);

/* Three days out, so the night is inside the city feed's seven-day window and the
   diary alike; ten days back, so the other has finished whatever the hour. */
const SOON = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10);
const GONE = new Date(Date.now() - 10 * 86400e3).toISOString().slice(0, 10);

console.log('\nSETUP — an artist with one night ahead and one behind, a venue with a quiz');
const A = await createArtist({ email: 'rsvp-artist@example.com', name: 'Rsvp Artist' });
const aid = A.artistId, slug = A.slug;
const tok = await signToken('rsvp-artist@example.com', revOf(await readArtists(), aid));
const gig = (id, date) => hit(admin, 'https://x/api/admin', { action: 'eventSave', event: {
  id, venue: 'The Ugly Duckling', city: 'Koh Phangan', country: 'Thailand',
  tz: 'UTC', date, time: '20:00', endTime: '23:00' } }, tok);
ok('the upcoming gig is saved', (await gig('ahead', SOON)).ok);
ok('the finished gig is saved', (await gig('behind', GONE)).ok);

const ven = await V.createVenue({ email: 'boss@rsvpbar.example', name: 'The Rsvp Bar',
  slug: 'rsvp-bar', city: 'Koh Phangan', country: 'Thailand' });
ok('the venue exists', ven.ok, ven);
const vtok = await V.signVenueToken('boss@rsvpbar.example', V.vRevOf(await V.readVenues(), ven.venueId));
const quiz = await hit(venueAdmin, 'https://x/api/venueadmin', { action: 'eventSave', event: {
  id: 'quiz', title: 'Quiz night', tz: 'UTC', date: SOON, time: '19:00', endTime: '21:00' } }, vtok);
ok('the venue lists its own event', quiz.ok, quiz);

console.log('\nCOMING, SAID TWICE, TAKEN BACK');
const FAN_A = 'fanAlphaZZ01', FAN_B = 'fanBravoZZ02';
const a1 = await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'ahead', date: SOON, on: true });
eq('fan A is coming', [a1.ok, a1.on, a1.n], [true, true, 1]);
eq('the reply is personal, never kept at the edge', a1.status, 200);
const a2 = await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'ahead', date: SOON, on: true });
eq('saying it again counts once', [a2.on, a2.n], [true, 1]);
const b1 = await rsvp(`?a=${slug}`, { fan: FAN_B, eventId: 'ahead', date: SOON, on: true });
eq('fan B makes two', [b1.on, b1.n], [true, 2]);
const a3 = await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'ahead', date: SOON, on: false });
eq('A takes it back: one', [a3.on, a3.n], [false, 1]);
const a4 = await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'ahead', date: SOON, on: false });
eq('taking it back twice is still one', [a4.on, a4.n], [false, 1]);

console.log('\nTHE COUNT RIDES ON EVERY ROW');
{
  const diary = await hit(eventsFn, `https://x/api/events?a=${slug}`);
  const row = (diary.gigs || []).find((g) => g.eventId === 'ahead');
  eq('the diary row says one going', row && row.rsvp, 1);
  const door = await hit(fanFn, `https://x/api/fan?what=events&a=${slug}`);
  eq('and so does the same diary through the one warm door',
    ((door.gigs || []).find((g) => g.eventId === 'ahead') || {}).rsvp, 1);
  const feed = await hit(eventsFn, 'https://x/api/events?country=Thailand&city=Koh%20Phangan');
  const all = (feed.days || []).flatMap((d) => [...d.gigs, ...(d.featured || [])]);
  const mine = all.find((g) => g.eventId === 'ahead' && g.slug === slug);
  eq('the city-feed row says one going', mine && mine.rsvp, 1);
  const q = all.find((g) => g.kind === 'event' && g.eventId === 'quiz');
  eq('a night nobody has answered says zero, not nothing', q && q.rsvp, 0);
}

console.log('\nA VENUE’S OWN EVENT COUNTS UNDER THE VENUE');
{
  const v1 = await rsvp('?v=rsvp-bar', { fan: FAN_A, eventId: 'quiz', date: SOON, on: true });
  eq('fan A is coming to the quiz', [v1.ok, v1.on, v1.n], [true, true, 1]);
  const feed = await hit(eventsFn, 'https://x/api/events?country=Thailand&city=Koh%20Phangan');
  const all = (feed.days || []).flatMap((d) => [...d.gigs, ...(d.featured || [])]);
  eq('the quiz row says one', (all.find((g) => g.eventId === 'quiz') || {}).rsvp, 1);
  eq('and the gig row is untouched', (all.find((g) => g.eventId === 'ahead') || {}).rsvp, 1);
  eq('its document is the venue’s, not an artist’s',
    Object.keys((await R.readRsvp(`v_${ven.venueId}`)).occ), [R.occKey('quiz', SOON)]);
  eq('an unknown venue is a 404',
    (await rsvp('?v=no-such-bar', { fan: FAN_A, eventId: 'quiz', date: SOON, on: true })).status, 404);
}

console.log('\nNEVER A COUNT ON A NIGHT NOBODY LISTED');
eq('an unknown event id is a 404',
  (await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'nope', date: SOON, on: true })).status, 404);
eq('a finished night is a 404',
  (await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'behind', date: GONE, on: true })).status, 404);
eq('a real event on a date it does not play is a 404',
  (await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'ahead', date: GONE, on: true })).status, 404);
eq('an unknown artist is a 404',
  (await rsvp('?a=nobody-here', { fan: FAN_A, eventId: 'ahead', date: SOON, on: true })).status, 404);
eq('a bad fan id is a 400',
  (await rsvp(`?a=${slug}`, { fan: 'ab', eventId: 'ahead', date: SOON, on: true })).status, 400);
eq('`on` must be a boolean',
  (await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'ahead', date: SOON, on: 'yes' })).status, 400);
eq('a bad date is a 400',
  (await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'ahead', date: 'tomorrow', on: true })).status, 400);
eq('neither an artist nor a venue is a 400',
  (await rsvp('', { fan: FAN_A, eventId: 'ahead', date: SOON, on: true })).status, 400);
eq('garbage is a 400', (await rsvpFn(new Request('https://x/api/rsvp?a=' + slug,
  { method: 'POST', body: '{not json' }))).status, 400);
eq('GET is a 405', (await rsvp(`?a=${slug}`)).status, 405);

console.log('\nWHAT IS STORED');
{
  const raw = String((__dump().get(`rsvp_${aid}`) || {}).body || '');
  ok('the document lives under rsvp_<artistId>', raw.length > 0);
  ok('and holds no raw fan id', !raw.includes(FAN_A) && !raw.includes(FAN_B), raw);
  ok('only a prefix of the hash', raw.includes(sha(FAN_B).slice(0, 16)) && !raw.includes(sha(FAN_B)));
  const d = await R.readRsvp(aid);
  eq('n is the number of fans', d.occ[R.occKey('ahead', SOON)].n, Object.keys(d.occ[R.occKey('ahead', SOON)].fans).length);
  eq('rsvpCounts is what the feed reads', R.rsvpCounts(d), { [R.occKey('ahead', SOON)]: 1 });
}

console.log('\nOLD NIGHTS ARE PRUNED, AND A NIGHT HAS A CEILING');
{
  const K = `rsvp_${aid}`;
  const FULL = R.occKey('ahead', SOON);
  await casDoc(K, () => ({ v: 1, occ: {} }), (d) => {
    d.occ['ahead|2020-01-01'] = { n: 1, fans: { deadbeefdeadbeef: 1 } };
    const fans = {};
    for (let i = 0; i < R.MAX_FANS; i++) fans['h' + String(i).padStart(15, '0')] = 1;
    d.occ[FULL] = { n: R.MAX_FANS, fans };
    return true;
  });
  const c = await rsvp(`?a=${slug}`, { fan: 'fanCharlieZZ03', eventId: 'ahead', date: SOON, on: true });
  eq('a full night answers the count and does not take the fan', [c.ok, c.on, c.n], [true, false, R.MAX_FANS]);
  const after = await R.readRsvp(aid);
  ok('the night from 2020 is gone', !after.occ['ahead|2020-01-01'], Object.keys(after.occ));
  eq('the full night still has exactly its ceiling', Object.keys(after.occ[FULL].fans).length, R.MAX_FANS);
  const feed = await hit(eventsFn, `https://x/api/events?a=${slug}`);
  eq('and the diary says so', ((feed.gigs || []).find((g) => g.eventId === 'ahead') || {}).rsvp, R.MAX_FANS);
}

console.log('\nNEVER A NIGHT THE DIARY CANNOT SHOW');
{
  /* A weekly rule produces a Tuesday in 2034 as readily as next week's; the first
     review found the write path took any of them, one night per POST, for ever. */
  ok('a weekly residency is saved', (await hit(admin, 'https://x/api/admin', { action: 'eventSave', event: {
    id: 'res', venue: 'The Ugly Duckling', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: SOON, time: '20:00', endTime: '23:00', repeat: { freq: 'weekly' } } }, tok)).ok);
  const week = (n) => new Date(Date.parse(SOON) + n * 7 * 86400e3).toISOString().slice(0, 10);
  const before = Object.keys((await R.readRsvp(aid)).occ).length;
  eq('a night inside the horizon is taken',
    (await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'res', date: week(2), on: true })).n, 1);
  const far = await rsvp(`?a=${slug}`, { fan: FAN_A, eventId: 'res', date: week(30), on: true });
  eq('a night past the diary’s horizon is a 404, as if it were not listed', far.status, 404);
  eq('and adds nothing to the document', Object.keys((await R.readRsvp(aid)).occ).length, before + 1);
}

console.log('\nDELETING THE ACCOUNT DELETES THE HASHES');
{
  /* keysFor() and keysForVenue() are the one list each of what the app writes for
     an owner (INVARIANT 0cy); the first review found rsvp_ missing from both. */
  const { deleteArtist } = await import('../netlify/functions/_account.mjs');
  const { deleteVenue } = await import('../netlify/functions/_venueaccount.mjs');
  ok('the artist is deleted', (await deleteArtist(aid)).ok);
  ok('the venue is deleted', (await deleteVenue(ven.venueId)).ok);
  const left = [...__dump().keys()].filter((k) => k.includes(aid) || k.includes(ven.venueId));
  eq('and no key anywhere still carries either id', left.join(','), '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
