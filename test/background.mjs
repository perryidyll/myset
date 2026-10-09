/* BACKGROUND JOBS THAT KEEP UP  (decision 0173, INVARIANT 0im)

   The scale audit of 2 October 2026 found four jobs that work at today's size and
   fall behind at a few hundred accounts. This file pins what changed:

     · A PURGE DELETES LEAVES FIRST AND THE INDEX LAST. Killed at any point, every
       document it left is still named by something, and the next ring finishes it.
       It is time-boxed and carries on from where it stopped; Undo is refused once
       it has begun.
     · THE NIGHTLY COPY IS CHEAPER PER OWNER. A document that can never change (a
       version, a sealed part of a log) is not asked for its etag again once it
       has crossed, and the key list is read side by side.
     · THE SHEET SYNC CARRIES ON PAST ITS CAP. A run starts where the last one
       stopped, so the 401st artist's nights reach the sheet. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.MYSET_LOG_CHUNK = '20';
process.env.MYSET_VER_GAP_MS = '0';

const { store, readDoc, casDoc, KEY } = await import('../netlify/functions/_lib.mjs');
const { createArtist, readArtists } = await import('../netlify/functions/_auth.mjs');
const { keysFor, eraseKeys, purgeDue, startDeletion, cancelDeletion, DELQ } = await import('../netlify/functions/_account.mjs');
const { appendLog } = await import('../netlify/functions/_append.mjs');
const { EVT } = await import('../netlify/functions/_evlog.mjs');
const { keepVersion } = await import('../netlify/functions/_versions.mjs');
const { ARCH: PARCH } = await import('../netlify/functions/_community.mjs');
const { ARCH: FARCH } = await import('../netlify/functions/_feedback.mjs');
const { ARCH: MARCH } = await import('../netlify/functions/_messages.mjs');
const { mirrorOwner, sealed } = await import('../netlify/functions/_mirror.mjs');
const { __dump, __reset, __failDeletesAfter, __opsStart, __opsStop, __slowReads } = await import('./blobs-fake.mjs');
const { __r2 } = await import('./r2-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail).slice(0, 600)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const put = (k, v) => store().set(k, typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v));
const snapshot = () => __dump();
const restore = async (snap) => { __reset(); for (const [k, e] of snap) await store().set(k, e.body, { metadata: e.metadata }); };

/* An account with one of everything a key list is read off: nights past the
   index's cap with event logs long enough to spill, versions with a spilled index,
   archived posts with photos and a clip, archived feedback, an inbox with an
   archived conversation, a diary cover, merch pictures, lyric sheets and a clip
   still pending. */
async function richArtist(email, name) {
  const a = await createArtist({ email, name });
  const aid = a.artistId;
  const clip = (n) => `k${String(n).repeat(10).slice(0, 10)}`;
  await put(KEY.show(aid), { songs: [{ id: 's1', title: 'One' }, { id: 's2', title: 'Two' }] });
  for (const s of ['s1', 's2']) { await put(`lyr_${aid}_${s}`, { v: 1 }); await put(`chart_${aid}_${s}`, { v: 1 }); }
  await put(KEY.histIdx(aid), { shows: [{ showId: 'n1' }, { showId: 'n2' }] });
  await put(`histids_${aid}`, { ids: ['n1', 'n2', 'n3'] });                  // n3: past the index's cap
  for (const n of ['n1', 'n2', 'n3']) {
    await put(KEY.hist(aid, n), { showId: n });
    await appendLog(EVT(aid, n), Array.from({ length: 45 }, (_, i) => ({ t: 'v', i })));   // two sealed parts each
  }
  for (let i = 0; i < 24; i++) await keepVersion(KEY.profile(aid), JSON.stringify({ i }), 1e12 + i * 1e6);   // the version index spills
  await put(KEY.profile(aid), { name, merch: [{ id: 'm1', title: 'Shirt' }] });
  await put(`img_${aid}_m1`, 'shirt'); await put(`img_${aid}_m1_1`, 'shirt back');
  await put(`posts_${aid}`, { list: [{ id: 'p9', photos: ['/api/img?x'], clip: clip(1) }] });
  await put(`img_${aid}_p9_0`, 'photo'); await put(`vid_${aid}_${clip(1)}`, 'clip bytes'); await put(`img_${aid}_${clip(1)}`, 'poster');
  await appendLog(PARCH(aid), Array.from({ length: 22 }, (_, i) => ({ id: 'a' + i, photos: ['/api/img?y'], clip: i === 0 ? clip(2) : null })));
  for (let i = 0; i < 22; i++) await put(`img_${aid}_a${i}_0`, 'old photo');
  await put(`vid_${aid}_${clip(2)}`, 'old clip'); await put(`img_${aid}_${clip(2)}`, 'old poster');
  await appendLog(FARCH(aid), Array.from({ length: 21 }, (_, i) => ({ note: 'n' + i })));
  await put(`inbox_${aid}`, { threads: [{ id: 'tinboxone01' }] });
  await put(`msg_${aid}_tinboxone01`, { v: 1 });
  await appendLog(MARCH(aid), Array.from({ length: 21 }, (_, i) => ({ id: 'tarchived' + String(i).padStart(2, '0') })));
  for (let i = 0; i < 21; i++) await put(`msg_${aid}_tarchived${String(i).padStart(2, '0')}`, { v: 1 });
  await put(KEY.diary(aid), { pages: [{ id: 'd1', title: 'A night', img: '/api/img?a=x&s=d1' }] });
  await put(`img_${aid}_d1`, 'cover');
  await put(`vidpend_${aid}`, { v: 1, by: { [clip(3)]: 1 } });
  await put(`vid_${aid}_${clip(3)}`, 'pending clip');
  for (const k of [KEY.meta(aid), `ev_${aid}`, `lists_${aid}`, `fb_${aid}`, `bugs_${aid}`]) await put(k, { v: 1 });
  return aid;
}
const left = (keys) => keys.filter((k) => __dump().has(k));

