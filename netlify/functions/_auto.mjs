import { getShow, readDoc, casDoc, readFans, deletionOf } from './_lib.mjs';
import { readArtists } from './_auth.mjs';
import { readEvents, occurrencesFor, isVenueOwner, occKey } from './_events.mjs';
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

export { occKey };                          // lives in _events.mjs now (0065); callers here are unchanged

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

export const emptySched = () => ({ v: 1, byArtist: {}, live: {}, lastRunAt: 0, runningSince: 0, healedAt: 0, healCursor: 0 });
export const SHOW_IDLE_MS = 3 * 3600e3;
export const HEAL_EVERY_MS = 24 * 3600e3;
export const HEAL_BATCH = 300;

/**
 * THE HEAL. The index is written by calendar writes — but gigs saved before the
 * index existed, and any entry a lost write dropped, would never be found. So once
 * a day the cron walks the registry (one global read) and re-points every artist
 * from their own calendar (one read each), in batches with a cursor so a big
 * registry is covered over consecutive rings rather than dropped (0bw). Never
 * `list()` (1). Returns how many it looked at.
 *
 * ON A DEADLINE, A CHUNK AT A TIME (decision 0140). This read one calendar and wrote
 * the index once per artist, in series, with no clock and the cursor saved only at
 * the end: 164 ms an artist on the audit's timings, so past a hundred artists or so
 * the platform killed the ring before the cursor was written, and every ring after
 * it started from the same place and died the same way — with the sweep waiting
 * behind it. Now HEAL_CHUNK calendars are read together and land in ONE write that
 * also moves the cursor, and `deadline` (a real clock time) is checked between
 * chunks. A ring that runs out of time has still saved everything it did.
 *
 * A chunk must not put back an entry somebody changed while its calendars were
 * being read (a gig saved, a start refused): the index is read before the
 * calendars, and an entry that no longer matches that reading is left alone — the
 * other writer's is newer.
 */
