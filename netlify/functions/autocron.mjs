import { readSched, emptySched, SCHED, sweep, sweepIdle, sweepNotes, heal, HEAL_EVERY_MS } from './_auto.mjs';
import { casDoc } from './_lib.mjs';

/* SHOWS THAT START AND END THEMSELVES — the bell.

   Rings every two minutes and does exactly what `_auto.mjs`'s `sweep()` does; if
   this file ever grows logic of its own, that is the bug (the same rule as
   sheetcron.mjs). A show can therefore start up to two minutes after its
   scheduled time, which is inside what the room notices — phones poll every
   3–25 seconds and the Studio every 4.

   Same discipline as the sheet cron, for the same reasons:
     · MIN_GAP: a second ring inside a minute is a no-op, so nothing can multiply
       the work (INVARIANT 0cj — Netlify blocks direct HTTP invocation anyway,
       measured 403, but that is their detail, not something this leans on)
     · one run at a time, via `runningSince` on the index, stale after four
       minutes (0bw2)
     · the scheduler's `next_run` marker is LOGGED, never enforced
     · logged, never thrown: a thrown scheduled function is retried

   Cost, written down (9d13): one strong read of `gigsched` per ring when nothing
   is due — 720 a day, about nothing — plus, per artist with a gig due, the same
   reads a tap on "Start the show" or "End the show" costs. The bill still tracks
   gigs played, which is the premise of the free tier (9d9). */

const MIN_GAP = 60e3;
const RUN_LOCK_MS = 4 * 60e3;
/* HOW LONG A RING MAY KEEP STARTING WORK (decision 0140). Netlify's documents give a
   scheduled function thirty seconds; the one kill this repo has measured came at
   twelve (decision 0069). So nothing new is begun after seven, which leaves the
   unit of work in hand — one show starting, one chunk of the daily pass — room to
   finish inside the smaller figure. */
