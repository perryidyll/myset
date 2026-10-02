/* THE SHARED-BOARD SPLIT  (P3-001, decision 0034)

   /api/show?fan=<id> used to be the one thing every phone in the room polled: the
   whole board plus that phone's own credits, in one payload that could never be
   cached because the fan id was in the address. Now the board is /api/board — the
   same bytes for everyone, no fan id, cacheable at the edge for the polling
   interval — and what is personal is /api/me. public/vote.html fetches both and
   puts them back together on the phone.

   What this file holds to:
     · the board carries NOTHING personal and the personal call carries NO board
     · the board is byte-identical whoever asks for it, and says how long the edge may keep it
     · presence is stamped by the personal call, never by the shared one
     · the old /api/show is exactly the two halves merged — one definition, not two
     · the phone's copy of that merge (mergeBoard in vote.html) agrees with the server's
     · a fan's own song comes back onto a shortened board from the tail (INVARIANT 0el)
     · a cached board older than this phone's own vote cannot make the vote vanish
     · if the personal call fails, the board still renders — the room can still vote */
import { readFileSync } from 'node:fs';
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin   = (await import('../netlify/functions/admin.mjs')).default;
const showFn  = (await import('../netlify/functions/show.mjs')).default;
const boardFn = (await import('../netlify/functions/board.mjs')).default;
const meFn    = (await import('../netlify/functions/me.mjs')).default;
const voteFn  = (await import('../netlify/functions/vote.mjs')).default;
const { mergeForOne, freshCredits } = await import('../netlify/functions/_board.mjs');
const { mutateFan, getShow, DEFAULT_ARTIST, boardLimitFor } = await import('../netlify/functions/_lib.mjs');
const { __opsStart, __opsStop, __slowReads } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail).slice(0, 600)); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const eq = (name, got, want) => ok(name, same(got, want), { got, want });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const call = async (h, u, b) => {
  const r = await h(new Request(u, b === undefined ? { headers: { 'x-forwarded-for': '203.0.113.9' } } : { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' }, body: JSON.stringify(b) }));
  const text = await r.text();
  let body = {}; try { body = JSON.parse(text); } catch {}
  return { status: r.status, headers: Object.fromEntries(r.headers), text, body };
};
const A = (action, x = {}) => call(admin, 'https://x/api/admin?code=devlocal', { action, ...x });
const board = () => call(boardFn, 'https://x/api/board');
const me = (fan) => call(meFn, `https://x/api/me?fan=${fan}&in=1`);
const legacy = (fan) => call(showFn, `https://x/api/show?fan=${fan}&in=1`);
const vote = (fan, song, n = 1) => call(voteFn, 'https://x/api/vote', { fan, song, n, op: 'cast', cast: 'split' + fan + song + n + Math.random().toString(36).slice(2, 8) });
const ops = async (fn) => { __opsStart(); const r = await fn(); return { r, log: __opsStop() }; };
/* `at` is a clock reading and differs between two renders of the same room; the
   parity checks compare everything else. */
const noClock = (d) => { const { at, ...rest } = d; return rest; };

/* THE PHONE'S COPY OF THE MERGE, lifted out of vote.html and run here against the
   server's. The page keeps three globals the function reads; they are declared the
   way the page declares them. */
const page = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
const start = page.indexOf('function mergeBoard(b,m){');
ok('vote.html still has mergeBoard', start > 0);
const fnSrc = (() => {
  let depth = 0, i = page.indexOf('{', start);
  for (; i < page.length; i++) {
    if (page[i] === '{') depth++;
    else if (page[i] === '}' && --depth === 0) return page.slice(start, i + 1);
  }
  return '';
})();
const phone = new Function('SHOWN', 'SHOWN_T', 'FLOOR', fnSrc + '; return { mergeBoard, get SHOWN() { return SHOWN; } };');
const onPhone = (b, m, shown = {}, shownT = 0, floor = 3000) => phone(shown, shownT, floor).mergeBoard(b, m);

console.log('\nSETUP  eight songs, a live show, a few voters');
const titles = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
for (const t of titles) await A('addSong', { title: t, artist: 'T' });
await A('status', { status: 'live' });
eq('alpha gets two votes from two phones', [(await vote('fanA', 'alpha')).status, (await vote('fanB', 'alpha')).status], [200, 200]);
eq('bravo gets one from fanA', (await vote('fanA', 'bravo')).status, 200);
const cast = await vote('fanC', 'charlie');
ok('a cast answers with the server clock, for the phone to date its board by', typeof cast.body.at === 'number' && cast.body.at > 1.7e12, cast.body);

console.log('\nTHE BOARD IS EVERYBODY\'S, AND ONLY EVERYBODY\'S');
const b1 = await board();
eq('200', b1.status, 200);
ok('it says how long the edge may keep it — exactly the polling interval', /s-maxage=3\b/.test(b1.headers['netlify-cdn-cache-control']) && b1.body.nextPollMs === 3000, b1.headers);
ok('durable, so the whole room shares one copy', /\bdurable\b/.test(b1.headers['netlify-cdn-cache-control']), b1.headers);
ok('with a stale-while-revalidate so the moment it expires is not a stampede', /stale-while-revalidate=3\b/.test(b1.headers['netlify-cdn-cache-control']), b1.headers);
ok('and the BROWSER may not keep a copy of its own', b1.headers['cache-control'] === 'public, max-age=0, must-revalidate', b1.headers);
ok('nothing personal on it: no credits, no myAsks', !('credits' in b1.body) && !('myAsks' in b1.body), Object.keys(b1.body));
ok('no song on it knows whose it is', b1.body.songs.every((s) => !('mine' in s) && !('mineCount' in s)), b1.body.songs[0]);
ok('the tally is there', b1.body.songs.find((s) => s.id === 'alpha').votes === 2, b1.body.songs);
ok('and the whole board, in a small room, with no tail', b1.body.board === null && b1.body.tail === null, { board: b1.body.board, tail: b1.body.tail });
ok('it carries the free allowance, for a phone that cannot reach its own record', b1.body.freeCredits === 3, b1.body.freeCredits);
ok('and the clock it was rendered at', typeof b1.body.at === 'number', b1.body.at);
const b1x = await call(boardFn, 'https://x/api/board?fan=somebodyelse&in=1');
eq('a fan id in the address changes nothing — the bytes are the same for every phone', noClock(b1x.body), noClock(b1.body));
{
  const { log } = await ops(() => call(boardFn, 'https://x/api/board?fan=newphone&in=1'));
  ok('and the shared board never writes, so it cannot stamp anybody as present', !log.some((l) => l.startsWith('set')), log);
}

console.log('\nTHE PERSONAL CALL IS ONE PHONE\'S, AND ONLY ONE PHONE\'S');
const m1 = await me('fanA');
eq('200', m1.status, 200);
eq('never cached', m1.headers['cache-control'], 'no-store');
eq('this phone\'s own votes, per song', m1.body.votes, { alpha: 1, bravo: 1 });
eq('the titles of what it holds — no tally, that is the board\'s', m1.body.held.map((h) => [h.id, h.title, 'votes' in h]), [['alpha', 'Alpha', false], ['bravo', 'Bravo', false]]);
eq('two of three free votes spent', [m1.body.credits.remaining, m1.body.credits.freeTotal], [1, 3]);
ok('when it last cast, server clock', typeof m1.body.lastAt === 'number' && m1.body.lastAt > 0, m1.body.lastAt);
ok('no board on it: no songs, no played, no tally', !('songs' in m1.body) && !('played' in m1.body) && !('totalVotes' in m1.body), Object.keys(m1.body));
eq('a phone with no fan id is refused, not guessed at', (await call(meFn, 'https://x/api/me?in=1')).status, 400);
{
  const { r, log } = await ops(() => me('fanA'));
  const shards = log.filter((l) => /^get f\d+_/.test(l));
  eq('it reads exactly one shard — its own', shards.length, 1);
  ok('and not the registry', !log.some((l) => / artists$/.test(l)), log);
  ok('and, once present, writes nothing', !log.some((l) => l.startsWith('set')), log);
  ok('the show is not dark, so the votes are shown', Object.keys(r.body.votes).length === 2, r.body);
}

console.log('\nPRESENCE IS STAMPED BY THE PERSONAL CALL');
const before = (await board()).body.room.in;
await me('fanNEW');
const after = (await board()).body.room.in;
eq('one more phone in the room after its first /api/me', after, before + 1);
eq('and the same phone again is not counted twice', (await me('fanNEW'), (await board()).body.room.in), after);

console.log('\nTHE OLD DOOR IS THE TWO HALVES MERGED — ONE DEFINITION');
/* This is a CONSISTENCY check, not a check against the past: /api/show is now
   mergeForOne itself. Parity with the show.mjs that shipped before the split was
   checked once, by hand, against `git show HEAD:netlify/functions/show.mjs` on the
   same in-memory store across fifteen scenarios (session file 2026-09-11); only the
   additive keys `at` and `freeCredits` differed. */
for (const fan of ['fanA', 'fanB', 'fanC', 'fanNEW', 'stranger']) {
  // the personal call first: a phone's first call of the night stamps it present,
  // and the board and the old door must both be counting the same room
  const m = (await me(fan)).body;
  const [b, l] = [(await board()).body, (await legacy(fan)).body];
  eq(`/api/show?fan=${fan} is mergeForOne(board, me), through the handler`, noClock(mergeForOne(b, m)), noClock(l));
  eq(`and the phone's copy of the merge agrees for ${fan}`, noClock(onPhone(b, m)), noClock(mergeForOne(b, m)));
}
{
  const l = (await legacy('fanA')).body;
  ok('the merged shape marks what is mine', l.songs.find((s) => s.id === 'alpha').mineCount === 1 && l.songs.find((s) => s.id === 'charlie').mine === false, l.songs);
  ok('and carries no tail — that is for the phone to use', !('tail' in l), Object.keys(l));
}

console.log('\nIF THE PERSONAL CALL FAILS, THE BOARD STILL RENDERS');
{
  const b = (await board()).body;
  const d = onPhone(b, null);
  eq('every song is there', d.songs.length, b.songs.length);
  eq('nobody\'s votes are claimed', d.songs.filter((s) => s.mine).length, 0);
  eq('the credits are the honest fresh-phone numbers, from the board itself', d.credits, freshCredits(b));
  eq('and no requests are shown', d.myAsks, []);
  eq('the server side says the same thing', noClock(mergeForOne(b, null)), noClock(d));
}

console.log('\nA CACHED BOARD OLDER THAN MY OWN VOTE CANNOT MAKE IT VANISH');
{
  const stale = (await board()).body;               // rendered BEFORE the vote below
  await sleep(3);
  const v = await vote('fanD', 'delta', 2);
  eq('the vote lands', v.status, 200);
  await sleep(3);
  const m = (await me('fanD')).body;
  ok('the personal call knows the vote is newer than that board', m.lastAt > stale.at, { lastAt: m.lastAt, at: stale.at });
  const shown = { delta: { votes: 2, mine: 2 } };  // what the phone showed itself when it cast
  const d = onPhone(stale, m, shown, Date.now());
  const row = d.songs.find((s) => s.id === 'delta');
  eq('so the stale board is lifted to what the phone already showed', [row.votes, row.mine, row.mineCount], [2, true, 2]);
  const fresh = (await board()).body;              // rendered AFTER the vote
  ok('a board rendered after the vote counts it by itself', fresh.at >= m.lastAt && fresh.songs.find((s) => s.id === 'delta').votes === 2, fresh.songs);
  const holder = phone(shown, Date.now(), 3000);
  const d2 = holder.mergeBoard(fresh, m);
  eq('and the phone lets go of its own number once the board has caught up', [d2.songs.find((s) => s.id === 'delta').votes, Object.keys(holder.SHOWN).length], [2, 0]);
  // the safety valve: no personal state at all, and the number is old
  const d3 = onPhone(stale, null, shown, Date.now() - 20000);
  eq('with no personal state, the phone trusts its eyes only for four intervals', d3.songs.find((s) => s.id === 'delta').votes, stale.songs.find((s) => s.id === 'delta').votes);
}

console.log('\nTHE BOARD\'S CLOCK IS READ BEFORE THE ROOM IS, AND A CAST\'S AFTER ITS WRITE LANDS');
/* The reviewer's finding on 2026-09-11: the board used to take its clock AFTER the
   twelve reads, and a vote stamps `lastAt` on the record BEFORE its write lands. A
   board rendered across a vote could therefore look NEWER than the vote while not
   containing it, and the phone dropped its own number for a poll. Two things close
   that: the board's `at` is taken before its reads begin, and the vote's answer
   carries a clock taken after its write is verified, which the page prefers over
   the record's `lastAt` (CAST_AT in vote.html). The race itself cannot be staged
   deterministically in a store whose every read takes the same time — so the two
   placements are asserted directly, with reads slowed enough to tell them apart. */
{
  __slowReads(60);
  const t0 = Date.now();
  const b = (await board()).body;
  ok('the board\'s clock is taken before its reads (not after 60ms of them)', b.at - t0 < 30, { at: b.at - t0 });
  const t1 = Date.now();
  const v = await vote('fanF', 'echo', 1);
  __slowReads(0);
  ok('a cast\'s clock is taken after its reads and its write, not before', v.body.at - t1 >= 60, { at: v.body.at - t1 });
  const m = (await me('fanF')).body;
  ok('and the record\'s own lastAt is earlier than that answer', m.lastAt <= v.body.at, { lastAt: m.lastAt, at: v.body.at });
  // a board read across that write: no vote in it, and older than the cast's clock
  ok('the board rendered before the cast does not contain it and says so', b.songs.find((s) => s.id === 'echo').votes === 0 && b.at < v.body.at);
  const d = onPhone(b, { ...m, lastAt: Math.max(m.lastAt, v.body.at) }, { echo: { votes: 1, mine: 1 } }, Date.now());
  eq('so the phone keeps the number it showed itself', [d.songs.find((s) => s.id === 'echo').votes, d.songs.find((s) => s.id === 'echo').mineCount], [1, 1]);
}

console.log('\nA PERSONAL STATE FROM ANOTHER NIGHT IS NO STATE AT ALL');
{
  const b = (await board()).body, m = (await me('fanA')).body;
  const old = { ...m, showId: 'show-some-other-night' };
  eq('the server ignores it', noClock(mergeForOne(b, old)), noClock(mergeForOne(b, null)));
  eq('and so does the phone', noClock(onPhone(b, old)), noClock(onPhone(b, null)));
  ok('while the same night is used as it is', onPhone(b, m).songs.some((s) => s.mine));
}

console.log('\nA BIG ROOM: YOUR OWN SONG COMES BACK FROM THE TAIL');
/* Fifty live songs (every plan shows the whole library since 2026-09-13, decision 0061),
   more than the short board carries; one fan votes for one nobody else has and it
   sits below the cut. A phone must still see it (INVARIANT 0el). */
for (let i = 0; i < 42; i++) await A('addSong', { title: 'Filler ' + i, artist: 'T' });
const live = await getShow(DEFAULT_ARTIST);
const active = live.songs.filter((s) => s.active !== false);
eq('fifty songs are live to the room', active.length, 50);
for (let i = 0; i < 1200; i++) {
  await mutateFan(DEFAULT_ARTIST, 'crowd' + String(i).padStart(6, '0'), (f) => { f.seenShow = live.showId; f.ipH = 'x'; return true; });
}
for (let i = 0; i < 44; i++) {                    // 44 songs get two votes each: they fill the board
  await vote('crowd' + String(i).padStart(6, '0'), active[i].id, 2);
}
const lowSong = active[48].id, lowTitle = active[48].title;
eq('fanE votes for a song nobody else has', (await vote('fanE', lowSong)).status, 200);
{
  const m = (await me('fanE')).body;              // first: it stamps fanE present
  const b = (await board()).body;
  ok('the room is big and the board is short', b.board === boardLimitFor(b.room.in) && b.board > 0 && b.songs.length === b.board, { board: b.board, in: b.room.in, shown: b.songs.length });
  /* The negative assertions of test/roomsize.mjs, on the path the room now uses:
     nobody is refused, nobody is a spectator, the page is slowed instead (0ej). */
  ok('nobody is a spectator — there is no such state on the board', b.room.watching === undefined);
  ok('the page is asked to slow down instead', b.nextPollMs > 3000, b.nextPollMs);
  ok('and a phone that arrives after the cap still votes (fanE just did)', m.votes[lowSong] === 1, m.votes);
  ok('fanE\'s song is below the cut', !b.songs.some((s) => s.id === lowSong));
  const t = (b.tail || []).find((x) => x[0] === lowSong);
  ok('but it is in the tail, with its tally', !!t && t[1] === 1, b.tail);
  ok('and the tail is only songs that hold a vote', (b.tail || []).every((x) => x[1] > 0));
  eq('the personal call carries its title', m.held.map((h) => h.title), [lowTitle]);
  const d = onPhone(b, m), s = mergeForOne(b, m), l = (await legacy('fanE')).body;
  const mine = d.songs.find((x) => x.id === lowSong);
  ok('the phone puts it back on the board, marked as theirs', !!mine && mine.mine === true && mine.mineCount === 1 && mine.votes === 1, mine);
  eq('exactly as the server does', noClock(d), noClock(s));
  eq('exactly as /api/show always did', noClock(s), noClock(l));
  eq('and a phone that voted for nothing sees just the short board', onPhone(b, (await me('quiet1')).body).songs.length, b.board);
  ok('the edge keeps a big room\'s board for the longer interval it is told to wait', /s-maxage=10\b/.test((await board()).headers['netlify-cdn-cache-control']));
}

console.log('\nA HEAD-COUNT STAMP TAKES THREE TURNS AT MOST, AND NEVER BREAKS THE CALL  (decision 0185)');
/* An arrival wave: every phone's first personal call stamps presence with a write to
   the shard its votes live in. Forty tries a phone, under contention, was seconds of
   other people's turns. Every write to the fan shards is refused here, the way a
   contended shard refuses them, and the call must still answer — after three tries. */
{
  const { PRESENCE_TRIES } = await import('../netlify/functions/_lib.mjs');
  const { __failWrites } = await import('./blobs-fake.mjs');
  eq('the cap is three', PRESENCE_TRIES, 3);
  __failWrites(/^f\d+_/);
  const t0 = Date.now();
  const { r, log } = await ops(() => me('waveFan01'));
  __failWrites(null);
  const sets = log.filter((x) => /^set f\d+_/.test(x)).length;
  eq('a fresh phone in a contended room: three writes, not forty', sets, 3);
  ok('and the personal call still answers 200 with the fan\'s wallet', r.status === 200 && r.body.ok && !!r.body.credits, r);
  ok('in well under a second, not the seconds forty tries took', Date.now() - t0 < 1500, Date.now() - t0);
  const again = await ops(() => me('waveFan01'));
  ok('the next personal call tries the stamp again, and it lands', again.log.some((x) => /^set f\d+_/.test(x)) && again.r.status === 200);
}

console.log('\nTHE PAGE PAINTS THE BOARD FIRST AND ASKS FOR ITSELF RARELY  (decision 0185)');
/* load() lifted out of vote.html and run against stubs that log what it does, in
   order. The stubs stand in for the network (timed), the drawing (paint) and the
   element it dims; everything else is the page's own code. */
{
  const s = page.indexOf('const ME_EVERY='), e = page.indexOf('/* The board and this phone\'s half');
  ok('vote.html still has the personal-call cadence before paint()', s > 0 && e > s);
  const head = (page.match(/<script>\(\(\)=>\{try\{const p=location\.pathname[\s\S]*?<\/script>/) || [''])[0];
  ok('the <head> starts the board and nothing else', /window\.__early=\{board:g\(/.test(head) && !/what=me/.test(head) && !/myset\.fan/.test(head), head.slice(0, 200));
  const rig = () => {
    const log = [];
    const net = { board: () => ({ ok: true, showId: 's1', updatedAt: 1, songs: [], played: [] }), me: () => ({ ok: true, showId: 's1', lastAt: 0, votes: {}, credits: {} }) };
    const reply = (body) => body === null ? Promise.reject(new Error('down'))
      : Promise.resolve({ json: async () => body, headers: { get: () => '0' } });
    const timed = (u) => { const k = /what=board/.test(u) ? 'board' : 'me'; log.push(k); return reply(net[k]()); };
    const cls = new Set();
    const app = { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) }, set innerHTML(v) { log.push('noboard'); } };
    const make = new Function('timed', 'within', 'paint', 'hideIntro', '$', 'API', 'AQ', 'AQ1', 'FAN', 'window',
      `let BOARD=null, ME=null, CAST_AT=0, FAILS=0, BOOTED=false;\n${page.slice(s, e)}\n` +
      'return { load, get ME(){return ME;}, get FAILS(){return FAILS;}, due(){ME_DUE=true;}, age(ms){ME_AT-=ms;} };');
    const p = make(timed, (x) => x, (fresh) => log.push('paint:' + fresh), () => {}, () => app, '/api', '', '', 'f1', {});
    return { p, log, net, cls };
  };
  const { p, log, net, cls } = rig();
  await p.load();
  eq('first load: the board, painted, THEN the personal call, painted again', log.splice(0), ['board', 'paint:true', 'me', 'paint:false']);
  await p.load();
  eq('the next tick: the board alone — no personal call', log.splice(0), ['board', 'paint:true']);
  net.board = () => ({ ok: true, showId: 's1', updatedAt: 2, songs: [], played: [] });
  await p.load();
  eq('the artist changed the show (updatedAt moved): the personal call comes with it', log.splice(0), ['board', 'paint:true', 'me', 'paint:false']);
  await p.load();
  eq('and not again for the same show', log.splice(0), ['board', 'paint:true']);
  p.due(); await p.load();
  eq('the phone acted (ME_DUE): the personal call comes with the next load', log.splice(0), ['board', 'paint:true', 'me', 'paint:false']);
  p.age(59000); await p.load();
  eq('59 s on, nothing has happened: still the board alone', log.splice(0), ['board', 'paint:true']);
  p.age(1500); await p.load();
  eq('past a minute: the safety call', log.splice(0), ['board', 'paint:true', 'me', 'paint:false']);
  net.board = () => null; p.due(); await p.load();
  eq('a board that did not arrive: the kept board is drawn and nobody is asked for more', log.splice(0), ['board', 'paint:false']);
  eq('and the failure is counted (0143)', p.FAILS, 1);
  net.board = () => ({ ok: true, showId: 's1', updatedAt: 2, songs: [], played: [] });
  await p.load();
  eq('the room answers again: the call that was owed is made', log.splice(0), ['board', 'paint:true', 'me', 'paint:false']);
  net.me = () => null; p.due(); await p.load(); log.splice(0);
  ok('a personal call that failed keeps the last one the phone had', !!p.ME && p.ME.ok);
  p.age(14000); await p.load();
  eq('…and is not retried on the next tick', log.splice(0), ['board', 'paint:true']);
  p.age(1500); await p.load();
  eq('but fifteen seconds on, not a minute', log.splice(0), ['board', 'paint:true', 'me', 'paint:false']);
  cls.add('catching'); await p.load();
  ok('a board that arrived takes the "catching up" dimming off', !cls.has('catching'));

  const r2 = rig(); r2.net.board = () => null; await r2.p.load();
  eq('a first load with no board says so and asks nothing else', r2.log, ['board', 'noboard']);

  ok('every action that changes this phone\'s state asks for it on its next load: a vote',
     /busy\.delete\(id\); ME_DUE=true; wakeUp\(true\); load\(\);/.test(page));
  ok('a request, a vibe or a birthday', /ME_DUE=true; await load\(\);\n\s*\}catch\(e\)\{ toast\('Connection hiccup/.test(page));
  ok('the leftover choice', /your votes are safe'\); \}\n\s*ME_DUE=true; load\(\);/.test(page));
  ok('a payment coming back', /ME_DUE=true; load\(\)\.then\(\(\)=>\{ if\(forSong\) resumeVote\(forSong\); \}\);/.test(page));
  ok('a pull', /MySetPull\(async\(\)=>\{ ME_DUE=true;/.test(page));
  ok('until the first personal answer, the wallet is not guessed (the pill is a placeholder)',
     /const meWait=!ME&&!ME_SEEN;/.test(page) && /\$\{meWait\?'<span class="sk"/.test(page));
}

console.log('\nTHE PAGE READS THE SONG LIST ONCE AND POLLS ONLY THE TALLIES  (decision 0192)');
/* The page half of decision 0150. load() is lifted as above and run against stubs
   shaped like both servers: today's (no `songsV`) and one that names its song list.
   Forty songs; the full board is cut to fifteen with a tail, the way a big room's is. */
{
  const s = page.indexOf('const ME_EVERY='), e = page.indexOf('/* The board and this phone\'s half');
  ok('vote.html has the song-list code inside the lifted slice', page.slice(s, e).includes('function fromList(b,L)') && page.slice(s, e).includes('async function listed(b)'));
  const song = (i) => ({ id: 's' + i, title: 'Song ' + String(i).padStart(2, '0'), artist: 'T', cost: 1, tags: i % 2 ? ['rock'] : [] });
  const TAGS = [{ id: 'rock', label: 'Rock' }];
  const listAt = (v, played = []) => ({ ok: true, v, songs: Array.from({ length: 40 }, (_, i) => song(i)).filter((x) => !played.includes(x.id)),
    played: played.map((id) => ({ ...song(Number(id.slice(1))), cost: 5 })), tags: TAGS });
  const voted = (i) => ({ ...song(i), votes: 20 - i, firstAt: 1000 + i });           // s0..s19 hold votes, in rank order
  const fullAt = (v) => ({ ok: true, showId: 's1', updatedAt: v, status: 'live',          // a new version is an artist action: updatedAt moves with it
    ...(v ? { songsV: v } : {}),
    songs: Array.from({ length: 15 }, (_, i) => voted(i)), board: 15,
    tail: [15, 16, 17, 18, 19].map((i) => [song(i).id, 20 - i, 1000 + i]), played: [], tags: TAGS });
  const leanAt = (v, tally) => { const { songs, played, tail, tags, ...rest } = fullAt(v);
    return { ...rest, tally: tally || Array.from({ length: 20 }, (_, i) => [song(i).id, 20 - i, 1000 + i]) }; };
  const rig = () => {
    const log = [];
    const net = { board: () => fullAt(null), lean: () => null, songs: () => null, me: () => ({ ok: true, showId: 's1', lastAt: 0, votes: {}, credits: {} }) };
    const reply = (body) => body === null ? Promise.reject(new Error('down'))
      : Promise.resolve({ json: async () => body, headers: { get: () => '0' } });
    const timed = (u) => {
      if (/what=songs/.test(u)) { const v = new URL(u, 'https://x').searchParams.get('v'); log.push('songs:' + v); return reply(net.songs(v)); }
      const k = /what=board/.test(u) ? (/lean=1/.test(u) ? 'lean' : 'board') : 'me';
      log.push(k); return reply(net[k]());
    };
    const app = { classList: { add() {}, remove() {} }, set innerHTML(v) { log.push('noboard'); } };
    const make = new Function('timed', 'within', 'paint', 'hideIntro', '$', 'API', 'AQ', 'AQ1', 'FAN', 'window',
      `let BOARD=null, ME=null, CAST_AT=0, FAILS=0, BOOTED=false;\n${page.slice(s, e)}\n` +
      'return { load, fromList, get BOARD(){return BOARD;}, get LIST(){return LIST;}, missAge(ms){ if(LIST_MISS) LIST_MISS.at-=ms; } };');
    const p = make(timed, (x) => x, (fresh) => log.push('paint:' + fresh), () => {}, () => app, '/api', '', '', 'f1', {});
    return { p, log, net };
  };
  const ids = (list) => list.map((x) => x.id);

  { // today's server
    const { p, log, net } = rig();
    await p.load(); await p.load();
    eq('today\'s server (no songsV): exactly #228\'s calls — no list, no lean board', log.splice(0), ['board', 'paint:true', 'me', 'paint:false', 'board', 'paint:true']);
    eq('and the board is drawn as it came: fifteen songs, the cut said out loud', [p.BOARD.songs.length, p.BOARD.board], [15, 15]);
    ok('nothing was invented for it', p.BOARD.tail.length === 5 && !('tally' in p.BOARD) && p.LIST === null);
    net.board = () => ({ ...fullAt(null), tally: [['s0', 1, null]] });                 // a server that sent a tally without a version
    await p.load();
    eq('a tally with no version is never taken for a board', [log.splice(0), p.BOARD.songs.length], [['board', 'paint:false'], 15]);
  }

  { // a server that names its list
    const { p, log, net } = rig();
    net.board = () => fullAt('v1'); net.lean = () => leanAt('v1'); net.songs = (v) => listAt('v1');
    await p.load();
    eq('first load: today\'s board painted at once, then the list at the version it names, painted again, then the personal call',
       log.splice(0), ['board', 'paint:true', 'songs:v1', 'paint:false', 'me', 'paint:false']);
    const B = p.BOARD;
    eq('every song is drawn — forty, not fifteen — and nothing claims a cut', [B.songs.length, B.board, B.tail], [40, null, null]);
    eq('voted songs in the tally\'s rank order, then the rest of the list by title, at 0',
       ids(B.songs), [...Array.from({ length: 20 }, (_, i) => 's' + i), ...Array.from({ length: 20 }, (_, i) => 's' + (i + 20))]);
    ok('with their tallies and first-vote times from the board, titles and prices from the list',
       B.songs[16].votes === 4 && B.songs[16].firstAt === 1016 && B.songs[16].title === 'Song 16' && B.songs[39].votes === 0 && B.songs[39].firstAt === null && B.songs[39].cost === 1);
    eq('genre chips from the list', B.tags, TAGS);
    await p.load(); await p.load();
    eq('then every poll is the lean board alone — the list is not asked for again', log.splice(0), ['lean', 'paint:true', 'lean', 'paint:true']);
    eq('and draws the same forty songs as the full board did', ids(p.BOARD.songs), ids(B.songs));
    ok('the lean board\'s own fields still reach the page', p.BOARD.showId === 's1' && p.BOARD.status === 'live' && !('tally' in p.BOARD));

    /* SEARCH reaches every song: the merged board carries all forty, and render()
       filters the songs and the played list together with this one `match`. */
    const merged = onPhone(p.BOARD, { ok: true, showId: 's1', lastAt: 0, votes: {} });
    const matchSrc = (page.match(/const match=s=>[^\n]*/) || [''])[0];
    ok('render() lists and searches the songs and the played list together', /const all=\[\.\.\.\(d\.songs\|\|\[\]\),\.\.\.\(d\.played\|\|\[\]\)\];/.test(page) && /\(SORT==='votes'\?rank\(all\):all\)\.filter\(match\)/.test(page));
    const found = new Function('q', 'all', `${matchSrc}; return all.filter(match).map(s=>s.id);`)('song 39', [...merged.songs, ...merged.played]);
    eq('a search finds a song nobody has voted for, far below the old cut', found, ['s39']);

    /* The artist starts a song: the version moves, s0 goes to played at the replay price. */
    net.lean = () => leanAt('v2', [...Array.from({ length: 19 }, (_, i) => [song(i + 1).id, 19 - i, 1001 + i]), ['s0', 2, 999]]);
    net.songs = (v) => listAt('v2', ['s0']);
    await p.load();
    eq('songsV moved: the lean board, the list at the new version once, then the paint', log.splice(0), ['lean', 'songs:v2', 'paint:true', 'me', 'paint:false']);
    eq('the played song left the list and sits in played with its tally, at the replay price',
       [p.BOARD.songs.length, ids(p.BOARD.played), p.BOARD.played[0].votes, p.BOARD.played[0].cost], [39, ['s0'], 2, 5]);
    await p.load();
    eq('and the next poll is lean again, with no refetch', log.splice(0), ['lean', 'paint:true']);

    /* THE LIST CANNOT BE HAD: the full board, which is today's page. */
    net.lean = () => leanAt('v3'); net.board = () => fullAt('v3'); net.songs = () => null;
    await p.load();
    eq('a list that fails: the full board is fetched in the same load and drawn as it came',
       [log.splice(0), p.BOARD.songs.length, p.BOARD.board], [['lean', 'songs:v3', 'board', 'paint:true', 'me', 'paint:false'], 15, 15]);
    await p.load();
    eq('the next polls are the full board, and the failed version is not asked for again at once', log.splice(0), ['board', 'paint:true']);
    p.missAge(61000); net.songs = (v) => listAt('v3');
    await p.load();
    eq('a minute on, it is tried again, and the page draws from the list', [log.splice(0), p.BOARD.songs.length], [['board', 'paint:true', 'songs:v3', 'paint:false'], 40]);
    await p.load();
    eq('and polls lean again', log.splice(0), ['lean', 'paint:true']);

    /* A TALLY NAMING A SONG THE LIST LACKS: not this list. */
    net.lean = () => leanAt('v3', [['s1', 3, 1], ['ghost', 9, 2]]);
    await p.load();
    eq('a tally that names a song the list lacks: the full board, at once', [log.splice(0), p.BOARD.songs.length, p.BOARD.board], [['lean', 'board', 'paint:true'], 15, 15]);
    ok('and the list is let go', p.LIST === null);
    await p.load();
    eq('the polls stay on the full board', log.splice(0), ['board', 'paint:true']);

    /* A LIST NEWER THAN THE BOARD (the edge's board is a poll old): kept, not drawn under it. */
    p.missAge(61000); net.board = () => fullAt('v4'); net.songs = () => listAt('v5');
    await p.load();
    eq('a list whose version is not the board\'s is not drawn', [log.splice(0), p.BOARD.board], [['board', 'paint:true', 'songs:v4', 'me', 'paint:false'], 15]);
    net.board = () => fullAt('v5');
    await p.load();
    eq('the next board names it: drawn from the list it already holds, with no fetch', [log.splice(0), p.BOARD.songs.length], [['board', 'paint:true', 'me', 'paint:false'], 40]);

    /* A lean board whose fallback board does not arrive either is a load with no board (0143). */
    net.lean = () => leanAt('v6'); net.songs = () => null; net.board = () => null;
    await p.load();
    eq('lean board, no list, no full board: the kept board stays and nothing else is asked', [log.splice(0), p.BOARD.songs.length], [['lean', 'songs:v6', 'board', 'paint:false'], 40]);
  }

  /* ONE DEFINITION. The phone's rebuild of a board from a tally and a list is the
     server's own board, on the real small-room board this file voted onto above. */
  {
    const { p } = rig();
    const b = b1.body;                                  // eight songs, three voted, no cut
    const pick = (x) => ({ id: x.id, title: x.title, artist: x.artist, cost: x.cost, tags: x.tags });
    const L = { ok: true, v: 'x', songs: [...b.songs].sort((a, c) => a.title.localeCompare(c.title)).map(pick), played: b.played.map(pick), tags: b.tags };
    const sorted = (o) => JSON.parse(JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [c]) => a.localeCompare(c))) : v));
    const d = p.fromList({ ...b, songsV: 'x' }, L);
    eq('a tally plus the list draws the server\'s own board, song for song', sorted([d.songs, d.played, d.tags]), sorted([b.songs, b.played, b.tags]));
  }
}

console.log('\nTHE SCREEN COMING ON FETCHES A STALE BOARD AFTER A RANDOM 0–1.5 s, AND SAYS IT IS OLD MEANWHILE  (decision 0185)');
{
  const s = page.indexOf('let CATCHUP=null;');
  const e = page.indexOf('/* PULL TO REFRESH');
  ok('vote.html still has wake()', s > 0 && e > s);
  const run = (boardAge, floor, rnd) => {
    const log = [], timers = [], cls = new Set();
    const app = { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) } };
    const f = new Function('wakeUp', 'tick', '$', 'setTimeout', 'clearTimeout', 'Math', 'BOARD', 'BOARD_T', 'FLOOR',
      `let ME_DUE=false;\n${page.slice(s, e)}\nreturn { wake, get due(){return ME_DUE;} };`);
    const M = Object.create(Math); M.random = () => rnd;
    const w = f((full) => log.push('wakeUp:' + full), () => log.push('tick'), () => app,
      (fn, ms) => { timers.push(ms); fn(); return 1; }, () => {}, M, {}, Date.now() - boardAge, floor);
    w.wake();
    return { log, timers, cls, due: w.due };
  };
  const big = run(30000, 20000, 0.999);
  eq('a big room, a board 30 s old: the ladder is woken AND a load comes early', big.log, ['wakeUp:true', 'tick']);
  ok('after a random wait under 1.5 s', big.timers.length === 1 && big.timers[0] >= 0 && big.timers[0] < 1500, big.timers);
  ok('the old board is marked as catching up until the new one lands', big.cls.has('catching'));
  ok('and the personal call goes with it', big.due === true);
  const zero = run(30000, 20000, 0);
  eq('the wait is drawn per phone, from zero', zero.timers, [0]);
  const freshish = run(1000, 20000, 0.5);
  eq('a board younger than the floor: only the ladder (its next tick is soon enough)', [freshish.log, freshish.timers, freshish.cls.has('catching')], [['wakeUp:true'], [], false]);
  ok('the screen coming on calls wake()', /addEventListener\('visibilitychange',\(\)=>\{ if\(!document\.hidden\) wake\(\); \}\)/.test(page));
  ok('wakeUp keeps its 0143 backoff: a full wake brings FAILS back to one doubling',
     /function wakeUp\(full\)\{[\s\S]{0,80}if\(full&&FAILS>1\) FAILS=1;/.test(page));
  ok('and tick still runs one poll at a time', /if\(TICKING\)\{ schedule\(\); return; \}/.test(page));
  ok('the dimming has a reduced-motion path', /prefers-reduced-motion:reduce\)\{#app \.now,#app \.strip,#app \.queue,#app \.list\{transition:none\}/.test(page));
}

console.log('\nTYPING IN SEARCH KEEPS THE KEYBOARD  (decision 0185)');
/* render() rebuilds the search box on every letter. The handler must ask for the
   focus back, and put the caret where it was — the poll does the same (paint()). */
ok('the input handler marks the box as focused and remembers the caret before render()',
   /qi\.addEventListener\('input',e=>\{FILTER=e\.target\.value;FOCUS=true;CARET=e\.target\.selectionStart;render\(\);FOCUS=false;\}\);/.test(page));
ok('render() focuses the new box and puts the caret back',
   /if\(FOCUS\)\{ qi\.focus\(\); const v=qi\.value, at=CARET==null\?v\.length:Math\.min\(CARET,v\.length\); qi\.setSelectionRange\(at,at\); \}/.test(page));
ok('a poll landing mid-word keeps the caret too', /FOCUS=!!\(el&&el\.id==='q'\); CARET=FOCUS\?el\.selectionStart:null;/.test(page));

console.log('\nBETWEEN SHOWS THE ROOM IS DARK ON BOTH HALVES');
await A('status', { status: 'pre' });
{
  const b = (await board()).body, m = (await me('fanA')).body;
  ok('the board shows no votes and nothing playing', b.songs.every((s) => s.votes === 0) && b.nowPlaying === null && b.played.length === 0);
  eq('and the phone holds nothing, though its record is untouched', [m.votes, m.held], [{}, []]);
  eq('and the two halves still merge to the old answer', noClock(mergeForOne(b, m)), noClock((await legacy('fanA')).body));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
