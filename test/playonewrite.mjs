/* PLAY IS ONE WRITE  (decision 0147)

   A cast reads the show once, before its own write. In a rush that write can take
   seconds — and if the artist starts the song in between, the vote used to land on
   a song that had already collected its votes: on the board for nothing, and once
   the song was in `played`, counted as a cheap request to hear it again. The 2
   October 2026 audit simulated 1 to 13 of these per Play at 5,000 phones.

   The race is made here on purpose, not by luck: reads are slowed, so the vote has
   read the show (and is waiting on its fan file) when Play runs to completion. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const meFn = (await import('../netlify/functions/me.mjs')).default;
const boardFn = (await import('../netlify/functions/board.mjs')).default;
const { getShow, readFans, liveFan, liveFans, voteCounts, mutateFan, grantPaidSongVotes, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { harvestAll } = await import('../netlify/functions/_evlog.mjs');
const { __slowReads, __failWrites } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const cast = (fan, song, n = 1) => hit(voteFn, 'https://x/api/vote', { fan, song, n, op: 'cast', cast: 'c' + Math.random().toString(36).slice(2, 12) });
/* A song's tally wherever the board puts it: with the songs still to play, or with
   the ones already played (where a request to hear it again shows). */
const board = async () => { const b = await hit(boardFn, 'https://x/api/board'); return [...(b.songs || []), ...(b.played || [])]; };
const onBoard = async (song) => ((await board()).find((s) => s.id === song) || {}).votes || 0;
const AID = DEFAULT_ARTIST;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const t of ['Alpha', 'Bravo', 'Charlie']) await A('addSong', { title: t, artist: 'Test' });
await A('newShow');
const show0 = await getShow(AID);
const [alpha, bravo, charlie] = show0.songs.map((s) => s.id);

console.log('\nTHE ORDINARY NIGHT IS UNCHANGED');
await cast('early1', alpha); await cast('early2', alpha); await cast('early3', bravo);
eq('two on alpha, one on bravo', [await onBoard(alpha), await onBoard(bravo)], [2, 1]);
const rowOf = async (fan, song) => ((await readFans(AID))[fan].va || {})[song];
eq('a vote row says how many songs had started when it was cast', (await rowOf('early1', alpha))[0][3], 0);
const p1 = await A('playTop');
eq('Play Top starts alpha', [p1.status, (await getShow(AID)).nowPlaying], [200, alpha]);
const s1 = await getShow(AID);
eq('the show write itself marks the song: plays 1, alpha collected at 1', [s1.plays, s1.col[alpha]], [1, 1]);
eq('alpha\'s votes are off the board; bravo\'s stay', [await onBoard(alpha), await onBoard(bravo)], [0, 1]);

console.log('\nA VOTE THAT SET OFF BEFORE PLAY AND LANDS AFTER IT');
/* The vote reads the show (bravo is votable, nothing collected), then waits on its
   slow fan-file read. Play Top starts bravo and sweeps while it waits. */
await cast('early4', bravo);                                     // bravo leads: 2
__slowReads(300, /^f\d+_/);
const late = cast('latecomer', bravo);                           // reads the show at once, then waits on its fan file
await wait(20);
__slowReads(0);                                                  // Play and its sweep run at full speed, and finish first
const p2 = await A('playTop');
const lateRes = await late;
eq('Play Top started bravo', [p2.status, (await getShow(AID)).nowPlaying], [200, bravo]);
eq('the late vote was accepted', [lateRes.status, lateRes.voted], [200, true]);
const raw = await readFans(AID);
eq('and it is in the fan\'s file, on bravo, stamped with the count it had read', [(raw.latecomer.v || []).join(), raw.latecomer.va[bravo][0][3]], [bravo, 1]);
eq('but it is not on the board', await onBoard(bravo), 0);
const mine = await hit(meFn, 'https://x/api/me?fan=latecomer');
eq('nor in the fan\'s own list of votes', mine.votes || {}, {});
eq('the fan was charged: they voted for it and it is playing', mine.credits.remaining, 2);
/* The song ends and goes to `played`. The stranded vote used to make it a replay
   candidate here — the top of Up next, bought at the ordinary price. */
