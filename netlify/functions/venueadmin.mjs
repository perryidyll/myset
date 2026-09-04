import { json, bad } from './_lib.mjs';
import { requireVenue, mutateVenueProfile, getVenueProfile, shapeVenue, venueById,
         mutateVenues, imgOwner, AMENITIES, DAYS, VMAX_OFFERS, VMAX_MENU,
         venueLimits, VENUE_PLANS, VENUE_NOT_BUILT, VMAX_MERCH } from './_venues.mjs';
import { normMerch } from './_profile.mjs';
import { readPosts, shapeForOwner, moderate } from './_community.mjs';
import { decodeDataUrl, putImage, dropImage, SLOTS } from './_img.mjs';
import { readEvents, mutateEvents, normEvent, reindexCities, occurrencesFor,
         endTimeOf, MAX_EVENTS } from './_events.mjs';
import { readPitches, shapeForVenue, setPitchStatus } from './_pitch.mjs';
import { venueStats } from './_vstats.mjs';
import { checkWebsite, recheck, ownerEmail, readVouches, MIN_VOUCHES } from './_verify.mjs';
import { localDate, addDays } from './_time.mjs';

/** A venue's own events live in the same store as artists' gigs, under an owner
 *  id an artist can never hold — the underscore is stripped out of artist ids. */
