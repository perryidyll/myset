/* A VENUE'S PHONE HEARS IT  (decision 0124: pushKey / pushOn / pushOff on
   /api/venueadmin, _push.mjs under the owner id `v_<vid>`, tellVenue in _pitch.mjs)

   Pins, in order:
     · any venue seat may switch alerts on for its own phone; a sample may not
     · `mine` is this venue's word about THIS phone, not the browser's
     · a new ask pushes every venue seat's phone, opening What's on; asking again does not
     · the artist writing back in the conversation pushes too, by the artist's name
     · a venue merch order reaches the venue's phones
     · an owner-only alert reaches the owner alone
     · a removed seat is dropped at the next alert; a sign-out ends that phone's alerts
     · the artist's own phones and the venue's never cross */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
import { createECDH, randomBytes } from 'node:crypto';

const PUSH = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (String(url).startsWith('https://api.resend.com/')) return Promise.resolve(new Response('{}', { status: 202 }));
  if (String(url).startsWith('https://push.example/')) { PUSH.push(String(url).split('/').pop()); return Promise.resolve(new Response('', { status: 201 })); }
  return nativeFetch(url, opts);
};

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const vadmin = (await import('../netlify/functions/venueadmin.mjs')).default;
const vauth  = (await import('../netlify/functions/venueauth.mjs')).default;
const V      = await import('../netlify/functions/_venues.mjs');
const { readSubs, notify, generateVapidKeys } = await import('../netlify/functions/_push.mjs');
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { newSid, addSession } = await import('../netlify/functions/_session.mjs');
const { tellOrder } = await import('../netlify/functions/_ordernote.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json', 'x-nf-client-connection-ip': '10.0.0.1' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const b64u = (b) => Buffer.from(b).toString('base64url');
const phone = createECDH('prime256v1'); phone.generateKeys();
const sub = (name) => ({ endpoint: 'https://push.example/' + name, keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(randomBytes(16)) } });
const heard = async (fn) => { PUSH.length = 0; await fn(); return PUSH.slice().sort(); };

const keys = generateVapidKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;

console.log('\nSETUP  a venue with an owner and a barman, and an artist');
const ven = await V.createVenue({ email: 'boss@thelamp.example', name: 'The Lamp', slug: 'the-lamp', city: 'Haad Rin', country: 'Thailand' });
const vid = ven.venueId, owner = 'v_' + vid;
await V.mutateVenues((r) => { r.byEmail['bar@thelamp.example'] = { venueId: vid, role: 'crew' }; return true; });
const vSignIn = async (email) => {
  const sid = newSid();
  await addSession(owner, { sid, email, label: 'iPhone · Safari', at: Date.now() });
  return V.signVenueToken(email, V.vRevOf(await V.readVenues(), vid), sid);
};
const TB = await vSignIn('boss@thelamp.example');
const TX = await vSignIn('bar@thelamp.example');
const VA = (body, t) => hit(vadmin, 'https://x/api/venueadmin', body, t);
const art = await createArtist({ email: 'juno@example.com', name: 'Juno Reed' });
const aid = art.artistId;
const TA = await signToken('juno@example.com', revOf(await readArtists(), aid), newSid());
const S = (body) => hit(admin, 'https://x/api/admin', body, TA);
ok('a venue, two seats, an artist', !!(ven.ok && TB && TX && TA));

console.log('\nSWITCHING IT ON');
let r = await VA({ action: 'pushKey', endpoint: 'https://push.example/boss' }, TB);
ok('the key is served, and this phone is not on yet', r.ok && r.key === keys.publicKey && r.mine === false && r.devices === 0, r);
let ping = await heard(async () => { r = await VA({ action: 'pushOn', sub: sub('boss') }, TB); });
ok('the owner switches on, and only that phone gets the "Alerts are on" ping', r.ok && r.mine === true && r.devices === 1 && ping.join() === 'boss', { r, ping });
r = await VA({ action: 'pushOn', sub: sub('bar') }, TX);
ok('a barman may switch on their own phone', r.ok && r.mine === true && r.devices === 1, r);
eq('both phones are kept under the venue, each with its seat',
   (await readSubs(owner)).subs.map((s) => s.email).sort(), ['bar@thelamp.example', 'boss@thelamp.example']);
