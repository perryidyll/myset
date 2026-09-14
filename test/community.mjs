/* THE COMMUNITY PAGE AND THE SHOP  (_community.mjs, community.mjs, merch in admin /
   venueadmin / pay / _pay / revenue)

   Pins, in order:
     · merch is a Plus feature: saved on Plus, refused with the Studio's words on
       free, removable on any plan (0s), founder always allowed
     · an item's picture is its own slot and is served; removed with the item
     · the public page shows merch only while the plan has it, and knows whether a
       Buy button may exist (the ONE money gate, 0bl)
     · a merch checkout is priced from the record, never the request; pickup asks
       for no address, posted asks for one; it returns to the community page
     · redeeming it writes an ORDER and nothing about the buyer; the Money tab sees
       it; the artist can mark it done
     · posts: the limits (500 chars, 1–5 stars, 3 photos, one per show per phone,
       three a day per phone), video links by exact host, photos served and
       deleted with the post
     · likes are one per phone and idempotent; reports count; hidden posts vanish
       for the public and stay for the owner; replies and pins
     · a venue: merch needs a link and Pro; its page never offers Buy
     · what it costs */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';

const admin   = (await import('../netlify/functions/admin.mjs')).default;
const vadmin  = (await import('../netlify/functions/venueadmin.mjs')).default;
const commFn  = (await import('../netlify/functions/community.mjs')).default;
const payFn   = (await import('../netlify/functions/pay.mjs')).default;
const confirmFn = (await import('../netlify/functions/confirm.mjs')).default;
const revenueFn = (await import('../netlify/functions/revenue.mjs')).default;
const imgFn   = (await import('../netlify/functions/img.mjs')).default;
const voteFn  = (await import('../netlify/functions/vote.mjs')).default;
const profileFn = (await import('../netlify/functions/profile.mjs')).default;
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { createVenue, signVenueToken, readVenues, vRevOf, mutateVenues } = await import('../netlify/functions/_venues.mjs');
const { readMeta, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { MAX_MERCH } = await import('../netlify/functions/_profile.mjs');
const { __stripe } = await import('./stripe-fake.mjs');
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
const OWNER = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const AS = (token, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);
const VS = (token, action, extra = {}) => hit(vadmin, 'https://x/api/venueadmin', { action, ...extra }, token);
const GET = (q) => hit(commFn, 'https://x/api/community' + q);
const POST = (q, body) => hit(commFn, 'https://x/api/community' + q, body);
const count = async (fn) => {
  __opsStart(); await fn(); const log = __opsStop();
  return { reads: log.filter((l) => l.startsWith('get')).length, writes: log.filter((l) => l.startsWith('set')).length,
           globals: log.filter((l) => / (artists|promos|flags|cityindex|acctindex|idqueue|sheetsync|gigsched|venues)$/.test(l)).length };
};
const under = (name, got, ceiling) => ok(`${name} — ${got} (ceiling ${ceiling})`, got <= ceiling, { got, ceiling });
// a real JPEG signature with a little body — decodeDataUrl trusts the bytes, not the label
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
const lastCall = (m, pred = () => true) => [...__stripe.calls].reverse().find((c) => c.method === m && pred(c));

console.log('\nMERCH IS A PLUS FEATURE');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
const TA = await signToken('ana@example.com', revOf(await readArtists(), ana.artistId));
let r = await AS(TA, 'merchSave', { item: { title: 'Tour tee', cents: 2500 } });
eq('free is refused', r.status, 402);
ok('with the words the Studio shows', /Bar Star feature/.test(r.error || '') && /stays/.test(r.error || ''), r.error);
ok('and told before uploading a picture too', (await AS(TA, 'merchPhoto', { id: 'mabc123', data: JPEG })).status === 402);
ok('but removing is never gated', (await AS(TA, 'merchRemove', { id: 'mabc123' })).ok);
eq('the plan payload forwards the flag', (await AS(TA, 'planGet')).limits.merch, false);
await mutateArtists((reg) => { reg.byId[ana.artistId].plan = 'plus'; return true; });
r = await AS(TA, 'merchSave', { item: { title: 'Tour tee', blurb: 'Black, all sizes', cents: 2500, ship: 'ship' } });
ok('on Plus it saves', r.ok, r);
const tee = r.id;
ok('with an id shaped like a slot', /^m[a-z0-9]{6}$/.test(tee), tee);
eq('and the record holds it', r.merch.length, 1);
eq('price never below zero or above $500', (await AS(TA, 'merchSave', { item: { title: 'Poster', cents: 999999 } })).merch.find((m) => m.title === 'Poster').cents, 50000);
ok('a link is cleaned like every pasted URL', (await AS(TA, 'merchSave', { item: { title: 'Sticker', cents: 300, link: 'javascript:alert(1)' } })).merch.find((m) => m.title === 'Sticker').link === '');
ok('no name, no item', /name/i.test((await AS(TA, 'merchSave', { item: { cents: 100 } })).error || ''));
for (let i = (await AS(TA, 'merchList')).merch.length; i < MAX_MERCH; i++) await AS(TA, 'merchSave', { item: { title: 'Item ' + i, cents: 100 } });
ok(`${MAX_MERCH} is the most a page holds`, /most a page holds/.test((await AS(TA, 'merchSave', { item: { title: 'One more', cents: 100 } })).error || ''));
ok('the founder is always allowed', (await OWNER('merchSave', { item: { title: 'Perry tee', cents: 2000 } })).ok);

console.log('\nTHE PICTURE IS THE ITEM’S OWN SLOT');
r = await AS(TA, 'merchPhoto', { id: tee, data: JPEG });
ok('a picture lands', r.ok && /\/api\/img\?a=ana-reyes&s=m[a-z0-9]{6}&v=/.test(r.url), r);
let img = await imgFn(new Request(`https://x/api/img?a=ana-reyes&s=${tee}`));
eq('and is served', img.status, 200);
eq('a photo for an unknown item is refused', (await AS(TA, 'merchPhoto', { id: 'mzzzzzz', data: JPEG })).status, 404);
/* FIVE PICTURES, IN SWIPE ORDER (2026-09-14): the second lands in slot _1, img stays the first,
   a sixth is refused with the cap named, one ✕ drops one slot, the item takes every slot with it. */
r = await AS(TA, 'merchPhoto', { id: tee, data: JPEG });
ok('a second picture lands in the item’s next slot', r.ok && new RegExp(`s=${tee}_1&`).test(r.url), r.url);
let teeRow = r.merch.find((m) => m.id === tee);
eq('imgs is the swipe order and img the first', [teeRow.imgs.length, teeRow.img === teeRow.imgs[0], /s=m[a-z0-9]{6}&/.test(teeRow.img)], [2, true, true]);
for (let i = 0; i < 3; i++) r = await AS(TA, 'merchPhoto', { id: tee, data: JPEG });
eq('five is the most', r.merch.find((m) => m.id === tee).imgs.length, 5);
r = await AS(TA, 'merchPhoto', { id: tee, data: JPEG });
ok('a sixth is refused, naming the cap', r.status === 400 && /5 pictures/.test(r.error || ''), r);
eq('every slot is served', (await Promise.all([0, 1, 2, 3, 4].map((i) => imgFn(new Request(`https://x/api/img?a=ana-reyes&s=${tee}${i ? '_' + i : ''}`))))).map((x) => x.status), [200, 200, 200, 200, 200]);
r = await AS(TA, 'merchPhotoClear', { id: tee, slot: `${tee}_2` });
teeRow = r.merch.find((m) => m.id === tee);
eq('one ✕ drops one slot and the rest keep their order', [teeRow.imgs.length, teeRow.imgs.some((u) => u.includes(`s=${tee}_2&`)), teeRow.imgs[0] === teeRow.img], [4, false, true]);
eq('and that picture is gone', (await imgFn(new Request(`https://x/api/img?a=ana-reyes&s=${tee}_2`))).status, 404);
eq('a slot that is not the item’s is refused', (await AS(TA, 'merchPhotoClear', { id: tee, slot: 'mzzzzzz_1' })).status, 400);
r = await AS(TA, 'merchPhoto', { id: tee, data: JPEG });
ok('the freed slot is filled next', r.ok && new RegExp(`s=${tee}_2&`).test(r.url), r.url);
ok('the item is removed', (await AS(TA, 'merchRemove', { id: tee })).ok);
img = await imgFn(new Request(`https://x/api/img?a=ana-reyes&s=${tee}`));
eq('and its picture with it', img.status, 404);
eq('every slot of it', (await imgFn(new Request(`https://x/api/img?a=ana-reyes&s=${tee}_3`))).status, 404);
r = await AS(TA, 'merchSave', { item: { id: tee, title: 'Tour tee', blurb: 'Black, all sizes', cents: 2500, ship: 'ship' } });
ok('saving with a known id re-creates it in place', r.ok && r.merch.some((m) => m.id === tee));

console.log('\nTHE PUBLIC PAGE');
r = await GET('?a=ana-reyes&fan=phone1');
ok('loads for an artist', r.ok && r.kind === 'artist', r);
eq('with her merch', r.merch.some((m) => m.id === tee), true);
ok('and knows whether a Buy button may exist', typeof r.canBuy === 'boolean');
eq('a stranger to Stripe cannot take money', r.canBuy, false);
eq('and no posts yet', r.posts, []);
eq('an unknown page is a 404', (await GET('?a=nobody')).status, 404);
await mutateArtists((reg) => { reg.byId[ana.artistId].plan = 'free'; return true; });
eq('when the plan lapses the merch is not shown', (await GET('?a=ana-reyes')).merch, []);
eq('but nothing was deleted', (await AS(TA, 'merchList')).merch.length > 0, true);
await mutateArtists((reg) => { reg.byId[ana.artistId].plan = 'plus'; return true; });
const prof = await hit(profileFn, 'https://x/api/profile?a=ana-reyes');
ok('the artist page payload counts her merch and carries live/venue', typeof prof.merch === 'number' && 'live' in prof && 'venue' in prof, prof);

console.log('\nBUYING  priced from the record, returned to the community page');
ok('the founder has a paid history night', (await OWNER('addSong', { title: 'Valerie', artist: 'Amy' })).ok);
ok('and a show', (await OWNER('newShow')).ok);
const ownerSongs = (await OWNER('window', { open: true })).stage.songs;
ok('a fan votes', (await hit(voteFn, 'https://x/api/vote', { fan: 'phone9', song: ownerSongs[0].id })).ok);
ok('the night ends', (await OWNER('status', { status: 'ended' })).ok);
const pt = (await OWNER('merchList')).merch.find((m) => m.title === 'Perry tee');
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pt.id, qty: 2, attempt: 'tap1' });
ok('checkout opens', r.ok && /checkout\.stripe\.test/.test(r.url), r);
let created = lastCall('checkout.sessions.create');
eq('the price is the record’s, ×2', created.args.line_items[0].price_data.unit_amount * created.args.line_items[0].quantity, 4000);
eq('the metadata says merch', created.args.metadata.kind, 'merch');
eq('a pickup item asks for no address', created.args.shipping_address_collection, undefined);
ok('and it returns to the community page', /\/community(\.html)?\?paid=/.test(created.args.success_url), created.args.success_url);
eq('a fake price in the request changes nothing', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pt.id, cents: 1, attempt: 'tap2' })).ok, true);
eq('an item that is not for sale is a 404', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: 'mnonono', attempt: 'tap3' })).status, 404);
await OWNER('merchSave', { item: { title: 'Posted print', cents: 1500, ship: 'ship' } });
const pp = (await OWNER('merchList')).merch.find((m) => m.title === 'Posted print');
await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pp.id, qty: 1, attempt: 'tap4' });
created = lastCall('checkout.sessions.create');
ok('a posted item asks Stripe for an address', !!(created.args.shipping_address_collection && created.args.shipping_address_collection.allowed_countries.includes('TH')));
eq('and, with no postage figure, adds no shipping rate', created.args.shipping_options, undefined);
eq('the metadata says so', created.args.metadata.post, '0');

