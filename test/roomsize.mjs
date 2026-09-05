/* HOW BIG A ROOM CAN GET, AND WHAT HAPPENS WHEN IT GETS BIGGER.

   The point of this file is one design decision: the audience number on a plan is a
   BILLING line, not a turnstile. A room that goes over it is never closed, never
   refuses a vote and never turns anybody into a spectator — it slows itself down
   and shortens the board, and the artist hears about it afterwards.

   That is the market's answer as well as the kind one. Mentimeter publishes it as
   policy; the reason it is also the cheap answer is that one oversized night costs
   cents while a fan locked out mid-song costs the artist. If a future change makes
   the cap hard, these tests are what should stop it.

   The other half is the throttle. Every poll re-reads the whole audience bag, so
   traffic grows with the SQUARE of the room; widening the interval as the room
   grows is what keeps a big night in the same order of magnitude as a small one.
   The rungs are asserted here so nobody quietly flattens them back. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const show = (await import('../netlify/functions/show.mjs')).default;
const vote = (await import('../netlify/functions/vote.mjs')).default;
const admin = (await import('../netlify/functions/admin.mjs')).default;
const { PLANS } = await import('../netlify/functions/_plan.mjs');
const { pollFloorFor, boardLimitFor, countInRoom, getShow, mutateShow, mutateFan } =
  await import('../netlify/functions/_lib.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } =
  await import('../netlify/functions/_auth.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

console.log('\nEVERY TIER HAS A NUMBER, AND THEY GO UP');
ok('free has one', PLANS.free.audience > 0);
ok('Plus is bigger than free', PLANS.plus.audience > PLANS.free.audience);
ok('Pro is bigger than Plus', PLANS.pro.audience > PLANS.plus.audience);
ok('and none of them is infinite — that was the hole',
   [PLANS.free, PLANS.plus, PLANS.pro].every(p => Number.isFinite(p.audience)));

console.log('\nTHE THROTTLE WIDENS WITH THE ROOM, AND NEVER NARROWS');
eq('an ordinary gig is unchanged at 3 seconds', pollFloorFor(8), 3000);
eq('and still is at 200', pollFloorFor(200), 3000);
ok('201 is slower than 200', pollFloorFor(201) > pollFloorFor(200));
ok('1,001 is slower than 1,000', pollFloorFor(1001) > pollFloorFor(1000));
ok('3,001 is slower than 3,000', pollFloorFor(3001) > pollFloorFor(3000));
ok('it is monotonic all the way up', (() => {
  let last = 0;
  for (const n of [0, 1, 8, 100, 200, 201, 500, 1000, 1001, 2000, 3000, 3001, 10000, 100000]) {
    const v = pollFloorFor(n);
    if (v < last) return false;
    last = v;
  }
  return true;
})());
ok('a rubbish head count still answers with the ordinary interval',
   pollFloorFor(undefined) === 3000 && pollFloorFor(-5) === 3000 && pollFloorFor(NaN) === 3000);

console.log('\nTHE BOARD SHORTENS THE SAME WAY');
eq('a normal room gets the whole list', boardLimitFor(150), null);
ok('a big one does not', boardLimitFor(1200) > 0);
ok('and a huge one is shorter still', boardLimitFor(9000) < boardLimitFor(1200));

console.log('\nSETUP  a free artist with a full library and a live show');
const a = await createArtist({ email: 'roomy@example.com', name: 'Roomy', slug: 'roomy' });
const reg = await readArtists();
const T = await signToken('roomy@example.com', revOf(reg, a.artistId));
const A = async (action, extra = {}) => {
  const r = await admin(new Request('https://x/api/admin', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + T },
    body: JSON.stringify({ action, ...extra }) }));
  return { status: r.status, ...await r.json().catch(() => ({})) };
};
for (let i = 0; i < 60; i++) await A('addSong', { title: 'Song ' + i, artist: 'Roomy' });
await A('newShow');

const s0 = await getShow(a.artistId);
eq('the night carries the plan’s number, stamped when it started',
   s0.roomCap, PLANS.free.audience);

const poll = async (fan) => {
  const r = await show(new Request(
    `https://x/api/show?a=roomy&in=1&fan=${fan}`, { headers: { 'x-forwarded-for': '203.0.113.9' } }));
  /* `code`, not `status`: the payload has a `status` of its own ("live") and
     spreading it over an HTTP status silently turned 200 into 'live'. */
  return { code: r.status, ...await r.json() };
};

