import { decodeDataUrl, putImage, dropImage } from './_img.mjs';
import { MERCH_ID, MAX_MERCH_IMGS, merchSlots, freeMerchSlot } from './_profile.mjs';

/* AN ITEM'S PICTURES, for both Studios (the founder, 2026-09-14: "at least 5 images
   to swipe through"). One implementation, called by admin.mjs with the artist's
   profile mutator and by venueadmin.mjs with the venue's, so the two cannot drift.

   `owner` is the image owner (`<aid>` or `v_<vid>`), `mutate(fn)` runs fn over the
   profile document inside its CAS. A picture lands in the first free slot of the
   item's five (merchSlots); the record's `imgs` is the swipe order and `img` is
   always imgs[0] (normMerch). */

const slotOf = (url) => { const m = /[?&]s=([a-z0-9_]+)/.exec(String(url || '')); return m ? m[1] : ''; };

/** Add one. Returns { url } or { error, status }. */
export async function addMerchPicture(owner, mutate, item, data) {
  if (!item || !MERCH_ID.test(String(item.id || ''))) return { error: 'unknown item', status: 404 };
  const slot = freeMerchSlot(item);
  if (!slot) return { error: `${MAX_MERCH_IMGS} pictures is the most for one item — remove one first.`, status: 400 };
  const dec = decodeDataUrl(data);
  if (dec.error) return { error: dec.error, status: 400 };
  const url = await putImage(owner, slot, dec.bytes, dec.type);
  let refused = null;
  await mutate((p) => {
    const m = (p.merch || []).find((x) => x && x.id === item.id); if (!m) { refused = 'unknown item'; return false; }
    m.imgs = (Array.isArray(m.imgs) ? m.imgs : (m.img ? [m.img] : [])).filter((u) => slotOf(u) !== slot);
    if (m.imgs.length >= MAX_MERCH_IMGS) { refused = `${MAX_MERCH_IMGS} pictures is the most for one item — remove one first.`; return false; }
    m.imgs.push(url); m.img = m.imgs[0];
    return true;
  });
  if (refused) { await dropImage(owner, slot); return { error: refused, status: /unknown/.test(refused) ? 404 : 400 }; }
  return { url };
}

/** Remove one by its slot (`m000001`, `m000001_2`), or every picture when no slot is named. */
export async function dropMerchPicture(owner, mutate, id, slot) {
  if (!MERCH_ID.test(String(id || ''))) return { error: 'unknown item', status: 404 };
  const slots = slot ? [String(slot)] : merchSlots(id);
  if (!slots.every((k) => merchSlots(id).includes(k))) return { error: 'unknown picture', status: 400 };
  for (const k of slots) await dropImage(owner, k);
  await mutate((p) => {
    const m = (p.merch || []).find((x) => x && x.id === id); if (!m) return false;
    m.imgs = (Array.isArray(m.imgs) ? m.imgs : (m.img ? [m.img] : [])).filter((u) => !slots.includes(slotOf(u)));
    m.img = m.imgs[0] || '';
    return true;
  });
  return { ok: true };
}

/** The item is gone: every slot with it. */
export async function dropMerchPictures(owner, id) {
  if (!MERCH_ID.test(String(id || ''))) return;
  for (const k of merchSlots(id)) await dropImage(owner, k);
}
