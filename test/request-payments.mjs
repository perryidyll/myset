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
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const { readRequests } = await import('../netlify/functions/_requests.mjs');
const { DEFAULT_ARTIST, getShow } = await import('../netlify/functions/_lib.mjs');
const { __stripe } = await import('./stripe-fake.mjs');
const { __failWrites } = await import('./blobs-fake.mjs');

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
const studio = () => hit(stageFn, 'https://x/api/stage?code=devlocal');   // the Studio's poll carries the requests
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
let asks = (await studio()).asks;
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
row = (await studio()).asks.find((r) => r.id === row.id);
eq('the request records that it was played and captured', [row.status, row.pledgeState], ['played', 'captured']);
eq('only one capture call was made', __stripe.calls.filter((c) => c.method === 'paymentIntents.capture' && c.args.id === pi).length, 1);

const next = await PAY({ fan: 'nextfan', kind: 'request_hold', title: 'Next Song', amount: 5, attempt: 'ask-next' });
await hit(confirm, `https://x/api/confirm?session_id=${next.id}&fan=nextfan`);
let nextRow = (await studio()).asks.find((r) => r.title === 'Next Song');
const nextAdded = await A('askAccept', { id: nextRow.id });
const nextSong = nextAdded.stage.songs.find((s) => s.title === 'Next Song');
await A('play', { song: nextSong.id });
eq('a second request is still held while it plays', intent(session(next.id).payment_intent).status, 'requires_capture');
await A('play', { song: 'alpha' });
eq('starting another song also captures the one just completed', intent(session(next.id).payment_intent).status, 'succeeded');

console.log('\nDECLINE RELEASES THE HOLD AND RETURNS THE VOTES');
const no = await PAY({ fan: 'nofan', kind: 'request_hold', title: 'No Thanks', amount: 5, attempt: 'ask-no' });
await hit(confirm, `https://x/api/confirm?session_id=${no.id}&fan=nofan`);
let noRow = (await studio()).asks.find((r) => r.title === 'No Thanks');
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
ok('and the request reaches the stage', (await studio()).asks.some((r) => r.title === 'Phone Closed'));
await A('status', { status: 'ended' });
eq('ending the show releases an unplayed request offer',
  intent(session(away.id).payment_intent).status, 'canceled');
await A('newShow');
const late = await hit(confirm, `https://x/api/confirm?session_id=${stale.id}&fan=stalefan`);
eq('a checkout returning in a later show is refused without a charge',
  [late.status, intent(session(stale.id).payment_intent).status], [409, 'canceled']);
ok('and it cannot create a request in the new room',
  !(await studio()).asks.some((r) => r.title === 'Yesterday Song'));

console.log('\nA PLEDGE IN A FAN\'S OWN BODY IS NOT A PAYMENT (0110)');
{
  /* Until 2026-09-28 the public door took `pledge` from the body as if Stripe had
     said so: one anonymous POST filed a "$500 offered" request whose acceptance
     minted five hundred paid votes nobody had paid for. Only the Stripe-verified
     path (authorizeRequestSession) may carry a pledge. */
  const fake = await hit(requestFn, 'https://x/api/request?fan=forger',
    { fan: 'forger', kind: 'song', title: 'Boost Me', artist: 'Nobody',
      pledge: { cents: 50000, session: 'cs_anything', intent: 'pi_anything', account: '' } });
  ok('the request itself goes through (it is an ordinary request)', fake.ok, fake);
  const forged = (await readRequests(DEFAULT_ARTIST)).list.find((r) => r.title === 'Boost Me');
  eq('…with no money on it', [forged.pledgeCents, forged.pledgeVotes, forged.pledgeState, forged.paymentSession, forged.paymentIntent],
     [undefined, undefined, undefined, undefined, undefined]);
  const shown = (await studio()).asks.find((r) => r.title === 'Boost Me');
  ok('the artist is not shown an offer', !shown.pledgeCents && !shown.pledgeVotes, shown);
  const took = await A('askAccept', { id: forged.id });
  const boosted = took.stage.songs.find((s) => s.title === 'Boost Me');
  eq('accepting it mints no paid votes', [boosted.votes, boosted.paidVotes || 0], [0, 0]);
}

