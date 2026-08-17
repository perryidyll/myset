import { getShow, readFans, voteCounts, json, cleanFanId } from './_lib.mjs';

export default async (req) => {
  const fanId = cleanFanId(new URL(req.url).searchParams.get('fan'));
  const [show, fans] = await Promise.all([getShow(), readFans()]);
  const counts = voteCounts(fans);
  const me = fans[fanId] || { v: [], extra: 0 };
  const total = show.freeCredits + (me.extra || 0);
  const used = (me.v || []).length;

  const songs = show.songs
    .filter((s) => s.active !== false)
    .filter((s) => s.id !== show.nowPlaying && !show.played.includes(s.id))
    .map((s) => ({ id: s.id, title: s.title, votes: counts[s.id] || 0, mine: (me.v || []).includes(s.id) }))
    .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title));

  const played = show.played
    .map((id) => show.songs.find((s) => s.id === id)).filter(Boolean)
    .map((s) => ({ id: s.id, title: s.title }));
  const np = show.songs.find((s) => s.id === show.nowPlaying) || null;

  return json({
    ok: true,
    artist: show.artist, venue: show.venue, status: show.status,
    windowOpen: !!show.windowOpen,
    nowPlaying: np ? { id: np.id, title: np.title } : null,
    songs, played,
    credits: { remaining: Math.max(0, total - used), total, used, extra: me.extra || 0 },
    totalVotes: Object.values(counts).reduce((a, b) => a + b, 0),
    paymentsEnabled: !!process.env.STRIPE_SECRET_KEY,
    updatedAt: show.updatedAt,
  });
};