export const HEAL_CHUNK = 10;
export async function heal({ now = Date.now(), limit = HEAL_BATCH, deadline = Infinity } = {}) {
  const reg = await readArtists();
  const ids = Object.keys(reg.byId || {}).filter((id) => !isVenueOwner(id)).sort();
  const first = await readSched();
  const start = ids.length ? (Number(first.healCursor) || 0) % ids.length : 0;
  const slice = ids.slice(start, start + limit);
  let looked = 0, complete = false;
  for (let i = 0; i < slice.length || i === 0; i += HEAL_CHUNK) {
    if (i > 0 && Date.now() > deadline) break;
    const chunk = slice.slice(i, i + HEAL_CHUNK);
    const before = i === 0 ? first : await readSched();
    const found = {};
    await Promise.all(chunk.map(async (aid) => {
      /* AN ACCOUNT ON ITS WAY OUT STAYS OFF (0dh, decision 0098). Day one took it off
         this index, but its calendar is kept for the thirty days — so re-pointing it
         from there put a deleted account's gigs back, and the sweep in the same ring
         started them. Undo re-indexes it (cancelDeletion); from then on it is walked
         like anybody else. */
      if ((reg.byId[aid] || {}).del) return;
      try { found[aid] = nextWindow(await readEvents(aid), now); }
      catch (e) { console.error(`autocron heal: ${aid} failed:`, String((e && e.message) || e)); }
    }));
    const next = start + i + chunk.length;
    const done = next >= ids.length;
    let wrote = false;
    await casDoc(SCHED, emptySched, (d) => {
      d.byArtist ||= {};
      for (const [aid, w] of Object.entries(found)) {
        const is = d.byArtist[aid];
        if (JSON.stringify(is || null) !== JSON.stringify(before.byArtist[aid] || null)) continue;
        if (!w) delete d.byArtist[aid];
        // the same night keeps its marks: a refused start (`skip`), a night already under way (`on`)
        else d.byArtist[aid] = (is && is.k === w.k) ? { ...w, ...(is.skip ? { skip: is.skip } : {}), ...(is.on ? { on: is.on } : {}) } : w;
      }
      d.healCursor = done ? 0 : next;
      if (done) d.healedAt = now;                  // a full pass is what counts as healed
      wrote = true;
      return true;
    }).catch(() => { wrote = false; });
    if (!wrote) break;                             // the cursor did not move: the next ring takes this chunk again
    looked += chunk.length;
    complete = done;
    if (done) break;
  }
  return { looked, of: ids.length, complete };
}
export async function readSched() {
  const { data } = await readDoc(SCHED, null);
  const d = { ...emptySched(), ...(data || {}) };
  d.byArtist ||= {};
  d.live ||= {};
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
 * Returns { did: 'start'|'end'|null, key, why, refused, settled }.
 * `settled` says tonight's start is decided for good — the show is on, or was on and
 * the artist ended it — so the sweep need not ask again until the end is due.
 */
export async function autoTick(aid, { now = Date.now() } = {}) {
  if (isVenueOwner(aid)) return { did: null, why: 'venue' };
  const events = await readEvents(aid);
  const occ = currentOccurrence(events, now);
  if (!occ) return { did: null, why: 'no gig now' };
  const key = occKey(occ);
  const show = await getShow(aid);

  if (now < occ.endsAt) {
    /* LAST NIGHT'S SHOW MUST NOT SWALLOW TONIGHT. This was a flat "already live",
       and that one line is why Perry's Money tab was missing nights. Once a show
       failed to end itself — see the deferred-end bug below — it stayed live, and
       every following gig hit this branch and did nothing. Five nights at five
       venues were appended to one show that had started on 30 August, and the
       Studio showed one row for the lot, correctly, because that is genuinely what
       was recorded. Nothing was lost by the archive; the nights were never separate
       in the first place.
       So: a live show that began before tonight's window is not tonight's show. End
       it, file it, and carry on into the start below. Two hours of slack, the same
       figure the "the artist ended it themselves" test uses, so an artist who
       starts early is never interrupted. */
    if (show.status === 'live') {
      if ((show.startedAt || 0) >= occ.startsAt - 2 * 3600e3)
        return { did: null, key, settled: true, why: 'already live' };
      await endShow(aid, { by: 'schedule' });
      console.log('autocron: filed a show left running from a previous gig for', aid);
    }
    if (show.autoStart === false) return { did: null, key, why: 'auto-start is off for this artist' };
    if (show.autoKey === key) return { did: null, key, settled: true, why: 'this gig was already started once' };
    /* The artist started a show for this night by hand and then ended it. That was
       a decision; the schedule does not overrule it. (A show that ended before the
       gig's window is last night's — that one gets replaced.) */
    if (show.status === 'ended' && (show.startedAt || 0) >= occ.startsAt - 2 * 3600e3)
      return { did: null, key, settled: true, why: 'the artist ended tonight’s show themselves' };
    // an empty voting page is a broken gig (16). Not marked refused: the moment
    // they switch a song on, the next tick starts it (two reads a tick, one artist)
    if (!(show.songs || []).some((s) => s && s.active !== false))
      return { did: null, key, why: 'no songs switched on' };
    /* NEVER FOR AN ACCOUNT ON ITS WAY OUT (0dh, decision 0098) — the check a tap on
       Start meets in admin.mjs (423), made here because this start has no request
       behind it. The heal no longer puts such an account back; this catches an
       entry that got back anyway (one written before the fix, or a heal that read
       the registry a moment before the account left). `drop` takes the entry out
       instead of re-pointing it at the next night. One read, only when a start is
       actually due — the per-ring "already live" path never reaches it. */
    if (await deletionOf(aid)) return { did: null, key, why: 'the account is being deleted', drop: true };
    const r = await startShow(aid, { fresh: true, by: 'schedule', occKey: key, eventId: occ.eventId });
    if (r.err) return { did: null, key, why: r.err[0], refused: true };
    return { did: 'start', key, settled: true, note: r.note };
  }

  if (now >= occ.endsAt + END_GRACE_MS && show.status === 'live') {
    // a show started AFTER the gig's grace is a different night — leave it alone
    if ((show.startedAt || 0) >= occ.endsAt + END_GRACE_MS) return { did: null, key, why: 'a later show' };
    /* STILL PLAYING MEANS TRY AGAIN, NOT FORGET. This returned without `keep`, and
       sweep() then re-pointed the artist's entry at their NEXT gig (or deleted it
       when there wasn't one), so tonight was never due again: the show stayed live
       for ever and the next night's songs were merged into it. That is how one gig
       swallows another and two nights become one row.
       The six-hour backstop is the other half: a nowPlayingAt that stale means the
       artist walked away from the tablet, not that the set is still going. */
    const stale = now > occ.endsAt + END_GRACE_MS + 6 * 3600e3;
    if (!stale && (show.nowPlayingAt || 0) > now - IDLE_MS)
      return { did: null, key, keep: true, why: 'still playing' };
    await endShow(aid, { by: 'schedule' });
    return { did: 'end', key, why: stale ? 'ended late — nothing had played for hours' : '' };
  }
  return { did: null, key, why: 'nothing due' };
}

/* Start after `after` in a list sorted by id, and wrap. With a bounded ring this
   is what stops the same first few from being the only ones ever looked at. */
const rotate = (rows, after) => {
  const from = after ? rows.findIndex(([aid]) => aid > after) : 0;
  return from > 0 ? rows.slice(from).concat(rows.slice(0, from)) : rows;
};
const byId = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
export const SWEEP_POOL = 5;

/**
 * One pass over the index: act on every artist with something due, then
 * re-point their entry at the next window. Bounded per run — the rest is picked
 * up next tick, never dropped (INVARIANT 0bw). Errors per artist are loud and do
 * not stop the others (0bw3).
 *
 * THREE THINGS THAT KEEP "BOUNDED" FROM MEANING "NEVER" (decision 0140):
 *   · A NIGHT UNDER WAY IS NOT DUE. A gig that had started stayed in the list for
 *     its whole length — every ring re-read its calendar and its show to learn it
 *     was "already live" — and with `limit` at 40 the forty-first gig in progress
 *     was never looked at: it did not start itself and it did not end itself.
 *     autoTick now says `settled`, the entry is marked `on` for that night, and it
 *     is due again only when its end is.
 *   · THE LIST ROTATES. What is due is walked in id order starting after the last
 *     artist the previous ring reached (`sweepAfter`), so a ring that runs out of
 *     room or time leaves the rest first in line, not last for ever.
 *   · A CLOCK, NOT ONLY A COUNT. `deadline` is a real time; no artist is begun
 *     after it. A start can take seconds (it files the previous night), so a count
 *     alone could not keep a ring inside the platform's limit.
 * Artists are independent, so SWEEP_POOL of them are worked at once.
 */
export async function sweep({ now = Date.now(), limit = 40, deadline = Infinity, log = () => {} } = {}) {
  const sched = await readSched();
  const all = Object.entries(sched.byArtist)
    .filter(([, w]) => w && ((now >= w.s && now < w.e && w.skip !== w.k && w.on !== w.k) || now >= w.e + END_GRACE_MS))
    .sort(byId);
  const due = rotate(all, String(sched.sweepAfter || '')).slice(0, limit);
  const results = [];
  const updates = {};
  let taken = 0;
  const worker = async () => {
    while (taken < due.length) {
      if (taken > 0 && Date.now() > deadline) return;
      const [aid, w] = due[taken++];
      try {
        const r = await autoTick(aid, { now });
        results.push({ aid, ...r });
        log(`autocron: ${aid} — ${r.did || 'nothing'}${r.why ? ' (' + r.why + ')' : ''}`);
        // `keep` leaves the entry pointing at tonight so the next ring tries again;
        // `drop` takes it out — an account on its way out has nothing due (0dh)
        const next = r.keep ? w : r.drop ? null : nextWindow(await readEvents(aid), now);
        if (next && r.refused && next.k === w.k) next.skip = w.k;
        if (next && r.settled && next.k === w.k) next.on = w.k;
        updates[aid] = next;
      } catch (e) {
        console.error(`autocron: ${aid} failed:`, String((e && e.message) || e));
        results.push({ aid, did: null, why: 'error' });
        // leave the entry alone so the next tick tries again
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SWEEP_POOL, due.length) }, worker));
  // where the next ring starts: after the last one begun, or from the top once everything due was reached
  const after = taken < all.length && taken > 0 ? due[taken - 1][0] : '';
  if (Object.keys(updates).length || after !== String(sched.sweepAfter || '')) {
    await casDoc(SCHED, emptySched, (d) => {
      d.byArtist ||= {};
      for (const [aid, w] of Object.entries(updates)) { if (w) d.byArtist[aid] = w; else delete d.byArtist[aid]; }
      if (after) d.sweepAfter = after; else delete d.sweepAfter;
      return true;
    }).catch(() => {});
  }
  return { checked: taken, waiting: all.length - taken, deferred: Math.max(0, Object.keys(sched.byArtist).length - due.length), results };
}