console.log('\nA PURGE KILLED ANYWHERE ORPHANS NOTHING  (0im)');
{
  const aid = await richArtist('leaver@example.com', 'The Leavers');
  const namers = new Set();
  const all = await keysFor(aid, namers);
  const held = all.filter((k) => __dump().has(k));
  ok('the account holds one of every kind a key list is read off', ['hist_', 'evt_', 'ver_', 'vers_', 'postsarch_', 'fbarch_', 'inboxarch_', 'msg_', 'lyr_', 'chart_', 'vid_']
    .every((p) => held.some((k) => k.startsWith(p))) && held.length > 80, held.length);
  ok('every index the list was read off is marked as one', [KEY.histIdx(aid), `histids_${aid}`, KEY.show(aid), KEY.profile(aid), `posts_${aid}`, `vidpend_${aid}`, KEY.diary(aid),
    `inbox_${aid}`, PARCH(aid), FARCH(aid), MARCH(aid), EVT(aid, 'n1'), `vers_${KEY.profile(aid)}`].every((k) => namers.has(k)));
  ok('and a document nothing is read off is not', !namers.has(`hist_${aid}_n1`) && !namers.has(`img_${aid}_d1`) && !namers.has(KEY.meta(aid)));
  ok('the list names a document before anything read off it', all.indexOf(`histids_${aid}`) < all.indexOf(EVT(aid, 'n3')) && all.indexOf(EVT(aid, 'n3')) < all.indexOf(`${EVT(aid, 'n3')}_p0`)
    && all.indexOf(`inbox_${aid}`) < all.indexOf(`msg_${aid}_tinboxone01`) && all.indexOf(MARCH(aid)) < all.indexOf(`msg_${aid}_tarchived00`));

  /* Kill the walk after every possible number of deletes, with the deletes sent
     side by side landing out of order. Whatever is left must still be named by
     the account's key list — so the next ring can find it — and the next ring
     must finish the job. */
  const snap = snapshot();
  const lost = [], unfinished = [];
  for (let k = 0; k <= held.length; k++) {
    await restore(snap);
    __failDeletesAfter(k, { jitter: 7 });
    const n = new Set(); const ks = await keysFor(aid, n);
    await eraseKeys(ks, n).catch(() => {});
    __failDeletesAfter(null);
    const still = left(all);
    const named = new Set(await keysFor(aid));
    const orphans = still.filter((x) => !named.has(x));
    if (orphans.length) lost.push({ k, orphans: orphans.slice(0, 4) });
    const n2 = new Set(); const r = await eraseKeys(await keysFor(aid, n2), n2);
    if (r.partial || left(all).length) unfinished.push({ k, left: left(all).slice(0, 4) });
  }
  eq(`killed after each of 0…${held.length} deletes, nothing left is unnamed`, lost, []);
  eq('and the next ring always finishes it', unfinished, []);
  await restore(snap);
}

console.log('\nTHE PURGE IS TIME-BOXED, CARRIES ON, AND UNDO STOPS WHEN IT STARTS');
{
  const aid = (await readArtists()).byEmail['leaver@example.com'].artistId;
  const all = await keysFor(aid);
  const r0 = await startDeletion(aid, 'leaver@example.com');
  ok('the clock starts', r0.ok && r0.purgeAt > Date.now());
  ok('Undo works before the purge begins', (await cancelDeletion(aid)).ok);
  await startDeletion(aid, 'leaver@example.com');
  const later = Date.now() + 31 * 86400e3;
  const before = left(all).length;
  const p1 = await purgeDue(later, 1, 0);
  ok('a ring with no time left deletes one step and stops', p1.purged.length === 0 && p1.going.includes(aid) && left(all).length < before && left(all).length >= before - 8, { p1, before, now: left(all).length });
  const q = (await readDoc(DELQ, null)).data;
  ok('the queue keeps the owner and the key the walk reached', q.by[aid] && q.cur[aid] && q.cur[aid].key, q.cur);
  const u = await cancelDeletion(aid);
  ok('Undo is refused once the purge has begun', !u.ok && /already being deleted/.test(u.error), u);
  ok('and the account is still marked as leaving', !!(await readArtists()).byId[aid].del);
  let rings = 1, last = p1;
  const sizes = [left(all).length];
  while (!last.purged.length && rings < 400) { last = await purgeDue(later, 1, 0); rings++; sizes.push(left(all).length); }
  ok('ring after ring, it finishes', last.purged.includes(aid) && rings > 5, { rings });
  ok('every ring moved it on', sizes.every((n, i) => i === 0 || n <= sizes[i - 1]));
  eq('nothing it ever named is left', left(all), []);
  ok('the registry row went last', !(await readArtists()).byId[aid]);
  const q2 = (await readDoc(DELQ, null)).data;
  ok('and the queue forgets it, cursor and all', !q2.by[aid] && !(q2.cur || {})[aid]);
}

