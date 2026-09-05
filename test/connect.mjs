/* STRIPE CONNECT — direct charges, the platform fee, and the gate.

   This closes INVARIANT 0r, which has been an open note since multi-tenancy
   shipped: a second artist's audience paid into the FOUNDER's Stripe balance, and
   the "10% platform cut" existed only as a number in a plan table.

   The cases that matter are not "does a session get created". They are:
     · nobody can take money until STRIPE says charges_enabled — not when a local
       flag says onboarding was started
     · the charge is created ON the artist's account, or it is not their money
     · the fee is the plan's fee: 10% free, 2% Plus, 0% Pro (Perry's ladder)
     · a session created on a connected account can still be REDEEMED, which needs
       that account in scope — getting this wrong is the 2026-08-30 failure with a
       new cause
   `stripe` and `@netlify/blobs` are both in-memory stand-ins (test/hooks.mjs). */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_local_tests_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_for_local_tests_only';

const admin    = (await import('../netlify/functions/admin.mjs')).default;
const payFn    = (await import('../netlify/functions/pay.mjs')).default;
const showFn   = (await import('../netlify/functions/show.mjs')).default;
const confirmFn = (await import('../netlify/functions/confirm.mjs')).default;
const hookFn   = (await import('../netlify/functions/webhook.mjs')).default;
const C        = await import('../netlify/functions/_connect.mjs');
const { PLANS } = await import('../netlify/functions/_plan.mjs');
const { getShow, readFans } = await import('../netlify/functions/_lib.mjs');
const { __stripe } = await import('./stripe-fake.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } =
  await import('../netlify/functions/_auth.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token, extra) => {
  const headers = { 'content-type': 'application/json', ...(extra || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const AS  = (token, action, extra = {}) => hit(admin, 'https://myset.vip/api/admin', { action, ...extra }, token);
const buy = (slug, fan, pack) => hit(payFn, `https://myset.vip/api/pay?a=${slug}`, { fan, kind: 'votes', pack });
const pub = (slug, fan) => hit(showFn, `https://myset.vip/api/show?a=${slug}&fan=${fan}`);
/* webhook.mjs refuses an unsigned body outright, which is correct — the stub's
   constructEventAsync does the parsing, so any non-empty signature reaches it. */
const SIG = { 'stripe-signature': 't=1,v1=testsig' };
const lastCall = (m) => [...__stripe.calls].reverse().find((c) => c.method === m);
/** Pretend Stripe finished KYC, then tell MySet the way Stripe would. */
const completeOnboarding = async (acct) => {
  const a = __stripe.accounts.get(acct);
  a.charges_enabled = true; a.payouts_enabled = true; a.details_submitted = true;
  return hit(hookFn, 'https://myset.vip/api/webhook',
    { type: 'account.updated', account: acct, data: { object: a } }, null, SIG);
};

console.log('\nPERRY\'S LADDER IS THE ONE DEFINITION OF THE CUT');
eq('free takes 10%', PLANS.free.cut, 0.10);
eq('Plus takes 2%', PLANS.plus.cut, 0.02);
eq('Pro takes nothing', PLANS.pro.cut, 0);
eq('a $5 pack on free', C.feeCents(500, 'free'), 50);
eq('a $5 pack on Plus', C.feeCents(500, 'plus'), 10);
eq('a $5 pack on Pro', C.feeCents(500, 'pro'), 0);
eq('rounding never favours the platform', C.feeCents(499, 'plus'), 9);

console.log('\nSETUP  a second artist with a room of her own');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
let reg = await readArtists();
const TA = await signToken('ana@example.com', revOf(reg, ana.artistId));
await AS(TA, 'addSong', { title: 'Valerie', artist: 'Amy Winehouse' });
await AS(TA, 'status', { status: 'live' });

console.log('\nNOBODY TAKES MONEY UNTIL STRIPE SAYS SO  (INVARIANT 0bl)');
let st = await AS(TA, 'payStatus');
eq('she has not started', st.pay.started, false);
eq('and cannot take a card', st.pay.ready, false);
eq('so her room is told payments are off', (await pub('ana-reyes', 'f1')).paymentsEnabled, false);
const early = await buy('ana-reyes', 'f1', 'small');
eq('and the endpoint refuses, not just the button', early.status, 503);

/* An Express account's country is IMMUTABLE, and with no value Stripe assigns the
   PLATFORM's — so an artist on Koh Phangan would silently get a US account and could
   never be paid out. payStart refuses rather than letting Stripe pick. */
const noCountry = await AS(TA, 'payStart', {});
eq('starting with no country is refused', [noCountry.status, noCountry.error], [428, 'need-country']);
eq('and no account was created', __stripe.accounts.size, 0);
const badCountry = await AS(TA, 'payStart', { country: 'Thailand' });
eq('a name is not a country code either', badCountry.status, 428);

const start = await AS(TA, 'payStart', { country: 'US' });
ok('onboarding starts', start.ok && /connect\.stripe\.test\/onboard/.test(start.url || ''), start);
const acct = (lastCall('accounts.create') && __stripe.accounts.size) ? [...__stripe.accounts.keys()][0] : '';
ok('an Express account was created', !!acct, acct);
eq('...as Express', lastCall('accounts.create').args.type, 'express');
ok('tagged with the artist id so a webhook can find her',
   lastCall('accounts.create').args.metadata.myset_artist === ana.artistId);
ok('the onboarding link returns to the Studio',
   /\/studio\?connect=done$/.test(lastCall('accountLinks.create').args.return_url),
   lastCall('accountLinks.create').args.return_url);

st = await AS(TA, 'payStatus');
eq('STARTED is not READY — this is the whole point', [st.pay.started, st.pay.ready], [true, false]);
eq('her room still says no', (await pub('ana-reyes', 'f1')).paymentsEnabled, false);
eq('and still refuses a charge', (await buy('ana-reyes', 'f1', 'small')).status, 503);
ok('the account id is never sent to a client whole', !/acct_test\d+$/.test(st.pay.acct), st.pay.acct);

console.log('\nWHEN STRIPE SAYS YES, THE ROOM OPENS  (and it costs no extra blob read)');
await completeOnboarding(acct);
st = await AS(TA, 'payStatus');
eq('now ready', st.pay.ready, true);
const show = await getShow(ana.artistId);
eq('the answer is mirrored onto the show record', !!(show.pay && show.pay.ready), true);
eq('which is what the audience poll reads', (await pub('ana-reyes', 'f1')).paymentsEnabled, true);

console.log('\nTHE CHARGE IS CREATED ON HER ACCOUNT, NOT THE PLATFORM\'S');
const sale = await buy('ana-reyes', 'f1', 'small');
ok('checkout opens', sale.ok && sale.url, sale);
const created = lastCall('checkout.sessions.create');
eq('THE WHOLE POINT: stripeAccount was in scope', created.opts.stripeAccount, acct);
eq('so the money is hers', __stripe.sessions.get(sale.id).onAccount, acct);
eq('and the session is tagged with her id', created.args.metadata.artist, ana.artistId);

console.log('\nAND MYSET TAKES EXACTLY THE PLAN\'S SHARE');
eq('a free artist pays 10% of $5', created.args.payment_intent_data.application_fee_amount, 50);
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'plus'; return true; });
const sale2 = await buy('ana-reyes', 'f2', 'small');
eq('on Plus it is 2%', lastCall('checkout.sessions.create').args.payment_intent_data.application_fee_amount, 10);
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'pro'; return true; });
await buy('ana-reyes', 'f3', 'small');
const proCall = lastCall('checkout.sessions.create');
/* `payment_intent_data` is now ALWAYS sent, because the charge carries its own
   `kind` and `artist` so the books can read the balance without joining back
   through the sessions list. What must never be sent is a fee — an
   `application_fee_amount` of 0 is not the same as no fee, and Stripe treats it
   differently. So the assertion moved from the envelope to the thing inside it. */
