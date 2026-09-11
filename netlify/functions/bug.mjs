import { json, bad, cleanFanId, publicArtist, getShow } from './_lib.mjs';
import { saveBug, guard } from './_errlog.mjs';

/* "Something wrong?" from the audience page. Public and anonymous like /api/vote —
   a device id, a sentence, and whatever the page itself saw fail. The server adds
   the last three hours of its own errors so the artist can read both sides at once.
   A rejected report never looks like a failure to the fan; they were helping. */
const main = async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);

  const show = await getShow(aid);
  const r = await saveBug(aid, fan, { ...body, show: show.showId });
  if (!r.ok) return bad('Say what went wrong first', 400);
  return json({ ok: true, already: !!r.already });
};
export default guard('bug', main);
