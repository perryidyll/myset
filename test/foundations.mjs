/* THE DATA FOUNDATIONS  (decisions 0066–0069)

   "Literally all data, for every artist and every show, forever." Four things the
   store did not do before 2026-09-14, each pinned here so it cannot quietly stop:

     · an append-only log that is never trimmed, chunked into computable keys, and
       safe to spill under a race (_append.mjs)
     · every vote, play and dollar of a night filed in its event log as it happens
       — the vote path itself pays nothing extra (test/cost.mjs holds the ceilings)
     · a version kept before every overwrite of the hand-edited documents, at most
       one every thirty seconds, and the library only when it changed
     · the capped feed and feedback list spill into archives instead of dropping
       their oldest; export and delete find the archives and their photos
     · a nightly copy to R2 that copies what changed and skips secrets and shards */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.MYSET_LOG_CHUNK = '20';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const history = (await import('../netlify/functions/history.mjs')).default;
const { appendLog, readLog, readLogHead, logKeys, partKey } = await import('../netlify/functions/_append.mjs');
const { readEventLog, EVT, devHash } = await import('../netlify/functions/_evlog.mjs');
const { keepVersion, listVersions, versionKeys, verKey, VER_GAP_MS } = await import('../netlify/functions/_versions.mjs');
const { spillPosts, readArchivedPosts, MAX_POSTS, ARCH: PARCH } = await import('../netlify/functions/_community.mjs');
const { spillFeedback, readArchivedFeedback, MAX_NOTES, ARCH: FARCH } = await import('../netlify/functions/_feedback.mjs');
const { keysFor, exportArtist } = await import('../netlify/functions/_account.mjs');
const { runMirror, mirrorOwner, STATE, MANIFEST, PREFIX } = await import('../netlify/functions/_mirror.mjs');
const { casDoc, readDoc, readFans, KEY, DEFAULT_ARTIST, mutateMeta, store } = await import('../netlify/functions/_lib.mjs');
const { __dump } = await import('./blobs-fake.mjs');
const { __r2 } = await import('./r2-fake.mjs');

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
const cast = (fan, song, n = 1) => hit(voteFn, 'https://x/api/vote', { fan, song, n, op: 'cast' });
const AID = DEFAULT_ARTIST;

console.log('\nTHE APPEND-ONLY LOG  (chunk of 20 for the test)');
{
  const K = 'log_test_a';
  for (let i = 0; i < 45; i++) await appendLog(K, [{ i }]);
  const head = await readLogHead(K);
  eq('45 appended: two full parts spilled, five in the head', [head.parts, head.n, head.list.length], [2, 45, 5]);
  const all = await readLog(K);
  eq('read back in order, nothing lost', all.list.map((x) => x.i), Array.from({ length: 45 }, (_, i) => i));
  eq('the keys are computable from the head', await logKeys(K), [K, partKey(K, 0), partKey(K, 1)]);
  ok('a part is write-once: a second write of it is refused', (await store().set(partKey(K, 0), '{}', { onlyIfNew: true })).modified === false);
  /* The race: two spills of the same head. The part's bytes are the same for both
     (appends only ever push to the end); the second head advance aborts. */
  await appendLog(K, Array.from({ length: 15 }, (_, i) => ({ i: 45 + i })));
  const h2 = await readLogHead(K);
  eq('a third part after sixty', [h2.parts, h2.list.length], [3, 0]);
  await appendLog(K, [], (x) => { x.note = 'one'; });
  await appendLog(K, [], (x) => { x.note = 'two'; });
  eq('extra state is replaced, not appended', (await readLog(K)).x.note, 'two');
  eq('a log nobody wrote reads as empty', (await readLog('log_test_none')).list, []);
}

