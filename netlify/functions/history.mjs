import { json, bad, requireArtist, getShow, readFans, voteCounts } from './_lib.mjs';
import { planForArtist, reportsAllowed } from './_plan.mjs';
import { readHistIndex, readHistShow, reconcileShow, moneyForShow, refreshShowMoney, healHistory, placeShows, renameShow } from './_history.mjs';

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
    /* "Name these from my calendar" in the Studio — see placeShows. */
    if (body.action === 'place') return json({ ok: true, ...(await placeShows(aid)) });
    /* A tap on a night's name in the Studio — see renameShow. Cut to 100 here so
       the reply carries exactly what was kept and the page can show that. */
    if (body.action === 'rename') {
      const title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 100);
      if (!title) return bad('Give the night a name');
      const r = await renameShow(aid, String(body.show || ''), title);
      if (!r) return bad('unknown show', 404);
      return json({ ok: true, ...r });
    }
    if (body.action !== 'reconcile') return bad('unknown action');
    const d = await reconcileShow(aid, String(body.show || ''));
    if (!d) return bad('unknown show', 404);
    return json({ ok: true, show: d });
  }

  /* DATA REPORTS ARE A BAR STAR FEATURE (decision 0060, 2026-09-13). Every night is
     still filed on every plan; what the plan buys is reading it back. A free plan
     gets the running night (its money is its money) and the COUNT of filed nights —
     the Studio says "N nights are waiting" over the upgrade — but not the rows,
     and not a night's detail. Refused here as well as greyed in the Studio (15k). */
  const reports = reportsAllowed(aid, (await planForArtist(aid)).limits);
  const LOCKED = 'Data reports are a Bar Star feature — every night is still filed, and upgrading opens all of them.';

  const wanted = url.searchParams.get('show');
  if (wanted) {
    if (!reports) return bad(LOCKED, 402);
    const d = await readHistShow(aid, wanted);
    if (!d) return bad('unknown show', 404);
    return json({ ok: true, show: d });
  }
  /* The night's event log (decision 0066): every vote, play and dollar in order.
     Same door as the detail — it is a data report. */
  const logWanted = url.searchParams.get('log');
  if (logWanted) {
    if (!reports) return bad(LOCKED, 402);
    const { readEventLog } = await import('./_evlog.mjs');
    const log = await readEventLog(aid, String(logWanted).slice(0, 40));
    if (!log.n) return bad('no log for that night', 404);
    return json({ ok: true, log });
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
  /* THE TILE AND THE BOOK MUST AGREE. The night above is priced start→now, so a
     tip that arrives after the show ended (still tagged with its id — see
     moneyWindowEnd) shows in "Taken" at once; the filed row was priced when the
     show ended and would never learn. When they differ, the row and the detail
     take the fresh figure here — one read of Stripe draws the tile AND keeps the
     book — so profit, the reports and the tile are the same money. Only a figure
     Stripe actually answered may overwrite the row: 'off' and 'stripe-unreachable'
     are not answers. */
  if (show.status !== 'live' && money.source === 'stripe') {
    const row = idx.shows.find((s) => s.showId === show.showId);
    if (row && (row.gross !== money.gross || row.source !== 'stripe' || (row.unattributed || 0) !== (money.unattributed || 0))) {
      const fresh = await refreshShowMoney(aid, show.showId, money).catch(() => null);
      if (fresh) Object.assign(row, fresh);
    }
  }
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
  const shows = show.status === 'live' ? idx.shows.filter((s) => s.showId !== show.showId) : idx.shows;
  if (!reports) return json({ ok: true, live, locked: 'plus', nights: shows.length, shows: [] });
  return json({ ok: true, live, shows });
};
