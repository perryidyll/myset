/* CLIPS ON A COMMUNITY POST  (_video.mjs, vid.mjs, the clip action in community.mjs)

   Pins, in order:
     · the door: what a real MP4 is, what is refused, and by BYTES not by trust
     · mp4Seconds really reads the duration out of the container
     · a clip goes up on its own, gets an id, and a post can name it
     · a post that names a clip nobody uploaded is refused (a hand-made request
       must not be able to hang a player on every phone in the room)
     · /api/vid answers a Range with a 206 — without this no iPhone plays anything
     · the poster is a normal photo slot, so /api/img serves it
     · deleting the post deletes the clip AND its poster
     · an unposted clip is swept; a POSTED clip in the pending list is NOT
     · the daily post limit is enforced at the upload door, not only at the post
     · export and delete know about clips (nothing is left behind) */
process.env.ADMIN_CODE = 'devlocal';

const commFn = (await import('../netlify/functions/community.mjs')).default;
const vidFn  = (await import('../netlify/functions/vid.mjs')).default;
const imgFn  = (await import('../netlify/functions/img.mjs')).default;
const { createArtist } = await import('../netlify/functions/_auth.mjs');
const { decodeVideoDataUrl, mp4Seconds, MAX_VIDEO_BYTES, MAX_SECONDS,
        readPending, sweepPending, sweepQueue, getClip, PENDING_TTL,
        notePending, CHUNK_BYTES, readUpload } = await import('../netlify/functions/_video.mjs');
const clipupFn = (await import('../netlify/functions/clipup.mjs')).default;
const { readPosts, moderate } = await import('../netlify/functions/_community.mjs');
const { keysFor } = await import('../netlify/functions/_account.mjs');
const { getImage } = await import('../netlify/functions/_img.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const post = (url, body) => new Request(url, { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const jget = async (r) => { try { return await r.json(); } catch { return {}; } };
const eq2 = (name, got, want) => ok(name, got === want, { got, want });

/* A real-enough MP4: an `ftyp` box, then a `moov` holding an `mvhd` that says how
   long it is. Nothing decodes it; the point is that the parser and the signature
   check are looking at genuine container bytes, not at a label we handed them. */
function fakeMp4(seconds = 12, pad = 800) {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(24, 0); ftyp.write('ftyp', 4); ftyp.write('isom', 8);
  const mvhd = Buffer.alloc(108);
  mvhd.writeUInt32BE(108, 0); mvhd.write('mvhd', 4);
  mvhd.writeUInt8(0, 8);                       // version 0
  mvhd.writeUInt32BE(1000, 20);                // timescale
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 24);
  const moov = Buffer.concat([Buffer.alloc(8), mvhd]);
  moov.writeUInt32BE(moov.length, 0); moov.write('moov', 4);
  const mdat = Buffer.alloc(pad + 8);
  mdat.writeUInt32BE(mdat.length, 0); mdat.write('mdat', 4);
  return Buffer.concat([ftyp, moov, mdat]);
}
const asData = (buf, type = 'video/mp4') => `data:${type};base64,${buf.toString('base64')}`;
const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7), Buffer.from([0xff, 0xd9]),
]).toString('base64');

