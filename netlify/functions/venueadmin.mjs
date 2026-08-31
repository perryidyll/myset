import { json, bad } from './_lib.mjs';
import { requireVenue, mutateVenueProfile, getVenueProfile, shapeVenue, venueById,
         mutateVenues, imgOwner, AMENITIES, DAYS, VMAX_OFFERS, VMAX_MENU } from './_venues.mjs';
import { decodeDataUrl, putImage, dropImage, SLOTS } from './_img.mjs';

/* Everything a venue can change about its own page. A venue session can only
   ever reach its own records — the id comes from the token, never the body. */

export default async (req) => {
  const me = await requireVenue(req);
  if (!me) return bad('unauthorized', 401);
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const vid = me.vid;
  const action = body.action;

  const send = async () =>
    json({ ok: true, venue: shapeVenue(await getVenueProfile(vid), await venueById(vid)),
           amenities: AMENITIES.map(([key, label]) => ({ key, label })) });

  if (action === 'get') return send();

  if (action === 'set') {
    await mutateVenueProfile(vid, (p) => {
      for (const k of ['name', 'tagline', 'about', 'city', 'country', 'address',
                       'mapUrl', 'phone', 'whatsapp'])
        if (typeof body[k] === 'string') p[k] = body[k];
      if (body.links && typeof body.links === 'object') p.links = { ...p.links, ...body.links };
      if (Array.isArray(body.amenities)) p.amenities = body.amenities;
      return true;
    });
    // the registry keeps its own copy of the name and place, because the public
    // directory and the city match read it without opening the profile
    if (typeof body.name === 'string' || typeof body.city === 'string') {
      const p = await getVenueProfile(vid);
      await mutateVenues((r) => {
        const v = r.byId[vid];
        if (!v) return false;
        if (p.name) v.name = p.name;
        v.city = p.city; v.country = p.country;
        return true;
      });
    }
    return send();
  }

  if (action === 'amenity') {
    const key = String(body.key || '');
    if (!AMENITIES.some(([k]) => k === key)) return bad('unknown amenity');
    await mutateVenueProfile(vid, (p) => {
      const at = p.amenities.indexOf(key);
      if (at >= 0) p.amenities.splice(at, 1); else p.amenities.push(key);
      return true;
    });
    return send();
  }

  if (action === 'hours') {
    const day = String(body.day || '');
    if (!DAYS.includes(day)) return bad('unknown day');
    await mutateVenueProfile(vid, (p) => {
      const h = p.hours[day];
      if (body.closed !== undefined) h.closed = !!body.closed;
      if (typeof body.open === 'string') h.open = body.open;
      if (typeof body.close === 'string') h.close = body.close;
      return true;
    });
    return send();
  }

  if (action === 'menuSet') {
    await mutateVenueProfile(vid, (p) => {
      if (typeof body.url === 'string') p.menu.url = body.url;
      if (typeof body.note === 'string') p.menu.note = body.note;
      return true;
    });
    return send();
  }
  if (action === 'menuAdd') {
    let full = false;
    await mutateVenueProfile(vid, (p) => {
      if (p.menu.items.length >= VMAX_MENU) { full = true; return false; }
      p.menu.items.push({ section: body.section || '', name: body.name || '',
                          price: body.price || '', note: body.note || '' });
      return true;
    });
    if (full) return bad(`That's ${VMAX_MENU} highlights — link the full menu instead.`);
    const p = await getVenueProfile(vid);
    if (!p.menu.items.length) return bad('Give it a name at least');
    return send();
  }
  if (action === 'menuRemove') {
    const i = parseInt(body.i, 10);
    await mutateVenueProfile(vid, (p) => {
      if (!(i >= 0 && i < p.menu.items.length)) return false;
      p.menu.items.splice(i, 1);
      return true;
    });
    return send();
  }

  if (action === 'offerSave') {
    const id = String(body.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 12)
               || 'o' + Math.random().toString(36).slice(2, 8);       // outside the CAS
    let full = false;
    await mutateVenueProfile(vid, (p) => {
      const row = { id, title: body.title || '', detail: body.detail || '', when: body.when || '' };
      const at = p.offers.findIndex((x) => x.id === id);
      if (at >= 0) p.offers[at] = row;
      else if (p.offers.length >= VMAX_OFFERS) { full = true; return false; }
      else p.offers.push(row);
      return true;
    });
    if (full) return bad(`${VMAX_OFFERS} offers is plenty — edit one of those.`);
    const p = await getVenueProfile(vid);
    if (!p.offers.some((x) => x.id === id)) return bad('An offer needs a title');
    return send();
  }
  if (action === 'offerRemove') {
    await mutateVenueProfile(vid, (p) => {
      p.offers = p.offers.filter((x) => x.id !== String(body.id || ''));
      return true;
    });
    return send();
  }

  if (action === 'photoUpload') {
    const slot = String(body.slot || '');
    if (!SLOTS.has(slot)) return bad('unknown photo slot');
    const dec = decodeDataUrl(body.data);
    if (dec.error) return bad(dec.error);
    const url = await putImage(imgOwner(vid), slot, dec.bytes, dec.type);
    await mutateVenueProfile(vid, (p) => {
      if (slot === 'cover') p.photo = url;
      else if (slot === 'avatar') return false;              // a venue has no portrait
      else {
        const i = Number(slot.slice(1));
        p.photos = Array.isArray(p.photos) ? p.photos : [];
        while (p.photos.length <= i) p.photos.push('');
        p.photos[i] = url;
      }
      return true;
    });
    return send();
  }
  if (action === 'photoClear') {
    const slot = String(body.slot || '');
    if (!SLOTS.has(slot)) return bad('unknown photo slot');
    await dropImage(imgOwner(vid), slot);
    await mutateVenueProfile(vid, (p) => {
      if (slot === 'cover') p.photo = '';
      else {
        const i = Number(slot.slice(1));
        if (Array.isArray(p.photos) && p.photos[i]) p.photos[i] = '';
      }
      return true;
    });
    return send();
  }

  return bad('unknown action');
};
