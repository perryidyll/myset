import { casDoc, readDoc } from './_lib.mjs';
import { QKEY, emptyQ, STUCK_MS, MAX_TRIES } from './_factory.mjs';

/* THE FACTORY'S BELL (decision 0101). Rings every five minutes and does three things,
   none of them itself:
     1. the samples' clock — sweepSamples (_sample.mjs): pages past thirty days are taken
        down to a private copy, copies past one hundred and eighty days are erased; five
        a ring at most
     2. jobs that stopped: a worker the platform ended at fifteen minutes leaves its job
        `running` for ever. Twenty minutes silent puts it back in line, or fails it after
        MAX_TRIES — the only job-state rule that lives here, because only a clock can see it
     3. starting what waits — startJobs (factory.mjs), the one place that marks a job
        running and knocks on factory-background with the key: at most three a ring,
        never more than the day's cap (factorycfg.perDay, the ceiling on what Claude
        costs), counted in `factoryq` by UTC day. The console's Build button uses the
        same door, so the cap is one number however a build starts.
   If this file ever grows build logic of its own, that is the bug (autocron's rule).

   Same discipline as autocron, sheetcron and registercron:
     · MIN_GAP: a second ring inside four minutes is a no-op (INVARIANT 0cj)
     · one run at a time, via `runningSince` on `factoryq`, stale after four minutes (0bw2)
     · the scheduler's `next_run` marker is LOGGED, never enforced
     · logged, never thrown: a thrown scheduled function is retried
   Cost, written down: 288 rings a day; an idle ring is a read of `factoryq`, one small
   write each way for the lock, and the sweep's two reads. Nothing here is on any path a
   fan or an artist is waiting on. */

const MIN_GAP = 4 * 60e3;
const RUN_LOCK_MS = 4 * 60e3;
const PER_RING = 3;

export const deps = {
  sample: () => import('./_sample.mjs'),
  start: async (n) => (await import('./factory.mjs')).startJobs(n),
  now: () => Date.now(),
};
const msg = (e) => String((e && e.message) || e || 'failed').slice(0, 200);

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  const now = deps.now();
  let mine = false;
  try {
    const q = (await readDoc(QKEY, null)).data || emptyQ();
    const since = now - (Number(q.lastRunAt) || 0);
    if (since < MIN_GAP) { console.log(`factorycron: skipped, last ring was ${Math.round(since / 1000)}s ago`); return new Response('too soon', { status: 200 }); }
    if (q.runningSince && now - Number(q.runningSince) < RUN_LOCK_MS) { console.log('factorycron: another ring is in progress'); return new Response('busy', { status: 200 }); }
    // the lock and the watermark together; a ring that dies leaves a lock that expires by itself
    await casDoc(QKEY, emptyQ, (d) => {
      if (d.runningSince && now - Number(d.runningSince) < RUN_LOCK_MS) return false;
      d.runningSince = now; d.lastRunAt = now; mine = true; return true;
    }).catch(() => {});
    if (!mine) { console.log('factorycron: lost the lock'); return new Response('busy', { status: 200 }); }

    try {
      const { sweepSamples } = await deps.sample();
      const s = (await sweepSamples(now, 5)) || {};
      if ((s.archived || []).length || (s.erased || []).length) console.log(`factorycron: took down ${(s.archived || []).length}, erased ${(s.erased || []).length} old copies`);
    } catch (e) { console.error('factorycron: the samples sweep failed', msg(e)); }

    let back = 0, dead = 0;
    await casDoc(QKEY, emptyQ, (d) => {
      back = 0; dead = 0;
      for (const j of d.jobs || []) {
        if (!j || j.st !== 'running' || now - (Number(j.upd) || Number(j.at) || 0) <= STUCK_MS) continue;
        j.tries = (Number(j.tries) || 0) + 1;
        j.run = ''; j.upd = now;
        if (j.tries >= MAX_TRIES) { j.st = 'failed'; j.stage = 'failed'; j.err = 'stopped before it finished, twice'; dead++; }
        else { j.st = 'queued'; j.stage = 'retry'; j.err = 'stopped before it finished'; back++; }
      }
      return back + dead > 0;
    }).catch((e) => console.error('factorycron: could not look at stopped jobs', msg(e)));

    let started = 0;
    try { started = (await deps.start(PER_RING)) || 0; } catch (e) { console.error('factorycron: could not start jobs', msg(e)); }
    console.log(`factorycron: ok — ${started} started, ${back} back in line, ${dead} failed`, marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('factorycron failed:', msg(e));
    return new Response('failed', { status: 200 });
  } finally {
    if (mine) await casDoc(QKEY, emptyQ, (d) => { d.runningSince = 0; return true; }).catch(() => {});
  }
};

export const config = { schedule: '*/5 * * * *' };