console.log('\nTHE DOOR — bytes, not labels');
{
  ok('a real MP4 is accepted', !decodeVideoDataUrl(asData(fakeMp4(10))).error);
  ok('and its duration is read out of the container',
    Math.abs(decodeVideoDataUrl(asData(fakeMp4(10))).seconds - 10) < 0.01);
  ok('mp4Seconds handles a 64-bit (version 1) mvhd', (() => {
    const b = fakeMp4(5); // rebuild as version 1
    const i = b.indexOf(Buffer.from('mvhd'));
    b.writeUInt8(1, i + 4); b.writeUInt32BE(1000, i + 24);
    b.writeBigUInt64BE(7000n, i + 28);
    return Math.abs(mp4Seconds(b) - 7) < 0.01;
  })());
  ok('a WebM is accepted by its EBML magic', !decodeVideoDataUrl(
    `data:video/webm;base64,${Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200, 3)]).toString('base64')}`).error);

  ok('a JPEG dressed up as an MP4 is refused',
    /isn.t really a video/.test(decodeVideoDataUrl(
      'data:video/mp4;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).toString('base64')).error || ''));
  ok('a GIF is refused before it is even decoded',
    !!decodeVideoDataUrl('data:image/gif;base64,R0lGOD').error);
  ok('empty is refused', !!decodeVideoDataUrl('data:video/mp4;base64,').error);
  {
    const err = decodeVideoDataUrl(asData(fakeMp4(5, MAX_VIDEO_BYTES + 5000))).error || '';
    /* The message carries the ACTUAL size and what to do about it, because it is
       shown to a person as-is. "Too big" told somebody nothing they could act on. */
    ok(`over ${MAX_VIDEO_BYTES / 1048576}MB is refused, by bytes`, /limit is/.test(err), err);
    ok('and the refusal says how big it actually is', /\d+\.\dMB/.test(err), err);
  }
  ok(`a clip longer than ${MAX_SECONDS}s is refused even when it is small`,
    /seconds/.test(decodeVideoDataUrl(asData(fakeMp4(120))).error || ''),
    decodeVideoDataUrl(asData(fakeMp4(120))));
}

console.log('\nUPLOAD, THEN POST');
const A = await createArtist({ email: 'clipper@example.com', name: 'Clipper' });
const aid = A.artistId, slug = A.slug;
const FAN = 'fanclip0001';
let clipId = '';
{
  const r = await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'clip', fan: FAN, data: asData(fakeMp4(8)), poster: JPEG }));
  const d = await jget(r);
  clipId = d.clip || '';
  ok('the clip uploads on its own and comes back with an id', r.status === 200 && /^k[a-z0-9]{10}$/.test(clipId), d);
  ok('the bytes really landed in the store', !!(await getClip(aid, clipId)));
  ok('the poster landed as a normal photo slot', !!(await getImage(aid, clipId)));
  ok('and it is on the pending list until a post claims it',
    !!(await readPending(aid)).by[clipId]);

  const p = await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'post', fan: FAN, text: 'what a night', clip: clipId }));
  const pd = await jget(p);
  ok('a post can name it', p.status === 200 && !!pd.id, pd);
  const shown = (pd.posts || [])[0] || {};
  ok('the feed gives the page a clip src and a poster',
    (shown.clip || {}).src === `/api/vid?a=${aid}&c=${clipId}`
    && (shown.clip || {}).poster === `/api/img?a=${aid}&s=${clipId}`, shown.clip);
  ok('and it is off the pending list', !(await readPending(aid)).by[clipId]);
}

console.log('\nA POST CANNOT INVENT A CLIP');
{
  const r = await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'post', fan: 'fanclip0002', text: 'hi', clip: 'k0000000000' }));
  const d = await jget(r);
  ok('naming a clip nobody uploaded is refused', r.status === 400 && /didn.t finish/.test(d.error || ''), d);
  const r2 = await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'post', fan: 'fanclip0003', text: 'hi', clip: '../../etc/passwd' }));
  ok('and so is a clip id that is not a clip id', r2.status === 400);
}

console.log('\nRANGE — the thing iOS will not play without');
{
  const full = await vidFn(new Request(`https://x/api/vid?a=${aid}&c=${clipId}`));
  ok('a plain GET is a 200 with the whole clip', full.status === 200);
  ok('and says it accepts ranges', full.headers.get('accept-ranges') === 'bytes');
  ok('cached hard, and durably at the edge',
    /immutable/.test(full.headers.get('cache-control') || '')
    && /durable/.test(full.headers.get('netlify-cdn-cache-control') || ''));
  const total = Number(full.headers.get('content-length'));

  const probe = await vidFn(new Request(`https://x/api/vid?a=${aid}&c=${clipId}`, { headers: { range: 'bytes=0-1' } }));
  ok('THE TRAP: bytes=0-1 answers 206, not 200', probe.status === 206, probe.status);
  ok('with a content-range naming the real size',
    probe.headers.get('content-range') === `bytes 0-1/${total}`, probe.headers.get('content-range'));
  ok('and exactly two bytes', (await probe.arrayBuffer()).byteLength === 2);

  const open = await vidFn(new Request(`https://x/api/vid?a=${aid}&c=${clipId}`, { headers: { range: 'bytes=10-' } }));
  ok('an open-ended range runs to the end',
    open.status === 206 && (await open.arrayBuffer()).byteLength === total - 10);
  const suffix = await vidFn(new Request(`https://x/api/vid?a=${aid}&c=${clipId}`, { headers: { range: 'bytes=-16' } }));
  ok('a suffix range means the LAST bytes, not the first',
    suffix.status === 206 && suffix.headers.get('content-range') === `bytes ${total - 16}-${total - 1}/${total}`,
    suffix.headers.get('content-range'));
  const past = await vidFn(new Request(`https://x/api/vid?a=${aid}&c=${clipId}`, { headers: { range: `bytes=${total + 50}-` } }));
  ok('a range past the end is 416, not an empty 206 the player waits on', past.status === 416);

  ok('an unknown clip is a 404', (await vidFn(new Request(`https://x/api/vid?a=${aid}&c=k9999999999`))).status === 404);
  ok('a malformed clip id is a 404', (await vidFn(new Request(`https://x/api/vid?a=${aid}&c=..`))).status === 404);
  ok('the slug works as well as the id', (await vidFn(new Request(`https://x/api/vid?a=${slug}&c=${clipId}`))).status === 200);
  ok('the poster is served by /api/img',
    (await imgFn(new Request(`https://x/api/img?a=${aid}&s=${clipId}`))).status === 200);
}

