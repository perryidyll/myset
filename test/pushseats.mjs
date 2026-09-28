/* PUSH ALERTS PER SEAT (decision 0114).

   Found by the triage for decision 0105 against the in-memory store: a crew seat's
   `pushOn` answered 200 and the next merch order — the item, the total, the pickup
   code — reached the sound engineer's phone, because an alert went to every device
   on the page. Eight more crew subscriptions then pushed the owner's phone out of
   the eight-device cap. And no sign-out ever ended a device's alerts, so a phone
   handed back, or a seat removed, kept hearing the page.

   Pins, in order: every seat may switch alerts on for its own phone; an alert says
   who hears it — a tab, the owner, every seat, one device — and reaches a seat only
   while that seat can see that tab; an alert that names nobody reaches nobody; no
   seat's devices crowd another's out; a sign-out, a removed seat and "sign out
   everywhere" end the alerts too; and every alert in the code names its audience. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const PUSH = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (String(url).startsWith('https://api.resend.com/')) return Promise.resolve(new Response('{}', { status: 202 }));
  if (String(url).startsWith('https://push.example/')) { PUSH.push(String(url).split('/').pop()); return Promise.resolve(new Response('', { status: 201 })); }
  return nativeFetch(url, opts);
};

const authFn = (await import('../netlify/functions/auth.mjs')).default;
const admin = (await import('../netlify/functions/admin.mjs')).default;
const msgFn = (await import('../netlify/functions/messages.mjs')).default;
const { readSubs, saveSub, notify, generateVapidKeys } = await import('../netlify/functions/_push.mjs');
const { createArtist, readArtists, mutateArtists, signToken, revOf } = await import('../netlify/functions/_auth.mjs');
const { newSid, addSession } = await import('../netlify/functions/_session.mjs');
const { tellOrder } = await import('../netlify/functions/_ordernote.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json', 'x-nf-client-connection-ip': '10.0.0.1' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const S = (body, token) => hit(admin, 'https://x/api/admin', body, token);
const A = (body, token) => hit(authFn, 'https://x/api/auth', body, token);
const b64u = (b) => Buffer.from(b).toString('base64url');
const phone = createECDH('prime256v1'); phone.generateKeys();
const sub = (name) => ({ endpoint: 'https://push.example/' + name, keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(randomBytes(16)) } });
/** Which phones an action reached, by name, in order. */
const heard = async (fn) => { PUSH.length = 0; await fn(); return PUSH.slice().sort(); };
const rows = async () => (await readSubs(aid)).subs.map((s) => s.endpoint.split('/').pop()).sort();

const keys = generateVapidKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;

console.log('\nSETUP  an owner, a band mate and a sound engineer, each signed in on a phone');
const own = await createArtist({ email: 'kit@example.com', name: 'Kit Lane', slug: 'kit-lane' });
const aid = own.artistId;
await mutateArtists((a) => {
  a.byId[aid].plan = 'pro'; a.byId[aid].planUntil = Date.now() + 30 * 86400e3;
  a.byEmail['mate@example.com'] = { artistId: aid, role: 'member' };
  a.byEmail['crew@example.com'] = { artistId: aid, role: 'crew' };
  return true;
});
const reg = await readArtists();
const signIn = async (email, label) => {
  const sid = newSid();
  await addSession(aid, { sid, email, label, at: Date.now() });
  return signToken(email, revOf(reg, aid), sid);
};
const TO = await signIn('kit@example.com', 'iPhone · Safari');
const TM = await signIn('mate@example.com', 'Android · Chrome');
const TC = await signIn('crew@example.com', 'iPad · Safari');
const TC2 = await signIn('crew@example.com', 'Android · Chrome');
ok('three seats on one page', !!(TO && TM && TC && TC2));

console.log('\nTURNING ALERTS ON  every seat, for its own phone');
eq('the owner switches alerts on', (await S({ action: 'pushOn', sub: sub('kit-phone') }, TO)).ok, true);
eq('so does the band mate', (await S({ action: 'pushOn', sub: sub('mate-phone') }, TM)).ok, true);
eq('THE BUG: the sound engineer switching on pings only the sound engineer’s phone, not the owner’s',
   await heard(() => S({ action: 'pushOn', sub: sub('crew-phone') }, TC)), ['crew-phone']);
eq('each seat counts its own devices, not the page’s', [(await S({ action: 'pushKey' }, TO)).devices, (await S({ action: 'pushKey' }, TC)).devices], [1, 1]);
const stored = (await readSubs(aid)).subs.find((s) => s.endpoint.endsWith('/crew-phone')) || {};
eq('a device remembers the address that switched it on', stored.email, 'crew@example.com');
ok('and the sign-in, so signing that phone out can end its alerts', typeof stored.sid === 'string' && stored.sid.length > 0, stored);

console.log('\nWHO HEARS WHAT  the tab the alert is about');
const order = { title: 'Tour tee', qty: 1, cents: 2500, post: 0, code: 'AB12', ship: 'pickup' };
eq('THE BUG: a merch order reaches the owner and the band mate, not the sound engineer (Merch hidden)',
   await heard(() => tellOrder(aid, order)), ['kit-phone', 'mate-phone']);
const booking = { action: 'send', fan: 'fan-booker-0001', name: 'Val at The Room', email: 'val@theroom.example', kind: 'booking',
  text: 'Would love to have you for a Friday in October — what do you charge?' };