console.log('\nFROM THE SHOP  the return trip lands where the buyer left (0f8: a choice, never a url)');
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pt.id, qty: 1, attempt: 'tap5', from: 'shop' });
ok('checkout opens from the shop', r.ok, r);
created = lastCall('checkout.sessions.create');
ok('and returns to the shop', /\/shop(\.html)?\?paid=/.test(created.args.success_url), created.args.success_url);
ok('cancelling too', /\/shop(\.html)?\?cancelled=1/.test(created.args.cancel_url), created.args.cancel_url);
await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pt.id, attempt: 'tap6', from: 'https://evil.example/' });
created = lastCall('checkout.sessions.create');
ok('never to a caller’s url', !/evil/.test(created.args.success_url) && !/evil/.test(created.args.cancel_url), created.args.success_url);
ok('and anything but the shop still lands on the community page', /\/community(\.html)?\?paid=/.test(created.args.success_url));

console.log('\nSOLD OUT, SIZES AND POSTAGE  the record decides, the request only chooses');
r = await OWNER('merchSave', { item: { title: 'Last poster', cents: 1000, out: true } });
const lp = r.merch.find((m) => m.title === 'Last poster');
eq('an item saves as sold out', lp && lp.out, true);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: lp.id, attempt: 'tap7' });
eq('and cannot be bought', r.status, 409);
ok('in words the page can show', /sold out/i.test(r.error || ''), r.error);
ok('while the page still lists it, dimmed, with its price', (await GET('?fan=phone1')).merch.some((m) => m.id === lp.id && m.out === true && m.cents === 1000));
r = await OWNER('merchSave', { item: { title: 'Sized tee', cents: 3000, ship: 'ship', post: 600,
  variants: [{ label: 'S' }, { label: ' M ' }, { label: 'L', out: false }, { label: 'XL', out: true }, { label: 'l' }, ''] } });
