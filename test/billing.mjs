/* BILLING, THE ACCOUNT, AND A VENUE THAT TAKES MONEY  (_billing.mjs, _account.mjs,
   the venue half of _connect.mjs, the plan/account actions in admin.mjs and
   venueadmin.mjs)

   Pins:
     · a Plus checkout is a subscription-mode session on the platform account, the
       prices are found or created by lookup key, and the return trip sets the plan
     · a promo code below 100% becomes a coupon on the checkout
     · upgrade to Pro is an immediate price change; leaving to Free is cancel at the
       period end and the plan survives until then; the retention offer applies a
       one-time 50% coupon and can be used once
     · a webhook event syncs the same way; a comp is never overwritten by Stripe
     · the portal needs a customer; planGet carries the billing status
     · export contains what the artist owns and never a device id; delete removes
       every key and the registry rows and cancels the subscription; the founder
       cannot be deleted
     · a venue onboards to Connect under `v_<vid>`, its page gains a Buy button,
       and the fee is the venue plan's cut minus half of Stripe's estimated fee */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const vadmin = (await import('../netlify/functions/venueadmin.mjs')).default;
const webhookFn = (await import('../netlify/functions/webhook.mjs')).default;
const commFn = (await import('../netlify/functions/community.mjs')).default;
const payFn  = (await import('../netlify/functions/pay.mjs')).default;
const imgFn  = (await import('../netlify/functions/img.mjs')).default;
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { createVenue, signVenueToken, readVenues, vRevOf, mutateVenues, getVenueProfile } = await import('../netlify/functions/_venues.mjs');
const { __dump } = await import('./blobs-fake.mjs');
const { readBilling, TIERS } = await import('../netlify/functions/_billing.mjs');
const { feeCents, stripeFeeEstimate } = await import('../netlify/functions/_connect.mjs');
const { PLANS } = await import('../netlify/functions/_plan.mjs');
const { readDoc } = await import('../netlify/functions/_lib.mjs');
const { __stripe } = await import('./stripe-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token, headers0) => {
  const headers = { 'content-type': 'application/json', ...(headers0 || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const AS = (token, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);
const VS = (token, action, extra = {}) => hit(vadmin, 'https://x/api/venueadmin', { action, ...extra }, token);
const lastCall = (m) => [...__stripe.calls].reverse().find((c) => c.method === m);

console.log('\nUPGRADING  a Plus checkout, and the return trip');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
const TA = await signToken('ana@example.com', revOf(await readArtists(), ana.artistId));
let r = await AS(TA, 'planGet');
eq('she starts on free', r.plan, 'free');
eq('and the plan payload carries billing', r.billing.subscribed, false);
r = await AS(TA, 'planCheckout', { plan: 'plus' });
ok('checkout opens', r.ok && /checkout\.stripe\.test/.test(r.url), r);
let created = lastCall('checkout.sessions.create');
eq('in subscription mode', created.args.mode, 'subscription');
eq('on the platform account (no stripeAccount)', created.opts.stripeAccount, undefined);
ok('with the Plus price, found by lookup key', (lastCall('prices.create') || {}).args.lookup_key === TIERS.artist.plus.key);
eq('priced from the plan table', (lastCall('prices.create') || {}).args.unit_amount, PLANS.plus.price);
ok('a customer was made for her', !!(await readBilling(ana.artistId)).customerId);
ok('and the session says who it is for', created.args.metadata.owner === ana.artistId && created.args.subscription_data.metadata.plan === 'plus');
ok('and comes back to the Studio', /\/studio\?sub=done&cs=/.test(created.args.success_url));
const cs1 = [...__stripe.sessions.keys()].pop();
r = await AS(TA, 'planFinish', { cs: cs1 });
ok('the return trip confirms it', r.ok && r.plan === 'plus', r);
eq('she is on Plus', (await AS(TA, 'planGet')).plan, 'plus');
ok('with a renewal date about a month out', (await AS(TA, 'planGet')).until > Date.now() + 25 * 86400000);
eq('and the Studio knows she subscribes', (await AS(TA, 'planGet')).billing.subscribed, true);
eq('a second checkout is refused — change the plan instead', (await AS(TA, 'planCheckout', { plan: 'pro' })).status, 400);
eq('somebody else’s session cannot finish for her', (await AS(TA, 'planFinish', { cs: 'cs_nope' })).status, 400);

console.log('\nTHE PRICE IS CREATED ONCE');
const before = __stripe.calls.filter((c) => c.method === 'prices.create').length;
const bo = await createArtist({ email: 'bo@example.com', name: 'Bo Tran', slug: 'bo-tran' });
const TB = await signToken('bo@example.com', revOf(await readArtists(), bo.artistId));
await AS(TB, 'planCheckout', { plan: 'plus' });
eq('a second artist reuses the Plus price', __stripe.calls.filter((c) => c.method === 'prices.create').length, before);

console.log('\nA PROMO CODE BELOW 100% BECOMES A COUPON');
await mutateArtists((reg) => { reg.byId[bo.artistId].discountPct = 50; reg.byId[bo.artistId].discountCode = 'HALF'; return true; });
await AS(TB, 'planCheckout', { plan: 'pro' });
created = lastCall('checkout.sessions.create');
ok('the checkout carries a 50% coupon', !!(created.args.discounts && created.args.discounts[0].coupon === 'myset_promo_50'), created.args.discounts);

console.log('\nCHANGING  up is immediate, leaving keeps the paid month');
r = await AS(TA, 'planChange', { plan: 'pro' });
ok('Plus → Pro', r.ok && r.plan === 'pro', r);
let upd = lastCall('subscriptions.update');
ok('by changing the price with proration', upd.args.proration_behavior === 'create_prorations' && upd.args.items[0].price, upd.args);
eq('she is on Pro', (await AS(TA, 'planGet')).plan, 'pro');
r = await AS(TA, 'planChange', { plan: 'free' });
ok('Pro → Free cancels at the period end', r.ok && r.cancelAtPeriodEnd === true, r);
eq('the plan she paid for survives until then', (await AS(TA, 'planGet')).plan, 'pro');
eq('and the Studio can say so', (await AS(TA, 'planGet')).billing.cancelAtPeriodEnd, true);

console.log('\nTHE OFFER ON THE WAY OUT  50% off one month, once');
ok('the offer is noted when shown', (await AS(TA, 'planRetainOffered')).ok);
r = await AS(TA, 'planRetain');
ok('accepting keeps the plan', r.ok && r.plan === 'pro', r);
upd = lastCall('subscriptions.update');
ok('by a one-time 50% coupon on the live subscription', upd.args.coupon === 'myset_stay_50' && upd.args.cancel_at_period_end === false, upd.args);
eq('and the renewal is back on', (await AS(TA, 'planGet')).billing.cancelAtPeriodEnd, false);
eq('a second time is refused', (await AS(TA, 'planRetain')).status, 400);
eq('the Studio knows the offer is spent', (await AS(TA, 'planGet')).billing.retentionUsed, true);

console.log('\nTHE WEBHOOK  says the same thing the return trip does');
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
const b = await readBilling(ana.artistId);
const sub = __stripe.subs.get(b.subId);
sub.status = 'canceled';
r = await hit(webhookFn, 'https://x/api/webhook', { type: 'customer.subscription.deleted', data: { object: { id: sub.id, metadata: { owner: ana.artistId }, status: 'canceled' } } }, null, { 'stripe-signature': 'sig' });
ok('the event is received', r.received, r);
eq('and she falls back to free', (await AS(TA, 'planGet')).plan, 'free');
delete process.env.STRIPE_WEBHOOK_SECRET;

console.log('\nA COMP IS NOT STRIPE’S TO TAKE');
await mutateArtists((reg) => { reg.byId[bo.artistId].plan = 'pro'; reg.byId[bo.artistId].planUntil = Date.now() + 10 * 86400000; reg.byId[bo.artistId].compedBy = 'FRIENDS'; return true; });
const { syncSubscription } = await import('../netlify/functions/_billing.mjs');
await syncSubscription(bo.artistId, 'sub_nope').catch(() => {});
eq('a failed sync leaves a comp alone', (await readArtists()).byId[bo.artistId].plan, 'pro');

console.log('\nTHE PORTAL');
r = await AS(TA, 'planPortal');
ok('opens for a customer', r.ok && /billing\.stripe\.test/.test(r.url), r);
const cy = await createArtist({ email: 'cy@example.com', name: 'Cy', slug: 'cy' });
const TC = await signToken('cy@example.com', revOf(await readArtists(), cy.artistId));
eq('and not for somebody who never paid', (await AS(TC, 'planPortal')).status, 400);

console.log('\nTHE ACCOUNT  export, then delete');
ok('she adds a song', (await AS(TA, 'addSong', { title: 'Valerie', artist: 'Amy' })).ok);
r = await AS(TA, 'accountExport');
ok('an export comes back', r.ok && r.data && r.data.account.artistId === ana.artistId, r);
ok('with her songs', r.data.show.songs.some((s) => s.title === 'Valerie'));
ok('and never a device id', !JSON.stringify(r.data).includes('"fan"'));
eq('delete needs the word', (await AS(TA, 'accountDelete', { confirm: 'yes' })).status, 400);
r = await AS(TA, 'accountDelete', { confirm: 'DELETE' });
ok('she is deleted', r.ok && r.deleted > 10, r);
eq('her subscription was cancelled first', __stripe.subs.get(b.subId).status, 'canceled');
const reg = await readArtists();
ok('gone from the registry, the slug and the sign-in list', !reg.byId[ana.artistId] && !reg.bySlug['ana-reyes'] && !reg.byEmail['ana@example.com']);
eq('her show document is gone', (await readDoc('show_' + ana.artistId, null)).data, null);
eq('her token no longer works', (await AS(TA, 'planGet')).status, 401);
/* keysFor() is the ONE list of every per-artist key (ACCOUNTS.md §2.7). If a new
   key is ever written for an artist and not added there, this is what catches it. */
{ const left = [...__dump().keys()].filter((k) => k.includes(ana.artistId));
  eq('and no document anywhere still carries her id — keysFor() covers every key the app writes', left.join(','), ''); }
eq('the founder cannot be deleted', (await hit(admin, 'https://x/api/admin?code=devlocal', { action: 'accountDelete', confirm: 'DELETE' })).status, 400);

console.log('\nA VENUE THAT TAKES MONEY');
const bar = await createVenue({ email: 'bar@example.com', name: 'The Corner Bar', city: 'Koh Phangan', country: 'Thailand' });
const TV = await signVenueToken('bar@example.com', vRevOf(await readVenues(), bar.venueId));
await mutateVenues((reg) => { reg.byId[bar.venueId].plan = 'pro'; return true; });
r = await VS(TV, 'payStatus');
ok('the venue sees its payout status', r.ok && r.pay.kind === 'venue' && r.pay.started === false, r);
ok('and is told the fee is shared', /shared/.test(r.pay.stripeFeeNote), r.pay);
eq('a country is required first', (await VS(TV, 'payStart', {})).status, 428);
r = await VS(TV, 'payStart', { country: 'TH' });
ok('onboarding opens', r.ok && /connect\.stripe\.test\/onboard/.test(r.url), r);
ok('under the venue owner id', lastCall('accounts.create').args.metadata.myset_owner === 'v_' + bar.venueId);
ok('and comes back to the Venue Studio', /\/venues\?connect=done/.test(lastCall('accountLinks.create').args.return_url));
const acct = lastCall('accounts.create').args && [...__stripe.accounts.keys()].pop();
__stripe.accounts.get(acct).charges_enabled = true;
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
await hit(webhookFn, 'https://x/api/webhook', { type: 'account.updated', data: { object: { id: acct, charges_enabled: true, payouts_enabled: true, details_submitted: true, country: 'TH' } } }, null, { 'stripe-signature': 'sig' });
delete process.env.STRIPE_WEBHOOK_SECRET;
eq('the webhook mirrors readiness onto the venue', (await getVenueProfile(bar.venueId)).pay.ready, true);
ok('an item without a link now saves', (await VS(TV, 'merchSave', { item: { title: 'Bar cap', cents: 1200 } })).ok);
r = await hit(commFn, `https://x/api/community?v=${bar.slug}`);
eq('the community page offers Buy', r.canBuy, true);
const cap = r.merch[0];
r = await hit(payFn, `https://x/api/pay?v=${bar.slug}`, { fan: 'phone1', kind: 'merch', item: cap.id, qty: 1, attempt: 'v1' });
ok('a venue checkout opens', r.ok && /checkout/.test(r.url), r);
created = lastCall('checkout.sessions.create');
eq('as a direct charge on the venue’s account', created.opts.stripeAccount, acct);
eq('for the venue owner', created.args.metadata.artist, 'v_' + bar.venueId);
const expectFee = feeCents(1200, 'pro', 'venue');
eq('with the venue plan’s fee minus half of Stripe’s (0 → no fee field at all)', ((created.args.payment_intent_data||{}).application_fee_amount)||0, expectFee);
eq('which is 2% minus half of (2.9% + 30¢)', expectFee, Math.max(0, Math.floor(1200 * 0.02) - Math.round(stripeFeeEstimate(1200) / 2)));
eq('artists are not split (their table says so)', feeCents(1200, 'plus'), Math.floor(1200 * 0.02));
ok('and returns to the venue’s community page', /\/v\/.*\/community\?paid=/.test(created.args.success_url));
r = await VS(TV, 'planGet');
ok('the venue plan payload carries billing', r.ok && 'billing' in r && r.plan === 'pro', r);

delete process.env.STRIPE_SECRET_KEY;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
