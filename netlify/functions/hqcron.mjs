import { syncGmail } from './hq.mjs';

/* CRM'S MAIL RING (decision 0109). Every ten minutes, while Gmail is connected, the
   replies to the founder's outreach are read into their conversations (hq.mjs
   syncGmail) and a reply pushes to the founder's phone. Nothing else happens here.

   Skips when the open CRM page synced in the last four minutes (the page asks every
   minute while it is on screen), and costs one small read when Gmail is not
   connected. Logged, never thrown: a thrown scheduled function is retried. */
export const deps = { sync: syncGmail };

export default async () => {
  try {
    const r = await deps.sync({ budgetMs: 20000, minGapMs: 4 * 60e3 });
    if (r && (r.added || r.error)) console.log('hqcron:', JSON.stringify(r));
  } catch (e) {
    console.error('hqcron failed:', String((e && e.message) || e).slice(0, 200));
  }
  return new Response('ok', { status: 200 });
};

export const config = { schedule: '*/10 * * * *' };
