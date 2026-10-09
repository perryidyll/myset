import { watch } from './_watch.mjs';
import { notify } from './_push.mjs';

/* THE WATCH (decision 0157). Every ten minutes: is the bell ringing, is any payment
   still owed, is the error log filling — and a push to the founder's phone when an
   answer changes. Everything it does is in _watch.mjs; if this file grows logic of
   its own, that is the bug (the same rule as autocron.mjs). Logged, never thrown: a
   thrown scheduled function is retried. */
export default async () => {
  try {
    const r = await watch({ tell: notify });
    if (r.problems.length || r.told.length) console.log('watchcron:', JSON.stringify({ problems: r.problems, told: r.told }));
  } catch (e) {
    console.error('watchcron failed:', String((e && e.message) || e).slice(0, 200));
  }
  return new Response('ok', { status: 200 });
};

export const config = { schedule: '*/10 * * * *' };