const st = r.merch.find((m) => m.title === 'Sized tee');
eq('sizes save de-duplicated, trimmed, blanks dropped', st.variants.map((v) => v.label), ['S', 'M', 'L', 'XL']);
eq('with the sold-out size marked', st.variants.find((v) => v.label === 'XL').out, true);
eq('and the postage figure kept', st.post, 600);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: st.id, attempt: 'tap8' });
eq('no size sent is a 400', r.status, 400);
eq('saying so', r.error, 'Pick a size');
eq('a size the record does not have is a 400 too', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: st.id, variant: 'XXXL', attempt: 'tap9' })).status, 400);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: st.id, variant: 'XL', attempt: 'tap10' });
eq('a sold-out size is a 409', r.status, 409);
eq('with the size’s own words', r.error, 'That size is sold out');
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: st.id, qty: 2, variant: 'l', attempt: 'tap11', from: 'shop' });
ok('a size that is there opens checkout, whatever its case', r.ok, r);
created = lastCall('checkout.sessions.create');
ok('the line names the size as the record spells it', /\(L\)/.test(created.args.line_items[0].price_data.product_data.name), created.args.line_items[0].price_data.product_data.name);
eq('and the metadata carries it', created.args.metadata.variant, 'L');
eq('postage is a real Stripe shipping rate', created.args.shipping_options[0].shipping_rate_data.fixed_amount.amount, 600);
eq('flat per order, in the metadata too', created.args.metadata.post, '600');
eq('the line is still price × quantity', created.args.line_items[0].price_data.unit_amount * created.args.line_items[0].quantity, 6000);
const sizedSid = [...__stripe.sessions.keys()].pop();
eq('and the fake’s total is lines plus postage, as Stripe’s is', __stripe.sessions.get(sizedSid).session.amount_total, 6600);
/* The founder charges on the platform account, where there is no fee to compare;
   the fee-on-the-line-only proof is the venue's in test/billing.mjs. Here: a
   postage figure on a PICKUP item changes nothing, because nothing is posted. */
await OWNER('merchSave', { item: { id: pt.id, title: pt.title, cents: 2000, ship: 'pickup', post: 900 } });
await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pt.id, attempt: 'tap12' });
created = lastCall('checkout.sessions.create');
eq('a pickup item never carries a shipping rate, whatever `post` says', created.args.shipping_options, undefined);
eq('and its metadata says none was charged', created.args.metadata.post, '0');
eq('nor a picture, when it has none', created.args.line_items[0].price_data.product_data.images, undefined);
ok('a picture lands on the founder’s tee', (await OWNER('merchPhoto', { id: pt.id, data: JPEG })).ok);
await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pt.id, attempt: 'tap13' });
created = lastCall('checkout.sessions.create');
ok('and Stripe’s page shows it, from this origin', /^https:\/\/x\/api\/img\?a=.*&s=m[a-z0-9]{6}/.test(((created.args.line_items[0].price_data.product_data.images || [])[0]) || ''), created.args.line_items[0].price_data.product_data.images);
await OWNER('merchPhoto', { id: pt.id, data: JPEG });
await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: pt.id, attempt: 'tap13b' });
created = lastCall('checkout.sessions.create');
eq('every picture the item has, when it has more', (created.args.line_items[0].price_data.product_data.images || []).length, 2);
eq('and the shipping rate is called Shipping', lastCall('checkout.sessions.create', (c) => c.args.shipping_options).args.shipping_options[0].shipping_rate_data.display_name, 'Shipping');

