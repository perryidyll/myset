/* THE SHOW FOR THE PERSONAL POLL, ASKED FOR ON CONDITION  (decision 0152)

   /api/me is polled by every phone in the room, never cached, and read the whole show
   record every time — the song library and the night's play log with it, about 100 KB
   for a typical act and up to 540 KB, 250 times a second at 5,000 phones (the 2
   October 2026 audit). Now a warm instance keeps the record with its etag and asks the
   store "only if it is no longer this": the store answers 304 and no body when nothing
   changed. The one property that matters is held here: the kept copy is never older
   than a plain read. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const meFn = (await import('../netlify/functions/me.mjs')).default;
const { getShow, getShowKept, mutateShow, store, KEY, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { buildMe } = await import('../netlify/functions/_board.mjs');
const { readRequests, myRequests } = await import('../netlify/functions/_requests.mjs');
const { readFans } = await import('../netlify/functions/_lib.mjs');
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { code: r.status, ...(await r.json().catch(() => ({}))) };
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const cast = (fan, song, n = 1) => hit(voteFn, 'https://x/api/vote', { fan, song, n, op: 'cast', cast: 'c' + Math.random().toString(36).slice(2, 12) });
const AID = DEFAULT_ARTIST;
const SKEY = KEY.show(AID);
/* the personal poll, and what the store was asked while it ran */
const me = async (fan) => {
  __opsStart();
  const r = await hit(meFn, `https://x/api/me?fan=${fan}`);
  const ops = __opsStop();
  return { r, full: ops.includes('get ' + SKEY) && !ops.includes('304 ' + SKEY), kept: ops.includes('304 ' + SKEY), ops };
};
/* the same answer computed the plain way: a fresh read of the show, no copy kept */
const truth = async (fan) => {
  const show = await getShow(AID, { withName: false });
  const fans = await readFans(AID);
  const asking = show.requests.on || show.birthdays.on;
  return buildMe({ show, fanId: fan, me: fans[fan] || null, myAsks: asking ? myRequests(await readRequests(AID), fan, show) : [] });
};
const same = (a, b) => { const { at: _a, src: _s, code: _c, ...x } = a; const { at: _b, src: _t, code: _d, ...y } = b; return JSON.stringify(x) === JSON.stringify(y); };

for (let i = 0; i < 100; i++) await A('addSong', { title: 'Song ' + String(i).padStart(3, '0'), artist: 'A Band With A Long Enough Name' });
await A('newShow');
const ids = (await getShow(AID)).songs.map((s) => s.id);
await cast('fanone0001', ids[0], 2);

console.log('\nAN UNCHANGED SHOW CROSSES ONCE PER INSTANCE');
const m1 = await me('fanone0001');
ok(`a library of ${ids.length} songs: the record is ${Math.round(JSON.stringify(await getShow(AID)).length / 1024)} KB, and the first poll read all of it`, ids.length > 50 && m1.full, m1.ops);
const m2 = await me('fanone0001');
ok('the next poll asks on condition and the store answers "not changed"', m2.kept && !m2.full, m2.ops);
eq('still one read of the show, as before — the same count, without the body', m2.ops.filter((o) => o === 'get ' + SKEY).length, 1);
ok('and the answer is the one a plain read gives', same(m2.r, await truth('fanone0001')), { kept: m2.r, plain: await truth('fanone0001') });
ok('the first poll of the instance answered the same', same(m1.r, m2.r));

console.log('\nA CHANGED SHOW IS SEEN ON THE VERY NEXT POLL');
await A('freeCredits', { n: 9 });
const m3 = await me('fanone0001');
ok('the record changed, so the whole of it came back', m3.full, m3.ops);
eq('and the new allowance is in the answer at once', m3.r.credits.freeTotal, 9);
await A('play', { song: ids[0] });
const m4 = await me('fanone0001');
eq('a song started: its votes have left this fan\'s list at once (0hu)', [m4.full, m4.r.votes], [true, {}]);
ok('and the answer is the plain one', same(m4.r, await truth('fanone0001')));
const doc = JSON.parse(JSON.stringify((await store().getWithMetadata(SKEY, { type: 'json' })).data));
doc.freeCredits = 4; doc.updatedAt += 1;
await store().set(SKEY, JSON.stringify(doc));
const m5 = await me('fanone0001');
eq('a write that did not go through mutateShow is seen too: the etag is the store\'s', [m5.full, m5.r.credits.freeTotal], [true, 4]);

