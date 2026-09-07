/* CASTING SEVERAL VOTES AT ONCE, AND THE RULE THAT THEY ARE FINAL.

   The audience page now opens a sheet instead of casting on tap: it asks how many
   votes to put on the song and states the rules before the fan commits. Server
   side that means `/api/vote` takes a quantity, and `fan.v` holds one entry PER
   VOTE — so the same song id can appear several times. voteCounts and creditsUsed
   both work by counting entries, which is why multi-vote fell out of the existing
   shape instead of needing a new field.

   Finality shipped as a flag on 2026-09-02 and stopped being a question on
   2026-09-07: a vote stays on the song it was cast for until that song is played or
   the night ends, and it never comes back. The flag is deleted, the un-vote path
   with it, and the section that used to switch finality off to prove the refund
   still worked now proves the opposite — that there is no way back. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { readFans } = await import('../netlify/functions/_lib.mjs');
const { FLAGS, readFlags, flagValue } = await import('../netlify/functions/_flags.mjs');

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
const cast = (fan, song, n) => hit(voteFn, 'https://x/api/vote', { fan, song, n });
const songOf = async (fan, id) => {
  const d = await pub(fan);
  return (d.songs || []).concat(d.played || []).find((s) => s.id === id);
};

console.log('\nSETUP');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta']) await A('addSong', { title: t, artist: 'Test' });
await A('freeCredits', { n: 10 });
await A('replayCost', { n: 3 });
await A('status', { status: 'live' });
eq('ten free credits', (await pub('x')).credits.total, 10);

console.log('\nONE TAP CAN NOW BE SEVERAL VOTES');
const c4 = await cast('ann', 'alpha', 4);
ok('four votes on one song', c4.ok && c4.voted === true, c4);
eq('the server says how many it took', [c4.votes, c4.cost], [4, 4]);
eq('the song shows four', (await songOf('ann', 'alpha')).votes, 4);
eq('and the fan knows four of them are hers', (await songOf('ann', 'alpha')).mineCount, 4);
eq('six credits left', (await pub('ann')).credits.remaining, 6);
eq('the shard really holds four entries',
   ((await readFans('perry-idyll')).ann.v || []).filter((x) => x === 'alpha').length, 4);

console.log('\nTHE TALLY IS THE SUM OF EVERYONE\'S VOTES, NOT A HEAD-COUNT');
await cast('bob', 'alpha', 2);
await cast('cat', 'bravo', 5);
eq('alpha has six from two people', (await songOf('x', 'alpha')).votes, 6);
eq('bravo has five from one', (await songOf('x', 'bravo')).votes, 5);
eq('and alpha still leads', (await pub('x')).songs[0].id, 'alpha');

console.log('\nA FAN CANNOT CAST MORE THAN THEY HOLD  (INVARIANT 13, server-side)');
const over = await cast('dan', 'charlie', 11);
eq('eleven on ten credits is refused', [over.status, over.error], [402, 'no-credits']);
eq('and nothing was taken', (await pub('dan')).credits.remaining, 10);
ok('exactly ten is fine', (await cast('dan', 'charlie', 10)).ok);
eq('leaving nothing', (await pub('dan')).credits.remaining, 0);

console.log('\nREPLAYS ARE PRICED PER VOTE');
await A('play', { song: 'delta' });        // delta is now played; replayCost is 3
await A('play', { song: 'alpha' });
/* `eve` has not voted yet, so she still holds all ten. Starting a song no longer
   refreshes anybody — that was the point of 2026-09-07 — so this fixture leans on a
   fresh fan rather than on a round reset. */
const rep = await songOf('eve', 'delta');
eq('a replay costs three', rep.cost, 3);
const r2 = await cast('eve', 'delta', 2);
ok('two replay votes are accepted', r2.ok, r2);
eq('and cost six, not two', r2.cost, 6);
eq('leaving four', (await pub('eve')).credits.remaining, 4);

console.log('\nTHERE IS NO WAY BACK  (Perry, 2026-09-07)');
/* This section used to switch the finality flag OFF and assert that a second tap
   took the votes back and refunded all six credits. That is the behaviour that has
   been deleted. What is pinned now is that neither shape of request can undo a
   cast: not a bare tap, and not an explicit take-it-back from a page cached before
   the change. */
