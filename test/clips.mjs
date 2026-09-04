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
        notePending } = await import('../netlify/functions/_video.mjs');
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
  ok(`over ${MAX_VIDEO_BYTES / 1024 / 1024}MB is refused, by bytes`,
    /too big/.test(decodeVideoDataUrl(asData(fakeMp4(5, MAX_VIDEO_BYTES + 5000))).error || ''));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