console.log('\nTHE COUNT  (2026-09-14: a quantity that comes down as fans buy)');
r = await OWNER('merchSave', { item: { title: 'Counted cap', cents: 1500, stock: 3 } });
const cap = r.merch.find((m) => m.title === 'Counted cap');
eq('a count is saved as a whole number', cap.stock, 3);
eq('and the order shows it', (await OWNER('merchList')).merch.find((m) => m.id === cap.id).stock, 3);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: cap.id, qty: 4, attempt: 'tapc1' });
ok('more than are left is refused, naming the count', r.status === 409 && /Only 3 left/.test(r.error || ''), r);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: cap.id, qty: 2, attempt: 'tapc2' });
ok('two of three is fine', r.ok, r);
const capSid = [...__stripe.sessions.keys()].pop();
r = await hit(confirmFn, `https://x/api/confirm?session_id=${capSid}&fan=phone1`);
ok('the order redeems', r.ok && r.order && r.order.qty === 2, r);
eq('and the count came down by two', (await OWNER('merchList')).merch.find((m) => m.id === cap.id).stock, 1);
await hit(confirmFn, `https://x/api/confirm?session_id=${capSid}&fan=phone1`);
eq('a replay does not count it twice', (await OWNER('merchList')).merch.find((m) => m.id === cap.id).stock, 1);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: cap.id, qty: 1, attempt: 'tapc3' });
ok('the last one sells', r.ok, r);
await hit(confirmFn, `https://x/api/confirm?session_id=${[...__stripe.sessions.keys()].pop()}&fan=phone1`);
eq('at zero it is sold out on the read', (await OWNER('merchList')).merch.find((m) => m.id === cap.id).stock, 0);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: cap.id, qty: 1, attempt: 'tapc4' });
ok('and refused as sold out, with `out` untouched', r.status === 409 && /sold out/.test(r.error || '') && (await OWNER('merchList')).merch.find((m) => m.id === cap.id).out === false, r);
r = await OWNER('merchSave', { item: { id: cap.id, stock: '' } });
eq('a blank count means not counting again', r.merch.find((m) => m.id === cap.id).stock, null);
ok('and it sells again', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: cap.id, qty: 5, attempt: 'tapc5' })).ok);

console.log('\nTHE COUNT PER SIZE  (a size that is counting: refused past what is left, sold out at zero, the item sold out when every size is)');
r = await OWNER('merchSave', { item: { title: 'Sized cap', cents: 1500, variants: [{ label: 'S', stock: 1 }, { label: 'M' }, { label: 'L', stock: 0 }] } });
const scap = r.merch.find((m) => m.title === 'Sized cap');
eq('each size keeps its own count, blank meaning none', scap.variants.map((v) => v.stock), [1, null, 0]);
eq('a size at zero is refused as sold out', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: scap.id, variant: 'L', attempt: 'tsz1' })).status, 409);
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: scap.id, variant: 'S', qty: 2, attempt: 'tsz2' });
ok('two of a size with one left is refused, naming the size', r.status === 409 && /Only 1 left in S/.test(r.error || ''), r);
ok('an uncounted size takes any quantity', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: scap.id, variant: 'M', qty: 5, attempt: 'tsz3' })).ok);
ok('one of S sells', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: scap.id, variant: 'S', qty: 1, attempt: 'tsz4' })).ok);
await hit(confirmFn, `https://x/api/confirm?session_id=${[...__stripe.sessions.keys()].pop()}&fan=phone1`);
r = (await OWNER('merchList')).merch.find((m) => m.id === scap.id);
eq('and S came down to zero, the item’s own count untouched', [r.variants[0].stock, r.stock], [0, null]);
eq('S is now refused as sold out', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: scap.id, variant: 'S', attempt: 'tsz5' })).status, 409);
ok('the item still sells in M', (await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: scap.id, variant: 'M', attempt: 'tsz6' })).ok);
await OWNER('merchSave', { item: { id: scap.id, variants: [{ label: 'S', stock: 0 }, { label: 'M', out: true }, { label: 'L', stock: 0 }] } });
r = await hit(payFn, 'https://x/api/pay', { fan: 'phone1', kind: 'merch', item: scap.id, variant: 'M', attempt: 'tsz7' });
ok('every size gone is the item sold out', r.status === 409 && /That one’s sold out/.test(r.error || ''), r);

console.log('\nTHE ORDER OF THE ITEMS  (merchMove — the first is the one on top of the community card)');
r = await OWNER('merchList');
const [first, second] = r.merch;
r = await OWNER('merchMove', { id: second.id, dir: 'up' });
eq('up swaps it with the one before', [r.moved, r.merch[0].id, r.merch[1].id], [true, second.id, first.id]);
r = await OWNER('merchMove', { id: second.id, dir: 'up' });
eq('the first cannot move up', [r.moved, r.merch[0].id], [false, second.id]);
r = await OWNER('merchMove', { id: second.id, dir: 'down' });
eq('down puts it back', [r.merch[0].id, r.merch[1].id], [first.id, second.id]);
eq('the public read keeps that order', (await GET('?code=devlocal')).merch.filter((m) => m.on).map((m) => m.id).slice(0, 2), r.merch.filter((m) => m.on).map((m) => m.id).slice(0, 2));

console.log('\nREDEEMING  an order lands, nothing about the buyer does');
const sid = [...__stripe.sessions.keys()][0];
r = await hit(confirmFn, `https://x/api/confirm?session_id=${sid}&fan=phone1`);
ok('the return trip redeems it', r.ok && r.kind === 'merch', r);
let meta = await readMeta(DEFAULT_ARTIST);
const order = meta.orders.find((o) => o.sid === sid);
ok('an order is written', !!order, meta.orders);
eq('for two', order && order.qty, 2);
eq('at the right amount', order && order.amount, 40);
ok('and it is delivered — the order IS the delivery', meta.paid[sid] && meta.paid[sid].delivered === true);
ok('no email or address is stored', !JSON.stringify(order).match(/@|line1|postal/), order);
/* THE RECEIPT'S ORDER rides on the confirm reply, fresh and on a replay, from the
   meta document already in hand — the shop page reads it and needs nothing else. */
