import Stripe from 'stripe';
import { casDoc, readDoc, voteCounts, roomCounts, KEY, DEFAULT_ARTIST } from './_lib.mjs';

const HIST = KEY.hist;                  // flat key — INVARIANT 2
const INDEX = KEY.histIdx;
const round = (n) => Math.round(n * 100) / 100;

/* Stripe stays the source of truth for money (INVARIANT 5d); this is a cache of
   it that the artist can re-pull at any time. Bounded to the show's own window
   and auto-paged, because sessions.list() does NOT paginate on its own and a
   busy month would silently truncate. */
export async function moneyForShow(aid, showId, fromMs, toMs) {
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
  /* Scoped, for the same reason revenue.mjs is: without it a connected artist's
     night was archived as gross 0 with source:'stripe' — claiming Stripe was asked
     and reported nothing, rather than admitting we looked on the wrong account. */
  const { stripeFor } = await import('./_connect.mjs');
  const { stripe: scoped, opts: sOpts } = await stripeFor(aid);
  const stripe = scoped || new Stripe(key);
  let after = null;
  try {
    for (let page = 0; page < 10; page++) {
      const r = await stripe.checkout.sessions.list({
        limit: 100, created: { gte, lte }, ...(after ? { starting_after: after } : {}),
      }, sOpts);
      for (const s of r.data || []) {
        if (s.payment_status !== 'paid') continue;
        const md = s.metadata || {};
        if (md.kind !== 'votes' && md.kind !== 'tip') continue;   // INVARIANT 5d
        /* And it has to be THIS artist's. This was the one Stripe consumer of four
           that did not check — so with a colliding showId (they used to collide;
           see newShowId) another artist's takings were reported as yours. Untagged
           sessions predate artist tagging and belong to the founding artist, the
           same convention confirm.mjs, webhook.mjs and revenue.mjs use. */
        if ((md.artist || DEFAULT_ARTIST) !== aid) continue;
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
export async function archiveShow(aid, show, fans) {
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
  /* A NIGHT WHERE NOTHING HAPPENED IS NOT A NIGHT. A show that never went live, or
     went live and had no song started, no vote cast and no phone in the room, would
     otherwise land in the history as a row of zeros — and on the public page as
     "Shows: 1". That was always possible on a first "New show"; now that a gig on
     the calendar can start a show by itself (_auto.mjs), a night the artist never
     turned up to would do it routinely. Nothing to archive means nothing archived. */
  const phones = roomCounts(fans || {}).phones;
  if (show.status === 'pre' || (!played.length && !leftover && !phones)) return null;
  // roundVotes counts every vote in that round; older entries only have the winner's
  const totalVotes = played.reduce((a, p) => a + (p.roundVotes ?? p.votes ?? 0), 0) + leftover;
  const top = [...played].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0] || requested[0] || null;
  const endedAt = Date.now();

  const room = roomCounts(fans || {});
  const money = await moneyForShow(aid, showId, show.startedAt, endedAt);

  const doc = {
    v: 1, showId, artistId: aid,
    venue: show.venue || '', city: show.city || '', showTime: show.showTime || '',
    startedAt: show.startedAt || null, endedAt,
    played, requested,
    stats: {
      songsPlayed: played.length,
      totalVotes,
      peakVoters,
      // phones that were in the room, not just phones that tapped
      room: room.phones,
      nets: room.nets,
      topSong: top ? { songId: top.songId, title: top.title, votes: top.votes || 0 } : null,
    },
    money,
    archivedAt: endedAt,
  };

  await casDoc(HIST(aid, showId), () => ({}), (d) => {
    if (d && d.showId) {
      /* Already archived. The guard exists because re-archiving AFTER the tally was
         wiped would overwrite a real night with zeroes (INVARIANT 17c) — but it was
         absolute, so an artist who ended the show by accident, carried on for eight
         more songs and ended again kept the FIVE-song snapshot forever, while the
         index row got the thirteen-song stats. The detail and the index disagreed
         and the later half of the night was gone.
         So: replace when the new snapshot is strictly richer, refresh money only
         when it is not. Both protections, no loss. */
      const richer = (doc.played || []).length > (d.played || []).length
        || (doc.stats.totalVotes || 0) > ((d.stats || {}).totalVotes || 0);
      if (!richer) { d.money = money; d.archivedAt = endedAt; return true; }
      Object.assign(d, doc); return true;
    }
    Object.assign(d, doc); return true;
  }).catch(() => {});

  await casDoc(INDEX(aid), () => ({ shows: [] }), (idx) => {
    idx.shows ||= [];
    const row = {
      showId, venue: doc.venue, city: doc.city,
      startedAt: doc.startedAt, endedAt,
      songsPlayed: doc.stats.songsPlayed, totalVotes: doc.stats.totalVotes,
      peakVoters: doc.stats.peakVoters, room: doc.stats.room, gross: money.gross,
      /* INVARIANT 0ae calls the network count "the only defence against one phone
         rotating its id", and it was missing from this row — which is the row
         _vstats.mjs and _pitch.mjs read. So the number shown to a venue, and the
         number an artist pitches with, had no sanity check available beside it. */
      nets: doc.stats.nets,
    };
    const at = idx.shows.findIndex((x) => x.showId === showId);
    if (at >= 0) idx.shows[at] = row; else idx.shows.unshift(row);
    idx.shows.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    idx.shows = idx.shows.slice(0, 100);
    return true;
  }).catch(() => {});

  return doc;
}

export async function readHistIndex(aid) {
  const { data } = await readDoc(INDEX(aid), { shows: [] });
  return { shows: (data && data.shows) || [] };
}
export async function readHistShow(aid, showId) {
  const { data } = await readDoc(HIST(aid, showId), null);
  return data;
}
export async function reconcileShow(aid, showId) {
  const doc = await readHistShow(aid, showId);
  if (!doc) return null;
  const money = await moneyForShow(aid, showId, doc.startedAt, doc.endedAt);
  await casDoc(HIST(aid, showId), () => ({}), (d) => {
    if (!d || !d.showId) return false;
    d.money = money; return true;
  }).catch(() => {});
  await casDoc(INDEX(aid), () => ({ shows: [] }), (idx) => {
    const row = (idx.shows || []).find((x) => x.showId === showId);
    if (row) row.gross = money.gross;
    return true;
  }).catch(() => {});
  return { ...doc, money };
}
