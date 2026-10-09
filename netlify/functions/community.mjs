import { guard } from './_errlog.mjs';
import { json, jsonCached, bad, publicArtist, getShow, cleanFanId, clientIp, requireArtist, DEFAULT_ARTIST } from './_lib.mjs';
import { cleanSlug } from './_auth.mjs';
import { getProfile, firstOf, readHolds, heldOn } from './_profile.mjs';
import { planForArtist, merchAllowed } from './_plan.mjs';
import { readDiary } from './_diary.mjs';
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
import { h10, readPosts, readLikes, shapePosts, addPost, likePost, reportPost, editPost,
         removeOwnPost, PER_DEVICE_PER_DAY, EDIT_WINDOW } from './_community.mjs';
import { MAX_SECONDS, MAX_VIDEO_BYTES } from './_video.mjs';
import { addWish, MAX_WISH } from './_wishes.mjs';
import { canTakeMoney } from './_pay.mjs';
import { venueBySlug, getVenueProfile, shapeVenue } from './_venues.mjs';

/* PUBLIC. The community page's one endpoint.

   GET  ?a=<artist slug>  or  ?v=<venue slug>
        → THE SHARED READ (decision 0093): the owner, their merch, the feed, the shows
          a fan can pick — nothing personal on it, so every phone asks the identical
          URL and the edge keeps one copy for all of them (30 s, stale 30 more)
   GET  …&fan=<device id>&me=1
        → THE PERSONAL CALL: which posts are this device's (and still editable),
          which it liked, and whether it may post at all — never cached
   GET  …&fan=<device id>
        → the whole reply with the marks on it, personal, never cached — for a page
          a phone kept from before 0093 and for the suite
   POST { action: 'post' | 'like' | 'unlike' | 'report' | 'wish', fan, ... }
        ('wish' is the shop page's Make a request — see _wishes.mjs)

   Reads, for an artist page: the registry (twice — once to resolve the slug, once
   for the plan and the tick), the profile, the show (for the money gate and the
   live status), the diary (the count and three titles for its card — 0085), the
   history index, the posts, the likes when a device is named, and the held stock
   (`mhold_<owner>`, 0195) when an item or a size is counted. Counted in
   test/community.mjs. The audience poll is not involved. */

async function resolveOwner(req) {
  const q = new URL(req.url).searchParams;
  if (q.get('v')) {
    const slug = cleanSlug(q.get('v'));
    const vid = await venueBySlug(slug);
    if (!vid) return null;
    const { readVenues } = await import('./_venues.mjs');
    // the registry row and the profile both need only the id: one hop, not two
    const [venues, prof] = await Promise.all([readVenues(), getVenueProfile(vid)]);
    const reg = venues.byId[vid] || {};
    const v = shapeVenue(prof, reg);
    return { kind: 'venue', id: vid, owner: `v_${vid}`, slug: reg.slug || slug, name: v.name,
             avatar: v.photo || '', verified: !!v.verified, merch: (v.merch || []).filter((m) => m.on), canBuy: !!v.paymentsEnabled, live: false, showId: '' };
  }
  const aid = await publicArtist(req);
  if (!aid) return null;
  const [{ artist: who, plan, limits }, p, show, diary] = await Promise.all([planForArtist(aid), getProfile(aid), getShow(aid), readDiary(aid).catch(() => null)]);
  /* The diary card (decision 0085): the count of shown pages and the first three
     pages' titles and covers, for the fan of tiles — the card is drawn only when the count is above zero. */
  const shown = ((diary && diary.pages) || []).filter((x) => x.on);
  return {
    kind: 'artist', id: aid, owner: aid, slug: (who && who.slug) || '', name: p.name || (who && who.name) || '', first: firstOf(p, firstOf(who)),
    avatar: p.avatar || p.photo || '', verified: !!(who && who.verified) && plan !== 'free',
    /* Merch shows only while the plan has it (never deleted when a plan lapses — 0s). */
    merch: merchAllowed(aid, limits) ? p.merch.filter((m) => m.on) : [],
    /* ONE money gate, the same one every other button reads (0bl). */
    canBuy: canTakeMoney(aid, show),
    live: show.status === 'live', showId: show.showId || '',
    diary: shown.length, diaryPeek: shown.slice(0, 3).map((x) => ({ title: x.title, img: x.img || '' })),
  };
}

