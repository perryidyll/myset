import { json, bad, publicArtist } from './_lib.mjs';
import { getProfile, shapeMedia } from './_profile.mjs';

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
  return json({
    ok: true, artistId: aid,
    name: p.name, tagline: p.tagline, bio: p.bio, photo: p.photo,
    links: p.links,
    media: p.media.map(shapeMedia).filter(Boolean),
    updatedAt: p.updatedAt,
  });
};