/* THE MORNING-AFTER NOTE (2026-09-15). endShow queues one on the first night an
   account files (`notes[aid]`, see _lifecycle.mjs); this sends it once it is due
   and moves the id to `noted` so it can never go twice. The figures are read off
   the filed row — the same row the Money tab shows — and the letter goes to the
   owner's address from the registry, which is the only thing that address is for
   here. A note whose night vanished, or whose account has no owner address, is
   dropped, not retried: a missing letter beats a daily failure in the log.

   CLAIMED BEFORE IT IS SENT (decision 0186). The note used to be moved to `noted`
   AFTER the letters went, in a write whose failure was swallowed — so a lost write,
   or two rings overlapping, sent the same letter twice. Now one write moves every
   due note to `noted` first, and only the notes that write actually took are sent.
   A second ring finds them gone and sends nothing; a claim that cannot be written
   sends nothing and leaves the notes for the next ring; a send that fails after the
   claim is a letter missed, never a letter doubled. */
export async function sweepNotes({ now = Date.now(), limit = 20, log = () => {} } = {}) {
  const sched = await readSched();
  const ready = Object.entries(sched.notes || {}).filter(([, n]) => n && now >= Number(n.due)).slice(0, limit);
  if (!ready.length) return { checked: 0, sent: 0 };
  const due = [];
  await casDoc(SCHED, emptySched, (d) => {
    due.length = 0;
    d.notes ||= {}; d.noted ||= {};
    for (const [aid] of ready) {
      const n = d.notes[aid];
      if (!n || now < Number(n.due)) continue;   // another ring took it, or it moved
      due.push([aid, n]);
      delete d.notes[aid]; d.noted[aid] = now;
    }
    return due.length > 0;
  });
  if (!due.length) return { checked: 0, sent: 0 };
  const [{ sendMail }, { readHistIndex }] = await Promise.all([import('./_auth.mjs'), import('./_history.mjs')]);
  const reg = await readArtists();
  let sent = 0;
  for (const [aid, n] of due) {
    try {
      const a = reg.byId[aid];
      /* An account on its way out is not written to (0dh, decision 0098): "put your
         next show on the calendar" is the wrong letter for somebody who has just
         left. Dropped, not held — a held note would be re-read every ring for thirty
         days, and Undo does not need it back. */
      const leaving = !!(a && a.del);
      const owner = Object.entries(reg.byEmail || {}).find(([, r]) => r && r.artistId === aid && r.role === 'owner');
      const email = owner ? owner[0] : '';
      const row = a && !leaving ? (await readHistIndex(aid)).shows.find((x) => x.showId === n.showId) : null;
      if (a && !leaving && email && row) {
        const money = row.source === 'stripe' ? Number(row.gross) || 0 : null;
        const site = process.env.URL || 'https://myset.vip';
        const people = Number(row.peakVoters) || 0, votes = Number(row.totalVotes) || 0, played = Number(row.songsPlayed) || 0;
        const lines = [
          `Morning, ${a.name || 'there'} — that was your first night on MySet.`,
          money !== null && money > 0
            ? `The room put $${money.toFixed(2)} through the app${row.paidVotes ? `, ${row.paidVotes} of the votes were bought` : ''}. ${people} ${people === 1 ? 'person' : 'people'} voted, ${votes} vote${votes === 1 ? '' : 's'} in all, ${played} song${played === 1 ? '' : 's'} played.`
            : `${people} ${people === 1 ? 'person' : 'people'} voted, ${votes} vote${votes === 1 ? '' : 's'} in all, ${played} song${played === 1 ? '' : 's'} played.${money === null ? '' : ' Nothing came through the app yet — that is normal for a first night.'}`,
          money !== null && money > 0
            ? 'Stripe pays that out to your bank on its own schedule — the Money tab shows when.'
            : 'The nights that pay are the ones where the QR code is on every table and you say out loud that the room picks the next song.',
          'One thing to do today: put your next show on the calendar. A gig on the calendar starts by itself, shows on your page, and gets you into the city feed.',
        ];
        const r = await sendMail(email, 'Your first night on MySet', lines, { cta: { url: `${site}/studio`, label: 'Add your next show' } });
        if (r.ok) { sent += 1; log(`autocron: first-night note sent for ${aid}`); }
        else log(`autocron: first-night note for ${aid} not sent (${r.why})`);
      } else log(`autocron: first-night note for ${aid} dropped (${!a ? 'no account' : leaving ? 'the account is being deleted' : !email ? 'no owner address' : 'night not on file'})`);
    } catch (e) { console.error(`autocron note: ${aid} failed:`, String((e && e.message) || e)); }
  }
  return { checked: due.length, sent };
}