ok('the reply carries the order for the receipt', r.order && r.order.title === pt.title && r.order.qty === 2, r.order);
ok('with a pickup code — four or five letters and digits nobody misreads', /^[A-Z2-9]{4,5}$/.test(r.order && r.order.code), r.order);
eq('the line total in cents, with no postage', [r.order.cents, r.order.post], [4000, 0]);
eq('the size, when there is none', r.order.variant, '');
eq('and the night it was bought on', typeof r.order.show, 'string');
ok('never the buyer', !('fan' in r.order) && !('sid' in r.order), r.order);
eq('the code is on the order row', order.code, r.order.code);
const firstReply = r;
r = await hit(confirmFn, `https://x/api/confirm?session_id=${sid}&fan=phone1`);
eq('redeeming twice is one order', (await readMeta(DEFAULT_ARTIST)).orders.filter((o) => o.sid === sid).length, 1);
ok('and the replay says so', r.already === true, r);
eq('with the same order and the same code', r.order, firstReply.order);
r = await hit(revenueFn, 'https://x/api/revenue?code=devlocal');
ok('the Money tab sees it', r.payments.some((p) => p.kind === 'merch' && p.item === 'Perry tee'), r.payments);
ok('and totals it', r.totals.merch >= 40, r.totals);
r = await hit(confirmFn, `https://x/api/confirm?session_id=${sizedSid}&fan=phone1`);
ok('a sized, posted order redeems', r.ok && r.order, r);
eq('its line total leaves the postage out', [r.order.cents, r.order.post, r.order.variant, r.order.qty], [6000, 600, 'L', 2]);
eq('and the amount the row books is what the buyer paid', (await readMeta(DEFAULT_ARTIST)).orders.find((o) => o.sid === sizedSid).amount, 66);
r = await hit(revenueFn, 'https://x/api/revenue?code=devlocal');
ok('the Money tab names the size in brackets', r.payments.some((p) => p.kind === 'merch' && p.item === 'Sized tee (L)' && p.variant === 'L'), r.payments.map((p) => p.item));
r = await OWNER('orderList');
ok('orders list newest first', r.orders[0].sid === sizedSid, r.orders.map((o) => o.sid));
ok('every row carries a code and never the fan', r.orders.length > 0 && r.orders.every((o) => /^[A-Z2-9]{4,5}$/.test(o.code) && !('fan' in o)), r.orders);
eq('the size and postage too', [r.orders[0].variant, r.orders[0].post], ['L', 600]);
ok('an order can be marked done', (await OWNER('orderDone', { sid })).orders.find((o) => o.sid === sid).status === 'done');
ok('and those rows are shaped the same way', (await OWNER('orderList')).orders.every((o) => o.code && !('fan' in o)));

console.log('\nTHE PICKUP CODE  a lookup key, never a secret (0cm)');
{
  const { pickupCode, CODE_ALPHABET, pubOrder, ownerOrder } = await import('../netlify/functions/_pay.mjs');
  eq('thirty-two symbols, without 0, O, 1 or I', [CODE_ALPHABET.length, /[0O1I]/.test(CODE_ALPHABET)], [32, false]);
  eq('the same session always says the same code', pickupCode('cs_test_a'), pickupCode('cs_test_a'));
  ok('four characters from the alphabet', new RegExp(`^[${CODE_ALPHABET}]{4}$`).test(pickupCode('cs_test_a')), pickupCode('cs_test_a'));
  const c = pickupCode('cs_test_a');
  eq('a clash with another OPEN order of the same owner takes a fifth character', pickupCode('cs_test_a', [{ sid: 'cs_test_b', status: 'new', code: c }]).length, 5);
  eq('which begins with the same four', pickupCode('cs_test_a', [{ sid: 'cs_test_b', status: 'new', code: c }]).slice(0, 4), c);
  eq('a DONE order with that code is no clash — it has left the table', pickupCode('cs_test_a', [{ sid: 'cs_test_b', status: 'done', code: c }]), c);
  eq('nor is the order’s own earlier row', pickupCode('cs_test_a', [{ sid: 'cs_test_a', status: 'new', code: c }]), c);
  /* cs_old_1 and cs_new_454072 both hash to the same four under this alphabet and
     prefix — an old row with no stored code must clash on what it back-fills. */
  eq('an OPEN row from before codes clashes on its back-filled four', pickupCode('cs_new_454072', [{ sid: 'cs_old_1', status: 'new' }]).length, 5);
  eq('and a DONE code-less row is no clash', pickupCode('cs_new_454072', [{ sid: 'cs_old_1', status: 'done' }]).length, 4);
  ok('the fan id is not in it', pickupCode('cs_test_a') === pickupCode('cs_test_a', []) && !/phone/.test(pickupCode('phone1')));
  const old = { sid: 'cs_old', item: 'mabc123', title: 'Old tee', qty: 1, amount: 25, fan: 'phone7', at: 1, ship: 'pickup', status: 'new' };
  eq('a row from before codes is back-filled for the Studio, and loses the fan', ownerOrder(old), { ...old, fan: undefined, code: pickupCode('cs_old'), variant: '', post: 0 });
  eq('and for the receipt, with cents rebuilt from the amount', pubOrder(old), { item: 'mabc123', title: 'Old tee', qty: 1, variant: '', ship: 'pickup', cents: 2500, post: 0, code: pickupCode('cs_old'), show: '', at: 1 });
}
r = await OWNER('orderDetail', { sid });
ok('details are fetched from Stripe, not the store', r.ok && 'buyer' in r && 'shipping' in r, r);
ok('the row is shaped like the list: a code, never the fan', r.ok && /^[A-Z2-9]{4,5}$/.test(r.order.code) && !('fan' in r.order) && 'variant' in r.order && 'post' in r.order, r.order);
eq('an unknown order is a 404', (await OWNER('orderDetail', { sid: 'cs_nope' })).status, 404);

console.log('\nPOSTING  what a fan may say, and how often');
const hist = (await GET('?fan=phone1')).shows;
ok('the founder’s night is offered in the picker', hist.length >= 1, hist);
const night = hist[0].showId;
r = await POST('', { action: 'post', fan: 'phone1', text: 'Best night out in ages ' + 'x'.repeat(600), stars: 5, show: night, name: 'Kim' });
ok('a post lands', r.ok && r.id, r);
const p1 = r.posts.find((p) => p.id === r.id);
eq('cut to 500 characters', p1.text.length, 500);
eq('with the stars', p1.stars, 5);
ok('and the night named', /·/.test(p1.showLabel), p1.showLabel);
eq('and marked as mine for this phone', p1.mine, true);
eq('a second post about the same night from the same phone is refused', (await POST('', { action: 'post', fan: 'phone1', text: 'again', show: night })).status, 400);
eq('an unknown night is refused', (await POST('', { action: 'post', fan: 'phone1', text: 'hm', show: 'show-nope' })).status, 400);
eq('stars out of range are refused', (await POST('', { action: 'post', fan: 'phone2', text: 'hm', stars: 9 })).status, 400);
eq('an empty post is refused', (await POST('', { action: 'post', fan: 'phone2', text: '   ' })).status, 400);
ok('a rating alone is a post', (await POST('', { action: 'post', fan: 'phone2', stars: 4 })).ok);
ok('a second in the day is fine', (await POST('', { action: 'post', fan: 'phone2', text: 'two' })).ok);
ok('and a third', (await POST('', { action: 'post', fan: 'phone2', text: 'three' })).ok);
r = await POST('', { action: 'post', fan: 'phone2', text: 'four' });
eq('the fourth in a day is refused', r.status, 400);
ok('and says so plainly', /three posts today/.test(r.error || ''), r.error);

