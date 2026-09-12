import { json, bad, jsonCached, publicArtist, getShow, playable } from './_lib.mjs';
import { getProfile, shapeMedia } from './_profile.mjs';
import { readHistIndex } from './_history.mjs';
import { planOf } from './_plan.mjs';
import { readFeedback } from './_feedback.mjs';
import { readPosts } from './_community.mjs';

/* The room's favourites across every archived night, from the index rows alone
   (decision 0043): rows carry `top:{title,votes}`, `topPlayed:{title,plays}` and
   `topPaid:{title,paid}` since archive-time started stamping them; older rows
   without a field simply do not count towards it. Same title across nights is one
   song, and only its title and the one count travel. */
export function topAcross(rows, field, key, n = 3) {
  const by = new Map();
  for (const r of rows || []) {
    const t = r && r[field] && r[field].title; if (!t) continue;
    const k = String(t).trim().toLowerCase(); if (!k) continue;
    const cur = by.get(k) || { title: String(t).trim(), [key]: 0 };
    cur[key] += Number(r[field][key]) || 0; by.set(k, cur);
  }
  return [...by.values()].filter((x) => x[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.title.localeCompare(b.title)).slice(0, n);
}
export const topSongsOf = (rows) => topAcross(rows, 'top', 'votes', 3);
/* What a fan said, in public, on the community page: the three most recent posts
   that carry words and are not hidden, cut to a card's worth. Never the star
   notes from the "enjoying MySet?" prompt — those were written for the artist —
   and never a name or a device id: the community page has the rest. */
export const MAX_COMMENT = 140;
export function commentsOf(posts) {
  return ((posts && posts.list) || [])
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p && !p.hidden && String(p.text || '').trim())
    // newest first; the list is append-order, which settles two posts in the same millisecond
    .sort((a, b) => (b.p.at || 0) - (a.p.at || 0) || b.i - a.i).slice(0, 3)
    .map(({ p }) => ({
      text: String(p.text).replace(/\s+/g, ' ').trim().slice(0, MAX_COMMENT),
      stars: p.stars >= 1 && p.stars <= 5 ? Math.round(p.stars) : null,
      when: Number(p.at) || 0,
    }));
}

/* Public. Everything here is already validated at write time; embeds are rebuilt
   from literal templates on every read so a stored record can never become a src. */
export default async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  // Real numbers only. No follower count, because there is no follow yet.
  const { artistById } = await import('./_auth.mjs');
  /* `fb_` and `posts_` are the two reads added for the proof strip (decision 0043),
     edge-shared like the rest (below); presence is still never read here (0af).
     The profile travels in the same batch: all six need only `aid`, so this is one
     hop to storage, not two (speed pass two). */
  const [p, hist, show, who, fb, posts] = await Promise.all([
    getProfile(aid), readHistIndex(aid), getShow(aid), artistById(aid),
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
       the public feed would show; `topSongs` is at most three {title,votes}, and
       `topVoted` / `topPlayed` / `topPaid` the single favourite by each count or
       null; `comments` up to three public posts; `setlist` a taste of tonight's
       list — the ten the room could pick from first — and `songs` how many it
       holds. All from documents already in hand. */
    requests: !!(show.requests && show.requests.on),
    /* `nights` is how many different shows the kept ratings name — a floor, since
       the list is trimmed and the earliest ratings named no show — so the page can
       say "over N nights" and mean it, and falls back to the count when it is 0.
       `show-<ms>` is the id normShow invents per read for an account with no show
       on record: it names no night, so it does not count as one. */
    rating: fb && fb.count > 0 ? { avg: Math.round((fb.sum / fb.count) * 10) / 10, count: fb.count,
                                   nights: new Set((fb.list || []).map((r) => r && r.show).filter((s) => s && !/^show-\d*$/.test(s))).size } : null,
    posts: posts ? posts.list.filter((x) => x && !x.hidden).length : 0,
    topSongs: topSongsOf(hist.shows),
    topVoted: topSongsOf(hist.shows)[0] || null,
    topPlayed: topAcross(hist.shows, 'topPlayed', 'plays', 1)[0] || null,
    topPaid: topAcross(hist.shows, 'topPaid', 'paid', 1)[0] || null,
    comments: commentsOf(posts),
    setlist: playable(show).songs.slice(0, 10).map((s) => String(s.title || '')).filter(Boolean),
    songs: playable(show).songs.length,
    name: p.name, tagline: p.tagline, style: p.style, bio: p.bio, photo: p.photo,
    avatar: p.avatar || p.photo, photos: p.photos,
    management: p.management, managementUrl: p.managementUrl,
    links: p.links,
    media: p.media.map(shapeMedia).filter(Boolean),
    updatedAt: p.updatedAt,
  });
};
