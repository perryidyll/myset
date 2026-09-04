import { getShow, mutateShow, readFans, carryFans, releaseUnvotable, newShowId, gigMonthOf,
         playable } from './_lib.mjs';
import { readLists, applyList } from './_lists.mjs';
import { archiveShow } from './_history.mjs';
import { readEvents, nextOccurrence } from './_events.mjs';
import { planForArtist, isPlatformOwner } from './_plan.mjs';

/* STARTING AND ENDING A SHOW — the one implementation.

   These two used to be cases inside admin.mjs's big CAS switch, reachable only
   through a signed-in request. The moment a show could also start ITSELF (a gig on
   the calendar reaching its start time — `_auto.mjs`) there had to be a door with
   no request behind it, and the choice was between two copies of the most
   sacred path in the app or one. This is the one. admin.mjs's `newShow` and
   `status` actions call in here; the scheduler calls in here; nothing else
   flips `show.status`.

   What must survive, in the order it happens (every line is an invariant):
     · the gig cap is checked BEFORE anything changes and counted INSIDE the CAS
       (9d9, 0bi) — refused with the same words the Studio and the tests know
     · a night is archived BEFORE anything wipes its tally (17c) and the archive can
       never block the show (16)
     · tonight's setlist is resolved from the calendar before, applied after (0bg)
     · a fresh show wipes fans but carries their unspent paid votes (13b)
     · the founder is never capped, and a show that is already live is a no-op
       rather than a second gig on the counter */

/** Exactly how a night is counted against the free plan. Called INSIDE a CAS
 *  callback, so a retry recomputes rather than double-counts (INVARIANT 0bi). */
export function countGig(sh) {
  const m = gigMonthOf();
  if (sh.gigMonth !== m) { sh.gigMonth = m; sh.gigCount = 0; }
  sh.gigCount += 1;
}

export const CAP_REFUSAL = (cap) =>
  `That's your ${cap} free shows this month. Upgrade to keep playing — your allowance resets on the 1st.`;

/** The free plan's cap for this artist, or null when there is none. */
export async function gigCapFor(aid) {
  const lim = (await planForArtist(aid)).limits.gigs;
  return (isPlatformOwner(aid) || lim === Infinity || lim === undefined) ? null : lim;
}

/* Votes stranded on songs the room can no longer choose go back to the room.
   `before` is the playable set before a change; null means "sweep regardless" —
   the way ending or resuming a show has always behaved. Never throws: the change
   that called it already succeeded. */
export async function releaseNote(aid, before) {
  try {
    const after = await getShow(aid);
    if (before) {
      const now = new Set(playable(after).songs.map((x) => x.id));
      if (![...before].some((id) => !now.has(id))) return null;
    }
    const freed = await releaseUnvotable(aid, after);
    if (!freed.length) return null;
    const titles = freed.map((id) => (after.songs.find((x) => x.id === id) || {}).title)
      .filter(Boolean).slice(0, 3);
    return titles.length
      ? `Votes on ${titles.join(', ')} went back to the room.`
      : 'Votes on the songs you took out went back to the room.';
  } catch { return null; }
}

/* Going live picks up the setlist the artist chose for tonight's gig, if they
   chose one. A gig's `listId` has three states: '' no opinion, 'all' clear the
   pick, <id> that setlist — and a deleted setlist is reported, never silently
   blanked. Resolved before the mutation (it needs the calendar), applied after
   (applyList writes the show record itself). */
async function resolveAutoList(aid, now) {
  const out = { listId: null, note: null };
  try {
    const occ = nextOccurrence(await readEvents(aid), now);
    // only a gig that is on now or within the next few hours — not next Tuesday's
    if (occ && occ.listId && occ.startsAt - now < 6 * 3600e3) out.listId = occ.listId;
    if (out.listId && out.listId !== 'all'
        && !(await readLists(aid)).lists.some((l) => l.id === out.listId)) {
      out.listId = null;
      out.note = 'Tonight’s gig points at a setlist you’ve deleted, so nothing changed.';
    }
  } catch { /* never block starting a show on the calendar */ }
  return out;
}

