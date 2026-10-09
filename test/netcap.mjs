/* NEW PHONES PER NETWORK, AND A HEAD COUNT OF WHO IS STILL HERE  (decision 0149)

   Every new device id used to get tonight's free votes, and the id is the phone's own
   to choose: fifty requests with fifty fresh ids outvoted a fifty-phone room, and a
   few thousand "I'm here" pings from one laptop put a pub on twenty-second polls with
   a top-fifteen board for the rest of the night (the 2 October 2026 audit).

   Now a network brings at most about NEW_DEVICES_PER_NETWORK phones into a show with
   free votes — counted per fan file, in the write that is happening anyway. Past it a
   phone opens the page, sees the board and can buy votes; it is a phone that has
   already spent its free ones, and it leaves no record until it buys something. The
   head count that sets the polling rung and the board's length counts only phones
   seen in the last PRESENCE_WINDOW_MS. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const meFn = (await import('../netlify/functions/me.mjs')).default;
const boardFn = (await import('../netlify/functions/board.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const L = await import('../netlify/functions/_lib.mjs');
const { readFans, getShow, mutateFan, shardOf, countInRoom, unspentPaid, paidVoteCounts, creditsUsed,
        NEW_DEVICES_PER_NETWORK, NET_QUOTA, SHARDS, PRESENCE_WINDOW_MS, presenceDue, DEFAULT_ARTIST } = L;
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const call = async (h, url, { body, ip } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (ip) headers['x-forwarded-for'] = ip;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { code: r.status, ...JSON.parse(t) }; } catch { return { code: r.status, raw: t }; }
};
const A = (action, extra = {}) => call(admin, 'https://x/api/admin?code=devlocal', { body: { action, ...extra } });
const me = (fan, ip) => call(meFn, `https://x/api/me?fan=${fan}&in=1`, { ip });
let castN = 0;
const vote = (fan, song, ip) => call(voteFn, 'https://x/api/vote', { ip, body: { fan, song, n: 1, op: 'cast', cast: 'netcapcast' + String(castN++).padStart(8, '0') } });
const AID = DEFAULT_ARTIST;
/* Device ids the way the vote page makes them: 'f', eight base-36 characters, and a
   four-character tail. Spread from a fixed sequence so a run repeats exactly. */
const ids = (tag, n) => Array.from({ length: n }, (_, i) => 'f' + (((i + 1) * 2654435761 + tag.length * 97) >>> 0).toString(36).padStart(8, '0') + tag);
/* How many of these ids a network can have admitted: per file, up to the quota. */
const fits = (list) => {
  const per = Array(SHARDS).fill(0);
  for (const id of list) per[shardOf(id)]++;
  return per.reduce((s, n) => s + Math.min(n, NET_QUOTA), 0);
};
const freeOf = (r) => (r.credits || {}).freeRemaining;

console.log('\nSETUP');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) await A('addSong', { title: t, artist: 'T' });
await A('freeCredits', { n: 3 });   // three a phone, more than the default of one since decision 0172
await A('status', { status: 'live' });
const show = await getShow(AID);
ok('the room is live, three free votes a phone', show.status === 'live' && show.freeCredits === 3);
ok(`the quota per file is worked out from the one number (${NEW_DEVICES_PER_NETWORK} → ${NET_QUOTA} a file)`,
   Number.isInteger(NET_QUOTA) && NET_QUOTA * SHARDS >= NEW_DEVICES_PER_NETWORK, NET_QUOTA);

console.log('\nA WHOLE BAR ON ONE WIFI GETS ITS FREE VOTES');
const bar = ids('kq2x', 200);
let barIn = 0;
for (const f of bar) if (freeOf(await me(f, '203.0.113.20')) === 3) barIn++;
eq('every phone whose file had room is in', barIn, fits(bar));
ok(`two hundred phones on one address: ${barIn} of 200 with their free votes`, NEW_DEVICES_PER_NETWORK < 200 || barIn === 200, barIn);

