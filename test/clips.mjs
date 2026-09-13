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
     · export and delete know about clips (nothing is left behind)
     · THE BYTES ON R2: the signer matches Amazon's published example byte for
       byte; an upload lands on R2 and /api/vid answers a signed link; a phone's
       Range survives the redirect; a pre-R2 clip still serves from Blobs; every
       R2 failure degrades to Blobs or a 404, never a hang or a 500; deleting a
       post, sweeping an orphan and leaving MySet all take the bytes off R2 */
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

console.log('\nHIDING IS A BAR STAR FEATURE; DELETING FOR GOOD IS GONE  (decision 0060)');
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
  eq2('a FREE artist cannot hide a post — it is a Bar Star feature', hide.status, 402);
  ok('and the post is still on the page',
    !(await readPosts(P.artistId)).list.find((p) => p.id === made.id).hidden);
  const del = await call({ action: 'postDelete', id: made.id }, ftok);
  eq2('deleting for good is no longer an action on any plan', del.status, 400);

  await mutateArtists((reg) => { reg.byId[P.artistId].plan = 'plus'; return true; });
  const paid = await call({ action: 'postHide', id: made.id, on: true }, ftok);
  eq2('on Bar Star the hide lands', paid.status, 200);
  ok('and the post is still there to un-hide',
    (await readPosts(P.artistId)).list.find((p) => p.id === made.id).hidden === true);
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


console.log('\nTHE SIGNER, AGAINST AMAZON’S OWN EXAMPLE');
/* The worked example in the S3 developer guide ("Authenticating Requests: Using
   Query Parameters" and "…the Authorization Header"): the example credentials,
   2013-05-24, `examplebucket/test.txt`. The intermediate hashes are published
   too, so the stage that went wrong is named rather than guessed. */
