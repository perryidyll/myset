/* A VENUE ANSWERS THE SHOWS ARTISTS LIST AT ITS PLACE (decision 0128), AND SENDS
   MYSET A SUGGESTION (decision 0127).

   Pins, in order:
     · the Venue Studio lists one row per artist calendar RULE that names the venue,
       waiting for an answer, and the public page shows them as before
     · a recurring show is confirmed only as recurring — without the word it is a
       409 that says so — and then once for every week
     · a confirmed show says so on the public page; one the venue says is not here
       leaves the public page; Undo puts it back
     · an artist turning a confirmed one-off into a weekly show makes it wait again
     · only a show that names this venue can be answered; crew can read, not answer
     · a new listing tells the venue's phones, once
     · a suggestion is kept for the Sheet with who sent it; an empty one is refused,
       and ten a day is the most */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
import { createECDH, randomBytes } from 'node:crypto';
const PUSH = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (String(url).startsWith('https://push.example/')) { PUSH.push(String(url).split('/').pop()); return Promise.resolve(new Response('', { status: 201 })); }
  return nativeFetch(url, opts);
};

const admin = (await import('../netlify/functions/admin.mjs')).default;
const venueAdmin = (await import('../netlify/functions/venueadmin.mjs')).default;
const fanFn = (await import('../netlify/functions/fan.mjs')).default;
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const V = await import('../netlify/functions/_venues.mjs');
const G = await import('../netlify/functions/_gigok.mjs');
const { readSuggestions } = await import('../netlify/functions/_suggest.mjs');

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
const SOON = new Date(Date.now() + 2 * 86400e3).toISOString().slice(0, 10);
const LATER = new Date(Date.now() + 5 * 86400e3).toISOString().slice(0, 10);

console.log('\nSETUP — a venue, and an artist with a weekly show and a one-off there');
const ven = await V.createVenue({ email: 'boss@sandtan.example', name: 'Sand & Tan', slug: 'sandtan-test', city: 'Hua Hin', country: 'Thailand' });
ok('the venue exists', ven.ok, ven);
const { newSid, addSession } = await import('../netlify/functions/_session.mjs');
const vsid = newSid();
await addSession('v_' + ven.venueId, { sid: vsid, email: 'boss@sandtan.example', label: 'iPhone · Safari', at: Date.now() });
const vtok = await V.signVenueToken('boss@sandtan.example', V.vRevOf(await V.readVenues(), ven.venueId), vsid);
const VS = (action, extra = {}, t = vtok) => hit(venueAdmin, 'https://x/api/venueadmin', { action, ...extra }, t);
/* the venue's phone, switched on, so a new listing can be heard (as test/venuepush.mjs) */
const { generateVapidKeys } = await import('../netlify/functions/_push.mjs');
const keys = generateVapidKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey;
const phone = createECDH('prime256v1'); phone.generateKeys();
const b64u = (b) => Buffer.from(b).toString('base64url');
ok('the venue switches its phone on', (await VS('pushOn', { sub: { endpoint: 'https://push.example/boss', keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(randomBytes(16)) } } })).ok);

const A = await createArtist({ email: 'weekly@example.com', name: 'Sunday Trio' });
const atok = await signToken('weekly@example.com', revOf(await readArtists(), A.artistId));
const save = (event) => hit(admin, 'https://x/api/admin', { action: 'eventSave', event }, atok);
ok('a weekly show at Sand & Tan is saved', (await save({ id: 'sun', venue: 'Sand & Tan', city: 'Hua Hin', country: 'Thailand', tz: 'UTC',
  date: SOON, time: '19:00', endTime: '22:00', repeat: { freq: 'weekly' } })).ok);
ok('a one-off there too', (await save({ id: 'once', venue: 'Sand & Tan', city: 'Hua Hin', country: 'Thailand', tz: 'UTC', date: LATER, time: '20:00', endTime: '23:00' })).ok);
ok('and one somewhere else', (await save({ id: 'else', venue: 'The Other Bar', city: 'Hua Hin', country: 'Thailand', tz: 'UTC', date: SOON, time: '20:00' })).ok);

console.log('\nWAITING FOR AN ANSWER');
let r = await VS('gigList');
const keyOf = (id) => `${A.artistId}:${id}`;
eq('one row per rule that names this venue', r.gigs.map((g) => g.key).sort(), [keyOf('once'), keyOf('sun')].sort());
eq('each waiting, the weekly one saying it repeats', r.gigs.map((g) => [g.key.split(':')[1], g.st, g.repeat]).sort(), [['once', '', ''], ['sun', '', 'weekly']]);
const page = async () => (await hit(fanFn, `https://x/api/fan?what=venue&v=${ven.slug}`)).gigs.filter((g) => g.kind === 'gig');
let pg = await page();
ok('the public page shows them as before, none confirmed', pg.length >= 2 && pg.every((g) => g.confirmed === false), pg.map((g) => [g.eventId, g.confirmed]));

