/* VOTE FINALITY, and the thing that has to exist before it can be switched on.

   The un-vote toggle was quietly doing a second job: it made voting idempotent. A
   lost response found the vote already cast and removed it — annoying, but
   self-correcting and never a double charge. Take the toggle away and the same lost
   response casts AGAIN, on bar wifi, at replay prices.

   So the first section here is the cast id, and it matters with the flag OFF too.
   The rest holds finality itself: what is refused, what still refunds because the
   ARTIST caused it, and that nothing about the money ledger moved. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { readFans } = await import('../netlify/functions/_lib.mjs');
const { readFileSync } = await import('node:fs');

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
const setFinal = (on) => A('flagSet', { flag: 'voteFinal', on });

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

console.log('\nA CAST ID IS ONLY GOOD FOR THE ROUND IT WAS MADE IN');
await A('play', { song: 'echo' });                    // new round: votes wiped
eq('the round reset cleared her votes', await votesOn('ann', 'alpha'), 0);
const reused = await send({ fan: 'ann', song: 'alpha', n: 1, op: 'cast', cast: ID1 });
ok('the same id is a NEW cast now', reused.ok && !reused.replay, reused);
eq('because the votes it referred to are gone', await votesOn('ann', 'alpha'), 1);

console.log('\nA REPLAYED TAKE-BACK IS ALSO ONLY DONE ONCE  (finality off for this bit)');
await setFinal(false);            // there is no take-back to replay when it is on
const ID3 = 'cast0000000000000003';
await send({ fan: 'bob', song: 'bravo', n: 4, op: 'cast', cast: 'cast0000000000000004' });
const clr = await send({ fan: 'bob', song: 'bravo', op: 'clear', cast: ID3 });
eq('four votes came back', clr.removed, 4);
await send({ fan: 'bob', song: 'charlie', n: 2, op: 'cast', cast: 'cast0000000000000005' });
const clrAgain = await send({ fan: 'bob', song: 'bravo', op: 'clear', cast: ID3 });
eq('the replayed clear is answered from memory', clrAgain.replay, true);
eq('and did not touch the votes she has since cast', await votesOn('bob', 'charlie'), 2);

/* ── 2. FINALITY ITSELF ──────────────────────────────────────────────────── */
console.log('\nWITH THE FLAG ON, A FAN CANNOT TAKE VOTES BACK');
eq('it was turned off above', (await pub('x')).flags.voteFinal, false);
await setFinal(true);
eq('now on', (await pub('x')).flags.voteFinal, true);
await send({ fan: 'cat', song: 'delta', n: 3, op: 'cast', cast: 'cast0000000000000006' });
eq('three cast', await votesOn('cat', 'delta'), 3);
const refused = await send({ fan: 'cat', song: 'delta', op: 'clear', cast: 'cast0000000000000007' });
eq('the take-back is refused', refused.status, 409);
ok('and says why, in words a fan understands', /stay with the song/i.test(refused.error || ''), refused.error);
eq('the votes are still there', await votesOn('cat', 'delta'), 3);
eq('and no credit came back', (await pub('cat')).credits.used, 3);

console.log('\nTHE OLD TOGGLE CANNOT SNEAK PAST THE FLAG  (a cached page sends no op)');
const sneak = await send({ fan: 'cat', song: 'delta', cast: 'cast0000000000000008' });
eq('a bare body is refused too', sneak.status, 409);
eq('votes untouched', await votesOn('cat', 'delta'), 3);
ok('and the response tells the client the rule', (await pub('cat')).flags.voteFinal === true);

console.log('\nCASTING MORE ON THE SAME SONG STILL WORKS  (finality is not a lock-out)');
const addMore = await send({ fan: 'cat', song: 'delta', n: 2, op: 'cast', cast: 'cast0000000000000009' });
ok('she can add to her own votes', addMore.ok && addMore.voted === true, addMore);
eq('five on the song', await votesOn('cat', 'delta'), 5);

console.log('\nADDING MORE TO A SONG YOU ALREADY HOLD IS NOT TAKING ONE BACK');
await setFinal(true);
await send({ fan: 'gus', song: 'charlie', n: 1, op: 'cast', cast: 'cast0000000000000020' });
eq('one cast', await votesOn('gus', 'charlie'), 1);
const topUp = await send({ fan: 'gus', song: 'charlie', n: 4, op: 'cast', cast: 'cast0000000000000021' });
ok('four more are accepted while final', topUp.ok && topUp.voted === true, topUp);
eq('five in total', await votesOn('gus', 'charlie'), 5);
eq('but the take-back is still refused',
   (await send({ fan: 'gus', song: 'charlie', op: 'clear', cast: 'cast0000000000000022' })).status, 409);