console.log('\nA NIGHT, FILED AS IT HAPPENS');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) await A('addSong', { title: t, artist: 'T' });
await A('freeCredits', { n: 3 });   // the votes below need more than the one free vote a fresh phone holds since decision 0172
await A('status', { status: 'live' });
const showId = (await readDoc(KEY.show(AID), null)).data.showId;
ok('a live show with an id', !!showId, showId);
const t0 = Date.now();
await cast('fan-1', 'alpha', 2);
await cast('fan-2', 'alpha', 1);
await cast('fan-2', 'bravo', 1);
await cast('fan-1', 'charlie', 1);
await cast('fan-3', 'delta', 1);
await cast('fan-3', 'echo', 1);
{
  const fans = await readFans(AID);
  const row = fans['fan-1'].va.alpha[0];
  ok('a vote row carries the moment of the cast, and how many songs had started (0147)', Array.isArray(row) && row.length === 4 && row[2] >= t0 && row[2] <= Date.now() && row[3] === 0, row);
  eq('nothing in the log before a song plays', (await readEventLog(AID, showId)).n, 0);
}
await A('play', { song: 'alpha' });
{
  const log = await readEventLog(AID, showId);
  const votes = log.events.filter((e) => e.k === 'vote');
  const play = log.events.find((e) => e.k === 'play');
  eq('alpha played: its three votes and the play are filed', [votes.length, play && play.s, play && play.votes], [3, 'alpha', 3]);
  eq('two devices, pseudonymous — never the device id', [...new Set(votes.map((v) => v.d))].sort(), [devHash(showId, 'fan-1'), devHash(showId, 'fan-2')].sort());
  ok('the pseudonym is not the device id and is short', !votes.some((v) => /fan-/.test(v.d)) && votes[0].d.length === 12);
  ok('every vote has its own cast time, before the play', votes.every((v) => v.t >= t0 && v.t <= play.t), votes.map((v) => v.t));
  eq('cost and paid part per vote (free credits)', votes.map((v) => [v.c, v.p]), [[1, 0], [1, 0], [1, 0]]);
  ok('time order', log.events.every((e, i) => !i || e.t >= log.events[i - 1].t));
}
await A('declineSong', { song: 'charlie' });
await A('removeSong', { song: 'delta' });
await A('resetVotes');
{
  const log = await readEventLog(AID, showId);
  const kinds = log.events.map((e) => e.k);
  eq('declined → refund, removed → drop, cleared → reset — each vote once', [
    kinds.filter((k) => k === 'refund').length, kinds.filter((k) => k === 'drop').length, kinds.filter((k) => k === 'reset').length,
  ], [1, 1, 2]);
  eq('the reset filed bravo and echo, the two still standing', log.events.filter((e) => e.k === 'reset').map((e) => e.s).sort(), ['bravo', 'echo']);
}
await cast('fan-4', 'bravo', 1);
await mutateMeta(AID, (m) => { m.tips.push({ fan: 'x', amount: 5, note: '', at: Date.now() }); return true; });
await A('status', { status: 'ended' });
{
  const log = await readEventLog(AID, showId);
  eq('ended: the vote still on the board, the tip and the end are filed', [
    log.events.filter((e) => e.k === 'vote' && e.s === 'bravo').length, log.events.filter((e) => e.k === 'tip').map((e) => e.a), log.events.at(-1).k,
  ], [1, [500], 'end']);
  const n = log.n;
  await A('status', { status: 'ended' });
  eq('ending again files nothing twice', (await readEventLog(AID, showId)).n, n);
  /* The morning after: a song removed with a vote still on it. The vote was filed
     as standing at the end; now it is filed as dropped — and reads once. */
  await A('removeSong', { song: 'bravo' });
  const after = await readEventLog(AID, showId);
  eq('a vote taken off the board after the end reads once, with the reason', [after.n, after.events.filter((e) => e.s === 'bravo' && e.d === devHash(showId, 'fan-4')).map((e) => e.k)], [n, ['drop']]);
  const r = await hit(history, `https://x/api/history?code=devlocal&log=${showId}`);
  eq('the owner reads the night by ?log=', [r.status, r.log && r.log.n, r.log && r.log.showId], [200, n, showId]);
  eq('an unknown night is 404', (await hit(history, 'https://x/api/history?code=devlocal&log=nope')).status, 404);
}

