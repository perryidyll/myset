import { json, bad, publicArtist, cleanFanId, sha } from './_lib.mjs';
import { cleanSlug } from './_auth.mjs';
import { venueBySlug } from './_venues.mjs';
import { readPosts, PER_DEVICE_PER_DAY, DAY } from './_community.mjs';
import { decodeDataUrl, putImage } from './_img.mjs';
import { CHUNK_BYTES, MAX_VIDEO_BYTES, CLIP_ID, newClipId, beginUpload, readUpload,
         readPending, putChunk, joinChunks, dropUpload, checkVideo, putClip,
         notePending } from './_video.mjs';

/* A CLIP, UPLOADED AS IT IS.
 *
 * WHY THIS ENDPOINT EXISTS AT ALL. Clips used to travel as base64 inside the
 * community JSON body, which capped them at 3MB — and 3MB meant every clip had to
 * be shrunk on the phone by re-filming it onto a canvas. A canvas has no sound, so
 * the audio had to be found and mixed back separately, and on Safari that kept
 * failing: three releases running, clips arrived with a perfect picture and no
 * sound. Perry called it, and he was right. Nothing here touches the video.
 *
 * TWO CHANGES MAKE A REAL FILE FIT. The bytes go up RAW rather than base64, which
 * removes 33% before anything else; and they go up in pieces, so no single request
 * comes near Netlify's ~6MB body limit. 25MB of actual video, and the sound is
 * never at risk because nothing re-encodes it.
 *
 * THREE STEPS, THE MIDDLE ONE REPEATING:
 *   POST ?begin=1        {fan, size, type}      -> {clip, parts, chunk}
 *   POST ?clip=..&i=n    <raw bytes>            -> {ok}
 *   POST ?clip=..&end=1  {poster}               -> {clip, seconds, bytes}
 *
 * NOTHING IS VALIDATED PIECE BY PIECE, on purpose: a video's magic bytes and its
 * duration are properties of the whole file, and half an MP4 is not a small MP4.
 * The join happens once, at the end, and the file is checked then or not at all.
 *
 * AND NOTHING CAN BE ORPHANED. The clip id is minted at `begin` and noted as
 * pending before a single byte arrives, so an upload somebody walks away from is
 * already something the existing sweep knows about. Its manifest says how many
 * pieces exist, so every key can be computed — `list()` stays banned (INVARIANT 1).
 */

/** Just the owner, and nothing else. `resolveOwner` in community.mjs reads the
    plan, the profile and the show to build a whole page header; an upload needs
    none of that, and this runs once per piece. */
async function ownerOf(req) {
  const q = new URL(req.url).searchParams;
  if (q.get('v')) {
    const vid = await venueBySlug(cleanSlug(q.get('v')));
    return vid ? `v_${vid}` : null;
  }
  const aid = await publicArtist(req);
  return aid || null;
}

const mb = (n) => (n / 1048576).toFixed(1);

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  const q = new URL(req.url).searchParams;
  const owner = await ownerOf(req);
  if (!owner) return bad('unknown artist', 404);

  /* ---------- begin ---------- */
  if (q.get('begin') === '1') {
    let body = {};
    try { body = await req.json(); } catch { return bad('bad json'); }
    const fan = cleanFanId(body.fan);
    if (!fan) return bad('missing fan');

    const size = Math.floor(Number(body.size) || 0);
    if (!(size > 0)) return bad('missing size');
    /* Refused HERE rather than after the bytes have been sent, so nobody watches a
       progress bar crawl up a phone's uplink for a minute to be told no. */
    if (size > MAX_VIDEO_BYTES)
      return bad(`That clip is ${mb(size)}MB and the limit is ${MAX_VIDEO_BYTES / 1048576}MB. `
               + 'Trim it shorter, or record at a lower quality.', 413);

    /* The same three-a-day this phone gets for posting, applied before the upload
       rather than after it. A clip IS a post about to happen, and finding out at
       the end would mean uploading 25MB for nothing. */
    const posts = await readPosts(owner);
    const now = Date.now();
    const me = sha(String(fan)).slice(0, 10);
    const mine = (posts.recent || []).filter((r) => r && now - r.at < DAY && r.f === me);
    if (mine.length >= PER_DEVICE_PER_DAY)
      return bad('That’s three posts today from this phone — come back tomorrow.', 429);

    /* A CEILING ON WHAT CAN BE IN FLIGHT AT ONCE. Without it, calling `begin` in a
       loop would allocate manifests and chunk space faster than the two-hour sweep
       reclaims it. The pending list is the count, it is already being read by the
       note below, and everything in it clears itself. */
    const pend = await readPending(owner);
    if (Object.keys(pend.by || {}).length >= 40)
      return bad('Too many clips going up at once here — try again in a few minutes.', 429);

    const clip = newClipId();
    const parts = Math.ceil(size / CHUNK_BYTES);
    await beginUpload(owner, clip, { size, parts, type: String(body.type || '').slice(0, 40) });
    await notePending(owner, clip);
    return json({ ok: true, clip, parts, chunk: CHUNK_BYTES });
  }

  const clip = String(q.get('clip') || '');
  if (!CLIP_ID.test(clip)) return bad('bad clip id');
  const up = await readUpload(owner, clip);
  /* An upload nobody finished is swept after two hours, so a phone that went to
     sleep on the tube comes back to a clear instruction rather than a silent
     failure halfway through sending. */
  if (!up || !(up.parts > 0)) return bad('That upload timed out — pick the clip again.', 409);

  /* ---------- one piece ---------- */
  if (q.get('i') !== null) {
    const i = Math.floor(Number(q.get('i')));
    if (!(i >= 0 && i < up.parts)) return bad('bad piece');
    let buf;
    try { buf = Buffer.from(await req.arrayBuffer()); } catch { return bad('could not read that piece'); }
    if (!buf.length) return bad('that piece came through empty');
    /* A little slack over the agreed size, and no more: the manifest said how big
       the pieces are, so a piece that disagrees is not one of ours. */
    if (buf.length > CHUNK_BYTES + 1024) return bad('that piece is too big', 413);
    await putChunk(owner, clip, i, buf);
    return json({ ok: true, i });
  }

  /* ---------- end ---------- */
  if (q.get('end') === '1') {
    let body = {};
    try { body = await req.json(); } catch { body = {}; }

    const bytes = await joinChunks(owner, clip, up.parts);
    /* A piece that never arrived is recoverable — the pieces that DID arrive are
       still there, so the phone can send the missing one and try again. Nothing is
       deleted on this path. */
    if (!bytes) return bad('Some of that clip didn’t arrive — try again.', 409);

    const v = checkVideo(bytes);
    if (v.error) { await dropUpload(owner, clip, up.parts); return bad(v.error, 400); }

    await putClip(owner, clip, v.bytes, v.type);
    /* The poster frame, grabbed on the phone. Optional: a clip with no poster still
       plays, it just shows a dark box until somebody taps it. */
    if (body.poster) {
      const pd = decodeDataUrl(body.poster);
      if (!pd.error) await putImage(owner, clip, pd.bytes, pd.type);
    }
    /* The pieces have served their purpose. The clip itself stays on the pending
       list until a post claims it — that is what stops an uploaded-but-never-posted
       clip living for ever. */
    await dropUpload(owner, clip, up.parts);
    return json({ ok: true, clip, seconds: v.seconds, bytes: v.bytes.length });
  }

  return bad('bad request');
};
