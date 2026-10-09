import { getShow, mutateShow, readFans, readMeta, carryFans, newShowId, casDoc, mutateMeta, voteCounts, readDoc, KEY, sameNightResume, tipGone, netOf } from './_lib.mjs';
import { readLists, applyList } from './_lists.mjs';
import { archiveShow } from './_history.mjs';
import { readEvents, nextOccurrence, occKey, isVenueOwner } from './_events.mjs';
import { planForArtist, isPlatformOwner } from './_plan.mjs';

const AUTO_INDEX = 'gigsched';
/* ONE LIVE MARK PER ARTIST (decision 0154, INVARIANT 0ij). Every Start and every End
   used to write this one global document — the bell's `live` list for the idle sweep,
   and the register's `regdirty` mark (decision 0095) — in a CAS whose failure was
   swallowed. A thousand starts around the top of the hour all wrote it, and so does
   the bell's own lock and sweep: forty tries each, then nothing, and a live show the
   idle sweep would never find. Now the live mark is the artist's own show record —
   `status`, `startedAt`, `endedAt`, written in the same CAS as the flip, so it cannot
   be lost on its own — and no start or end writes a global document. `walkLive`
   (below) finds who is live by a computed route, the artist registry and one show
   record each, and folds what it saw into `live` and `regdirty` in one write a ring.
   The first-night note (below) still lands here: once per account, ever. */
/* THE MORNING AFTER THE FIRST NIGHT (2026-09-15). One note, once per account, the
   morning after the first night that was filed: what the room did and what it
   paid, and the one next step. Queued here — the only place a night is filed —
   and sent by the bell (_auto.mjs sweepNotes) when it falls due: ten hours after
   the end, which is the morning for any set that ends at night, and never inside
   the same evening. A note is a row on the same index the bell already reads, so
   it costs nothing to look for (INVARIANT 1: no list()). */
export const FIRST_NIGHT_NOTE_MS = 10 * 3600e3;
const queueFirstNightNote = (aid, showId, endedAt) => casDoc(AUTO_INDEX,
  () => ({ v: 1, byArtist: {}, live: {} }), (d) => {
    d.notes ||= {};
    if (d.notes[aid] || (d.noted || {})[aid]) return false;     // once, ever
    d.notes[aid] = { showId, due: endedAt + FIRST_NIGHT_NOTE_MS, at: endedAt };
    return true;
  }).catch(() => {});

/* THE LIVE WALK (decision 0154). Run at the top of the register's bell
   (`registercron.mjs`, every ten minutes): up to LIVE_WALK show records a ring,
   LIVE_WALK_POOL at a time, round the artist registry from `liveCursor`, until
   `deadline`. What it saw goes where the readers already look:
     · `live[aid]` — the idle sweep's list (`_auto.mjs sweepIdle`). A live show is put
       on it with its last sign of life (its start or its last write), and that is only
       ever moved forward; a show seen not live is taken off.
     · `regdirty[aid]` — the register's mark: set when the night changed since the walk
       last looked (`liveSeen[aid]`: its status, start and end), so the fold in the same
       ring files it. On the first lap every artist with a night is marked once.
   ONE write, and only when something changed. A show record that cannot be read is
   left as it was and looked at again next lap. Not 0140's `on` mark: that is the
   calendar index saying tonight's start is settled, and it stays after the artist
   ends the show; a hand-started show has no calendar entry to carry it.
   Cost, written down: the registry, this index and one show record per artist walked;
   at most one write. The registry is covered every ring up to LIVE_WALK artists, and
   in LIVE_WALK-sized steps beyond — a show is found at most one lap after it starts. */
