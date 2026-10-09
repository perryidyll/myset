/* ONE SMALL FILE PER PAGE ADDRESS AND PER ARTIST, BESIDE THE ARTIST LIST  (decision 0176)

   `artists` is one document holding every artist. The audience path asked it which
   artist a page address is (every poll, vote and page load on a cold instance) and
   every vote asked it for the artist's name. The 2026-10-02 audit: about 215 KB a
   read at 1,000 artists, 2 to 3 MB at 10,000.

   Step one of "one small file per slug, per artist and per email": `aslug_<slug>`
   and `arow_<aid>`, written after the list's own write, read by the public lookup
   and by artistById. The list stays the truth: a copy that is missing, unreadable,
   disagreeing or saying "leaving" sends the reader to the list; a lost copy is put
   right by the heal; sign-in, roles and prices never read a copy. */
process.env.ADMIN_CODE = 'devlocal';

const authFn = (await import('../netlify/functions/auth.mjs')).default;
const { createArtist, readArtists, mutateArtists, artistById, signToken, verifyToken, revOf, __flushArtists } =
  await import('../netlify/functions/_auth.mjs');
const { publicArtist, readDoc, casDoc, store } = await import('../netlify/functions/_lib.mjs');
const L = await import('../netlify/functions/_lookup.mjs');
const { startDeletion, cancelDeletion, freeSlug, deleteArtist, keysFor } = await import('../netlify/functions/_account.mjs');
const { killSessions, newSid } = await import('../netlify/functions/_session.mjs');
const S = await import('../netlify/functions/_sample.mjs');
const { __opsStart, __opsStop, __failWrites, __failReads, __failDeletesAfter, __dump, __reset } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail).slice(0, 600)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const doc = async (k) => (await readDoc(k, null)).data;
const ask = (slug) => publicArtist(new Request('https://x/api/me?a=' + slug));
const count = async (fn) => {
  __opsStart(); const out = await fn(); const log = __opsStop();
  return { out, reads: log.filter((l) => l.startsWith('get ')).length, list: log.some((l) => l === 'get artists'),
           keys: log.filter((l) => l.startsWith('get ')).map((l) => l.slice(4)) };
};
const hit = async (body, token) => {
  const r = await authFn(new Request('https://x/api/auth', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body) }));
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
/* A week on each time, so a test's heal is always past the last pass's gap. */
let clock = Date.now();
const heal = (o = {}) => L.healLookups({ now: (clock += 7 * 864e5), ...o });
const lookupKeysInStore = () => [...__dump().keys()].filter((k) => /^a(slug|row)_/.test(k));

console.log('\nTHE WRITER  a sign-up writes its two small copies after the list');
const kit = await createArtist({ email: 'kit@example.com', name: 'Kit Moss', slug: 'kit' });
const K = kit.artistId;
let reg = await readArtists();
ok('the list carries a version that moves with every write', Number(reg.seq) > 0, reg.seq);
eq('the address names the artist, at the list’s version', await doc(L.SLUG_KEY('kit')), { aid: K, seq: reg.seq });
let row = await doc(L.ROW_KEY(K));
eq('the artist’s copy carries the row, its addresses and the version',
   [row && row.row.name, row && row.row.slug, row && row.names, row && row.seq], ['Kit Moss', 'kit', ['kit'], reg.seq]);
ok('and never the two sign-in facts', row && !('rev' in row.row) && !('dead' in row.row), row);
const before = row.seq;
await mutateArtists((r) => { r.byId[K].plan = 'plus'; return true; });
row = await doc(L.ROW_KEY(K));
reg = await readArtists();
eq('a plan change rewrites the artist’s copy at the new version', [row.row.plan, row.seq], ['plus', reg.seq]);
ok('the version went up', reg.seq > before, { before, now: reg.seq });
eq('and leaves the address alone: it did not change', (await doc(L.SLUG_KEY('kit'))).seq, before);
const sidA = newSid();
const TA = await signToken('kit@example.com', revOf(reg, K), sidA);
const seqBeforeKill = (await doc(L.ROW_KEY(K))).seq;
await killSessions(K, ['some-other-device']);
eq('a sign-out of one device does not touch the copy: `dead` is not on it', [(await doc(L.ROW_KEY(K))).seq, 'dead' in (await doc(L.ROW_KEY(K))).row], [seqBeforeKill, false]);
ok('…while the list has it', !!(await readArtists()).byId[K].dead);
ok('no copy carries an email address (an address is sign-in, and stays on the list)',
   lookupKeysInStore().every((k) => !JSON.stringify(__dump().get(k).body.toString()).includes('@')), lookupKeysInStore());