console.log('\nNEVER OLDER THAN A PLAIN READ, WHATEVER THE ARTIST DOES');
/* Every move the Live tab has that touches what /api/me says, each followed by a poll
   compared with the plain answer. */
const moves = [
  () => A('freeCredits', { n: 3 }), () => cast('fanone0001', ids[5]), () => A('play', { song: ids[5] }),
  () => A('unlimitedFan', { fan: 'fanone0001', on: true }), () => A('unlimitedFan', { fan: 'fanone0001', on: false }),
  () => A('endSong'), () => A('replayCost', { n: 2 }), () => cast('fanone0001', ids[5]), () => A('addSong', { title: 'Late Addition', artist: 'X' }),
  () => A('askSet', { kind: 'song', on: true }), () => A('status', { status: 'ended' }), () => A('newShow'),
];
let agreed = 0, kept = 0;
for (const move of moves) {
  await move();
  for (let k = 0; k < 2; k++) {
    const m = await me('fanone0001');
    if (k === 1 && m.kept) kept++;
    if (same(m.r, await truth('fanone0001'))) agreed++;
  }
}
eq(`${moves.length} moves, two polls after each: every answer is the plain one`, agreed, moves.length * 2);
eq('and the second poll after each move found the record unchanged', kept, moves.length);

console.log('\nTHE KEPT COPY CANNOT BE CHANGED BY A CALLER');
await getShowKept(AID);
const k1 = await getShowKept(AID);
ok('it is frozen, all the way down', Object.isFrozen(k1) && Object.isFrozen(k1.songs) && Object.isFrozen(k1.songs[0]) && Object.isFrozen(k1.played));
let threw = false;
try { k1.freeCredits = 99; } catch { threw = true; }
ok('so a write to it throws instead of reaching the next phone', threw && (await getShowKept(AID)).freeCredits !== 99);
const plain = await getShow(AID);
plain.freeCredits = 99;
ok('the ordinary read still hands out a fresh copy anyone may change', (await getShowKept(AID)).freeCredits !== 99);

console.log('\nEACH ARTIST THEIR OWN, AND A FEW AT MOST');
const others = Array.from({ length: 17 }, (_, i) => 'kept-' + i);
for (const [i, aid] of others.entries()) await mutateShow(aid, (s) => { s.venue = 'Room ' + i; return true; });
for (const aid of others) await getShowKept(aid);
eq('every artist gets their own record', (await Promise.all(others.map((a) => getShowKept(a)))).map((s) => s.venue), others.map((_, i) => 'Room ' + i));
__opsStart(); await getShowKept(others[16]); const newest = __opsStop();
ok('the most recent is kept', newest.includes('304 ' + KEY.show(others[16])), newest);
for (const aid of others.slice(1)) await getShowKept(aid);
await getShowKept(AID); await getShowKept(others[16]);
__opsStart(); await getShowKept(others[0]); const oldest = __opsStop();
ok('past sixteen, the one used longest ago is let go: it is read whole again', !oldest.includes('304 ' + KEY.show(others[0])) && oldest.includes('get ' + KEY.show(others[0])), oldest);
__opsStart(); await getShowKept('kept-nobody'); await getShowKept('kept-nobody'); const none = __opsStop();
ok('an artist with no show record is never kept: one plain read a poll, nothing to ask on next time',
   !none.some((o) => o.startsWith('304')) && none.filter((o) => o.startsWith('get')).length === 2, none);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