export const LIVE_WALK = 300;
export const LIVE_WALK_MS = 2000;
const LIVE_WALK_POOL = 8;
const liveSig = (s) => (s && s.startedAt ? `${s.status === 'live' ? 'L' : 'E'}${s.startedAt}.${s.endedAt || 0}` : '');
export async function walkLive({ now = Date.now(), limit = LIVE_WALK, deadline = Infinity } = {}) {
  const { readArtists } = await import('./_auth.mjs');
  const [reg, idx] = await Promise.all([readArtists(), readDoc(AUTO_INDEX, null)]);
  const ids = Object.keys(reg.byId || {}).filter((id) => !isVenueOwner(id)).sort();
  const from = ids.length ? (Number((idx.data || {}).liveCursor) || 0) % ids.length : 0;
  const order = ids.slice(from).concat(ids.slice(0, from)).slice(0, Math.max(1, limit));
  const seen = {};
  let taken = 0;
  const worker = async () => {
    while (taken < order.length) {
      if (taken > 0 && Date.now() > deadline) return;
      const aid = order[taken++];
      try {
        const { data: s } = await readDoc(KEY.show(aid), null);
        seen[aid] = { live: !!s && s.status === 'live', sig: liveSig(s),
                      last: Math.max(Number(s && s.startedAt) || 0, Number(s && s.updatedAt) || 0) };
      } catch (e) { console.error('live walk: could not read', aid, e && e.message); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIVE_WALK_POOL, order.length) }, worker));
  const next = ids.length ? (from + taken) % ids.length : 0;
  const lap = ids.length > 0 && from + taken >= ids.length;      // round the whole registry: forget who has left
  const known = new Set(ids);
  let added = 0, removed = 0, dirty = 0;
  const fold = (d) => {
    d.live ||= {}; d.regdirty ||= {}; d.liveSeen ||= {};
    added = 0; removed = 0; dirty = 0;
    let touched = false;
    for (const [aid, s] of Object.entries(seen)) {
      if (s.live) {
        if (!(Number(d.live[aid]) >= s.last)) { if (!d.live[aid]) added += 1; d.live[aid] = Math.max(Number(d.live[aid]) || 0, s.last); touched = true; }
      } else if (aid in d.live) { delete d.live[aid]; removed += 1; touched = true; }
      if ((d.liveSeen[aid] || '') !== s.sig) {
        if (s.sig) { d.liveSeen[aid] = s.sig; d.regdirty[aid] = now; dirty += 1; } else delete d.liveSeen[aid];
        touched = true;
      }
    }
    if (lap) for (const aid of Object.keys(d.liveSeen)) if (!known.has(aid)) { delete d.liveSeen[aid]; touched = true; }
    if ((Number(d.liveCursor) || 0) !== next) { d.liveCursor = next; touched = true; }
    return touched;
  };
  // nothing new against the copy already read: no write, and no second read
  if (fold(JSON.parse(JSON.stringify(idx.data || {})))) await casDoc(AUTO_INDEX, () => ({ v: 1, byArtist: {}, live: {} }), fold);
  return { looked: taken, of: ids.length, added, removed, dirty };
}

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

/** Exactly how a night is counted against the free plan: ten in total, ever
 *  (decision 0120). Called INSIDE a CAS callback, after the showId is set, so a
 *  retry recomputes rather than double-counts (INVARIANT 0bi). Only a start on the
 *  free plan counts; a night played on a paid plan never does. */
export function countGig(sh, by = 'artist') {
  sh.gigCount += 1;
  /* `auto` remembers the calendar began this night, so a quiet one can be given back
     (below). A resume keeps what the night already was — and a resume of the same
     night never reaches here at all (0156, `sameNightResume`). */
  sh.freeNight = sh.freeNight && sh.freeNight.id === sh.showId
    ? { ...sh.freeNight, n: sh.freeNight.n + 1 } : { id: sh.showId, n: 1, auto: by === 'schedule' };
}
/** A night the artist DISCARDS gives back what it used (decision 0120): a free show
 *  is one kept, not one tried. Inside the same CAS as the end; idempotent. */