/* STOCK NET OF CHECKOUTS IN PROGRESS (decision 0195, the contract in 0178). A buyer on
   Stripe's page holds what they are paying for (`mhold_<owner>`); the page must not
   offer what the server will refuse at the tap (rule 3). So every counted item's and
   size's count goes out less what live holds have on it, and `held` says how much of
   what was there is held — the page says "check back" rather than "sold out for good"
   when the holds are all that stand between a fan and the last one. `held` is never
   more than the count: a hold on stock a hold-less payment already took (the refund
   path) is not coming back. Reads only — the holds are written by pay.mjs alone. */
const counted = (list) => (list || []).some((m) => m && (m.stock != null || (m.variants || []).some((v) => v && v.stock != null)));
export function netOfHolds(list, holds, now = Date.now()) {
  if (!holds || !Object.keys(holds).length) return list;
  const net = (x, h) => { const n = Math.min(h, x.stock); return n > 0 ? { ...x, stock: x.stock - n, held: n } : x; };
  return (list || []).map((m) => {
    if (!m) return m;
    let o = m.stock != null ? net(m, heldOn(holds, m, 'i', now)) : m;
    if (Array.isArray(m.variants) && m.variants.some((v) => v && v.stock != null))
      o = { ...o, variants: m.variants.map((v) => (v && v.stock != null ? net(v, heldOn(holds, m, 'v:' + String(v.label).toLowerCase(), now)) : v)) };
    return o;
  });
}

/* THE PERSONAL CALL (decision 0093): the marks the shared read cannot carry. Reads the
   registry to resolve the slug, then the posts and the likes — nothing else, and never
   the profile, the show or the diary the shared read pays for. json() says no-store twice. */
async function mine(req, fan) {
  const q = new URL(req.url).searchParams;
  let owner = null, aid = null;
  if (q.get('v')) { const vid = await venueBySlug(cleanSlug(q.get('v'))); if (vid) owner = `v_${vid}`; }
  else { aid = await publicArtist(req); if (aid) owner = aid; }
  if (!owner) return bad('unknown page', 404);
  const signed = aid ? await requireArtist(req) : null;
  const canPost = !(signed && signed.aid === aid && aid !== DEFAULT_ARTIST);
  const [posts, likes] = await Promise.all([readPosts(owner), readLikes(owner)]);
  const f = h10(fan), now = Date.now(), own = [], editable = [], liked = [];
  for (const p of posts.list) {
    if (!p || p.hidden) continue;
    if (p.fan === fan) { own.push(p.id); if (now - (p.at || 0) <= EDIT_WINDOW) editable.push(p.id); }
    if (likes.by && likes.by[p.id] && likes.by[p.id][f]) liked.push(p.id);
  }
  return json({ ok: true, canPost, mine: own, editable, liked });
}

