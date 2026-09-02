/* CASTING SEVERAL VOTES AT ONCE, AND THE FLAG THAT WILL LATER MAKE THEM FINAL.

   The audience page now opens a sheet instead of casting on tap: it asks how many
   votes to put on the song and states the rules before the fan commits. Server
   side that means `/api/vote` takes a quantity, and `fan.v` holds one entry PER
   VOTE — so the same song id can appear several times. voteCounts and creditsUsed
   both work by counting entries, which is why multi-vote fell out of the existing
   shape instead of needing a new field.

   Finality is NOT on yet. It is written as a flag with both answers real, so a gig
   can be run each way before choosing. These cases hold the un-vote refund
   (INVARIANT 15) in place until that decision is made. */
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
await A('play', { song: 'alpha' });        // ...and a new round, so credits refresh
const rep = await songOf('eve', 'delta');
eq('a replay costs three', rep.cost, 3);
const r2 = await cast('eve', 'delta', 2);
ok('two replay votes are accepted', r2.ok, r2);
eq('and cost six, not two', r2.cost, 6);
eq('leaving four', (await pub('eve')).credits.remaining, 4);

console.log('\nA SECOND TAP TAKES BACK EVERYTHING AND REFUNDS IT  (INVARIANT 15, flag off)');
eq('finality is off by default', FLAGS.voteFinal.default, false);
eq('and off in force', flagValue(await readFlags(), 'voteFinal', 'perry-idyll'), false);
const undo = await cast('eve', 'delta');
ok('the tap un-votes', undo.ok && undo.voted === false, undo);
eq('it says how many it removed', undo.removed, 2);
eq('all six credits came back', (await pub('eve')).credits.remaining, 10);
eq('and the song lost both votes', (await songOf('eve', 'delta')).votes, 0);
eq('the shard has no entries left for it',
   ((await readFans('perry-idyll')).eve.v || []).filter((x) => x === 'delta').length, 0);

console.log('\nA HAND-MADE REQUEST CANNOT BLOW UP A FAN RECORD');
await A('unlimited', { on: true });
const huge = await cast('fay', 'bravo', 100000);
ok('an absurd quantity is accepted but capped', huge.ok, huge);
ok('at fifty or fewer', huge.votes <= 50, huge.votes);
await A('unlimited', { on: false });

console.log('\nTHE FLAG IS REAL, SCOPED, AND FAILS CLOSED ON A TYPO');
const list = await A('flagList');
ok('the owner can list flags', list.ok && list.flags.some((f) => f.name === 'voteFinal'), list);
ok('every flag says what it does and how it gets removed',
   list.flags.every((f) => f.what && f.remove), list.flags);
eq('a typo is not a flag', flagValue(await readFlags(), 'voetFinal', 'perry-idyll'), false);
eq('setting an unknown flag is refused', (await A('flagSet', { flag: 'nope', on: true })).status, 400);
const on = await A('flagSet', { flag: 'voteFinal', on: true });
eq('it can be switched on globally', on.inForce, true);
eq('and the room is told, so the sheet can change its words',
   (await pub('x')).flags.voteFinal, true);
const off = await A('flagSet', { flag: 'voteFinal', on: false, artistId: 'perry-idyll' });
eq('one artist can be pinned back to off', off.inForce, false);
eq('which the payload reflects', (await pub('x')).flags.voteFinal, false);
const cleared = await A('flagSet', { flag: 'voteFinal', on: null, artistId: 'perry-idyll' });
eq('clearing the override returns them to the global answer', cleared.inForce, true);
await A('flagSet', { flag: 'voteFinal', on: null });
eq('and clearing the global returns everyone to the default',
   (await pub('x')).flags.voteFinal, false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
