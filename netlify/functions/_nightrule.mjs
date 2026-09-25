import { normEvent, expand } from './_events.mjs';
import { utcToDate, localDate, localTime } from './_time.mjs';

/* WHICH NIGHTS COUNT — the one rule (decision 0095, INVARIANT 0gi).

   Three places used to decide whether a filed night was a real gig: the stats page
   and the Google Sheet (`_metrics.mjs`: on a published gig and something happened),
   the tracker (`tools/actuals.py`: the same, plus the fences it learned from real
   records — a load test, a demo, a show that never ended) and, nearly, a third for
   the register. The same night would have been "real: yes" on the Sheet and "not
   counted" on the dashboard. So the rule lives HERE, once; `_metrics.mjs` re-exports
   it, the Sheet and the register call it, and `test/everyshow.mjs` pins it against
   the Python on a snapshot of production.

   THE RULE, in the order the checks are made (the first that fits is the reason):
     · nobody there — no phones and no votes
     · no start or end time on record
     · ended before it started — a broken record
     · not on the published calendar (when the artist has one) — a show is that gig
       when it started on the gig's day no earlier than EARLY_MS before the slot and
       no later than the slot's end (placeNight)
     · one phone and no votes — UNUSED when it lines up with a gig (the room never
       used the app), otherwise a test
     · LOADTEST_PHONES or more phones ALL on one network and over inside MIN_NIGHT_H
       — one machine, not a room (31/44/26 "people" on 31 Aug 2026 were exactly this)
     · shorter than MIN_NIGHT_H — a test or a demo
     · longer than MAX_NIGHT_H with no gig — a show that failed to end itself
   Everything else is COUNTED. Nothing is dropped: a refused night keeps its reason. */

export const EARLY_MS = 90 * 60e3;        // a show started this long before the gig's start is still that gig
export const MIN_NIGHT_H = 0.5;
export const MAX_NIGHT_H = 12;
export const LOADTEST_PHONES = 10;

/** The calendar occurrences that could own a night, over the nights' own span. */
export function occurrences(rules, fromMs, toMs) {
  const from = utcToDate(fromMs - 2 * 86400e3), to = utcToDate(toMs + 2 * 86400e3);
  const out = [];
  for (const raw of rules || []) {
    let ev; try { ev = normEvent(raw); } catch { continue; }
    if (!ev || !ev.date) continue;
    for (const o of expand(ev, from, to)) out.push(o);
  }
  return out;
}

/** The occurrence a night belongs to, or null — the closest start among those whose window holds it. */
export function placeNight(night, occs) {
  const t = Number(night.startedAt) || 0;
  let best = null;
  for (const o of occs) {
    if (t < o.startsAt - EARLY_MS || t > o.endsAt) continue;
    if (!best || Math.abs(o.startsAt - t) < Math.abs(best.startsAt - t)) best = o;
  }
  return best ? { eventId: best.eventId, date: best.date, venue: best.venue || '', startsAt: best.startsAt, endsAt: best.endsAt } : null;
}

/** "Something happened": kept for callers that only want that half of the rule. */
export const happened = (n) => (n.songsPlayed || 0) > 0 || (n.totalVotes || 0) > 0 || (n.room || 0) >= 2;

/**
 * Judge one filed night. Takes the numbers a history index row already carries.
 *   people      phones in the room (the room count, or the peak voter count for nights filed before it existed)
 *   votes       the night's total votes
 *   startedAt, endedAt   ms
 *   nets        distinct networks the phones came in on (null when unknown)
 *   gig         the occurrence placeNight found, or null
 *   hasCalendar whether the artist has any published gig at all
 *   tz          the zone to say a local time in (the gig's, or the calendar's)
 * Returns { status: 'counted' | 'unused' | 'refused', why: string | null }.
 */
export function judgeNight({ people, votes, startedAt, endedAt, nets, gig, hasCalendar, tz = 'UTC' }) {
  const p = Number(people) || 0, v = Number(votes) || 0;
  const s0 = Number(startedAt) || 0, e0 = Number(endedAt) || 0;
  const recordHours = s0 && e0 && e0 > s0 ? (e0 - s0) / 3600e3 : null;
  let why = null;
  if (!p && !v) why = 'nobody there';
  else if (!(s0 && e0)) why = 'no start or end time on record';
  else if (e0 <= s0) why = 'ended before it started — a broken record';
  else if (hasCalendar && !gig) why = `not on the published calendar — started ${localDate(s0, tz)} ${localTime(s0, tz)} local, no gig within ${EARLY_MS / 60000} min; a test or an accident`;
  else if (p <= 1 && !v) why = 'one phone and no votes — ' + (gig ? 'on the calendar, but the room never used the app' : 'a test');
  else if (nets === 1 && p >= LOADTEST_PHONES && recordHours < MIN_NIGHT_H) why = `${p} phones all on one network and over in ${Math.round(recordHours * 60)} minutes — a load test from one machine, not a room`;
  else if (recordHours < MIN_NIGHT_H) why = 'shorter than 30 minutes — a test or a demo';
  else if (recordHours > MAX_NIGHT_H && !gig) why = 'longer than 12 h — a show that failed to end itself; not a night';
  const status = !why ? 'counted' : gig && p <= 1 && !v ? 'unused' : 'refused';
  return { status, why };
}

/** The same judgement straight off a history index row. */
export function judgeRow(r, occs, { hasCalendar, tz } = {}) {
  const gig = placeNight(r, occs);
  const people = (r.room || 0) > 0 ? r.room : (r.peakVoters || 0);
  return { gig, ...judgeNight({ people, votes: r.totalVotes, startedAt: r.startedAt, endedAt: r.endedAt, nets: r.nets == null ? null : r.nets, gig, hasCalendar, tz }) };
}