console.log('\nA SCRIPT ON ONE NETWORK: A THOUSAND FRESH IDS');
const script = ids('zz9s', 1000);
const answers = [];
for (const f of script) answers.push(await me(f, '198.51.100.7'));
ok('every request got its page', answers.every((r) => r.code === 200 && r.ok), answers.find((r) => r.code !== 200));
const scriptIn = answers.filter((r) => freeOf(r) === 3).length;
eq('only as many as the files hold get free votes', scriptIn, fits(script));
ok(`${scriptIn} of 1,000 — never more than ${NET_QUOTA * SHARDS} from one network`, scriptIn <= NET_QUOTA * SHARDS, scriptIn);
const out = script.filter((f, i) => freeOf(answers[i]) !== 3);
const heldAnswer = answers[script.indexOf(out[0])];
eq('a phone held out is told it has no free votes, and nothing to spend',
   [heldAnswer.credits.freeRemaining, heldAnswer.credits.remaining, heldAnswer.credits.paidLeft], [0, 0, 0]);
let fans = await readFans(AID);
eq('and leaves no record in the files', out.filter((f) => fans[f]).length, 0);
eq('so the files grew by only the phones let in', script.filter((f) => fans[f]).length, scriptIn);
/* The page's call skips the write for such a phone; the stamp itself must refuse it
   too, for the phone whose read said "room" a moment before its file filled. */
{
  const late = out[2];
  const wrote = await L.markPresence(AID, late, show, new Request('https://x/api/me', { headers: { 'x-forwarded-for': '198.51.100.7' } }));
  ok('the stamp itself writes nothing for a phone held out with nothing to keep', wrote === null && !(await readFans(AID))[late], wrote);
}
const board = await call(boardFn, 'https://x/api/board');
ok('the board is there for everyone', board.code === 200 && (board.songs || []).length === 5, board.code);

console.log('\nNEVER A BUTTON THAT LEADS TO A SHRUG');
/* What /api/me says is what /api/vote does: a phone shown free votes can cast one, a
   phone shown none is refused for the reason the page already handles. */
let agree = 0, sample = 0;
for (const [i, f] of script.entries()) {
  if (sample >= 60) break;
  if (i % 7) continue;
  sample++;
  const shown = freeOf(answers[i]);
  const r = await vote(f, 'alpha', '198.51.100.7');
  if ((shown === 3 && r.code === 200) || (shown === 0 && r.code === 402 && r.error === 'no-credits')) agree++;
}
eq(`the page and the server agree for every one of ${sample} phones`, agree, sample);
fans = await readFans(AID);
eq('and a refused vote wrote nothing', out.filter((f) => fans[f]).length, 0);
const fromVote = ids('vv3t', 400);
let voteIn = 0;
for (const f of fromVote) if ((await vote(f, 'bravo', '198.51.100.8')).code === 200) voteIn++;
eq('a script that skips the page and votes straight away meets the same cap', voteIn, fits(fromVote));

console.log('\nA PHONE KEEPS THE NETWORK IT WAS LET IN ON');
/* Otherwise two addresses are a loop: let a file's worth in on one, move them all to
   the other, and the first has room again. A phone that changes network mid-gig is
   not written again for it — the rule vote.mjs has always kept with `||=`. */
{
  const inNow = script.filter((f, i) => freeOf(answers[i]) === 3);
  const mover = inNow[0], file = shardOf(mover);
  const before = (await readFans(AID))[mover].ipH, pre = freeOf(await me(mover, '198.51.100.7'));
  __opsStart();
  const moved = await me(mover, '198.51.100.250');
  ok('a phone that moves to another network is not written again', !__opsStop().some((o) => o.startsWith('set ')));
  ok('keeps what it had of its free votes', pre > 0 && freeOf(moved) === pre, [pre, moved.credits]);
  eq('and its network for the night', (await readFans(AID))[mover].ipH, before);
  const waiting = out.find((f) => shardOf(f) === file);
  eq('so no place opens on the network it left', freeOf(await me(waiting, '198.51.100.7')), 0);
}

console.log('\nA PHONE HELD OUT CAN STILL BUY VOTES');
/* A pack lands the way _pay.mjs grants one: `extra` and the session's proof, on a
   record the phone did not have. */
const buyer = out[1];
await mutateFan(AID, buyer, (r) => { r.gr = ['cs_test_netcap']; r.extra = (r.extra || 0) + 3; return true; });
const bought = await me(buyer, '198.51.100.7');
eq('three bought votes, no free ones', [bought.credits.remaining, bought.credits.freeRemaining, bought.credits.paidLeft], [3, 0, 3]);
const spent = await vote(buyer, 'charlie', '198.51.100.7');
ok('the vote lands', spent.code === 200 && spent.remaining === 2, spent);
const br = (await readFans(AID))[buyer];
eq('paid for out of the pack, not out of free votes it was never given', br.va.charlie.map((row) => row.slice(0, 2)), [[1, 1]]);
ok('so it counts as a paid vote on the Studio\'s pill', (paidVoteCounts({ [buyer]: br }).charlie || 0) === 1);
eq('and two bought votes are left to carry to the next show', unspentPaid(br, show, buyer), 2);
eq('the request check pay.mjs makes sees the same two', show.freeCredits + br.extra - creditsUsed(br, show), 2);
eq('nothing past the pack: the bought votes were all it had', [br.used, br.freeUsed], [4, 3]);

