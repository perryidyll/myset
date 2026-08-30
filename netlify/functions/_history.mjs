import Stripe from 'stripe';
import { casDoc, readDoc, voteCounts, ARTIST_ID } from './_lib.mjs';

const HIST = (id) => `hist_${id}`;      // flat key — INVARIANT 2
const INDEX = 'hist_index';
const round = (n) => Math.round(n * 100) / 100;

/* Stripe stays the source of truth for money (INVARIANT 5d); this is a cache of
   it that the artist can re-pull at any time. Bounded to the show's own window
   and auto-paged, because sessions.list() does NOT paginate on its own and a
   busy month would silently truncate. */
export async function moneyForShow(showId, fromMs, toMs) {
  const key = process.env.STRIPE_SECRET_KEY;
  const out = {
    currency: 'USD', gross: 0,
    votes: { amount: 0, count: 0 },
    tips: { amount: 0, count: 0, recent: [] },
    unattributed: 0, source: key ? 'stripe' : 'off', reconciledAt: Date.now(),
  };
  if (!key) return out;

  const gte = Math.floor((fromMs || 0) / 1000) - 300;          // 5 min of slack
  const lte = Math.floor((toMs || Date.now()) / 1000) + 3600;  // and an hour after
  const stripe = new Stripe(key);
  let after = null;
  try {
    for (let page = 0; page < 10; page++) {
      const r = await stripe.checkout.sessions.list({
        limit: 100, created: { gte, lte }, ...(after ? { starting_after: after } : {}),
      });
      for (const s of r.data || []) {
        if (s.payment_status !== 'paid') continue;
        const md = s.metadata || {};
        if (md.kind !== 'votes' && md.kind !== 'tip') continue;   // INVARIANT 5d
        const amt = (s.amount_total || 0) / 100;
        if (md.show && md.show !== showId) continue;
        if (!md.show) { out.unattributed = round(out.unattributed + amt); continue; }
        out.gross = round(out.gross + amt);
        if (md.kind === 'votes') {
          out.votes.amount = round(out.votes.amount + amt);
          out.votes.count += 1;
        } else {
          out.tips.amount = round(out.tips.amount + amt);
          out.tips.count += 1;
          out.tips.recent.push({ amount: amt, note: md.note || '', at: (s.created || 0) * 1000 });
        }
      }
      if (!r.has_more || !r.data.length) break;
      after = r.data[r.data.length - 1].id;
    }
  } catch {
    out.source = 'stripe-unreachable';
  }
  out.tips.recent = out.tips.recent.sort((a, b) => b.at - a.at).slice(0, 12);
  return out;
}

/* Snapshot a finished show. MUST run before wipeFans()/clearAllFanVotes(),
   because those destroy the only copy of the tally. Idempotent: re-archiving an
   already-archived show only refreshes its money block. */
export async function archiveShow(show, fans) {
  const showId = show && show.showId;
  if (!showId) return null;

  const counts = voteCounts(fans || {});
  const byId = Object.fromEntries((show.songs || []).map((s) => [s.id, s]));
  const played = (show.log || []).map((e) => ({ ...e }));
  const playedIds = new Set(played.map((p) => p.songId));

  /* Everything the room asked for and never got — summed across every round,
     not just what was still on screen at the end. Votes are wiped each time a
     song starts, so the per-round snapshots are the only record. */
  const wanted = {};
  const want = (id, title, artist, n) => {
    if (playedIds.has(id) || !n) return;
    (wanted[id] ||= { songId: id, title: title || id, artist: artist || '', votes: 0 }).votes += n;
  };
  for (const e of played) for (const r of e.round || []) want(r.songId, r.title, r.artist, r.votes);
  for (const id of Object.keys(counts)) want(id, (byId[id] || {}).title, (byId[id] || {}).artist, counts[id]);
  const requested = Object.values(wanted)
    .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title));

  const nowVoters = Object.values(fans || {}).filter((f) => (f.v || []).length).length;
  const peakVoters = Math.max(nowVoters, ...played.map((p) => p.voters || 0), 0);
  const leftover = Object.values(counts).reduce((a, b) => a + b, 0);
  // roundVotes counts every vote in that round; older entries only have the winner's
  const totalVotes = played.reduce((a, p) => a + (p.roundVotes ?? p.votes ?? 0), 0) + leftover;
  const top = [...played].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0] || requested[0] || null;
  const endedAt = Date.now();

  const money = await moneyForShow(showId, show.startedAt, endedAt);

  const doc = {
    v: 1, showId, artistId: show.artistId || ARTIST_ID,
    venue: show.venue || '', city: show.city || '', showTime: show.showTime || '',
    startedAt: show.startedAt || null, endedAt,
    played, requested,
    stats: {
      songsPlayed: played.length,
      totalVotes,
      peakVoters,
      topSong: top ? { songId: top.songId, title: top.title, votes: top.votes || 0 } : null,
    },
    money,
    archivedAt: endedAt,
  };

  await casDoc(HIST(showId), () => ({}), (d) => {
    if (d && d.showId) {           // already archived — only refresh the money
      d.money = money; d.archivedAt = endedAt; return true;
    }
    Object.assign(d, doc); return true;
  }).catch(() => {});

  await casDoc(INDEX, () => ({ shows: [] }), (idx) => {
    idx.shows ||= [];
    const row = {
      showId, venue: doc.venue, city: doc.city,
      startedAt: doc.startedAt, endedAt,
      songsPlayed: doc.stats.songsPlayed, totalVotes: doc.stats.totalVotes,
      peakVoters: doc.stats.peakVoters, gross: money.gross,
    };
    const at = idx.shows.findIndex((x) => x.showId === showId);
    if (at >= 0) idx.shows[at] = row; else idx.shows.unshift(row);
    idx.shows.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    idx.shows = idx.shows.slice(0, 100);
    return true;
  }).catch(() => {});

  return doc;
}

export async function readHistIndex() {
  const { data } = await readDoc(INDEX, { shows: [] });
  return { shows: (data && data.shows) || [] };
}
export async function readHistShow(showId) {
  const { data } = await readDoc(HIST(showId), null);
  return data;
}
export async function reconcileShow(showId) {
  const doc = await readHistShow(showId);
  if (!doc) return null;
  const money = await moneyForShow(showId, doc.startedAt, doc.endedAt);
  await casDoc(HIST(showId), () => ({}), (d) => {
    if (!d || !d.showId) return false;
    d.money = money; return true;
  }).catch(() => {});
  await casDoc(INDEX, () => ({ shows: [] }), (idx) => {
    const row = (idx.shows || []).find((x) => x.showId === showId);
    if (row) row.gross = money.gross;
    return true;
  }).catch(() => {});
  return { ...doc, money };
}
