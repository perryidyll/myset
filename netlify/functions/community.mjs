import { json, bad, publicArtist, getShow, cleanFanId, clientIp } from './_lib.mjs';
import { cleanSlug } from './_auth.mjs';
import { getProfile } from './_profile.mjs';
import { planForArtist, merchAllowed } from './_plan.mjs';
import { readHistIndex } from './_history.mjs';
import { readEvents, occurrencesFor } from './_events.mjs';
import { utcToDate, localDate } from './_time.mjs';

/* WHICH NIGHTS A FAN CAN PICK. The calendar, not the archive: an artist's gigs are
   on their calendar whether or not a show was run for them, and the archive only
   knows nights where MySet was used (and it can hold two rows for one night — a show
   started by hand, then again by the schedule). So: every calendar gig from the last
   120 days up to tonight, one per venue-and-date, newest first, with the archived
   showId attached when one exists. The key a post stores is `<eventId>@<date>`, or
   the showId for an older post. */
export async function pickableNights(aid, now = Date.now()) {
  const [events, hist] = await Promise.all([readEvents(aid).catch(() => ({ list: [] })), readHistIndex(aid)]);
  const occs = occurrencesFor(events, utcToDate(now - 120 * 86400000), utcToDate(now)).filter((o) => o.startsAt <= now);
  const byDate = new Map();
  for (const o of occs) {
    const date = localDate(o.startsAt, o.tz);
    const k = `${(o.venue || '').toLowerCase()}|${date}`;
    if (!byDate.has(k)) byDate.set(k, { key: `${o.eventId}@${o.date}`, label: `${o.venue || 'A show'} · ${date}`, venue: o.venue || '', date, at: o.startsAt });
  }
  // archived nights the calendar never had (older than the calendar, or entered by hand)
  for (const s of hist.shows || []) {
    const date = new Date(s.endedAt || s.startedAt || 0).toISOString().slice(0, 10);
    const k = `${(s.venue || '').toLowerCase()}|${date}`;
    if (!byDate.has(k)) byDate.set(k, { key: s.showId, label: `${s.venue || 'A show'} · ${date}`, venue: s.venue || '', date, at: s.startedAt || 0 });
  }
  return [...byDate.values()].sort((a, b) => b.at - a.at).slice(0, 40);
}
import { readPosts, readLikes, shapePosts, addPost, likePost, reportPost } from './_community.mjs';
import { canTakeMoney } from './_pay.mjs';
import { venueBySlug, getVenueProfile, shapeVenue } from './_venues.mjs';

/* PUBLIC. The community page's one endpoint.

   GET  ?a=<artist slug>  or  ?v=<venue slug>   [&fan=<device id>]
        → the owner, their merch, the feed, the shows a fan can pick, and which
          posts this device already liked
   POST { action: 'post' | 'like' | 'unlike' | 'report', fan, ... }

   Reads, for an artist page: the registry (twice — once to resolve the slug, once
   for the plan and the tick), the profile, the show (for the money gate and the
   live status), the history index, the posts, and the likes when a device is
   named. Counted in test/community.mjs. The audience poll is not involved. */

async function resolveOwner(req) {
  const q = new URL(req.url).searchParams;
  if (q.get('v')) {
    const slug = cleanSlug(q.get('v'));
    const vid = await venueBySlug(slug);
    if (!vid) return null;
    const { readVenues } = await import('./_venues.mjs');
    const reg = (await readVenues()).byId[vid] || {};
    const prof = await getVenueProfile(vid);
    const v = shapeVenue(prof, reg);
    return { kind: 'venue', id: vid, owner: `v_${vid}`, slug: reg.slug || slug, name: v.name,
             avatar: v.photo || '', verified: !!v.verified, merch: (v.merch || []).filter((m) => m.on), canBuy: !!v.paymentsEnabled, live: false, showId: '' };
  }
  const aid = await publicArtist(req);
  if (!aid) return null;
  const [{ artist: who, plan, limits }, p, show] = await Promise.all([planForArtist(aid), getProfile(aid), getShow(aid)]);
  return {
    kind: 'artist', id: aid, owner: aid, slug: (who && who.slug) || '', name: p.name || (who && who.name) || '',
    avatar: p.avatar || p.photo || '', verified: !!(who && who.verified) && plan !== 'free',
    /* Merch shows only while the plan has it (never deleted when a plan lapses — 0s). */
    merch: merchAllowed(aid, limits) ? p.merch.filter((m) => m.on) : [],
    /* ONE money gate, the same one every other button reads (0bl). */
    canBuy: canTakeMoney(aid, show),
    live: show.status === 'live', showId: show.showId || '',
  };
}

export default async (req) => {
  const o = await resolveOwner(req);
  if (!o) return bad('unknown page', 404);

  if (req.method === 'GET') {
    const fan = cleanFanId(new URL(req.url).searchParams.get('fan'));
    const [posts, likes, nights] = await Promise.all([
      readPosts(o.owner),
      fan ? readLikes(o.owner) : null,
      o.kind === 'artist' ? pickableNights(o.id) : [],
    ]);
    const shows = nights.map((n) => ({ showId: n.key, label: n.label }));
    const { fan: _f, ...pub } = o;
    return json({ ok: true, ...pub, posts: shapePosts(posts, likes, fan), shows,
                  limits: { text: 500, photos: 3, perDay: 3 } });
  }

  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');

  if (body.action === 'post') {
    let showLabel = '';
    const show = String(body.show || '').slice(0, 40);
    if (show && o.kind === 'artist') {
      const row = (await pickableNights(o.id)).find((n) => n.key === show);
      if (!row) return bad('Pick a night from the list.');
      showLabel = row.label;
    }
    const r = await addPost(o.owner, {
      fan, ip: clientIp(req), name: body.name, text: body.text, stars: body.stars,
      show: o.kind === 'artist' ? show : '', showLabel, photos: body.photos, video: body.video,
    });
    if (!r.ok) return bad(r.error, 400);
    const [posts, likes] = await Promise.all([readPosts(o.owner), readLikes(o.owner)]);
    return json({ ok: true, id: r.id, posts: shapePosts(posts, likes, fan) });
  }
  if (body.action === 'like' || body.action === 'unlike') {
    const r = await likePost(o.owner, fan, String(body.id || '').slice(0, 12), body.action === 'like');
    return r.ok ? json(r) : bad(r.error, 404);
  }
  if (body.action === 'report') {
    const r = await reportPost(o.owner, fan, String(body.id || '').slice(0, 12));
    return r.ok ? json(r) : bad(r.error, 404);
  }
  return bad('unknown action', 400);
};