ok('on Pro no fee is sent at all, rather than a fee of zero',
   proCall.args.payment_intent_data.application_fee_amount === undefined, proCall.args.payment_intent_data);
ok('and the charge still labels itself for the books',
   proCall.args.payment_intent_data.metadata.kind === 'votes', proCall.args.payment_intent_data);

console.log('\nHER BUYER STILL GETS THEIR VOTES  (the redemption path knows the account)');
const before = ((await readFans(ana.artistId)).f1 || {}).extra || 0;
const conf = await hit(confirmFn,
  `https://myset.vip/api/confirm?session_id=${sale.id}&fan=f1&a=${ana.artistId}`);
ok('the return trip redeems', conf.ok, conf);
const got = ((await readFans(ana.artistId)).f1 || {}).extra || 0;
eq('five votes granted', got - before, 5);
const retr = lastCall('checkout.sessions.retrieve');
eq('because it retrieved WITH her account in scope', retr.opts.stripeAccount, acct);
const twice = await hit(confirmFn,
  `https://myset.vip/api/confirm?session_id=${sale.id}&fan=f1&a=${ana.artistId}`);
eq('and it is still redeem-once (INVARIANT 7)',
   ((await readFans(ana.artistId)).f1 || {}).extra, got);

console.log('\nTHE WEBHOOK COVERS THE PHONE THAT NEVER COMES BACK  (INVARIANT 5c)');
const solo = await buy('ana-reyes', 'f9', 'big');
const wh = await hit(hookFn, 'https://myset.vip/api/webhook', {
  type: 'checkout.session.completed', account: acct,
  data: { object: __stripe.sessions.get(solo.id).session } }, null, SIG);
