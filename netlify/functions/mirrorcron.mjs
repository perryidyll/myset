import { runMirror } from './_mirror.mjs';

/* THE NIGHTLY COPY — the bell for _mirror.mjs (decision 0069). Rings every twenty
   minutes; a ring after a finished pass costs one read and returns, so the copy
   happens once a day and a pass too big for one ring carries on at the next.
   Same discipline as autocron and sheetcron: logged, never thrown (a thrown
   scheduled function is retried), the scheduler's marker logged, not enforced. */

export default async (req) => {
  let marker = null;
  try { marker = ((await req.clone().json()) || {}).next_run || null; } catch { marker = null; }
  /* Keep the sealing keyring on the current MYSET_SECRET (decision 0113). After a
     rotation the first open re-wraps it; this bell makes sure that happens within
     twenty minutes of the deploy even on a day nobody signs in, so the runbook can
     say when MYSET_SECRET_PREVIOUS may go (HARDENING.md §0). Cached per warm
     instance, so usually not even a read; never allowed to stop the copy. */
  try { const { ring } = await import('./_seal.mjs'); await ring(); } catch { /* the copy is not the ring */ }
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
    if (r.failed) console.error('mirrorcron: R2 refused', r.failed, 'copies —', r.err || '(no message)', '— check the R2 token can WRITE the bucket');
    console.log('mirrorcron:', JSON.stringify(r), marker ? `(scheduled for ${marker})` : '(no scheduler marker)');
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('mirrorcron failed:', String((e && e.message) || e));
    return new Response('failed', { status: 200 });
  }
};

export const config = { schedule: '*/20 * * * *' };