console.log('\nPHOTOS AND VIDEO');
r = await POST('', { action: 'post', fan: 'phone3', text: 'pics', photos: [JPEG, JPEG, JPEG, JPEG] });
ok('a post with photos lands', r.ok, r);
const p3 = r.posts.find((p) => p.id === r.id);
eq('three at most', p3.photos.length, 3);
ok('served from the page owner’s space', /\/api\/img\?a=perry-idyll&s=c[a-z0-9]{8}_0/.test(p3.photos[0]), p3.photos[0]);
img = await imgFn(new Request('https://x' + p3.photos[0].split('&v=')[0]));
eq('and actually served', img.status, 200);
eq('a fake photo is refused', (await POST('', { action: 'post', fan: 'phone4', text: 'x', photos: ['data:image/jpeg;base64,aGVsbG8='] })).status, 400);
r = await POST('', { action: 'post', fan: 'phone4', text: 'watch', video: 'https://youtu.be/dQw4w9WgXcQ' });
ok('a YouTube link embeds', r.ok && r.posts.find((p) => p.id === r.id).video.provider === 'youtube' && /youtube-nocookie|youtube\.com\/embed/.test(r.posts.find((p) => p.id === r.id).video.src), r);
r = await POST('', { action: 'post', fan: 'phone5', text: 'ig', video: 'https://www.instagram.com/reel/abc123/?utm=1' });
ok('an Instagram link is a link, not an iframe', r.ok && r.posts.find((p) => p.id === r.id).video.provider === 'instagram' && !r.posts.find((p) => p.id === r.id).video.src);
r = await POST('', { action: 'post', fan: 'phone6', text: 'no', video: 'https://vimeo.com/123' });
eq('anything else is refused', r.status, 400);
ok('with the three names', /YouTube, Instagram or TikTok/.test(r.error || ''), r.error);

console.log('\nLIKES, REPORTS, AND THE OWNER’S SIDE');
r = await POST('', { action: 'like', fan: 'phone9', id: p1.id });
eq('a heart', r.likes, 1);
eq('twice is still one', (await POST('', { action: 'like', fan: 'phone9', id: p1.id })).likes, 1);
eq('another phone makes two', (await POST('', { action: 'like', fan: 'phone8', id: p1.id })).likes, 2);
eq('unlike takes it back', (await POST('', { action: 'unlike', fan: 'phone9', id: p1.id })).likes, 1);
eq('the page says which ones this phone liked', (await GET('?fan=phone8')).posts.find((p) => p.id === p1.id).liked, true);
eq('a like on a gone post is a 404', (await POST('', { action: 'like', fan: 'phone9', id: 'cnope0000' })).status, 404);
ok('a report counts', (await POST('', { action: 'report', fan: 'phone7', id: p1.id })).ok);
r = await OWNER('postList');
eq('the owner sees the report', r.posts.find((p) => p.id === p1.id).reports, 1);
ok('and never a device id', !JSON.stringify(r.posts).includes('phone1'));
ok('the owner replies', (await OWNER('postReply', { id: p1.id, text: 'Thanks Kim!' })).ok);
eq('and the room sees it', (await GET('')).posts.find((p) => p.id === p1.id).reply.text, 'Thanks Kim!');
ok('the owner pins', (await OWNER('postPin', { id: p3.id, on: true })).ok);
eq('a pinned post comes first', (await GET('')).posts[0].id, p3.id);
ok('the owner hides', (await OWNER('postHide', { id: p1.id, on: true })).ok);
ok('a hidden post vanishes for the room', !(await GET('')).posts.some((p) => p.id === p1.id));
ok('and stays for the owner, marked', (await OWNER('postList')).posts.find((p) => p.id === p1.id).hidden === true);
/* DELETING A POST FOR GOOD IS GONE (2026-09-13, decision 0060): hiding is the whole
   of moderation now, and a hidden post's photos already go with it. */
eq('deleting a post for good is no longer an action', (await OWNER('postDelete', { id: p3.id })).status, 400);
ok('the owner hides the photo post', (await OWNER('postHide', { id: p3.id, on: true })).ok);
img = await imgFn(new Request('https://x' + p3.photos[0].split('&v=')[0]));
eq('and its photos go with it', img.status, 404);
eq('moderating a post that never existed is a 404', (await OWNER('postHide', { id: 'nope00000001' })).status, 404);
eq('another artist cannot moderate this page (her own page has no such post)', (await AS(TA, 'postHide', { id: p1.id })).status, 404);

console.log('\nA VENUE');
const bar = await createVenue({ email: 'bar@example.com', name: 'The Corner Bar', city: 'Koh Phangan', country: 'Thailand' });
const TV = await signVenueToken('bar@example.com', vRevOf(await readVenues(), bar.venueId));
r = await VS(TV, 'merchSave', { item: { title: 'Bar cap', cents: 900, link: 'https://shop.example.com/cap' } });
eq('a free venue is refused', r.status, 402);
ok('with Pro named', /Pro/.test(r.error || ''), r.error);
await mutateVenues((reg) => { reg.byId[bar.venueId].plan = 'pro'; return true; });
r = await VS(TV, 'merchSave', { item: { title: 'Bar cap', cents: 900 } });
ok('a venue item needs a link — venues have no payout account', /link/.test(r.error || ''), r);
r = await VS(TV, 'merchSave', { item: { title: 'Bar cap', cents: 900, link: 'https://shop.example.com/cap' } });
ok('with one it saves', r.ok && r.venue.merch.length === 1, r);
r = await GET(`?v=${bar.slug}&fan=phone1`);
ok('the venue page loads', r.ok && r.kind === 'venue', r);
eq('never with a Buy', r.canBuy, false);
eq('but with the item', r.merch.length, 1);
ok('a fan posts on a venue page', (await POST(`?v=${bar.slug}`, { action: 'post', fan: 'phone1', text: 'Great beer', stars: 4 })).ok);
ok('the venue moderates it', (await VS(TV, 'postList')).posts.length === 1);
eq('a venue slug that is not a venue is a 404', (await GET('?v=nobody')).status, 404);

