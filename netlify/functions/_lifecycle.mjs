import { getShow, mutateShow, readFans, carryFans, newShowId, gigMonthOf, casDoc } from './_lib.mjs';
import { readLists, applyList } from './_lists.mjs';
import { archiveShow } from './_history.mjs';
import { readEvents, nextOccurrence } from './_events.mjs';
import { planForArtist, isPlatformOwner } from './_plan.mjs';

const AUTO_INDEX = 'gigsched';
const markLive = (aid, at = Date.now()) => casDoc(AUTO_INDEX,
  () => ({ v: 1, byArtist: {}, live: {} }), (d) => { d.live ||= {}; d.live[aid] = at; return true; }).catch(() => {});
const unmarkLive = (aid) => casDoc(AUTO_INDEX,
  () => ({ v: 1, byArtist: {}, live: {} }), (d) => { d.live ||= {}; delete d.live[aid]; return true; }).catch(() => {});

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

/** How many phones this artist's room holds tonight. null means no ceiling.

    Read ONCE, when the show starts, and stamped onto the show — see startShow.
    The polling path must never look this up: it would add a blob read to the one
    request MySet makes millions of, to answer a question that cannot change
    during a gig. Stamping it also means an artist who upgrades mid-set does not
    have the room silently change size underneath them; it applies from the next
    show, which is the predictable behaviour. */
export async function roomCapFor(aid) {
  const lim = (await planForArtist(aid)).limits.audience;
  return (isPlatformOwner(aid) || lim === Infinity || lim === undefined || !(lim > 0))
    ? null : lim;
}

/* Going live picks up the setlist the artist chose for tonight's gig, if they
   chose one. A gig's `listId` has three states: '' no opinion, 'all' clear the
   pick, <id> that setlist — and a deleted setlist is reported, never silently
   blanked. Resolved before the mutation (it needs the calendar), applied after
   (applyList writes the show record itself).

   AND THE PLACE. `show.venue` is one field, set once in Settings, and every night
   that gets filed copies whatever it says — so an artist who plays three venues a
   week ends up with a history where every show happened at the first one they ever
   typed in. Perry's did: five filed nights, three different venues on the
   calendar, one name on all five. The calendar already knows where tonight is, and
   it is the same occurrence this function is already holding. */
async function resolveTonight(aid, now) {
  const out = { listId: null, note: null, venue: '', city: '' };
  try {
    const occ = nextOccurrence(await readEvents(aid), now);
    // only a gig that is on now or within the next few hours — not next Tuesday's
    if (occ && occ.startsAt - now < 6 * 3600e3) {
      if (occ.listId) out.listId = occ.listId;
      /* The city too, because they travel together: a night filed with the right
         venue and the wrong city is no better than before. Only ever taken from a
         gig that is on now or within a few hours — never from next Tuesday's. */
      if (occ.venue) { out.venue = occ.venue; out.city = [occ.city, occ.country].filter(Boolean).join(', '); }
    }
    if (out.listId && out.listId !== 'all'
        && !(await readLists(aid)).lists.some((l) => l.id === out.listId)) {
      out.listId = null;
      out.note = 'Tonight’s gig points at a setlist you’ve deleted, so nothing changed.';
    }
  } catch { /* never block starting a show on the calendar */ }
  return out;
}

/* `releaseNote` lived here: votes stranded on songs the room could no longer
   choose went back to the room, and ending or resuming a show swept for them.
   Deleted 2026-09-07. A vote is spent when it is cast and stays with its song until
   that song is played or the night ends — see the ledger header in _lib.mjs. There
   is nothing left to sweep and nothing left to announce. */

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
  const [gigCap, roomCap] = await Promise.all([gigCapFor(aid), roomCapFor(aid)]);

  // A finished show must be snapshotted BEFORE anything wipes the tally —
  // carryFans() destroys the only copy.
  if (fresh) {
    try {
      const { completeSongRequests, cancelOpenPledges } = await import('./_requests.mjs');
      await completeSongRequests(aid, '');
      await cancelOpenPledges(aid);
    } catch { /* an expiring authorization must never block a new show */ }
    try {
      const [prev, fans] = await Promise.all([getShow(aid), readFans(aid)]);
      await archiveShow(aid, prev, fans);
    } catch { /* never block starting a show on the archive */ }
  }

  const auto = await resolveTonight(aid, now);
  let note = auto.note;
  const freshId = fresh ? newShowId() : null;            // outside the CAS
  const prevShow = fresh ? await getShow(aid) : null;    // read before it resets

  let err = null, already = false, placed = null;
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
      /* Only on a fresh night, and only when the calendar actually has one. A
         RESUME must not relabel a night that is already under way, and an artist
         with an empty calendar keeps exactly what they typed in Settings. */
      if (auto.venue && auto.venue !== show.venue) {
        placed = [show.venue, auto.venue];
        show.venue = auto.venue;
        if (auto.city) show.city = auto.city;
      }
    }
    /* Tonight's ceiling, fixed for the night. A show started before room caps
       existed has no `roomCap` and is uncapped — nothing that is already running
       changes size underneath the people standing in it. Every show from here on
       carries its number. */
    show.roomCap = roomCap;
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

  /* Said out loud rather than done silently. Changing the name on a night without
     telling anyone is how an artist stops trusting the numbers underneath it. */
  if (placed) note = joinNote(note, `Filed under ${placed[1]} — that’s tonight’s gig on your calendar.`);

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
  await markLive(aid, now);
  return { ok: true, err: null, note, already };
}

/**
 * End a show. Archives first, always; idempotent (ending an ended show refreshes
 * the archive and changes nothing else). `by` is stamped for the Studio.
 */
export async function endShow(aid, { by = 'artist', title = '', discard = false } = {}) {
  /* Ending the night is not the same as finishing the current song. Anything the
     artist never explicitly completed is released, never charged. */
  try {
    const { completeSongRequests, cancelOpenPledges } = await import('./_requests.mjs');
    await completeSongRequests(aid, '');
    await cancelOpenPledges(aid);
  } catch { /* Stripe will release an uncaptured authorization at expiry */ }
  if (!discard) try {
    const [prev, fans] = await Promise.all([getShow(aid), readFans(aid)]);
    const fallback = `Untitled show – ${new Date().toISOString().slice(0, 10)}`;
    await archiveShow(aid, { ...prev, archiveTitle: String(title || fallback).slice(0, 100) }, fans);
  } catch { /* never block ending a show on the archive */ }
  await mutateShow(aid, (show) => {
    show.status = 'ended';
    show.endedBy = by;
    show.endedAt = Date.now();
    return true;
  });
  await unmarkLive(aid);
  return { ok: true, err: null, note: null };
}

const joinNote = (note, warn) => (warn ? (note ? `${note} ${warn}` : warn) : note);
