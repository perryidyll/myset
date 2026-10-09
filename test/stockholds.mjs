/* MERCH IS HELD WHILE THE BUYER PAYS  (decision 0178, INVARIANT 0ir — _profile.mjs holds,
   pay.mjs, _pay.mjs takeStockFor / settleShort, webhook.mjs checkout.session.expired)

   Stock was checked when checkout opened and taken when the money landed, with
   nothing between: two fans could pay for the last tee. The founder's recommended
   answer (pending his word) is "Hold for 30 minutes, refund if still short":

     · opening checkout holds the quantity, per item and per size, and the session
       expires on Stripe's side in a little over half an hour
     · a hold past its checkout's expiry stops counting, event or no event
     · a payment that still finds the count short — less everyone else's holds — is
       refunded in full at once, on the account it was paid on, and both sides told
     · never two orders for the last one */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_local_tests_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

import { createECDH, randomBytes } from 'node:crypto';
const PUSH = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (String(url).startsWith('https://push.example/')) { PUSH.push(String(url).split('/').pop()); return Promise.resolve(new Response('', { status: 201 })); }
  return nativeFetch(url, opts);
};

const admin     = (await import('../netlify/functions/admin.mjs')).default;
const vadmin    = (await import('../netlify/functions/venueadmin.mjs')).default;
const payFn     = (await import('../netlify/functions/pay.mjs')).default;
const confirmFn = (await import('../netlify/functions/confirm.mjs')).default;
const hookFn    = (await import('../netlify/functions/webhook.mjs')).default;
const { readMeta, readDoc, casDoc, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { readHolds, stockShort, checkoutExpiry, HOLD_GRACE_MS, mutateProfile, getProfile } = await import('../netlify/functions/_profile.mjs');
const { redeemSession, redeliverOwed, OWED } = await import('../netlify/functions/_pay.mjs');
const { createArtist, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { createVenue, signVenueToken, readVenues, vRevOf, mutateVenues } = await import('../netlify/functions/_venues.mjs');
const { saveSub, generateVapidKeys } = await import('../netlify/functions/_push.mjs');
const { __stripe } = await import('./stripe-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=testsig' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const OWNER   = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const VS      = (token, action, extra = {}) => hit(vadmin, 'https://x/api/venueadmin', { action, ...extra }, token);
const PAY     = (body, q = '') => hit(payFn, 'https://x/api/pay' + q, body);
const CONFIRM = (sid, fan, q = '') => hit(confirmFn, `https://x/api/confirm?session_id=${sid}&fan=${fan}${q}`);
const hook    = (event) => hit(hookFn, 'https://x/api/webhook', event);
const calls   = (m) => __stripe.calls.filter((c) => c.method === m);
const lastCreate = () => calls('checkout.sessions.create').pop();
const lastSid = () => [...__stripe.sessions.keys()].pop();
const sessionOf = (sid) => __stripe.sessions.get(sid).session;
const holdsOf = async (owner = DEFAULT_ARTIST) => Object.keys(await readHolds(owner)).length;
const stockOf = async (id) => (await OWNER('merchList')).merch.find((m) => m.id === id).stock;
const orderOf = async (sid, owner = DEFAULT_ARTIST) => (await readMeta(owner)).orders.find((o) => o.sid === sid) || null;
const markOf = async (sid, owner = DEFAULT_ARTIST) => (await readMeta(owner)).paid[sid] || null;
const paidEvent = (sid, account = '') => ({ type: 'checkout.session.completed', ...(account ? { account } : {}), data: { object: sessionOf(sid) } });

console.log('\nTHE RULES');
const T = Date.now();
const x = checkoutExpiry(T);
ok('a checkout expires between 31 and 32 minutes from now — over Stripe’s 30-minute floor', x - T / 1000 > 31 * 60 - 1 && x - T / 1000 <= 32 * 60, x - T / 1000);
eq('and a retry inside the same minute asks for the same moment', checkoutExpiry(Math.floor(T / 60e3) * 60e3 + 59e3), checkoutExpiry(Math.floor(T / 60e3) * 60e3));
const item = { id: 'mrule01', stock: 1, variants: [{ label: 'S', stock: 2 }, { label: 'M' }] };
const live = { i: 'mrule01', z: '', q: 1, x: x };
eq('one left and somebody else holding it: short', stockShort([item], 'mrule01', 1, '', { h1: live }), true);
eq('one left and it is MY hold: not short', stockShort([item], 'mrule01', 1, '', { h1: live }, 'h1'), false);
eq('a hold past its checkout and the grace does not count', stockShort([item], 'mrule01', 1, '', { h1: { ...live, x: Math.floor((T - HOLD_GRACE_MS) / 1000) - 60 } }), false);
eq('a size with its own count is held on its own count', stockShort([item], 'mrule01', 2, 'S', { h1: live }), false);
eq('a size without a count draws on the item’s', stockShort([item], 'mrule01', 1, 'M', { h1: live }), true);
eq('nobody counting: never short', stockShort([{ id: 'mrule02', stock: null }], 'mrule02', 5, '', {}), false);

console.log('\nOPENING CHECKOUT HOLDS THE LAST ONE');
let r = await OWNER('merchSave', { item: { title: 'Last tee', cents: 2500, stock: 1 } });
const tee = r.merch.find((m) => m.title === 'Last tee').id;
r = await PAY({ fan: 'ann', kind: 'merch', item: tee, attempt: 'a1' });
ok('ann’s checkout opens', r.ok, r);
const c1 = lastCreate();
ok('it expires on Stripe’s side in a little over half an hour', c1.args.expires_at - Date.now() / 1000 > 30 * 60 && c1.args.expires_at - Date.now() / 1000 <= 32 * 60, c1.args.expires_at);
ok('and carries the hold it took', /^h[0-9a-f]{15}$/.test(c1.args.metadata.hold || ''), c1.args.metadata);
eq('one hold on the owner’s document', await holdsOf(), 1);
const made = calls('checkout.sessions.create').length;
r = await PAY({ fan: 'bob', kind: 'merch', item: tee, attempt: 'b1' });
ok('THE FIX: bob is told before his card, not after', r.status === 409 && /checking out with the last one/.test(r.error || ''), r);
eq('and no checkout was opened for him', calls('checkout.sessions.create').length, made);
r = await PAY({ fan: 'ann', kind: 'merch', item: tee, attempt: 'a1' });
const c2 = lastCreate();
eq('ann’s tap retried: the same hold, the same clock — so Stripe sees the same request', [c2.args.metadata.hold, c2.args.expires_at], [c1.args.metadata.hold, c1.args.expires_at]);
r = await PAY({ fan: 'ann', kind: 'merch', item: tee, attempt: 'a2' });
ok('ann backed out of Stripe and tapped Buy again: her own first hold gives way', r.ok, r);
eq('still one hold', await holdsOf(), 1);
r = await CONFIRM(lastSid(), 'ann');
ok('she pays: the order lands', r.ok && r.order && !r.short, r);
eq('the count comes down', await stockOf(tee), 0);
eq('and the hold is let go', await holdsOf(), 0);

console.log('\nTWO LEFT, TWO HOLDS, A THIRD TOLD');
await OWNER('merchSave', { item: { id: tee, stock: 2 } });
ok('ann holds one', (await PAY({ fan: 'ann', kind: 'merch', item: tee, attempt: 'a3' })).ok);
const annS = lastSid();
ok('bob holds one', (await PAY({ fan: 'bob', kind: 'merch', item: tee, attempt: 'b2' })).ok);
const bobS = lastSid();
r = await PAY({ fan: 'cat', kind: 'merch', item: tee, attempt: 'c1' });
ok('cat is told they are both being paid for', r.status === 409 && /checking out/.test(r.error || ''), r);
r = await PAY({ fan: 'cat', kind: 'merch', item: tee, qty: 2, attempt: 'c2' });
ok('asking for two while both are held says so', r.status === 409, r);
const refundsBefore = calls('refunds.create').length;
await CONFIRM(annS, 'ann'); await CONFIRM(bobS, 'bob');
eq('both pay, both orders stand, nobody refunded', [await stockOf(tee), calls('refunds.create').length - refundsBefore, !!(await orderOf(annS)).short, !!(await orderOf(bobS)).short], [0, 0, false, false]);

console.log('\nA HOLD PAST ITS CHECKOUT STOPS COUNTING — NO EVENT NEEDED');
await OWNER('merchSave', { item: { id: tee, stock: 1 } });
ok('ann holds the last one', (await PAY({ fan: 'ann', kind: 'merch', item: tee, attempt: 'a4' })).ok);
const lateS = lastSid();
const realNow = Date.now;
Date.now = () => realNow() + 40 * 60e3;          // forty minutes on: her checkout has expired and no event came
r = await PAY({ fan: 'bob', kind: 'merch', item: tee, attempt: 'b3' });
ok('bob can have it', r.ok, r);
const bobLast = lastSid();
const rows = await readHolds(DEFAULT_ARTIST);
eq('and ann’s spent hold is dropped by that same write', Object.values(rows).map((h) => h.at > realNow()), [true]);
ok('a hold names the phone only by a hash, never its id (0bu)', Object.values(rows).every((h) => /^[0-9a-f]{16}$/.test(h.f) && h.f !== 'bob'), rows);
Date.now = realNow;

console.log('\nA PAYMENT THAT STILL FINDS IT SHORT IS REFUNDED AT ONCE');
r = await hook(paidEvent(lateS));
eq('ann’s late payment arrives (the webhook answers 200)', r.status, 200);
const rf = calls('refunds.create').pop() || { args: {}, opts: {} };
eq('THE FIX: her whole payment goes back, once', [rf.args.payment_intent, rf.opts.idempotencyKey], [sessionOf(lateS).payment_intent, 'myset-short-' + lateS]);
eq('on the account it was paid on (the founder’s platform: no account, no fee to return)', [rf.opts.stripeAccount || '', rf.args.refund_application_fee], ['', undefined]);
let o = await orderOf(lateS);
eq('her order is closed — never handed over', [o.short, o.status, o.refunded, o.lost], [true, 'done', true, 2500]);
let mk = await markOf(lateS);
eq('the payment says why', [mk.short, mk.delivered, mk.settledBy, mk.lost], [true, true, 'short', 2500]);
eq('bob’s held one is still there for him', await stockOf(tee), 1);
r = await CONFIRM(lateS, 'ann');
eq('her phone is told it was sold out and refunded', [r.ok, r.short], [true, true]);
r = await CONFIRM(bobLast, 'bob');
ok('bob pays and gets it', r.ok && !r.short, r);
eq('the count reaches zero, never below', await stockOf(tee), 0);
const nRef = calls('refunds.create').length;
await hook(paidEvent(lateS));
eq('the same event again refunds nothing more', calls('refunds.create').length, nRef);
const metaBefore = JSON.stringify(await readMeta(DEFAULT_ARTIST));
await hook({ type: 'charge.refunded', data: { object: { id: 'ch_' + lateS, payment_intent: sessionOf(lateS).payment_intent, amount: 2500, amount_refunded: 2500, captured: true, metadata: { kind: 'merch' } } } });
eq('and the refund Stripe reports back changes nothing either (0177 already knows)', JSON.stringify(await readMeta(DEFAULT_ARTIST)), metaBefore);

console.log('\nTWO PAYMENTS FOR THE LAST ONE, NO HOLDS AT ALL (checkouts opened before this): ONE ORDER');
await OWNER('merchSave', { item: { id: tee, stock: 1 } });
const RECENT = Math.floor(Date.now() / 1000) - 60;
const bare = (id, fan) => {
  const session = { id, mode: 'payment', payment_status: 'paid', amount_total: 2500, created: RECENT, payment_intent: 'pi_' + id,
    metadata: { fan, kind: 'merch', item: tee, title: 'Last tee', qty: '1', ship: 'pickup', artist: DEFAULT_ARTIST, post: '0' } };
  __stripe.sessions.set(id, { session, onAccount: '' });
  return session;
};
await Promise.all([redeemSession(DEFAULT_ARTIST, bare('cs_race1', 'dee')), redeemSession(DEFAULT_ARTIST, bare('cs_race2', 'eve'))]);
const pair = [await orderOf('cs_race1'), await orderOf('cs_race2')];
eq('exactly one of them is short and refunded', pair.filter((x) => x.short).length, 1);
eq('exactly one is an order to hand over', pair.filter((x) => x.status === 'new').length, 1);
eq('and the count is zero, not minus one', await stockOf(tee), 0);

console.log('\nAN EXPIRED CHECKOUT LETS ITS HOLD GO AT ONCE');
await OWNER('merchSave', { item: { id: tee, stock: 1 } });
ok('ann holds it', (await PAY({ fan: 'ann', kind: 'merch', item: tee, attempt: 'a5' })).ok);
const gone = lastSid();
eq('bob cannot', (await PAY({ fan: 'bob', kind: 'merch', item: tee, attempt: 'b4' })).status, 409);
r = await hook({ type: 'checkout.session.expired', data: { object: { ...sessionOf(gone), status: 'expired' } } });
eq('Stripe says her checkout expired (200)', r.status, 200);
eq('the hold is gone', await holdsOf(), 0);
ok('and bob can have it now', (await PAY({ fan: 'bob', kind: 'merch', item: tee, attempt: 'b5' })).ok);

console.log('\nA REFUND THAT FAILS IS OWED, AND THE BELL MAKES IT  (a connected account)');
const keys = generateVapidKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
const lia = (await createArtist({ email: 'lia@example.com', name: 'Lia Tone', slug: 'lia-tone' })).artistId;
await mutateArtists((a) => { a.byId[lia].plan = 'plus'; return true; });
await casDoc('connect_' + lia, () => ({}), (c) => { c.acct = 'acct_lia'; c.chargesEnabled = true; return true; });
await mutateProfile(lia, (p) => { p.merch = [{ id: 'mliatee', title: 'Lia tee', cents: 2000, stock: 1, on: true }]; return true; });
const b64u = (b) => Buffer.from(b).toString('base64url');
const phone = createECDH('prime256v1'); phone.generateKeys();
await saveSub(lia, { endpoint: 'https://push.example/lia-phone', keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(randomBytes(16)) } });
const liaS = (id, fan) => {
  const session = { id, mode: 'payment', payment_status: 'paid', amount_total: 2000, created: RECENT, payment_intent: 'pi_' + id,
    customer_details: { email: fan + '@example.com' },
    metadata: { fan, kind: 'merch', item: 'mliatee', title: 'Lia tee', qty: '1', ship: 'pickup', artist: lia, post: '0' } };
  __stripe.sessions.set(id, { session, onAccount: 'acct_lia' });
  return session;
};
liaS('cs_lia1', 'fay'); liaS('cs_lia2', 'gus');
eq('the first payment takes the last one', (await hook(paidEvent('cs_lia1', 'acct_lia'))).status, 200);
eq('the count is zero', (await getProfile(lia)).merch[0].stock, 0);
__stripe.refuseRefunds = 'Stripe is having a moment';
PUSH.length = 0;
r = await hook(paidEvent('cs_lia2', 'acct_lia'));
eq('the second is short, the refund fails: the webhook says 500 so Stripe sends it again', r.status, 500);
o = await orderOf('cs_lia2', lia);
eq('the order is closed all the same — nobody hands it over', [o.short, o.status, !!o.refunded], [true, 'done', false]);
mk = await markOf('cs_lia2', lia);
eq('the payment is owed, not settled', [mk.short, mk.delivered], [true, false]);
ok('and the bell has it on its list', !!((((await readDoc(OWED, null)).data || {}).rows || {}).cs_lia2));
eq('no alert yet: nothing has happened for the buyer', PUSH, []);
__stripe.refuseRefunds = null;
const before = calls('refunds.create').length;
const bell = await redeliverOwed({ deadline: Date.now() + 8000 });
eq('THE BELL: the refund is made', bell.delivered, 1);
const made2 = calls('refunds.create').slice(before).pop() || { args: {}, opts: {} };
eq('on her account, with MySet’s fee given back, under the same key', [made2.opts.stripeAccount, made2.args.refund_application_fee, made2.opts.idempotencyKey], ['acct_lia', true, 'myset-short-cs_lia2']);
eq('the payment is settled now', [(await markOf('cs_lia2', lia)).delivered, (await orderOf('cs_lia2', lia)).refunded], [true, true]);
eq('and the artist’s phone hears it, once', PUSH, ['lia-phone']);
const n3 = calls('refunds.create').length;
await redeliverOwed({ deadline: Date.now() + 8000 });
await hook(paidEvent('cs_lia2', 'acct_lia'));
eq('the bell again, and Stripe’s redelivery, refund nothing more', calls('refunds.create').length, n3);
eq('nor say it twice', PUSH, ['lia-phone']);

console.log('\nA VENUE’S SIZES ARE HELD ON THEIR OWN COUNTS');
const bar = await createVenue({ email: 'bar@example.com', name: 'The Corner Bar', city: 'Koh Phangan', country: 'Thailand' });
const TV = await signVenueToken('bar@example.com', vRevOf(await readVenues(), bar.venueId));
await mutateVenues((reg) => { reg.byId[bar.venueId].plan = 'pro'; return true; });
await VS(TV, 'payStart', { country: 'TH' });
const acct = [...__stripe.accounts.keys()].pop();
__stripe.accounts.get(acct).charges_enabled = true;
await hook({ type: 'account.updated', data: { object: { id: acct, charges_enabled: true, payouts_enabled: true, details_submitted: true, country: 'TH' } } });
await VS(TV, 'merchSave', { item: { title: 'Bar tee', cents: 1500, variants: [{ label: 'S', stock: 1 }, { label: 'M' }] } });
const btee = ((await VS(TV, 'merchList')).merch || []).find((m) => m.title === 'Bar tee');
ok('the venue’s tee is on sale', !!btee, r);
const V = `?v=${bar.slug}`, VO = 'v_' + bar.venueId;
r = await PAY({ fan: 'phone1', kind: 'merch', item: btee.id, variant: 'S', attempt: 'vs1' }, V);
ok('phone1 opens checkout on the last small', r.ok, r);
const vs1 = lastCreate();
ok('on the venue’s account, with a clock and a hold', vs1.opts.stripeAccount === acct && vs1.args.expires_at > Date.now() / 1000 + 30 * 60 && !!vs1.args.metadata.hold, vs1);
r = await PAY({ fan: 'phone2', kind: 'merch', item: btee.id, variant: 'S', attempt: 'vs2' }, V);
ok('phone2 is told the size is held — in words the shop strikes the size for', r.status === 409 && /size/i.test(r.error || ''), r);
r = await PAY({ fan: 'phone2', kind: 'merch', item: btee.id, variant: 'M', attempt: 'vs3' }, V);
ok('a medium, which nobody counts, sells', r.ok, r);
eq('with no hold, but the same clock', [lastCreate().args.metadata.hold, !!lastCreate().args.expires_at], [undefined, true]);
eq('one hold on the venue', await holdsOf(VO), 1);
const vs1Sid = [...__stripe.sessions.keys()].find((k) => (sessionOf(k).metadata || {}).hold === vs1.args.metadata.hold);
r = await hook({ type: 'checkout.session.expired', account: acct, data: { object: { ...sessionOf(vs1Sid), status: 'expired' } } });
eq('phone1’s checkout expires on the venue’s account: the hold goes', [r.status, await holdsOf(VO)], [200, 0]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