console.log('\nA VERSION BEFORE EVERY OVERWRITE');
{
  await A('profileSet', { name: 'First Name', tagline: 'one' });
  eq('the first write of a document that did not exist keeps nothing', (await listVersions(KEY.profile(AID))).length, 0);
  await A('profileSet', { name: 'Second Name', tagline: 'two' });
  await A('profileSet', { name: 'Third Name', tagline: 'three' });
  const vs = await listVersions(KEY.profile(AID));
  ok('two changes inside thirty seconds keep one version', vs.length === 1, vs);
  const doc = (await readDoc(verKey(KEY.profile(AID), vs[0].ts), null)).data;
  eq('and it is the profile as it was before the burst', doc && doc.name, 'First Name');
  const later = await keepVersion(KEY.profile(AID), JSON.stringify({ name: 'older' }), Date.now() + VER_GAP_MS() + 1);
  ok('thirty seconds on, the next change keeps another', !!later && (await listVersions(KEY.profile(AID))).length === 2);
  eq('newest first', (await listVersions(KEY.profile(AID)))[0].ts, later);
  const keys = await versionKeys(KEY.profile(AID));
  ok('every version key is computable: the index and each version', keys.includes(`vers_${KEY.profile(AID)}`) && keys.includes(verKey(KEY.profile(AID), later)), keys);
  ok('the version is write-once', (await store().set(verKey(KEY.profile(AID), later), '{}', { onlyIfNew: true })).modified === false);

  process.env.MYSET_VER_GAP_MS = '0';                   // no coalescing, so each door shows
  const libBefore = (await listVersions(KEY.show(AID))).length;
  await A('addSong', { title: 'Foxtrot', artist: 'T' });
  eq('the library changed → the show record as it was is kept', (await listVersions(KEY.show(AID))).length, libBefore + 1);
  await A('status', { status: 'live' });
  await A('play', { song: 'alpha' });
  await A('freeCredits', { n: 4 });
  eq('a play or a price is not a library change → no version', (await listVersions(KEY.show(AID))).length, libBefore + 1);
  const kept = (await readDoc(verKey(KEY.show(AID), (await listVersions(KEY.show(AID)))[0].ts), null)).data;
  ok('the version is the library without Foxtrot', kept && kept.songs && !kept.songs.some((s) => s.id === 'foxtrot') && kept.songs.some((s) => s.id === 'alpha'));
  delete process.env.MYSET_VER_GAP_MS;
  const l1 = (await listVersions(`lists_${AID}`)).length;
  const made = await A('listNew', { name: 'Set A' });
  await A('listSongs', { id: made.id, songs: ['alpha', 'bravo'] });
  ok('the first write of a missing document keeps nothing; the second keeps the first', (await listVersions(`lists_${AID}`)).length === l1 + 1, await listVersions(`lists_${AID}`));
  await A('eventSave', { event: { venue: 'The Bar', city: 'Here', date: '2026-12-01', time: '20:00' } });
  await keepVersion(`ev_${AID}`, JSON.stringify({ v: 1, list: [] }), Date.now() + VER_GAP_MS() + 1);
  ok('the calendar is versioned through the same door', (await listVersions(`ev_${AID}`)).length >= 1);
}

