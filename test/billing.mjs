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
     · export contains what the artist owns and never a device id
     · delete takes the page dark and stops the billing on the day it is asked, and
       keeps EVERYTHING for thirty days: the owner can still sign in, still export,
       and one tap undoes it. The purge is the cron's job, and only then is every
       key and registry row gone. The founder cannot be deleted at all
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
const { readDoc, publicArtist } = await import('../netlify/functions/_lib.mjs');
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
ok('the first delete only starts the clock', r.ok && r.purgeAt > Date.now() + 29 * 86400e3, r);
eq('her subscription was cancelled the same day', __stripe.subs.get(b.subId).status, 'canceled');

/* LEAVING IS NOT LOSING. Everything she has is still on disk for thirty days, her
   page is dark to the public, and one tap brings it all back. */
{ const reg0 = await readArtists();
  ok('everything is still in the registry', !!reg0.byId[ana.artistId] && reg0.bySlug['ana-reyes'] === ana.artistId);
  ok('and marked as leaving, with the date', !!reg0.byId[ana.artistId].del.purgeAt); }
ok('her songs are still on disk', !!(await readDoc('show_' + ana.artistId, null)).data);
ok('she can still sign in — she has to be able to undo', (await AS(TA, 'planGet')).ok);
eq('but the page is read-only until she decides', (await AS(TA, 'addSong', { title: 'Nope', artist: 'X' })).status, 423);
ok('and she can still take her data with her', (await AS(TA, 'accountExport')).ok);
{ const pub = await publicArtist(new Request('https://x/api/show?a=ana-reyes'));
  eq('the public page is dark', pub, null); }
r = await AS(TA, 'accountUndelete');
ok('undo brings it back', r.ok, r);
{ const pub = await publicArtist(new Request('https://x/api/show?a=ana-reyes'));
  eq('and the page answers again', pub, ana.artistId); }
ok('and she can work again', (await AS(TA, 'addSong', { title: 'Back', artist: 'X' })).ok);

console.log('\nAND THEN, THIRTY DAYS LATER');
r = await AS(TA, 'accountDelete', { confirm: 'DELETE' });
ok('she asks again', r.ok, r);
const { purgeDue } = await import('../netlify/functions/_account.mjs');
eq('nothing is purged before the date', (await purgeDue(Date.now())).purged.length, 0);
ok('and on the day it is', (await purgeDue(Date.now() + 31 * 86400e3)).purged.includes(ana.artistId));
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
eq('artists are not split (their table says so)', feeCents(1200, 'plus'), Math.floor(1200 * 0.10));
ok('and returns to the venue’s community page', /\/v\/.*\/community\?paid=/.test(created.args.success_url));
r = await VS(TV, 'planGet');
ok('the venue plan payload carries billing', r.ok && 'billing' in r && r.plan === 'pro', r);

console.log('\nHALF OF STRIPE’S CARD FEE, EXACTLY  (once Stripe knows what it was)');
/* At checkout the fee can only be estimated, so `feeCents` subtracts half of
   2.9%+30c. This is the correction, and it runs one way only: it pays the venue
   and never bills them. Set up a $50 basket so MySet's 2% (100c) is actually big
   enough to have something to give back. */
{
  const { settleSplit } = await import('../netlify/functions/_feesplit.mjs');
  const { readMeta } = await import('../netlify/functions/_lib.mjs');
  const owner = 'v_' + bar.venueId;
  const amount = 5000;
  const charged = feeCents(amount, 'pro', 'venue');          // what was taken at checkout
  __stripe.fees.set('fee_1', { id: 'fee_1', charge: 'ch_1', amount: charged, amount_refunded: 0 });
  /* THB, because MySet's first venues are Thai and the settlement currency is not
     the charge currency. 1 USD cent = 35 THB satang here. */
  __stripe.bts.set('txn_1', { id: 'txn_1', currency: 'thb', exchange_rate: 35,
    fee: 99999, fee_details: [{ type: 'stripe_fee', amount: 6300 }, { type: 'application_fee', amount: 4000 }],
    __account: acct });
  const ch = { id: 'ch_1', amount, currency: 'usd', balance_transaction: 'txn_1',
               application_fee: 'fee_1', payment_intent: 'pi_1' };
  r = await settleSplit(owner, acct, ch);
  const realFee = Math.round(6300 / 35);                     // 180c, the true Stripe fee in USD
  const estHalf = Math.round(stripeFeeEstimate(amount) / 2);
  const give = Math.max(0, Math.min(Math.round(realFee / 2) - estHalf, charged));
  ok('the correction is paid', r.ok && r.give === give, { r, give });
  ok('THE TRAP: it reads the balance transaction on the VENUE’s account, not ours',
     lastCall('balanceTransactions.retrieve').opts.stripeAccount === acct);
  ok('THE OTHER TRAP: and the application fee on OURS, not the venue’s',
     !lastCall('applicationFees.retrieve').opts.stripeAccount);
  eq('Stripe’s own fee is taken from fee_details, never from bt.fee', (await readMeta(owner)).fees.ch_1.stripeFee, realFee);
  eq('and it really moved', __stripe.fees.get('fee_1').amount_refunded, give);
  eq('the row says done', (await readMeta(owner)).fees.ch_1.state, 'done');
  const before = __stripe.fees.get('fee_1').amount_refunded;
  r = await settleSplit(owner, acct, ch);
  ok('a duplicate webhook changes nothing', r.already === true, r);
  eq('and pays nothing twice', __stripe.fees.get('fee_1').amount_refunded, before);

  /* The floor, said honestly: on a small basket MySet's fee is already zero at
     checkout, so there is nothing to give back and nothing to correct. */
  eq('a $12 cap on Pro takes no fee in the first place', feeCents(1200, 'pro', 'venue'), 0);
  __stripe.bts.set('txn_2', { id: 'txn_2', currency: 'usd', fee: 65,
    fee_details: [{ type: 'stripe_fee', amount: 65 }], __account: acct });
  r = await settleSplit(owner, acct, { id: 'ch_2', amount: 1200, currency: 'usd',
    balance_transaction: 'txn_2', payment_intent: 'pi_2' });
  eq('so the correction records it and stops', (await readMeta(owner)).fees.ch_2.state, 'nothing');

  /* Never guess a rate. A settlement currency with no exchange rate is recorded
     and left alone rather than halved as if it were dollars. */
  __stripe.bts.set('txn_3', { id: 'txn_3', currency: 'thb', exchange_rate: null, fee: 100,
    fee_details: [{ type: 'stripe_fee', amount: 6300 }], __account: acct });
  await settleSplit(owner, acct, { id: 'ch_3', amount: 5000, currency: 'usd', balance_transaction: 'txn_3' });
  eq('an unconvertible currency is recorded, not guessed at', (await readMeta(owner)).fees.ch_3.state, 'unconvertible');
}

delete process.env.STRIPE_SECRET_KEY;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