const ended = await A('endSong');
eq('after the song ends it still holds no votes', await onBoard(bravo), 0);
const inStudio = ((ended.stage && ended.stage.songs) || []).find((x) => x.id === bravo) || {};
eq('and the Studio\'s queue agrees with the room\'s board', [inStudio.votes, inStudio.paidVotes], [0, 0]);
await cast('early5', charlie);
const p3 = await A('playTop');
eq('and Play Top picks charlie, not bravo again', [p3.status, (await getShow(AID)).nowPlaying], [200, charlie]);

console.log('\nA REQUEST TO HEAR IT AGAIN STILL COUNTS');
await A('endSong');
const again = await cast('replayer', bravo, 1);
ok('a vote for a played song is priced as a replay', again.status === 200 || again.status === 402, again);
if (again.status === 402) {
  /* three free credits do not cover the replay price: buy nothing, give the fan
     room instead — the point is the row's stamp, not the price */
  await mutateFan(AID, 'replayer', (me) => { me.extra = 10; return true; });
}
const again2 = again.status === 200 ? again : await cast('replayer', bravo, 1);
eq('it lands', [again2.status, again2.voted], [200, true]);
eq('stamped with the count it read, which is not lower than bravo\'s mark', [(await rowOf('replayer', bravo))[0][3] >= (await getShow(AID)).col[bravo]], [true]);
eq('so it is on the board', await onBoard(bravo), 1);
eq('and the old stranded vote beside it is still not', (await readFans(AID)).latecomer.v.length, 1);

console.log('\nA SWEEP THAT LOSES NO LONGER LEAVES VOTES BEHIND');
await A('newShow'); await A('newShow', { fresh: true }).catch(() => {});
const sh = await getShow(AID);
ok('a new night clears the marks; the count only goes up', Object.keys(sh.col).length === 0 && sh.plays >= 3, { col: sh.col, plays: sh.plays });
for (let i = 0; i < 6; i++) await cast('room' + i, alpha);
eq('six on alpha', await onBoard(alpha), 6);
__failWrites(/^f\d+_/);                                          // every fan-file write is acked and lost
const p4 = await A('play', { song: alpha });
__failWrites(null);
eq('Play still answers', p4.status, 200);
ok('the votes are still in the files — the sweep lost', Object.values(await readFans(AID)).filter((f) => (f.v || []).includes(alpha)).length === 6);
eq('and the board is right anyway', await onBoard(alpha), 0);
eq('the night\'s end still files every one of them (0fq)', harvestAll(await readFans(AID)).filter((h) => h.song === alpha).reduce((n, h) => n + h.rows.length, 0), 6);

console.log('\nWHAT THE RULE LEAVES ALONE');
const legacy = { v: ['x', 'x'], va: { x: [[1, 0, 5], [1, 0, 6]] }, ts: { x: 5 } };
eq('a row from before the stamp existed is never collected by it', liveFan(structuredClone(legacy), { col: { x: 9 } }).v.length, 2);
const mixed = { v: ['x', 'y', 'x', 'x'], va: { x: [[1, 0, 5, 0], [1, 0, 6, 2], [1, 1, 7, 3]], y: [[1, 0, 5, 0]] }, ts: { x: 5, y: 5 } };
const m2 = liveFan(structuredClone(mixed), { col: { x: 3 } });
eq('rows stamped lower than the mark go; the rest stay, in order, with their song', [m2.v.join(), m2.va.x.length, m2.va.x[0][3], m2.ts.x, m2.va.y.length], ['y,x', 1, 3, 7, 1]);
eq('with nothing played there is nothing to do', liveFans({ a: structuredClone(mixed) }, { col: {} }).a.v.length, 4);
await grantPaidSongVotes(AID, 'payer', bravo, 2, 'grant-1');
const paidRow = (await rowOf('payer', bravo))[0];
eq('votes bought for a song at checkout carry no stamp, so money is never collected by the rule', [paidRow.length, voteCounts(liveFans(await readFans(AID), { col: { [bravo]: 99 } }))[bravo]], [3, 2]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