await setFinal(false);

console.log('\nWHAT THE ARTIST DOES IS NOT WHAT THE FAN PROMISED');
/* Finality is a promise the FAN cannot undo their own vote. It was never a promise
   that a song they voted for will still exist — so when the artist deletes it, the
   capacity comes back. Anything else would let an artist pocket a room's credits. */
await send({ fan: 'dan', song: 'bravo', n: 4, op: 'cast', cast: 'cast0000000000000010' });
eq('four credits committed', (await pub('dan')).credits.used, 4);
await A('removeSong', { song: 'bravo' });   // removeSong takes `song`, not `id`
eq('THE ARTIST deleted it, so the votes are gone', await votesOn('dan', 'bravo'), 0);
eq('and the fan has their credits back', (await pub('dan')).credits.used, 0);

console.log('\nAND THE PAID LEDGER IS UNCHANGED BY ANY OF THIS  (INVARIANT 13b)');
const { redeemSession } = await import('../netlify/functions/_pay.mjs');
await redeemSession('perry-idyll', { id: 'cs_fin', payment_status: 'paid', amount_total: 500,
  created: 1756000000, metadata: { fan: 'eve', kind: 'votes', votes: '5' } });
eq('eve bought five', (await pub('eve')).credits.paidLeft, 5);
await send({ fan: 'eve', song: 'charlie', n: 12, op: 'cast', cast: 'cast0000000000000011' });
eq('she spends ten free plus two bought', (await pub('eve')).credits.used, 12);
await A('play', { song: 'alpha' });
eq('the round settles exactly the paid portion',
   ((await readFans('perry-idyll')).eve || {}).extra, 3);

console.log('\nAND IT ALL GOES BACK  (the flag is a switch, not a migration)');
await setFinal(false);   // finality is the SHIPPED default; this proves the other way still works
eq('off again', (await pub('x')).flags.voteFinal, false);
await send({ fan: 'fay', song: 'charlie', n: 2, op: 'cast', cast: 'cast0000000000000012' });
const back = await send({ fan: 'fay', song: 'charlie', op: 'clear', cast: 'cast0000000000000013' });
ok('taking votes back works again', back.ok && back.voted === false, back);
eq('two returned', back.removed, 2);

/* ── 3. THE PAGE AGREES WITH THE SERVER, IN BOTH STATES ──────────────────── */
console.log('\nTHE PAGE SAYS THE SAME THING THE SERVER DOES');
const page = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
ok('Confirm mints a fresh cast id', /function newCastId\(/.test(page));
ok('and it is minted at Confirm, not when the sheet opens',
   /function confirmVote\(\)\{[\s\S]{0,200}newCastId\(\)/.test(page), 'confirmVote must call newCastId');
ok('the cast id and the op both go to the server',
   /op:op\|\|'cast',cast:castId\|\|''/.test(page.replace(/\s/g, '')) ||
   /op:\s*op\s*\|\|\s*'cast'[\s,]*cast:/.test(page), 'body must carry op and cast');
ok('the finality rule replaces the change-your-mind rule, not sits beside it',
   /fin\s*\?\s*'Once you confirm/.test(page));
/* These two used to assert that a held song was made INERT under finality. A
   reviewer with fresh context showed that was wrong, and the reason is the point of
   the whole sheet: finality means a fan cannot take a vote BACK, not that they
   cannot add more. The server always allowed it (want = mine + n); only the page
   blocked it, so a fan who confirmed at the default of 1 could never spend their
   other four credits on the same song. */
ok('a held song is still reachable under finality — it is the take-back that is refused',
   /if\(s\.mine&&!finNow\)returnopenUnvote/.test(page.replace(/\s/g, '')),
   'openVote must fall through to the cast sheet when final');
ok('and the queue row stays a real button, not an inert state',
   !/qvb on done/.test(page) && /class="qvb \$\{s\.mine\?'on':''\}"/.test(page));
ok('the row is only disabled for affordability, never for holding votes',
   /!\(s\.mine&&!fin\)/.test(page.replace(/\s/g, '')), 'row() dis rule');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