console.log('\nA SMALL ROOM IS EXACTLY WHAT IT ALWAYS WAS');
const first = await poll('fanaaaaaaaa');
eq('three seconds', first.nextPollMs, 3000);
eq('the whole board', first.board, null);
eq('not over', first.room.over, false);
eq('and the cap is told to the page', first.room.cap, PLANS.free.audience);

console.log('\nFILL IT PAST THE CAP');
const cap = PLANS.free.audience;
const live = await getShow(a.artistId);
for (let i = 0; i < cap + 25; i++) {
  await mutateFan(a.artistId, 'f' + String(i).padStart(9, '0'), (me) => {
    me.seenShow = live.showId; me.ipH = 'x'; return true;
  });
}
const over = await poll('fanaaaaaaaa');
ok('the room knows it is over', over.room.over === true, over.room);
ok('and counts everybody in it', over.room.in >= cap, over.room.in);

console.log('\nAND NOTHING IS TAKEN AWAY FROM ANYBODY');
ok('the poll still works', over.code === 200, over.code);
ok('the songs are still there', (over.songs || []).length > 0);
ok('nobody is a spectator — there is no such state', over.room.watching === undefined);
ok('the page is asked to slow down instead', over.nextPollMs > 3000, over.nextPollMs);
ok('and the board is shortened instead', over.board > 0, over.board);
eq('to exactly what the dial says', over.board, boardLimitFor(over.room.in));
ok('the list obeys it', (over.songs || []).length <= over.board, (over.songs || []).length);

console.log('\nA PHONE THAT ARRIVES AFTER THE CAP CAN STILL VOTE');
/* THE WHOLE POINT. This fan was never counted before the room filled, which under
   a hard cap is precisely the person who would have been refused. */
const latecomer = 'zzzlateeeee';
const seen = await poll(latecomer);
ok('they get a normal page', seen.code === 200 && (seen.songs || []).length > 0, seen.code);
const target = seen.songs[0].id;
const cast = await vote(new Request('https://x/api/vote?a=roomy', { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
  body: JSON.stringify({ a: 'roomy', fan: latecomer, song: target, n: 1, op: 'cast', cast: 'castid00001' }) }));
const castBody = await cast.json().catch(() => ({}));
ok('and their vote is taken', cast.status === 200, { status: cast.status, castBody });

console.log('\nYOUR OWN SONG NEVER FALLS OFF YOUR BOARD');
/* A fan whose song is 90th out of 60 shown has to still see it, or the only
   conclusion available to them is that MySet lost the vote. */
const mineNow = await poll(latecomer);
const mineRow = (mineNow.songs || []).find((x) => x.id === target);
ok('it is on the list even with a short board', !!mineRow, {
  board: mineNow.board, shown: (mineNow.songs || []).length,
});
ok('and it is marked as theirs', !!(mineRow && mineRow.mineCount > 0));

console.log('\nCOUNTING IS PER NIGHT, NOT FOR EVER');
const before = countInRoom({ f1: { seenShow: 'sh_old' }, f2: { seenShow: live.showId } }, live);
eq('last night’s crowd is not in tonight’s room', before, 1);
eq('and a show with no id counts nobody', countInRoom({ f1: { seenShow: 'x' } }, {}), 0);

console.log('\nA SHOW THAT STARTED BEFORE CAPS EXISTED IS NOT CAPPED MID-GIG');
await mutateShow(a.artistId, (sh) => { delete sh.roomCap; return true; });
const legacy = await poll('fanaaaaaaaa');
eq('no cap is claimed', legacy.room.cap, null);
eq('and it is not "over" anything', legacy.room.over, false);
ok('but the throttle still protects the room', legacy.nextPollMs > 3000, legacy.nextPollMs);

console.log('\nA PAID PLAN GETS A BIGGER ROOM ON ITS NEXT NIGHT');
await mutateArtists((r) => { r.byId[a.artistId].plan = 'pro'; return true; });
await A('endShow');
await A('newShow');
const proShow = await getShow(a.artistId);
eq('Pro’s number is stamped on the new night', proShow.roomCap, PLANS.pro.audience);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
