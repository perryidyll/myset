import { guard } from './_errlog.mjs';
import { json, readDoc } from './_lib.mjs';
import { readArtists } from './_auth.mjs';

/* IS A SHOW ON RIGHT NOW? — for the deploy hold (decision 0196).

   Merging to main is the production deploy, and a deploy swaps the code under every
   room that is open. Netlify asks this address before it builds production
   (`tools/hold.sh`, the build's ignore command) and the outside watch asks it before
   it releases a held build (.github/workflows/watch.yml). Counts only — no names.

   The live mark is the artist's own show record (decision 0154): one read per artist
   from the registry, LIVE_POOL at a time, inside LIVE_READ_MS. `sure` is false when
   a record could not be read in time, and the two callers treat "not sure" as
   "a show may be live": a build waits a few minutes more rather than landing on a
   room. Never cached: a hold decided on a stale answer is no hold. */
export const LIVE_READ_MS = 8000;
const LIVE_POOL = 8;

export async function countLive({ now = Date.now(), deadline = now + LIVE_READ_MS } = {}) {
  const reg = await readArtists();
  const ids = Object.keys((reg && reg.byId) || {});
  const queue = ids.slice();
  let live = 0, read = 0, unread = 0;
  const worker = async () => {
    while (queue.length) {
      if (Date.now() > deadline) { unread += queue.length; queue.length = 0; return; }
      const aid = queue.shift();
      try {
        const s = (await readDoc(`show_${aid}`, null)).data;
        read += 1;
        if (s && s.status === 'live') live += 1;
      } catch (e) { unread += 1; console.error('live: could not read', aid, e && e.message); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIVE_POOL, ids.length) }, worker));
  return { live, artists: ids.length, read, unread, sure: unread === 0 };
}

const main = async () => json({ ...(await countLive()), at: Date.now() });
export default guard('live', main);