/**
 * End any live show with no artist action or audience vote for three hours.
 *
 * `live[aid]` is the last time this show was KNOWN to be active — the start, until
 * a ring looks and finds something later. A show that was active less than three
 * hours ago by that mark cannot be idle, so it costs no reads at all; one that is
 * looked at and found busy has its mark moved up, so it is not read again (thirteen
 * documents) every two minutes for the rest of a long night. What is left is walked
 * like the sweep: in id order from where the last ring stopped (`idleAfter`), and
 * not past `deadline` — this was the first forty entries of the map, every ring,
 * so the forty-first live show could never be ended (decision 0140).
 */
export async function sweepIdle({ now = Date.now(), limit = 40, deadline = Infinity, log = () => {} } = {}) {
  const sched = await readSched();
  const all = Object.entries(sched.live || {})
    .filter(([, at]) => now - (Number(at) || 0) >= SHOW_IDLE_MS).sort(byId);
  const entries = rotate(all, String(sched.idleAfter || '')).slice(0, limit);
  const remove = [], seen = {};
  let ended = 0, taken = 0;
  for (const [aid, at] of entries) {
    if (taken > 0 && Date.now() > deadline) break;
    taken += 1;
    try {
      const [show, fans] = await Promise.all([getShow(aid), readFans(aid)]);
      if (show.status !== 'live') { remove.push(aid); continue; }
      const fanAt = Math.max(0, ...Object.values(fans || {}).map((f) => Number(f.lastAt) || 0));
      const last = Math.max(Number(at) || 0, Number(show.updatedAt) || 0, fanAt);
      if (now - last < SHOW_IDLE_MS) { seen[aid] = last; continue; }
      await endShow(aid, { by: 'inactivity' });
      remove.push(aid); ended += 1; log(`autocron: ${aid} — ended after three idle hours`);
    } catch (e) { console.error(`autocron idle: ${aid} failed:`, String((e && e.message) || e)); }
  }
  const after = taken < all.length && taken > 0 ? entries[taken - 1][0] : '';
  if (remove.length || Object.keys(seen).length || after !== String(sched.idleAfter || '')) await casDoc(SCHED, emptySched, (d) => {
    d.live ||= {};
    for (const aid of remove) delete d.live[aid];
    // only ever forward, and only for a show still marked live: a fresh Start writes its own mark
    for (const [aid, last] of Object.entries(seen)) if (d.live[aid] && Number(d.live[aid]) < last) d.live[aid] = last;
    if (after) d.idleAfter = after; else delete d.idleAfter;
    return true;
  }).catch(() => {});
  return { checked: taken, ended };
}