console.log('\nA RECURRING SHOW IS CONFIRMED AS RECURRING, ONCE');
r = await VS('gigSet', { key: keyOf('sun'), st: 'ok' });
eq('without saying it repeats: a 409 that says so', [r.status, r.recurring], [409, true]);
r = await VS('gigSet', { key: keyOf('sun'), st: 'ok', recurring: true });
ok('with it: confirmed', r.ok && r.gigs.find((g) => g.key === keyOf('sun')).st === 'ok', r);
pg = await page();
ok('every week of it says Confirmed on the page', pg.filter((g) => g.eventId === 'sun').every((g) => g.confirmed) && pg.filter((g) => g.eventId === 'sun').length >= 2, pg.map((g) => [g.eventId, g.date, g.confirmed]));

console.log('\nNOT HERE, AND UNDO');
r = await VS('gigSet', { key: keyOf('once'), st: 'no' });
ok('the one-off: not at our place', r.ok && r.gigs.find((g) => g.key === keyOf('once')).st === 'no', r);
ok('it leaves the public page', !(await page()).some((g) => g.eventId === 'once'));
ok('Undo puts it back, waiting', (await VS('gigSet', { key: keyOf('once'), st: '' })).ok && (await page()).some((g) => g.eventId === 'once'));
ok('a one-off confirms without the recurring word', (await VS('gigSet', { key: keyOf('once'), st: 'ok' })).ok);

console.log('\nCHANGED BY THE ARTIST');
await save({ id: 'once', venue: 'Sand & Tan', city: 'Hua Hin', country: 'Thailand', tz: 'UTC', date: LATER, time: '20:00', endTime: '23:00', repeat: { freq: 'weekly' } });
r = await VS('gigList');
eq('a confirmed one-off turned weekly waits again', r.gigs.find((g) => g.key === keyOf('once')).st, '');

console.log('\nONLY WHAT NAMES THIS VENUE, ONLY BY WHO MAY');
eq('a show at another venue cannot be answered here', (await VS('gigSet', { key: keyOf('else'), st: 'no' })).status, 404);
eq('nor a key that is no key', (await VS('gigSet', { key: '<x>', st: 'no' })).status, 404);
eq('an answer that is not one is refused', (await VS('gigSet', { key: keyOf('sun'), st: 'maybe' })).status, 400);
const stranger = await V.createVenue({ email: 'x@other.example', name: 'Elsewhere', slug: 'elsewhere-test', city: 'Hua Hin', country: 'Thailand' });
const stok = await V.signVenueToken('x@other.example', V.vRevOf(await V.readVenues(), stranger.venueId));
eq('another venue sees none of them', (await VS('gigList', {}, stok)).gigs.length, 0);
eq('the key checker keeps the id alphabet', [G.validGigKey('sunday-trio:g_ab-1'), G.validGigKey('a:b c')], [true, false]);

console.log('\nA NEW LISTING TELLS THE VENUE');
PUSH.length = 0;
await save({ id: 'fri', venue: 'Sand & Tan', city: 'Hua Hin', country: 'Thailand', tz: 'UTC', date: LATER, time: '18:00' });
eq('its phone hears a new show listed there', PUSH, ['boss']);
PUSH.length = 0;
await save({ id: 'fri', venue: 'Sand & Tan', city: 'Hua Hin', country: 'Thailand', tz: 'UTC', date: LATER, time: '19:00' });
eq('an edit of the same show is not news', PUSH, []);
PUSH.length = 0;
await save({ id: 'fri2', venue: 'The Other Bar', city: 'Hua Hin', country: 'Thailand', tz: 'UTC', date: LATER, time: '19:00' });
eq('a show at another place says nothing here', PUSH, []);

console.log('\nSUGGESTIONS & FEEDBACK (decision 0127)');
eq('an empty one is refused', (await VS('suggest', { text: '  ' })).status, 400);
ok('one is sent', (await VS('suggest', { text: 'Let us pin a show to the top' })).ok);
const got = (await readSuggestions()).pop();
eq('kept with who sent it and their plan', [got.from, got.id, got.name, got.plan, got.text], ['venue', ven.venueId, 'Sand & Tan', 'free', 'Let us pin a show to the top']);
for (let i = 0; i < 9; i++) await VS('suggest', { text: 'more ' + i });
eq('ten a day is the most', (await VS('suggest', { text: 'one too many' })).status, 429);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
