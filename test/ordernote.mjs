/* A MERCH ORDER TELLS ITS OWNER, AND THE STUDIO SAYS WHAT IS WAITING  (_ordernote.mjs,
   redeemSession in _pay.mjs, orderCount on /api/admin, nudge() in studio.js — decision 0097)

   A fan bought a shirt and the artist found out when the fan asked. Pins:
     · the fresh claim that writes an order sends ONE push (to the Merch tab) and ONE
       email per owner-role address; a replay of the same session sends neither
     · the letter names the item, size, count, price and how it leaves — never the buyer
     · a band mate's address is not written to; a venue's order writes to the venue's owner
     · a mail service that hangs never holds the claim past the time box
     · orderCount counts what is not done, and crew may not ask
     · the Studio's reminder: both lines, both doors, the 24-hour box, and it never
       covers a live show */
process.env.ADMIN_CODE = 'devlocal';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
const { createECDH, randomBytes } = await import('node:crypto');
const { readFileSync } = await import('node:fs');
const MAIL = [], PUSH = [];
let HANG = false;
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    if (HANG) return new Promise(() => {});
    try { MAIL.push(JSON.parse(opts.body)); } catch {} return Promise.resolve(new Response('{}', { status: 202 }));
  }
  if (String(url).startsWith('https://push.example/')) { PUSH.push(String(url)); return Promise.resolve(new Response('', { status: 201 })); }
  return nativeFetch(url, opts);
};