eq('a booking request reaches the seats that see Messages',
   await heard(() => hit(msgFn, 'https://x/api/messages?a=kit-lane', booking)), ['kit-phone', 'mate-phone']);
const m = { title: 'Song requested', body: 'Wires' };
eq('a song request reaches every seat: running the show is everyone’s', await heard(() => notify(aid, m, { all: true })), ['crew-phone', 'kit-phone', 'mate-phone']);
eq('a founder alert reaches the owner alone', await heard(() => notify(aid, m, { owner: true })), ['kit-phone']);
eq('an alert that names nobody reaches nobody', await heard(() => notify(aid, m)), []);
eq('one device, by its address', await heard(() => notify(aid, m, { endpoint: 'https://push.example/mate-phone' })), ['mate-phone']);

console.log('\nTHE OWNER MOVES A TAB, THE ALERTS FOLLOW');
ok('the owner lets the sound engineer see Merch', (await A({ action: 'accessSet', email: 'crew@example.com', area: 'merch', level: 1 }, TO)).ok);
eq('and the next order reaches the sound engineer too', await heard(() => tellOrder(aid, { ...order, code: 'CD34' })), ['crew-phone', 'kit-phone', 'mate-phone']);
ok('the owner hides Messages from the band mate', (await A({ action: 'accessSet', email: 'mate@example.com', area: 'messages', level: 0 }, TO)).ok);
eq('and the band mate hears no more messages', await heard(() => notify(aid, m, { tab: 'messages' })), ['kit-phone']);
eq('a hidden tab only mutes the phone: it stays switched on', await rows(), ['crew-phone', 'kit-phone', 'mate-phone']);

console.log('\nNO SEAT CROWDS ANOTHER OUT');
for (let i = 1; i <= 9; i++) await S({ action: 'pushOn', sub: sub('crew-spare-' + i) }, TC2);
const after = await rows();
ok('THE BUG: nine more phones on the sound engineer’s address leave the owner’s where it was', after.includes('kit-phone') && after.includes('mate-phone'), after);
eq('that address keeps its newest eight', after.filter((x) => x.startsWith('crew')).length, 8);
ok('its oldest is the one that went', !after.includes('crew-phone') && after.includes('crew-spare-9'), after);

console.log('\nA SIGN-OUT ENDS THAT PHONE’S ALERTS');
eq('the sound engineer signs one phone out', (await A({ action: 'signOut' }, TC2)).ok, true);
eq('and every alert that sign-in switched on is gone, nobody else’s', await rows(), ['kit-phone', 'mate-phone']);
ok('the sound engineer switches alerts on again from the other phone', (await S({ action: 'pushOn', sub: sub('crew-phone') }, TC)).ok);
ok('the owner removes the band mate', (await A({ action: 'remove', email: 'mate@example.com' }, TO)).ok);
eq('whose phone stops hearing the page at once', await rows(), ['crew-phone', 'kit-phone']);
/* A device can outlive the record of its sign-in (the session list keeps the newest
   few). The seat is what counts: an address that is no longer a seat here hears
   nothing, and the next alert drops its device. */
await saveSub(aid, sub('ghost-phone'), { email: 'gone@example.com', sid: newSid() });
eq('a device whose address is no seat here hears nothing', await heard(() => notify(aid, m, { all: true })), ['crew-phone', 'kit-phone']);
eq('and is dropped by that alert', await rows(), ['crew-phone', 'kit-phone']);

console.log('\nA DEVICE SWITCHED ON WITHOUT AN ADDRESS IS THE OWNER’S');
/* The Studio code signs in with no address, and only the owner holds it. Devices
   switched on before decision 0114 carry none either: they were the page's then. */
await saveSub(aid, sub('code-phone'));
eq('it hears what the owner hears', await heard(() => notify(aid, m, { owner: true })), ['code-phone', 'kit-phone']);

console.log('\nSIGN OUT EVERYWHERE');
eq('the owner signs every device out', (await A({ action: 'revokeAll' }, TO)).ok, true);
eq('and no phone on the page hears it any more', await rows(), []);

console.log('\nEVERY ALERT NAMES WHO HEARS IT  (a tripwire)');
/* notify() sends nothing without an audience, so a new alert that forgets to name one
   is silent rather than loud to every seat. This makes the silence fail here. */
const dir = new URL('../netlify/functions/', import.meta.url);
const calls = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
  const src = readFileSync(new URL(f, dir), 'utf8');
  for (let i = src.indexOf('notify('); i !== -1; i = src.indexOf('notify(', i + 1)) {
    if (/function\s+$|[\w.]$/.test(src.slice(Math.max(0, i - 9), i))) continue;   // the definition, or tellNotify( and friends
    if (src[i + 'notify('.length] === ')') continue;                                 // `notify()` in a comment
    let depth = 0, commas = 0, j = i + 'notify'.length;
    for (; j < src.length; j++) {
      const c = src[j];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { depth--; if (depth === 0) break; }
      else if (c === ',' && depth === 1) commas++;
    }
    calls.push({ at: `${f}:${src.slice(0, i).split('\n').length}`, args: commas + 1 });
  }
}
ok('the tripwire finds the alerts (orders, messages, requests, reports, samples, the setup ping)', calls.length >= 6, calls);
eq('and every one names who hears it', calls.filter((c) => c.args !== 3).map((c) => c.at), []);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
