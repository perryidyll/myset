import { getShow, readDoc, casDoc } from './_lib.mjs';
import { readEvents, occurrencesFor, isVenueOwner } from './_events.mjs';
import { utcToDate } from './_time.mjs';
import { startShow, endShow } from './_lifecycle.mjs';

/* SHOWS THAT START AND END THEMSELVES.

   Perry's rule (2026-09-04): a gig on the calendar starts its show at the gig's
   start time if the artist hasn't already, and ends it three hours after the
   gig's scheduled end if the artist hasn't already. This file decides; the
   lifecycle module acts; `autocron.mjs` rings every couple of minutes.

   What keeps it honest:
     · ONE global index, `gigsched`, rewritten whenever an artist's gigs change
       (the `cityindex` pattern, INVARIANT 0i) — so a tick reads one document to
       learn who has a gig due, and never `list()`s (1) and never walks every
       artist's calendar (9d13). The audience poll is not touched at all.
     · Every start goes through `startShow` with the gig cap, the archive, the
       setlist and the paid-vote carry exactly as a tap does (9d9, 17c, 13b).
     · A gig is started ONCE. The occurrence key is stamped on the show, so a night
       the artist ends early stays ended, and a cron that rings twice cannot start
       it twice.
     · A show is never ended mid-song: if a song started in the last IDLE_MS the
       end is deferred to the next tick (16).
     · A refused start (free cap) is remembered on the index entry so it is not
       retried every two minutes for the rest of the night.
     · Venue-owned events (`v_…`) are never shows. */

export const SCHED = 'gigsched';
export const END_GRACE_MS = 3 * 3600e3;      // "three hours past their scheduled end"
export const IDLE_MS = 45 * 60e3;            // a song this recent means the set is still on

export const occKey = (o) => `${o.eventId}@${o.date}`;

/** The gig whose night is "now": started already, and not yet past its grace. */
export function currentOccurrence(events, now) {
  const from = utcToDate(now - 2 * 86400000), to = utcToDate(now + 86400000);
  const occs = occurrencesFor(events, from, to).filter((o) => o.startsAt <= now);
  // the most recent one that has started — a 10pm set is "now" at 1am
  return occs.length ? occs[occs.length - 1] : null;
}

/** For the index: the next window that still has something due in it. */
export function nextWindow(events, now) {
  const from = utcToDate(now - 2 * 86400000), to = utcToDate(now + 60 * 86400000);
  const o = occurrencesFor(events, from, to).find((x) => x.endsAt + END_GRACE_MS > now);
  return o ? { s: o.startsAt, e: o.endsAt, k: occKey(o) } : null;
}

export const emptySched = () => ({ v: 1, byArtist: {}, lastRunAt: 0, runningSince: 0 });
export async function readSched() {
  const { data } = await readDoc(SCHED, null);
  const d = { ...emptySched(), ...(data || {}) };
  d.byArtist ||= {};
  return d;
}

/** Keep this artist's entry in the index current. Called after every gig write. */
export async function reindexSched(aid, events, now = Date.now()) {
  if (isVenueOwner(aid)) return;
  const w = nextWindow(events, now);
  await casDoc(SCHED, emptySched, (d) => {
    d.byArtist ||= {};
    const old = d.byArtist[aid];
    if (!w) delete d.byArtist[aid];
    // keep a "refused" mark if it is for the same occurrence
    else d.byArtist[aid] = (old && old.k === w.k && old.skip) ? { ...w, skip: old.skip } : w;
    return true;
  }).catch(() => {});
}

/**
 * Look at one artist and do whatever is due. Pure decision + one lifecycle call.
 * Returns { did: 'start'|'end'|null, key, why, refused }.
 */
export async function autoTick(aid, { now = Date.now() } = {}) {
  if (isVenueOwner(aid)) return { did: null, why: 'venue' };
  const events = await readEvents(aid);
  const occ = currentOccurrence(events, now);
  if (!occ) return { did: null, why: 'no gig now' };
  const key = occKey(occ);
  const show = await getShow(aid);

  if (now < occ.endsAt) {
    if (show.status === 'live') return { did: null, key, why: 'already live' };
    if (show.autoKey === key) return { did: null, key, why: 'this gig was already started once' };
    /* The artist started a show for this night by hand and then ended it. That was
       a decision; the schedule does not overrule it. (A show that ended before the
       gig's window is last night's — that one gets replaced.) */
    if (show.status === 'ended' && (show.startedAt || 0) >= occ.startsAt - 2 * 3600e3)
      return { did: null, key, why: 'the artist ended tonight’s show themselves' };
    // an empty voting page is a broken gig (16). Not marked refused: the moment
    // they switch a song on, the next tick starts it (two reads a tick, one artist)
    if (!(show.songs || []).some((s) => s && s.active !== false))
      return { did: null, key, why: 'no songs switched on' };
    const r = await startShow(aid, { fresh: true, by: 'schedule', occKey: key, eventId: occ.eventId });
    if (r.err) return { did: null, key, why: r.err[0], refused: true };
    return { did: 'start', key, note: r.note };
  }

  if (now >= occ.endsAt + END_GRACE_MS && show.status === 'live') {
    // a show started AFTER the gig's grace is a different night — leave it alone
    if ((show.startedAt || 0) >= occ.endsAt + END_GRACE_MS) return { did: null, key, why: 'a later show' };
    if ((show.nowPlayingAt || 0) > now - IDLE_MS) return { did: null, key, why: 'still playing' };
    await endShow(aid, { by: 'schedule' });
    return { did: 'end', key };
  }
  return { did: null, key, why: 'nothing due' };
}

/**
 * One pass over the index: act on every artist with something due, then
 * re-point their entry at the next window. Bounded per run — the rest is picked
 * up next tick, never dropped (INVARIANT 0bw). Errors per artist are loud and do
 * not stop the others (0bw3).
 */
export async function sweep({ now = Date.now(), limit = 40, log = () => {} } = {}) {
  const sched = await readSched();
  const due = Object.entries(sched.byArtist)
    .filter(([, w]) => w && ((now >= w.s && now < w.e && w.skip !== w.k) || now >= w.e + END_GRACE_MS))
    .slice(0, limit);
  const results = [];
  const updates = {};
  for (const [aid, w] of due) {
    try {
      const r = await autoTick(aid, { now });
      results.push({ aid, ...r });
      log(`autocron: ${aid} — ${r.did || 'nothing'}${r.why ? ' (' + r.why + ')' : ''}`);
      const next = nextWindow(await readEvents(aid), now);
      if (next && r.refused && next.k === w.k) next.skip = w.k;
      updates[aid] = next;
    } catch (e) {
      console.error(`autocron: ${aid} failed:`, String((e && e.message) || e));
      results.push({ aid, did: null, why: 'error' });
      // leave the entry alone so the next tick tries again
    }
  }
  if (Object.keys(updates).length) {
    await casDoc(SCHED, emptySched, (d) => {
      d.byArtist ||= {};
      for (const [aid, w] of Object.entries(updates)) { if (w) d.byArtist[aid] = w; else delete d.byArtist[aid]; }
      return true;
    }).catch(() => {});
  }
  return { checked: due.length, deferred: Math.max(0, Object.keys(sched.byArtist).length - due.length), results };
}