r = await VA({ action: 'pushOn', sub: { endpoint: 'http://push.example/plain', keys: {} } }, TB);
ok('a malformed subscription is refused', r.status === 400 && !r.ok, r);
// the artist's own phone, so we can see the two never cross
await S({ action: 'pushOn', sub: sub('artist') });
ok('the artist has their own phone on', (await readSubs(aid)).subs.length === 1);

console.log('\nAN ARTIST ASKS TO PLAY');
let got = await heard(() => S({ action: 'pitchSend', venue: 'the-lamp', message: 'Folk duo, free Fridays.' }));
eq('a new ask reaches both venue phones, and not the artist’s', got, ['bar', 'boss']);
got = await heard(() => S({ action: 'pitchSend', venue: 'the-lamp', message: 'Folk duo, free Fridays and Sundays.' }));
eq('asking again is not a second alert', got, []);

console.log('\nTHE ARTIST WRITES BACK');
const vp = await VA({ action: 'pitchList' }, TB);
const pid = vp.pitches[0].id;
await VA({ action: 'pitchReply', id: pid, text: 'Come in Tuesday for a chat?' }, TB);
const th = (await S({ action: 'msgList' })).threads.find((x) => x.kind === 'pitch');
got = await heard(() => S({ action: 'msgReply', t: th.id, text: 'Tuesday works — 5pm?' }));
ok('the artist’s reply reaches the venue phones (and the venue’s reply reached the artist’s)', got.join() === 'bar,boss', got);
got = await heard(() => S({ action: 'msgReply', t: th.id, text: 'Bringing the guitar.' }));
eq('each reply is an alert, even before the venue opens the first', got, ['bar', 'boss']);

console.log('\nA MERCH ORDER, AND AN OWNER-ONLY ALERT');
got = await heard(() => tellOrder(owner, { title: 'Lamp tee', variant: 'M', qty: 1, cents: 2500, ship: 'pickup', code: 'K7Q' }));
eq('a venue merch order reaches every venue phone', got, ['bar', 'boss']);
got = await heard(() => notify(owner, { title: 'x', body: 'y' }, { owner: true }));
eq('an owner-only alert reaches the owner alone', got, ['boss']);
got = await heard(() => notify(owner, { title: 'x', body: 'y' }));
eq('an alert that names nobody reaches nobody', got, []);

console.log('\nOFF, SIGN-OUT, A REMOVED SEAT');
r = await VA({ action: 'pushKey', endpoint: 'https://push.example/artist' }, TB);
ok('the artist’s phone does not read as on for the venue', r.ok && r.mine === false, r);
r = await VA({ action: 'pushOff', endpoint: 'https://push.example/bar' }, TX);
ok('the barman switches off', r.ok && r.mine === false && r.devices === 0, r);
await VA({ action: 'pushOn', sub: sub('bar') }, TX);
await hit(vauth, 'https://x/api/venueauth', { action: 'signOut' }, TX);
eq('signing out ends that phone’s alerts', (await readSubs(owner)).subs.map((s) => s.email), ['boss@thelamp.example']);
const TX2 = await vSignIn('bar@thelamp.example');
await VA({ action: 'pushOn', sub: sub('bar') }, TX2);
await V.mutateVenues((r) => { delete r.byEmail['bar@thelamp.example']; return true; });
got = await heard(() => tellOrder(owner, { title: 'Lamp tee', qty: 1, cents: 2500, ship: 'pickup', code: 'Z1' }));
ok('a seat no longer on the venue hears nothing, and is dropped', got.join() === 'boss' && (await readSubs(owner)).subs.length === 1, got);
eq('the artist’s phone was never touched', (await readSubs(aid)).subs.map((s) => s.endpoint.split('/').pop()), ['artist']);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
