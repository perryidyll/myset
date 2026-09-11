import { guard, logErr } from './_errlog.mjs';
import { getShow, mutateFan, mutateMeta, unspentPaid, publicArtist, json, bad, cleanFanId } from './_lib.mjs';

/* When a show ends, a fan with votes they paid for but never spent decides what
   happens to them: carry them to the next show, or let the artist keep it.
   Doing nothing carries them — never silently pocket what someone paid for.
   No money moves here; the artist was paid at purchase time. This only decides
   whether the credit survives, and records the gift so he can see it. */
const main = async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');
  const choice = body.choice === 'gift' ? 'gift' : 'keep';

  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const show = await getShow(aid);
  /* Only when the show is actually over. This endpoint was unguarded, and the sheet
     it belongs to appears the instant the artist taps End — so an End tapped by
     mistake mid-gig asked the whole room to give away votes they had paid for, while
     the night carried on. */
  if (show.status !== 'ended') return bad('The show is still going', 409);

  let votes = 0;
  try {
    await mutateFan(aid, fan, (me) => {
      votes = unspentPaid(me, show);
      me.decided = show.showId;
      /* PLEDGE, don't debit. The credit is only actually given up at the real
         end-of-show boundary, in carryFans — which runs on newShow. So if the artist
         ends the show by accident and starts it again, the fan is silently made whole
         and never knows; and if the night really is over, the artist still gets it. */
      if (choice === 'gift' && votes > 0) me.pledged = votes;
      else delete me.pledged;
      return true;
    }, (me) => me.decided === show.showId);
  } catch (e) { await logErr('gift', e, { aid, fan }); return bad('busy', 503); }

  if (choice === 'gift' && votes > 0) {
    await mutateMeta(aid, (m) => {
      m.gifts.push({ fan, votes, at: Date.now(), showId: show.showId });
      if (m.gifts.length > 500) m.gifts = m.gifts.slice(-500);
      return true;
    }).catch(() => {});
  }
  return json({ ok: true, choice, votes });
};
export default guard('gift', main);
