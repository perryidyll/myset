/* REPRO: hiding a post leaves its clip + photos publicly served, and the only
   path that actually deletes the bytes is now 402 on the free plan. */
process.env.ADMIN_CODE = 'devlocal';

const commFn = (await import('../netlify/functions/community.mjs')).default;
const vidFn  = (await import('../netlify/functions/vid.mjs')).default;
const imgFn  = (await import('../netlify/functions/img.mjs')).default;
const adminFn = (await import('../netlify/functions/admin.mjs')).default;
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { readPosts } = await import('../netlify/functions/_community.mjs');
const { getClip } = await import('../netlify/functions/_video.mjs');
const { getImage } = await import('../netlify/functions/_img.mjs');
const { planForArtist } = await import('../netlify/functions/_plan.mjs');

const post = (url, body) => new Request(url, { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const jget = async (r) => { try { return await r.json(); } catch { return {}; } };

function fakeMp4(seconds = 8, pad = 800) {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(24, 0); ftyp.write('ftyp', 4); ftyp.write('isom', 8);
  const mvhd = Buffer.alloc(108);
  mvhd.writeUInt32BE(108, 0); mvhd.write('mvhd', 4);
  mvhd.writeUInt8(0, 8); mvhd.writeUInt32BE(1000, 20);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 24);
  const moov = Buffer.concat([Buffer.alloc(8), mvhd]);
  moov.writeUInt32BE(moov.length, 0); moov.write('moov', 4);
  const mdat = Buffer.alloc(pad + 8);
  mdat.writeUInt32BE(mdat.length, 0); mdat.write('mdat', 4);
  return Buffer.concat([ftyp, moov, mdat]);
}
const asData = (b, t = 'video/mp4') => `data:${t};base64,${b.toString('base64')}`;
const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7), Buffer.from([0xff, 0xd9]),
]).toString('base64');

// 1. a FREE artist
const A = await createArtist({ email: 'repro-free@example.com', name: 'Free Artist', slug: 'free-artist' });
const aid = A.artistId, slug = A.slug;
const tok = await signToken('repro-free@example.com', revOf(await readArtists(), aid));
const call = (b) => adminFn(new Request('https://x/api/admin', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify(b) }));
console.log('plan =', (await planForArtist(aid)).plan);

// 2. a fan uploads a clip, then posts it with a photo
const FAN = 'abusivefan01';
const up = await jget(await commFn(post(`https://x/api/community?a=${slug}`,
  { action: 'clip', fan: FAN, data: asData(fakeMp4(8)), poster: JPEG })));
const clipId = up.clip;
const made = await jget(await commFn(post(`https://x/api/community?a=${slug}`,
  { action: 'post', fan: FAN, text: 'abusive clip', clip: clipId, photos: [JPEG] })));
const pid = made.id;
console.log('clip id =', clipId, ' post id =', pid);

// 3. the public feed hands out the URLs
const feed1 = await jget(await commFn(new Request(`https://x/api/community?a=${slug}&fan=someoneelse`)));
const row = (feed1.posts || []).find(p => p.id === pid);
console.log('feed clip src   =', row && row.clip && row.clip.src);
console.log('feed poster     =', row && row.clip && row.clip.poster);
console.log('feed photos     =', row && row.photos);
const photoSlot = `${pid}_0`;

// 4. the artist HIDES it
const hide = await call({ action: 'postHide', id: pid, on: true });
console.log('postHide status =', hide.status);
const feed2 = await jget(await commFn(new Request(`https://x/api/community?a=${slug}&fan=someoneelse`)));
console.log('post visible in public feed after hide?', (feed2.posts||[]).some(p => p.id === pid));

// 5. the bytes are still served, publicly, unauthenticated
const v = await vidFn(new Request(`https://x/api/vid?a=${slug}&c=${clipId}`));
const vb = await v.arrayBuffer();
console.log('GET /api/vid  ->', v.status, vb.byteLength, 'bytes, cache-control:', v.headers.get('cache-control'));
const posterR = await imgFn(new Request(`https://x/api/img?a=${slug}&s=${clipId}`));
console.log('GET /api/img (poster) ->', posterR.status, (await posterR.arrayBuffer()).byteLength, 'bytes');
const photoR = await imgFn(new Request(`https://x/api/img?a=${slug}&s=${photoSlot}`));
console.log('GET /api/img (photo)  ->', photoR.status, (await photoR.arrayBuffer()).byteLength, 'bytes');

// 6. the only path that drops the bytes is refused
const del = await call({ action: 'postDelete', id: pid });
console.log('postDelete status =', del.status, JSON.stringify(await jget(del)).slice(0, 160));
console.log('clip bytes still in store?', !!(await getClip(aid, clipId)));
console.log('photo bytes still in store?', !!(await getImage(aid, photoSlot)));
console.log('post still in list?', (await readPosts(aid)).list.some(p => p.id === pid));
