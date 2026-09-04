import { json, bad, requireArtist, getShow, readFans, voteCounts } from './_lib.mjs';
import { readHistIndex, readHistShow, reconcileShow, moneyForShow, healHistory } from './_history.mjs';

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
    /* "Find my missing shows" in the Studio. Forced, so it runs again even after
       the automatic one has stamped the index — the artist asked. */
    if (body.action === 'heal') return json({ ok: true, ...(await healHistory(aid, { force: true })) });
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

  /* Once per artist, ever: fold in nights that were archived but never indexed, and
     the ones still sitting under the pre-multi-tenancy flat keys. It stamps the index
     when it is done and costs one document read on every call after that. */
  await healHistory(aid).catch(() => {});
  const [idx, show, fans] = await Promise.all([readHistIndex(aid), getShow(aid), readFans(aid)]);
  const counts = voteCounts(fans);
  const leftover = Object.values(counts).reduce((a, b) => a + b, 0);
  /* No showId or no start time means there is no night to price yet, and asking
     anyway cost up to ten Stripe round-trips on every load of the Money tab. */
  const money = (show.showId && show.startedAt)
    ? await moneyForShow(aid, show.showId, show.startedAt, Date.now())
        .catch(() => ({ gross: 0, unattributed: 0, source: 'stripe-unreachable' }))
    : { gross: 0, unattributed: 0, source: 'none' };
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

  /* Hide tonight's row only while tonight is actually RUNNING — it is shown above
     as "Tonight so far" and would otherwise appear twice. The old test was
     `status === 'ended'`, so tapping "Resume it instead" on a finished night (same
     showId, status back to live... and then ended again, or left at 'pre') made the
     archived row disappear from Past shows with no explanation. */
  return json({
    ok: true,
    live,
    shows: show.status === 'live' ? idx.shows.filter((s) => s.showId !== show.showId) : idx.shows,
  });
};
