/* End-to-end over the real handlers, in-process, against an in-memory blob store
   with etag support (test/blobs-fake.mjs). Nothing touches production: the store is a
   Map that dies with the process.

   One case per confirmed review finding. */
process.env.ADMIN_CODE = 'devlocal';
// songs are started milliseconds apart here; the real 8s double-tap guard is
// exercised deliberately in its own case below
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin   = (await import('../netlify/functions/admin.mjs')).default;
const showFn  = (await import('../netlify/functions/show.mjs')).default;
const voteFn  = (await import('../netlify/functions/vote.mjs')).default;
const reqFn   = (await import('../netlify/functions/request.mjs')).default;
const histFn  = (await import('../netlify/functions/history.mjs')).default;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, '\n      got  ' + a + '\n      want ' + b); }
};
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};

const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A       = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const pubShow = (fan) => hit(showFn, `https://x/api/show${fan ? '?fan=' + fan : ''}`);
const vote    = (fan, song) => hit(voteFn, 'https://x/api/vote', { fan, song });
const ask     = (fan, title) => hit(reqFn, `https://x/api/request?fan=${fan}`, { kind: 'song', title });
const st      = async () => (await A('window', { open: true })).stage;

console.log('\nSETUP');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
  await A('addSong', { title: t, artist: 'Test' });
await A('freeCredits', { n: 40 });
let S = await st();
eq('five songs in the library', S.songs.length, 5);
ok('all votable with no set active', S.songs.every((x) => x.votable === true));

const lid = (await A('listNew', { name: 'Late set' })).id;
ok('setlist created', !!lid);
await A('listSongs', { id: lid, songs: ['alpha', 'bravo'] });
await A('listUse', { id: lid });
S = await st();
eq('the set is active', S.show.listId, lid);
eq('two songs in play', S.songs.filter((x) => x.inSet).map((x) => x.id).sort(), ['alpha', 'bravo']);

/* ── FINDING 1 + 4 ─────────────────────────────────────────────── */
console.log('\nFINDING 1+4  a paid request must be votable once accepted');
await A('status', { status: 'live' });
await A('askSet', { kind: 'song', on: true, cost: 3 });
const r0 = await ask('fanA', 'Foxtrot');
ok('the fan could pay for it', r0.ok, r0);
const rid = (await A('askList')).asks[0].id;
const acc = await A('askAccept', { id: rid });
ok('accepted', acc.ok, acc);
ok('and the artist is told where it landed', /Late set/.test(acc.note || ''), acc.note);
const p1 = await pubShow('fanA');
ok('THE BUG: the room can see it', p1.songs.some((x) => x.title === 'Foxtrot'),
   p1.songs.map((x) => x.title));
const v0 = await vote('fanA', 'foxtrot');
ok('THE BUG: and can vote for it', v0.ok && v0.voted === true, v0);
const mem = (await A('listAll')).lists.find((l) => l.id === lid).songs;
ok('it really joined the set', mem.includes('foxtrot'), mem);
await vote('fanA', 'foxtrot');

/* ── FINDING 12 ────────────────────────────────────────────────── */
console.log('\nFINDING 12  narrowing the set must not strand a fan\'s credit');
const v1 = await vote('fanB', 'alpha');
ok('a fan votes for a song in the set', v1.ok && v1.voted === true, v1);
await A('listSongs', { id: lid, songs: ['bravo', 'foxtrot'] });     // alpha drops out
const v2 = await vote('fanC', 'alpha');
eq('a NEW vote for it is refused', [v2.status, v2.error], [404, 'That one isn’t on tonight’s list']);
const v3 = await vote('fanB', 'alpha');
ok('THE BUG: the holder can still toggle it off', v3.ok && v3.voted === false, v3);
eq('and the credit came back', (await pubShow('fanB')).credits.used, 0);
await A('listSongs', { id: lid, songs: ['alpha', 'bravo', 'foxtrot'] });

