/* A VOTE IS FINAL, and the thing that had to exist before it could be.

   The un-vote toggle was quietly doing a second job: it made voting idempotent. A
   lost response found the vote already cast and removed it — annoying, but
   self-correcting and never a double charge. Take the toggle away and the same lost
   response casts AGAIN, on bar wifi, at replay prices.

   So the first section here is the cast id. The rest holds the rule itself, which
   stopped being a flag on 2026-09-07 and became the whole game: a vote stays on the
   song it was cast for until that song is played or the night ends, and it never
   comes back — not when the song loses, not when the artist drops it, not when the
   artist deletes it. Sections that used to assert a refund now assert the opposite,
   and are kept in place rather than removed so the change is legible. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { readFans } = await import('../netlify/functions/_lib.mjs');
const { readFileSync } = await import('node:fs');
const page0 = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');

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
const send = (b) => hit(voteFn, 'https://x/api/vote', b);
const votesOn = async (fan, id) =>
  (((await readFans('perry-idyll'))[fan] || {}).v || []).filter((x) => x === id).length;

console.log('\nSETUP');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) await A('addSong', { title: t, artist: 'T' });
await A('freeCredits', { n: 10 });
await A('replayCost', { n: 3 });
await A('status', { status: 'live' });
eq('ten free credits', (await pub('x')).credits.total, 10);

/* ── 1. THE CAST ID — the prerequisite, and it works with the flag OFF ────── */
console.log('\nA REPLAYED CAST IS NOT A SECOND CAST  (INVARIANT 15h)');
const ID1 = 'cast0000000000000001';
const first = await send({ fan: 'ann', song: 'alpha', n: 3, op: 'cast', cast: ID1 });
ok('the cast lands', first.ok && first.voted === true, first);
eq('three votes', first.votes, 3);
const again = await send({ fan: 'ann', song: 'alpha', n: 3, op: 'cast', cast: ID1 });
ok('THE BUG: the retry is answered, not re-cast', again.ok, again);
eq('and it says so', again.replay, true);
eq('still exactly three votes on the song', await votesOn('ann', 'alpha'), 3);
eq('and only three credits gone', (await pub('ann')).credits.used, 3);

console.log('\nA DIFFERENT PRESS OF CONFIRM IS A DIFFERENT CAST');
const ID2 = 'cast0000000000000002';
const more = await send({ fan: 'ann', song: 'alpha', n: 2, op: 'cast', cast: ID2 });
ok('a second, distinct cast is accepted', more.ok && more.voted === true, more);
eq('five votes now', await votesOn('ann', 'alpha'), 5);
eq('five credits used', (await pub('ann')).credits.used, 5);

console.log('\nA CAST ID IS GOOD FOR THE WHOLE NIGHT NOW');
/* It used to be cleared with the round, because a replayed id after a wipe referred
   to votes that no longer existed and swallowing it would have eaten the fan's first
   vote of the new round. There are no rounds. The ring (last 20) now lives as long
   as the fan record does, and a retry of the same press of Confirm is answered from
   memory however long ago it was — which is what a retry should get. */
await A('play', { song: 'echo' });                    // a DIFFERENT song starts
eq('THE CHANGE: another song starting does not touch her votes', await votesOn('ann', 'alpha'), 5);
eq('nor give her any credits back', (await pub('ann')).credits.used, 5);
const reused = await send({ fan: 'ann', song: 'alpha', n: 1, op: 'cast', cast: ID1 });
eq('and a retry of the original press is still answered from memory', reused.replay, true);
eq('so it did not quietly cast again', await votesOn('ann', 'alpha'), 5);

console.log('\nAN ACKED-BUT-LOST WRITE CANNOT CAST TWICE  (INVARIANT 4 meets 15h)');
/* The dangerous shape: the shard write lands but the read-back verify says it did
   not, so casDoc re-runs the mutator. Without the cast-id ring being checked INSIDE
   the mutator, the re-run would cast n votes a second time. */
const { __failWrites } = await import('./blobs-fake.mjs');
const IDR = 'castretry0000000001';
await send({ fan: 'ret', song: 'charlie', n: 2, op: 'cast', cast: IDR });
eq('two cast normally', await votesOn('ret', 'charlie'), 2);
__failWrites(/^f\d+_/);                       // every fan write now acks without sticking
const lost = await send({ fan: 'ret', song: 'charlie', n: 3, op: 'cast', cast: 'castretry0000000002' });
__failWrites(null);
eq('the lost write changed nothing', await votesOn('ret', 'charlie'), 2);
const replayLost = await send({ fan: 'ret', song: 'charlie', n: 3, op: 'cast', cast: 'castretry0000000002' });
ok('and retrying that id casts it exactly once', replayLost.ok, replayLost);
eq('five now, not eight', await votesOn('ret', 'charlie'), 5);
const replayAgain = await send({ fan: 'ret', song: 'charlie', n: 3, op: 'cast', cast: 'castretry0000000002' });
eq('a third attempt is a replay', replayAgain.replay, true);
eq('still five', await votesOn('ret', 'charlie'), 5);

