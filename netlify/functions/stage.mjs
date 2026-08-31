import { getShow, readFans, readMeta, voteCounts, firstVotedAt, rankSongs, json, bad,
         requireArtist, roomCounts, GENRES, playable } from './_lib.mjs';
import { readLists, readLearn, shapeLists } from './_lists.mjs';
import { readRequests, shapeRequests } from './_requests.mjs';

export default async (req) => {
  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  return json(await stagePayload(me.aid));
};

/** Shared so a write can return the new state instead of forcing a second fetch. */
export async function stagePayload(aid) {
  const [show, fans, meta, reqs, lists, learn] = await Promise.all([
    getShow(aid), readFans(aid), readMeta(aid), readRequests(aid),
    readLists(aid), readLearn(aid)]);
  const { artistById } = await import('./_auth.mjs');
  const who = await artistById(aid);
  const counts = voteCounts(fans);
  const firstAt = firstVotedAt(fans);
  const room = roomCounts(fans);
  const total = meta.tips.reduce((a, t) => a + (Number(t.amount) || 0), 0);

  return {
    ok: true,
    show: {
      artist: show.artist, venue: show.venue, city: show.city, showTime: show.showTime, status: show.status,
      windowOpen: !!show.windowOpen, nowPlaying: show.nowPlaying,
      played: show.played, freeCredits: show.freeCredits, replayCost: show.replayCost,
      packs: show.packs, showId: show.showId, startedAt: show.startedAt,
      artistId: aid, slug: (who && who.slug) || '',
      unlimited: !!show.unlimited, unlimitedFans: show.unlimitedFans || [],
      requests: show.requests, birthdays: show.birthdays,
      listId: show.listId, listName: show.listName,
    },
    // the genre vocabulary, so the Setlist tab can render chips and filter by them
    tags: { builtin: GENRES.map(([id, label]) => ({ id, label })), own: show.tags },
    lists: shapeLists(lists, show),
    learn: learn.list,
    /* True when the chosen setlist has nothing votable left and the whole library
       is standing in for it. The artist has to be told — silently is worse. */
    listFellBack: playable(show).fellBack,
    voters: Object.values(fans).filter((f) => (f.v || []).length).length,
    // phones in the room tonight, not just phones that voted
    room: room.phones,
    nets: room.nets,
    asks: shapeRequests(reqs, show),
    songs: (() => {
      const on = new Set(playable(show).songs.map((x) => x.id));
      return rankSongs(
        show.songs.map((x) => ({
          ...x, votes: counts[x.id] || 0,
          played: show.played.includes(x.id), now: show.nowPlaying === x.id,
          inSet: on.has(x.id),          // in play tonight
        })), counts, firstAt);
    })(),
    tips: { total: Math.round(total * 100) / 100, count: meta.tips.length, recent: meta.tips.slice(-15).reverse() },
    paymentsEnabled: !!process.env.STRIPE_SECRET_KEY,
  };
}
