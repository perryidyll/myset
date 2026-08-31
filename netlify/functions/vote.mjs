import { getShow, mutateFan, creditsUsed, costOf, isUnlimited, publicArtist, json, bad,
         cleanFanId, votable } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  const song = typeof body.song === 'string' ? body.song.slice(0, 60) : '';
  if (!fan || !song) return bad('missing fan or song');

  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const show = await getShow(aid);
  if (show.status === 'ended') return bad('The show has ended', 409);
  /* The song has to exist at all. Whether it is ON OFFER is checked on the cast
     branch only, inside the mutation — because UN-voting has to work even after it
     stopped being on offer. INVARIANT 15 says a second tap refunds the credit, and
     the artist can narrow the setlist or hide a song mid-round; gating the toggle
     here would strand the fan's credit with no way to get it back. */
  const s0 = show.songs.find((x) => x.id === song);
  if (!s0) return bad('That one isn’t on tonight’s list', 404);
  const offered = votable(show)(s0);
  if (show.nowPlaying === song) return bad('That one is playing right now', 409);

  const cost = costOf(song, show);   // 1 normally, more to request a replay
  let err = null, outcome = null, want = null;

  try {
    await mutateFan(aid, fan, (me) => {
      me.ts ||= {};
      // window closed => no changes at all, in or out (an un-vote while paused
      // could not be re-cast and would silently drop the on-stage tally)
      if (!show.windowOpen) { err = ['Voting is closed right now', 409]; return false; }
      const at = me.v.indexOf(song);
      if (at >= 0) { me.v.splice(at, 1); delete me.ts[song]; want = false; outcome = { voted: false }; return true; }
      // casting is where the setlist applies — see the note above
      if (!offered) { err = ['That one isn’t on tonight’s list', 404]; return false; }
      const free = isUnlimited(fan, show);
      const total = show.freeCredits + (me.extra || 0);
      if (!free && creditsUsed(me, show) + cost > total) { err = ['no-credits', 402]; return false; }
      me.v.push(song);
      me.ts[song] = Date.now();
      want = true;
      outcome = { voted: true, cost, remaining: free ? null : Math.max(0, total - creditsUsed(me, show)) };
      return true;
    },
    // read back after writing: if the vote didn't stick, retry
    (me) => want === null || (me.v || []).includes(song) === want);
  } catch { return bad('busy', 503); }

  if (err) return bad(err[0], err[1]);
  return json({ ok: true, ...outcome });
};
