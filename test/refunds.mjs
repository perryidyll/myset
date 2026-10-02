/* MONEY THAT WENT BACK  (decision 0177, INVARIANT 0iq — _refunds.mjs, webhook.mjs)

   A refund or a chargeback never reached MySet: the session stays `paid` for ever,
   so the fan kept the votes, the night's money kept the dollars, and a refunded
   order still waited in the Studio to be handed over. The founder's recommended
   answer (pending his word) is "Take back what is unspent":

     · the payment's marker and its row say what went back (`refunded`, `dispute`, `lost`)
     · only the fan's WALLET gives votes back, only what is unspent; cast votes stay
       on the board and free votes are never touched
     · a chargeback won gives back what it took, to the wallet
     · a payment gone in full before it was ever delivered is never delivered
     · every step is safe under Stripe's retries, and a failure answers 500
     · the artist hears it once, on the seats that can see it */
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

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const hookFn = (await import('../netlify/functions/webhook.mjs')).default;
const { redeemSession } = await import('../netlify/functions/_pay.mjs');
const { readMeta, readFans, getShow, tipsTonight, tippersTonight, carryFans } = await import('../netlify/functions/_lib.mjs');
const { lostCents, backWanted, disputeKeeps, lossNote, moveVotes } = await import('../netlify/functions/_refunds.mjs');
const { moneyForShow } = await import('../netlify/functions/_history.mjs');
const { createArtist } = await import('../netlify/functions/_auth.mjs');
const { saveSub, generateVapidKeys } = await import('../netlify/functions/_push.mjs');
const { __stripe } = await import('./stripe-fake.mjs');
const { __failWrites } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A    = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const pub  = (fan) => hit(showFn, `https://x/api/show?fan=${fan}`);
const vote = (fan, song) => hit(voteFn, 'https://x/api/vote', { fan, song });
const hook = (event) => hookFn(new Request('https://x/api/webhook', { method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=testsig' }, body: JSON.stringify(event) }));

const P = 'perry-idyll';
const RECENT = Math.floor(Date.now() / 1000) - 3600;
let SHOW = '';
/* A session the fake Stripe holds, as pay.mjs would have made it: its payment intent
   is `pi_<id>`, which is all a refund or a dispute carries. */
const mk = (id, fan, kind, cents, extra = {}, { owner = P, acct = '' } = {}) => {
  const session = { id, mode: 'payment', payment_status: 'paid', amount_total: cents, currency: 'usd', created: RECENT,
    payment_intent: 'pi_' + id, metadata: { fan, kind, artist: owner, show: SHOW, ...extra } };
  __stripe.sessions.set(id, { session, onAccount: acct });
  return session;
};
const refundEv = (id, cents, refunded, { account = '', kind = 'votes', captured = true } = {}) => ({
  type: 'charge.refunded', ...(account ? { account } : {}),
  data: { object: { id: 'ch_' + id, object: 'charge', payment_intent: 'pi_' + id, amount: cents, amount_refunded: refunded,
                    refunded: refunded >= cents, captured, metadata: { kind, artist: P } } } });
const disputeEv = (type, id, cents, status, { account = '' } = {}) => ({
  type, ...(account ? { account } : {}),
  data: { object: { id: 'dp_' + id, object: 'dispute', charge: 'ch_' + id, payment_intent: 'pi_' + id, amount: cents, status } } });
const fanOf = async (fan, owner = P) => (await readFans(owner))[fan] || {};
const mark = async (sid, owner = P) => (await readMeta(owner)).paid[sid] || null;
const paidLeft = async (fan) => (await pub(fan)).credits.paidLeft;

console.log('\nTHE RULES, ONE PAYMENT AT A TIME');
eq('a refund of all of it is all of it', lostCents({ amount: 10, refunded: 1000 }), 1000);
eq('an open chargeback holds its amount', lostCents({ amount: 10, dispute: { status: 'needs_response', cents: 1000 } }), 1000);
eq('a won one holds nothing', lostCents({ amount: 10, dispute: { status: 'won', cents: 1000 } }), 0);
eq('a bank’s question holds nothing', lostCents({ amount: 10, dispute: { status: 'warning_needs_response', cents: 1000 } }), 0);
eq('a lost one holds its amount for ever', lostCents({ amount: 10, dispute: { status: 'lost', cents: 1000 } }), 1000);
eq('never more than was paid', lostCents({ amount: 10, refunded: 400, dispute: { status: 'lost', cents: 1000 } }), 1000);
eq('half a 15-vote pack back is eight votes back, rounded up', backWanted({ kind: 'votes', granted: 15, amount: 10, refunded: 500 }), 8);
eq('a tip has no votes to take', backWanted({ kind: 'tip', amount: 10, refunded: 1000 }), 0);
eq('song votes on a song are cast votes: none', backWanted({ kind: 'song_votes', granted: 5, amount: 5, refunded: 500 }), 0);
eq('song votes that went to the wallet: all of them', backWanted({ kind: 'song_votes', wallet: true, granted: 5, amount: 5, refunded: 500 }), 5);
ok('won, prevented and a question keep the money; open and lost do not',
   disputeKeeps('won') && disputeKeeps('warning_under_review') && disputeKeeps('prevented') && !disputeKeeps('needs_response') && !disputeKeeps('lost'));

console.log('\nSETUP');
for (const t of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']) await A('addSong', { title: t, artist: 'T' });
await A('freeCredits', { n: 3 });
await A('status', { status: 'live' });
SHOW = (await getShow(P)).showId;
const ids = (await pub('setup')).songs.map((s) => s.id);
eq('eight songs, three free votes', [ids.length, (await pub('setup')).credits.total], [8, 3]);

console.log('\nA REFUND TAKES BACK ONLY WHAT IS UNSPENT  (a $10, 10-vote pack; seven votes cast, three of them free)');
await redeemSession(P, mk('cs_ann', 'ann', 'votes', 1000, { votes: '10' }));
for (let i = 0; i < 7; i++) await vote('ann', ids[i]);
eq('ann has 13 votes, 7 cast: 6 of the pack left', await paidLeft('ann'), 6);
const before = await fanOf('ann');
let r = await hook(refundEv('cs_ann', 1000, 1000));
eq('the webhook answers 200', r.status, 200);
const annAfter = await fanOf('ann');
eq('THE FIX: the six unspent come back off the pack', annAfter.extra, 4);
eq('so she has nothing left to cast', await paidLeft('ann'), 0);
eq('her seven cast votes stay on the board', (annAfter.v || []).length, 7);
eq('what she spent, and from where, did not move', [annAfter.used, annAfter.freeUsed], [before.used, before.freeUsed]);
let m = await mark('cs_ann');
eq('the payment says what went back', [m.refunded, m.lost], [1000, 1000]);
eq('and what was taken back', [m.back.want, m.back.took], [10, 6]);
eq('her record carries the receipt', annAfter.rb.cs_ann.slice(0, 2), [10, 6]);
ok('and the marker remembers the artist was told', typeof m.told === 'string' && m.told.startsWith('1000|'), m.told);
r = await hook(refundEv('cs_ann', 1000, 1000));
eq('a second delivery of the same event answers 200 too', r.status, 200);
eq('and changes nothing', [(await fanOf('ann')).extra, (await mark('cs_ann')).seq], [4, m.seq]);
eq('her grant receipt is still there, so nothing can grant the pack again (0ia)', (await fanOf('ann')).gr.includes('cs_ann'), true);
const again = await redeemSession(P, (await __stripe.sessions.get('cs_ann')).session);
eq('a later delivery attempt answers already', [again.already, (await fanOf('ann')).extra], [true, 4]);

console.log('\nA PART REFUND TAKES ITS SHARE  (a $10, 15-vote pack)');
await redeemSession(P, mk('cs_bob', 'bob', 'votes', 1000, { votes: '15' }));
await hook(refundEv('cs_bob', 1000, 500));
eq('$5 back of $10 is eight of fifteen, rounded up', (await fanOf('bob')).extra, 7);
await hook(refundEv('cs_bob', 1000, 1000));
eq('the rest refunded: the rest comes back', (await fanOf('bob')).extra, 0);
await hook(refundEv('cs_bob', 1000, 500));
eq('the older event arriving late lowers nothing', [(await fanOf('bob')).extra, (await mark('cs_bob')).refunded], [0, 1000]);

console.log('\nA CHARGEBACK TAKES WHAT IS UNSPENT; A WIN GIVES IT BACK TO THE WALLET');
await redeemSession(P, mk('cs_cara', 'cara', 'votes', 500, { votes: '5' }));
for (let i = 0; i < 5; i++) await vote('cara', ids[i]);     // three free, two of the pack
eq('cara: 5 of the pack, 2 cast', await paidLeft('cara'), 3);
await hook(disputeEv('charge.dispute.created', 'cs_cara', 500, 'needs_response'));
eq('the bank opened it: the three unspent are taken', (await fanOf('cara')).extra, 2);
eq('the money is not counted while the bank holds it', (await mark('cs_cara')).lost, 500);
await hook(disputeEv('charge.dispute.funds_withdrawn', 'cs_cara', 500, 'needs_response'));
eq('the money leaving, same status: nothing more', (await fanOf('cara')).extra, 2);
await hook(disputeEv('charge.dispute.closed', 'cs_cara', 500, 'won'));
eq('THE WIN: the three come back to her wallet', (await fanOf('cara')).extra, 5);
eq('none of it went onto a board', (await fanOf('cara')).v.length, 5);
eq('and the money counts again', [(await mark('cs_cara')).lost || 0, (await mark('cs_cara')).dispute.status], [0, 'won']);
await hook(disputeEv('charge.dispute.created', 'cs_cara', 500, 'needs_response'));
eq('a late "created" after the decision re-opens nothing', [(await fanOf('cara')).extra, (await mark('cs_cara')).dispute.status], [5, 'won']);
/* Two events racing: the "opened" step (want 5) was computed first but lands on the
   fan AFTER the "won" step (want 0) already gave the votes back. The receipt holds
   the newer step, so the older one changes nothing. */
const won = (await fanOf('cara')).rb.cs_cara;
const stale = await moveVotes(P, 'cara', 'cs_cara', 5, won[2] - 1, null);
eq('a step older than the receipt’s moves nothing', [stale.n, stale.g, (await fanOf('cara')).extra], [0, 0, 5]);

await redeemSession(P, mk('cs_dan', 'dan', 'votes', 500, { votes: '5' }));
await hook(disputeEv('charge.dispute.created', 'cs_dan', 500, 'needs_response'));
await hook(disputeEv('charge.dispute.closed', 'cs_dan', 500, 'lost'));
eq('a chargeback lost: the votes stay taken', (await fanOf('dan')).extra, 0);
eq('and the money stays gone', (await mark('cs_dan')).lost, 500);

console.log('\nA BANK’S QUESTION TAKES NOTHING, UNTIL IT BECOMES A CHARGEBACK');
await redeemSession(P, mk('cs_eli', 'eli', 'votes', 500, { votes: '5' }));
await hook(disputeEv('charge.dispute.created', 'cs_eli', 500, 'warning_needs_response'));
eq('a question: every vote stays', (await fanOf('eli')).extra, 5);
eq('the money still counts', (await mark('cs_eli')).lost || 0, 0);
eq('but the record knows', (await mark('cs_eli')).dispute.status, 'warning_needs_response');
await hook(disputeEv('charge.dispute.funds_withdrawn', 'cs_eli', 500, 'needs_response'));
eq('it became a chargeback: now they are taken', (await fanOf('eli')).extra, 0);

console.log('\nSONG VOTES: THE WALLET GIVES BACK, THE BOARD DOES NOT');
await A('play', { song: ids[7] });
await A('play', { song: ids[6] });            // Hotel was played and is not playing: a replay is open
await redeemSession(P, mk('cs_fay', 'fay', 'song_votes', 300, { votes: '3', song: ids[7] }));
eq('fay’s three paid votes are on Hotel', (await fanOf('fay')).v.filter((x) => x === ids[7]).length, 3);
await hook(refundEv('cs_fay', 300, 300, { kind: 'song_votes' }));
eq('refunded: the cast votes stay where she put them', (await fanOf('fay')).v.filter((x) => x === ids[7]).length, 3);
eq('the money is marked gone all the same', (await mark('cs_fay')).lost, 300);
const r82 = await redeemSession(P, mk('cs_gus', 'gus', 'song_votes', 300, { votes: '3', song: ids[0] }));   // Alpha was never played
eq('song votes for a song the room cannot give went to the wallet (0182)', [r82.asCredits, (await fanOf('gus')).extra], [true, 3]);
eq('and the marker says so', (await mark('cs_gus')).wallet, true);
await hook(refundEv('cs_gus', 300, 300, { kind: 'song_votes' }));
eq('refunded: the wallet gives them back', (await fanOf('gus')).extra, 0);

console.log('\nGONE IN FULL BEFORE IT WAS EVER DELIVERED: NEVER DELIVERED');
mk('cs_hal', 'hal', 'votes', 500, { votes: '5' });
await hook(refundEv('cs_hal', 500, 500));
m = await mark('cs_hal');
eq('a settled marker with nothing granted', [m.delivered, m.granted, m.settledBy, m.lost], [true, 0, 'loss', 500]);
const late = await redeemSession(P, (await __stripe.sessions.get('cs_hal')).session);
eq('the return page that arrives later grants nothing', [late.already, (await fanOf('hal')).extra || 0], [true, 0]);
mk('cs_ivy', 'ivy', 'votes', 500, { votes: '5' });
await hook(disputeEv('charge.dispute.created', 'cs_ivy', 500, 'needs_response'));
eq('a chargeback on an undelivered pack: nothing delivered', (await fanOf('ivy')).extra || 0, 0);
await hook(disputeEv('charge.dispute.closed', 'cs_ivy', 500, 'won'));
m = await mark('cs_ivy');
eq('THE WIN: the fan paid after all, so the pack is delivered', [(await fanOf('ivy')).extra, m.delivered, m.granted], [5, true, 5]);
eq('and the record still says it was disputed, and won', m.dispute.status, 'won');
mk('cs_jo', 'jo', 'votes', 1000, { votes: '10' });
await hook(refundEv('cs_jo', 1000, 400));
eq('a PART refund before delivery delivers first, then takes its share', (await fanOf('jo')).extra, 6);
mk('cs_mug', 'kit', 'merch', 1800, { item: 'mabc125', title: 'Mug', qty: '1', ship: 'pickup', post: '0' });
await hook(refundEv('cs_mug', 1800, 1800, { kind: 'merch' }));
eq('merch refunded in full before it was delivered: no order to hand over', (await readMeta(P)).orders.some((o) => o.sid === 'cs_mug'), false);

console.log('\nTIPS, AND THE NIGHT’S MONEY');
await redeemSession(P, mk('cs_tip1', 'kim', 'tip', 2000, { note: 'great set' }));
await redeemSession(P, mk('cs_tip2', 'lou', 'tip', 1000));
const since = RECENT * 1000 - 1000;          // the tips were paid an hour ago, inside tonight
eq('tonight’s tips before', tipsTonight((await readMeta(P)).tips, since), { total: 30, count: 2 });
await hook(refundEv('cs_tip1', 2000, 2000, { kind: 'tip' }));
await hook(refundEv('cs_tip2', 1000, 400, { kind: 'tip' }));
eq('a tip gone in full is no tip; a part refund counts what stayed', tipsTonight((await readMeta(P)).tips, since), { total: 6, count: 1 });
eq('and a refunded tipper is not a tipper', [...tippersTonight((await readMeta(P)).tips, since)].includes('kim'), false);
const tipRow = (await readMeta(P)).tips.find((t) => t.sid === 'cs_tip2');
eq('the tip row carries its session and what went back', [tipRow.sid, tipRow.lost], ['cs_tip2', 400]);
const night = await moneyForShow(P, SHOW, Date.now() - 2 * 3600e3, Date.now());
/* the night's paid sessions, as Stripe reports them, less what went back:
   kept in full: cara 5 (won), eli 0 (chargeback), ann 0, bob 0, dan 0, fay 0, gus 0, hal 0, ivy 5, jo 6, lou 6, kim 0 */
eq('the night’s money is what was kept', night.gross, 22);
eq('its tips are what stayed', [night.tips.amount, night.tips.count], [6, 1]);
eq('and what went back is said, not hidden', night.lost, { amount: 69, count: 10 });
/* Stripe's own figure counts even when no event ever arrived: the charge on the
   expanded session says it was refunded, and that is enough. */
const sKeep = mk('cs_quiet', 'mo', 'tip', 1500);
sKeep.payment_intent = { id: 'pi_cs_quiet', latest_charge: { id: 'ch_q', amount_refunded: 1500 } };
const night2 = await moneyForShow(P, SHOW, Date.now() - 2 * 3600e3, Date.now());
eq('a refund Stripe knows and MySet was never told of still comes off', [night2.gross, night2.lost.count], [22, 11]);

console.log('\nA MERCH ORDER REFUNDED IN FULL IS CLOSED, AND NEVER HANDED OVER');
await redeemSession(P, mk('cs_tee', 'ned', 'merch', 2500, { item: 'mabc123', title: 'Tour tee', qty: '1', ship: 'pickup', variant: 'M', post: '0' }));
eq('one order to do', (await A('orderCount')).open >= 1, true);
const openBefore = (await A('orderCount')).open;
await hook(refundEv('cs_tee', 2500, 2500, { kind: 'merch' }));
const tee = (await readMeta(P)).orders.find((o) => o.sid === 'cs_tee');
eq('the order says refunded, and is done', [tee.refunded, tee.status, tee.lost], [true, 'done', 2500]);
eq('so it is not on the to-do count', (await A('orderCount')).open, openBefore - 1);
await redeemSession(P, mk('cs_cap', 'ned', 'merch', 3000, { item: 'mabc124', title: 'Cap', qty: '2', ship: 'pickup', post: '0' }));
await hook(refundEv('cs_cap', 3000, 1500, { kind: 'merch' }));
const cap = (await readMeta(P)).orders.find((o) => o.sid === 'cs_cap');
eq('a part refund leaves the order standing, with what went back on it', [!!cap.refunded, cap.status, cap.lost], [false, 'new', 1500]);
await hook(disputeEv('charge.dispute.created', 'cs_cap', 1500, 'needs_response'));
eq('a chargeback on it is on the row too', (await readMeta(P)).orders.find((o) => o.sid === 'cs_cap').dispute, 'needs_response');

console.log('\nNOT OURS: LEFT ALONE');
const metaBefore = JSON.stringify(await readMeta(P));
eq('a subscription’s refund', (await hook({ type: 'charge.refunded', data: { object: { id: 'ch_sub', payment_intent: 'pi_sub', amount: 1000, amount_refunded: 1000, captured: true, metadata: { kind: 'sub' } } } })).status, 200);
eq('a card hold released, never captured', (await hook({ type: 'charge.refunded', data: { object: { id: 'ch_h', payment_intent: 'pi_cs_ann', amount: 1000, amount_refunded: 1000, captured: false, metadata: { kind: 'request_hold' } } } })).status, 200);
eq('a payment no session of ours is behind', (await hook(refundEv('cs_nobody', 1000, 1000))).status, 200);
eq('none of them wrote a thing', JSON.stringify(await readMeta(P)), metaBefore);
eq('an event nothing handles still answers 200', (await hook({ type: 'payment_intent.created', data: { object: {} } })).status, 200);

console.log('\nA REFUND THAT COULD NOT BE WRITTEN ANSWERS 500, AND THE RETRY LANDS ONCE  (0138)');
await redeemSession(P, mk('cs_ola', 'ola', 'votes', 500, { votes: '5' }));
__failWrites(/^meta_/);
r = await hook(refundEv('cs_ola', 500, 500));
__failWrites(null);
eq('the webhook says so: 500, so Stripe sends it again', r.status, 500);
r = await hook(refundEv('cs_ola', 500, 500));
eq('the redelivery lands', [r.status, (await fanOf('ola')).extra, (await mark('cs_ola')).lost], [200, 0, 500]);
await hook(refundEv('cs_ola', 500, 500));
eq('and a third changes nothing', (await fanOf('ola')).extra, 0);

console.log('\nTHE TAKE-BACK RECEIPT RIDES INTO THE NEXT SHOW WITH THE VOTES  (carryFans)');
await carryFans(P, await getShow(P));
const caraNext = await fanOf('cara');
eq('cara carries her three unspent votes, and the receipt with them', [caraNext.extra, Array.isArray(caraNext.rb && caraNext.rb.cs_cara)], [3, true]);
const stale2 = await moveVotes(P, 'cara', 'cs_cara', 5, caraNext.rb.cs_cara[2] - 1, null);
eq('so a late, older step still cannot take them', [stale2.n, (await fanOf('cara')).extra], [0, 3]);

console.log('\nTHE ARTIST HEARS IT ONCE, ON THE SEATS THAT SEE MONEY  (a connected account)');
const keys = generateVapidKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
const lia = (await createArtist({ email: 'lia@example.com', name: 'Lia Tone', slug: 'lia-tone' })).artistId;
const b64u = (b) => Buffer.from(b).toString('base64url');
const phone = createECDH('prime256v1'); phone.generateKeys();
await saveSub(lia, { endpoint: 'https://push.example/lia-phone', keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(randomBytes(16)) } });
const liaTip = mk('cs_lia', 'pat', 'tip', 1200, {}, { owner: lia, acct: 'acct_lia' });
await redeemSession(lia, liaTip);
PUSH.length = 0;
const before2 = __stripe.calls.length;
r = await hook(disputeEv('charge.dispute.created', 'cs_lia', 1200, 'needs_response', { account: 'acct_lia' }));
eq('the session is found on the account the money lives on', __stripe.calls.slice(before2).filter((c) => c.method === 'checkout.sessions.list').map((c) => c.opts.stripeAccount), ['acct_lia']);
eq('the artist’s phone hears it', PUSH, ['lia-phone']);
eq('the tip is marked on HER record', (await mark('cs_lia', lia)).lost, 1200);
PUSH.length = 0;
await hook(disputeEv('charge.dispute.funds_withdrawn', 'cs_lia', 1200, 'needs_response', { account: 'acct_lia' }));
eq('the same news twice is heard once', PUSH, []);
await hook(disputeEv('charge.dispute.closed', 'cs_lia', 1200, 'won', { account: 'acct_lia' }));
eq('the decision is news', PUSH, ['lia-phone']);

console.log('\nWHAT THE ALERT SAYS');
const said = (p, was, moved = { n: 0, g: 0 }, order = null) => lossNote(p, was, moved, order, (o) => `${o.title} (${o.variant})`);
eq('a pack refunded', said({ kind: 'votes', amount: 10, refunded: 1000 }, '', { n: 6, g: 0 }),
   { title: 'A $10.00 vote pack was refunded', body: '6 votes not yet spent were taken back; votes already cast stay.' });
eq('a part of a tip', said({ kind: 'tip', amount: 20, refunded: 500 }, '').title, '$5.00 of a $20.00 tip was refunded');
eq('an order', said({ kind: 'merch', amount: 25, refunded: 2500 }, '', undefined, { title: 'Tour tee', variant: 'M' }).body, 'Tour tee (M) — don’t hand it over.');
eq('a chargeback', said({ kind: 'tip', amount: 12, dispute: { status: 'needs_response' } }, '').title, 'A $12.00 tip is disputed');
eq('a win', said({ kind: 'votes', amount: 5, dispute: { status: 'won' } }, '500|needs_response', { n: 0, g: 3 }),
   { title: 'You won the dispute on a $5.00 vote pack', body: 'The money is back with you. 3 votes went back to the fan.' });
eq('a question', said({ kind: 'tip', amount: 12, dispute: { status: 'warning_needs_response' } }, '').body, 'Nothing has been taken yet. Answer it in your Stripe dashboard.');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