const admin = (await import('../netlify/functions/admin.mjs')).default;
const { redeemSession } = await import('../netlify/functions/_pay.mjs');
const { orderLine, orderHow, tellOrder, ORDER_NOTE_MS } = await import('../netlify/functions/_ordernote.mjs');
const { saveSub, generateVapidKeys } = await import('../netlify/functions/_push.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { mutateVenues } = await import('../netlify/functions/_venues.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const AS = async (token, action, extra = {}) => {
  const r = await admin(new Request('https://x/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ action, ...extra }) }));
  return { status: r.status, ...(await r.json()) };
};
const b64u = (b) => Buffer.from(b).toString('base64url');

const keys = generateVapidKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;

const lu = await createArtist({ email: 'lu@example.com', name: 'Lu Merch', slug: 'lu-merch' });
const T = await signToken('lu@example.com', revOf(await readArtists(), lu.artistId));
const phone = createECDH('prime256v1'); phone.generateKeys();
await saveSub(lu.artistId, { endpoint: 'https://push.example/lu-phone', keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(randomBytes(16)) } });
// a band mate on the same account: may run the shop, is not written to about orders
await mutateArtists((a) => { a.byEmail['mate@example.com'] = { artistId: lu.artistId, role: 'member' }; return true; });

const sess = (id, md, total) => ({ id, payment_status: 'paid', amount_total: total, created: Math.floor(Date.now() / 1000),
  metadata: { kind: 'merch', artist: lu.artistId, fan: 'fanphone1', ...md } });

console.log('\nONE ORDER, ONE PUSH, ONE LETTER');
let r = await redeemSession(lu.artistId, sess('cs_tee1', { item: 'mabc123', title: 'Tour tee', qty: '2', variant: 'M' }, 5000));
ok('the order is written', r.ok && r.order && r.order.title === 'Tour tee', r);
eq('one push, to the owner’s phone', PUSH, ['https://push.example/lu-phone']);
eq('one letter, to the owner only (not the band mate)', MAIL.map((m) => m.to[0]), ['lu@example.com']);
const L = MAIL[0] || { subject: '', text: '' };
eq('its subject names what was bought', L.subject, 'New merch order: Tour tee (M) × 2');
ok('it says the price and the pickup code', /\$50\.00/.test(L.text) && L.text.includes('code ' + r.order.code), L.text);
ok('and its door is the Studio’s Merch tab', L.text.includes('https://myset.vip/studio?tab=merch'), L.text);
ok('nothing about the buyer rides in it', !/fanphone1/.test(JSON.stringify(L)));

console.log('\nA REPLAY TELLS NOBODY');
r = await redeemSession(lu.artistId, sess('cs_tee1', { item: 'mabc123', title: 'Tour tee', qty: '2', variant: 'M' }, 5000));
ok('the same session answers "already"', r.ok && r.already, r);
eq('and sends no second push or letter', [PUSH.length, MAIL.length], [1, 1]);

console.log('\nSHIPPED, AND THE WORDING');
r = await redeemSession(lu.artistId, sess('cs_hood', { item: 'mdef456', title: 'Hoodie', qty: '1', ship: 'ship', post: '600' }, 4600));
const L2 = MAIL[1] || { text: '' };
ok('a posted order says it is to be shipped, with the postage', /To be shipped/.test(L2.text) && /\$46\.00 including \$6\.00 shipping/.test(L2.text), L2.text);
eq('the line reads the way the Studio does', orderLine({ title: 'Cap', qty: 1 }), 'Cap');
eq('pickup names the code', orderHow({ ship: 'pickup', code: '7K2Q' }), 'Pickup at the merch table — code 7K2Q.');

console.log('\nA VENUE’S ORDER');
await mutateVenues((v) => { v.byEmail['bar@example.com'] = { venueId: 'bar1', role: 'owner' }; v.byEmail['door@example.com'] = { venueId: 'bar1', role: 'staff' }; return true; });
const before = MAIL.length;
await tellOrder('v_bar1', { title: 'Bar cap', qty: 1, cents: 1200, post: 0, code: 'AB12', ship: 'pickup' });
eq('writes to the venue’s owner only', MAIL.slice(before).map((m) => m.to[0]), ['bar@example.com']);
ok('with the Venue Studio as its door', (MAIL[before] || { text: '' }).text.includes('https://myset.vip/venue-studio'));

console.log('\nA HUNG MAIL SERVICE NEVER HOLDS THE CLAIM');
HANG = true;
const t0 = Date.now();
r = await redeemSession(lu.artistId, sess('cs_cap', { item: 'mghi789', title: 'Cap', qty: '1' }, 2000));
const took = Date.now() - t0;
HANG = false;
ok('the order is still written', r.ok && r.order && r.order.title === 'Cap', r);
ok(`and the claim returns inside the time box (${took} ms ≤ ${ORDER_NOTE_MS + 500})`, took <= ORDER_NOTE_MS + 500, took);

console.log('\nTHE STUDIO’S COUNT');
r = await AS(T, 'orderCount');
eq('three orders, none done', [r.ok, r.open], [true, 3]);
await AS(T, 'orderDone', { sid: 'cs_tee1' });
eq('one done → two open', (await AS(T, 'orderCount')).open, 2);
await mutateArtists((a) => { a.byEmail['crew@example.com'] = { artistId: lu.artistId, role: 'crew' }; return true; });
const TC = await signToken('crew@example.com', revOf(await readArtists(), lu.artistId));
eq('crew may not ask', (await AS(TC, 'orderCount')).status, 403);

console.log('\nTHE REMINDER ON OPENING');
const studio = readFileSync(new URL('../public/studio.js', import.meta.url), 'utf8');
ok('it asks both counts once the screen is up, then decides', /Promise\.all\(\[msgPeek\(\),orderPeek\(\)\]\)\)\.then\(nudge\)/.test(studio));
ok('pending orders, with a door to Merch that lands on the Orders list', studio.includes('pending order') && studio.includes("'Open Merch','merch'") && /tab==='merch'\?ON\.click\(\['closeSheet'\],\['goOrders'\]\)/.test(studio) && studio.includes('<div class="sec" id="orders">'));
ok('unread messages, with a door to Messages', studio.includes('unread message') && studio.includes("'Open Messages','messages'"));
ok('a box under each: quiet for 24 hours', studio.includes('Do not remind me again for 24 hours') && /NUDGE_MS=24\*3600e3/.test(studio));
ok('never over a live show', /function nudge\(\)\{[\s\S]{0,400}D\.show\.status==='live'\)return;/.test(studio));
ok('opened in the background, it waits to be seen rather than skipping', /if\(document\.hidden\)\{ document\.addEventListener\('visibilitychange',\(\)=>setTimeout\(nudge,300\),\{once:true\}\); return; \}/.test(studio));
ok('a push or letter about an order opens the Merch tab', /q\.get\('tab'\)==='merch'/.test(studio));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
