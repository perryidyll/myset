import { runMirror } from './_mirror.mjs';

/* THE NIGHTLY COPY — the bell for _mirror.mjs (decision 0069). Rings every twenty
   minutes; a ring after a finished pass costs one read and returns, so the copy
   happens once a day and a pass too big for one ring carries on at the next.
   Same discipline as autocron and sheetcron: logged, never thrown (a thrown
   scheduled function is retried), the scheduler's marker logged, not enforced. */

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  try {
    const r = await runMirror({
      owners: async () => {
        const { readArtists } = await import('./_auth.mjs');
        const { readVenues } = await import('./_venues.mjs');
        const [a, v] = await Promise.all([readArtists(), readVenues()]);
        return [...Object.keys(a.byId || {}), ...Object.keys(v.byId || {}).map((vid) => `v:${vid}`)];
      },
      keysOf: async (owner) => {
        if (owner.startsWith('v:')) { const { keysForVenue } = await import('./_venueaccount.mjs'); return keysForVenue(owner.slice(2)); }
        const { keysFor } = await import('./_account.mjs');
        return keysFor(owner);
      },
    });
    if (r.off) { console.log('mirrorcron: R2 is off — nothing copied'); return new Response('off', { status: 200 }); }
    console.log('mirrorcron:', JSON.stringify(r), marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('mirrorcron failed:', String((e && e.message) || e));
    return new Response('failed', { status: 200 });
  }
};

export const config = { schedule: '*/20 * * * *' };
