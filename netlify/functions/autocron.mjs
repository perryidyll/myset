import { readSched, emptySched, SCHED, sweep } from './_auto.mjs';
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

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  const now = Date.now();

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

  try {
    const r = await sweep({ now, log: (l) => console.log(l) });
    console.log(`autocron: ok — ${r.checked} checked, ${r.results.filter((x) => x.did).length} acted`,
                marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('autocron failed:', String((e && e.message) || e));
    return new Response('failed', { status: 200 });
  } finally {
    await casDoc(SCHED, emptySched, (d) => { d.runningSince = 0; return true; }).catch(() => {});
  }
};

export const config = { schedule: '*/2 * * * *' };
