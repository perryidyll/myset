/* Paid replay votes and song-request authorizations. Real handlers, fake Blobs and
   fake Stripe: no network, no production data. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_local_tests_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_for_local_tests_only';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const pay = (await import('../netlify/functions/pay.mjs')).default;
const confirm = (await import('../netlify/functions/confirm.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const requestFn = (await import('../netlify/functions/request.mjs')).default;
const webhook = (await import('../netlify/functions/webhook.mjs')).default;
const { readRequests } = await import('../netlify/functions/_requests.mjs');
const { DEFAULT_ARTIST, getShow } = await import('../netlify/functions/_lib.mjs');
const { __stripe } = await import('./stripe-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (fn, url, body, extra = {}) => {
  const headers = { 'content-type': 'application/json', ...extra };
  const r = await fn(new Request(url, body === undefined ? { headers } : {
    method: 'POST', headers, body: JSON.stringify(body),
  }));
  const text = await r.text();
  try { return { status: r.status, ...JSON.parse(text) }; }
  catch { return { status: r.status, raw: text }; }
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const PAY = (body) => hit(pay, 'https://x/api/pay', body);
const PUB = (fan) => hit(showFn, `https://x/api/show?fan=${fan}`);
const session = (id) => __stripe.sessions.get(id).session;
const intent = (id) => __stripe.paymentIntents.get(id).intent;

console.log('\nSETUP');
await A('addSong', { title: 'Alpha', artist: 'Test' });
await A('addSong', { title: 'Bravo', artist: 'Test' });
await A('status', { status: 'live' });
await A('play', { song: 'alpha' });
await A('play', { song: 'bravo' });
await A('askSet', { kind: 'song', on: true, cost: 3 });
eq('birthday requests default to three votes', (await getShow(DEFAULT_ARTIST)).birthdays.cost, 3);

console.log('\nCASH REPLAY VOTES');
const replay = await PAY({ fan: 'replayfan', kind: 'song_votes', song: 'alpha', amount: 5, attempt: 'replay-one' });
ok('a $5 replay checkout opens', replay.ok && !!replay.id, replay);
eq('$1 is exactly one paid vote in Stripe metadata', session(replay.id).metadata.votes, '5');
eq('the replay charge is captured immediately', session(replay.id).payment_status, 'paid');
const replayDone = await hit(confirm, `https://x/api/confirm?session_id=${replay.id}&fan=replayfan`);
eq('the return grants five votes directly to the song', [replayDone.kind, replayDone.granted], ['song_votes', 5]);
let alpha = (await A('window', { open: true })).stage.songs.find((s) => s.id === 'alpha');
eq('the artist sees all five as paid votes', [alpha.votes, alpha.paidVotes], [5, 5]);
eq('they are not loose wallet credits', (await PUB('replayfan')).credits.extra, 0);

console.log('\nREQUEST AUTHORIZATION, ACCEPTANCE, AND COMPLETION');
const held = await PAY({ fan: 'askfan', kind: 'request_hold', title: 'Long Train', artist: 'Band', amount: 10, attempt: 'ask-one' });
ok('a $10 request authorization opens', held.ok && !!held.id, held);
const hs = session(held.id), pi = hs.payment_intent;
eq('Checkout is manual capture, not a charge',
  [hs.payment_status, hs.payment_intent_data.capture_method, intent(pi).status],
  ['unpaid', 'manual', 'requires_capture']);
const [authorized, authorizedAgain] = await Promise.all([
  hit(confirm, `https://x/api/confirm?session_id=${held.id}&fan=askfan`),
  hit(confirm, `https://x/api/confirm?session_id=${held.id}&fan=askfan`),
]);
eq('the return creates the request but does not charge',
  [authorized.kind, authorized.amount, intent(pi).status], ['request_hold', 10, 'requires_capture']);
ok('a simultaneous webhook/return-style race also resolves successfully', authorizedAgain.ok, authorizedAgain);
let asks = (await A('askList')).asks;
let row = asks.find((r) => r.title === 'Long Train');
eq('the artist sees the offered amount and paid-vote value',
  [row.status, row.pledgeCents, row.pledgeVotes, row.pledgeState],
  ['pending', 1000, 10, 'authorized']);
eq('the ordinary request still costs three votes', (await PUB('askfan')).credits.used, 3);
eq('a webhook/return retry cannot spend those votes twice', (await PUB('askfan')).credits.used, 3);
eq('and cannot create a second request',
  (await readRequests(DEFAULT_ARTIST)).list.filter((r) => r.paymentSession === held.id).length, 1);

const accepted = await A('askAccept', { id: row.id });
ok('the artist accepts it onto the setlist', accepted.ok, accepted);
const requestedSong = accepted.stage.songs.find((s) => s.title === 'Long Train');
eq('the accepted offer becomes ten paid votes in the queue',
  [requestedSong.votes, requestedSong.paidVotes], [10, 10]);
eq('acceptance alone still does not charge the card', intent(pi).status, 'requires_capture');

await A('play', { song: requestedSong.id });
eq('starting the requested song still does not charge', intent(pi).status, 'requires_capture');
const finished = await A('endSong');
ok('ending the song succeeds', finished.ok, finished);
eq('completion captures the held payment exactly once', intent(pi).status, 'succeeded');
row = (await A('askList')).asks.find((r) => r.id === row.id);
eq('the request records that it was played and captured', [row.status, row.pledgeState], ['played', 'captured']);
eq('only one capture call was made', __stripe.calls.filter((c) => c.method === 'paymentIntents.capture' && c.args.id === pi).length, 1);

const next = await PAY({ fan: 'nextfan', kind: 'request_hold', title: 'Next Song', amount: 5, attempt: 'ask-next' });
await hit(confirm, `https://x/api/confirm?session_id=${next.id}&fan=nextfan`);
let nextRow = (await A('askList')).asks.find((r) => r.title === 'Next Song');
const nextAdded = await A('askAccept', { id: nextRow.id });
const nextSong = nextAdded.stage.songs.find((s) => s.title === 'Next Song');
await A('play', { song: nextSong.id });
eq('a second request is still held while it plays', intent(session(next.id).payment_intent).status, 'requires_capture');
await A('play', { song: 'alpha' });
eq('starting another song also captures the one just completed', intent(session(next.id).payment_intent).status, 'succeeded');

console.log('\nDECLINE RELEASES THE HOLD AND RETURNS THE VOTES');
const no = await PAY({ fan: 'nofan', kind: 'request_hold', title: 'No Thanks', amount: 5, attempt: 'ask-no' });
await hit(confirm, `https://x/api/confirm?session_id=${no.id}&fan=nofan`);
let noRow = (await A('askList')).asks.find((r) => r.title === 'No Thanks');
eq('three votes are attached while it waits', (await PUB('nofan')).credits.used, 3);
const declined = await A('askDecline', { id: noRow.id });
eq('decline returns all three votes', [declined.refunded, (await PUB('nofan')).credits.used], [3, 0]);
eq('and cancels rather than captures the card authorization', intent(session(no.id).payment_intent).status, 'canceled');

console.log('\nTHE WEBHOOK CAN CREATE THE REQUEST WITHOUT A RETURN TRIP');
const away = await PAY({ fan: 'awayfan', kind: 'request_hold', title: 'Phone Closed', amount: 5, attempt: 'ask-away' });
const stale = await PAY({ fan: 'stalefan', kind: 'request_hold', title: 'Yesterday Song', amount: 5, attempt: 'ask-stale' });
const event = { type: 'checkout.session.completed', data: { object: session(away.id) } };
const wh = await hit(webhook, 'https://x/api/webhook', event, { 'stripe-signature': 't=1,v1=test' });
ok('Stripe webhook is accepted', wh.received, wh);
ok('and the request reaches the stage', (await A('askList')).asks.some((r) => r.title === 'Phone Closed'));
await A('status', { status: 'ended' });
eq('ending the show releases an unplayed request offer',
  intent(session(away.id).payment_intent).status, 'canceled');
await A('newShow');
const late = await hit(confirm, `https://x/api/confirm?session_id=${stale.id}&fan=stalefan`);
eq('a checkout returning in a later show is refused without a charge',
  [late.status, intent(session(stale.id).payment_intent).status], [409, 'canceled']);
ok('and it cannot create a request in the new room',
  !(await A('askList')).asks.some((r) => r.title === 'Yesterday Song'));

console.log('\nA REQUEST TITLE IN ANY ALPHABET STILL BECOMES A REAL SONG');
const thai = await hit(requestFn, 'https://x/api/request?fan=thaifan',
  { fan: 'thaifan', kind: 'song', title: 'ทะเลใจ', artist: 'คาราบาว' });
ok('the Thai request reaches the artist', thai.ok, thai);
const thaiRow = (await A('askList')).asks.find((r) => r.title === 'ทะเลใจ');
const thaiAdded = await A('askAccept', { id: thaiRow.id });
ok('acceptance gives it a non-empty votable song id',
  thaiAdded.ok && thaiAdded.songId && thaiAdded.stage.songs.some((s) => s.id === thaiAdded.songId), thaiAdded);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
