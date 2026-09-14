import { guard } from './_errlog.mjs';
import { json, bad, cleanFanId, publicArtist, clientIp } from './_lib.mjs';
import { artistById, emailReady } from './_auth.mjs';
import { sendThread, threadByToken, bookerReply, shapeForBooker } from './_messages.mjs';

/* Public — the Book button on an artist's page and the booker's way back
   (decision 0074, _messages.mjs for the rules). Artists only: a venue page has no
   Book button, so `?v=` is refused rather than resolved. Every reply is personal
   (json, never jsonCached — the URL is the whole edge key, 9d6).

     POST /api/messages?a=<slug>  { action:'send', fan, name, email, phone?, venue?, when?, kind?, text, hp? }
                                  -> { ok, id, k }   the conversation's id and the booker's token
     POST /api/messages?a=<slug>  { action:'get', t, k }
                                  -> { ok, thread }  the booker's view of the conversation
     POST /api/messages?a=<slug>  { action:'reply', t, k, text }
                                  -> { ok }          the booker writes again
   The token never rides in a URL: a thrown request logs its address (0fb), never
   its body. `mail` on the send reply says whether letters go out at all, so the
   page never promises an email that cannot come. */
const main = async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('v') !== null) return bad('Book lives on artist pages', 404);
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const who = await artistById(aid).catch(() => null);
  const ctx = { slug: (who && who.slug) || url.searchParams.get('a') || '', artistName: (who && who.name) || '' };

  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('invalid'); }
  if (!body || typeof body !== 'object') return bad('invalid');

  if (body.action === 'send') {
    const fan = cleanFanId(body.fan);
    if (fan.length < 6) return bad('missing fan');
    const r = await sendThread(aid, { ...body, fan, ip: clientIp(req) }, ctx);
    if (!r.ok) return bad(r.error, r.status || 400);
    return json({ ok: true, id: r.id, k: r.k, mail: emailReady() });
  }
  if (body.action === 'get') {
    const t = await threadByToken(aid, String(body.t || ''), String(body.k || ''));
    if (!t) return bad('That conversation isn’t here.', 404);
    return json({ ok: true, thread: shapeForBooker(t, ctx.artistName), mail: emailReady() });
  }
  if (body.action === 'reply') {
    const r = await bookerReply(aid, String(body.t || ''), String(body.k || ''), body.text, ctx);
    if (!r.ok) return bad(r.error, r.status || 400);
    return json({ ok: true });
  }
  return bad('unknown action');
};
export default guard('messages', main);
