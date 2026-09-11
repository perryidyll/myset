import { guard, logErr } from './_errlog.mjs';
import { getShow, mutateFan, creditsUsed, chargeVotes, takeCastToken, costOf, isUnlimited, publicArtist, json, bad,
         cleanFanId, votable, roomHash, clientIp } from './_lib.mjs';

/* A FAN CANNOT REVERSE A VOTE. It stays on the song it was cast for until that
   song is played or the night ends. The artist's explicit decline/refund action is
   the only setlist exception — see the ledger header in _lib.mjs. This used to be
   the `voteFinal` feature flag, with a working take-it-back path; the flag and path were
   both deleted on 2026-09-07 when the question stopped having two answers. */

const main = async (req) => {
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
     mechanism INVARIANT 15's refund quietly WAS. There is no toggle to correct
     anything any more, so without an id a dropped response on bar wifi
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

  /* A page cached from before finality still sends `op:'clear'` when somebody taps
     a song they already hold votes on. It is answered honestly rather than ignored
     — silently treating it as a fresh cast would charge them again for a tap that
     meant the opposite. */
  const op = body.op === 'cast' || body.op === 'clear' ? body.op : '';

  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const show = await getShow(aid);
  if (show.status === 'ended') return bad('The show has ended', 409);
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
      /* THERE IS DELIBERATELY NO HEAD-COUNT CHECK HERE, and that is a decision,
         not an omission. A room that is over its plan's size does not stop taking
         votes: it slows down and shows a shorter board (see show.mjs), and the
         artist is told afterwards. Nobody standing in front of a musician is ever
         told the gig is full.

         This is the market's own answer, not an invention. Mentimeter — the closest
         comparable product — publishes it as policy: participants may exceed the
         limit during a live session without interruption, with an 8-hour grace
         period, and the cap bites on the NEXT one. A mid-song lockout costs the
         artist relationship, which is the whole business; one oversized night costs
         cents. */
      /* Already done this exact cast: hand back what it returned the first time
         and write NOTHING. Checked inside the mutation so two racing retries cannot
         both get past it. */
      me.casts ||= [];
      if (castId) {
        const prior = me.casts.find((c) => c && c.id === castId);
        if (prior) { outcome = { ...(prior.out || {}), replay: true }; replayed = true; return false; }
      }

      const mine = held(me);
      /* There is no way back. An old page asking for one is told why, in the words
         a person can act on, rather than being quietly charged again. */
      if (op === 'clear') { err = ['Those votes are cast — they stay with the song', 409]; return false; }
      // casting is where the setlist applies — see the note above
      if (!offered) { err = ['That one isn’t on tonight’s list', 404]; return false; }
      const free = isUnlimited(fan, show);
      const total = show.freeCredits + (me.extra || 0);
      const need = cost * n;
      if (!free && creditsUsed(me, show) + need > total) { err = ['no-credits', 402]; return false; }
      /* After the credit check on purpose: a fan who is out of votes keeps hearing
         that, and only casts that would have LANDED spend a token. */
      if (!takeCastToken(me)) { err = ['Easy — that’s a lot of taps. Give it a few seconds', 429]; return false; }
      /* Charged HERE, at the cast, and never again. The old code deliberately did
         not do this — it settled the paid portion once, at the round reset, because
         un-voting would otherwise have burned a paid vote. With no un-vote and no
         round reset, the moment of the cast is the only honest moment left. */
      /* An unlimited device is charged NOTHING but still has its ledger stamped, so
         `used` stays the honest number if the artist turns unlimited off mid-show —
         otherwise their spend would fall back to being counted out of `v` and the
         votes they were given free would start costing them. */
      chargeVotes(me, show, song, cost, n, free);
      me.lastAt = Date.now();
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
  } catch (e) { await logErr('vote', e, { aid, fan }); return bad('busy', 503); }

  if (err) return bad(err[0], err[1]);
  /* `at` is the server's clock. The voting page compares it with the render time
     stamped on a shared board (which may be served from cache) to know whether a
     board it is holding predates this cast — see mergeBoard in public/vote.html. */
  return json({ ok: true, final: true, at: Date.now(), ...outcome });
};
export default guard('vote', main);