console.log('\nARTISTS DO NOT COMMENT ON THEIR OWN PAGE');
r = await hit(commFn, 'https://x/api/community?a=ana-reyes&fan=ana-phone', undefined, TA);
eq('the signed-in owner is told the composer is unavailable', r.canPost, false);
r = await hit(commFn, 'https://x/api/community?a=ana-reyes', { action: 'post', fan: 'ana-phone', text: 'my own comment' }, TA);
eq('the server refuses a self-comment', r.status, 403);
r = await hit(commFn, 'https://x/api/community?code=devlocal', { action: 'post', fan: 'founder-phone', text: 'founder exception' });
ok('the founding account keeps the explicit exception', r.ok, r);

console.log('\nMAKE A REQUEST  (_wishes.mjs: a sentence for the Studio, three a day per phone, done and undone)');
r = await POST('?a=ana-reyes', { action: 'wish', fan: 'wisher1', text: '  A hoodie   in XL ', name: 'Jess', item: 'm000001' });
ok('a fan asks the shop for something', r.ok && /^w[a-z0-9]{8}$/.test(r.id), r);
eq('a request with no words is refused', (await POST('?a=ana-reyes', { action: 'wish', fan: 'wisher1', text: ' x ' })).status, 400);
eq('and with no device', (await POST('?a=ana-reyes', { action: 'wish', text: 'a tote' })).status, 400);
ok('a second in the day is fine', (await POST('?a=ana-reyes', { action: 'wish', fan: 'wisher1', text: 'a tote bag' })).ok);
ok('and a third', (await POST('?a=ana-reyes', { action: 'wish', fan: 'wisher1', text: 'the poster' })).ok);
r = await POST('?a=ana-reyes', { action: 'wish', fan: 'wisher1', text: 'four' });
eq('a fourth is a 429', r.status, 429);
ok('with the page’s words', /three requests today/.test(r.error || ''), r.error);
r = await hit(commFn, 'https://x/api/community?a=ana-reyes', { action: 'wish', fan: 'ana-phone', text: 'my own ask' }, TA);
eq('the owner cannot ask their own shop', r.status, 403);
r = await AS(TA, 'wishList');
ok('the Studio lists them, newest first, the device never named', r.ok && r.wishes.length === 3 && r.wishes[0].text === 'the poster' && !('f' in r.wishes[0]) && !('fan' in r.wishes[0]), r);
const hoodie = r.wishes.find((w) => w.text === 'A hoodie in XL');
ok('whitespace folded, the name kept', hoodie && hoodie.name === 'Jess', hoodie);
eq('an item id that is not on the table names nothing', hoodie && hoodie.itemTitle, '');
eq('open ones are open', r.wishes.every((w) => w.done === false), true);
r = await AS(TA, 'wishDone', { id: hoodie.id });
ok('the owner marks one done and it sinks under the open ones', r.ok && r.wishes[r.wishes.length - 1].id === hoodie.id && r.wishes[r.wishes.length - 1].done === true, r);
r = await AS(TA, 'wishDone', { id: hoodie.id, done: false });
ok('and takes it back', r.ok && r.wishes.find((w) => w.id === hoodie.id).done === false, r);
eq('a request that is gone is a 404', (await AS(TA, 'wishDone', { id: 'wnope0000' })).status, 404);
ok('a venue’s shop takes requests too', (await POST(`?v=${bar.slug}`, { action: 'wish', fan: 'wisher1', text: 'a bar cap in black' })).ok);
r = await VS(TV, 'wishList');
ok('and its Studio lists them', r.ok && r.wishes.length === 1 && r.wishes[0].text === 'a bar cap in black', r);
eq('the read carries the length cap for the page', (await GET('?a=ana-reyes')).limits.wish, 200);

console.log('\nTHE PROOF STRIP  (decision 0043: rating, requests, post count, top songs, comments, the setlist)');
const fbFn = (await import('../netlify/functions/feedback.mjs')).default;
const { topSongsOf, topAcross, commentsOf, MAX_COMMENT } = await import('../netlify/functions/profile.mjs');
const { topPlayedOf, topPaidOf } = await import('../netlify/functions/_history.mjs');
let pr = await hit(profileFn, 'https://x/api/profile?a=ana-reyes');
eq('requests is a boolean', typeof pr.requests, 'boolean');
eq('no feedback yet is null, never a zero-star rating', pr.rating, null);
eq('the post count is a number', typeof pr.posts, 'number');
eq('and no archived night means no favourites', pr.topSongs, []);
ok('a fan rates the night', (await hit(fbFn, 'https://x/api/feedback?a=ana-reyes', { fan: 'phone7', stars: 4, note: 'SECRET NOTE' })).ok);
ok('and another', (await hit(fbFn, 'https://x/api/feedback?a=ana-reyes', { fan: 'phone8', stars: 5 })).ok);
pr = await hit(profileFn, 'https://x/api/profile?a=ana-reyes');
eq('the page carries the average to one decimal, the count, and how many nights they name — none: she has no show on record', pr.rating, { avg: 4.5, count: 2, nights: 0 });
ok('and never the note text — that stays in the Studio', !JSON.stringify(pr).includes('SECRET NOTE'));
eq('the founder\u2019s ended night is filed on the next New show', (await OWNER('newShow')).ok, true);
pr = await hit(profileFn, 'https://x/api/profile');
eq('and the index rows alone name the room\u2019s favourite', pr.topSongs, [{ title: 'Valerie', votes: 1 }]);
eq('a row without a top song is skipped, same titles merge, three at most',
  topSongsOf([{ top: { title: 'A', votes: 2 } }, {}, { top: { title: 'a ', votes: 3 } }, { top: { title: 'B', votes: 4 } },
    { top: { title: 'C', votes: 1 } }, { top: { title: 'D', votes: 1 } }, { top: { title: 'E', votes: 0 } }]),
  [{ title: 'A', votes: 5 }, { title: 'B', votes: 4 }, { title: 'C', votes: 1 }]);