/* ── FINDING 3 ─────────────────────────────────────────────────── */
console.log('\nFINDING 3  the room\'s top-voted replay must be able to win');
await A('play', { song: 'charlie' });                 // charlie is NOT in the set
await A('play', { song: 'alpha' });                   // so charlie is now played
S = await st();
const ch = S.songs.find((x) => x.id === 'charlie');
ok('charlie: played, outside the set, still votable',
   ch.played === true && ch.inSet === false && ch.votable === true, ch);
const rv = await vote('fanD', 'charlie');
ok('the room asks for it again', rv.ok && rv.voted === true, rv);
S = await st();
const clientTop = S.songs.filter((x) => !x.now && x.active !== false && x.votable !== false
                                        && (!x.played || x.votes > 0))[0];
eq('the Studio names charlie', clientTop.id, 'charlie');
eq('THE BUG: and playTop starts the same song', (await A('playTop')).stage.show.nowPlaying, 'charlie');

/* ── FINDING 5 + 8 ─────────────────────────────────────────────── */
console.log('\nFINDING 5+8  the gig decides the night — all three states');
const soon = new Date(Date.now() + 90 * 60000);
const p2 = (n) => String(n).padStart(2, '0');
const gig = (listId) => A('eventSave', { event: {
  id: 'gtest', venue: 'The Test Bar', city: 'Koh Phangan', country: 'Thailand', tz: 'UTC',
  date: `${soon.getUTCFullYear()}-${p2(soon.getUTCMonth() + 1)}-${p2(soon.getUTCDate())}`,
  time: `${p2(soon.getUTCHours())}:${p2(soon.getUTCMinutes())}`, listId } });

await A('listUse', { id: lid });
await gig('');
eq('"leave my pick" changes nothing', (await A('status', { status: 'live' })).stage.show.listId, lid);

await gig('all');
let g = await A('status', { status: 'live' });
eq('THE BUG: "All songs" actually clears it', g.stage.show.listId, '');
ok('and says so', /all your songs/i.test(g.note || ''), g.note);

await gig(lid);                                   // show currently has NO set
g = await A('status', { status: 'live' });
eq('a named set is applied', g.stage.show.listId, lid);
ok('with its name and count', /Late set/.test(g.note || ''), g.note);

await A('listUse', { id: '' });
eq('THE BUG: ↺ New show applies it too', (await A('newShow')).stage.show.listId, lid);

/* A gig pointing at a set the artist LATER deleted. eventSave sanitises on save,
   so the only way to reach this state is to delete the list afterwards — which
   listDelete deliberately does not chase through the calendar. */
const doomed = (await A('listNew', { name: 'Doomed set' })).id;
await gig(doomed);
await A('listDelete', { id: doomed });
await A('listUse', { id: lid });
g = await A('status', { status: 'live' });
eq('a deleted set leaves the artist\'s pick alone', g.stage.show.listId, lid);
ok('and says what happened', /deleted/.test(g.note || ''), g.note);
await A('eventDelete', { id: 'gtest' });

/* ── FINDING 6 + 9 ─────────────────────────────────────────────── */
console.log('\nFINDING 6+9  every way a song id appears re-projects the set');
/* The state that matters: a list HOLDS an id whose song is not in the library.
   listDelete/removeSong leave the list document alone deliberately, so this is
   reachable in real use — delete a song, then bring the same title back. */
await A('addSong', { title: 'Golf', artist: 'Test' });
await A('listSongs', { id: lid, songs: ['alpha', 'bravo', 'golf'] });
await A('removeSong', { song: 'golf' });
S = await st();
ok('golf is gone from the library, so out of play', !S.songs.some((x) => x.id === 'golf'));
ok('but the list still holds its id',
   (await A('listAll')).lists.find((l) => l.id === lid).songs.length === 2);   // filtered on read
const wid = (await A('learnAdd', { title: 'Golf', artist: 'Test' })).learn.find((x) => x.title === 'Golf').id;
const ld = await A('learnDone', { id: wid });
ok('learned it', ld.ok, ld);
S = await st();
ok('THE BUG: learnDone put it back in the active set',
   S.songs.find((x) => x.id === 'golf')?.inSet === true,
   S.songs.filter((x) => x.inSet).map((x) => x.id));