const main = async (req) => {
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const fan = cleanFanId(q.get('fan'));
    if (fan && q.get('me')) return mine(req, fan);
  }
  const o = await resolveOwner(req);
  if (!o) return bad('unknown page', 404);
  const fanQ = req.method === 'GET' ? cleanFanId(new URL(req.url).searchParams.get('fan')) : null;
  /* The shared read — a GET with no device named — consults no token: nothing in it may
     depend on who asks (INVARIANT 0gg), and a token would cost a registry read for nothing. */
  const signedArtist = o.kind === 'artist' && (req.method !== 'GET' || fanQ) ? await requireArtist(req) : null;
  const ownArtistPage = !!(signedArtist && signedArtist.aid === o.id && o.id !== DEFAULT_ARTIST);

  if (req.method === 'GET') {
    const fan = fanQ;
    const [posts, likes, nights, holds] = await Promise.all([
      readPosts(o.owner),
      fan ? readLikes(o.owner) : null,
      o.kind === 'artist' ? pickableNights(o.id) : [],
      /* the held stock (0195): read only when something is counted — an uncounted item is
         never held — and a read that fails counts as no holds: the tap still refuses (0178) */
      counted(o.merch) ? readHolds(o.owner).catch(() => ({})) : null,
    ]);
    const shows = nights.map((n) => ({ showId: n.key, label: n.label }));
    if (holds) o.merch = netOfHolds(o.merch, holds);
    const { fan: _f, ...pub } = o;
    /* With no device named this is THE SHARED READ (decision 0093): nothing on it is
       personal — canPost is true for everyone, the marks on every post are off — so the
       edge keeps one copy for every phone. `at` says when the copy was made: the page keeps
       a newer list it already holds (its own post, just made) over an older shared copy. */
    const body = { ok: true, ...pub, canPost: fan ? !ownArtistPage : true,
                   posts: shapePosts(posts, likes, fan, o.owner), shows,
                   limits: { text: 500, photos: 3, perDay: PER_DEVICE_PER_DAY,
                             clipSeconds: MAX_SECONDS, clipBytes: MAX_VIDEO_BYTES,
                             editHours: Math.round(EDIT_WINDOW / 3600e3), wish: MAX_WISH },
                   at: Date.now() };
    return fan ? json(body) : jsonCached(body, 30);
  }

  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  if (ownArtistPage && ['post', 'wish'].includes(body.action))
    return bad('Artists can’t post on their own community page.', 403);
  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');

  /* A CLIP GOES UP ON ITS OWN, BEFORE THE POST, through /api/clipup — the only door
     for one. The old `clip` action here (a whole clip as base64 in this body) had no
     page sending it and no network ceiling, so it is gone (decision 0189). */
  if (body.action === 'post') {
    /* WHERE THEY SAW THEM: either a night off the artist's own list (show id →
       its label, and one post per night per phone), or a name the fan typed
       themselves — a venue, a city, a festival that isn't on the list. A typed
       name is just a label on the post; it never counts as a show id. */
    let showLabel = '';
    const show = String(body.show || '').slice(0, 40);
    if (show && o.kind === 'artist') {
      const row = (await pickableNights(o.id)).find((n) => n.key === show);
      if (!row) return bad('Pick a night from the list.');
      showLabel = row.label;
    }
    if (!showLabel && body.where) showLabel = String(body.where).replace(/\s+/g, ' ').trim().slice(0, 60);
    const r = await addPost(o.owner, {
      fan, ip: clientIp(req), name: body.name, text: body.text, stars: body.stars,
      show: o.kind === 'artist' ? show : '', showLabel, photos: body.photos, video: body.video,
      clip: body.clip,
    });
    if (!r.ok) return bad(r.error, 400);
    const [posts, likes] = await Promise.all([readPosts(o.owner), readLikes(o.owner)]);
    return json({ ok: true, id: r.id, posts: shapePosts(posts, likes, fan, o.owner), at: Date.now() });
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
    return json({ ok: true, posts: shapePosts(posts, likes, fan, o.owner), at: Date.now() });
  }

  /* MAKE A REQUEST (the shop page). A sentence for the owner's Studio, nothing back
     to the fan but a thank-you; the limits live inside addWish's CAS. */
  if (body.action === 'wish') {
    const r = await addWish(o.owner, { fan, ip: clientIp(req), name: body.name, text: body.text, item: body.item });
    if (!r.ok) return bad(r.error, /today/.test(r.error) ? 429 : 400);
    return json({ ok: true, id: r.id });
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
export default guard('community', main);