console.log('\nTHE DOOR TO CHECKOUT HAS A LIMIT, AND A WHOLE BAR FITS UNDER IT (0111)');
{
  const { PAY_BURST, PAY_NET_BURST } = await import('../netlify/functions/_pay.mjs');
  const made = () => __stripe.calls.filter((c) => /checkout\.sessions\.create/.test(c.method || c)).length;
  const at = (fan, ip, attempt) => hit(pay, 'https://x/api/pay',
    { fan, kind: 'tip', amount: 5, attempt }, ip ? { 'x-nf-client-connection-ip': ip } : {});
  const start = made();
  let refused = null;
  for (let i = 0; i < PAY_BURST + 3; i++) {
    const r = await at('flood', '203.0.113.5', `flood-${i}`);
    if (r.status === 429 && refused === null) refused = i;
  }
  eq(`one phone opens ${PAY_BURST} checkouts in a row, then is told to wait`, [refused, made() - start], [PAY_BURST, PAY_BURST]);
  const other = await at('another-phone', '203.0.113.5', 'other-1');
  ok('another phone on the same network is not held up by it', other.ok && !!other.id, other);
  /* The worst real night: the artist says "tip jar's open" and two hundred phones
     on the bar's one wifi tap Buy in the same breath, each twice (a double tap, a
     retry on a bad signal). Not one of them may meet "Too many tries" — the first
     sizing of this limit would have refused all but sixty. */
  let barRefused = 0;
  for (let i = 0; i < 200; i++) for (let t = 0; t < 2 && 2 * i + t < PAY_NET_BURST; t++) {
    const r = await at(`bar-${i}`, '198.51.100.80', `bar-${i}-${t}`);
    if (r.status === 429) barRefused++;
  }
  eq('a packed bar on one wifi, everyone buying at once: nobody is refused', barRefused, 0);
  /* A script, meanwhile, invents a fresh device id per call. The bucket refills
     while the loop runs, so the test asserts the shape, not a count: nothing under
     the burst is refused, and a long enough run is. */
  let firstNetRefusal = null;
  for (let i = 0; i < PAY_NET_BURST + 40 && firstNetRefusal === null; i++) {
    const r = await at(`phone-${i}`, '198.51.100.44', `net-${i}`);
    if (r.status === 429) firstNetRefusal = i;
  }
  ok(`a script on one network is held near ${PAY_NET_BURST} in a row, however many device ids it invents`,
     firstNetRefusal !== null && firstNetRefusal >= PAY_NET_BURST, { firstNetRefusal });
  ok('a phone on a different network is unaffected', (await at('phone-x', '192.0.2.1', 'x-1')).ok);
  __failWrites(/^paylim_/);
  const open = await at('unlucky', '192.0.2.2', 'u-1');
  ok('a limiter that cannot be written never refuses a sale', open.ok && !!open.id, open);
  __failWrites(null);
}

/* THE VOTE PAGE'S SIDE OF BUYING (decision 0185). The functions are lifted out of
   vote.html by name and run against stubs, so what is asserted is what the page does. */
const { readFileSync } = await import('node:fs');
const votePage = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
const fanJs = readFileSync(new URL('../public/fan.js', import.meta.url), 'utf8');
const lift = (src, head) => {
  const s = src.indexOf(head); if (s < 0) return '';
  let depth = 0, i = src.indexOf('{', s + head.length - 1);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(s, i + 1);
  }
  return '';
};