console.log('\nTHE PUBLIC LOOKUP  two small files on a cold instance, nothing on a warm one');
__flushArtists();
let c = await count(() => ask('kit'));
eq('a cold lookup resolves the address', c.out, K);
eq('THE FIX: by two small files, never the list', [c.reads, c.list, c.keys], [2, false, [L.SLUG_KEY('kit'), L.ROW_KEY(K)]]);
c = await count(() => ask('kit'));
eq('warm: nothing at all', [c.out, c.reads], [K, 0]);
c = await count(() => artistById(K));
eq('the name on a page is one small file, not the list', [c.out && c.out.name, c.reads, c.list], ['Kit Moss', 1, false]);
c = await count(() => ask('nobody-here'));
eq('an address nobody has is still asked of the list (a NO is never taken from a copy)', [c.out, c.list], [null, true]);

console.log('\nA RENAMED PAGE  the old address keeps answering (0106)');
const TK = await signToken('kit@example.com', revOf(await readArtists(), K), newSid());
ok('she renames her page', (await hit({ action: 'setSlug', slug: 'kitmoss' }, TK)).ok);
eq('the new address has its copy', (await doc(L.SLUG_KEY('kitmoss'))).aid, K);
eq('the old one still names her', (await doc(L.SLUG_KEY('kit'))).aid, K);
eq('her copy lists both, and the new name', [(await doc(L.ROW_KEY(K))).names, (await doc(L.ROW_KEY(K))).row.slug], [['kit', 'kitmoss'], 'kitmoss']);
__flushArtists();
c = await count(async () => [await ask('kitmoss'), await ask('kit')]);
eq('both resolve from the copies alone', [c.out, c.list], [[K, K], false]);
ok('she takes her old name back', (await hit({ action: 'setSlug', slug: 'kit' }, TK)).ok);
eq('…and the copies follow', [(await doc(L.ROW_KEY(K))).row.slug, (await doc(L.ROW_KEY(K))).names], ['kit', ['kit', 'kitmoss']]);

console.log('\nLEAVING  a page asked for deletion goes dark; Undo brings it back (0098)');
await startDeletion(K, 'artist');
ok('the copy says she is leaving', !!(await doc(L.ROW_KEY(K))).row.del);
__flushArtists();
c = await count(() => ask('kit'));
eq('THE POINT: the page is dark, and the list said so', [c.out, c.list], [null, true]);
await cancelDeletion(K);
__flushArtists();
c = await count(() => ask('kit'));
eq('Undo: back at once, from the copies', [c.out, c.list], [K, false]);
await startDeletion(K, 'artist');
await freeSlug(K);
eq('freeing the address deletes its copies', [await doc(L.SLUG_KEY('kit')), await doc(L.SLUG_KEY('kitmoss'))], [null, null]);
eq('and her copy names no address', (await doc(L.ROW_KEY(K))).names, []);
__flushArtists();
eq('the freed name answers for nobody', await ask('kit'), null);
await cancelDeletion(K);
__flushArtists();
reg = await readArtists();
/* (cancelDeletion gives a freed name back only when no row has that id — and her own
   row does, since her id is the name she signed up with. Found here; not this change's.) */
eq('Undo: the copies say what the list says about the freed name', [await ask('kit'), ((await doc(L.SLUG_KEY('kit'))) || {}).aid || null], [reg.bySlug.kit || null, reg.bySlug.kit || null]);
ok('she takes it back by hand', (await hit({ action: 'setSlug', slug: 'kit' }, TK)).ok);
__flushArtists();
eq('…copies and all', [await ask('kit'), (await doc(L.SLUG_KEY('kit'))).aid], [K, K]);

