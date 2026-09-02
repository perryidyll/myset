import { json, bad, cleanFanId, publicArtist, getShow } from './_lib.mjs';
import { saveFeedback } from './_feedback.mjs';

/* Public, like /api/vote — the audience never signs in (INVARIANT 9g), so this is
   anonymous by design. A device id and a star count, nothing else. */
export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);

  const show = await getShow(aid);
  const r = await saveFeedback(aid, fan, body.stars, body.note, show.showId);
  /* A rejected rating must never look like a failure to the fan — they were doing
     us a favour. `already` is reported so the page can stop asking. */
  if (!r.ok) return bad('Pick a star rating first', 400);
  return json({ ok: true, already: !!r.already });
};