const R2 = await import('../netlify/functions/_r2.mjs');
{
  const key = 'AKIAIOSFODNN7EXAMPLE', secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', stamp = '20130524T000000Z';
  const h = R2.sigv4({ method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt',
    headers: { range: 'bytes=0-9', 'x-amz-content-sha256': R2.EMPTY_SHA, 'x-amz-date': stamp },
    payloadHash: R2.EMPTY_SHA, key, secret, region: 'us-east-1', stamp });
  eq2('the canonical request hashes as Amazon says it should', h.toSign.split('\n')[3],
    '7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972');
  eq2('and the header signature is the published one', h.signature,
    'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  eq2('with the signed headers in canonical order', h.signedHeaders, 'host;range;x-amz-content-sha256;x-amz-date');
  const u = R2.presign({ host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', key, secret, stamp, expires: 86400, region: 'us-east-1' });
  eq2('the presigned URL is the published one, byte for byte', u,
    'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  /* The PUT example from the same guide: `test$file.text`, payload "Welcome to
     Amazon S3.", storage class header. The payload hash 44ce7dd6… is the published
     one (confirmed from a third-party reproduction of the page); the final
     signature is the value the guide gives as far as this author recalls, and an
     independent re-derivation from the bytes undici actually sends agreed with it
     on 2026-09-11 — see the session note. It pins what the GET vectors do not:
     a non-empty payload hash, a `$` in the key, and a `date` header. */
  const ph = R2.sha256('Welcome to Amazon S3.');
  eq2('the PUT example’s payload hashes to the published value', ph, '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072');
  const put = R2.sigv4({ method: 'PUT', host: 'examplebucket.s3.amazonaws.com', path: '/test$file.text',
    headers: { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-content-sha256': ph, 'x-amz-date': stamp, 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
    payloadHash: ph, key, secret, region: 'us-east-1', stamp });
  eq2('and the PUT signature is the expected one', put.signature, '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
  eq2('with the $ in the key encoded in the canonical URI', put.canonical.split('\n')[1], '/test%24file.text');
  eq2('S3 URI encoding: unreserved passes, the rest is %XX upper-case, a slash is data unless told otherwise',
    R2.uriEncode('a b/c~d.e_f-g+h'), 'a%20b%2Fc~d.e_f-g%2Bh');
  eq2('and a path keeps its slashes', R2.uriEncode('/bucket/vid_x_y', true), '/bucket/vid_x_y');
  ok('R2 is OFF until all four variables are set', !R2.r2Enabled());
  process.env.R2_ACCOUNT_ID = 'x'; process.env.R2_BUCKET = 'y'; process.env.R2_ACCESS_KEY_ID = 'z';
  ok('three of four is still off', !R2.r2Enabled());
  delete process.env.R2_ACCOUNT_ID; delete process.env.R2_BUCKET; delete process.env.R2_ACCESS_KEY_ID;
}

console.log('\nTHE BYTES GO TO R2, AND THE PHONE IS SENT THERE  (_r2.mjs, vid.mjs)');
const { __r2, __setClock } = await import('./r2-fake.mjs');
const { putClip, hasClip, clipUrl, dropClipKeys } = await import('../netlify/functions/_video.mjs');
const { store } = await import('../netlify/functions/_lib.mjs');
const E = await import('../netlify/functions/_errlog.mjs');
__r2.install();
const C = await createArtist({ email: 'r2clipper@example.com', name: 'R2 Clipper' });
const cid = C.artistId, cslug = C.slug;
const r2call = (qs, body, raw) => clipupFn(new Request(`https://x/api/clipup?a=${cslug}&${qs}`, {
  method: 'POST',
  headers: { 'content-type': raw ? 'application/octet-stream' : 'application/json' },
  body: raw ? body : JSON.stringify(body),
}));
async function uploadInPieces(buf, fan) {
  const b = await jget(await r2call('begin=1', { fan, size: buf.length, type: 'video/mp4' }));
  for (let i = 0; i < b.parts; i++) {
    await r2call(`clip=${b.clip}&i=${i}`, buf.subarray(i * CHUNK_BYTES, Math.min(buf.length, (i + 1) * CHUNK_BYTES)), true);
  }
  return { clip: b.clip, done: await jget(await r2call(`clip=${b.clip}&end=1`, { poster: JPEG })) };
}
let r2clip = '';
{
  ok('with the four variables set, R2 is on', R2.r2Enabled());
  const BIG = fakeMp4(11, CHUNK_BYTES + 5000);
  const { clip, done } = await uploadInPieces(BIG, 'fanr2000001');
  r2clip = clip;
  ok('the chunked upload still completes', done.ok === true && done.clip === clip, done);
  const o = __r2.objects.get(`vid_${cid}_${clip}`);
  ok('THE BYTES LANDED ON R2, under the same key Blobs would have used', !!o && o.bytes.equals(BIG),
    o ? { got: o.bytes.length, want: BIG.length } : 'nothing on R2');
  eq2('typed as video', o && o.type, 'video/mp4');
  ok('and NOT in Blobs', !(await store().get(`vid_${cid}_${clip}`, { type: 'arrayBuffer' })));
  ok('the PUT was signed with the content hash, not UNSIGNED-PAYLOAD',
    __r2.calls.some((c) => c.method === 'PUT' && c.key === `vid_${cid}_${clip}` && c.status === 200), __r2.calls);
  ok('the poster still lands in Blobs as a normal photo slot', !!(await getImage(cid, clip)));
  ok('and the pending list still knows about it', !!(await readPending(cid)).by[clip]);
  ok('hasClip answers from a HEAD', await hasClip(cid, clip)
    && __r2.calls.some((c) => c.method === 'HEAD' && c.key === `vid_${cid}_${clip}` && c.status === 200));
  ok('and getClip reads the bytes back from R2', (await getClip(cid, clip)).bytes.equals(BIG));

  const p = await jget(await commFn(post(`https://x/api/community?a=${cslug}`,
    { action: 'post', fan: 'fanr2000001', text: 'from the bar', clip })));
  ok('a post can name a clip that lives on R2', !!p.id, p);
  const ghost = await jget(await commFn(post(`https://x/api/community?a=${cslug}`,
    { action: 'post', fan: 'fanr2000002', text: 'hi', clip: 'k0000000000' })));
  ok('and still cannot name one that exists nowhere', ghost.ok === false && /didn.t finish/.test(ghost.error || ''), ghost);
}

console.log('\n/api/vid IS A SIGNED LINK NOW');
let link = '';
{
  const r = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${r2clip}`));
  eq2('a clip on R2 answers a 302', r.status, 302);
  link = r.headers.get('location') || '';
  ok('to the bucket’s own S3 endpoint', link.startsWith(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/vid_${cid}_${r2clip}?`), link.split('?')[0]);
  ok('carrying a signature, not a public URL', /X-Amz-Signature=[0-9a-f]{64}/.test(link));
  eq2(`good for LINK_SECS (${R2.LINK_SECS}s)`, new URL(link).searchParams.get('X-Amz-Expires'), String(R2.LINK_SECS));
  eq2('the redirect is cached for an hour, not a year', r.headers.get('cache-control'), `public, max-age=${R2.CACHE_SECS}`);
  ok('at the edge too, and never immutable', /durable/.test(r.headers.get('netlify-cdn-cache-control') || '')
    && !/immutable/.test(r.headers.get('netlify-cdn-cache-control') || ''), r.headers.get('netlify-cdn-cache-control'));
  ok('the link outlives the cache by at least an hour, however the clock falls',
    R2.LINK_SECS - R2.ROUND_MS / 1000 >= R2.CACHE_SECS + 3600, { LINK_SECS: R2.LINK_SECS, CACHE_SECS: R2.CACHE_SECS, ROUND_MS: R2.ROUND_MS });
  const again = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${r2clip}`));
  eq2('two requests in the same hour get the SAME link (signed from the top of the hour)', again.headers.get('location'), link);
  const bySlug = await vidFn(new Request(`https://x/api/vid?a=${cslug}&c=${r2clip}`));
  eq2('the slug works as well as the id', bySlug.status, 302);

  /* What the phone does next. Safari asks the redirected URL for bytes=0-1 and
     refuses to play if it gets a 200 — so the store on the far end of the link
     has to answer a 206, and here that store is the fake, checking the signature. */
  const probe = await fetch(link, { headers: { range: 'bytes=0-1' } });
  eq2('THE TRAP, ON THE OTHER SIDE OF THE REDIRECT: bytes=0-1 is a 206', probe.status, 206);
  const total = __r2.objects.get(`vid_${cid}_${r2clip}`).bytes.length;
  eq2('with a content-range naming the real size', probe.headers.get('content-range'), `bytes 0-1/${total}`);
  const whole = await fetch(link);
  ok('and the whole clip comes back byte for byte', whole.status === 200
    && Buffer.from(await whole.arrayBuffer()).equals(__r2.objects.get(`vid_${cid}_${r2clip}`).bytes));
  eq2('as video/mp4', whole.headers.get('content-type'), 'video/mp4');

  const forged = link.replace(/X-Amz-Signature=[0-9a-f]{4}/, 'X-Amz-Signature=0000');
  eq2('a link with one nibble changed is refused', (await fetch(forged)).status, 403);
  const other = link.replace(`vid_${cid}_${r2clip}`, `vid_${cid}_k0000000000`);
  eq2('and a link re-pointed at another object is refused, not just missing', (await fetch(other)).status, 403);

  const stamp = new URL(link).searchParams.get('X-Amz-Date');
  const top = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(9, 11));
  __setClock(() => top + (R2.LINK_SECS - 1) * 1000);
  eq2('the link is still good a second before it expires', (await fetch(link)).status, 200);
  __setClock(() => top + (R2.LINK_SECS + 1) * 1000);
  eq2('and dead a second after', (await fetch(link)).status, 403);
  __setClock(null);
}

console.log('\nA CLIP FROM BEFORE R2 STILL PLAYS FROM BLOBS');
let oldClip = '';
{
  /* Uploaded with R2 off — exactly what every clip on the site was before today. */
  __r2.uninstall();
  const OLD = fakeMp4(7, 3000);
  const { clip, done } = await uploadInPieces(OLD, 'fanr2000003');
  oldClip = clip;
  ok('with R2 off the upload lands in Blobs, as it always did', done.ok && !!(await store().get(`vid_${cid}_${clip}`, { type: 'arrayBuffer' })));
  __r2.install();
  __r2.calls.length = 0;
  const r = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${clip}`), );
  eq2('with R2 back on, /api/vid serves it from Blobs — a 200 with the bytes', r.status, 200);
  ok('after asking R2 first', __r2.calls.some((c) => c.method === 'HEAD' && c.key === `vid_${cid}_${clip}` && c.status === 404), __r2.calls);
  ok('cached for a year as before', /immutable/.test(r.headers.get('cache-control') || ''));
  const probe = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${clip}`, { headers: { range: 'bytes=0-1' } }));
  eq2('and bytes=0-1 is still a 206', probe.status, 206);
  ok('a post can name it', !!(await jget(await commFn(post(`https://x/api/community?a=${cslug}`,
    { action: 'post', fan: 'fanr2000003', text: 'old clip', clip })))).id);
}

console.log('\nEVERY R2 FAILURE DEGRADES — THE ROOM CAN STILL VOTE');
{
  __r2.fail(true);                                   // R2 answers 503 to everything
  const B = fakeMp4(5, 2500);
  const { clip, done } = await uploadInPieces(B, 'fanr2000004');
  ok('an upload R2 refuses lands in Blobs and the person never knows', done.ok === true
    && !!(await store().get(`vid_${cid}_${clip}`, { type: 'arrayBuffer' })) && !__r2.objects.has(`vid_${cid}_${clip}`), done);
  const r = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${clip}`));
  eq2('and plays from Blobs while R2 is refusing', r.status, 200);
  const rOld = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${oldClip}`));
  eq2('so does a pre-R2 clip', rOld.status, 200);
  const rR2 = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${r2clip}`));
  eq2('a clip that only exists on R2 is a 404 for now — not a 500, not a hang', rR2.status, 404);
  ok('a post naming it is refused rather than hung on', (await jget(await commFn(post(`https://x/api/community?a=${cslug}`,
    { action: 'post', fan: 'fanr2000005', text: 'x', clip: r2clip })))).ok === false);
  __r2.fail(false);

  __r2.down(true);                                   // the network is gone
  const rDown = await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${oldClip}`));
  eq2('with R2 unreachable a Blobs clip still serves', rDown.status, 200);
  const { done: d2 } = await uploadInPieces(fakeMp4(4, 2000), 'fanr2000006');
  ok('and an upload still completes, into Blobs', d2.ok === true, d2);
  __r2.down(false);

  const rows = await E.recentErrs(2);
  ok('the failures are on the record (0fb)', rows.some((x) => /^r2\./.test(x.where)), rows.map((x) => x.where));
  const dump = JSON.stringify(rows);
  ok('and the record carries no key, no secret and no signed link',
    !dump.includes(process.env.R2_SECRET_ACCESS_KEY) && !dump.includes(process.env.R2_ACCESS_KEY_ID) && !dump.includes('X-Amz-Signature'));

  /* A wrong secret is the failure that would actually happen on a first deploy.
     The fake checks signatures, so this is a real refusal, not a stubbed one. */
  const good = process.env.R2_SECRET_ACCESS_KEY;
  process.env.R2_SECRET_ACCESS_KEY = 'not-the-secret';
  __r2.calls.length = 0;
  const { clip: c3, done: d3 } = await uploadInPieces(fakeMp4(3, 1500), 'fanr2000007');
  ok('a wrong secret is refused by the bucket (a real 403, from a real signature check)',
    __r2.calls.some((c) => c.method === 'PUT' && c.status === 403), __r2.calls);
  ok('and the clip lands in Blobs anyway', d3.ok === true && !!(await store().get(`vid_${cid}_${c3}`, { type: 'arrayBuffer' })));
  process.env.R2_SECRET_ACCESS_KEY = good;
}

console.log('\nTAKING IT DOWN TAKES IT OFF R2');
{
  const B = fakeMp4(6, 2200);
  const { clip } = await uploadInPieces(B, 'fanr2000008');
  const made = await jget(await commFn(post(`https://x/api/community?a=${cslug}`,
    { action: 'post', fan: 'fanr2000008', text: 'hide me', clip })));
  ok('on R2 while the post is up', __r2.objects.has(`vid_${cid}_${clip}`));
  await moderate(cid, { action: 'postHide', id: made.id, on: true });
  ok('hiding the post deletes the bytes from R2 (0dy1)', !__r2.objects.has(`vid_${cid}_${clip}`));
  eq2('and /api/vid says so', (await vidFn(new Request(`https://x/api/vid?a=${cid}&c=${clip}`))).status, 404);

  const { clip: orphan } = await uploadInPieces(fakeMp4(4, 2000), 'fanr2000009');
  ok('an unposted clip sits on R2', __r2.objects.has(`vid_${cid}_${orphan}`));
  ok('and the two-hour sweep takes it off R2', (await sweepPending(cid, Date.now() + PENDING_TTL + 1000)) >= 1
    && !__r2.objects.has(`vid_${cid}_${orphan}`));
  /* The same trap as the Blobs section: a POSTED clip left on the pending list
     (clearPending is best-effort) must survive the sweep because the feed names
     it — on R2 as much as in Blobs. */
  await notePending(cid, r2clip);
  ok('a POSTED clip on the pending list is NOT taken off R2 by the sweep',
    (await sweepPending(cid, Date.now() + PENDING_TTL + 1000)) === 0 && __r2.objects.has(`vid_${cid}_${r2clip}`));
  ok('but leaves the posted one alone', __r2.objects.has(`vid_${cid}_${r2clip}`));
  ok('and none of the deletes so far had to be logged as a failure',
    !(await E.recentErrs(2)).some((x) => x.where === 'r2.delete'), (await E.recentErrs(2)).filter((x) => x.where === 'r2.delete').map((x) => x.msg));

  /* A DELETE R2 refuses must not become 75MB nothing can ever find. */
  const { clip: stuck } = await uploadInPieces(fakeMp4(4, 2000), 'fanr2000011');
  const madeStuck = await jget(await commFn(post(`https://x/api/community?a=${cslug}`,
    { action: 'post', fan: 'fanr2000011', text: 'stuck', clip: stuck })));
  __r2.fail(true);
  await moderate(cid, { action: 'postHide', id: madeStuck.id, on: true });
  ok('hiding while R2 refuses leaves the object there (it could not be deleted)…', __r2.objects.has(`vid_${cid}_${stuck}`));
  ok('…and puts the clip BACK on the pending list, so the sweep will try again', !!(await readPending(cid)).by[stuck]);
  const stillFailing = await sweepPending(cid, Date.now() + PENDING_TTL + 1000);
  ok('a sweep while R2 still refuses keeps the note rather than clearing it',
    stillFailing === 0 && !!(await readPending(cid)).by[stuck] && __r2.objects.has(`vid_${cid}_${stuck}`));
  ok('and the ring keeps the owner rather than waiting for a new upload',
    !!((await (await import('../netlify/functions/_lib.mjs')).readDoc('vidqueue', null)).data || { by: {} }).by[cid]);
  __r2.fail(false);
  const delRowsBefore = (await E.recentErrs(2)).filter((x) => x.where === 'r2.delete').length;
  ok('once R2 is back, the sweep takes it off R2', (await sweepPending(cid, Date.now() + 2 * PENDING_TTL + 2000)) === 1
    && !__r2.objects.has(`vid_${cid}_${stuck}`) && !(await readPending(cid)).by[stuck]);

  const { deleteArtist } = await import('../netlify/functions/_account.mjs');
  const keys = await keysFor(cid);
  ok('the artist’s key list names the R2 clip', keys.includes(`vid_${cid}_${r2clip}`));
  await deleteArtist(cid);
  ok('LEAVING MYSET TAKES THE BYTES OFF R2', !__r2.objects.has(`vid_${cid}_${r2clip}`), [...__r2.objects.keys()]);
  ok('and dropClipKeys only ever touches vid_ keys', (await dropClipKeys(['posts_x', 'img_x_y'])) === 0);
  /* The first run of this section passed while every delete was throwing inside
     the fake — the object was gone before the throw. So: the deletes must also
     have left NO error behind, or "gone" is an accident. */
  ok('and none of those deletes had to be logged as a failure',
    (await E.recentErrs(2)).filter((x) => x.where === 'r2.delete').length === delRowsBefore,
    (await E.recentErrs(2)).filter((x) => x.where === 'r2.delete').map((x) => x.msg));
}