console.log('\nA CLIP R2 WILL NOT DELETE STOPS THE WALK BEFORE WHAT NAMES IT');
{
  __r2.install(); __r2.reset();
  const aid = await richArtist('clipper@example.com', 'The Clippers');
  const clips = [...__dump().keys()].filter((k) => k.startsWith(`vid_${aid}_`));
  for (const k of clips) __r2.objects.set(k, { bytes: Buffer.from('bytes'), type: 'video/mp4' });
  const all = await keysFor(aid);
  __r2.fail(true);
  const n = new Set();
  const r = await eraseKeys(await keysFor(aid, n), n);
  ok('R2 refusing: the walk stops and says why', r.partial && /r2 delete 503/.test(r.error || ''), r);
  ok('the post and the pending list that name the clips are still there', __dump().has(`posts_${aid}`) && __dump().has(`vidpend_${aid}`) && __dump().has(PARCH(aid)));
  const named = new Set(await keysFor(aid));
  eq('and every clip still on R2 is still named', clips.filter((k) => __r2.objects.has(k) && !named.has(k)), []);
  __r2.fail(false);
  const n2 = new Set();
  const r2 = await eraseKeys(await keysFor(aid, n2), n2);
  ok('R2 back: the next walk finishes', !r2.partial && left(all).length === 0, left(all));
  eq('and no clip of theirs is left on R2', clips.filter((k) => __r2.objects.has(k)), []);
  __r2.uninstall();
}

console.log('\nTHE NIGHTLY COPY ASKS ONLY WHAT COULD HAVE CHANGED');
{
  __r2.install(); __r2.reset();
  const aid = await richArtist('copier@example.com', 'The Copiers');
  const keys = await keysFor(aid);
  const listed = new Set(keys);
  const r1 = await mirrorOwner(aid, keys);
  ok('the first pass copies every document the account holds', r1.copied === keys.filter((k) => __dump().has(k) && !/^(f\d+_|sess_|lock_|paylim_|vid_|aslug_|arow_)/.test(k)).length && !r1.failed, r1);   // aslug_/arow_: copies of the list, never copied off-site (0176)
  __opsStart();
  const r2 = await mirrorOwner(aid, keys);
  const asked = __opsStop().filter((o) => o.startsWith('meta ')).map((o) => o.slice(5));
  const once = keys.filter((k) => sealed(k, listed) && __dump().has(k));
  ok('the account has versions and sealed log parts', once.length > 20 && once.some((k) => k.startsWith('ver_')) && once.some((k) => /^evt_.+_p0$/.test(k)), once.length);
  eq('a second pass asks none of them for an etag', asked.filter((k) => once.includes(k)), []);
  ok('and still skips every one, copying nothing', r2.copied === 0 && r2.skipped === r1.copied, r2);
  console.log(`    (second pass: ${asked.length} metadata reads, ${once.length} written-once documents not asked)`);
  await appendLog(EVT(aid, 'n1'), [{ t: 'v', late: true }]);
  const r3 = await mirrorOwner(aid, keys);
  ok('a log head that moved is still seen and copied', r3.copied === 1 && JSON.parse(Buffer.from(__r2.objects.get('backup/' + EVT(aid, 'n1')).bytes).toString()).list.some((x) => x.late), r3);
  ok('a venue called "P12" is a head, not a part', !sealed('postsarch_v_p12', new Set(['postsarch_v_p12'])) && sealed('postsarch_v_p12_p0', new Set(['postsarch_v_p12', 'postsarch_v_p12_p0'])));
  ok('and a profile photo slot is never a part', !sealed(`img_${aid}_p0`, new Set([`img_${aid}_p0`, `img_${aid}`])));
  __r2.uninstall();
}

console.log('\nAN ACCOUNT\'S KEY LIST IS READ SIDE BY SIDE');
{
  const a = await createArtist({ email: 'manynights@example.com', name: 'Many Nights' });
  const aid = a.artistId;
  const ids = Array.from({ length: 60 }, (_, i) => 'm' + i);
  await put(`histids_${aid}`, { ids });
  for (const id of ids) await appendLog(EVT(aid, id), [{ t: 'v' }]);
  __slowReads(5);
  const t0 = Date.now();
  const keys = await keysFor(aid);
  const ms = Date.now() - t0;
  __slowReads(0);
  ok('sixty nights\' event logs are all named', ids.every((id) => keys.includes(EVT(aid, id))));
  ok(`in ${ms} ms at 5 ms a read — one read after another would be over 300`, ms < 250, ms);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