export function uncountGig(sh) {
  if (!sh.freeNight || sh.freeNight.id !== sh.showId) return;
  sh.gigCount = Math.max(0, sh.gigCount - sh.freeNight.n);
  sh.freeNight = null;
}
/** A night the CALENDAR started and nobody voted on is not a free show either
 *  (decision 0120): the artist may never have turned up. Votes are every round's
 *  (the log keeps them; starting a song wipes the board) plus what still stands.
 *  Carried fans hold `extra`, never `v`, so a previous night's votes are not here. */
export function quietAutoNight(sh, fans) {
  if (!sh || !sh.freeNight || !sh.freeNight.auto || sh.freeNight.id !== sh.showId) return false;
  return nightVotes(sh, fans) === 0;
}
/** Every vote the night took: each round's (the log keeps them; starting a song
 *  wipes the board) plus what still stands. */
export function nightVotes(sh, fans) {
  const rounds = (sh.log || []).reduce((a, p) => a + (p.roundVotes ?? p.votes ?? 0), 0);
  return rounds + Object.values(voteCounts(fans || {})).reduce((a, b) => a + b, 0);
}

/* A DISCARD IS FOR A TEST, NOT FOR A REAL NIGHT (decision 0122). Giving a discarded
   night back (0120) is so an artist can try "Start the show" for free — but it would
   also let a free artist play every gig and discard it after, for ever. A night that
   ran over an hour AND took five or more votes is a real night. The FIRST time a free
   artist discards one, it is still given back, and the Studio says that the next one
   will count; after that, a real night discarded counts. Money taken in the night is
   named in the warning, not a trigger of its own: an artist trying their own tip
   button is testing. The founder, 2026-09-29. */
export const REAL_NIGHT = { minutes: 60, votes: 5 };
/** Money the night took, from `meta` (tips and every paid checkout since it began). */
export function nightPaid(meta, since) {
  const rows = [...((meta && meta.tips) || []), ...Object.values((meta && meta.paid) || {})]
    .filter((p) => p && Number(p.at) >= since && !tipGone(p));       // net of refunds (0179)
  return { count: rows.length, total: Math.round(rows.reduce((a, p) => a + netOf(p), 0) * 100) / 100 };
}
/** What discarding this night means on the free plan: null when it is simply given
 *  back (a test, a paid plan, the founder, a night that is not the counted one), else
 *  { outcome: 'warned' | 'counted', minutes, votes, paid }. */
export function discardVerdict(sh, fans, meta, now, gigCap) {
  if (gigCap === null || !sh || !sh.startedAt || !sh.freeNight || sh.freeNight.id !== sh.showId) return null;
  const minutes = Math.floor(((sh.status === 'ended' && sh.endedAt ? sh.endedAt : now) - sh.startedAt) / 60000);
  const votes = nightVotes(sh, fans);
  if (minutes < REAL_NIGHT.minutes || votes < REAL_NIGHT.votes) return null;
  return { outcome: sh.discardWarnedAt ? 'counted' : 'warned', minutes, votes, paid: nightPaid(meta, sh.startedAt) };
}
const DISCARDS_KEPT = 30;

