import { json, bad, publicArtist, getShow } from './_lib.mjs';
import { getProfile, shapeMedia } from './_profile.mjs';
import { readHistIndex } from './_history.mjs';

/* Public. Everything here is already validated at write time; embeds are rebuilt
   from literal templates on every read so a stored record can never become a src. */
export default async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const p = await getProfile(aid);
  if (!p.name) {                                  // fall back to the registered name
    const { artistById } = await import('./_auth.mjs');
    const a = await artistById(aid);
    p.name = (a && a.name) || '';
  }
  // Real numbers only. No follower count, because there is no follow yet.
  const [hist, show] = await Promise.all([readHistIndex(aid), getShow(aid)]);
  const shows = hist.shows.length;
  const votes = hist.shows.reduce((a, x) => a + (x.totalVotes || 0), 0);
  const people = hist.shows.reduce((a, x) => a + (x.peakVoters || 0), 0);

  return json({
    ok: true, artistId: aid,
    stats: { shows, votes, people, songs: (show.songs || []).filter((x) => x.active !== false).length },
    name: p.name, tagline: p.tagline, bio: p.bio, photo: p.photo,
    avatar: p.avatar || p.photo, photos: p.photos,
    links: p.links,
    media: p.media.map(shapeMedia).filter(Boolean),
    updatedAt: p.updatedAt,
  });
};