const bare = await hit(voteFn, 'https://x/api/vote', { fan: 'eve', song: 'delta' });
ok('a bare tap on a song she holds is another CAST, not an undo',
   bare.ok && bare.voted === true, bare);
eq('so the song now has three of her votes', (await songOf('eve', 'delta')).mineCount, 3);
eq('and it cost her another three credits', (await pub('eve')).credits.remaining, 1);
const undo = await hit(voteFn, 'https://x/api/vote', { fan: 'eve', song: 'delta', op: 'clear' });
eq('an explicit take-it-back is refused, in words a person can act on',
   [undo.status, undo.error], [409, 'Those votes are cast — they stay with the song']);
eq('nothing came back', (await pub('eve')).credits.remaining, 1);
eq('and the song kept every vote', (await songOf('eve', 'delta')).votes, 3);
eq('the shard agrees',
   ((await readFans('perry-idyll')).eve.v || []).filter((x) => x === 'delta').length, 3);

console.log('\nAND A SONG BEING PLAYED TAKES ITS VOTES, NOT HER CREDITS');
await A('play', { song: 'delta' });
/* Read from the shard, not the payload: delta is now the song PLAYING, and the
   public payload carries the one playing separately from the board. */
eq('her votes on it are gone from the shard',
   ((await readFans('perry-idyll')).eve.v || []).filter((x) => x === 'delta').length, 0);
eq('but she is no better off for it', (await pub('eve')).credits.remaining, 1);
eq('nine of her ten are spent, and stay spent', (await pub('eve')).credits.used, 9);

console.log('\nA HAND-MADE REQUEST CANNOT BLOW UP A FAN RECORD');
await A('unlimited', { on: true });
const huge = await cast('fay', 'bravo', 100000);
ok('an absurd quantity is accepted but capped', huge.ok, huge);
ok('at fifty or fewer', huge.votes <= 50, huge.votes);
await A('unlimited', { on: false });

console.log('\nTHE FLAG MACHINERY IS REAL, SCOPED, AND FAILS CLOSED ON A TYPO');
/* `voteFinal` was the flag these cases were written against. It is gone — the
   question had one answer left, and a flag sitting on its winning answer is dead
   code with a switch on it. `featuredShows` stands in, because what is being tested
   here is the machinery, not the opinion. */
const list = await A('flagList');
ok('the owner can list flags', list.ok && list.flags.some((f) => f.name === 'featuredShows'), list);
ok('every flag says what it does and how it gets removed',
   list.flags.every((f) => f.what && f.remove), list.flags);
ok('and the retired one really is gone',
   !list.flags.some((f) => f.name === 'voteFinal'), list.flags.map((f) => f.name));
eq('a typo is not a flag', flagValue(await readFlags(), 'featuredShow', 'perry-idyll'), false);
eq('setting an unknown flag is refused', (await A('flagSet', { flag: 'nope', on: true })).status, 400);
/* `FLAGS['toString']` is truthy — it is on the prototype chain — so a plain
   truthiness check let these through and PERSISTED them into the document. */
for (const junk of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
  eq(`"${junk}" is not a flag`, (await A('flagSet', { flag: junk, on: true })).status, 400);
  eq(`...and reads false`, flagValue(await readFlags(), junk, 'perry-idyll'), false);
}
const clean = await A('flagList');
ok('and none of them got into the document',
   !Object.keys((clean.byArtist || {})).length ||
   !JSON.stringify(clean.byArtist).includes('toString'), clean.byArtist);
const on = await A('flagSet', { flag: 'featuredShows', on: true });
eq('it can be switched on globally', on.inForce, true);
const off = await A('flagSet', { flag: 'featuredShows', on: false, artistId: 'perry-idyll' });
eq('one artist can be pinned back to off', off.inForce, false);
const cleared = await A('flagSet', { flag: 'featuredShows', on: null, artistId: 'perry-idyll' });
eq('clearing the override returns them to the global answer', cleared.inForce, true);
await A('flagSet', { flag: 'featuredShows', on: null });
eq('and clearing the global returns everyone to the default',
   flagValue(await readFlags(), 'featuredShows', 'perry-idyll'), true);
ok('nothing in the room payload still advertises a finality switch',
   (await pub('x')).flags.voteFinal === undefined, (await pub('x')).flags);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
