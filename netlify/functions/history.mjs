import { json, bad, requireArtist, getShow, readFans, voteCounts } from './_lib.mjs';
import { readHistIndex, readHistShow, reconcileShow, moneyForShow } from './_history.mjs';

/* Artist-only. GET lists past shows (or one in detail); POST re-pulls Stripe for
   a single show. The show currently running is included as a live preview so the
   artist can see tonight's numbers before he ends it. */
export default async (req) => {
  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  const aid = me.aid;
  const url = new URL(req.url);

  if (req.method === 'POST') {
    let body = {};
    try { body = await req.json(); } catch { return bad('bad json'); }
    if (body.action !== 'reconcile') return bad('unknown action');
    const d = await reconcileShow(aid, String(body.show || ''));
    if (!d) return bad('unknown show', 404);
    return json({ ok: true, show: d });
  }

  const wanted = url.searchParams.get('show');
  if (wanted) {
    const d = await readHistShow(aid, wanted);
    if (!d) return bad('unknown show', 404);
    return json({ ok: true, show: d });
  }

  const [idx, show, fans] = await Promise.all([readHistIndex(aid), getShow(aid), readFans(aid)]);
  const counts = voteCounts(fans);
  const leftover = Object.values(counts).reduce((a, b) => a + b, 0);
  const money = await moneyForShow(aid, show.showId, show.startedAt, Date.now());
  const ended = show.status === 'ended';
  const live = {
    showId: show.showId, venue: show.venue, city: show.city,
    startedAt: show.startedAt, endedAt: null, live: true, status: show.status,
    songsPlayed: (show.log || []).length,
    totalVotes: (show.log || []).reduce((a, e) => a + (e.roundVotes ?? e.votes ?? 0), 0) + leftover,
    peakVoters: Math.max(
      Object.values(fans).filter((f) => (f.v || []).length).length,
      ...(show.log || []).map((e) => e.voters || 0), 0),
    gross: money.gross,
    unattributed: money.unattributed,
  };

  // once it's ended it has already been archived, so let him open it properly
  return json({
    ok: true,
    live,
    shows: ended ? idx.shows : idx.shows.filter((s) => s.showId !== show.showId),
  });
};
