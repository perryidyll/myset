import { guard } from './_errlog.mjs';
import { KEY, getShowKept, readDoc, shardOf, publicArtist, json, bad, cleanFanId,
         markPresence, roomHash, clientIp, presenceCurrent, freeVerdict, freeView } from './_lib.mjs';
import { readRequests, myRequests } from './_requests.mjs';
import { buildMe } from './_board.mjs';

/* WHAT IS YOURS — /api/me?fan=<id>&in=1&a=<slug>

   The personal half of the split: this phone's credits, its own votes, its paid
   pack, its request statuses. Never cached, never shared, and small: it reads the
   show record and ONE fan shard — the twelfth of the room this phone lives in —
   where /api/show read all twelve for every phone. The tally, the ranking and
   everything else the whole room sees is on /api/board.

   `in=1` means "this is a phone in the room", which is only ever sent by the voting
   page. Anything else that asks — a test, a preview, a probe — must not be counted,
   or the head-count fills with people who were never there.

   What it reads: the show record and this phone's shard — two strong reads on the
   founding page. A slug artist adds what `publicArtist` reads to turn the slug into
   an id — nothing on a warm instance, the address's two small copies on a cold one,
   the artist list only when they cannot say yes (decision 0176) — and a night with
   requests on adds the requests document. test/cost.mjs holds the founding page to 3. */
const main = async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const url = new URL(req.url);
  const fanId = cleanFanId(url.searchParams.get('fan'));
  if (!fanId) return bad('missing fan');
  const inRoom = url.searchParams.get('in') === '1';
  /* the artist's name is the board's business, so the registry is not read here; and
     the show is asked for on condition, so an unchanged one sends no body (0152) */
  const [show, shard] = await Promise.all([getShowKept(aid),
                                           readDoc(KEY.fan(aid, shardOf(fanId)), {})]);
  const bag = shard.data || {}, net = roomHash(aid, clientIp(req));
  const me = bag[fanId] || null;
  /* Don't call markPresence when the stamp is already there. It goes mutateFan ->
     casDoc -> readDoc of the SAME shard read a line ago, then returns false and
     writes nothing — so the answer is already in `me`. This is the same test
     markPresence applies internally; the point is to reach it without paying for
     the read. Presence is best-effort by design (INVARIANT 0af) so a miss is harmless.
     Since decision 0149 a stamp also falls due now and then (`presenceCurrent`), and
     a phone its network has no room for, with no record, has nothing to write. */
  if (inRoom && !presenceCurrent(me, show, fanId) && (me || freeVerdict(bag, fanId, show, net) === 'in')) {
    const wrote = await markPresence(aid, fanId, show, req);
    if (wrote) bag[fanId] = wrote;
  }
  /* One extra blob read, and only when there is something to read. This endpoint
     is polled by every phone in the room, so nothing goes on it unconditionally. */
  const asking = show.requests.on || show.birthdays.on;
  const myAsks = asking ? myRequests(await readRequests(aid), fanId, show) : [];
  /* What this phone may spend, as the vote will judge it: a phone held out of
     tonight's free votes is shown none (0149, INVARIANT 0ad). */
  return json(buildMe({ show, fanId, me: freeView(bag, fanId, show, net), myAsks }));
};
export default guard('me', main);
