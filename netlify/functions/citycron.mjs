import { healCityIndex } from './_events.mjs';

/* THE CITY INDEX'S HEAL — the bell for `healCityIndex` in _events.mjs (decision
   0174). The front door, a city's feed and a venue page read the gigs the index
   keeps beside each owner, written by the calendar save; a save does not wait on
   that write, so one can be lost. Once a day this re-points every owner on the two
   registries from their own calendar, so a lost write lasts a day at most. It is
   the one place that walks every calendar, and it is never a page.

   Rings every hour; a ring after a finished pass costs one read and returns, and
   a pass too big for one ring carries on at the next. Same discipline as the other
   bells: logged, never thrown (a thrown scheduled function is retried), the
   scheduler's marker logged, not enforced. If this file ever grows logic of its
   own, that is the bug. */

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  try {
    const r = await healCityIndex();
    console.log('citycron:', JSON.stringify(r), marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('citycron failed:', String((e && e.message) || e));
    return new Response('failed', { status: 200 });
  }
};

export const config = { schedule: '35 * * * *' };
