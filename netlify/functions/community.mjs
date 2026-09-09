import { json, bad, publicArtist, getShow, cleanFanId, clientIp, requireArtist, DEFAULT_ARTIST } from './_lib.mjs';
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
import { readPosts, readLikes, shapePosts, addPost, likePost, reportPost, editPost,
         removeOwnPost, PER_DEVICE_PER_DAY, DAY, EDIT_WINDOW } from './_community.mjs';
import { decodeVideoDataUrl, putClip, notePending, newClipId,
         MAX_SECONDS, MAX_VIDEO_BYTES } from './_video.mjs';
import { decodeDataUrl, putImage } from './_img.mjs';
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
  const signedArtist = o.kind === 'artist' ? await requireArtist(req) : null;
  const ownArtistPage = !!(signedArtist && signedArtist.aid === o.id && o.id !== DEFAULT_ARTIST);

  if (req.method === 'GET') {
    const fan = cleanFanId(new URL(req.url).searchParams.get('fan'));
    const [posts, likes, nights] = await Promise.all([
      readPosts(o.owner),
      fan ? readLikes(o.owner) : null,
      o.kind === 'artist' ? pickableNights(o.id) : [],
    ]);
    const shows = nights.map((n) => ({ showId: n.key, label: n.label }));
    const { fan: _f, ...pub } = o;
    return json({ ok: true, ...pub, canPost: !ownArtistPage,
                  posts: shapePosts(posts, likes, fan, o.owner), shows,
                  limits: { text: 500, photos: 3, perDay: PER_DEVICE_PER_DAY,
                            clipSeconds: MAX_SECONDS, clipBytes: MAX_VIDEO_BYTES,
                            editHours: Math.round(EDIT_WINDOW / 3600e3) } });
  }

  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  if (ownArtistPage && ['post', 'clip'].includes(body.action))
    return bad('Artists can’t post on their own community page.', 403);
  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');

  /* A CLIP GOES UP ON ITS OWN, BEFORE THE POST — see _video.mjs for why.
     The daily limit is checked HERE as well as in addPost, because this is the
     expensive door: without it a device that will never post could upload 3MB
     as often as it liked. It is a read-only check of the same counter addPost
     enforces inside its CAS, so the two can disagree only by being generous. */
  if (body.action === 'clip') {
    const posts = await readPosts(o.owner);
    const now = Date.now();
    const { sha } = await import('./_lib.mjs');
    const me = sha(String(fan)).slice(0, 10);
    const mine = (posts.recent || []).filter((r) => r && now - r.at < DAY && r.f === me);
    if (mine.length >= PER_DEVICE_PER_DAY)
      return bad('That’s three posts today from this phone — come back tomorrow.', 429);

    const dec = decodeVideoDataUrl(body.data);
    if (dec.error) return bad(dec.error, 400);
    const clip = newClipId();
    await putClip(o.owner, clip, dec.bytes, dec.type);
    /* The poster frame, grabbed on the phone. Optional: a clip with no poster
       still plays, it just shows a dark box until it is tapped. */
    if (body.poster) {
      const pd = decodeDataUrl(body.poster);
      if (!pd.error) await putImage(o.owner, clip, pd.bytes, pd.type);
    }
    await notePending(o.owner, clip);
    return json({ ok: true, clip, seconds: dec.seconds, bytes: dec.bytes.length });
  }

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
      clip: body.clip,
    });
    if (!r.ok) return bad(r.error, 400);
    const [posts, likes] = await Promise.all([readPosts(o.owner), readLikes(o.owner)]);
    return json({ ok: true, id: r.id, posts: shapePosts(posts, likes, fan, o.owner) });
  }
  /* CHANGING AND TAKING BACK YOUR OWN POST. Both prove ownership inside the write
     against the stored device id — the id in the body proves nothing by itself. */
  if (body.action === 'postEdit' || body.action === 'postRemove') {
    const id = String(body.id || '').slice(0, 12);
    const r = body.action === 'postEdit'
      ? await editPost(o.owner, fan, id, { text: body.text, stars: body.stars })
      : await removeOwnPost(o.owner, fan, id);
    if (!r.ok) return bad(r.error, /gone/.test(r.error) ? 404 : 403);
    const [posts, likes] = await Promise.all([readPosts(o.owner), readLikes(o.owner)]);
    return json({ ok: true, posts: shapePosts(posts, likes, fan, o.owner) });
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