console.log('\nTHE CHECKOUT LIMIT IS TOLD AS A BUSY ROOM, AND THE BUTTON STAYS USABLE  (0185)');
{
  const src = lift(votePage, 'async function checkout(kind){');
  ok('vote.html still has checkout()', !!src);
  const run = async (status, body) => {
    const toasts = [], btn = { disabled: false, innerHTML: '', textContent: '' };
    const f = new Function('$', 'sel', 'BUYSONG', 'VSONG', 'FAN', 'API', 'AQ1', 'timed', 'toast', 'pendingSet', 'goTo', 'artistFirst',
      src + '\nreturn checkout;');
    const checkout = f(() => btn, { pack: 'small' }, null, null, 'f1', '/api', '',
      async () => ({ status, json: async () => body }), (m) => toasts.push(m), () => {}, () => toasts.push('LEFT'), () => 'Perry');
    await checkout('votes');
    return { toasts, btn };
  };
  const busy = await run(429, { ok: false, error: 'Too many tries from this phone — give it a minute' });
  eq('a 429 says the room is busy', busy.toasts, ['Lots of people are buying at once — try again in a moment.']);
  ok('and the button can be pressed again', busy.btn.disabled === false && busy.btn.textContent === 'Continue to payment', busy.btn);
  const broken = await run(500, { ok: false, error: 'boom' });
  ok('any other failure keeps today\'s words', /^Card payments aren’t working right now/.test(broken.toasts[0] || ''), broken.toasts);
  ok('…and its button too', broken.btn.disabled === false);
  const fine = await run(200, { ok: true, url: 'https://checkout.stripe.test/x', id: 'cs_1' });
  eq('a checkout that opens leaves the page and says nothing else', fine.toasts, ['LEFT']);
  const real = await at429();
  async function at429() {
    // the server really answers 429 from this door, so the page's branch is not hypothetical
    const { PAY_BURST } = await import('../netlify/functions/_pay.mjs');
    let r = null;
    for (let i = 0; i < PAY_BURST + 1; i++) r = await hit(pay, 'https://x/api/pay', { fan: 'limit-0185', kind: 'votes', pack: 'small', attempt: 'l0168-' + i }, { 'x-nf-client-connection-ip': '192.0.2.168' });
    return r;
  }
  eq('the door it answers is /api/pay, at 429', real.status, 429);
}

console.log('\nIN INSTAGRAM\'S OR TIKTOK\'S BROWSER, THE VOTE PAGE SAYS WHERE BOUGHT VOTES WILL LIVE  (0185)');
{
  const line = (fanJs.match(/^const WV=.*$/m) || [''])[0];
  ok('the in-app-browser test lives in fan.js, once', !!line && (fanJs.match(/^const WV=/gm) || []).length === 1);
  const shop = readFileSync(new URL('../public/shop.html', import.meta.url), 'utf8');
  ok('the shop reads it from there and no longer declares its own', !/^const WV=/m.test(shop) && /\$\{WV\}’s browser/.test(shop));
  const wv = (ua) => new Function('navigator', line + '\nreturn WV;')({ userAgent: ua });
  eq('Instagram, Facebook and TikTok are named; Safari is not', [
    wv('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Instagram 300.0.0'),
    wv('Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/400.0]'),
    wv('Mozilla/5.0 (Linux; Android 13) BytedanceWebview/d8a21c6 musical_ly_2023'),
    wv('Mozilla/5.0 (iPhone) Version/17.0 Mobile/15E148 Safari/604.1'),
  ], ['Instagram', 'Facebook', 'TikTok', '']);
  const hint = lift(votePage, 'function wvHint(){');
  const draw = (W) => new Function('WV', 'VOTEHREF', hint + '\nreturn wvHint();')(W, '/perry/vote');
  eq('in a real browser the sheet says nothing extra', draw(''), '');
  const said = draw('Instagram');
  ok('in Instagram\'s it names the app and says the votes stay in the browser that buys them',
     /You’re in Instagram’s browser\./.test(said) && /Votes you buy stay in the browser you buy them in/.test(said), said);
  ok('and how to get out — the ··· menu, then Open in browser — with a link to copy', /Open in browser/.test(said) && /Copy link/.test(said));
  ok('it never blocks the purchase: no disabled Continue', !/disabled/.test(said));
  const buy = lift(votePage, 'function openBuy(){');
  ok('the pack sheet shows it right above Continue to payment', /\$\{wvHint\(\)\}<button class="go" id="goBuy"/.test(buy));
  ok('and so does paying for a replay', /\$\{wvHint\(\)\}<button class="go" id="goSongVotes"/.test(votePage));
}

