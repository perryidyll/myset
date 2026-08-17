import { getShow, mutateFan, json, bad, cleanFanId } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  const song = typeof body.song === 'string' ? body.song.slice(0, 60) : '';
  if (!fan || !song) return bad('missing fan or song');

  const show = await getShow();
  if (show.status === 'ended') return bad('The show has ended', 409);
  const s0 = show.songs.find((x) => x.id === song && x.active !== false);
  if (!s0) return bad('unknown song', 404);
  if (show.nowPlaying === song || show.played.includes(song))
    return bad('That one already played', 409);

  let err = null, outcome = null;
  try {
    // Only this fan's shard is touched -> minimal contention, CAS-safe.
    let want = null;
    await mutateFan(fan, (me) => {
      const at = me.v.indexOf(song);
      if (at >= 0) { me.v.splice(at, 1); want = false; outcome = { voted: false }; return true; }
      if (!show.windowOpen) { err = ['Voting is closed right now', 409]; return false; }
      const total = show.freeCredits + (me.extra || 0);
      if (me.v.length >= total) { err = ['no-credits', 402]; return false; }
      me.v.push(song);
      want = true;
      outcome = { voted: true, remaining: Math.max(0, total - me.v.length) };
      return true;
    },
    // read back after writing: if the vote didn't stick, retry
    (me) => want === null || (me.v || []).includes(song) === want);
  } catch { return bad('busy', 503); }

  if (err) return bad(err[0], err[1]);
  return json({ ok: true, ...outcome });
};