console.log('\n  the refresh is measured, not an allow-list to forget');
await A('removeSong', { song: 'golf' });
ok('removing it drops it from play', !(await st()).songs.some((x) => x.id === 'golf'));
await A('addSong', { title: 'Golf', artist: 'Test' });
ok('adding it back re-projects it', (await st()).songs.find((x) => x.id === 'golf')?.inSet === true);
await A('editSong', { song: 'golf', artist: 'Renamed' });
eq('an edit that changes no ids leaves the set alone', (await st()).show.listId, lid);
await A('starterSetlist');
ok('the starter pack re-projects too', (await st()).songs.length > 10);

/* ── FINDING 10 + 11 ───────────────────────────────────────────── */
console.log('\nFINDING 10+11  "N of your M songs are in play" must be true');
await A('toggleSong', { song: 'bravo' });                        // hide bravo
S = await st();
const row = S.lists.find((l) => l.id === lid);
eq('count == what is actually in play', row.count, S.songs.filter((x) => x.inSet).length);
ok('but the picker still ticks the hidden song', row.songs.includes('bravo'), row.songs);
await A('toggleSong', { song: 'bravo' });

/* ── FINDING 13 ────────────────────────────────────────────────── */
console.log('\nFINDING 13  tagAuto reports what it did, once');
const t1 = await A('tagAuto');
eq('filled + kept + unknown covers every song',
   t1.filled + t1.kept + t1.unknownCount, (await st()).songs.length);
ok('it filled something', t1.filled > 0, t1);
eq('a second run fills nothing', (await A('tagAuto')).filled, 0);
await A('tagAdd', { label: 'Beach' });
const hand = (await A('tagList')).tags.own[0].id;
await A('editSong', { song: 'alpha', tags: [hand] });
await A('tagAuto');
eq('a hand-made choice survives', (await st()).songs.find((x) => x.id === 'alpha').tags, [hand]);

/* ── the payload can only hold votable songs ───────────────────── */
/* ── C044 ──────────────────────────────────────────────────────── */
console.log('\nC044  only claim a refund that actually happened');
await A('newShow');
await A('askSet', { kind: 'song', on: true, cost: 3 });
await A('freeCredits', { n: 9 });
const rq = await ask('fanR', 'Wanted Song');
ok('the fan paid for it', rq.ok, rq);
const rid2 = (await A('askList')).asks.find((x) => x.title === 'Wanted Song').id;
const dec = await A('askDecline', { id: rid2 });
eq('declined in this show refunds the real cost', dec.refunded, 3);

const rq2 = await ask('fanS', 'Stale Song');
ok('a second fan pays', rq2.ok, rq2);
const rid3 = (await A('askList')).asks.find((x) => x.title === 'Stale Song').id;
await A('newShow');                       // their credits have already refreshed
const dec2 = await A('askDecline', { id: rid3 });
eq('THE BUG: a stale request reports NO refund, not a fake one', dec2.refunded, 0);
ok('and says why', /earlier show/.test(dec2.note || ''), dec2.note);

/* ── C003 ──────────────────────────────────────────────────────── */
console.log('\nC003  ending a show twice must not lose what came between');
await A('newShow');
/* The full LIBRARY, not /api/show — an earlier section leaves a setlist active, so
   the public payload holds three songs and hIds[3] was undefined. The first draft of
   this test failed for that reason and the code was right all along. */
const hIds = (await A('window', { open: true })).stage.songs.map((x) => x.id);
ok('enough songs to play five', hIds.length >= 5, hIds.length);
await A('play', { song: hIds[0] });
await A('play', { song: hIds[1] });
const sid = (await A('window', { open: true })).stage.show.showId;
await A('status', { status: 'ended' });      // the accidental end — 2 songs archived
await A('status', { status: 'live' });       // carries on
await A('play', { song: hIds[2] });
await A('play', { song: hIds[3] });
await A('play', { song: hIds[4] });
await A('status', { status: 'ended' });      // ended again — 5 songs now
const hist = await hit(histFn, `https://x/api/history?code=devlocal&show=${sid}`);
ok('the show is in history', hist.ok, hist);
ok('THE BUG: the later songs survived the re-archive',
   (hist.show.played || []).length >= 5, (hist.show.played || []).length);

