/* A SAMPLE IS ERASED LEAVES FIRST, AND ITS ROW GOES ONLY WHEN NOTHING IT NAMES IS LEFT
   (decision 0204, INVARIANT 0jg)

   The scale audit of 2 October 2026 (*Background jobs fall behind*: "account deletion
   removes the index first, so a killed run orphans files") was fixed for accounts by
   0173. A sample page's erase — Delete forever, a rebuild, the 180-day clock — still
   ran its key list index first, swallowed every failed delete, and dropped the
   register row whatever happened. Every key is computed, never listed (INVARIANT 1),
   so a file left behind with nothing naming it is stored for ever.

   This kills Delete forever after every possible number of deletes and pins:
     · while anything of the sample is still stored, its register row is still there
       and everything left is named by its key list — so the next try can find it
     · Delete forever said so (it threw) whenever it stopped short
     · the next try always finishes, and leaves nothing */
process.env.ADMIN_CODE = 'devlocal';
const S = await import('../netlify/functions/_sample.mjs');
const { keysFor } = await import('../netlify/functions/_account.mjs');
const { sampleImgKeys } = await import('../netlify/functions/_img.mjs');
const { getProfile, store } = { ...(await import('../netlify/functions/_profile.mjs')), ...(await import('../netlify/functions/_lib.mjs')) };
const { __dump, __reset, __failDeletesAfter } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64');
const snapshot = () => __dump();
const restore = async (snap) => { __reset(); for (const [k, e] of snap) await store().set(k, e.body, { metadata: e.metadata }); };

console.log('\nSETUP  a sample with a cover and a portrait');
const made = await S.createSample({ kind: 'artist', name: 'The Erase Test', slug: 'theerasetest', city: 'Leeds',
  photos: { cover: { bytes: JPEG, type: 'image/jpeg' }, avatar: { bytes: JPEG, type: 'image/jpeg' } }, by: 'founder' });
ok('it is made', made.ok, made);
const owner = made.owner;
const p0 = await getProfile(owner);
const imgs = sampleImgKeys([p0.photo, p0.avatar, ...(p0.photos || [])]);
ok('its two pictures are stored', imgs.length >= 2 && imgs.every((k) => __dump().has(k)), imgs);
const mine = [...new Set([...(await keysFor(owner)), ...imgs, S.SAMPLE(owner)])].filter((k) => __dump().has(k));
ok('and it holds several documents to erase', mine.length >= 4, mine);
const snap = snapshot();
const rowOf = async () => (await S.readSampleReg()).byId[owner];

console.log('\nDELETE FOREVER, KILLED AFTER EVERY POSSIBLE NUMBER OF DELETES');
{
  const orphaned = [], silent = [], unfinished = [];
  for (let k = 0; k <= mine.length; k++) {
    await restore(snap);
    __failDeletesAfter(k);
    const threw = await S.removeSample(owner, { by: 'founder' }).then(() => false, () => true);
    __failDeletesAfter(null);
    const still = mine.filter((x) => __dump().has(x));
    const row = await rowOf();
    if (still.length && !row) orphaned.push({ k, still: still.slice(0, 3) });
    if (still.length && !threw) silent.push({ k, still: still.slice(0, 3) });
    if (row) {
      // what is left must be named by what the next try reads: the key list, the profile's pictures, the record
      const p = await getProfile(owner).catch(() => ({}));
      const named = new Set([...(await keysFor(owner)), ...sampleImgKeys([p.photo, p.avatar, ...(p.photos || [])]), S.SAMPLE(owner)]);
      const unnamed = still.filter((x) => !named.has(x));
      if (unnamed.length) orphaned.push({ k, unnamed });
      await S.removeSample(owner, { by: 'founder' }).catch(() => {});
      if (mine.some((x) => __dump().has(x)) || await rowOf()) unfinished.push({ k });
    }
  }
  eq(`THE FIX: killed after each of 0…${mine.length} deletes, nothing is left that nothing names`, orphaned, []);
  eq('and a run that stopped short said so', silent, []);
  eq('and the next try always finishes it', unfinished, []);
}

console.log('\nA REBUILD THAT KEEPS THE PHOTOS STILL KEEPS THEM');
{
  await restore(snap);
  const again = await S.createSample({ kind: 'artist', name: 'The Erase Test', replace: owner, keep: true, by: 'founder' });
  ok('the rebuild is made', again.ok, again);
  ok('and the kept pictures are still stored', imgs.every((k) => __dump().has(k)), imgs.filter((k) => !__dump().has(k)));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
