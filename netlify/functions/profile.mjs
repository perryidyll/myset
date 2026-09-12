import { json, bad, jsonCached, publicArtist, getShow } from './_lib.mjs';
import { getProfile, shapeMedia } from './_profile.mjs';
import { readHistIndex } from './_history.mjs';
import { planOf } from './_plan.mjs';
import { readFeedback } from './_feedback.mjs';
import { readPosts } from './_community.mjs';

/* The room's favourites across every archived night, from the index rows alone
   (decision 0043): rows carry `top:{title,votes}` since archive-time started
   stamping it; older rows without it simply do not count. Same title across
   nights is one song, and only its votes and title travel. */
export function topSongsOf(rows) {
  const by = new Map();
  for (const r of rows || []) {
    const t = r && r.top && r.top.title; if (!t) continue;
    const k = String(t).trim().toLowerCase(); if (!k) continue;
    const cur = by.get(k) || { title: String(t).trim(), votes: 0 };
    cur.votes += Number(r.top.votes) || 0; by.set(k, cur);
  }
  return [...by.values()].filter((x) => x.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title)).slice(0, 3);
}

/* Public. Everything here is already validated at write time; embeds are rebuilt
   from literal templates on every read so a stored record can never become a src. */
export default async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const p = await getProfile(aid);
  // Real numbers only. No follower count, because there is no follow yet.
  const { artistById } = await import('./_auth.mjs');
  /* `fb_` and `posts_` are the two reads added for the proof strip (decision 0043),
     edge-shared like the rest (below); presence is still never read here (0af). */
  const [hist, show, who, fb, posts] = await Promise.all([
    readHistIndex(aid), getShow(aid), artistById(aid),
    readFeedback(aid).catch(() => null), readPosts(aid).catch(() => null),
  ]);
  const shows = hist.shows.length;
  const votes = hist.shows.reduce((a, x) => a + (x.totalVotes || 0), 0);
  /* Shows archived before the head-count existed only recorded how many people
     VOTED. That is a floor on how many were there, never a ceiling, so using it
     as the fallback under-states the number rather than inflating it. */
  const people = hist.shows.reduce((a, x) => a + (x.room ?? x.peakVoters ?? 0), 0);
  if (!p.name) p.name = (who && who.name) || '';       // fall back to the registered name
  /* THE TICK, AND on read (INVARIANT 0bn, the artist half). The registry flag is
     set by the auto path or by Perry's hand, but a comped or paid plan can lapse
     with nothing firing, so the flag alone would show a tick on a page that no
     longer qualifies. `verified && paid` here is the belt the venue page already
     wears in shapeVenue. Only the boolean travels — never the ID row (0bk). */
  const verified = !!(who && who.verified) && planOf(who) !== 'free';

  /* Fifteen seconds at the edge (jsonCached): everybody opening this artist in
     the same quarter-minute shares one run of the five reads above. The only thing
     here that moves fast is `live`, and a Live pill up to 30s behind is the same
     lag the room's own poll ladder accepts. The Studio reads /api/profile?t=now
     after a save and so never sees a copy. */
  return jsonCached({
    ok: true, artistId: aid,
    stats: { shows, votes, people,
             songs: (show.songs || []).filter((x) => x.active !== false).length,
             joined: (who && who.createdAt) || null },
    verified,
    /* The page used to fetch /api/show?fan=profile beside this — a full 15-read
       audience poll per profile view, to learn three fields the show record this
       handler already read can answer. */
    live: show.status === 'live', venue: show.venue || '', city: show.city || '',
    showId: show.showId || '',
    merch: (p.merch || []).filter((m) => m.on).length,
    /* The proof strip. `requests` from the show already in hand; `rating` is the
       average and count only — the notes stay in the Studio; `posts` counts what
       the public feed would show; `topSongs` is at most three {title,votes}. */
    requests: !!(show.requests && show.requests.on),
    rating: fb && fb.count > 0 ? { avg: Math.round((fb.sum / fb.count) * 10) / 10, count: fb.count } : null,
    posts: posts ? posts.list.filter((x) => x && !x.hidden).length : 0,
    topSongs: topSongsOf(hist.shows),
    name: p.name, tagline: p.tagline, style: p.style, bio: p.bio, photo: p.photo,
    avatar: p.avatar || p.photo, photos: p.photos,
    management: p.management, managementUrl: p.managementUrl,
    links: p.links,
    media: p.media.map(shapeMedia).filter(Boolean),
    updatedAt: p.updatedAt,
  });
};
