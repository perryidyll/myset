import { getShow, publicArtist, json, bad, cleanFanId } from './_lib.mjs';
import { createRequest, readRequests, myRequests } from './_requests.mjs';

/* Public. Asking for a song that isn't on the list, or a birthday shout-out.
   Both cost votes; a song request may carry a manually captured offer. The
   artist has to have switched the request type on. */
export default async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);

  const fan = cleanFanId(new URL(req.url).searchParams.get('fan'));

  if (req.method === 'GET') {
    const [show, d] = await Promise.all([getShow(aid), readRequests(aid)]);
    return json({ ok: true, mine: fan ? myRequests(d, fan, show) : [] });
  }
  if (req.method !== 'POST') return bad('POST only', 405);

  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const fanId = fan || cleanFanId(body.fan);
  if (!fanId) return bad('missing fan');

  const show = await getShow(aid);
  const r = await createRequest(aid, show, fanId, body);
  if (!r.ok) return bad(r.error, r.status || 400);

  const d = await readRequests(aid);
  return json({ ok: true, charged: r.charged, mine: myRequests(d, fanId, show) });
};