console.log('\nTHE FEED IS CAPPED, THE RECORD IS NOT');
{
  const posts = Array.from({ length: MAX_POSTS + 5 }, (_, i) => ({ id: 'p' + i, fan: 'f', name: 'n', text: 't' + i, at: 1000 + i, photos: i < 3 ? ['/api/img?x'] : [], clip: i === 1 ? 'c1' : null }));
  await casDoc(`posts_${AID}`, () => ({ v: 1, list: [], recent: [], n: 0 }), (d) => { d.list = posts; return true; });
  eq('five posts past the cap spill into the archive', await spillPosts(AID), 5);
  const feed = (await readDoc(`posts_${AID}`, null)).data.list;
  eq('the feed keeps the newest MAX_POSTS', [feed.length, feed[0].id], [MAX_POSTS, 'p5']);
  eq('the archive holds the five oldest, in order', (await readArchivedPosts(AID)).map((p) => p.id), ['p0', 'p1', 'p2', 'p3', 'p4']);
  eq('spilling again moves nothing', await spillPosts(AID), 0);
  await appendLog(PARCH(AID), [posts[0], posts[1]]);               // the crash case: appended twice
  eq('a post appended twice reads once', (await readArchivedPosts(AID)).map((p) => p.id), ['p0', 'p1', 'p2', 'p3', 'p4']);
  const keys = await keysFor(AID);
  ok('delete and export find the archive and the photos of a post that left the feed',
    keys.includes(PARCH(AID)) && keys.includes(`img_${AID}_p0_0`) && keys.includes(`img_${AID}_c1`), keys.filter((k) => /p0|c1|arch/.test(k)));

  const notes = Array.from({ length: MAX_NOTES + 3 }, (_, i) => ({ fan: 'd' + i, stars: 5, note: 'n' + i, at: 2000 + i, show: '' }));
  await casDoc(`fb_${AID}`, () => ({ v: 1, count: 0, sum: 0, list: [] }), (d) => { d.list = notes; d.count = notes.length; d.sum = notes.length * 5; return true; });
  eq('three notes past the cap spill', await spillFeedback(AID), 3);
  eq('the Studio list keeps MAX_NOTES; the archive the three oldest', [(await readDoc(`fb_${AID}`, null)).data.list.length, (await readArchivedFeedback(AID)).map((r) => r.note)], [MAX_NOTES, ['n0', 'n1', 'n2']]);
  ok('the feedback archive is in the key list', (await keysFor(AID)).includes(FARCH(AID)));
}

console.log('\nEVERYTHING A DELETE MUST FIND');
{
  const keys = await keysFor(AID);
  const want = [EVT(AID, showId), `vers_${KEY.profile(AID)}`, `vers_${KEY.show(AID)}`, `vers_lists_${AID}`, PARCH(AID), FARCH(AID)];
  eq('the event log, the version indexes, the archives', want.filter((k) => keys.includes(k)), want);
  ok('and every version document', (await listVersions(KEY.profile(AID))).every((v) => keys.includes(verKey(KEY.profile(AID), v.ts))));
  const ex = await exportArtist(AID);
  ok('the export carries the night\'s events', ex.nights && ex.nights[showId] && ex.nights[showId].n > 0, Object.keys(ex.nights || {}));
  ok('and the versions, with the bytes for the small documents', ex.versions.profile && ex.versions.profile[0].doc && ex.versions.library && !ex.versions.library[0].doc);
  eq('and the archived posts and notes, never a device', [ex.communityArchive.length, ex.feedbackArchive.length, ex.feedbackArchive.some((r) => r.fan)], [5, 3, false]);
}

