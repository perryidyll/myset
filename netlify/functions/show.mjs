import { guard } from './_errlog.mjs';
import { getShow, readFans, publicArtist, json, bad, cleanFanId, markPresence,
         roomHash, clientIp } from './_lib.mjs';
import { readRequests, myRequests } from './_requests.mjs';
import { readFlags, flagsFor } from './_flags.mjs';
import { buildBoard, buildMe, mergeForOne } from './_board.mjs';

/* THE OLD DOOR, KEPT OPEN — /api/show?fan=<id>&in=1

   Since 2026-09-11 the voting page polls /api/board (shared, cached at the edge)
   and /api/me (personal, never cached) instead of this. This endpoint answers the
   shape it always did, composed from the SAME two builders, for two reasons: a phone
   that opened the page before the split deployed keeps polling it for the rest of
   the night, and the test suite exercises the room through it. It is the expensive
   one — twelve shards per phone per poll — and nothing new should be built on it.
   See _board.mjs for why. */
const main = async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const url = new URL(req.url);
  const fanId = cleanFanId(url.searchParams.get('fan'));
  /* `in=1` means "this is a phone in the room", which is only ever sent by the
     voting page. Anything else that reads the board — a test, a preview, a probe —
     must not be counted, or the head-count fills with people who were never there. */
  const inRoom = url.searchParams.get('in') === '1';
  const at = Date.now();                    // before the reads — see buildBoard
  const [show, fans, flagDoc] = await Promise.all([getShow(aid), readFans(aid), readFlags()]);
  /* Don't call markPresence when the stamp is already there. It goes mutateFan ->
     casDoc -> readDoc of the SAME shard `readFans` merged microseconds earlier in
     this very invocation, then returns false and writes nothing — so the answer is
     already in `fans`. This is the same test markPresence applies internally; the
     point is to reach it without paying for the read.

     MEASURED from inside a live function on this account: one strong blob read is
     42ms, and a whole poll bills ~155ms. So this removes ~27% of the billed duration
     of ~99.9% of all polls, which is the largest saving per line of code in the app.
     Presence is best-effort by design (INVARIANT 0af) so a miss is harmless. */
  if (inRoom && fanId) {
    const me0 = fans[fanId];
    const already = me0 && me0.seenShow === show.showId
      && me0.ipH === roomHash(aid, clientIp(req));
    if (!already) await markPresence(aid, fanId, show, req);
  }
  const board = buildBoard({ aid, show, fans, flags: flagsFor(flagDoc, aid), at });
  /* One extra blob read, and only when there is something to read. This endpoint
     is polled by every phone in the room, so nothing goes on it unconditionally. */
  const asking = show.requests.on || show.birthdays.on;
  const myAsks = asking && fanId
    ? myRequests(await readRequests(aid), fanId, show) : [];
  const personal = buildMe({ show, fanId, me: fans[fanId] || null, myAsks });
  return json(mergeForOne(board, personal));
};
export default guard('show', main);
