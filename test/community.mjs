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
const lastCall = (m) => [...__stripe.calls].reverse().find((c) => c.method === m);

console.log('\nMERCH IS A PLUS FEATURE');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
const TA = await signToken('ana@example.com', revOf(await readArtists(), ana.artistId));
let r = await AS(TA, 'merchSave', { item: { title: 'Tour tee', cents: 2500 } });
eq('free is refused', r.status, 402);
ok('with the words the Studio shows', /Plus feature/.test(r.error || '') && /stays/.test(r.error || ''), r.error);
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
ok('the item is removed', (await AS(TA, 'merchRemove', { id: tee })).ok);
img = await imgFn(new Request(`https://x/api/img?a=ana-reyes&s=${tee}`));
eq('and its picture with it', img.status, 404);
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
r = await hit(confirmFn, `https://x/api/confirm?session_id=${sid}&fan=phone1`);
eq('redeeming twice is one order', (await readMeta(DEFAULT_ARTIST)).orders.filter((o) => o.sid === sid).length, 1);
r = await hit(revenueFn, 'https://x/api/revenue?code=devlocal');
ok('the Money tab sees it', r.payments.some((p) => p.kind === 'merch' && p.item === 'Perry tee'), r.payments);
ok('and totals it', r.totals.merch >= 40, r.totals);
r = await OWNER('orderList');
ok('orders list newest first', r.orders[0].sid === sid || r.orders.some((o) => o.sid === sid), r.orders);
ok('an order can be marked done', (await OWNER('orderDone', { sid })).orders.find((o) => o.sid === sid).status === 'done');
r = await OWNER('orderDetail', { sid });
ok('details are fetched from Stripe, not the store', r.ok && 'buyer' in r && 'shipping' in r, r);
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
ok('the owner deletes the photo post', (await OWNER('postDelete', { id: p3.id })).ok);
img = await imgFn(new Request('https://x' + p3.photos[0].split('&v=')[0]));
eq('and its photos go with it', img.status, 404);
eq('moderating a gone post is a 404', (await OWNER('postHide', { id: p3.id })).status, 404);
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

console.log('\nWHAT IT COSTS  (INVARIANT 9d13)');
const g = await count(() => GET('?a=ana-reyes&fan=phone1'));
under('the page, reads', g.reads, 8);
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