/* ── C030/C043 ─────────────────────────────────────────────────── */
console.log('\nC030/C043  a lost response must not burn a second song');
await A('newShow');
const dIds = (await A('window', { open: true })).stage.songs.map((x) => x.id);
process.env.MYSET_DOUBLE_TAP_MS = '8000';        // the real production window
const dt1 = await A('play', { song: dIds[0] });
ok('the first start lands', dt1.ok && dt1.stage.show.nowPlaying === dIds[0], dt1.stage && dt1.stage.show.nowPlaying);

/* THE BUG: the write landed, the response was lost, the Studio said "try again",
   and the artist tapped again — burning the next song down and the round with it. */
const dt2 = await A('playTop');
eq('a playTop right after is refused, not a second song', dt2.status, 409);
ok('and says why', /just started/.test(dt2.error || ''), dt2.error);
eq('the same song is still playing', (await A('window', { open: true })).stage.show.nowPlaying, dIds[0]);

const dt3 = await A('play', { song: dIds[0] });
ok('re-sending the SAME song is simply already done', dt3.ok, dt3);
eq('still that song, played[] untouched', (await A('window', { open: true })).stage.show.nowPlaying, dIds[0]);
process.env.MYSET_DOUBLE_TAP_MS = '0';           // back to machine speed

/* ── the presence optimisation must not break the head-count ────── */
console.log('\nhead-count survives skipping the redundant presence read');
await A('newShow');
await A('status', { status: 'live' });
const roomOf = async () => (await A('window', { open: true })).stage.room;
eq('empty room to start', await roomOf(), 0);
await hit(showFn, 'https://x/api/show?fan=ph1&in=1');
eq('one phone counted on its first poll', await roomOf(), 1);
for (let i = 0; i < 5; i++) await hit(showFn, 'https://x/api/show?fan=ph1&in=1');
eq('and still one after five more polls', await roomOf(), 1);
await hit(showFn, 'https://x/api/show?fan=ph2&in=1');
await hit(showFn, 'https://x/api/show?fan=ph3&in=1');
eq('three phones', await roomOf(), 3);
await hit(showFn, 'https://x/api/show?fan=ph4');            // no in=1
eq('a profile view is NOT in the room (INVARIANT 0af)', await roomOf(), 3);

console.log('\nthe network signal covers voters, not just pollers');
await A('newShow');
await A('status', { status: 'live' });
/* A setlist is still active from an earlier section, so pick a song the room can
   actually vote for — stage.songs is the whole library and the first entry may not
   be votable. That is what broke the first draft of this test. */
const nIds = (await A('window', { open: true })).stage.songs
  .filter((x) => x.votable !== false).map((x) => x.id);
ok('there is something votable to vote for', nIds.length > 0, nIds.length);
/* clientIp() reads x-nf-client-connection-ip, which Netlify sets and a bare test
   Request does not — the first draft of this asserted on an empty hash. */
await voteFn(new Request('https://x/api/vote', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.7' },
  body: JSON.stringify({ fan: 'voter-only', song: nIds[0] }),
}));                                               // never polled with in=1
const st2 = (await A('window', { open: true })).stage;
ok('THE BUG: a vote-only fan still registers a network', (st2.nets || 0) >= 1, st2.nets);

console.log('\nEVERY song in the public payload must be votable');
await A('listUse', { id: lid });
await A('play', { song: 'alpha' });
await A('play', { song: 'delta' });
await A('toggleSong', { song: 'alpha' });               // hide one that was played
const p9 = await pubShow('fanZ');
const stuck = [];
for (const s of [...p9.songs, ...p9.played]) {
  const rr = await vote('probe-' + s.id, s.id);
  if (!rr.ok && rr.status === 404) stuck.push(s.id);
}
eq('nothing in it answers "not on tonight\'s list"', stuck, []);
ok('and the hidden played song is gone from it',
   ![...p9.songs, ...p9.played].some((x) => x.id === 'alpha'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
