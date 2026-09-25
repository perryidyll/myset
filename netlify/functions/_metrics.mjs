import { occurrences, placeNight, happened, judgeRow, EARLY_MS } from './_nightrule.mjs';

/* THE SNAPSHOT BEHIND "CURRENT SHOW STATS" (the founder, 2026-09-14): every
   performance number MySet can state, for any range of days, from the records the
   app keeps — never a guess, never a device, never an address.

   Pure. This module is handed the documents (the registries, each artist's filed
   nights, payments cache, posts, RSVPs and calendar) and returns one JSON
   snapshot that a page can slice by date in the browser. Two callers: the CLI
   `tools/metrics.mjs` (reads production with the Netlify CLI, read-only, and fills
   the page template — the daily artifact) and, when the page lives at
   myset.vip/metrics, a function that reads the same documents with `readDoc`.

   WHICH NIGHTS COUNT — since decision 0095 the one rule in `_nightrule.mjs`, shared
   with the register (myset.vip/shows), the Google Sheet and, by test, the tracker: a
   night is REAL when it started on a published gig day, no earlier than ninety
   minutes before the slot and no later than the slot's end — and something happened
   in it, and none of the fences (a load test, a demo, a show that never ended) fit.
   Anything else is a test or an accident, however long it ran, and is listed as such
   rather than dropped: the reader can see the rule at work. The helpers this file
   used to own are re-exported so nothing that imported them here has to move. */

export { occurrences, placeNight, happened, EARLY_MS };

/** One artist's documents → their part of the snapshot. */
export function artistPart(aid, { idx, meta, posts, rsvp, ev }) {
  const rows = ((idx && idx.shows) || []).filter((r) => r && r.showId && r.startedAt);
  const span = rows.length ? [Math.min(...rows.map((r) => r.startedAt)), Math.max(...rows.map((r) => r.endedAt || r.startedAt))] : [Date.now(), Date.now()];
  const occs = occurrences((ev && ev.list) || [], Math.min(span[0], Date.now() - 120 * 86400e3), Math.max(span[1], Date.now() + 30 * 86400e3));
  const events = (ev && ev.list) || [];
  const judge = { hasCalendar: events.length > 0, tz: (events.find((e) => e && e.tz) || {}).tz || 'UTC' };
  const nights = rows.map((r) => {
    const { gig, status, why } = judgeRow(r, occs, judge);
    return {
      aid, showId: r.showId, startedAt: r.startedAt, endedAt: r.endedAt || null,
      hours: r.endedAt ? Math.round((r.endedAt - r.startedAt) / 36e4) / 10 : null,
      venue: r.venue || '', city: r.city || '', title: r.title || '',
      songsPlayed: r.songsPlayed || 0, totalVotes: r.totalVotes || 0, peakVoters: r.peakVoters || 0,
      room: r.room || 0, nets: r.nets || 0, gross: Number(r.gross) || 0, unattributed: Number(r.unattributed) || 0,
      source: r.source || null, top: r.top || null, paidVotes: r.paidVotes ?? null,
      gig, real: status === 'counted', status, why,
    };
  }).sort((a, b) => a.startedAt - b.startedAt);
  const money = [];
  const m = meta || {};
  for (const t of m.tips || []) if (t && t.at) money.push({ aid, t: t.at, kind: 'tip', amount: Number(t.amount) || 0 });
  for (const p of Object.values(m.paid || {})) {
    if (!p || !p.at || p.kind === 'tip') continue;
    money.push({ aid, t: p.at, kind: p.kind === 'merch' ? 'order' : (p.kind === 'votes' || p.kind === 'song_votes' ? 'pack' : String(p.kind || 'paid')), amount: Number(p.amount) || 0, votes: p.granted || 0 });
  }
  const postsOut = ((posts && posts.list) || []).filter((p) => p && p.at).map((p) => ({ aid, t: p.at, stars: p.stars || null, hidden: !!p.hidden }));
  const rsvps = [];
  for (const [occ, o] of Object.entries((rsvp && rsvp.occ) || {})) for (const t of Object.values((o && o.fans) || {})) rsvps.push({ aid, occ, t });
  const now = Date.now();
  const gigs = occs.filter((o) => o.endsAt >= now - 120 * 86400e3).map((o) => ({ aid, eventId: o.eventId, date: o.date, venue: o.venue || '', startsAt: o.startsAt, endsAt: o.endsAt }));
  return { nights, money, posts: postsOut, rsvps, gigs };
}

/** The whole snapshot. `registry` is the artists document, `venues` the venues one,
 *  `parts` the per-artist documents keyed by id. Never an email, never a device. */
export function buildSnapshot({ registry, venues, parts, now = Date.now() }) {
  const artists = Object.entries((registry && registry.byId) || {}).map(([id, a]) => ({
    id, slug: a.slug || '', name: a.name || '', plan: a.plan || 'free', createdAt: a.createdAt || null, verified: !!a.verified,
  }));
  const vens = Object.entries((venues && venues.byId) || {}).map(([id, v]) => ({
    id, slug: v.slug || '', name: v.name || '', createdAt: v.createdAt || null, plan: v.plan || 'free', verified: !!v.verified,
  }));
  const out = { v: 1, generatedAt: now, artists, venues: vens, nights: [], money: [], posts: [], rsvps: [], gigs: [] };
  for (const a of artists) {
    const p = artistPart(a.id, parts[a.id] || {});
    for (const k of ['nights', 'money', 'posts', 'rsvps', 'gigs']) for (const x of p[k]) out[k].push(x);
  }
  out.nights.sort((a, b) => a.startedAt - b.startedAt);
  return out;
}