ok('the webhook is accepted', wh.received, wh);
eq('and f9 got their votes without ever returning',
   ((await readFans(ana.artistId)).f9 || {}).extra, 15);

console.log('\nLOSING A CAPABILITY CLOSES THE ROOM AGAIN');
const a = __stripe.accounts.get(acct);
a.charges_enabled = false;
await hit(hookFn, 'https://myset.vip/api/webhook',
  { type: 'account.updated', account: acct, data: { object: a } }, null, SIG);
eq('payments are off', (await pub('ana-reyes', 'f1')).paymentsEnabled, false);
eq('and a charge is refused', (await buy('ana-reyes', 'f1', 'small')).status, 503);

console.log('\nTHE FOUNDER\'S OWN ACCOUNT IS UNTOUCHED  (it predates Connect)');
await hit(admin, 'https://myset.vip/api/admin?code=devlocal', { action: 'addSong', title: 'Hey Jude', artist: 'The Beatles' });
await hit(admin, 'https://myset.vip/api/admin?code=devlocal', { action: 'status', status: 'live' });
eq('he can still take money with no connected account', (await pub('', 'p1')).paymentsEnabled, true);
const his = await hit(payFn, 'https://myset.vip/api/pay', { fan: 'p1', kind: 'votes', pack: 'small' });
ok('and his checkout still opens', his.ok, his);
const hisCall = lastCall('checkout.sessions.create');
eq('on the platform account, as before', hisCall.opts.stripeAccount, undefined);
ok('with no application fee — there is nobody to take one from',
   hisCall.args.payment_intent_data.application_fee_amount === undefined, hisCall.args.payment_intent_data);

console.log('\nAND THE HONEST NOTE ABOUT WHO PAYS STRIPE');
const s2 = await AS(TA, 'payStatus');
ok('the status says Stripe\'s own fee comes off the artist',
   /2\.9%/.test(s2.pay.stripeFeeNote || ''), s2.pay.stripeFeeNote);
eq('and reports the cut as a percentage the Studio can print', s2.pay.cutPct, 0);

delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