console.log('\nOTHER NETWORKS ARE THEIR OWN');
eq('a phone on its own mobile data gets its free votes', freeOf(await me('fmobile00001abc', '192.0.2.44')), 3);
eq('a request whose network cannot be named is not counted', freeOf(await me('fnoaddress001ab', '')), 3);
await A('unlimitedFan', { fan: 'fartistphone01', on: true });
const mine = await vote('fartistphone01', 'delta', '198.51.100.7');
ok('the artist\'s own unlimited phone is never held out', mine.code === 200 && mine.remaining === null, mine);

console.log('\nA SCRIPT CANNOT PUT A PUB ON THE SLOWEST RUNG');
/* The audit's own check: 3,001 pings from one address. They used to make a pub of
   fifty a room of 3,051: twenty-second polls and a board of fifteen. */
await A('newShow');
await A('status', { status: 'live' });
const pub = await getShow(AID);
for (const [i, f] of ids('pb5x', 50).entries()) await me(f, '203.0.113.' + (100 + i));
for (const f of ids('mm4q', 3001)) await me(f, '198.51.100.9');
const b2 = await call(boardFn, 'https://x/api/board');
ok(`counted ${b2.room.in}: the pub and at most one network's quota`, b2.room.in <= 50 + NET_QUOTA * SHARDS, b2.room);
ok('not the twenty-second rung', b2.nextPollMs < 20000, b2.nextPollMs);
ok('and not the board of fifteen', b2.board !== 15, b2.board);

console.log('\nTHE HEAD COUNT IS WHO IS STILL HERE');
const now = Date.now();
const room = {
  a: { seenShow: pub.showId, seenAt: now - 60e3 },                       // here a minute ago
  b: { seenShow: pub.showId, seenAt: now - PRESENCE_WINDOW_MS + 60e3 },  // just inside the window
  c: { seenShow: pub.showId, seenAt: now - PRESENCE_WINDOW_MS - 60e3 },  // gone quiet
  d: { seenShow: pub.showId },                                          // stamped before the window existed
  e: { seenShow: 'last-night', seenAt: now },                           // another night
};
eq('recent stamps and old-style ones count; a quiet one and last night\'s do not', countInRoom(room, pub, now), 3);
ok('the window outlasts the slowest a phone on the page polls (twenty times the twenty-second floor, plus jitter) and a refresh',
   PRESENCE_WINDOW_MS >= 20 * 20000 * 1.2 + Math.max(...['a', 'b', 'zz', 'fq81'].map(presenceDue)), PRESENCE_WINDOW_MS);
/* A phone still on the page refreshes its stamp now and then — once its stamp is
   older than its own due time, which is spread over ten minutes so a room that
   arrived together does not come back together. */
const keeper = 'fkeeper000001ab';
await me(keeper, '203.0.113.77');
__opsStart();
await me(keeper, '203.0.113.77');
ok('a fresh stamp is not written again', !__opsStop().some((o) => o.startsWith('set ')));
await mutateFan(AID, keeper, (r) => { r.seenAt = Date.now() - presenceDue(keeper) - 1000; return true; });
__opsStart();
await me(keeper, '203.0.113.77');
ok('a stamp past its due time is written again', __opsStop().some((o) => o.startsWith('set ')));
ok('and is recent now', Date.now() - (await readFans(AID))[keeper].seenAt < 5000);
const dues = ['a', 'b', 'c', 'fq81', keeper, 'zzzz'].map(presenceDue);
ok('due times differ from phone to phone, between ten and twenty minutes',
   new Set(dues).size > 3 && dues.every((d) => d >= 600e3 && d < 1200e3), dues);

console.log('\nTHE OLD /api/show ANSWERS THE SAME');
const legacy = await call(showFn, `https://x/api/show?fan=${ids('lg7w', 1)[0]}&in=1`, { ip: '198.51.100.9' });
eq('a phone past the cap on the old poll is shown no free votes either', [legacy.code, legacy.credits.freeRemaining], [200, 0]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
