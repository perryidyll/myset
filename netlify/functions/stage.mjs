import { getShow, readFans, readMeta, voteCounts, firstVotedAt, rankSongs, json, bad,
         requireArtist, roomCounts, GENRES } from './_lib.mjs';
import { readRequests, shapeRequests } from './_requests.mjs';

export default async (req) => {
  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  return json(await stagePayload(me.aid));
};

/** Shared so a write can return the new state instead of forcing a second fetch. */
export async function stagePayload(aid) {
  const [show, fans, meta, reqs] = await Promise.all([
    getShow(aid), readFans(aid), readMeta(aid), readRequests(aid)]);
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
    },
    // the genre vocabulary, so the Setlist tab can render chips and filter by them
    tags: { builtin: GENRES.map(([id, label]) => ({ id, label })), own: show.tags },
    voters: Object.values(fans).filter((f) => (f.v || []).length).length,
    // phones in the room tonight, not just phones that voted
    room: room.phones,
    nets: room.nets,
    asks: shapeRequests(reqs, show),
    songs: rankSongs(
      show.songs.map((x) => ({
        ...x, votes: counts[x.id] || 0,
        played: show.played.includes(x.id), now: show.nowPlaying === x.id,
      })), counts, firstAt),
    tips: { total: Math.round(total * 100) / 100, count: meta.tips.length, recent: meta.tips.slice(-15).reverse() },
    paymentsEnabled: !!process.env.STRIPE_SECRET_KEY,
  };
}
