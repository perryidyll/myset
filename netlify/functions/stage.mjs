import { getShow, readFans, readMeta, voteCounts, firstVotedAt, rankSongs, json, bad, checkAdmin } from './_lib.mjs';

export default async (req) => {
  if (!checkAdmin(req)) return bad('unauthorized', 401);
  const [show, fans, meta] = await Promise.all([getShow(), readFans(), readMeta()]);
  const counts = voteCounts(fans);
  const firstAt = firstVotedAt(fans);
  const total = meta.tips.reduce((a, t) => a + (Number(t.amount) || 0), 0);

  return json({
    ok: true,
    show: {
      artist: show.artist, venue: show.venue, city: show.city, showTime: show.showTime, status: show.status,
      windowOpen: !!show.windowOpen, nowPlaying: show.nowPlaying,
      played: show.played, freeCredits: show.freeCredits, replayCost: show.replayCost,
    },
    voters: Object.values(fans).filter((f) => (f.v || []).length).length,
    songs: rankSongs(
      show.songs.map((x) => ({
        ...x, votes: counts[x.id] || 0,
        played: show.played.includes(x.id), now: show.nowPlaying === x.id,
      })), counts, firstAt),
    tips: { total: Math.round(total * 100) / 100, count: meta.tips.length, recent: meta.tips.slice(-15).reverse() },
    paymentsEnabled: !!process.env.STRIPE_SECRET_KEY,
  });
};