eq('the single favourite is the first of those', pr.topVoted, { title: 'Valerie', votes: 1 });
ok('a fan rates the founder\u2019s real night', (await hit(fbFn, 'https://x/api/feedback', { fan: 'phoneR', stars: 5 })).ok);
eq('and that rating names one night', (await hit(profileFn, 'https://x/api/profile')).rating.nights, 1);
eq('nothing was played that night, so there is no most-played song yet', pr.topPlayed, null);
eq('and no paid-for one — the play log carries no paid count', pr.topPaid, null);
/* The comments: the founder's page has, newest first, "founder exception", "ig" and
   "watch" with words on them; Kim's 500-character five-star post is HIDDEN, and the
   star-only post has no words to quote. A long one from a fresh phone is cut. */
ok('the three most recent public posts with words travel, newest first',
  Array.isArray(pr.comments) && pr.comments.length === 3 && pr.comments.map((c) => c.text).join('|') === 'founder exception|ig|watch', pr.comments);
ok('each as text, stars (1–5 or null) and when', pr.comments.every((c) => typeof c.text === 'string' && (c.stars === null || (c.stars >= 1 && c.stars <= 5)) && typeof c.when === 'number' && c.when > 0), pr.comments);
ok('the hidden post is not among them', !JSON.stringify(pr.comments).includes('Best night out'));
ok('and no name or device id rides along', !JSON.stringify(pr.comments).match(/Kim|phone|"name"|"fan"/));
ok('a long post is cut to a card', (await POST('', { action: 'post', fan: 'phoneL', text: 'L'.repeat(300), stars: 3 })).ok);
pr = await hit(profileFn, 'https://x/api/profile');
eq(`to ${MAX_COMMENT} characters, with its stars`, [pr.comments[0].text.length, pr.comments[0].stars], [MAX_COMMENT, 3]);
eq('the star notes from the "enjoying MySet?" prompt are never quoted', commentsOf({ list: [{ text: '', stars: 5, note: 'a note', at: 1 }] }), []);
eq('a page with no posts has an empty list', (await hit(profileFn, 'https://x/api/profile?a=ana-reyes')).comments, []);
/* The setlist taste: the ten the room could pick from first, and how many there are. */
ok('the founder\u2019s setlist names Valerie and counts the list', pr.setlist.includes('Valerie') && pr.songs >= 1 && pr.setlist.length <= 10, [pr.setlist, pr.songs]);
eq('an artist with no songs has an empty setlist and zero', [(await hit(profileFn, 'https://x/api/profile?a=ana-reyes')).setlist, (await hit(profileFn, 'https://x/api/profile?a=ana-reyes')).songs], [[], 0]);
/* Most played, from the play log: the founder plays Valerie on a new night. */
const vId = (await OWNER('window', { open: true })).stage.songs.find((x) => x.title === 'Valerie').id;
ok('the founder plays Valerie tonight', (await OWNER('status', { status: 'live' })).ok && (await OWNER('play', { song: vId })).ok);
ok('and the night ends and is filed', (await OWNER('status', { status: 'ended' })).ok && (await OWNER('newShow')).ok);
pr = await hit(profileFn, 'https://x/api/profile');
eq('the index rows now name the most-played song and how often', pr.topPlayed, { title: 'Valerie', plays: 1 });
eq('the vote it won on the first night still counts it as most voted', pr.topVoted, { title: 'Valerie', votes: 1 });
eq('a replay counts twice; a tie goes to the more-voted song, then the one heard first',
  topPlayedOf([{ songId: 'a', title: 'A', votes: 1 }, { songId: 'b', title: 'B', votes: 5 }, { songId: 'a', title: 'A', votes: 0, replay: true }]), { title: 'A', plays: 2 });
eq('with no replays the more-voted song is the most played', topPlayedOf([{ songId: 'a', title: 'A', votes: 1 }, { songId: 'b', title: 'B', votes: 5 }]), { title: 'B', plays: 1 });
eq('and an empty log is null', topPlayedOf([]), null);
eq('paid: null until the log carries a per-song paid count', topPaidOf([{ songId: 'a', title: 'A', votes: 3 }]), null);
eq('and the biggest paid count once it does', topPaidOf([{ songId: 'a', title: 'A', paidVotes: 2 }, { songId: 'b', title: 'B', paidVotes: 3 }, { songId: 'a', title: 'A', paidVotes: 2 }]), { title: 'A', paid: 4 });
eq('across nights the same title merges and the biggest count wins',
  topAcross([{ topPlayed: { title: 'A', plays: 2 } }, { top: { title: 'Z', votes: 9 } }, { topPlayed: { title: 'a', plays: 3 } }, { topPlayed: { title: 'B', plays: 4 } }], 'topPlayed', 'plays', 1), [{ title: 'A', plays: 5 }]);

console.log('\nWHAT IT COSTS  (INVARIANT 9d13)');
const g = await count(() => GET('?a=ana-reyes&fan=phone1'));
/* +1 since the picker reads the calendar (ev_) as well as the archive */
under('the page, reads', g.reads, 9);
/* the registry three times here: the slug, the plan, and getShow's name lookup because
   the fixture's show record has no artist name. Production is two. */
under('and global documents', g.globals, 3);
eq('and writes nothing', g.writes, 0);
const w = await count(() => POST('?a=ana-reyes', { action: 'post', fan: 'phoneZ', text: 'cheap' }));
under('a post, reads', w.reads, 8);
under('a post, writes', w.writes, 2);
const l = await count(() => POST('?a=ana-reyes', { action: 'like', fan: 'phoneZ', id: 'cnope0000' }));
under('a like, reads', l.reads, 7);

delete process.env.STRIPE_SECRET_KEY;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
