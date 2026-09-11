import { bad, cleanArtistId } from './_lib.mjs';
import { getClip, clipUrl, CLIP_ID } from './_video.mjs';
import { CACHE_SECS } from './_r2.mjs';
import { artistBySlug } from './_auth.mjs';

/* Public. Serves a clip somebody posted on a community page.

   TWO ANSWERS, AND THE FIRST ONE IS A LINK. A clip's bytes live on Cloudflare R2
   when it is on (_r2.mjs — nothing to send them out, which is the whole point);
   this endpoint answers a 302 to a signed URL good for a few hours, and the phone
   fetches the bytes from R2 directly. Netlify never carries the video. The
   redirect is cached for an hour, at the edge and in the browser, and the link
   outlives that cache by a margin (LINK_SECS in _r2.mjs) — a cached redirect
   must never hand out a link that has already died.

   Clips from before R2, or a clip R2 could not be asked about, are served from
   Blobs exactly as they always were: the clip id is minted once and never reused,
   so the bytes are permanently safe to cache — a year, in the browser AND durably
   at Netlify's edge, which is what keeps a clip from being read out of Blobs once
   per viewer.

   RANGE. iOS Safari asks for `bytes=0-1` first and refuses to play if it gets a
   200 back. On the R2 path the browser is expected to carry its Range through the
   redirect, and R2 answers the 206 — the suite proves the far side answers a 206
   to a ranged GET on the signed link; a real phone after the deploy is what proves
   the browser half (session 2026-09-11-clips-to-r2.md). On the Blobs path the
   bytes are already in memory, so a range is a slice; without this the feature
   simply does not work on most of the phones in a bar. */
export default async (req) => {
  const q = new URL(req.url).searchParams;
  const clip = q.get('c') || '';
  if (!CLIP_ID.test(clip)) return bad('unknown clip', 404);

  const raw = q.get('a') || '';
  // a venue's clips live under `v_<id>`; artist ids are [a-z0-9-] so an
  // underscore can only ever mean a venue (the same rule as /api/img)
  const vm = /^v_([a-z0-9-]{1,40})$/.exec(raw);
  const owner = vm ? raw : cleanArtistId(raw);
  /* R2 first, then Blobs; the id as given first, then — only on a miss, because
     it is a read of the whole artist registry — the same word as a slug. The
     pages always build the URL with the id, so the slug path is the rare one. */
  const find = async (o) => {
    const url = await clipUrl(o, clip);
    if (url) return redirect(url);
    const got = await getClip(o, clip, { r2: false });
    return got ? serve(got, req.headers.get('range') || '') : null;
  };
  let r = await find(owner);
  if (!r && !vm) {
    const aid = await artistBySlug(raw);
    if (aid && aid !== owner) r = await find(aid);
  }
  return r || bad('no clip', 404);
};

/* The redirect is the cacheable thing now; the bytes behind it are R2's. A
   `Location` that carries a signature is a credential for one object for a few
   hours — cache it, never log it. */
const redirect = (url) => new Response('', {
  status: 302,
  headers: {
    location: url,
    'cache-control': `public, max-age=${CACHE_SECS}`,
    'netlify-cdn-cache-control': `public, durable, max-age=${CACHE_SECS}`,
    'access-control-allow-origin': '*',
  },
});

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
