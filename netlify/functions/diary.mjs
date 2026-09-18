import { bad, jsonCached, publicArtist, getShow } from './_lib.mjs';
import { getProfile, firstOf } from './_profile.mjs';
import { planOf } from './_plan.mjs';
import { readDiary, shapePages } from './_diary.mjs';

/* THE DIARY PAGE'S ONE READ — `/api/fan?what=diary&a=<slug>` (decision 0085).

   Public, and the same shape as the profile read: the shown pages with their
   songs resolved from the library, the name and avatar for the header, and the
   tick. Fifteen seconds at the edge like the profile (jsonCached): everybody
   opening one artist's diary in the same quarter-minute shares one run of the
   four reads. Nothing here varies by who is asking, and nothing here is the
   audience poll. A hidden page never leaves the server. */
export default async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const { artistById } = await import('./_auth.mjs');
  const [d, show, p, who] = await Promise.all([readDiary(aid), getShow(aid), getProfile(aid), artistById(aid)]);
  const name = p.name || (who && who.name) || '';
  return jsonCached({
    ok: true, artistId: aid,
    name, first: firstOf(p, firstOf(who)),
    avatar: p.avatar || p.photo || '',
    verified: !!(who && who.verified) && planOf(who) !== 'free',   // the same belt the profile wears (0bn)
    live: show.status === 'live',
    pages: shapePages(d.pages, show.songs),
  }, 15);
};
