/* REPRO: can a rival steal a paid featured slot by reusing the eventId? */
process.env.ADMIN_CODE = 'devlocal';
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const eventsFn = (await import('../netlify/functions/events.mjs')).default;
const F = await import('../netlify/functions/_featured.mjs');
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
await import('../test/stripe-fake.mjs');

const post = (tok, body) => new Request('https://myset.vip/api/admin', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
  body: JSON.stringify(body) });
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

const KEY = F.cityKey('Thailand', 'Koh Phangan');
const D = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10);
const TODAY = new Date().toISOString().slice(0, 10);

/* ---- artist P pays $10 ---- */
const P = await createArtist({ email: 'paid@example.com', name: 'Paid Artist' });
const ptok = await signToken('paid@example.com', revOf(await readArtists(), P.artistId));
console.log('P saves gig g7x2ab', await j(await admin(post(ptok, { action: 'eventSave', event: {
  id: 'g7x2ab', venue: 'The Ugly Duckling', city: 'Koh Phangan', country: 'Thailand',
  tz: 'UTC', date: D, time: '22:00', durationMin: 120 } }))));

await F.settleFeature(new (await import('stripe')).default('sk'),
  { id: 'cs_paid', payment_status: 'paid', amount_total: 1000, created: 1,
    metadata: { kind: 'feature', artist: P.artistId, eventId: 'g7x2ab', date: D, key: KEY,
                hold: 'hold_paid', city: 'Koh Phangan', country: 'Thailand', venue: 'The Ugly Duckling' } },
  { today: TODAY });

let feed = await j(await eventsFn(new Request('https://myset.vip/api/events?country=Thailand&city=Koh%20Phangan')));
let day = (feed.days || []).find((x) => x.date === D);
console.log('\nBEFORE THE ATTACK');
console.log('  featured:', (day.featured || []).map((g) => `${g.artist} / ${g.eventId} / ${g.time}`));
console.log('  ordinary:', (day.gigs || []).map((g) => `${g.artist} / ${g.eventId} / ${g.time}`));
console.log('  eventId is public in the feed:', JSON.stringify((day.featured || [])[0]?.eventId));

/* ---- rival R reads the public eventId and reuses it ---- */
const R = await createArtist({ email: 'rival@example.com', name: 'Rival Act' });
const rtok = await signToken('rival@example.com', revOf(await readArtists(), R.artistId));
const stolenId = (day.featured || [])[0]?.eventId;
console.log('\nR saves a gig with the SAME id, earlier start:', await j(await admin(post(rtok, { action: 'eventSave', event: {
  id: stolenId, venue: 'Rival Bar', city: 'Koh Phangan', country: 'Thailand',
  tz: 'UTC', date: D, time: '19:00', durationMin: 120 } }))));

feed = await j(await eventsFn(new Request('https://myset.vip/api/events?country=Thailand&city=Koh%20Phangan')));
day = (feed.days || []).find((x) => x.date === D);
console.log('\nAFTER THE ATTACK');
console.log('  featured:', (day.featured || []).map((g) => `${g.artist} / ${g.eventId} / ${g.time} / ${g.venue}`));
console.log('  ordinary:', (day.gigs || []).map((g) => `${g.artist} / ${g.eventId} / ${g.time} / ${g.venue}`));

const feat = (day.featured || [])[0] || {};
console.log('\nRESULT:', feat.artist === 'Rival Act'
  ? '*** STOLEN — the rival is featured and the payer is not ***'
  : `not stolen (featured artist is ${feat.artist})`);

/* ---- can ONE rival account take all three spots? ---- */
console.log('\n=== ALL THREE SPOTS ===');
const D2 = new Date(Date.now() + 4 * 86400e3).toISOString().slice(0, 10);
const payers = [];
for (let i = 0; i < 3; i++) {
  const a = await createArtist({ email: `p${i}@example.com`, name: `Payer ${i}` });
  const t = await signToken(`p${i}@example.com`, revOf(await readArtists(), a.artistId));
  await admin(post(t, { action: 'eventSave', event: {
    id: `paid${i}`, venue: `Venue ${i}`, city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: D2, time: `2${i}:00`, durationMin: 60 } }));
  await F.settleFeature(new (await import('stripe')).default('sk'),
    { id: `cs_p${i}`, payment_status: 'paid', amount_total: 1000, created: 1,
      metadata: { kind: 'feature', artist: a.artistId, eventId: `paid${i}`, date: D2, key: KEY,
                  hold: `hold_p${i}`, city: 'Koh Phangan', country: 'Thailand', venue: `Venue ${i}` } },
    { today: TODAY });
  payers.push(a.artistId);
}
let f2 = await j(await eventsFn(new Request('https://myset.vip/api/events?country=Thailand&city=Koh%20Phangan')));
let d2 = (f2.days || []).find((x) => x.date === D2);
console.log('  paid featured:', (d2.featured || []).map((g) => g.artist));

for (let i = 0; i < 3; i++) {
  await admin(post(rtok, { action: 'eventSave', event: {
    id: `paid${i}`, venue: `Rival Bar ${i}`, city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: D2, time: `1${i}:00`, durationMin: 60 } }));
}
f2 = await j(await eventsFn(new Request('https://myset.vip/api/events?country=Thailand&city=Koh%20Phangan')));
d2 = (f2.days || []).find((x) => x.date === D2);
console.log('  after rival adds 3 gigs reusing the 3 public ids:');
console.log('    featured:', (d2.featured || []).map((g) => `${g.artist}/${g.venue}`));
console.log('    ordinary:', (d2.gigs || []).map((g) => `${g.artist}/${g.venue}`));
