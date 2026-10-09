/* EVERY SONG THE ROOM CAN VOTE FOR  (decision 0150)

   Past 3,000 phones the board carries the top fifteen songs, and the vote page could
   list and search only what the board carried — so a song nobody had voted for yet
   could not be found at all, and the early leaders froze in place. The 2 October
   2026 audit found it.

   The server half of the fix, held here: the list is its own reply, fetched once per
   page open and kept at the edge under a version that changes only when the list
   does; the board says which version it belongs to (`songsV`) and, asked with
   `lean=1`, carries only the tallies. Without `lean` the board is what it always was. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const fan = (await import('../netlify/functions/fan.mjs')).default;
const { getShow, mutateShow, mutateFan, store, KEY, shardOf, SHARDS, boardLimitFor, DEFAULT_ARTIST } =
  await import('../netlify/functions/_lib.mjs');
const { songList, SONGLIST_FORM } = await import('../netlify/functions/_board.mjs');
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const call = async (url, body) => {
  const r = await (url.includes('/api/admin') ? admin : url.includes('/api/vote') ? voteFn : fan)(new Request(url,
    body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch {}
  return { code: r.status, cdn: r.headers.get('netlify-cdn-cache-control') || '', body: j };
};
const A = async (action, extra = {}) => (await call('https://x/api/admin?code=devlocal', { action, ...extra })).body;
const cast = async (f, song) => (await call('https://x/api/vote', { fan: f, song, n: 1, op: 'cast', cast: 'c' + Math.random().toString(36).slice(2, 12) })).code;
const board = async (lean = false) => (await call('https://x/api/fan?what=board' + (lean ? '&lean=1' : ''))).body;
const songs = async (v) => call('https://x/api/fan?what=songs' + (v === undefined ? '' : '&v=' + encodeURIComponent(v)));
const AID = DEFAULT_ARTIST;

const N = 40;
for (let i = 0; i < N; i++) await A('addSong', { title: 'Song ' + String(i).padStart(2, '0'), artist: 'Test' });
await A('newShow');
const show0 = await getShow(AID);
const ids = show0.songs.map((s) => s.id);

console.log('\nA ROOM PAST 3,000 PHONES');
/* Presence written straight into the twelve files: the head count is what the board
   is cut by, and the room's arrival is not what is under test here. */
const bags = Array.from({ length: SHARDS }, () => ({}));
for (let i = 0; i < 3001; i++) {
  const id = 'p' + String(i).padStart(9, '0');
  bags[shardOf(id)][id] = { v: [], extra: 0, ts: {}, seenShow: show0.showId, ipH: 'x' };
}
for (let n = 0; n < SHARDS; n++) await store().set(KEY.fan(AID, n), JSON.stringify(bags[n]));
for (let i = 0; i < 20; i++) eq(`vote ${i + 1} on song ${i}`, await cast('v' + String(i).padStart(9, '0'), ids[i]), 200);
const full = await board();
eq('the board is cut to the top fifteen', [full.room.in >= 3001, full.board, full.songs.length], [true, boardLimitFor(3001), 15]);
const quiet = ids[N - 1];
ok('a song nobody has voted for is nowhere on the board', ![...full.songs.map((s) => s.id), ...(full.tail || []).map((t) => t[0])].includes(quiet));

console.log('\nTHE LIST HAS EVERY SONG THE ROOM CAN VOTE FOR');
const l0 = await songs();
eq('it answers, from the fan door, with the version the board names', [l0.code, l0.body.ok, l0.body.v], [200, true, full.songsV]);
eq(`all ${N} songs, none played yet`, [l0.body.songs.length, l0.body.played.length], [N, 0]);
ok('including the one nobody has voted for', l0.body.songs.some((s) => s.id === quiet));
const titles = l0.body.songs.map((s) => s.title);
eq('in the order the board ranks songs that hold no votes: by title', titles, [...titles].sort((a, b) => a.localeCompare(b)));
eq('each entry is a song\'s shape without the night: id, title, artist, cost, tags', Object.keys(l0.body.songs[0]).sort(), ['artist', 'cost', 'id', 'tags', 'title']);
ok('every song the board shows is in it, at the board\'s price', [...full.songs, ...full.played].every((b) => {
  const s = [...l0.body.songs, ...l0.body.played].find((x) => x.id === b.id); return s && s.cost === b.cost && s.title === b.title;
}));
eq('a vote for the quiet song is taken: the server never limited voting to the board', await cast('vquiet0001', quiet), 200);

console.log('\nTHE POLL CAN CARRY ONLY THE TALLIES');
const fb = await board(), lb = await board(true);
eq('lean=1 leaves out the song shapes and the genres', ['songs', 'played', 'tail', 'tags'].filter((k) => k in lb), []);
const fromFull = Object.fromEntries([...fb.songs.filter((s) => s.votes > 0).map((s) => [s.id, s.votes]),
                                    ...(fb.tail || []).map((t) => [t[0], t[1]]), ...fb.played.filter((s) => s.votes > 0).map((s) => [s.id, s.votes])]);