console.log('\nTHE SECOND HOME');
{
  __r2.install(); __r2.reset();
  const owners = async () => [AID];
  const keysOf = async () => keysFor(AID);
  /* An ID photo, waiting for review: it must never reach the second home (0110). */
  await store().set(`img_${AID}_idcheck`, Buffer.from('a passport, in bytes'), { metadata: { type: 'image/jpeg' } });
  ok('the ID photo is on the owner\'s key list (so the delete can find it)', (await keysOf()).includes(`img_${AID}_idcheck`));
  const r1 = await runMirror({ owners, keysOf });
  ok('a pass copies every key an owner holds', r1.done && r1.copied > 20 && r1.failed === 0, r1);
  const stored = [...__r2.objects.keys()];
  ok('under backup/<key> — the same key, the other store', stored.includes(PREFIX + KEY.show(AID)) && stored.includes(PREFIX + EVT(AID, showId)) && stored.includes(PREFIX + 'cityindex'), stored.slice(0, 5));
  ok('never a fan shard, a session, a sign-in secret, a clip (already on R2) or an ID photo', !stored.some((k) => /^backup\/(f\d+_|sess_|lock_|authc_|authnet_|paylim_|authsecret|vid_)|_idcheck$/.test(k)), stored.filter((k) => /f\d+_|sess_|vid_|idcheck/.test(k)));
  const r2 = await runMirror({ owners, keysOf });
  eq('the next ring after a finished pass does nothing', [r2.done, r2.copied], [true, undefined]);
  await casDoc(STATE, () => ({}), (d) => { d.passDoneAt = Date.now() - 25 * 3600e3; return true; });
  const r3 = await runMirror({ owners, keysOf });
  ok('a day later: everything skipped by etag, nothing re-copied', r3.done && r3.copied === 0 && r3.skipped === r1.copied, r3);
  await A('profileSet', { tagline: 'changed' });
  await casDoc(STATE, () => ({}), (d) => { d.passDoneAt = Date.now() - 25 * 3600e3; return true; });
  const r4 = await runMirror({ owners, keysOf });
  ok('a changed document (and its new version) crosses; the rest is skipped', r4.copied >= 1 && r4.copied <= 3 && r4.skipped >= r1.copied - 1, r4);
  const bytes = __r2.objects.get(PREFIX + KEY.profile(AID));
  ok('the bytes on R2 are the document', bytes && JSON.parse(Buffer.from(bytes.bytes).toString()).tagline === 'changed');
  /* Out of time: with no budget at all a ring still copies at least one key per
     worker, leaves the cursor on the unfinished owner, and the next ring carries on
     from the manifest — until the pass is done, with every key copied exactly once. */
  __r2.reset();
  for (const k of [...__dump().keys()].filter((x) => x.startsWith('mirror'))) await store().delete(k);
  const two = { owners: async () => [AID, 'nobody'], keysOf: async (o) => (o === AID ? keysFor(AID) : ['profile_nobody']) };
  const r5 = await runMirror({ ...two, budgetMs: 0 });
  ok('a pass too big for the ring stops with the cursor on the unfinished owner', !r5.done && r5.cursor === 0 && r5.copied >= 1 && r5.copied < r1.copied, r5);
  let rings = 1, last = r5;
  while (!last.done && rings < 60) { last = await runMirror({ ...two, budgetMs: 0 }); rings++; }
  ok('and ring after ring finishes the pass', last.done && last.cursor === 3 && rings > 2, { rings, last });
  eq('with every key copied once across the rings', [...__r2.objects.keys()].filter((k) => k.startsWith(PREFIX)).length, r1.copied);
  /* R2 refusing every put — the real first ring: the pass finishes, says which
     key and why, and comes back in an hour rather than a day. */
  __r2.reset(); __r2.fail(true);
  for (const k of [...__dump().keys()].filter((x) => x.startsWith('mirror'))) await store().delete(k);
  const r8 = await runMirror({ owners, keysOf });
  ok('a refused pass says so: copied 0, every put failed, the first failure named', r8.done && r8.copied === 0 && r8.failed > 20 && /: r2 put 503$/.test(r8.err || ''), r8);
  const r9 = await runMirror({ owners, keysOf });
  ok('and the next ring inside the hour waits, carrying the reason', r9.done && r9.failed === r8.failed && r9.err === r8.err, r9);
  await casDoc(STATE, () => ({}), (d) => { d.passDoneAt = Date.now() - 2 * 3600e3; return true; });
  __r2.fail(false);
  const r10 = await runMirror({ owners, keysOf });
  ok('an hour on it tries again, and copies once R2 answers', r10.done && r10.copied === r8.failed && r10.failed === 0 && r10.err === null, r10);
  __r2.uninstall();
  eq('with R2 off, the ring says so and copies nothing', await runMirror({ owners, keysOf }), { off: true });
}

