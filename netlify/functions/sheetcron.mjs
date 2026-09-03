import { readSyncState } from './_warehouse.mjs';

/* THE NIGHTLY SHEET SYNC.

   Netlify runs this on the schedule at the bottom. It does exactly what the
   Studio's "Sync now" button does, so there is one implementation and no second
   path that can rot — if this file ever grows logic of its own, that is the bug.

   03:20 UTC on purpose: late enough that a gig anywhere in the world has ended
   and been archived, early enough that Perry's morning sheet is current. Not on
   the hour, because everybody's cron is on the hour.

   IT IS STILL A PUBLIC URL. Every file in netlify/functions is reachable at
   /.netlify/functions/<name> whatever the redirects say, and Netlify's own
   refusal to invoke a scheduled function over HTTP is their implementation
   detail, not a guarantee this file should lean on. So there are two guards, and
   the important thing about them is that NEITHER CAN BREAK THE SCHEDULE:

     · MIN_GAP. The sync already records `lastRunAt`, so a second call inside the
       hour is a no-op. That caps anybody hammering this at 24 syncs a day
       without needing to know anything about how Netlify invokes it.
     · The scheduler's own marker is LOGGED, not enforced. Netlify posts a body
       carrying `next_run`; if that ever changes shape, enforcing it would
       silently stop the nightly job and nobody would notice for weeks. So it
       goes in the log line, where a wrong assumption is visible instead of fatal.

   The manual button in the Studio bypasses MIN_GAP, because a person asking for
   it is the one case where "you already did this" is the wrong answer.

   Cost: one run a day. Netlify bills 10,000 requests at 2 credits, so this is
   roughly nothing — unlike a production deploy at 15 (INVARIANT 9d). Never
   "trigger a rebuild to test the cron"; use the button. */

const MIN_GAP = 3600e3;

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }

  const state = await readSyncState().catch(() => ({ lastRunAt: 0 }));
  const since = Date.now() - (Number(state.lastRunAt) || 0);
  if (since < MIN_GAP) {
    console.log(`sheetcron: skipped, last run was ${Math.round(since / 60000)} min ago`);
    return new Response('too soon', { status: 200 });
  }

  const { syncSheet } = await import('./_warehouse.mjs');
  try {
    const r = await syncSheet();
    if (r.off) {
      console.log('sheetcron: sheet is off —', r.error);
      return new Response('off', { status: 200 });
    }
    console.log('sheetcron: ok', JSON.stringify(r.counts || {}),
                r.note || '', marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  } catch (e) {
    /* Logged, not thrown. A thrown scheduled function is retried by Netlify, and
       a sync that failed because Google is down should wait for tomorrow rather
       than hammer it — the next run picks up everything this one missed, because
       the watermarks only move after a successful write (INVARIANT 0bs). */
    console.error('sheetcron failed:', String((e && e.message) || e));
    return new Response('failed', { status: 200 });
  }
};

export const config = { schedule: '20 3 * * *' };
