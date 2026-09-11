import { guard } from './_errlog.mjs';
import { getShow, readFans, publicArtist, bad } from './_lib.mjs';
import { readFlags, flagsFor } from './_flags.mjs';
import { buildBoard } from './_board.mjs';

/* THE SHARED BOARD — /api/board?a=<slug>

   The same bytes for every phone in the room, and NO fan id in the address, which is
   the whole point: Netlify's edge caches by URL, so ten thousand phones asking for an
   identical URL collapse into one function call per polling interval instead of ten
   thousand. INVARIANT 0ep is what happened when caching was tried on the old,
   per-fan URL — nothing collapsed, because nothing was identical. And 9d6 is why the
   address carries ONLY `?a=`: `Netlify-Vary` is silently ignored through the
   /api/* rewrite, so the URL alone has to be the key.

   Everything personal — credits, own votes, paid packs, request statuses — is on
   /api/me, which is never cached. public/vote.html polls both and puts them back
   together on the phone. If /api/me fails, the board still renders; if this fails,
   the page keeps the last board it had. Either way the room can still vote. */
const main = async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const at = Date.now();                    // before the reads — see buildBoard
  const [show, fans, flagDoc] = await Promise.all([getShow(aid), readFans(aid), readFlags()]);
  const board = buildBoard({ aid, show, fans, flags: flagsFor(flagDoc, aid), at });
  /* CACHED FOR AS LONG AS THE ROOM IS TOLD TO WAIT. `nextPollMs` is the interval
     the server hands every phone (pollFloorFor), so a copy served from the edge is
     at most one interval old — two while it is being replaced, because the
     stale-while-revalidate of the same length is what stops the moment the copy
     expires from turning into a stampede: one request goes to the function, the
     rest are served the copy until the new one lands. A phone on the ladder's
     slowest rung looks twenty intervals apart, so nothing here is older than what
     the room already accepts.

     `durable` puts the copy in the cache every edge node shares, so the audience bag
     is read once per interval for the whole room rather than once per node — and
     INVARIANT 9d6 is the finding that the durable cache works for Functions (and not
     for Edge Functions, which is why this is one).

     MEASURED on draft deploys and then on production, 2026-09-11: the durable cache
     ignores a lifetime under 10 seconds — 3 to 9 all answered `"Netlify Durable";
     fwd=bypass`, 10 and 60 answered `hit` with a ttl, in every spelling (max-age,
     s-maxage, with or without stale-while-revalidate). Under 10 the copy still lives
     on each edge node: a 3s copy was `"Netlify Edge"; hit; ttl=2` on the same
     connection and a miss from the next node. That is why the middle rung of
     pollFloorFor is 10s and not 5s (see _lib.mjs): a room over 200 phones gets one
     render per interval for everybody; a pub at 3s gets per-node copies, which at
     that size costs cents either way and keeps the tally live.

     The browser is told `max-age=0, must-revalidate`: it may not keep a copy of its
     own, because the page's ladder decides when to look, not the browser's cache.
     Cache HITs are still billed as web requests (0ep) — what this removes is the
     compute and the twelve-shard read behind every one of them, which is the wall. */
  const ttl = Math.max(1, Math.round(board.nextPollMs / 1000));
  return new Response(JSON.stringify(board), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': `public, durable, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
      'access-control-allow-origin': '*',
    },
  });
};
export default guard('board', main);