console.log('\nEVERY KIND OF DOCUMENT HAS A SECOND HOME  (decision 0146)');
{
  /* The 2 October 2026 audit found a dozen kinds of document the nightly copy never
     took. One of each is made here — through the real code where there is some —
     and then the REAL bell is rung, so the wiring in mirrorcron.mjs (which owners,
     which keys) is what is tested, not a stand-in for it. */
  const mirrorcron = (await import('../netlify/functions/mirrorcron.mjs')).default;
  const S = await import('../netlify/functions/_sample.mjs');
  const { createContact } = await import('../netlify/functions/_crm.mjs');
  const { createVenue } = await import('../netlify/functions/_venues.mjs');
  const { logErr, hourKey } = await import('../netlify/functions/_errlog.mjs');
  const { noteMine } = await import('../netlify/functions/_featured.mjs');
  const { familyOf, skipped, globalKeys, FAMILIES } = await import('../netlify/functions/_mirror.mjs');
  const put = (k, v) => store().set(k, typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v));

  const live = await S.createSample({ kind: 'artist', name: 'The Second Homes', by: 'founder' }, { fetchMedia: false });
  const liveV = await S.createSample({ kind: 'venue', name: 'The Second Home Bar', by: 'founder' }, { fetchMedia: false });
  const gone = await S.createSample({ kind: 'artist', name: 'Taken Down Trio', by: 'founder' }, { fetchMedia: false });
  ok('two sample pages and one to take down', live.ok && liveV.ok && gone.ok, [live, liveV, gone]);
  await S.archiveSample(gone.owner);
  const c = await createContact('artist', { name: 'A Contact', email: 'contact@example.com' });
  const v = await createVenue({ email: 'owner@thelamp.example', name: 'The Lamp Second', city: 'Chaweng', country: 'Thailand' });
  const vid = v && (v.venueId || v.vid || (v.venue && v.venue.venueId));
  ok('a contact and a venue', c.ok && !!vid, { c: c.ok, v });
  await put(`vpitch_${vid}`, { v: 1, list: [] });
  await put(`push_v_${vid}`, { v: 1, subs: [] });
  await put(`gigok_${vid}`, { v: 1, by: {} });
  await put(`bugs_${AID}`, { v: 1, list: [{ at: 1, text: 'the button did nothing' }] });
  await logErr('second-home-test', new Error('an error worth keeping'));
  await noteMine(AID, { sid: 'h1', key: 'feat_thailand-chaweng-0a1b2c3d', date: '2099-01-01' });
  await put('feat_thailand-chaweng-0a1b2c3d', { v: 1, byDate: {} });
  await put('mediadash/data', { posts: [{ id: '2026-10-01_A_POST' }] });
  await put('mediadash/thumb/2026-10-01_A_POST', Buffer.from('jpeg bytes'));
  for (const k of ['mediadash/boosts', 'crmlib', 'crmgmail', 'costs', 'suggest', 'gsheet', 'factorycfg', 'factoryq', 'samplesup', 'samplestat', 'payowed']) await put(k, { v: 1 });
  /* The founding page is in the registry in production; in this file it has only
     ever been reached by its code, so it is put on the list the walk reads. */
  const { mutateArtists } = await import('../netlify/functions/_auth.mjs');
  await mutateArtists((reg) => { reg.byId[AID] ||= { slug: AID, name: 'The Founder', createdAt: 1, plan: 'free' }; reg.bySlug[AID] = AID; return true; });
  // what must still never cross
  for (const k of ['hqlock', 'showlock', `vidup_${AID}_clip1`, `vidchunk_${AID}_clip1_0`]) await put(k, { v: 1 });

  __r2.install(); __r2.reset();
  for (const k of [...__dump().keys()].filter((x) => x.startsWith('mirror'))) await store().delete(k);
  process.env.MYSET_MIRROR_BUDGET_MS = '60000';
  const res = await mirrorcron(new Request('https://x/.netlify/functions/mirrorcron', { method: 'POST', body: '{}' }));
  delete process.env.MYSET_MIRROR_BUDGET_MS;
  const st = (await readDoc(STATE, null)).data || {};
  ok('the real bell finished a pass with nothing refused', res.status === 200 && st.passDoneAt > 0 && st.failed === 0 && st.copied > 30, st);
  const home = new Set([...__r2.objects.keys()].filter((k) => k.startsWith(PREFIX)));   // the dated copies (0175) are test/snapshots.mjs's
  const want = {
    'a sample page that is not on the list yet': `profile_${live.owner}`,
    'its record': `sample_${live.owner}`,
    'a sample venue': `vprofile_${liveV.owner.slice(2)}`,
    'the samples register': 'samplereg',
    'the index of pages taken down': 'samplearc',
    'a taken-down page\'s snapshot': `samplearc_${gone.owner}`,
    'the do-not-build list': 'samplesup',
    'the sample counters': 'samplestat',
    'the CRM index': 'crm',
    'a CRM contact': `crm_${c.cid}`,
    'the message library': 'crmlib',
    'the sealed Gmail tokens': 'crmgmail',
    'the factory\'s settings': 'factorycfg',
    'and its queue': 'factoryq',
    'the company\'s costs': 'costs',
    'venues\' suggestions': 'suggest',
    'the sheet hand-over': 'gsheet',
    'payments still owed a delivery': 'payowed',
    'the media dashboard': 'mediadash/data',
    'its boosts': 'mediadash/boosts',
    'a thumbnail, named by its post': 'mediadash/thumb/2026-10-01_A_POST',
    'this hour of errors': [...__dump().keys()].find((k) => k.startsWith(hourKey())) || hourKey(),   // one of ERR_SHARDS documents an hour (0187): whichever shard the error above landed in
    'what fans reported from a room': `bugs_${AID}`,
    'a city\'s featured slots, named by the artist who bought one': 'feat_thailand-chaweng-0a1b2c3d',
    'the pitches a venue was sent': `vpitch_${vid}`,
    'a venue\'s alert devices': `push_v_${vid}`,
    'a venue\'s answers to shows at its place': `gigok_${vid}`,
  };
  for (const [what, k] of Object.entries(want)) ok(`${what} (${k.replace(/_[a-z0-9-]{8,}$/, '_…')})`, home.has(PREFIX + k));
  ok('never a door\'s wrong-try count or an upload in pieces',
     !['hqlock', 'showlock', `vidup_${AID}_clip1`, `vidchunk_${AID}_clip1_0`].some((k) => home.has(PREFIX + k)));
  /* The table and the walk agree: everything that crossed is a kind the table
     says is copied, and everything left behind is a kind it says is not. */
  const crossed = [...home].map((k) => k.slice(PREFIX.length));
  eq('everything that crossed is a kind the table says is copied', crossed.filter((k) => !familyOf(k) || skipped(k)), []);
  const left = [...__dump().keys()].filter((k) => !home.has(PREFIX + k));
  const unexplained = left.filter((k) => !skipped(k) && !/^(log_test_|ver_|vers_)/.test(k) && !/^(profile|show)_nobody$/.test(k));
  eq('and everything left behind is a kind it says is not', unexplained, []);
  ok('every line that says "never copied" says why', FAMILIES.every(([, how, why]) => how !== 'skip' || (why && why.length > 10)));
  ok('the global list names nothing twice', new Set(await globalKeys()).size === (await globalKeys()).length);

  /* AND IT CAN BE BROUGHT BACK. tools/r2pull.mjs lists the bucket and writes the
     copy into the folder shape tools/backup.py --restore reads. Until 2026-10-02
     nothing had ever read the R2 copy. */
  const { pull } = await import('../tools/r2pull.mjs');
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { createHash } = await import('node:crypto');
  const dir = mkdtempSync(tmpdir() + '/myset-r2pull-');
  const man = await pull(dir);
  ok('the pull reads every object, past the listing\'s first page', man.copied === home.size && man.failed.length === 0 && home.size > 25, { copied: man.copied, of: home.size, failed: man.failed });
  const disk = (k) => readFileSync(`${dir}/keys/${k.replace(/\//g, '%2F')}`);
  ok('each file on disk is the document the store holds, byte for byte',
     man.rows.every((r) => { const b = __dump().get(r.key); return b && Buffer.compare(disk(r.key), Buffer.from(b.body)) === 0; }));
  ok('with the checksum the restore compares against', man.rows.every((r) => createHash('sha256').update(disk(r.key)).digest('hex') === r.sha256));
  ok('a key with a slash in it lands as one file', man.rows.some((r) => r.key === 'mediadash/thumb/2026-10-01_A_POST') && disk('mediadash/thumb/2026-10-01_A_POST').toString() === 'jpeg bytes');
  rmSync(dir, { recursive: true, force: true });
  __r2.uninstall();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