console.log('\nTHE PURGE  the copies are leaves of the account, deleted with it (0173)');
const pat = await createArtist({ email: 'pat@example.com', name: 'Pat', slug: 'pat' });
const P = pat.artistId;
const pk = await keysFor(P);
ok('keysFor names both copies', pk.includes(L.ROW_KEY(P)) && pk.includes(L.SLUG_KEY('pat')), pk.filter((k) => k.startsWith('a')));
eq('lookupKeys says the same', L.lookupKeys(await readArtists(), P), [L.ROW_KEY(P), L.SLUG_KEY('pat')]);
await startDeletion(P, 'artist');
await deleteArtist(P);
eq('after the purge: no copy, no row, no page', [await doc(L.ROW_KEY(P)), await doc(L.SLUG_KEY('pat')), !!(await readArtists()).byId[P], await ask('pat')], [null, null, false, null]);

console.log('\nSAMPLE PAGES  not on the list until claimed; a claim undone leaves no copy behind (0101)');
const OWN = 'tidesample';
await S.mutateSampleReg((r) => { r.byId[OWN] = { slug: 'tide', name: 'The Tide', st: 'ready', at: Date.now(), exp: Date.now() + 864e5 }; r.bySlug.tide = OWN; return true; });
eq('a sample has no copy', [await doc(L.SLUG_KEY('tide')), await doc(L.ROW_KEY(OWN))], [null, null]);
let cl = await S.claimSampleArtist({ owner: OWN, email: 'tide@example.com' });
ok('claimed', cl.ok, cl);
eq('a claim writes the copies like any sign-up', [(await doc(L.SLUG_KEY('tide'))).aid, (await doc(L.ROW_KEY(OWN))).row.name], [OWN, 'The Tide']);
let un = await S.undoClaim(OWN);
ok('the founder undoes it', un.ok, un);
eq('the copies leave with the row', [await doc(L.SLUG_KEY('tide')), await doc(L.ROW_KEY(OWN))], [null, null]);
__flushArtists();
eq('and the address is nobody’s on the public door', await ask('tide'), null);
cl = await S.claimSampleArtist({ owner: OWN, email: 'tide@example.com' });
ok('claimed again', cl.ok, cl);
__failDeletesAfter(0);                      // the undo's function dies after the list's write
un = await S.undoClaim(OWN);
__failDeletesAfter(null);
ok('undone again, its copies left behind', un.ok && !!(await doc(L.ROW_KEY(OWN))), un);
let h = await heal();
eq('THE HEAL: a page the sample register holds and the list does not has no copy',
   [await doc(L.SLUG_KEY('tide')), await doc(L.ROW_KEY(OWN)), h.orphans], [null, null, 2]);
__flushArtists();
eq('so its address answers for nobody', await ask('tide'), null);

console.log('\nWHEN A COPY IS WRONG  the list decides');
__failWrites(/^a(slug|row)_/);
const ivy = await createArtist({ email: 'ivy@example.com', name: 'Ivy', slug: 'ivy' });
__failWrites(null);
ok('a sign-up whose copies could not be written still happened', ivy.ok && !!(await readArtists()).byId[ivy.artistId], ivy);
eq('it has no copies', [await doc(L.SLUG_KEY('ivy')), await doc(L.ROW_KEY(ivy.artistId))], [null, null]);
__flushArtists();
eq('and its page opens anyway, from the list', await ask('ivy'), ivy.artistId);
eq('and its name is found', ((await artistById(ivy.artistId)) || {}).name, 'Ivy');
__failReads(/^aslug_/);
__flushArtists();
eq('a copy that cannot be read: the list answers', await ask('kit'), K);
__failReads(null);
await casDoc(L.SLUG_KEY('ghost'), () => ({}), (d) => { d.aid = K; d.seq = 1; return true; });
__flushArtists();
eq('THE GUARD: an address whose copy names an artist who does not list it is asked of the list', await ask('ghost'), null);
const jo = await createArtist({ email: 'jo@example.com', name: 'Jo', slug: 'jo' });
__failWrites(/^arow_/);
await startDeletion(jo.artistId, 'artist');
__failWrites(null);
__flushArtists();
eq('a lost copy of a deletion answers for the page until the heal (the one stale YES, 0176)', await ask(jo.slug), jo.artistId);
h = await heal();
__flushArtists();
eq('the heal puts it right: dark', [await ask(jo.slug), !!(await doc(L.ROW_KEY(jo.artistId))).row.del], [null, true]);

