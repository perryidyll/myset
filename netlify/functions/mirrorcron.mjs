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
      /* A sample page is a real account that is not on the list yet (0101): its
         documents sit under the same keys, and only `samplereg` knows it exists.
         Until 2026-10-02 the walk read the two registries alone, so no sample had
         a second home (0146). */
      owners: async () => {
        const { readArtists } = await import('./_auth.mjs');
        const { readVenues } = await import('./_venues.mjs');
        const { readSampleReg } = await import('./_sample.mjs');
        const [a, v, s] = await Promise.all([readArtists(), readVenues(), readSampleReg()]);
        const samples = Object.keys(s.byId || {}).map((o) => (o.startsWith('v_') ? `v:${o.slice(2)}` : o));
        return [...new Set([...Object.keys(a.byId || {}), ...Object.keys(v.byId || {}).map((vid) => `v:${vid}`), ...samples])];
      },
      keysOf: async (owner) => {
        if (owner.startsWith('v:')) { const { keysForVenue } = await import('./_venueaccount.mjs'); return keysForVenue(owner.slice(2)); }
        const { keysFor } = await import('./_account.mjs');
        const { cityKeysOf } = await import('./_featured.mjs');
        /* A city's featured slots belong to the city, so they are not in keysFor
           (deleting one artist must not delete them); they are copied with every
           artist who bought one, which names them without a list(). */
        return [...(await keysFor(owner)), ...(await cityKeysOf(owner).catch(() => []))];
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