const evOwner = (vid) => `v_${vid}`;

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

  /* The vouch count travels with every response, so the checklist can show the
     real number the moment the tab opens — it used to read 0 until somebody
     happened to run the website check. */
  const send = async () => {
    const [prof, reg, vouches] = await Promise.all([
      getVenueProfile(vid), venueById(vid), readVouches(vid)]);
    const names = Object.values(vouches.by || {}).map((x) => x.name).filter(Boolean);
    return json({ ok: true, venue: shapeVenue(prof, reg),
                  vouches: { count: names.length, need: MIN_VOUCHES, names: names.slice(0, 12) },
                  amenities: AMENITIES.map(([key, label]) => ({ key, label })) });
  };

  if (action === 'get') return send();

  /* ---------- the venue's own events ----------
     Same recurrence engine as artists' gigs: one record for "every Tuesday", no
     job to run, and it lands in the city feed and on the public page by itself.
     Place is taken from the profile, never from the request — the event is AT
     this venue by definition. */
  if (action === 'eventList') {
    const events = await readEvents(evOwner(vid));
    const p = await getVenueProfile(vid);
    const tz = ((events.list || []).find((x) => x.tz) || {}).tz || 'UTC';
    const from = localDate(Date.now(), tz);
    return json({ ok: true, events: events.list,
      occurrences: occurrencesFor(events, addDays(from, -1), addDays(from, 90))
        .map((o) => ({ ...o, endTime: o.endTime })),
      place: { city: p.city, country: p.country, venue: p.name } });
  }

  if (action === 'eventSave') {
    const p = await getVenueProfile(vid);
    const reg = await venueById(vid);
    const venueName = p.name || (reg && reg.name) || '';
    const city = p.city || (reg && reg.city) || '';
    const country = p.country || (reg && reg.country) || '';
    if (!city || !country)
      return bad('Add your city and country on the Page tab first — that is how events find their way into the local feed.');

    const incoming = body.event || {};
    const id = String(incoming.id || '').slice(0, 24) ||
               'e' + Math.random().toString(36).slice(2, 10);        // outside the CAS
    const ev = normEvent({ ...incoming, id, venue: venueName, city, country });
    if (!ev.title) return bad('What is it called?');
    if (!ev.date) return bad('Pick a date');

    let full = false;
    await mutateEvents(evOwner(vid), (d) => {
      const at = d.list.findIndex((x) => x.id === id);
      if (at >= 0) d.list[at] = { ...ev, skip: d.list[at].skip || [], hid: d.list[at].hid || [],
                                  createdAt: d.list[at].createdAt };
      else if (d.list.length >= MAX_EVENTS) { full = true; return false; }
      else d.list.push(ev);
      return true;
    });
    if (full) return bad('That is as many events as one calendar can hold');
    const events = await readEvents(evOwner(vid));
    await reindexCities(evOwner(vid), events);
    return json({ ok: true, id, events: events.list });
  }

  if (action === 'eventDelete') {
    await mutateEvents(evOwner(vid), (d) => {
      d.list = d.list.filter((x) => x.id !== String(body.id || ''));
      return true;
    });
    const events = await readEvents(evOwner(vid));
    await reindexCities(evOwner(vid), events);
    return json({ ok: true, events: events.list });
  }

  if (action === 'eventSkip') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : null;
    if (!date) return bad('bad date');
    await mutateEvents(evOwner(vid), (d) => {
      const ev = d.list.find((x) => x.id === String(body.id || ''));
      if (!ev) return false;
      ev.skip = Array.isArray(ev.skip) ? ev.skip : [];
      const at = ev.skip.indexOf(date);
      if (body.on === false) { if (at >= 0) ev.skip.splice(at, 1); }
      else if (at < 0) ev.skip.push(date);
      return true;
    });
    const events = await readEvents(evOwner(vid));
    return json({ ok: true, events: events.list });
  }

  /* ---------- who wants to play here ---------- */
  if (action === 'pitchList')
    return json({ ok: true, pitches: await shapeForVenue(await readPitches(vid)) });

  if (action === 'pitchSet') {
    const row = await setPitchStatus(vid, String(body.id || ''), String(body.status || ''));
    if (!row) return bad('Could not update that');
    return json({ ok: true, pitches: await shapeForVenue(await readPitches(vid)) });
  }

  /* ---------- what happened in the room ---------- */
  if (action === 'stats') {
    const p = await getVenueProfile(vid);
    const reg = await venueById(vid);
    return json(await venueStats(shapeVenue(p, reg)));
  }

  /* ---------- verification ----------
     Reports every check separately so the studio can show a checklist instead of
     a yes/no, and runs the real website fetch. */
  if (action === 'verifyCheck') {
    /* Checked against the email that CLAIMED the page, not whoever happens to be
       signed in — a barman added later must not be able to verify a venue by
       having a personal address on some other domain. */
    const [res, vouches, owner] = await Promise.all([
      recheck(vid), readVouches(vid), ownerEmail(vid),
    ]);
    const after = await venueById(vid);
    const names = Object.values(vouches.by || {}).map((x) => x.name).filter(Boolean);
    return json({ ok: true,
      verified: !!(after && after.verified), via: (after && after.verifiedVia) || null,
      passed: res.passed, checks: res.checks, why: res.why,
      vouches: names.length, need: MIN_VOUCHES, vouchedBy: names.slice(0, 12),
      email: owner, youAre: me.email, isOwner: owner === me.email });
  }

  if (action === 'verifyPreview') {           // just look, don't verify
    const p = await getVenueProfile(vid);
    const reg = await venueById(vid);
    return json({ ok: true, ...(await checkWebsite(shapeVenue(p, reg))) });
  }

  if (action === 'set') {
    await mutateVenueProfile(vid, (p) => {
      for (const k of ['name', 'tagline', 'about', 'city', 'country', 'address',
                       'mapUrl', 'phone', 'whatsapp'])
        if (typeof body[k] === 'string') p[k] = body[k];
      if (body.links && typeof body.links === 'object') p.links = { ...p.links, ...body.links };
      if (Array.isArray(body.amenities)) p.amenities = body.amenities;
      return true;
    });
    /* An event stores the place it is at, so changing the venue's city has to
       rewrite them — otherwise they keep pointing at the old town and quietly
       disappear from both feeds. */
    if (typeof body.city === 'string' || typeof body.country === 'string'
        || typeof body.name === 'string') {
      const p = await getVenueProfile(vid);
      const ev = await readEvents(evOwner(vid));
      if ((ev.list || []).length) {
        await mutateEvents(evOwner(vid), (d) => {
          for (const e of d.list) {
            if (p.name) e.venue = p.name;
            if (p.city) e.city = p.city;
            if (p.country) e.country = p.country;
          }
          return true;
        }).catch(() => {});
        await reindexCities(evOwner(vid), await readEvents(evOwner(vid))).catch(() => {});
      }
    }
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
    /* THE PHOTO CAP IS A PLAN LIMIT AND IT WAS NEVER ENFORCED. `VENUE_PLANS` has
       said 3 free / 12 Pro since venues shipped, the Studio only ever drew three
       boxes, and this endpoint would happily have written p11 for a free venue —
       a limit that exists in a table and nowhere in the code is not a limit.
       The cover photo is not counted: every venue gets one on any plan. */
    /* requireVenue returns the SESSION (vid, email, role), not the record — so
       the plan has to be read, not assumed off `me`. */
    const cap = venueLimits(await venueById(vid)).photos;
    const i = /^p(\d+)$/.exec(slot) ? Number(slot.slice(1)) : -1;
    if (i >= cap) {
      /* No `cap === 1` branch: every venue plan holds at least three, so that
         message could never be reached and only read as if it could. */
      return bad(`That is photo ${i + 1} — your plan holds ${cap}. Extra photos come with Pro.`, 402);
    }
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

  /* ---------- merch and the community page ----------
     Merch on a venue's page is a Pro feature (there is no $10 venue tier — venue
     plans are free and Pro, owner-set). Items sell through a LINK only: a venue has
     no payout account, so buying through MySet would put its money in the wrong
     balance (0r, 0x). Removing is never gated (0s). The community page and its
     moderation are free (0w). */
  if (action === 'merchList') {
    const p = await getVenueProfile(vid);
    return json({ ok: true, merch: p.merch, max: VMAX_MERCH, allowed: !!venueLimits(await venueById(vid)).merch });
  }
  if (action === 'merchSave') {
    if (!venueLimits(await venueById(vid)).merch) return bad('Merch on your page comes with Pro — anything you already added stays.', 402);
    const incoming = body.item || {};
    const id = /^m[a-z0-9]{6}$/.test(String(incoming.id || '')) ? String(incoming.id)
             : 'm' + Math.random().toString(36).slice(2, 8).padEnd(6, '0').slice(0, 6);
    let full = false, why = null;
    await mutateVenueProfile(vid, (p) => {
      p.merch = Array.isArray(p.merch) ? p.merch : [];
      const at = p.merch.findIndex((m) => m.id === id);
      const prev = at >= 0 ? p.merch[at] : null;
      const row = normMerch([{ ...(prev || {}), ...incoming, id, img: (prev && prev.img) || '', at: (prev && prev.at) || Date.now() }])[0];
      if (!row) { why = 'Give it a name'; return false; }
      if (!row.link) { why = 'Buying through MySet needs a payout account, which venues don’t have yet — add a link to where it sells.'; return false; }
      if (at >= 0) p.merch[at] = row;
      else if (p.merch.length >= VMAX_MERCH) { full = true; return false; }
      else p.merch.push(row);
      return true;
    });
    if (why) return bad(why);
    if (full) return bad(`${VMAX_MERCH} items is the most a page holds — edit one of those.`);
    return send();
  }
  if (action === 'merchRemove') {
    const id = String(body.id || '');
    await mutateVenueProfile(vid, (p) => { p.merch = (p.merch || []).filter((m) => m.id !== id); return true; });
    if (/^m[a-z0-9]{6}$/.test(id)) await dropImage(imgOwner(vid), id);
    return send();
  }
  if (action === 'merchPhoto') {
    if (!venueLimits(await venueById(vid)).merch) return bad('Merch on your page comes with Pro — anything you already added stays.', 402);
    const id = String(body.id || '');
    if (!/^m[a-z0-9]{6}$/.test(id)) return bad('unknown item');
    if (!(await getVenueProfile(vid)).merch.some((m) => m.id === id)) return bad('unknown item', 404);
    const dec = decodeDataUrl(body.data);
    if (dec.error) return bad(dec.error);
    const url = await putImage(imgOwner(vid), id, dec.bytes, dec.type);
    await mutateVenueProfile(vid, (p) => { const m = (p.merch || []).find((x) => x.id === id); if (!m) return false; m.img = url; return true; });
    return send();
  }
  if (action === 'merchPhotoClear') {
    const id = String(body.id || '');
    if (!/^m[a-z0-9]{6}$/.test(id)) return bad('unknown item');
    await dropImage(imgOwner(vid), id);
    await mutateVenueProfile(vid, (p) => { const m = (p.merch || []).find((x) => x.id === id); if (!m) return false; m.img = ''; return true; });
    return send();
  }
  if (action === 'postList') {
    return json({ ok: true, posts: shapeForOwner(await readPosts(imgOwner(vid))) });
  }
  if (['postHide', 'postPin', 'postReply', 'postDelete'].includes(action)) {
    const r = await moderate(imgOwner(vid), { action, id: String(body.id || '').slice(0, 12), text: body.text, on: body.on });
    if (!r.ok) return bad(r.error, 404);
    return json({ ok: true, posts: shapeForOwner(await readPosts(imgOwner(vid))) });
  }

  return bad('unknown action');
};
