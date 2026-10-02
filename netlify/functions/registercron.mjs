import { readState, readDirty, foldRegister, FULL_EVERY_MS } from './_register.mjs';

/* THE REGISTER'S BELL (decision 0095). Rings every ten minutes and is the ONE
   writer of the founder's register — every night every artist has filed, folded
   into /moneymodel/shows and the money model's live feed.

   FIRST, THE LIVE WALK (decision 0154). No start and no end writes a global document
   any more: the walk reads the artist registry and each artist's show record from a
   cursor (`walkLive`, `_lifecycle.mjs`), and in one write puts a show it saw live on
   the idle sweep's list and leaves a `regdirty` mark for a night that changed — so the
   fold below files it in this same ring. Its own clock (LIVE_WALK_MS); a walk that
   fails is logged and the ring goes on.
   Then an idle ring is two reads more: `registersync` (when the last fold ran,
   whether one is running) and `gigsched` (the `regdirty` marks the walk leaves, and
   history.mjs when a night is renamed, hidden or re-checked).
   Nothing dirty and a full walk younger than FULL_EVERY_MS → done. Otherwise
   `foldRegister` walks the dirty artists first and the ring from the cursor when a
   full walk is due, time-boxed, and carries on next ring. The same discipline as
   autocron, sheetcron and mirrorcron:
     · MIN_GAP: a second ring inside five minutes is a no-op
     · one run at a time, via `runningSince` on `registersync`, stale after four minutes
     · the scheduler's `next_run` marker is LOGGED, never enforced
     · logged, never thrown: a thrown scheduled function is retried
   Cost, written down: 144 rings a day; an idle ring is the walk (the registry, the
   index, one show record per artist up to LIVE_WALK, a write only when something
   changed) and two reads. A fold reads two
   registries, the month shards and three documents per artist walked, plus five more
   and the details for an artist with a changed night — at today's size a few dozen
   reads a fold, a handful of folds a day. A traffic-bill flat line of its own, never
   a per-gig figure (INVARIANT 0fx); re-take the empty-day meter after this ships. */

const MIN_GAP = 5 * 60e3;

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  const now = Date.now();
  try {
    const { walkLive, LIVE_WALK_MS } = await import('./_lifecycle.mjs');
    const walk = await walkLive({ now, deadline: now + LIVE_WALK_MS })
      .catch((e) => { console.error('registercron: live walk failed:', String((e && e.message) || e)); return null; });
    if (walk) console.log(`registercron: live walk looked at ${walk.looked} of ${walk.of} — ${walk.added} live, ${walk.removed} off, ${walk.dirty} marked`);
    const [state, dirty] = await Promise.all([readState(), readDirty()]);
    const since = now - (Number(state.lastRunAt) || 0);
    if (since < MIN_GAP) { console.log(`registercron: skipped, last fold was ${Math.round(since / 60000)} min ago`); return new Response('too soon', { status: 200 }); }
    if (state.runningSince && now - Number(state.runningSince) < 4 * 60e3) { console.log('registercron: another fold is in progress'); return new Response('busy', { status: 200 }); }
    const due = !state.lastFullAt || now - Number(state.lastFullAt) > FULL_EVERY_MS;
    if (!Object.keys(dirty).length && !due) { console.log('registercron: nothing to fold'); return new Response('idle', { status: 200 }); }
    const r = await foldRegister({ reason: 'cron', now });
    console.log('registercron:', JSON.stringify(r), marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response(r.ok ? 'ok' : r.busy ? 'busy' : 'failed', { status: 200 });
  } catch (e) {
    console.error('registercron failed:', String((e && e.message) || e));
    return new Response('failed', { status: 200 });
  }
};

export const config = { schedule: '*/10 * * * *' };