export const RING_BUDGET_MS = 7000;
/* The payment archive's own share of a ring (decision 0193): housekeeping, so small. */
export const PAIDARC_BUDGET_MS = 1500;

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  const now = Date.now();

  /* KEEP THE FAN DOOR AWAKE (decision 0049). One GET to /api/fan?what=warm every
     fourth minute — this rings every second minute, so every other ring — is
     ~11k calls a month, and it means the first fan of a quiet evening does not
     pay the ~1.5s a sleeping function costs to wake. Eight seconds is the most it
     may take; logged, never thrown.
     ALONGSIDE THE RING, NOT BEFORE IT (0140). These were awaited first, so a slow
     wake could spend eight seconds before a single show was looked at. They are
     started here and awaited at the end, which still keeps the runtime from
     freezing them mid-flight. */
  let warming = Promise.resolve();
  if (new Date(now).getUTCMinutes() % 4 === 0) {
    const site = process.env.URL || 'https://myset.vip';
    /* The Studio's two first reads are their own functions, and they sleep too:
       /api/stage (the stage payload) and /api/admin (planGet, and everything the
       Studio does). An unauthenticated GET wakes each one and is refused in a few
       milliseconds — three pings a tick, ~32k calls a month in all (decision 0050). */
    const warm = (path, label) => fetch(`${site}${path}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => console.log(`autocron: warmed ${label} (${r.status})`))
      .catch((e) => console.log(`autocron: warm ping of ${label} failed: ${e && e.message}`));
    warming = Promise.all([warm('/api/fan?what=warm', 'the fan door'), warm('/api/stage', 'stage'), warm('/api/admin', 'admin')]);
  }
  try { return await ring(now, marker); }
  finally { await warming; }
};

async function ring(now, marker) {
  const deadline = now + RING_BUDGET_MS;
  const state = await readSched().catch(() => emptySched());
  const since = now - (Number(state.lastRunAt) || 0);
  if (since < MIN_GAP) {
    console.log(`autocron: skipped, last run was ${Math.round(since / 1000)}s ago`);
    return new Response('too soon', { status: 200 });
  }
  if (state.runningSince && now - Number(state.runningSince) < RUN_LOCK_MS) {
    console.log('autocron: another run is in progress');
    return new Response('busy', { status: 200 });
  }

  // take the lock and the watermark together; a crash leaves a stale lock that
  // expires by itself
  let mine = false;
  await casDoc(SCHED, emptySched, (d) => {
    if (d.runningSince && now - Number(d.runningSince) < RUN_LOCK_MS) return false;
    d.runningSince = now; d.lastRunAt = now; mine = true; return true;
  }).catch(() => {});
  if (!mine) { console.log('autocron: lost the lock'); return new Response('busy', { status: 200 }); }

  /* THE ORDER IS THE POINT (decision 0140). What a room is waiting on goes first:
     shows starting and ending, then a fan's payment that is still owed. The
     housekeeping — the daily pass over every artist, the purge, the clip sweep —
     comes after and only with the time that is left. The daily pass used to run
     first, with no clock, so on the day it grew too long the platform killed the
     ring before it reached a single show, and killed the next one the same way.
     Each step is caught on its own: one failing is logged and the rest still run. */
  const step = async (name, fn) => {
    try { return await fn(); }
    catch (e) { console.error(`autocron: ${name} failed:`, String((e && e.message) || e)); return null; }
  };
  const left = () => Date.now() < deadline;
  try {
    const log = (l) => console.log(l);
    const r = await step('sweep', () => sweep({ now, deadline, log }));
    const idle = await step('idle sweep', () => sweepIdle({ now, deadline, log }));
    /* PAYMENTS A WEBHOOK COULD NOT DELIVER (decision 0138). One small read a ring;
       the rows, the bounds and the retry all live in _pay.mjs. */
    const owed = await step('redelivery', async () => (await import('./_pay.mjs')).redeliverOwed({ now, deadline, log }));
    if (owed && owed.checked) console.log(`autocron: ${owed.delivered} owed payment(s) delivered, ${owed.owed} still owed`);
    const notes = await step('first-night notes', () => sweepNotes({ now, log }));

    // once a day, re-point every artist from their own calendar — see heal()
    if (left() && now - (Number(state.healedAt) || 0) > HEAL_EVERY_MS) {
      const h = await step('heal', () => heal({ now, deadline }));
      if (h) console.log(`autocron: heal looked at ${h.looked} of ${h.of}${h.complete ? '' : ' (continues next ring)'}`);
    }
    /* OLD PAYMENT MARKERS MOVE TO THEIR YEAR (decision 0193). Once a day, after the
       heal, on its own cursor and a small clock of its own: every artist's and venue's
       delivered markers older than ninety days leave the payments document for
       `paidarc_<owner>_<YYYY>`. The work and its safety live in _pay.mjs; this only
       keeps the place. A pass too big for one ring carries on at the next. */
    if (left() && now - (Number(state.paidarcAt) || 0) > HEAL_EVERY_MS) {
      const a = await step('payment archive', async () => (await import('./_pay.mjs')).archiveDue({
        now, deadline: Math.min(deadline, Date.now() + PAIDARC_BUDGET_MS), cursor: state.paidarcCursor }));
      if (a) {
        await casDoc(SCHED, emptySched, (d) => { d.paidarcCursor = a.next; if (a.done) d.paidarcAt = now; return true; }).catch(() => {});
        console.log(`autocron: payment archive moved ${a.moved} marker(s) for ${a.looked} of ${a.of}${a.done ? '' : ' (continues next ring)'}`);
      }
    }
    /* ACCOUNTS THAT ASKED TO LEAVE, THIRTY DAYS AGO. One per ring, on an hourly
       watermark, so this costs 24 reads a day rather than 720 and can never eat a
       ring that a show was waiting on. A purge date does not need two-minute
       precision. */
    if (left() && now - (Number(state.purgedAt) || 0) > 3600e3) {
      await casDoc(SCHED, emptySched, (d) => { d.purgedAt = now; return true; }).catch(() => {});
      await step('purge', async () => {
        const { purgeDue } = await import('./_account.mjs');
        const p = await purgeDue(now, 1);
        if (p.purged.length) console.log('autocron: purged', p.purged.join(','));
      });
    }
    /* CLIPS UPLOADED AND NEVER POSTED. Two hours old, one owner a ring, on the
       same hourly watermark as the purge — a 3MB blob nothing points at is worth
       collecting, and nothing about it is urgent. */
    if (left() && now - (Number(state.vidsweptAt) || 0) > 3600e3) {
      await casDoc(SCHED, emptySched, (d) => { d.vidsweptAt = now; return true; }).catch(() => {});
      await step('clip sweep', async () => {
        const { sweepQueue } = await import('./_video.mjs');
        const v = await sweepQueue(now, 1);
        if (v.deleted) console.log(`autocron: dropped ${v.deleted} unposted clip(s)`);
      });
    }
    if (!r) return new Response('failed', { status: 200 });
    console.log(`autocron: ok — ${r.checked} checked, ${r.results.filter((x) => x.did).length} acted`,
                r.waiting ? `${r.waiting} waiting for the next ring` : '',
                `${idle ? idle.ended : '?'} idle ended`, notes && notes.sent ? `${notes.sent} first-night note(s) sent` : '',
                marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  } finally {
    await casDoc(SCHED, emptySched, (d) => { d.runningSince = 0; return true; }).catch(() => {});
  }
}

export const config = { schedule: '*/2 * * * *' };
