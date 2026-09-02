import { getShow, mutateFan, creditsUsed, costOf, isUnlimited, publicArtist, json, bad,
         cleanFanId, votable, roomHash, clientIp } from './_lib.mjs';
import { readFlags, flagValue } from './_flags.mjs';

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  const song = typeof body.song === 'string' ? body.song.slice(0, 60) : '';
  if (!fan || !song) return bad('missing fan or song');
  /* How many votes to put on this one song. The sheet in vote.html asks; the
     affordability check below is what actually bounds it, and this cap only stops
     a hand-made request turning one fan record into a million-element array. */
  const n = Math.max(1, Math.min(50, Math.floor(Number(body.n) || 1)));

  /* ONE PRESS OF CONFIRM = ONE CAST ID, and it is what makes a cast idempotent.

     This used to be free: voting toggled, so a lost response found the vote already
     there and removed it — self-correcting, and never a double charge. That is the
     mechanism INVARIANT 15's refund quietly WAS. Under `voteFinal` there is no
     toggle to correct anything, so without an id a dropped response on bar wifi
     casts a second time, at replay prices. The id is minted when Confirm is pressed
     (not when the sheet opens, or stepping the quantity would reuse it) and the
     outcome is remembered on the fan record, exactly like meta.paid[sid] makes a
     payment replay-safe. INVARIANT 15h. */
  const rawCast = body.cast === undefined || body.cast === null ? '' : String(body.cast);
  const castId = /^[A-Za-z0-9_-]{8,64}$/.test(rawCast) ? rawCast : '';
  /* A MALFORMED id is refused rather than treated as absent. Silently dropping it
     left the request with no idempotency at all — which is the one thing the id
     exists to provide, so failing quietly is worse than failing. An id that was
     never sent is still fine: an older cached page has no concept of one. */
  if (rawCast && !castId) return bad('bad cast id', 400);

  /* What the fan MEANT, rather than inferring it from what they already hold.
     With finality on, "cast again" and "take it back" are different intentions and
     must not be guessed. An older cached page sends neither, and gets the toggle it
     was written for — the flag decides, never the body. */
  const op = body.op === 'cast' || body.op === 'clear' ? body.op : '';

  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const [show, flagDoc] = await Promise.all([getShow(aid), readFlags()]);
  const final = flagValue(flagDoc, 'voteFinal', aid);
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
  /* `want` is the number of votes this fan should hold on this song once the write
     lands — an absolute count, because that is what the read-back can verify.
     `fan.v` holds one entry PER VOTE, so the same id may appear several times;
     voteCounts and creditsUsed both work by counting entries, so multi-vote came
     out of the existing shape rather than a new field. */
  let err = null, outcome = null, want = null, replayed = false;
  const held = (me) => (me.v || []).filter((x) => x === song).length;
  const CASTS_KEPT = 20;

  try {
    await mutateFan(aid, fan, (me) => {
      me.ts ||= {};
      /* Stamp the network hash here too. markPresence was the ONLY writer, and it
         runs from the polling path only — so a fan record created purely by voting
         had no network hash at all, and `nets` (which INVARIANT 0ae calls "the only
         defence against one phone rotating its id") was blank for exactly the traffic
         worth watching. The write is already happening, so this costs nothing.
         `||=` on purpose: a device that changes network mid-gig keeps its first
         stamp and so cannot inflate `nets` in the other direction either. */
      me.ipH ||= roomHash(aid, clientIp(req));
      // window closed => no changes at all, in or out (an un-vote while paused
      // could not be re-cast and would silently drop the on-stage tally)
      if (!show.windowOpen) { err = ['Voting is closed right now', 409]; return false; }
      /* Already done this exact cast: hand back what it returned the first time
         and write NOTHING. Checked inside the mutation so two racing retries cannot
         both get past it. */
      me.casts ||= [];
      if (castId) {
        const prior = me.casts.find((c) => c && c.id === castId);
        if (prior) { outcome = { ...(prior.out || {}), replay: true }; replayed = true; return false; }
      }

      const mine = held(me);
      /* Taking votes back. `op` says so explicitly; with neither op nor flag we fall
         through to the historic toggle, so a cached page keeps working. */
      const clearing = op === 'clear' || (op === '' && mine > 0);
      if (clearing) {
        if (final) { err = ['Those votes are cast — they stay with the song', 409]; return false; }
        if (mine === 0) { err = ['You have no votes on that one', 409]; return false; }
        me.v = me.v.filter((x) => x !== song);
        delete me.ts[song];
        want = 0;
        outcome = { voted: false, removed: mine };
        if (castId) { me.casts.push({ id: castId, at: Date.now(), out: outcome }); me.casts = me.casts.slice(-CASTS_KEPT); }
        return true;
      }
      // casting is where the setlist applies — see the note above
      if (!offered) { err = ['That one isn’t on tonight’s list', 404]; return false; }
      const free = isUnlimited(fan, show);
      const total = show.freeCredits + (me.extra || 0);
      const need = cost * n;
      if (!free && creditsUsed(me, show) + need > total) { err = ['no-credits', 402]; return false; }
      for (let i = 0; i < n; i++) me.v.push(song);
      me.ts[song] ||= Date.now();          // keep the first stamp: ties are broken by it
      want = mine + n;
      outcome = { voted: true, votes: n, cost: need,
                  remaining: free ? null : Math.max(0, total - creditsUsed(me, show)) };
      if (castId) { me.casts.push({ id: castId, at: Date.now(), out: outcome }); me.casts = me.casts.slice(-CASTS_KEPT); }
      return true;
    },
    // read back after writing: if the votes didn't stick, retry
    (me) => want === null || held(me) === want);
  } catch { return bad('busy', 503); }

  if (err) return bad(err[0], err[1]);
  return json({ ok: true, final, ...outcome });
};
