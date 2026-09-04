import { bad, cleanArtistId } from './_lib.mjs';
import { getClip, CLIP_ID } from './_video.mjs';
import { artistBySlug } from './_auth.mjs';

/* Public. Serves a clip somebody posted on a community page.

   The clip id is minted once and never reused, so the URL is permanently safe to
   cache — a year, in the browser AND durably at Netlify's edge, which is what
   keeps a clip from being read out of Blobs once per viewer.

   RANGE. iOS Safari asks for `bytes=0-1` first and refuses to play if it gets a
   200 back. The bytes are already in memory, so a range is a slice; without this
   the feature simply does not work on most of the phones in a bar. */
export default async (req) => {
  const q = new URL(req.url).searchParams;
  const clip = q.get('c') || '';
  if (!CLIP_ID.test(clip)) return bad('unknown clip', 404);

  const raw = q.get('a') || '';
  // a venue's clips live under `v_<id>`; artist ids are [a-z0-9-] so an
  // underscore can only ever mean a venue (the same rule as /api/img)
  const vm = /^v_([a-z0-9-]{1,40})$/.exec(raw);
  const owner = vm ? raw : cleanArtistId(raw);
  let got = await getClip(owner, clip);
  if (!got && !vm) {
    const aid = await artistBySlug(raw);
    if (aid) got = await getClip(aid, clip);
  }
  if (!got) return bad('no clip', 404);
  return serve(got, req.headers.get('range') || '');
};

const HEAD = (type, len) => ({
  'content-type': type,
  'accept-ranges': 'bytes',
  'cache-control': 'public, max-age=31536000, immutable',
  'netlify-cdn-cache-control': 'public, durable, max-age=31536000, immutable',
  'access-control-allow-origin': '*',
  'content-length': String(len),
});

function serve(got, range) {
  const n = got.bytes.length;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
  if (!m || (m[1] === '' && m[2] === '')) {
    return new Response(got.bytes, { status: 200, headers: HEAD(got.type, n) });
  }
  /* A suffix range (`bytes=-500`) means the LAST 500 bytes, not the first. Both
     ends are clamped, and an unsatisfiable range answers 416 with the real size
     rather than an empty 206 the player would sit on for ever. */
  let start, end;
  if (m[1] === '') { start = Math.max(0, n - Number(m[2])); end = n - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? n - 1 : Math.min(Number(m[2]), n - 1); }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= n) {
    return new Response('', { status: 416, headers: { 'content-range': `bytes */${n}` } });
  }
  const slice = got.bytes.subarray(start, end + 1);
  return new Response(slice, {
    status: 206,
    headers: { ...HEAD(got.type, slice.length), 'content-range': `bytes ${start}-${end}/${n}` },
  });
}