/* A venue's clips live under `v_<id>` and are deleted by a different function
   with its own key list; the R2 half has to be there too or a venue that left
   would leave its clips behind for ever. */
console.log('\nA VENUE THAT LEAVES TAKES ITS CLIPS OFF R2 TOO');
{
  const { createVenue } = await import('../netlify/functions/_venues.mjs');
  const { deleteVenue } = await import('../netlify/functions/_venueaccount.mjs');
  const V = await createVenue({ email: 'r2bar@example.com', name: 'R2 Bar' });
  const vslug = V.slug, vo = `v_${V.venueId}`;
  const vcall = (qs, body, raw) => clipupFn(new Request(`https://x/api/clipup?v=${vslug}&${qs}`, {
    method: 'POST', headers: { 'content-type': raw ? 'application/octet-stream' : 'application/json' },
    body: raw ? body : JSON.stringify(body) }));
  const B = fakeMp4(5, 2100);
  const b = await jget(await vcall('begin=1', { fan: 'fanr2000010', size: B.length, type: 'video/mp4' }));
  for (let i = 0; i < b.parts; i++) await vcall(`clip=${b.clip}&i=${i}`, B.subarray(i * CHUNK_BYTES, Math.min(B.length, (i + 1) * CHUNK_BYTES)), true);
  const done = await jget(await vcall(`clip=${b.clip}&end=1`, {}));
  ok('a venue clip lands on R2 under v_<id>', done.ok === true && __r2.objects.has(`vid_${vo}_${b.clip}`), done);
  eq2('and /api/vid sends the phone there', (await vidFn(new Request(`https://x/api/vid?a=${vo}&c=${b.clip}`))).status, 302);
  await deleteVenue(V.venueId);
  ok('deleting the venue takes it off R2', !__r2.objects.has(`vid_${vo}_${b.clip}`));
}
__r2.uninstall();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
