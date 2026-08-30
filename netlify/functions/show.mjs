import { getShow, readFans, voteCounts, firstVotedAt, creditsUsed, costOf, json, cleanFanId } from './_lib.mjs';

export default async (req) => {
  const fanId = cleanFanId(new URL(req.url).searchParams.get('fan'));
  const [show, fans] = await Promise.all([getShow(), readFans()]);
  const counts = voteCounts(fans);
  const firstAt = firstVotedAt(fans);
  const me = fans[fanId] || { v: [], extra: 0 };
  const mine = me.v || [];
  const total = show.freeCredits + (me.extra || 0);
  const used = creditsUsed(me, show);

  const shape = (s) => ({
    id: s.id, title: s.title, artist: s.artist || '',
    votes: counts[s.id] || 0, mine: mine.includes(s.id), cost: costOf(s.id, show),
    firstAt: firstAt[s.id] || null,
  });

  // songs still to play
  const songs = show.songs
    .filter((s) => s.active !== false)
    .filter((s) => s.id !== show.nowPlaying && !show.played.includes(s.id))
    .map(shape)
    // most votes first; equal votes -> whoever was voted for first; then A–Z
    .sort((a, b) =>
      b.votes - a.votes ||
      (a.firstAt || Number.MAX_SAFE_INTEGER) - (b.firstAt || Number.MAX_SAFE_INTEGER) ||
      a.title.localeCompare(b.title));

  // already played — still votable, at the higher replay cost
  const played = show.played
    .map((id) => show.songs.find((s) => s.id === id))
    .filter(Boolean)
    .map(shape)
    .reverse();

  const np = show.songs.find((s) => s.id === show.nowPlaying) || null;

  return json({
    ok: true,
    artist: show.artist, venue: show.venue, city: show.city, showTime: show.showTime,
    status: show.status, windowOpen: !!show.windowOpen,
    nowPlaying: np ? { id: np.id, title: np.title, artist: np.artist || '' } : null,
    songs, played,
    replayCost: show.replayCost || 5,
    credits: { remaining: Math.max(0, total - used), total, used, extra: me.extra || 0 },
    totalVotes: Object.values(counts).reduce((a, b) => a + b, 0),
    paymentsEnabled: !!process.env.STRIPE_SECRET_KEY,
    updatedAt: show.updatedAt,
  });
};