export const CAP_REFUSAL = (cap) =>
  `That's your ${cap} free shows. Upgrade to Bar Star to keep playing — a test show you discard doesn't count.`;

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
  const out = { listId: null, note: null, venue: '', city: '', country: '', tz: '', startsAt: null, eventId: null, key: null };
  try {
    const occ = nextOccurrence(await readEvents(aid), now);
    // only a gig that is on now or within the next few hours — not next Tuesday's
    if (occ && occ.startsAt - now < 6 * 3600e3) {
      out.startsAt = occ.startsAt;
      out.eventId = occ.eventId; out.key = occKey(occ);   // which gig, not just where
      if (occ.listId) out.listId = occ.listId;
      /* The city too, because they travel together: a night filed with the right
         venue and the wrong city is no better than before. Only ever taken from a
         gig that is on now or within a few hours — never from next Tuesday's. */
      if (occ.venue) { out.venue = occ.venue; out.city = [occ.city, occ.country].filter(Boolean).join(', '); }
      /* On their own as well (decision 0095): the register reports nights by country
         and reads the local clock in the gig's zone, and splitting "City, Country"
         back apart is a guess for a city with a comma in it. */
      out.country = occ.country || ''; out.tz = occ.tz || '';
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
 *           (read into `schedKey` below — `occKey` is also the helper imported
 *           from _events.mjs, and a parameter of the same name shadowed it)
 * Returns { ok, err:[message, status]|null, note, already }.
 */
export async function startShow(aid, { fresh = false, by = 'artist', occKey: schedKey = null, eventId = null } = {}) {
  const now = Date.now();
  const [gigCap, roomCap, { plan }] = await Promise.all([gigCapFor(aid), roomCapFor(aid), planForArtist(aid)]);

  // A finished show must be snapshotted BEFORE anything wipes the tally —
  // carryFans() destroys the only copy.
  if (fresh) {
    /* A refund still owed from a "Decline + refund" (0155) is finished BEFORE the fans
       are carried into the new night: after that there is nothing left to give back to.
       Never a reason the start fails — what cannot be finished is said in the log. */
    try {
      const { settleOwedRefunds } = await import('./_requests.mjs');
      const owed = await settleOwedRefunds(aid);
      if (owed.left.length) console.error('startShow: refunds still owed as a new night began', aid, owed.left.join(','));
    } catch { /* the store is failing; the start below will say so if it must */ }
    try {
      const { completeSongRequests, cancelOpenPledges } = await import('./_requests.mjs');
      await completeSongRequests(aid, '');
      await cancelOpenPledges(aid);
    } catch { /* an expiring authorization must never block a new show */ }
    try {
      const [prev, fans] = await Promise.all([getShow(aid), readFans(aid)]);
      // the same bound on pricing as the end (0153): a count cut short is finished later
      await archiveShow(aid, prev, fans, { deadline: Date.now() + moneyAtEndMs() });
    } catch { /* never block starting a show on the archive */ }
  }

  const auto = await resolveTonight(aid, now);
  let note = auto.note;
  const freshId = fresh ? newShowId() : null;            // outside the CAS
  const prevShow = fresh ? await getShow(aid) : null;    // read before it resets
  /* A calendar night left running and replaced by a new one is never ended through
     endShow — so its give-back is decided here, while the fans are still its fans. */
  const prevQuiet = fresh && prevShow ? quietAutoNight(prevShow, await readFans(aid).catch(() => null)) : false;

  let err = null, already = false, placed = null;
  await mutateShow(aid, (show) => {
    if (!fresh && show.status === 'live') { already = true; return false; }
    /* AN ACCIDENTAL END CAN BE UNDONE AT THE CAP (decision 0156, INVARIANT 0il). A
       resume of the night already counted, started less than twelve hours ago, is the
       same night: it is not refused and not counted again. Anything else — a new show,
       a resume of an older night or of one given back — meets the cap exactly as before. */
    const sameNight = !fresh && sameNightResume(show, now);
    if (fresh && prevQuiet && prevShow.showId === show.showId) uncountGig(show);
    if (gigCap !== null && !sameNight && show.gigCount >= gigCap) { err = [CAP_REFUSAL(gigCap), 402]; return false; }
    if (fresh) {
      show.played = []; show.nowPlaying = null; show.nowPlayingAt = null;
      delete show.refundsOwed;          // last night's, finished above or past finishing (0155)
      show.log = [];
      show.col = {};                 // last night's marks; `plays` itself only ever counts up (0147)
      show.showId = freshId;
      show.startedAt = now;
      show.windowOpen = true;
      /* Only on a fresh night, and only when the calendar actually has one. A
         RESUME must not relabel a night that is already under way, and an artist
         with an empty calendar keeps exactly what they typed in Settings. */
      const nearManualGig = by === 'artist' && auto.startsAt !== null && auto.startsAt - now <= 3600e3;
      if (fresh && by === 'artist' && !nearManualGig) { show.venue = ''; show.city = ''; show.country = ''; show.tz = ''; }
      /* The plan the night is played on, frozen on the record (0095): the room-money
         figures by tier would otherwise relabel every past night on the first
         upgrade or lapse. planForArtist was read above for the caps. */
      show.plan = plan;
      if (auto.venue && (by === 'schedule' || nearManualGig) && auto.venue !== show.venue) {
        placed = [show.venue, auto.venue];
        show.venue = auto.venue;
        if (auto.city) show.city = auto.city;
      }
      // the gig's country and zone ride along whenever the night is that gig (0095)
      if (auto.key && (by === 'schedule' || nearManualGig)) { show.country = auto.country || ''; show.tz = auto.tz || ''; }
      /* WHICH GIG THIS NIGHT IS. The scheduler has always stamped its occurrence
         key (below); a hand start never did — and never CLEARED the last one, so
         after one scheduled night every later hand-started night carried the
         previous gig's id for good (normShow spreads stored fields forward). The
         filed night now copies this key (0065), so it has to be right: a hand
         start near tonight's gig is that gig, and a hand start near nothing is
         nobody's. The scheduler's own outcomes do not change — it compares the
         key against tonight's, and a stale key never matched that either. */
      if (by === 'artist') {
        show.autoKey = nearManualGig ? auto.key : null;
        show.autoEvent = nearManualGig ? auto.eventId : null;
      }
    }
    /* Tonight's ceiling, fixed for the night. A show started before room caps
       existed has no `roomCap` and is uncapped — nothing that is already running
       changes size underneath the people standing in it. Every show from here on
       carries its number. */
    show.roomCap = roomCap;
    if (gigCap !== null && !sameNight) countGig(show, by);   // after the fresh showId, so the night it names is this one
    show.status = 'live';
    show.startedBy = by;
    show.endedBy = null;
    if (schedKey) show.autoKey = schedKey;
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
  // no global write: the show record above is the live mark, and the live walk finds it (0154)
  return { ok: true, err: null, note, already };
}

/* HOW LONG THE END MAY SPEND PRICING THE NIGHT (decision 0153). The room has already
   stopped by then; this only bounds how long the tap (or the bell's ring) waits for
   Stripe. A count it cuts short is filed as 'stripe-partial' and finished later
   (`priceNight`). Read per call so the suite can shorten it; production never sets it. */
const moneyAtEndMs = () => Number(process.env.MYSET_MONEY_AT_END_MS ?? 3000);

/**
 * End a show. The room stops first, then the night is filed; idempotent (ending an
 * ended show refreshes the archive and changes nothing else). `by` is stamped for
 * the Studio.
 */
export async function endShow(aid, { by = 'artist', title = '', discard = false, ack = '' } = {}) {
  /* A discard of a real night is asked about FIRST, before anything is released or
     ended: the Studio shows what it means and sends `ack` with the outcome it showed.
     An ack that no longer matches (the night changed underneath) asks again. */
  let verdict = null, gigCap = null, hadNight = false;
  if (discard) {
    gigCap = await gigCapFor(aid);
    if (gigCap !== null) {
      const [sh, fans, meta] = await Promise.all([getShow(aid), readFans(aid), readMeta(aid)]);
      verdict = discardVerdict(sh, fans, meta, Date.now(), gigCap);
      if (verdict && ack !== verdict.outcome)
        return { ok: false, err: ['This was a real show. Check what discarding it means first.', 409], confirm: { ...verdict, cap: gigCap, used: sh.gigCount }, note: null };
    }
  }
  /* THE ROOM STOPS FIRST, THEN THE NIGHT IS FILED (decision 0153, INVARIANT 0ii). This
     released the request holds and priced the whole night from Stripe — up to ten
     pages — BEFORE the show was flipped to ended: a slow Stripe kept the room voting
     after the artist had tapped End, and a tap that ran out of time ended nothing.
     The flip is now the first write. Ending wipes no tally (only a fresh start does,
     17c), so the archive below still files the whole night, and it reads the fans
     AFTER the flip, when no more votes can land. Whether a calendar night was quiet
     (0120) is still decided before the flip, because the flip gives it back. */
  let quiet = false;
  if (!discard) try {
    const prev = await getShow(aid);
    // quietAutoNight only ever says yes for a night the calendar began, so only that one needs the fans
    if (prev.freeNight && prev.freeNight.auto && prev.freeNight.id === prev.showId) quiet = quietAutoNight(prev, await readFans(aid));
  } catch { /* the end goes ahead, as it always did when this read failed */ }
  const flipped = await mutateShow(aid, (show) => {
    hadNight = !!(show.freeNight && show.freeNight.id === show.showId);
    if (quiet || (discard && (!verdict || verdict.outcome === 'warned'))) uncountGig(show);
    if (discard && verdict && verdict.outcome === 'warned') show.discardWarnedAt = Date.now();
    // a counted discard is settled: the night keeps its count and has nothing left to give back
    if (discard && verdict && verdict.outcome === 'counted' && hadNight) show.freeNight = null;
    show.status = 'ended';
    show.endedBy = by;
    show.endedAt = Date.now();
    return true;
  });
  const ended = flipped && flipped.data;
  /* Every free-plan discard is written down (0122), so a pattern shows on the Sheet's
     Discards tab: when, how long, how many votes, what it took, and what happened. */
  if (discard && gigCap !== null && hadNight) {
    await mutateMeta(aid, (m) => {
      m.discards = [...(m.discards || []), { at: Date.now(), outcome: verdict ? verdict.outcome : 'given',
        minutes: verdict ? verdict.minutes : null, votes: verdict ? verdict.votes : null,
        paid: verdict ? verdict.paid.total : null }].slice(-DISCARDS_KEPT);
      return true;
    }).catch(() => {});
  }
  /* A refund still owed from a "Decline + refund" (0155) is finished here, while the
     night's fans are still the night's; what cannot be finished stays owed for the
     Studio and the next fresh start. */
  try {
    const { settleOwedRefunds } = await import('./_requests.mjs');
    await settleOwedRefunds(aid);
  } catch { /* still owed; nothing about ending waits on it */ }
  /* Ending the night is not the same as finishing the current song. Anything the
     artist never explicitly completed is released, never charged. After the flip, so
     no new hold can arrive (a request needs a live show), and before the archive, so
     a hold captured here is in the night's money. */
  try {
    const { completeSongRequests, cancelOpenPledges } = await import('./_requests.mjs');
    await completeSongRequests(aid, '');
    await cancelOpenPledges(aid);
  } catch { /* Stripe will release an uncaptured authorization at expiry */ }
  if (!discard && ended) try {
    const fans = await readFans(aid);
    const fallback = `Untitled show – ${new Date().toISOString().slice(0, 10)}`;
    // the record already says who ended it (0095): the flip above wrote `endedBy`
    const filed = await archiveShow(aid, { ...ended, archiveTitle: String(title || fallback).slice(0, 100) }, fans,
      { deadline: Date.now() + moneyAtEndMs() });
    /* The first night on file gets the morning-after note. archiveShow returns
       the index it wrote; one row means this was the first. */
    if (filed && filed.indexed) {
      /* The count rides on meta so the stage payload can say "first gig" for free. */
      await mutateMeta(aid, (m) => { if (m.nights === filed.nights) return false; m.nights = filed.nights; return true; }).catch(() => {});
      if (filed.nights === 1) await queueFirstNightNote(aid, ended.showId, Date.now());
    }
  } catch { /* never block ending a show on the archive: it is ended already, and a fresh start files it (17c) */ }
  const note = verdict && verdict.outcome === 'counted' ? `Discarded — it still counts as one of your ${gigCap} free shows.` : null;
  return { ok: true, err: null, note };
}

const joinNote = (note, warn) => (warn ? (note ? `${note} ${warn}` : warn) : note);
