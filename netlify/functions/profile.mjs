import { json } from './_lib.mjs';
import { getProfile, shapeMedia } from './_profile.mjs';

/* Public. Everything here is already validated at write time; embeds are rebuilt
   from literal templates on every read so a stored record can never become a src. */
export default async () => {
  const p = await getProfile();
  return json({
    ok: true,
    name: p.name, tagline: p.tagline, bio: p.bio, photo: p.photo,
    links: p.links,
    media: p.media.map(shapeMedia).filter(Boolean),
    updatedAt: p.updatedAt,
  });
};