eq('its tally is every song that holds a vote, with the full board\'s numbers', Object.fromEntries(lb.tally.map((t) => [t[0], t[1]])), fromFull);
ok('the quiet song\'s vote is in it, below the cut', lb.tally.some((t) => t[0] === quiet && t[1] === 1));
eq('in the board\'s rank order', lb.tally.slice(0, 15).map((t) => t[0]), fb.songs.filter((s) => s.votes > 0).map((s) => s.id));
const strip = (b) => { const { at, songs: _s, played: _p, tail: _t, tags: _g, tally: _y, ...r } = b; return r; };
eq('everything else is the board as it was', strip(lb), strip(fb));
eq('and the board without lean is unchanged: songs, played, tail and tags still there', ['songs', 'played', 'tail', 'tags'].filter((k) => k in fb), ['songs', 'played', 'tail', 'tags']);

console.log('\nTHE VERSION CHANGES WHEN THE LIST DOES, AND ONLY THEN');
const v1 = fb.songsV;
await cast('vmore00001', ids[3]); await cast('vmore00002', quiet);
eq('votes do not change it', (await board()).songsV, v1);
await A('play', { song: ids[0] });
const b2 = await board(), l2 = await songs(b2.songsV);
ok('a song starting does', b2.songsV !== v1 && l2.body.v === b2.songsV, [v1, b2.songsV]);
ok('the song playing is in neither half of the list', ![...l2.body.songs, ...l2.body.played].some((s) => s.id === ids[0]));
await A('play', { song: ids[1] });
const b3 = await board(), l3 = await songs(b3.songsV);
const was = l3.body.played.find((s) => s.id === ids[0]);
eq('a played song moves to `played`, at the replay price', [!!was, was && was.cost], [true, (await getShow(AID)).replayCost || 5]);
await A('replayCost', { n: 7 });
const b4 = await board();
ok('a new replay price changes it', b4.songsV !== b3.songsV);
await A('addSong', { title: 'A New One', artist: 'Test' });
const b5 = await board();
ok('a new song changes it', b5.songsV !== b4.songsV);
ok('and the new song is in the new list', (await songs(b5.songsV)).body.songs.some((s) => s.title === 'A New One'));
await A('toggleSong', { song: ids[10] });
const b6 = await board();
ok('hiding a song changes it, and the hidden song leaves the list', b6.songsV !== b5.songsV && !(await songs(b6.songsV)).body.songs.some((s) => s.id === ids[10]));
await A('toggleSong', { song: ids[10] });
eq('putting it back puts the version back: it is a hash of what the list says', (await board()).songsV, b5.songsV);

console.log('\nWHAT IS KEPT AT THE EDGE IS EXACTLY WHAT ITS ADDRESS NAMES');
const vNow = (await board()).songsV;
const hit = await songs(vNow), none = await songs(), stale = await songs(v1);
ok('the current version: kept for a day', /public, durable, s-maxage=86400\b/.test(hit.cdn), hit.cdn);
ok('no version: the current list, kept for the shortest shared time', /s-maxage=10\b/.test(none.cdn) && none.body.v === vNow, none.cdn);
ok('an old version: the current list, kept nowhere', stale.cdn === 'no-store' && stale.body.v === vNow && stale.body.v !== v1, stale.cdn);
ok('a version is a short hex string', /^[0-9a-f]{16}$/.test(vNow));
ok('the shape\'s own number is part of it', songList(await getShow(AID)).v === vNow && SONGLIST_FORM >= 1);

console.log('\nBETWEEN SHOWS');
await A('status', { status: 'ended' });
const dark = await board(), dl = (await songs(dark.songsV)).body;
ok('the version changes when the room goes dark', dark.songsV !== vNow);
eq('the whole setlist, all at 1, nothing played — as the dark board shows it',
   [dl.songs.length, dl.played.length, dl.songs.every((s) => s.cost === 1)], [N + 1, 0, true]);
await A('newShow');

console.log('\nA VOTE ITS SONG ALREADY COLLECTED IS NOT IN THE TALLY (0hu)');
await cast('vlate00001', ids[5]);
await A('play', { song: ids[5] });
const sh = await getShow(AID);
/* the row of a vote that set off before Play and landed after its sweep */
await mutateFan(AID, 'vlate00002', (me) => { me.v.push(ids[5]); me.va[ids[5]] = [[1, 0, Date.now(), sh.col[ids[5]] - 1]]; me.ts[ids[5]] = Date.now(); return true; });
await A('endSong');
const lt = await board(true);
ok('the collected row is left out of the lean tally too', !lt.tally.some((t) => t[0] === ids[5]), lt.tally);

console.log('\nONE ROOM\'S LIST, NOBODY ELSE\'S');
eq('a page that does not exist has no list', (await call('https://x/api/fan?what=songs&a=nobody-here')).code, 404);

console.log('\nWHAT IT COSTS');
const v = (await board()).songsV;
__opsStart();
await songs(v);
const ops = __opsStop();
eq('one read on the founding page: the show record', ops.filter((o) => o.startsWith('get')), ['get ' + KEY.show(AID)]);
eq('and no write', ops.filter((o) => o.startsWith('set')), []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