console.log('\nORDER  a copy from an older list never overwrites one from a newer');
const old = await readArtists();
await mutateArtists((r) => { r.byId[K].name = 'Kit Moss Band'; return true; });
const newer = await doc(L.ROW_KEY(K));
await L.writeLookups(new Map(), old);       // a slow writer finishing late, with the list as it was
eq('THE GUARD: the newer copy stands', [(await doc(L.ROW_KEY(K))).row.name, (await doc(L.ROW_KEY(K))).seq], ['Kit Moss Band', newer.seq]);
ok('the version is never behind the clock', L.nextSeq({ seq: 5 }) >= Date.now() - 5 && L.nextSeq({ seq: Date.now() + 1e6 }) > Date.now() + 1e6);

console.log('\nSIGN-IN NEVER READS A COPY  (0dd, INVARIANT 0hp)');
reg = await readArtists();
const T1 = await signToken('kit@example.com', revOf(reg, K), newSid());
await casDoc(L.ROW_KEY(K), () => ({}), (d) => { d.row = {}; d.names = []; d.seq = Number.MAX_SAFE_INTEGER; return true; });
await store().delete(L.SLUG_KEY('kit'));
const me = await verifyToken(T1);
eq('a wrecked copy changes nothing about who is signed in', [me && me.artistId, me && me.role, me && me.artist.name], [K, 'owner', 'Kit Moss Band']);
const sidB = newSid();
const TB = await signToken('kit@example.com', revOf(reg, K), sidB);
await killSessions(K, [sidB]);
eq('a device signed out is out, though no copy ever carried `dead`', await verifyToken(TB), null);
ok('and the other device is still in', !!(await verifyToken(TA)));

console.log('\nTHE HEAL  a lost copy is rewritten; a newer one is kept; a list restored from a backup wins');
for (const k of lookupKeysInStore()) await store().delete(k);
eq('every copy gone', lookupKeysInStore().length, 0);
h = await heal();
reg = await readArtists();
const live = Object.keys(reg.byId);
ok('one pass writes them all back', h.done && live.every((a) => __dump().has(L.ROW_KEY(a))), { h, live });
eq('the wrecked one is right again', [(await doc(L.ROW_KEY(K))).row.name, (await doc(L.SLUG_KEY('kit'))).aid], ['Kit Moss Band', K]);
eq('a pass inside the gap is one read', (await count(() => L.healLookups())).reads, 1);
h = await heal();
eq('a second pass finds nothing to do', [h.done, h.fixed], [true, 0]);
await casDoc(L.ROW_KEY(K), () => ({}), (d) => { d.row = { name: 'From a newer write' }; d.names = ['kit']; d.seq = reg.seq + 3; return true; });
h = await heal();
eq('THE GUARD: a copy newer than the heal’s read of the list is left alone', [(await doc(L.ROW_KEY(K))).row.name, h.kept >= 1], ['From a newer write', true]);
/* The list put back from a backup a week old: its version is behind every copy made
   since, and those copies were made long before this heal read it. */
await casDoc('artists', () => ({}), (a) => { a.seq = Date.now() - 7 * 864e5; return true; });
await casDoc(L.ROW_KEY(K), () => ({}), (d) => { d.seq = Date.now() - 864e5; return true; });
h = await heal();
eq('a list restored from a backup wins over copies made before it', (await doc(L.ROW_KEY(K))).row.name, 'Kit Moss Band');
for (let i = 0; i < 30; i++) await createArtist({ email: `crowd${i}@example.com`, name: `Crowd ${i}`, slug: `crowd${i}` });
for (const k of lookupKeysInStore()) await store().delete(k);
let rings = 0, r1 = null;
do { h = await heal({ budgetMs: 0 }); rings++; if (rings === 1) r1 = h; } while (!h.done && rings < 50);
ok('with no time at all a ring still moves, and the pass carries on where it stopped', !r1.done && r1.walked > 0 && h.done && rings > 2, { r1, rings });
reg = await readArtists();
ok('and every artist has its copies at the end', Object.keys(reg.byId).every((a) => __dump().has(L.ROW_KEY(a))) &&
   Object.entries(reg.bySlug).every(([s]) => __dump().has(L.SLUG_KEY(s))));

