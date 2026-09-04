import { bad, cleanArtistId } from './_lib.mjs';
import { getImage, isSlot } from './_img.mjs';
import { artistBySlug } from './_auth.mjs';

/* Public. Serves an artist's uploaded photo. The URL carries a ?v= stamp that
   changes on every upload, so it can be cached hard and still update instantly. */
export default async (req) => {
  const q = new URL(req.url).searchParams;
  const slot = q.get('s') || '';
  if (!isSlot(slot)) return bad('unknown photo', 404);

  const raw = q.get('a') || '';
  /* A venue's photos live under `v_<id>`. Artist ids and slugs are stripped to
     [a-z0-9-], so an underscore can only ever mean a venue — nothing can point
     this at an artist's image by dressing itself up as a venue, or vice versa. */
  const vm = /^v_([a-z0-9-]{1,40})$/.exec(raw);
  if (vm) {
    const img = await getImage(raw, slot);
    if (!img) return bad('no photo', 404);
    return photo(img);
  }
  // the id is used directly when it matches, otherwise it is treated as a slug
  const aid = cleanArtistId(raw);
  const resolved = (await getImage(aid, slot)) ? aid : (await artistBySlug(raw));
  if (!resolved) return bad('unknown artist', 404);

  const img = await getImage(resolved, slot);
  if (!img) return bad('no photo', 404);
  return photo(img);
};

const photo = (img) => new Response(img.bytes, {
  status: 200,
  headers: {
    'content-type': img.type,
    'content-length': String(img.bytes.length),
    // the ?v= stamp makes this safe to cache for a year — in the browser AND at
    // Netlify's edge (durable), so a photo is read out of Blobs by a function
    // once per version, not once per viewer. Netlify-Vary is ignored through the
    // /api/* rewrite (9d6), which is fine: the URL alone is the key.
    'cache-control': 'public, max-age=31536000, immutable',
    'netlify-cdn-cache-control': 'public, durable, max-age=31536000, immutable',
    'access-control-allow-origin': '*',
  },
});