console.log('\nTHE SWEEP — nothing orphaned, nothing wrongly taken');
{
  const r = await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'clip', fan: 'fanclip0009', data: asData(fakeMp4(4)) }));
  const orphan = (await jget(r)).clip;
  ok('an unposted clip exists', !!(await getClip(aid, orphan)));
  ok('and is not swept while it is young', (await sweepPending(aid, Date.now())) === 0);
  const later = Date.now() + PENDING_TTL + 1000;
  ok('two hours later it is swept', (await sweepPending(aid, later)) === 1);
  ok('and its bytes are gone', !(await getClip(aid, orphan)));

  /* The one that matters: clearPending is best-effort, so a POSTED clip can be
     left on the pending list. Sweeping it on age alone would take a video off a
     real post two hours after somebody put it there. */
  await notePending(aid, clipId);
  ok('a POSTED clip sitting in the pending list is NOT deleted',
    (await sweepPending(aid, Date.now() + PENDING_TTL + 1000)) === 0);
  ok('and its bytes survive', !!(await getClip(aid, clipId)));

  await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'clip', fan: 'fanclip0010', data: asData(fakeMp4(4)) }));
  const q = await sweepQueue(Date.now() + PENDING_TTL + 1000, 1);
  ok('the cron drains the queue without ever listing keys', q.swept === 1, q);
}

console.log('\nTHE DAILY LIMIT IS ON THE UPLOAD DOOR TOO');
{
  const F = 'fanclip0100';
  for (let i = 0; i < 3; i++) {
    await commFn(post(`https://x/api/community?a=${slug}`, { action: 'post', fan: F, text: `n${i}` }));
  }
  const r = await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'clip', fan: F, data: asData(fakeMp4(4)) }));
  ok('a phone that used its three posts cannot still upload 3MB', r.status === 429, r.status);
}

console.log('\nA FAN\u2019S OWN POST: CHANGE IT FOR A DAY, TAKE IT BACK FOR EVER');
{
  const { editPost, removeOwnPost, EDIT_WINDOW } = await import('../netlify/functions/_community.mjs');
  const F1 = 'faneditor001';
  const made = await jget(await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'post', fan: F1, text: 'grate show', stars: 4 })));
  const pid = made.id;

  const bad1 = await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'postEdit', fan: 'somebodyelse99', id: pid, text: 'mine now' }));
  ok('somebody else cannot edit it', bad1.status === 403, bad1.status);
  ok('and the words are untouched',
    (await readPosts(aid)).list.find((p) => p.id === pid).text === 'grate show');

  const good = await jget(await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'postEdit', fan: F1, id: pid, text: 'great show', stars: 5 })));
  ok('the person who wrote it can', good.ok, good);
  const now = (await readPosts(aid)).list.find((p) => p.id === pid);
  eq2('the typo is fixed', now.text, 'great show');
  eq2('and the stars moved', now.stars, 5);
  ok('the feed says it was edited', (good.posts || []).find((p) => p.id === pid).edited === true);

  /* THE WINDOW IS REAL, and it is enforced in the write rather than by the page —
     a five-star review must not be able to become a one-star one months later,
     under a reply the artist already wrote. */
  await (await import('../netlify/functions/_lib.mjs')).casDoc(`posts_${aid}`, () => ({ v: 1, list: [] }),
    (d) => { const p = d.list.find((x) => x.id === pid); p.at = Date.now() - EDIT_WINDOW - 1000; return true; });
  const late = await editPost(aid, F1, pid, { text: 'one star, terrible' });
  ok('a day later it cannot be edited', !late.ok && /day/.test(late.error), late);
  ok('and the words still stand',
    (await readPosts(aid)).list.find((p) => p.id === pid).text === 'great show');

  const shown = await jget(await commFn(new Request(`https://x/api/community?a=${slug}&fan=${F1}`)));
  const row = (shown.posts || []).find((p) => p.id === pid);
  ok('the page is told the edit button is gone', row && row.mine === true && row.editable === false, row);

  ok('but deleting your own words has no window', (await removeOwnPost(aid, F1, pid)).ok);
  ok('and it is really gone', !(await readPosts(aid)).list.some((p) => p.id === pid));
  ok('deleting it twice says so rather than pretending', !(await removeOwnPost(aid, F1, pid)).ok);
}

