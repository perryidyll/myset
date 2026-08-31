import { bad, cleanArtistId } from './_lib.mjs';
import { getImage, SLOTS } from './_img.mjs';
import { artistBySlug } from './_auth.mjs';

/* Public. Serves an artist's uploaded photo. The URL carries a ?v= stamp that
   changes on every upload, so it can be cached hard and still update instantly. */
export default async (req) => {
  const q = new URL(req.url).searchParams;
  const slot = q.get('s') || '';
  if (!SLOTS.has(slot)) return bad('unknown photo', 404);

  const raw = q.get('a') || '';
  // the id is used directly when it matches, otherwise it is treated as a slug
  const aid = cleanArtistId(raw);
  const resolved = (await getImage(aid, slot)) ? aid : (await artistBySlug(raw));
  if (!resolved) return bad('unknown artist', 404);

  const img = await getImage(resolved, slot);
  if (!img) return bad('no photo', 404);

  return new Response(img.bytes, {
    status: 200,
    headers: {
      'content-type': img.type,
      'content-length': String(img.bytes.length),
      // the ?v= stamp makes this safe to cache for a year
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*',
    },
  });
};