/**
 * Start a show.
 *   fresh   true  = a NEW night: played[] and the log reset, a new showId, fans wiped
 *                   with their paid votes carried (what "New show" does)
 *           false = RESUME: only the status flips, everything else stays (what
 *                   "Start the show" / "Resume it instead" does). The server cannot
 *                   tell a new night from an accidental End, so the caller decides.
 *   by      'artist' | 'schedule' — stamped on the show so the Studio can say so
 *   occKey  when the schedule starts it: which occurrence, so the same gig is
 *           never started twice and a night the artist ended is left ended
 * Returns { ok, err:[message, status]|null, note, already }.
 */
export async function startShow(aid, { fresh = false, by = 'artist', occKey = null, eventId = null } = {}) {
  const now = Date.now();
  const gigCap = await gigCapFor(aid);

  // A finished show must be snapshotted BEFORE anything wipes the tally —
  // carryFans() destroys the only copy.
  if (fresh) {
    try {
      const [prev, fans] = await Promise.all([getShow(aid), readFans(aid)]);
      await archiveShow(aid, prev, fans);
    } catch { /* never block starting a show on the archive */ }
  }

  const auto = await resolveAutoList(aid, now);
  let note = auto.note;
  const freshId = fresh ? newShowId() : null;            // outside the CAS
  const prevShow = fresh ? await getShow(aid) : null;    // read before it resets

  let err = null, already = false;
  await mutateShow(aid, (show) => {
    if (!fresh && show.status === 'live') { already = true; return false; }
    const used = show.gigMonth === gigMonthOf() ? show.gigCount : 0;
    if (gigCap !== null && used >= gigCap) { err = [CAP_REFUSAL(gigCap), 402]; return false; }
    countGig(show);
    if (fresh) {
      show.played = []; show.nowPlaying = null; show.nowPlayingAt = null;
      show.log = [];
      show.showId = freshId;
      show.startedAt = now;
      show.windowOpen = true;
    }
    show.status = 'live';
    show.startedBy = by;
    show.endedBy = null;
    if (occKey) show.autoKey = occKey;
    if (eventId) show.autoEvent = eventId;
    return true;
  });
  if (err) return { ok: false, err, note: null, already: false };
  /* Already live is not an error and not a gig — but the calendar's setlist is
     still applied and stranded votes still swept, exactly as a second tap on
     "Start the show" has always behaved. The test suite leans on that. */

  if (auto.listId) {
    try {
      const r = await applyList(aid, auto.listId);
      note = r.listName
        ? `Playing your “${r.listName}” tonight — ${r.count} songs.`
        : 'Playing all your songs tonight — that’s what this gig says.';
    } catch { /* the show is live either way */ }
  }
  // paid votes survive a reset — only a fan who gifted them loses them
  if (fresh) await carryFans(aid, prevShow || (await getShow(aid)));
  // a resume sweeps for stranded votes, as it always has
  else note = joinNote(note, await releaseNote(aid, null));
  return { ok: true, err: null, note, already };
}

/**
 * End a show. Archives first, always; idempotent (ending an ended show refreshes
 * the archive and changes nothing else). `by` is stamped for the Studio.
 */
export async function endShow(aid, { by = 'artist' } = {}) {
  try {
    const [prev, fans] = await Promise.all([getShow(aid), readFans(aid)]);
    await archiveShow(aid, prev, fans);
  } catch { /* never block ending a show on the archive */ }
  await mutateShow(aid, (show) => {
    show.status = 'ended';
    show.endedBy = by;
    show.endedAt = Date.now();
    return true;
  });
  const note = await releaseNote(aid, null);
  return { ok: true, err: null, note };
}

const joinNote = (note, warn) => (warn ? (note ? `${note} ${warn}` : warn) : note);