console.log('\nAND THE PAGE ACTUALLY REUSES THE ID  (otherwise it is nominal)');
ok('vote() retries once with the same body',
   /let d=null;[\s\S]{0,240}d=await post\(\);[\s\S]{0,240}d=await post\(\);/.test(page0),
   'vote() must retry with the same cast id');

console.log('\nA MALFORMED CAST ID IS REFUSED, NOT QUIETLY IGNORED');
/* Dropping it silently left the request with no idempotency at all — the one thing
   the id exists to provide, so failing quietly is worse than failing. */
for (const bad of ['short', 'has spaces here', 'x'.repeat(80), '../../etc', '\u0000nul']) {
  const r = await send({ fan: 'zed', song: 'charlie', n: 1, op: 'cast', cast: bad });
  eq(`refused: ${JSON.stringify(bad).slice(0, 22)}`, [r.status, r.error], [400, 'bad cast id']);
}
eq('and nothing was cast', await votesOn('zed', 'charlie'), 0);
ok('an absent id is still fine — an old page has no concept of one',
   (await send({ fan: 'zed', song: 'charlie', n: 1, op: 'cast' })).ok);

/* A section here replayed a TAKE-BACK and checked it only happened once. There is
   no take-back to replay. */

/* ── 2. FINALITY ITSELF ──────────────────────────────────────────────────── */
console.log('\nA FAN CANNOT TAKE VOTES BACK. EVER.');
await send({ fan: 'cat', song: 'delta', n: 3, op: 'cast', cast: 'cast0000000000000006' });
eq('three cast', await votesOn('cat', 'delta'), 3);
const refused = await send({ fan: 'cat', song: 'delta', op: 'clear', cast: 'cast0000000000000007' });
eq('the take-back is refused', refused.status, 409);
ok('and says why, in words a fan understands', /stay with the song/i.test(refused.error || ''), refused.error);
eq('the votes are still there', await votesOn('cat', 'delta'), 3);
eq('and no credit came back', (await pub('cat')).credits.used, 3);

console.log('\nA PAGE CACHED FROM BEFORE THE RULE IS ANSWERED, NOT OBEYED');
/* Such a page sends `op:'clear'` when somebody taps a song they hold. It is refused
   with a sentence. A bare body with no op at all is the OLDEST shape, from before
   ops existed, and that one is treated as a cast — which is what the tap now means. */
const sneak = await send({ fan: 'cat', song: 'delta', op: 'clear', cast: 'cast0000000000000008' });
eq('an explicit take-back is refused', sneak.status, 409);
eq('votes untouched', await votesOn('cat', 'delta'), 3);
ok('and the response says the rule out loud',
   (await send({ fan: 'cat', song: 'charlie', n: 1, op: 'cast', cast: 'cast0000000000000018' })).final === true);

console.log('\nCASTING MORE ON THE SAME SONG STILL WORKS  (finality is not a lock-out)');
const addMore = await send({ fan: 'cat', song: 'delta', n: 2, op: 'cast', cast: 'cast0000000000000009' });
ok('she can add to her own votes', addMore.ok && addMore.voted === true, addMore);
eq('five on the song', await votesOn('cat', 'delta'), 5);

console.log('\nADDING MORE TO A SONG YOU ALREADY HOLD IS NOT TAKING ONE BACK');
await send({ fan: 'gus', song: 'charlie', n: 1, op: 'cast', cast: 'cast0000000000000020' });
eq('one cast', await votesOn('gus', 'charlie'), 1);
const topUp = await send({ fan: 'gus', song: 'charlie', n: 4, op: 'cast', cast: 'cast0000000000000021' });
ok('four more are accepted while final', topUp.ok && topUp.voted === true, topUp);
eq('five in total', await votesOn('gus', 'charlie'), 5);
eq('but the take-back is still refused',
   (await send({ fan: 'gus', song: 'charlie', op: 'clear', cast: 'cast0000000000000022' })).status, 409);

console.log('\nNOT EVEN WHEN THE ARTIST IS THE ONE WHO TOOK THE SONG AWAY');
/* This case used to assert the opposite, and the reasoning was good: finality was a
   promise the FAN could not undo their own vote, never a promise the song would
   still exist, so an artist deleting it gave the capacity back. Perry decided
   otherwise on 2026-09-07 — a vote is spent when it is cast, full stop. Worth
   knowing what that costs: an artist who deletes a song their room paid to hear
   keeps the money, and nothing in the code stops them. It is his call and it is
   written down here rather than left to be discovered. */
