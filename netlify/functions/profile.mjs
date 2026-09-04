import { json, bad, publicArtist, getShow } from './_lib.mjs';
import { getProfile, shapeMedia } from './_profile.mjs';
import { readHistIndex } from './_history.mjs';
import { planOf } from './_plan.mjs';

/* Public. Everything here is already validated at write time; embeds are rebuilt
   from literal templates on every read so a stored record can never become a src. */
export default async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const p = await getProfile(aid);
  // Real numbers only. No follower count, because there is no follow yet.
  const { artistById } = await import('./_auth.mjs');
  const [hist, show, who] = await Promise.all([readHistIndex(aid), getShow(aid), artistById(aid)]);
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

  return json({
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
    name: p.name, tagline: p.tagline, bio: p.bio, photo: p.photo,
    avatar: p.avatar || p.photo, photos: p.photos,
    links: p.links,
    media: p.media.map(shapeMedia).filter(Boolean),
    updatedAt: p.updatedAt,
  });
};