console.log('\nTHE BELL  citycron rings the heal beside the city index’s');
await store().delete(L.HEAL_KEY);
await store().delete(L.ROW_KEY(K));
const citycron = (await import('../netlify/functions/citycron.mjs')).default;
const rang = await citycron(new Request('https://x/.netlify/functions/citycron', { method: 'POST', body: '{}' }));
eq('a ring puts a lost copy back', [rang.status, ((await doc(L.ROW_KEY(K))) || {}).row && (await doc(L.ROW_KEY(K))).row.name], [200, 'Kit Moss Band']);
__failReads(/^alookheal$/);
const rang2 = await citycron(new Request('https://x/.netlify/functions/citycron', { method: 'POST', body: '{}' }));
__failReads(null);
eq('a heal that cannot read its own state never stops the bell', rang2.status, 200);

console.log('\nWHAT A POLL READS  the list against the two copies, at 1,000 and 10,000 artists');
/* A list shaped like production's rows: the fields createArtist writes, a plan, a
   first name, a tick, a revision; one owner address each and a band mate on one in
   five; an old address on one in ten. */
const synth = (n) => {
  const a = { v: 2, rev: 1, seq: Date.now(), byId: {}, bySlug: {}, byEmail: {}, oldSlug: {} };
  for (let i = 0; i < n; i++) {
    const id = `artist-number-${i}`;
    a.byId[id] = { slug: id, name: `Artist Number ${i}`, createdAt: 1759000000000 + i, plan: i % 4 ? 'free' : 'plus',
                   referredBy: i % 7 ? null : 'artist-number-1', src: i % 3 ? '' : 'instagram', refSlug: '', first: 'Artist',
                   verified: i % 9 === 0, rev: 2, shareStats: true };
    a.bySlug[id] = id;
    a.byEmail[`artist.number.${i}@example.com`] = { artistId: id, role: 'owner' };
    if (i % 5 === 0) a.byEmail[`bandmate.${i}@example.com`] = { artistId: id, role: 'member', access: null };
    if (i % 10 === 0) a.oldSlug[`old-name-${i}`] = { aid: id, at: 1759000000000 };
  }
  return a;
};
const bytesOf = (k) => { const e = __dump().get(k); return e ? e.body.length : 0; };
const measured = {};
for (const n of [1000, 10000]) {
  __reset();
  const a = synth(n);
  await store().set('artists', JSON.stringify(a));
  await L.writeLookups(new Map(), a);
  const id = `artist-number-${n - 3}`;
  __flushArtists();
  c = await count(() => ask(id));
  const after = c.keys.reduce((s, k) => s + bytesOf(k), 0);
  const name = bytesOf(L.ROW_KEY(id));
  const list = bytesOf('artists');
  measured[n] = { list, after, name };
  console.log(`    ${n.toLocaleString('en-US')} artists: the list is ${(list / 1024).toFixed(0)} KB — what a cold address lookup and every vote's name lookup read until now;` +
              ` the address lookup now reads ${after} bytes (two files) and the name ${name} bytes`);
  eq(`${n.toLocaleString('en-US')}: the address resolves without the list`, [c.out, c.list], [id, false]);
  ok(`${n.toLocaleString('en-US')}: under a kilobyte, against ${(list / 1024).toFixed(0)} KB`, after < 1024 && list > 100 * after, measured[n]);
  const t0 = Date.now();
  await mutateArtists((r) => { r.byId[id].plan = 'pro'; return true; });
  const ms = Date.now() - t0;
  console.log(`    ${n.toLocaleString('en-US')} artists: one registry write with its copies took ${ms} ms on the fake store (fingerprinting every row twice)`);
  eq(`${n.toLocaleString('en-US')}: the write rewrote that artist's copy and nothing else`, [(await doc(L.ROW_KEY(id))).row.plan], ['pro']);
}
ok('the copies do not grow with the list', measured[10000].after - measured[1000].after < 16, measured);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
