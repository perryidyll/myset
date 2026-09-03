import { store } from './_lib.mjs';

/* Artist photos, stored as bytes in Blobs and served back by /api/img.

   The browser shrinks a photo before it ever leaves the phone — a modern camera
   file is 3-5MB and none of that detail survives being drawn 130px wide. What
   arrives here is already a few hundred KB, and this refuses anything that
   isn't. */

/* p0..p11 because a venue on Pro gets twelve (VENUE_PLANS in _venues.mjs).

   THIS SET IS A LIST OF VALID NAMES. IT IS NOT A LIMIT ON ANYBODY. It listed
   p0..p2 until venue Pro needed twelve, and while it did it was accidentally
   serving as the artist's photo cap as well — so widening it uncapped an endpoint
   that has always been meant to hold three (INVARIANT 0bz).

   There are TWO caps and they live where the answer is known:
     · how many a record may HOLD — normProfile / normVenue, the storage question
     · who may WRITE the fourth   — admin.mjs (MAX_PHOTOS) and venueadmin.mjs
                                    (the venue's plan), the permission question
   An earlier version of this comment named only the second and called it "the cap
   that matters", which is how the first one got missed. */
export const SLOTS = new Set(['cover', 'avatar',
  ...Array.from({ length: 12 }, (_, i) => 'p' + i)]);
export const MAX_BYTES = 900 * 1024;
const KEY = (aid, slot) => `img_${aid}_${slot}`;

const TYPES = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Accepts a data: URL, returns { bytes, type } or an { error }. */
export function decodeDataUrl(dataUrl) {
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || '').trim());
  if (!m) return { error: 'That has to be a JPEG, PNG or WebP photo.' };
  let bytes;
  try { bytes = Buffer.from(m[2], 'base64'); } catch { return { error: 'Could not read that photo.' }; }
  if (!bytes.length) return { error: 'That photo came through empty.' };
  if (bytes.length > MAX_BYTES) return { error: 'That photo is too big even after shrinking. Try another.' };

  // Trust the bytes, not the label: check the actual file signature.
  const sig = bytes.subarray(0, 12);
  const isJpeg = sig[0] === 0xff && sig[1] === 0xd8;
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
  const isWebp = sig.subarray(0, 4).toString() === 'RIFF' && sig.subarray(8, 12).toString() === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) return { error: 'That file isn’t really an image.' };

  return { bytes, type: isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/webp' };
}

export async function putImage(aid, slot, bytes, type) {
  await store().set(KEY(aid, slot), bytes, { metadata: { type } });
  return `/api/img?a=${encodeURIComponent(aid)}&s=${slot}&v=${Date.now().toString(36)}`;
}

export async function getImage(aid, slot) {
  try {
    const r = await store().getWithMetadata(KEY(aid, slot), { type: 'arrayBuffer', consistency: 'strong' });
    if (!r || !r.data) return null;
    return { bytes: Buffer.from(r.data), type: (r.metadata && r.metadata.type) || 'image/jpeg' };
  } catch { return null; }
}

export async function dropImage(aid, slot) {
  try { await store().delete(KEY(aid, slot)); } catch {}
}