console.log('\nHIDING TAKES THE PICTURES DOWN TOO');
{
  /* FOUND BY AN ADVERSARIAL REVIEW. /api/img and /api/vid serve by URL and know
     nothing about whether a post is hidden — so hiding used to leave the bytes
     publicly fetchable, and once deleting for good became a paid feature that left
     a FREE artist with no way at all to take something offensive off their page. */
  const F2 = 'fanmedia0001';
  const clipR = await jget(await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'clip', fan: F2, data: asData(fakeMp4(6)), poster: JPEG })));
  const made = await jget(await commFn(post(`https://x/api/community?a=${slug}`,
    { action: 'post', fan: F2, text: 'with media', photos: [JPEG], clip: clipR.clip })));
  const pid = made.id;
  ok('the photo is served while the post is up',
    (await imgFn(new Request(`https://x/api/img?a=${aid}&s=${pid}_0`))).status === 200);
  ok('and so is the clip', (await vidFn(new Request(`https://x/api/vid?a=${aid}&c=${clipR.clip}`))).status === 200);

  await moderate(aid, { action: 'postHide', id: pid, on: true });
  eq2('hiding takes the photo down for good', (await imgFn(new Request(`https://x/api/img?a=${aid}&s=${pid}_0`))).status, 404);
  eq2('and the clip', (await vidFn(new Request(`https://x/api/vid?a=${aid}&c=${clipR.clip}`))).status, 404);

  const rec = (await readPosts(aid)).list.find((p) => p.id === pid);
  ok('the record stops pointing at bytes that are gone', !(rec.photos || []).length && !rec.clip, rec);
  ok('but the words are still there to un-hide', rec.text === 'with media' && rec.hidden === true);

  await moderate(aid, { action: 'postHide', id: pid, on: false });
  ok('un-hiding brings the words back', !(await readPosts(aid)).list.find((p) => p.id === pid).hidden);
}

console.log('\nDELETING FOR GOOD IS A PAID FEATURE; HIDING IS NOT');
{
  const adminFn = (await import('../netlify/functions/admin.mjs')).default;
  const { signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
  const P = await createArtist({ email: 'freeartist@example.com', name: 'Free Artist' });
  const ftok = await signToken('freeartist@example.com', revOf(await readArtists(), P.artistId));
  const call = (b, t) => adminFn(new Request('https://x/api/admin', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify(b) }));
  const made = await jget(await commFn(post(`https://x/api/community?a=${P.slug}`,
    { action: 'post', fan: 'somefan0001', text: 'hello' })));

  const hide = await call({ action: 'postHide', id: made.id, on: true }, ftok);
  ok('a FREE artist can hide a post — instantly, on any plan', hide.status === 200, hide.status);
  const del = await call({ action: 'postDelete', id: made.id }, ftok);
  eq2('but not delete it for good', del.status, 402);
  ok('and the post is still there to un-hide',
    (await readPosts(P.artistId)).list.some((p) => p.id === made.id));

  await mutateArtists((reg) => { reg.byId[P.artistId].plan = 'plus'; return true; });
  const paid = await call({ action: 'postDelete', id: made.id }, ftok);
  eq2('on Plus it goes', paid.status, 200);
  ok('for good', !(await readPosts(P.artistId)).list.some((p) => p.id === made.id));
}

console.log('\nLEAVING TAKES THE CLIPS WITH IT');
{
  const keys = await keysFor(aid);
  ok('the clip is in the delete/export key list', keys.includes(`vid_${aid}_${clipId}`), keys.filter((k) => k.startsWith('vid_')));
  ok('so is its poster', keys.includes(`img_${aid}_${clipId}`));
  ok('and the pending list itself', keys.includes(`vidpend_${aid}`));

  const before = (await readPosts(aid)).list.find((p) => p.clip === clipId);
  await moderate(aid, { action: 'postDelete', id: before.id });
  ok('deleting the post deletes the clip', !(await getClip(aid, clipId)));
  ok('and its poster', !(await getImage(aid, clipId)));
}

