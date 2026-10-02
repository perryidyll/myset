import { healCityIndex } from './_events.mjs';
import { healLookups } from './_lookup.mjs';

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
   own, that is the bug.

   The artist list's small copies are healed from the same bell (decision 0176,
   `healLookups` in _lookup.mjs): a pass at most every HEAL_GAP_MS, its own budget, run
   beside the city's and caught on its own, so either can fail without the other. */

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  const [city, copies] = await Promise.allSettled([healCityIndex(), healLookups()]);
  if (copies.status === 'fulfilled') { if (!copies.value.idle) console.log('citycron copies:', JSON.stringify(copies.value)); }
  else console.error('citycron copies failed:', String((copies.reason && copies.reason.message) || copies.reason));
  if (city.status === 'fulfilled') {
    console.log('citycron:', JSON.stringify(city.value), marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  }
  console.error('citycron failed:', String((city.reason && city.reason.message) || city.reason));
  return new Response('failed', { status: 200 });
};

export const config = { schedule: '35 * * * *' };