console.log('\nCOMING BACK FROM CHECKOUT IN A BROWSER THAT DID NOT START IT, THE PAGE DOES NOT CLAIM THE VOTES  (0185)');
{
  const src = lift(votePage, 'async function redeem(sid,loud){');
  ok('vote.html still has redeem()', !!src);
  const run = async (pending, reply, loud = true) => {
    const toasts = [], store = { v: pending }, calls = { confetti: 0, resumed: null };
    const f = new Function('timed', 'API', 'AQ', 'FAN', 'pendingGet', 'pendingSet', 'toast', 'confetti', 'buzz', 'artistFirst', 'load', 'resumeVote',
      'let ME_DUE=false;\n' + src + '\nreturn redeem;');
    const redeem = f(async (u) => ({ status: 200, json: async () => reply }), '/api', '', 'f1',
      () => store.v, (v) => { store.v = v; }, (m) => toasts.push(m), () => calls.confetti++, () => {}, () => 'Perry',
      async () => {}, (id) => { calls.resumed = id; });
    await redeem('cs_paid', loud);
    await new Promise((r) => setTimeout(r, 0));
    return { toasts, store, calls };
  };
  const mine = await run({ id: 'cs_paid', at: Date.now(), song: 'alpha' }, { ok: true, kind: 'votes', granted: 5 });
  eq('this browser started it: the votes are added here, as before', mine.toasts, ['5 extra votes added — vote away!']);
  ok('with the confetti, the pending record cleared and the song sheet reopened', mine.calls.confetti === 1 && mine.store.v === null && mine.calls.resumed === 'alpha', mine);
  const away = await run(null, { ok: true, kind: 'votes', granted: 5 });
  eq('no pending record here: the toast says where the votes went, never "added"', away.toasts, ['Paid — the votes went to the browser you started in. Open this page there to use them.']);
  ok('no confetti over a wallet that did not change', away.calls.confetti === 0 && away.calls.resumed === null);
  const other = await run({ id: 'cs_other', at: Date.now() }, { ok: true, kind: 'votes', granted: 5 });
  ok('a pending record for a DIFFERENT purchase is the same answer — and is kept, so it is still redeemed',
     /went to the browser you started in/.test(other.toasts[0] || '') && other.store.v && other.store.v.id === 'cs_other', other);
  const already = await run(null, { ok: true, kind: 'votes', granted: 5, already: true });
  ok('already granted, from another browser: still the honest words, not "you’re all set"', /went to the browser you started in/.test(already.toasts[0] || ''), already.toasts);
  const tip = await run(null, { ok: true, kind: 'tip', amount: 5 });
  ok('a tip reaches the artist whichever browser comes back, and says so', /tip reached Perry/.test(tip.toasts[0] || ''), tip.toasts);
  /* Replay votes the song could no longer take go to the wallet (`asCredits`, from the
     confirm side). Absent on a server without it: the old words stay the default. */
  const here = { id: 'cs_paid', at: Date.now() };
  const replay = await run(here, { ok: true, kind: 'song_votes', granted: 5 });
  eq('paid replay votes, the song took them: the words as before', replay.toasts, ['5 paid votes added to that song']);
  const late = await run(here, { ok: true, kind: 'song_votes', granted: 5, asCredits: true });
  eq('the replay had started: the fan is told the votes are in the wallet', late.toasts, ['That replay had already started, so your 5 votes went to your wallet instead.']);
  const lateAway = await run(null, { ok: true, kind: 'song_votes', granted: 5, asCredits: true });
  ok('and from another browser, that wallet is the other browser’s', /went to the browser you started in/.test(lateAway.toasts[0] || ''), lateAway.toasts);
  const replayAway = await run(null, { ok: true, kind: 'song_votes', granted: 5 });
  eq('votes that went on the song are on the song, whichever browser comes back', replayAway.toasts, ['5 paid votes added to that song']);
  ok('the source says it in those words', votePage.includes("d.asCredits===true?`That replay had already started, so your ${d.granted||0} votes went to your wallet instead.`:`${d.granted||0} paid votes added to that song`"));
  const answer = await hit(confirm, 'https://x/api/confirm?session_id=cs_nope&fan=someone');
  ok('and the server is never asked whose they were: confirm carries no device id (0bu)', !('fan' in answer), Object.keys(answer));
}

console.log('\nA REQUEST TITLE IN ANY ALPHABET STILL BECOMES A REAL SONG');
const thai = await hit(requestFn, 'https://x/api/request?fan=thaifan',
  { fan: 'thaifan', kind: 'song', title: 'ทะเลใจ', artist: 'คาราบาว' });
ok('the Thai request reaches the artist', thai.ok, thai);
const thaiRow = (await studio()).asks.find((r) => r.title === 'ทะเลใจ');
const thaiAdded = await A('askAccept', { id: thaiRow.id });
ok('acceptance gives it a non-empty votable song id',
  thaiAdded.ok && thaiAdded.songId && thaiAdded.stage.songs.some((s) => s.id === thaiAdded.songId), thaiAdded);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
