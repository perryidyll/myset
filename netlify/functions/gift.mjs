import { getShow, mutateFan, mutateMeta, unspentPaid, publicArtist, json, bad, cleanFanId } from './_lib.mjs';

/* When a show ends, a fan with votes they paid for but never spent decides what
   happens to them: carry them to the next show, or let the artist keep it.
   Doing nothing carries them — never silently pocket what someone paid for.
   No money moves here; the artist was paid at purchase time. This only decides
   whether the credit survives, and records the gift so he can see it. */
export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');
  const choice = body.choice === 'gift' ? 'gift' : 'keep';

  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const show = await getShow(aid);
  let votes = 0;
  try {
    await mutateFan(aid, fan, (me) => {
      votes = unspentPaid(me, show);
      me.decided = show.showId;
      if (choice === 'gift' && votes > 0) {
        me.extra = Math.max(0, (me.extra || 0) - votes);
        me.gifted = (me.gifted || 0) + votes;
      }
      return true;
    }, (me) => me.decided === show.showId);
  } catch { return bad('busy', 503); }

  if (choice === 'gift' && votes > 0) {
    await mutateMeta(aid, (m) => {
      m.gifts.push({ fan, votes, at: Date.now(), showId: show.showId });
      if (m.gifts.length > 500) m.gifts = m.gifts.slice(-500);
      return true;
    }).catch(() => {});
  }
  return json({ ok: true, choice, votes });
};