await send({ fan: 'dan', song: 'bravo', n: 4, op: 'cast', cast: 'cast0000000000000010' });
eq('four credits committed', (await pub('dan')).credits.used, 4);
await A('removeSong', { song: 'bravo' });   // removeSong takes `song`, not `id`
eq('THE ARTIST deleted it, so the votes leave the board', await votesOn('dan', 'bravo'), 0);
eq('but the fan is not given anything back', (await pub('dan')).credits.used, 4);

console.log('\nAND THE PAID LEDGER IS UNCHANGED BY ANY OF THIS  (INVARIANT 13b)');
const { redeemSession } = await import('../netlify/functions/_pay.mjs');

/* A REALISTIC CREATION TIME. These were a fixed 2025 timestamp, which only worked
   because the Stripe test double ignored the `created` window. It no longer does —
   and neither does Stripe — so a session dated last year now falls outside
   revenue.mjs's 180-day window exactly as a real one would. */
const RECENT = Math.floor(Date.now() / 1000) - 3600;
await redeemSession('perry-idyll', { id: 'cs_fin', payment_status: 'paid', amount_total: 500,
  created: RECENT, metadata: { fan: 'eve', kind: 'votes', votes: '5' } });
eq('eve bought five', (await pub('eve')).credits.paidLeft, 5);
await send({ fan: 'eve', song: 'charlie', n: 12, op: 'cast', cast: 'cast0000000000000011' });
eq('she spends ten free plus two bought', (await pub('eve')).credits.used, 12);
eq('and exactly two came off the pack, at the cast', (await pub('eve')).credits.paidLeft, 3);
await A('play', { song: 'charlie' });
eq('the song being played does not hand any of it back', (await pub('eve')).credits.paidLeft, 3);
eq('and her balance is what it was', (await pub('eve')).credits.remaining, 3);

/* ── 3. THE PAGE AGREES WITH THE SERVER ─────────────────────────────────── */
console.log('\nTHE PAGE SAYS THE SAME THING THE SERVER DOES');
const page = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
ok('Confirm mints a fresh cast id', /function newCastId\(/.test(page));
ok('and it is minted at Confirm, not when the sheet opens',
   /function confirmVote\(\)\{[\s\S]{0,200}newCastId\(\)/.test(page), 'confirmVote must call newCastId');
ok('the cast id goes to the server, and the op is always a cast',
   /op:'cast',cast:castId\|\|''/.test(page.replace(/\s/g, '')), 'body must carry op:cast and the id');

/* The approved wording, checked as SHIPPED TEXT rather than as a rule the
   code happens to follow. A fan agreeing to something they were not told is the
   only way this design is unfair, so the sentence is the feature. */
ok('the sheet says a vote cannot be changed',
   /can.{0,6}t be changed<\/b>/.test(page), 'the "can-t be changed" line');
ok('and that it does not come back',
   /don.{0,6}t come back<\/i><\/b>/.test(page), 'the "don-t come back" line');
/* One "come straight back" is allowed to stand, and only one: a song REQUEST the
   artist DECLINES really is refunded, because nothing was ever put on the board for
   it. That is a different thing from a vote losing, and request.mjs really does it. */
const backTalk = (page.match(/come straight back|votes come back|Take .{0,12} back/g) || []);
eq('the only "you get it back" left on the page is the declined request',
   backTalk, ['come straight back']);
ok('and it is about a request, not a vote',
   /decides \u2014 if it\u2019s a no, your votes come straight back|decides — if it’s a no, your votes come straight back/.test(page),
   'the surviving line must be the ask-card one');
/* Finality means a fan cannot take a vote BACK, not that they cannot add more. The
   server always allowed it (want = mine + n); the page used to send a held song to
   an un-vote sheet instead, so a fan who confirmed at the default of 1 could never
   spend their other four credits on the same song. */
ok('a held song opens the ordinary sheet, so more can be added',
   !/openUnvote\(/.test(page.replace(/\/\*[\s\S]*?\*\//g, '')),
   'openUnvote must be gone, not just unreachable');
ok('and the queue row stays a real button, not an inert state',
   !/qvb on done/.test(page) && /class="qvb \$\{s\.mine\?'on':''\}"/.test(page));
ok('the row is disabled only for affordability, except when an empty wallet can buy more',
   /constdis=!open\|\|\(!c\.unlimited&&c\.remaining<cost&&\!\(c\.remaining<=0&&ST\.paymentsEnabled\)\)/
     .test(page.replace(/\s/g, '')), 'row() dis rule');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