console.log('\nA CLIP THAT ARRIVES IN PIECES  (clipup.mjs)');
/* THE WHOLE POINT OF THIS ENDPOINT. A clip used to travel as base64 inside a JSON
   body, which capped it at 3MB — and 3MB is why the phone had to shrink every clip
   by re-filming it onto a canvas, which is why clips kept arriving silent. Nothing
   here touches the video, so the sound cannot go missing. What has to be pinned is
   that a file broken into pieces comes back out byte-for-byte identical. */
{
  const BIG = fakeMp4(9, CHUNK_BYTES + 20000);          // two pieces, comfortably
  const B = await createArtist({ email: 'chunky@example.com', name: 'Chunky' });
  const bid = B.artistId, bslug = B.slug;
  const F = 'fanchunk001';
  const call = (qs, body, raw) => clipupFn(new Request(`https://x/api/clipup?a=${bslug}&${qs}`, {
    method: 'POST',
    headers: { 'content-type': raw ? 'application/octet-stream' : 'application/json' },
    body: raw ? body : JSON.stringify(body),
  }));

  const tooBig = await jget(await call('begin=1', { fan: F, size: MAX_VIDEO_BYTES + 1 }));
  ok('a file over the limit is refused BEFORE a byte is sent', tooBig.ok === false, tooBig);
  ok('and the refusal names the size and the limit',
    /\d+\.\dMB and the limit is/.test(tooBig.error || ''), tooBig.error);

  const b = await jget(await call('begin=1', { fan: F, size: BIG.length, type: 'video/mp4' }));
  ok('begin mints a clip id', b.ok && /^k[a-z0-9]{10}$/.test(b.clip || ''), b);
  ok('and says how many pieces to expect', b.parts === Math.ceil(BIG.length / CHUNK_BYTES), b);
  ok('it is pending from the very first moment, so it can never be orphaned',
    !!(await readPending(bid)).by[b.clip]);

  const strayPiece = await call(`clip=${b.clip}&i=${b.parts + 5}`, BIG.subarray(0, 10), true);
  ok('a piece outside the agreed count is refused', strayPiece.status === 400, strayPiece.status);

  const early = await jget(await call(`clip=${b.clip}&end=1`, { poster: JPEG }));
  ok('finishing with pieces missing is refused, and says so',
    early.ok === false && /didn.t arrive/.test(early.error || ''), early);
  ok('and nothing is stored for it', !(await getClip(bid, b.clip)));

  /* OUT OF ORDER ON PURPOSE. Pieces are sent one after another by the page, but
     nothing about the protocol requires it, and a retry can arrive late. */
  const pieces = [];
  for (let i = 0; i < b.parts; i++) pieces.push(i);
  for (const i of pieces.reverse()) {
    const piece = BIG.subarray(i * CHUNK_BYTES, Math.min(BIG.length, (i + 1) * CHUNK_BYTES));
    const r = await call(`clip=${b.clip}&i=${i}`, piece, true);
    if (r.status !== 200) ok('piece ' + i + ' accepted', false, r.status);
  }

  const done = await jget(await call(`clip=${b.clip}&end=1`, { poster: JPEG }));
  ok('the pieces become a clip', done.ok === true && done.clip === b.clip, done);
  eq2('and the server read its real length out of the container', done.seconds, 9);

  const stored = await getClip(bid, b.clip);
  ok('THE BYTES COME BACK EXACTLY AS THEY WENT UP',
    !!stored && stored.bytes.length === BIG.length && stored.bytes.equals(BIG),
    stored ? { got: stored.bytes.length, want: BIG.length } : 'nothing stored');
  eq2('and it is stored as an mp4', stored && stored.type, 'video/mp4');
  ok('the poster came with it', !!(await getImage(bid, b.clip)));
  ok('and the pieces are cleaned up the moment they are not needed',
    !(await readUpload(bid, b.clip)));

  /* A file that is a video by name only must not survive being reassembled — the
     check runs on the WHOLE file, because half an MP4 is not a small MP4. */
  const junk = Buffer.alloc(2000, 9);
  const j = await jget(await call('begin=1', { fan: F, size: junk.length }));
  await call(`clip=${j.clip}&i=0`, junk, true);
  const jr = await jget(await call(`clip=${j.clip}&end=1`, {}));
  ok('reassembled junk is still refused', jr.ok === false && /really a video/.test(jr.error || ''), jr);
  ok('and its pieces are cleared away with it', !(await readUpload(bid, j.clip)));

  const ghost = await call('clip=kzzzzzzzzzz&i=0', junk, true);
  ok('a piece for an upload nobody started is refused', ghost.status === 409, ghost.status);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
