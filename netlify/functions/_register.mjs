import { readDoc, casDoc, KEY, DEFAULT_ARTIST } from './_lib.mjs';
import { occurrencesFor, occKey } from './_events.mjs';
import { placeNight, judgeNight, EARLY_MS, MIN_NIGHT_H, MAX_NIGHT_H, LOADTEST_PHONES } from './_nightrule.mjs';
import { localDate, localTime, utcToDate, dayOfWeek } from './_time.mjs';
import { sameVenue, venueKey } from './_venues.mjs';
import { planOf } from './_plan.mjs';

/* EVERY SHOW ON THE PLATFORM — the register (decision 0095, INVARIANT 0gi).

   The founder, 2026-09-25: "a robust system for tracking and reporting the numbers
   from ALL shows from ALL artists … literally the data on every single show on the
   platform — who hosted it (artist & venue), what country/city, how long, how many
   people, how many tips/votes bought/merch bought … an entirely new dashboard for
   this that then feeds into and continuously updates the money model."

   WHAT THIS IS. One row for every night any artist has ever filed, with everything
   the app knows about it, kept in month shards (`register_<YYYY-MM>`), under a small
   head (`register`) that carries the roll-ups — by artist, venue, country, city and
   month — and the exact block of figures the money model's Real shows panel takes.
   The dashboard at /moneymodel/shows reads it; the model reads `act` off it at
   /moneymodel/live.json; the CSV is written from it. Nothing here is typed in.

   WHAT IT IS NOT. Not a second ledger. Every number is read off the record that
   already exists — the filed night (`hist_<aid>_<showId>`, `_history.mjs`), the
   calendar (`ev_<aid>`), the artist's meta (orders), the requests, the ratings, the
   RSVPs, the featured spots — and money is Stripe's answer as the archive kept it,
   or marked unknown. A night whose Stripe lookup failed says so; it is never $0 (the
   rule tools/actuals.py has kept since decision 0031). Nothing about a fan crosses
   into the register: no device id, no email, no tip note, no rating note, no
   birthday name (INVARIANT 9g / 0bu posture; test/everyshow.mjs stringifies the
   whole thing and looks).

   HOW IT IS BUILT. A WALK, never a scan: the two registries name every artist and
   venue, each artist's `histidx_` names their nights and `histids_` every night ever
   filed (the index is capped at 400, the id list is not), so the whole store is
   reachable with computed keys and Blobs `list()` is never called (INVARIANT 1).
   ONE WRITER: the bell (`registercron.mjs`) and the dashboard's Refresh both run
   `foldRegister` under the lock in `registersync`; nothing on the End tap or in the
   scheduler's ring folds anything — they only leave a `regdirty` mark on `gigsched`
   inside a write they already make, and the next ring folds those artists first.
   INCREMENTAL: per artist the fold reads the index, the id list and the calendar
   (three reads); a night's detail is read when it is new or its index row changed
   (`rowSig`), or when the calendar changed (`ev_` etag) — then the five other
   documents are read too. An idle ring is two reads. A ring is time-boxed (BUDGET_MS)
   and carries on next ring from `cursor`; the whole registry is walked at least every
   FULL_EVERY_MS.

   WHAT THE REGISTER REMEMBERS THAT THE STORE FORGETS. Requests (`req_` keeps 80 rows),
   RSVPs (`rsvp_` prunes three days after the gig) and ratings (a device re-rating
   replaces its earlier row) are FROZEN on first observation in `register_work` and
   only ever raised — the index row's own never-go-down rule — because `interactions`
   (votes + requests a phone) is a dial the model takes from here. Since 0095 the
   archive files request and RSVP counts on the night itself; older nights get them
   here. The register is therefore not merely derived, and it is mirrored (0ft).

   WHICH NIGHTS COUNT is the one rule in `_nightrule.mjs`, shared with the stats page,
   the Sheet and (by test) the tracker. Two records inside one slot are ONE night in
   the view and the totals (mergeSplitNights); the shards keep them apart. A night's
   LENGTH is the record unless the record overran the slot — then the later of the
   slot and the last song anyone started. `hidden` (the artist's own Delete on the
   Money tab) is a flag beside the status, not a status: the totals follow the rule on
   both sides, the page greys the row and says how many are hidden.

   WHERE A NIGHT WAS. The lifecycle stamps venue and "City, Country" on the show from
   tonight's calendar gig (0065) and, since 0095, the country, the zone and the plan
   on their own; older nights get them here, in this order: the filed record → the
   gig the night's key names → a venue in the registry with the same name (only when
   exactly one matches, and never against a country the record already names) → the
   tail of the "City, Country" string. The page says which. */

export const HEAD = 'register';
export const WORK = 'register_work';
export const STATE = 'registersync';
export const SHARD = (ym, part = 0) => (part ? `register_${ym}_${part}` : `register_${ym}`);
export const SCHED = 'gigsched';                 // where the lifecycle leaves `regdirty` marks
export const CONCURRENT_ARTISTS = 4;
export const BUDGET_MS = () => Math.max(1500, Number(process.env.MYSET_REGISTER_BUDGET_MS ?? 6000));
export const FULL_EVERY_MS = 6 * 3600e3;         // walk the whole registry at least this often (renames, hides, heals, re-checks leave no mark)
export const RECHECK_AFTER_MS = 10 * 3600e3;     // ask Stripe once more for a night's money, the morning after (late tips, 0ga)
export const RECHECK_UNTIL_MS = 4 * 86400e3;     // …and not for a night older than this
export const RECHECKS_PER_RING = 2;
export const FEE_ASKS_PER_RING = 2;          // older nights asked once for their exact Stripe fee (EVS-005)
export const SHARD_BYTES = 700 * 1024;           // a month past this spills into parts named by the head
export const TOP_SONGS = 25;
export { EARLY_MS, MIN_NIGHT_H, MAX_NIGHT_H, LOADTEST_PHONES };

const round = (n, d = 2) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 10 ** d) / 10 ** d);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const avg = (xs, d = 2) => { const v = xs.filter((x) => x != null && Number.isFinite(x)); return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length, d) : null; };
const sum = (xs) => xs.reduce((a, b) => a + (Number(b) || 0), 0);
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const up = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);

/* ---------- the night as the fold reads it (from the detail, or from the row alone) ---------- */
/** The slim copy of a filed night: everything a row needs, nothing a fan could be recognised by. */
export function slimNight(doc) {
  if (!doc || !doc.showId) return null;
  const st = doc.stats || {}, m = doc.money || {};
  const played = Array.isArray(doc.played) ? doc.played : [];
  const ats = played.map((p) => Number(p && p.at) || 0).filter(Boolean);
  const songs = new Map();
  for (const p of played) {
    const k = str(p.songId || p.title, 60).toLowerCase(); if (!k) continue;
    const s = songs.get(k) || [str(p.title, 80), str(p.artist, 60), 0, 0];
    s[2] += 1; s[3] += num(p.roundVotes ?? p.votes); songs.set(k, s);
  }
  return {
    showId: String(doc.showId), artistId: doc.artistId || '',
    title: str(doc.title, 100), titleByHand: !!doc.titleByHand,
    venue: str(doc.venue, 80), city: str(doc.city, 120), country: str(doc.country, 60), tz: str(doc.tz, 40), plan: str(doc.plan, 10),
    key: doc.key ? String(doc.key).slice(0, 60) : null,
    startedAt: Number(doc.startedAt) || null, endedAt: Number(doc.endedAt) || null,
    startedBy: doc.startedBy || null, endedBy: doc.endedBy || null,
    stats: { songsPlayed: num(st.songsPlayed), totalVotes: num(st.totalVotes), peakVoters: num(st.peakVoters), room: num(st.room), nets: st.nets == null ? null : num(st.nets),
             topSong: st.topSong && st.topSong.title ? { title: str(st.topSong.title, 80), votes: num(st.topSong.votes) } : null },
    money: { source: m.source || null, currency: m.currency || 'USD', reconciledAt: Number(m.reconciledAt) || null,
             gross: num(m.gross), unattributed: num(m.unattributed),
             votes: { amount: num(m.votes && m.votes.amount), count: num(m.votes && m.votes.count), paid: num(m.votes && m.votes.paid) },
             tips: { amount: num(m.tips && m.tips.amount), count: num(m.tips && m.tips.count) },
             requests: { amount: num(m.requests && m.requests.amount), count: num(m.requests && m.requests.count) },
             // Stripe's own fee on the night's payments, when it was read (EVS-005); older records have none yet
             fees: m.fees && typeof m.fees === 'object' ? { usd: num(m.fees.usd), charges: num(m.fees.charges), missing: num(m.fees.missing) } : null },
    requests: doc.requests && typeof doc.requests === 'object' ? { count: num(doc.requests.count), songs: num(doc.requests.songs), birthdays: num(doc.requests.birthdays), vibes: num(doc.requests.vibes), accepted: num(doc.requests.accepted), played: num(doc.requests.played) } : null,
    rsvps: doc.rsvps == null ? null : num(doc.rsvps),
    firstPlayAt: ats.length ? Math.min(...ats) : null, lastPlayAt: ats.length ? Math.max(...ats) : null,
    // the song tallies, for the platform's most-played list — titles the artist typed, never a fan
    songs: Object.fromEntries(songs),
    detail: true,
  };
}
/** A night whose index row exists but whose detail is gone (INVARIANT 0fr's honest limit): the row alone. */
export function slimFromRow(aid, r) {
  return {
    showId: String(r.showId), artistId: aid, title: str(r.title, 100), titleByHand: false,
    venue: str(r.venue, 80), city: str(r.city, 120), country: str(r.country, 60), tz: str(r.tz, 40), plan: str(r.plan, 10), key: r.key || null,
    startedAt: Number(r.startedAt) || null, endedAt: Number(r.endedAt) || null, startedBy: null, endedBy: null,
    stats: { songsPlayed: num(r.songsPlayed), totalVotes: num(r.totalVotes), peakVoters: num(r.peakVoters), room: num(r.room), nets: r.nets == null ? null : num(r.nets), topSong: r.top && r.top.title ? { title: str(r.top.title, 80), votes: num(r.top.votes) } : null },
    money: { source: r.source || null, currency: 'USD', reconciledAt: null, gross: num(r.gross), unattributed: num(r.unattributed),
             votes: { amount: 0, count: 0, paid: num(r.paidVotes) }, tips: { amount: 0, count: r.tipped ? num(r.tipped) : 0 }, requests: { amount: 0, count: num(r.paidRequests) },
             fees: r.stripeFees == null ? null : { usd: num(r.stripeFees), charges: 0, missing: 0 } },
    requests: null, rsvps: null, firstPlayAt: null, lastPlayAt: null, songs: {}, detail: false,
  };
}
/* What of an index row would change a night's row — read the detail again when this changes. */
export const rowSig = (r) => JSON.stringify([r.startedAt, r.endedAt, r.songsPlayed, r.totalVotes, r.room, r.nets, r.peakVoters,
  r.gross, r.unattributed, r.source, r.paidVotes, r.paidRequests, r.tipped, r.stripeFees ?? null, r.title, r.venue, r.city, r.country, r.tz, r.plan, r.key, !!r.hidden]);

/* ---------- where and when ---------- */
const splitCity = (s) => {
  const parts = String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  return parts.length >= 2 ? { city: parts.slice(0, -1).join(', '), country: parts[parts.length - 1] } : { city: parts[0] || '', country: '' };
};
/** The gig this night belongs to (the one rule), with the whole occurrence. */
export function gigOf(night, occs) {
  const p = placeNight(night, occs);
  if (!p) return null;
  const o = occs.find((x) => x.eventId === p.eventId && x.date === p.date) || p;
  return { eventId: o.eventId, date: o.date, key: occKey(o), venue: o.venue || '', city: o.city || '', country: o.country || '', tz: o.tz || 'UTC',
           startsAt: o.startsAt, endsAt: o.endsAt, slotHours: round((o.endsAt - o.startsAt) / 3600e3) };
}
function placeOf(night, gig, venues, calTz = '') {
  const fromCity = splitCity(night.city);
  const matches = night.venue ? venues.filter((v) => sameVenue(v.name, night.venue)) : [];
  const own = night.country || (gig && gig.country) || fromCity.country || '';
  // a registry match is trusted only when it is the only one, and never against a country the record already names
  const byName = matches.length === 1 && (!own || !matches[0].country || matches[0].country === own) ? matches[0] : null;
  const country = night.country || (gig && gig.country) || (byName && byName.country) || fromCity.country || '';
  const city = (gig && gig.city) || (byName && byName.city) || fromCity.city || '';
  const tz = night.tz || (gig && gig.tz) || calTz || '';
  const venue = night.venue || (gig && gig.venue) || '';
  return { venue, city, country, tz, venueId: byName ? byName.id : null,
           placedBy: night.country ? 'record' : gig && gig.country ? 'calendar' : byName && byName.country ? 'venue' : fromCity.country ? 'city' : 'none' };
}

/* ---------- one night → one row ---------- */
/**
 * `n` the slim night; `artist` the registry row (or a tombstone); `ctx` the artist's other
 * documents — occs (expanded calendar), hasCalendar, calTz, meta (orders, tips, paid),
 * reqs, fb, rsvp, feats; `observed` the frozen counts kept for this night (raised here);
 * `venues` the registry as a list; `hidden` whether the artist hid it.
 */
export function buildRow(aid, artist, n, ctx, venues, { observed = null, hidden = false, now = Date.now() } = {}) {
  const st = n.stats, m = n.money;
  const people = st.room > 0 ? st.room : st.peakVoters;
  const votes = st.totalVotes;
  const s0 = n.startedAt, e0 = n.endedAt;
  const recordHours = s0 && e0 && e0 > s0 ? (e0 - s0) / 3600e3 : null;
  const setHours = n.firstPlayAt && n.lastPlayAt && n.lastPlayAt > n.firstPlayAt ? (n.lastPlayAt - n.firstPlayAt) / 3600e3 : null;
  const lastActivityHours = n.lastPlayAt && s0 ? (n.lastPlayAt - s0) / 3600e3 : null;
  const gig = s0 && ctx.hasCalendar ? gigOf({ startedAt: s0 }, ctx.occs) : null;
  const hours = recordHours && gig ? Math.min(recordHours, Math.max(gig.slotHours, lastActivityHours || 0)) : recordHours;
  const place = placeOf(n, gig, venues, ctx.calTz);
  const tz = place.tz || 'UTC';
  const { status, why } = judgeNight({ people, votes, startedAt: s0, endedAt: e0, nets: st.nets, gig, hasCalendar: ctx.hasCalendar, tz });

  /* requests: the count filed with the night (0095) beats the live list, which forgets;
     the frozen observation beats both when it is larger (never-go-down) */
  const reqRows = ((ctx.reqs && ctx.reqs.list) || []).filter((r) => r && r.showId === n.showId);
  const live = { count: reqRows.length, songs: reqRows.filter((r) => r.kind === 'song').length, birthdays: reqRows.filter((r) => r.kind === 'birthday').length, vibes: reqRows.filter((r) => r.kind === 'vibe').length,
                 accepted: reqRows.filter((r) => ['added', 'played'].includes(r.status)).length, played: reqRows.filter((r) => r.status === 'played').length };
  const was = (observed && observed.requests) || {};
  const filed = n.requests || {};
  const requests = {};
  for (const k of ['count', 'songs', 'birthdays', 'vibes', 'accepted', 'played']) requests[k] = up(up(was[k], filed[k]), live[k]);
  requests.known = !!(n.requests || reqRows.length || (was.count != null));
  requests.paid = m.source === 'stripe' ? m.requests.count : null;
  // rating: the observation with the larger n wins; ties go to the fresher read
  const rated = ((ctx.fb && ctx.fb.list) || []).filter((r) => r && r.show === n.showId && Number(r.stars) >= 1);
  const liveRating = rated.length ? { n: rated.length, sum: sum(rated.map((r) => r.stars)) } : null;
  const wasRating = observed && observed.rating && observed.rating.n ? observed.rating : null;
  const rating = liveRating && (!wasRating || liveRating.n >= wasRating.n) ? liveRating : wasRating;
  // rsvps: filed with the night since 0095, else the live count while it lasts; never down
  const liveRsvps = gig ? num((((ctx.rsvp && ctx.rsvp.occ) || {})[`${gig.eventId}|${gig.date}`] || {}).n) : 0;
  const rsvps = up(up(n.rsvps, liveRsvps), observed && observed.rsvps);

  const orders = ((ctx.meta && ctx.meta.orders) || []).filter((o) => o && o.show === n.showId);
  const inWindow = (o) => s0 && Number(o.at) >= s0 && Number(o.at) <= (e0 || s0) + 3600e3;
  const feat = gig ? ((ctx.feats && ctx.feats.list) || []).filter((f) => f && !f.owed && ((f.key && f.key === gig.key) || (f.eventId === gig.eventId && f.date === gig.date))) : [];
  const known = m.source === 'stripe';
  /* the app's own delivery marks, tagged with the night since 0095 — what the room paid
     when Stripe could not be asked (a marker, never the figure the model takes) */
  const tipsTagged = ((ctx.meta && ctx.meta.tips) || []).filter((t) => t && t.show === n.showId);
  const paidTagged = Object.values((ctx.meta && ctx.meta.paid) || {}).filter((p) => p && p.show === n.showId && (p.kind === 'votes' || p.kind === 'song_votes'));
  const plan = n.plan || (artist && artist.plan) || 'free';
  return {
    id: `${aid}|${n.showId}`, showId: n.showId,
    artist: { id: aid, name: artist && !artist.left ? (artist.name || aid) : '', slug: artist && !artist.left ? (artist.slug || '') : '', plan, planStamped: !!n.plan, verified: !!(artist && artist.verified), left: !!(artist && artist.left) },
    title: n.title, venue: place.venue, city: place.city, country: place.country, tz, venueId: place.venueId, venueKey: venueKey(place.venue) || null, placedBy: place.placedBy,
    gig: gig ? { eventId: gig.eventId, date: gig.date, key: gig.key, slotHours: gig.slotHours } : null,
    key: n.key || (gig && gig.key) || null,
    startedAt: s0, endedAt: e0, localDate: s0 ? localDate(s0, tz) : null, localTime: s0 ? localTime(s0, tz) : null,
    weekday: s0 ? dayOfWeek(localDate(s0, tz)) : null, startedBy: n.startedBy, endedBy: n.endedBy,
    hours: round(hours), recordHours: round(recordHours), setHours: round(setHours), lastActivityHours: round(lastActivityHours),
    people, nets: st.nets, peakVoters: st.peakVoters, votes,
    paidVotes: known ? m.votes.paid : null,
    interactions: people ? round((votes + requests.count) / people) : null,
    songsPlayed: st.songsPlayed, topSong: st.topSong,
    requests,
    money: {
      known, source: m.source, currency: m.currency, asOf: m.reconciledAt,
      gross: known ? m.gross : null, unattributed: known ? m.unattributed : null,
      total: known ? round(m.gross + m.unattributed) : null,       // what the room paid through the app, tagged or not — the tracker's `gross`
      tips: { count: known ? m.tips.count : null, amount: known ? m.tips.amount : null },
      packs: { count: known ? m.votes.count - m.requests.count : null, amount: known ? round(m.votes.amount - m.requests.amount) : null, votes: known ? m.votes.paid : null },
      requests: { count: known ? m.requests.count : null, amount: known ? m.requests.amount : null },
      /* Stripe's own processing fee on those payments, exact, when every one came back
         (EVS-005); null for a night filed before fees were read — the register asks again */
      stripeFees: known && m.fees && m.fees.missing === 0 ? round(m.fees.usd, 4) : null,
      /* merch is the app's own order record (written when the session is redeemed, tagged
         with the newest night); goods and postage apart, and "at the show" means during it */
      merch: { orders: orders.length, items: sum(orders.map((o) => o.qty || 1)), goods: round(sum(orders.map((o) => (Number(o.cents) || 0) / 100))),
               postage: round(sum(orders.map((o) => (Number(o.post) || 0) / 100))), amount: round(sum(orders.map((o) => o.amount))),
               atShow: orders.filter(inWindow).length, titles: [...new Set(orders.map((o) => str(o.title, 60)).filter(Boolean))].slice(0, 6) },
      perHead: known && people ? round((m.gross + m.unattributed) / people, 3) : null,
      store: { tips: tipsTagged.length, tipsAmount: round(sum(tipsTagged.map((t) => t.amount))), packs: paidTagged.length, votes: sum(paidTagged.map((p) => p.granted)) },
    },
    featured: feat.length ? { spots: feat.length, cents: sum(feat.map((f) => f.cents)) } : null,
    rating: rating ? { avg: round(rating.sum / rating.n, 1), n: rating.n } : null,
    rsvps,
    status, why, hidden: !!hidden, detail: n.detail !== false,
    sig: null, builtAt: now,
    _observed: { requests: { count: requests.count, songs: requests.songs, birthdays: requests.birthdays, vibes: requests.vibes, accepted: requests.accepted, played: requests.played }, rating: rating || null, rsvps },
  };
}

/* Two records inside one gig — an accidental End then Start — are one night in every
   view and every total. The shards keep the records; this folds them for the reader. */
export function mergeSplitNights(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = r.gig && r.status === 'counted' && !r.hidden ? `${r.artist.id}|${r.gig.eventId}|${r.gig.date}` : r.id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const out = [];
  for (const rs of groups.values()) {
    if (rs.length === 1) { out.push(rs[0]); continue; }
    rs.sort((a, b) => a.startedAt - b.startedAt);
    const a = JSON.parse(JSON.stringify(rs[0]));
    a.mergedFrom = rs.map((r) => r.showId);
    a.endedAt = Math.max(...rs.map((r) => r.endedAt));
    a.people = Math.max(...rs.map((r) => r.people));
    a.nets = Math.max(...rs.map((r) => r.nets || 0)) || null;
    a.votes = sum(rs.map((r) => r.votes)); a.peakVoters = Math.max(...rs.map((r) => r.peakVoters)); a.songsPlayed = sum(rs.map((r) => r.songsPlayed));
    for (const k of ['count', 'songs', 'birthdays', 'vibes', 'accepted', 'played']) a.requests[k] = sum(rs.map((r) => r.requests[k]));
    a.requests.known = rs.some((r) => r.requests.known);
    a.interactions = a.people ? round((a.votes + a.requests.count) / a.people) : null;
    a.recordHours = round((a.endedAt - a.startedAt) / 3600e3);
    a.setHours = Math.max(...rs.map((r) => r.setHours || 0)) || null;
    const lastAct = Math.max(...rs.map((r) => (r.lastActivityHours || 0) + (r.startedAt - a.startedAt) / 3600e3));
    a.lastActivityHours = round(lastAct);
    a.hours = round(Math.min(a.recordHours, Math.max(a.gig.slotHours, lastAct)));
    const known = rs.every((r) => r.money.known);
    const mm = (f) => (known ? round(sum(rs.map(f))) : null);
    /* untagged money is a WINDOW figure (the archive says never to sum it): the two
       windows can overlap, so the merged night takes the larger, not the sum */
    const unattributed = known ? Math.max(...rs.map((r) => r.money.unattributed || 0)) : null;
    a.money = { ...a.money, known, source: known ? 'stripe' : (rs.find((r) => !r.money.known) || a).money.source, asOf: Math.max(...rs.map((r) => r.money.asOf || 0)) || null,
      gross: mm((r) => r.money.gross), unattributed, total: known ? round(sum(rs.map((r) => r.money.gross)) + unattributed) : null,
      tips: { count: mm((r) => r.money.tips.count), amount: mm((r) => r.money.tips.amount) },
      stripeFees: known && rs.every((r) => r.money.stripeFees != null) ? round(sum(rs.map((r) => r.money.stripeFees)), 4) : null,
      packs: { count: mm((r) => r.money.packs.count), amount: mm((r) => r.money.packs.amount), votes: mm((r) => r.money.packs.votes) },
      requests: { count: mm((r) => r.money.requests.count), amount: mm((r) => r.money.requests.amount) },
      merch: { orders: sum(rs.map((r) => r.money.merch.orders)), items: sum(rs.map((r) => r.money.merch.items)), goods: round(sum(rs.map((r) => r.money.merch.goods))), postage: round(sum(rs.map((r) => r.money.merch.postage))),
               amount: round(sum(rs.map((r) => r.money.merch.amount))), atShow: sum(rs.map((r) => r.money.merch.atShow)), titles: [...new Set(rs.flatMap((r) => r.money.merch.titles))].slice(0, 6) },
      store: { tips: sum(rs.map((r) => r.money.store.tips)), tipsAmount: round(sum(rs.map((r) => r.money.store.tipsAmount))), packs: sum(rs.map((r) => r.money.store.packs)), votes: sum(rs.map((r) => r.money.store.votes)) } };
    a.money.perHead = known && a.people ? round(a.money.total / a.people, 3) : null;
    a.paidVotes = known ? sum(rs.map((r) => r.paidVotes)) : null;
    const rated = rs.filter((r) => r.rating);
    a.rating = rated.length ? (() => { const n = sum(rated.map((r) => r.rating.n)); return { avg: round(sum(rated.map((r) => r.rating.avg * r.rating.n)) / n, 1), n }; })() : null;
    a.rsvps = Math.max(...rs.map((r) => r.rsvps || 0));
    a.featured = (rs.find((r) => r.featured) || {}).featured || null;
    out.push(a);
  }
  return out.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

/* Published gigs since the artist's first counted night that left no record at all. */
export function silentNights(aid, rows, occs, now = Date.now()) {
  const counted = rows.filter((r) => r.status === 'counted' && r.gig);
  if (!counted.length) return [];
  const first = Math.min(...counted.map((r) => r.startedAt));
  const seen = new Set(rows.filter((r) => r.gig && (r.status === 'counted' || r.status === 'unused')).map((r) => `${r.gig.eventId}|${r.gig.date}`));
  return occs.filter((o) => o.startsAt >= first && o.endsAt <= now && !seen.has(`${o.eventId}|${o.date}`))
    .map((o) => ({ artist: aid, eventId: o.eventId, date: o.date, venue: o.venue || '', city: o.city || '', country: o.country || '', startsAt: o.startsAt }));
}

/* ---------- one artist's documents → rows ---------- */
export function artistContext(ev, now = Date.now(), times = []) {
  const events = ev && Array.isArray(ev.list) ? ev.list : [];
  const hasCalendar = events.length > 0;
  const calTz = (events.find((e) => e && e.tz) || {}).tz || '';
  const span = times.filter(Boolean);
  // two days of margin so a gig straddling midnight in its own zone is still expanded
  const occs = hasCalendar && span.length ? occurrencesFor({ list: events }, utcToDate(Math.min(...span) - 2 * 86400e3), utcToDate(Math.max(...span, now) + 2 * 86400e3)) : [];
  return { hasCalendar, calTz, occs };
}
/** Rows for one artist from slim nights (pure). `parts`: { nights: {id: slim}, idx, ev, meta, reqs, fb, rsvp, feats, observed: {id: …} } */
export function rowsFor(aid, artist, parts, venues, now = Date.now()) {
  const nights = Object.values(parts.nights || {}).filter(Boolean);
  const times = nights.flatMap((n) => [n.startedAt, n.endedAt]);
  const ctx = { ...artistContext(parts.ev, now, times), meta: parts.meta, reqs: parts.reqs, fb: parts.fb, rsvp: parts.rsvp, feats: parts.feats };
  const hiddenIds = new Set((parts.idx || []).filter((r) => r && r.hidden).map((r) => r.showId));
  const rows = nights.map((n) => buildRow(aid, artist, n, ctx, venues, { observed: (parts.observed || {})[n.showId] || null, hidden: hiddenIds.has(n.showId), now }));
  const silent = silentNights(aid, rows, ctx.occs, now);
  return { rows, silent, hasCalendar: ctx.hasCalendar };
}

/* ---------- the roll-ups and the model's block (pure, over the merged view) ---------- */
const by = (rows, keyOf, seed) => {
  const m = new Map();
  for (const r of rows) { const k = keyOf(r); if (k == null) continue; if (!m.has(k)) m.set(k, seed(r, k)); m.get(k).rows.push(r); }
  return m;
};
const perHead = (rows) => { const rs = rows.filter((r) => r.money.known && r.people); const h = sum(rs.map((r) => r.people)); return h ? round(sum(rs.map((r) => r.money.total)) / h, 3) : null; };
const finish = (g) => {
  const rs = g.rows, known = rs.filter((r) => r.money.known);
  const rr = rs.filter((r) => r.rating), rn = sum(rr.map((r) => r.rating.n));
  const out = {
    ...g, nights: rs.length, artists: new Set(rs.map((r) => r.artist.id)).size, venues: new Set(rs.map((r) => r.venueKey || r.venue).filter(Boolean)).size,
    people: avg(rs.map((r) => r.people), 1), peopleTotal: sum(rs.map((r) => r.people)), hours: avg(rs.map((r) => r.hours)), hoursTotal: round(sum(rs.map((r) => r.hours)), 1),
    votes: sum(rs.map((r) => r.votes)), songs: sum(rs.map((r) => r.songsPlayed)), requests: sum(rs.map((r) => r.requests.count)), requestsAccepted: sum(rs.map((r) => r.requests.accepted)),
    moneyKnown: known.length, gross: round(sum(known.map((r) => r.money.total))), tips: sum(known.map((r) => r.money.tips.count)), tipsAmount: round(sum(known.map((r) => r.money.tips.amount))),
    packs: sum(known.map((r) => r.money.packs.count)), paidVotes: sum(known.map((r) => r.money.packs.votes)), merchOrders: sum(rs.map((r) => r.money.merch.orders)), merchAmount: round(sum(rs.map((r) => r.money.merch.amount))),
    perHead: perHead(rs),
    rated: rn, ratingAvg: rn ? round(sum(rr.map((r) => r.rating.avg * r.rating.n)) / rn, 1) : null,
    first: rs.length ? Math.min(...rs.map((r) => r.startedAt)) : null, last: rs.length ? Math.max(...rs.map((r) => r.startedAt)) : null,
  };
  delete out.rows;
  return out;
};

export function rollup({ rows, silent, artists, venues, songs = {}, now = Date.now() }) {
  /* hidden is a flag, not a status: a night the artist hid from their own Money tab is
     still judged by the rule and still in every total (the tracker cannot see the flag,
     and the two must agree); the page greys it and says how many there are */
  const counted = rows.filter((r) => r.status === 'counted');
  const unused = rows.filter((r) => r.status === 'unused');
  const refused = rows.filter((r) => r.status === 'refused');
  const hidden = rows.filter((r) => r.hidden);
  const known = counted.filter((r) => r.money.known);
  const weeksOf = (g) => Math.max(1, (g.last - g.first) / (7 * 86400e3) + 1);
  const silentBy = (aid) => silent.filter((s) => s.artist === aid).length;
  const unusedBy = (aid) => unused.filter((r) => r.artist.id === aid).length;
  const byArtist = [...by(counted, (r) => r.artist.id, (r) => ({ id: r.artist.id, name: r.artist.name, slug: r.artist.slug, plan: r.artist.plan, left: r.artist.left, rows: [] })).values()].map(finish)
    .map((g) => ({ ...g, nightsPerWeek: round(g.nights / weeksOf(g), 1), unused: unusedBy(g.id), silent: silentBy(g.id), published: g.nights + unusedBy(g.id) + silentBy(g.id),
                   filed: rows.filter((r) => r.artist.id === g.id).length, countries: [...new Set(counted.filter((r) => r.artist.id === g.id).map((r) => r.country).filter(Boolean))] }));
  for (const a of artists) if (!byArtist.some((g) => g.id === a.id)) byArtist.push({ id: a.id, name: a.name, slug: a.slug, plan: a.plan, left: false, nights: 0, artists: 0, venues: 0, people: null, peopleTotal: 0, hours: null, hoursTotal: 0, votes: 0, songs: 0, requests: 0, requestsAccepted: 0, moneyKnown: 0, gross: 0, tips: 0, tipsAmount: 0, packs: 0, paidVotes: 0, merchOrders: 0, merchAmount: 0, perHead: null, rated: 0, ratingAvg: null, first: null, last: null, nightsPerWeek: 0, unused: unusedBy(a.id), silent: silentBy(a.id), published: unusedBy(a.id) + silentBy(a.id), filed: rows.filter((r) => r.artist.id === a.id).length, countries: [], createdAt: a.createdAt || null });
  byArtist.sort((a, b) => b.nights - a.nights || (b.last || 0) - (a.last || 0));
  const byVenue = [...by(counted, (r) => (r.venueKey ? `${r.venueKey}|${r.country}` : null), (r) => ({ venue: r.venue, city: r.city, country: r.country, venueId: r.venueId, rows: [] })).values()].map(finish).sort((a, b) => b.nights - a.nights);
  const byCountry = [...by(counted, (r) => r.country || '(unknown)', (r) => ({ country: r.country || '(unknown)', rows: [] })).values()].map(finish)
    .map((g) => ({ ...g, cities: new Set(counted.filter((r) => (r.country || '(unknown)') === g.country).map((r) => r.city).filter(Boolean)).size })).sort((a, b) => b.nights - a.nights);
  const byCity = [...by(counted, (r) => (r.city ? `${r.city}|${r.country}` : null), (r) => ({ city: r.city, country: r.country, rows: [] })).values()].map(finish).sort((a, b) => b.nights - a.nights);
  const byMonth = [...by(counted, (r) => (r.localDate ? r.localDate.slice(0, 7) : null), (r, k) => ({ month: k, rows: [] })).values()].map(finish).sort((a, b) => a.month.localeCompare(b.month));
  const byWeekday = [...by(counted, (r) => r.weekday, (r, k) => ({ weekday: k, rows: [] })).values()].map(finish).sort((a, b) => a.weekday - b.weekday);
  // the platform's most-played songs, from the tallies kept per counted night (register_work.songs)
  const tally = new Map();
  for (const r of counted) for (const id of (r.mergedFrom || [r.showId])) for (const [k, s] of Object.entries(((songs[r.artist.id] || {})[id]) || {})) {
    const t = tally.get(k) || { title: s[0], artist: s[1], plays: 0, votes: 0, nights: 0 };
    t.plays += s[2]; t.votes += s[3]; t.nights += 1; tally.set(k, t);
  }
  const topSongs = [...tally.values()].sort((a, b) => b.plays - a.plays || b.votes - a.votes).slice(0, TOP_SONGS);
  // sign-ups by month and first touch — the registries hold it, so it costs nothing
  const month = (ms) => (ms ? utcToDate(ms).slice(0, 7) : null);
  const signups = {
    artistsByMonth: [...by(artists, (a) => month(a.createdAt), (a, k) => ({ month: k, rows: [] })).values()].map((g) => ({ month: g.month, artists: g.rows.length, playing: g.rows.filter((a) => counted.some((r) => r.artist.id === a.id)).length })).sort((a, b) => a.month.localeCompare(b.month)),
    venuesByMonth: [...by(venues, (v) => month(v.createdAt), (v, k) => ({ month: k, rows: [] })).values()].map((g) => ({ month: g.month, venues: g.rows.length, verified: g.rows.filter((v) => v.verified).length })).sort((a, b) => a.month.localeCompare(b.month)),
    bySource: [...by(artists, (a) => a.src || (a.referredBy ? 'referral' : '(none)'), (a, k) => ({ source: k, rows: [] })).values()].map((g) => ({ source: g.source, artists: g.rows.length })).sort((a, b) => b.artists - a.artists),
    referred: artists.filter((a) => a.referredBy).length,
  };
  const all = finish({ rows: counted });
  const ym = utcToDate(now).slice(0, 7);
  const thisMonth = counted.filter((r) => r.localDate && r.localDate.startsWith(ym));
  const knownCountries = [...new Set(known.map((r) => r.country).filter(Boolean))];
  const totals = {
    filed: rows.length, counted: counted.length, unused: unused.length, refused: refused.length, hidden: hidden.length, silent: silent.length,
    merged: counted.filter((r) => r.mergedFrom).length, noDetail: rows.filter((r) => !r.detail).length,
    artistsOnPlatform: artists.length, artistsWithNights: new Set(counted.map((r) => r.artist.id)).size, artistsLeft: byArtist.filter((a) => a.left).length, venuesOnPlatform: venues.length,
    venuesPlayed: all.venues, countries: new Set(counted.map((r) => r.country).filter(Boolean)).size, cities: new Set(counted.map((r) => r.city).filter(Boolean)).size,
    unplaced: counted.filter((r) => !r.country).length,
    people: all.people, peopleTotal: all.peopleTotal, hours: all.hours, hoursTotal: all.hoursTotal, votes: all.votes, songs: all.songs, requests: all.requests, requestsAccepted: all.requestsAccepted,
    moneyKnown: known.length, moneyRechecked: known.filter((r) => r.money.asOf && r.endedAt && r.money.asOf > r.endedAt + 3600e3).length,
    gross: all.gross, tips: all.tips, tipsAmount: all.tipsAmount, packs: all.packs, paidVotes: all.paidVotes,
    merchOrders: sum(counted.map((r) => r.money.merch.orders)), merchAmount: round(sum(counted.map((r) => r.money.merch.amount))), merchOrdersAllFiled: sum(rows.map((r) => r.money.merch.orders)),
    featuredSpots: sum(counted.map((r) => (r.featured ? r.featured.spots : 0))), featuredCents: sum(counted.map((r) => (r.featured ? r.featured.cents : 0))),
    rated: all.rated, ratingAvg: all.ratingAvg, rsvps: sum(counted.map((r) => r.rsvps || 0)),
    perHead: perHead(counted), knownCountries, first: all.first, last: all.last,
    thisMonth: { month: ym, nights: thisMonth.length, artists: new Set(thisMonth.map((r) => r.artist.id)).size, people: avg(thisMonth.map((r) => r.people), 1), gross: round(sum(thisMonth.filter((r) => r.money.known).map((r) => r.money.total))) },
  };
  /* THE MODEL'S BLOCK — the fields tools/actuals.py prints, computed the same way, so the
     Real shows panel takes this instead of a paste. The METERS (ticks per phone-hour,
     credits a night, deploys, the two bills) are not here: no function can read
     Netlify's dashboard, so the page keeps those from its baked seed (METER_KEYS). */
  const plans = (p) => counted.filter((r) => r.artist.plan === p);
  const floor = known.length && knownCountries.length === 1
    ? `over ${known.length} money-known night${known.length === 1 ? '' : 's'}, all in ${knownCountries[0]}` + (knownCountries[0] === 'Thailand' ? ' — where pay is close to nothing and tipping is not a habit: a floor for a tipping market, not a ceiling' : '')
    : known.length ? `over ${known.length} money-known nights in ${knownCountries.length} countries` : 'no night with money known yet';
  const act = {
    asOf: utcToDate(now), builtAt: now, source: 'the register — myset.vip/moneymodel/shows',
    shows: counted.length,
    people: avg(counted.map((r) => r.people)), hours: avg(counted.map((r) => r.hours)),
    recordHours: avg(counted.map((r) => r.recordHours)), setHours: avg(counted.map((r) => r.setHours)),
    votes: avg(counted.map((r) => r.votes)), interactions: avg(counted.map((r) => r.interactions)),
    songs: avg(counted.map((r) => r.songsPlayed)), nets: avg(counted.map((r) => r.nets)), peakVoters: avg(counted.map((r) => r.peakVoters)),
    gigsOnCalendar: counted.length + unused.length + silent.length, gigsUsed: counted.length, gigsSilent: silent.length, gigsUnused: unused.length,
    roomFree: perHead(plans('free')), roomPlus: perHead(plans('plus')), roomPro: perHead(plans('pro')), roomPerHead: perHead(counted),
    moneyKnownNights: known.length, moneyNote: floor, artists: new Set(counted.map((r) => r.artist.id)).size, countries: totals.countries,
    note: `${counted.length} night(s) on the published calendar where the room used the app, across ${new Set(counted.map((r) => r.artist.id)).size} artist(s)`
      + (unused.length ? ` (${unused.length} more on the calendar where it went unused)` : '') + `; ${known.length} with money known (per-person figures use only those — ${floor}). `
      + `Read off the register at myset.vip/moneymodel/shows, folded on the server from every night every artist has filed; the meters (ticks per phone-hour, credits per night, deploys) stay the tracker's.`,
  };
  return { totals, byArtist, byVenue, byCountry, byCity, byMonth, byWeekday, topSongs, signups, act };
}

/* ---------- the whole register from documents (pure; the test's door and the fold's core) ---------- */
export function artistsOf(registry) {
  return Object.entries((registry && registry.byId) || {}).map(([id, a]) => ({ id, name: a.name || '', slug: a.slug || '', plan: planOf(a), verified: !!a.verified, createdAt: a.createdAt || null, src: a.src || '', referredBy: a.referredBy || null }));
}
export function venuesOf(venues) {
  return Object.entries((venues && venues.byId) || {}).map(([id, v]) => ({ id, name: v.name || '', city: v.city || '', country: v.country || '', slug: v.slug || '', plan: v.plan || 'free', verified: !!v.verified, createdAt: v.createdAt || null }));
}
export function buildRegister({ registry, venues, parts, gone = {}, now = Date.now() }) {
  const venueList = venuesOf(venues);
  const rows = [], silent = [];
  const who = (aid) => registry.byId[aid] || (gone[aid] ? { ...gone[aid], left: true } : { left: true, name: '', slug: '', plan: 'free' });
  for (const aid of Object.keys(parts)) {
    const r = rowsFor(aid, who(aid), parts[aid], venueList, now);
    for (const row of r.rows) delete row._observed;
    rows.push(...r.rows); silent.push(...r.silent);
  }
  const songs = {};
  for (const [aid, p] of Object.entries(parts)) for (const [id, n] of Object.entries(p.nights || {})) if (n && n.songs && Object.keys(n.songs).length) (songs[aid] ||= {})[id] = n.songs;
  return headOf({ rows, silent, artists: artistsOf(registry), venues: venueList, songs, now });
}
export function headOf({ rows, silent, artists, venues, songs, now = Date.now(), build = {} }) {
  const view = mergeSplitNights(rows);
  const roll = rollup({ rows: view, silent, artists, venues, songs, now });
  return { v: 1, builtAt: now, build, artists, venues, silent: [...silent].sort((a, b) => b.startsAt - a.startsAt), rows: view, ...roll };
}

/* ---------- the store side ---------- */
const emptyState = () => ({ v: 1, lastRunAt: 0, lastFullAt: 0, runningSince: 0, cursor: 0, etags: {}, months: {}, build: null });
const emptyWork = () => ({ v: 1, sigs: {}, observed: {}, songs: {}, silent: {}, gone: {}, rechecked: {}, feesAsked: {} });
export async function readRegister() { const { data } = await readDoc(HEAD, null); return data && data.v ? data : null; }
export async function readState() { const { data } = await readDoc(STATE, null); return { ...emptyState(), ...(data || {}) }; }
async function readWork() { const { data } = await readDoc(WORK, null); return { ...emptyWork(), ...(data || {}) }; }
export const monthOf = (row) => (row.localDate ? row.localDate.slice(0, 7) : 'none');
async function readShards(months) {
  const out = {};
  const keys = [];
  for (const [ym, m] of Object.entries(months || {})) for (let i = 0; i < Math.max(1, m.parts || 1); i++) keys.push([ym, SHARD(ym, i)]);
  const got = await Promise.all(keys.map(([, k]) => readDoc(k, null)));
  got.forEach((g, i) => { const [ym] = keys[i]; (out[ym] ||= []).push(...(((g.data || {}).rows) || [])); });
  return { byMonth: out, reads: keys.length };
}
/** The register's dirty marks: `gigsched.regdirty` (written by the lifecycle) — `aid → at`. */
export async function readDirty() { const { data } = await readDoc(SCHED, null); return { ...((data && data.regdirty) || {}) }; }
export const clearDirty = (marks) => casDoc(SCHED, () => ({ v: 1, byArtist: {}, live: {} }), (d) => {
  d.regdirty ||= {};
  let touched = false;
  for (const [aid, at] of Object.entries(marks)) if (d.regdirty[aid] != null && d.regdirty[aid] <= at) { delete d.regdirty[aid]; touched = true; }
  return touched;
}).catch(() => {});
/** Anything that changes a filed night outside the lifecycle (a rename, a hide, a re-check) says so here. */
export const markDirty = (aid) => casDoc(SCHED, () => ({ v: 1, byArtist: {}, live: {} }), (d) => { d.regdirty ||= {}; d.regdirty[aid] = Date.now(); return true; }).catch(() => {});

/** One artist's documents, read side by side: the index, the id list and the calendar first; the rest only when something changed. */
async function readArtist(aid, { rowsKept, sigs, etagEv, dirty, rebuild }, now) {
  const [idxD, idsD, evD] = await Promise.all([readDoc(KEY.histIdx(aid), { shows: [] }), readDoc(`histids_${aid}`, { ids: [] }), readDoc(`ev_${aid}`, null)]);
  let reads = 3;
  const idx = ((idxD.data && idxD.data.shows) || []).filter((r) => r && r.showId);
  const ids = [...new Set([...((idsD.data && idsD.data.ids) || []), ...idx.map((r) => r.showId)].filter(Boolean))];
  const rowOf = Object.fromEntries(idx.map((r) => [r.showId, r]));
  const calendarChanged = etagEv !== undefined && evD.etag !== etagEv;
  const want = [];
  for (const id of ids) {
    const sig = rowOf[id] ? rowSig(rowOf[id]) : 'noidx';
    if (rebuild || calendarChanged || !rowsKept[id] || sigs[id] !== sig) want.push([id, sig]);
  }
  const gone = Object.keys(rowsKept).filter((id) => !ids.includes(id));
  if (!want.length && !dirty && !gone.length) return { idx, ids, ev: evD.data, etagEv: evD.etag, nights: {}, sigs: {}, reads, unchanged: true };
  const [meta, reqs, fb, rsvp, feats] = await Promise.all([readDoc(KEY.meta(aid), null), readDoc(KEY.reqs(aid), null), readDoc(`fb_${aid}`, null), readDoc(`rsvp_${aid}`, null), readDoc(`feats_${aid}`, null)]);
  reads += 5;
  const nights = {}, newSigs = {};
  for (let i = 0; i < want.length; i += 6) {
    const batch = want.slice(i, i + 6);
    const got = await Promise.all(batch.map(([id]) => readDoc(KEY.hist(aid, id), null)));
    reads += batch.length;
    got.forEach((g, j) => {
      const [id, sig] = batch[j];
      const doc = g.data && g.data.showId ? slimNight(g.data) : rowOf[id] ? slimFromRow(aid, rowOf[id]) : null;
      if (doc) { nights[id] = doc; newSigs[id] = sig; }
    });
  }
  return { idx, ids, ev: evD.data, etagEv: evD.etag, meta: meta.data, reqs: reqs.data, fb: fb.data, rsvp: rsvp.data, feats: feats.data, nights, sigs: newSigs, reads, unchanged: false, calendarChanged };
}
/** A kept row → the slim night it was built from, for a rebuild without re-reading the detail. */
function slimFromKept(r) {
  return {
    showId: r.showId, artistId: r.artist.id, title: r.title, titleByHand: false, venue: r.venue, city: r.city, country: r.placedBy === 'record' ? r.country : '', tz: r.placedBy === 'record' ? r.tz : '', plan: r.artist.planStamped ? r.artist.plan : '',
    key: r.key, startedAt: r.startedAt, endedAt: r.endedAt, startedBy: r.startedBy, endedBy: r.endedBy,
    stats: { songsPlayed: r.songsPlayed, totalVotes: r.votes, peakVoters: r.peakVoters, room: r.people === r.peakVoters ? 0 : r.people, nets: r.nets, topSong: r.topSong },
    money: { source: r.money.source, currency: r.money.currency, reconciledAt: r.money.asOf, gross: r.money.gross || 0, unattributed: r.money.unattributed || 0,
             votes: { amount: (r.money.packs.amount || 0) + (r.money.requests.amount || 0), count: (r.money.packs.count || 0) + (r.money.requests.count || 0), paid: r.money.packs.votes || 0 },
             tips: { amount: r.money.tips.amount || 0, count: r.money.tips.count || 0 }, requests: { amount: r.money.requests.amount || 0, count: r.money.requests.count || 0 } },
    requests: null, rsvps: null, firstPlayAt: r.setHours && r.startedAt ? r.startedAt + (r.lastActivityHours - r.setHours) * 3600e3 : null, lastPlayAt: r.lastActivityHours && r.startedAt ? r.startedAt + r.lastActivityHours * 3600e3 : null,
    songs: {}, detail: r.detail !== false,
  };
}

/** A night's money asked of Stripe once more, the morning after (late tips). Bounded per ring; never inside a hot path. */
export async function recheckSome(rows, work, now, deadline = Infinity) {   // exported for test/stripefees.mjs
  if (!process.env.STRIPE_SECRET_KEY) return [];
  const late = rows.filter((r) => r.status === 'counted' && r.endedAt && now - r.endedAt > RECHECK_AFTER_MS && now - r.endedAt < RECHECK_UNTIL_MS && !(work.rechecked || {})[r.id])
    .sort((a, b) => a.endedAt - b.endedAt).slice(0, RECHECKS_PER_RING);
  /* EVS-005: a counted night whose room money Stripe answered but whose exact fee was
     never read (filed before fees were) is asked once more, whatever its age, a few a
     ring. Its FEE alone is written (refreshShowFees), and only when Stripe's takings match
     the night's to the cent: the backfill can never rewrite an old night's money. */
  /* only a night whose morning-after ask is already behind it (done, or out of its window),
     so this never spends — and marks — the ask that catches the late tips */
  const feeless = rows.filter((r) => r.status === 'counted' && r.money && r.money.known && r.money.stripeFees == null && r.endedAt
      && ((work.rechecked || {})[r.id] || now - r.endedAt >= RECHECK_UNTIL_MS) && !(work.feesAsked || {})[r.id] && !late.includes(r))
    .sort((a, b) => b.endedAt - a.endedAt).slice(0, FEE_ASKS_PER_RING);
  const due = [...late, ...feeless];
  const done = [];
  for (const r of due) {
    if (Date.now() > deadline) break;                           // the ring's time box: the rest wait for the next ring
    try {
      const { reconcileShow, refreshShowFees } = await import('./_history.mjs');
      const ask = late.includes(r) ? reconcileShow : refreshShowFees;
      for (const id of r.mergedFrom || [r.showId]) await ask(r.artist.id, id);   // a merged night is asked for each of its records
      done.push(r.artist.id);
    } catch (e) { console.error('register: re-check failed', r.id, e && e.message); }
    if (late.includes(r)) (work.rechecked ||= {})[r.id] = now; else (work.feesAsked ||= {})[r.id] = now;
  }
  return done;
}

/**
 * Fold the store into the register — the ONE writer, under the lock in `registersync`.
 *   full     walk every artist now, whatever the cursor and the clock (Refresh)
 *   rebuild  and read every night's detail again (a hard rebuild)
 * Returns the build summary. Never throws: the callers are a bell and a button.
 */
export async function foldRegister({ full = false, rebuild = false, now = Date.now(), reason = '', budgetMs = BUDGET_MS() } = {}) {
  const t0 = Date.now();
  const deadline = t0 + budgetMs;
  let locked = false;
  await casDoc(STATE, emptyState, (d) => {
    if (d.runningSince && now - Number(d.runningSince) < 4 * 60e3) return false;
    d.runningSince = now; locked = true; return true;
  }).catch(() => {});
  if (!locked) return { ok: false, busy: true, reason };
  const release = (patch) => casDoc(STATE, emptyState, (d) => { Object.assign(d, patch, { runningSince: 0 }); return true; }).catch(() => {});
  try {
    const [state, work, dirtyMarks, { readArtists }, { readVenues }] = await Promise.all([readState(), readWork(), readDirty(), import('./_auth.mjs'), import('./_venues.mjs')]);
    const [registry, venues] = await Promise.all([readArtists(), readVenues()]);
    let reads = 5;
    const everyone = Object.keys(registry.byId || {}).sort();
    const shards = await readShards(state.months);
    reads += shards.reads;
    const kept = {};                       // aid → { showId → row }
    for (const rs of Object.values(shards.byMonth)) for (const r of rs) (kept[r.artist.id] ||= {})[r.showId] = r;
    /* who to walk: the dirty artists first, then the ring from the cursor when a full
       walk is due (or asked for); at least one artist a ring, so a walk always moves */
    const dirty = Object.keys(dirtyMarks).filter((a) => registry.byId[a]);
    const fullDue = full || !state.lastFullAt || now - Number(state.lastFullAt) > FULL_EVERY_MS;
    let cursor = Number(state.cursor) || 0;
    if (cursor >= everyone.length) cursor = 0;
    const ring = fullDue ? everyone.slice(cursor).concat(everyone.slice(0, cursor)) : [];
    const order = [...new Set([...dirty, ...ring])];
    const walked = [], parts = {}, etags = { ...(state.etags || {}) };
    let stopped = false;
    for (let i = 0; i < order.length; i += CONCURRENT_ARTISTS) {
      if (walked.length && Date.now() > deadline) { stopped = true; break; }
      const batch = order.slice(i, i + CONCURRENT_ARTISTS);
      const got = await Promise.all(batch.map((aid) => readArtist(aid, { rowsKept: kept[aid] || {}, sigs: (work.sigs || {})[aid] || {}, etagEv: (etags[aid] || {}).ev, dirty: dirtyMarks[aid] != null, rebuild }, now).catch((e) => ({ err: e }))));
      got.forEach((g, j) => {
        const aid = batch[j];
        if (g.err) { console.error('register: could not read', aid, g.err && g.err.message); return; }
        walked.push(aid); reads += g.reads;
        etags[aid] = { ev: g.etagEv };
        if (!g.unchanged) parts[aid] = g;
      });
    }
    const nowRows = {};
    for (const [aid, rs] of Object.entries(kept)) nowRows[aid] = { ...rs };
    const workSigs = { ...(work.sigs || {}) }, observed = { ...(work.observed || {}) }, songs = { ...(work.songs || {}) }, silentBy = { ...(work.silent || {}) }, gone = { ...(work.gone || {}) };
    const venueList = venuesOf(venues);
    for (const [aid, g] of Object.entries(parts)) {
      const artist = registry.byId[aid];
      /* the nights (re)read, plus — when the calendar changed — every other kept night of
         this artist rebuilt from its own row, so all of them sit on the right gig */
      const nights = { ...g.nights };
      if (g.calendarChanged || rebuild) for (const id of g.ids) if (!nights[id] && (nowRows[aid] || {})[id]) nights[id] = slimFromKept(nowRows[aid][id]);
      const built = rowsFor(aid, artist, { nights, idx: g.idx, ev: g.ev, meta: g.meta, reqs: g.reqs, fb: g.fb, rsvp: g.rsvp, feats: g.feats, observed: observed[aid] || {} }, venueList, now);
      nowRows[aid] ||= {};
      for (const r of built.rows) {
        const o = r._observed; delete r._observed;
        r.sig = g.sigs[r.showId] || ((workSigs[aid] || {})[r.showId]) || null;
        nowRows[aid][r.showId] = r;
        (observed[aid] ||= {})[r.showId] = o;
        if (nights[r.showId] && nights[r.showId].songs && Object.keys(nights[r.showId].songs).length) (songs[aid] ||= {})[r.showId] = nights[r.showId].songs;
      }
      // a night named nowhere any more (the id list is append-only, so this is a purge) leaves the register too
      for (const id of Object.keys(nowRows[aid])) if (!g.ids.includes(id)) { delete nowRows[aid][id]; if (songs[aid]) delete songs[aid][id]; }
      workSigs[aid] = { ...(workSigs[aid] || {}), ...g.sigs };
      /* silent nights need the whole calendar and every night — recomputed from the rows now held */
      silentBy[aid] = silentNights(aid, Object.values(nowRows[aid]), artistContext(g.ev, now, Object.values(nowRows[aid]).flatMap((r) => [r.startedAt, r.endedAt])).occs, now);
    }
    // an account that left keeps its nights, nameless: the platform's ledger never moves
    for (const aid of Object.keys(nowRows)) if (!registry.byId[aid]) {
      if (!gone[aid]) gone[aid] = { name: '', slug: '', plan: ((Object.values(nowRows[aid])[0] || { artist: {} }).artist.plan) || 'free', left: true, at: now };
      for (const r of Object.values(nowRows[aid])) r.artist = { ...r.artist, name: '', slug: '', left: true };
      delete silentBy[aid];
    }
    const allRows = Object.values(nowRows).flatMap((rs) => Object.values(rs));
    // the morning-after re-check of a night's money, a couple a ring
    const rechecked = await recheckSome(allRows, work, now, t0 + budgetMs + 12e3);   // asks get their own 12 s past the walk's box, well inside the 30 s a scheduled function has
    const silent = Object.values(silentBy).flat();
    const artists = artistsOf(registry);
    const finished = !stopped;
    const lastWalked = walked.length ? everyone.indexOf(walked[walked.length - 1]) : -1;
    const nextCursor = fullDue ? (finished ? 0 : (lastWalked + 1) % Math.max(1, everyone.length)) : cursor;
    const build = { at: now, ms: Date.now() - t0, reads, reason, artistsWalked: walked.length, artistsOnPlatform: everyone.length, artistsChanged: Object.keys(parts).length,
                    dirty: dirty.length, full: fullDue, finished, cursor: nextCursor, shows: allRows.length, rechecked: rechecked.length };
    const head = headOf({ rows: allRows, silent, artists, venues: venueList, songs, now, build });
    delete head.rows;                      // the head carries the roll-ups; the rows live in the shards
    // write: the months that changed, the working state, the head, then the state and the marks
    const months = { ...(state.months || {}) };
    const touched = new Set();
    for (const aid of Object.keys(parts)) for (const r of Object.values(nowRows[aid] || {})) touched.add(monthOf(r));
    for (const aid of Object.keys(kept)) if (!registry.byId[aid] || parts[aid]) for (const r of Object.values(kept[aid])) touched.add(monthOf(r));
    const byM = {};
    for (const r of allRows) (byM[monthOf(r)] ||= []).push(r);
    for (const ym of touched) {
      const rs = (byM[ym] || []).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      const chunks = [[]];
      let bytes = 0;
      for (const r of rs) { const b = JSON.stringify(r).length + 1; if (bytes + b > SHARD_BYTES && chunks[chunks.length - 1].length) { chunks.push([]); bytes = 0; } chunks[chunks.length - 1].push(r); bytes += b; }
      const partsN = rs.length ? chunks.length : 0;
      const before = months[ym] || { parts: 0 };
      for (let i = 0; i < Math.max(partsN, before.parts || 0); i++) {
        const rowsHere = chunks[i] || [];
        await casDoc(SHARD(ym, i), () => ({}), (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, { v: 1, ym, part: i, rows: rowsHere, builtAt: now }); return true; })
          .catch((e) => console.error('register: shard write failed', ym, i, e && e.message));
      }
      if (rs.length) months[ym] = { parts: partsN, rows: rs.length, bytes: JSON.stringify(rs).length }; else delete months[ym];
    }
    head.months = Object.entries(months).map(([ym, m]) => ({ ym, ...m })).sort((a, b) => b.ym.localeCompare(a.ym));
    const big = head.months.find((m) => m.bytes > SHARD_BYTES);
    if (big) console.warn('register: a month past SHARD_BYTES, split into parts', JSON.stringify(big));
    await casDoc(WORK, emptyWork, (d) => { Object.assign(d, { v: 1, sigs: workSigs, observed, songs, silent: silentBy, gone, rechecked: work.rechecked || {}, feesAsked: work.feesAsked || {} }); return true; }).catch((e) => console.error('register: work write failed', e && e.message));
    let written = false;
    await casDoc(HEAD, () => ({}), (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, head); return true; }).then(() => { written = true; }).catch((e) => console.error('register: head write failed', e && e.message));
    await release({ lastRunAt: now, lastFullAt: fullDue && finished ? now : (state.lastFullAt || 0), cursor: nextCursor, etags, months, build });
    const cleared = Object.fromEntries(Object.entries(dirtyMarks).filter(([a]) => walked.includes(a) || !registry.byId[a]));
    if (Object.keys(cleared).length) await clearDirty(cleared);
    for (const aid of new Set(rechecked)) await markDirty(aid);
    return { ok: written, ...build };
  } catch (e) {
    console.error('register: fold failed', e && e.message);
    await release({});
    return { ok: false, error: String((e && e.message) || e), reason };
  }
}

/* ---------- what the pages read ---------- */
/** The head plus the rows of the months asked for (all, or the last N), merged, plus silent gigs as rows. */
export async function readView({ months = 'all' } = {}) {
  const head = await readRegister();
  if (!head) return null;
  let want = head.months || [];
  if (months !== 'all') want = want.filter((m) => m.ym !== 'none').slice(0, Math.max(1, Number(months) || 3));
  const sh = await readShards(Object.fromEntries(want.map((m) => [m.ym, m])));
  const rows = mergeSplitNights(Object.values(sh.byMonth).flat());
  const names = Object.fromEntries((head.artists || []).map((a) => [a.id, a]));
  const silentRows = (head.silent || []).map((s) => ({ id: `${s.artist}|silent|${s.eventId}@${s.date}`, showId: null,
    artist: { id: s.artist, name: (names[s.artist] || {}).name || '', slug: (names[s.artist] || {}).slug || '', plan: (names[s.artist] || {}).plan || 'free', left: false },
    venue: s.venue, city: s.city, country: s.country, gig: { eventId: s.eventId, date: s.date }, startedAt: s.startsAt, localDate: s.date, status: 'silent',
    why: 'a published gig that left no record — the show never started, or nothing was filed', hidden: false,
    hours: null, people: null, votes: null, songsPlayed: null, requests: { count: 0, accepted: 0 }, money: { known: false, merch: { orders: 0, items: 0, amount: 0 }, tips: {}, packs: {}, store: {} } }));
  return { ...head, rows: [...rows, ...silentRows].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)), monthsLoaded: want.map((m) => m.ym), monthsAll: months === 'all' };
}
/** One night's own page: the songs and what the room asked for, with nothing a fan typed. */
export async function nightDetail(aid, showId) {
  if (!aid || !showId) return null;
  const { data } = await readDoc(KEY.hist(aid, showId), null);
  if (!data || !data.showId) return null;
  const m = data.money || {};
  return {
    showId: data.showId, title: str(data.title, 100),
    played: (Array.isArray(data.played) ? data.played : []).map((p) => ({ title: str(p.title, 80), artist: str(p.artist, 60), votes: num(p.votes), roundVotes: p.roundVotes == null ? null : num(p.roundVotes), voters: num(p.voters), replay: !!p.replay, at: Number(p.at) || null })),
    requested: (Array.isArray(data.requested) ? data.requested : []).map((r) => ({ title: str(r.title, 80), artist: str(r.artist, 60), votes: num(r.votes) })),
    money: { source: m.source || null, reconciledAt: Number(m.reconciledAt) || null, gross: num(m.gross), unattributed: num(m.unattributed),
             tips: { count: num(m.tips && m.tips.count), amount: num(m.tips && m.tips.amount), recent: ((m.tips && m.tips.recent) || []).map((t) => ({ amount: num(t.amount), at: Number(t.at) || null })) },
             votes: { count: num(m.votes && m.votes.count), amount: num(m.votes && m.votes.amount), paid: num(m.votes && m.votes.paid) }, requests: { count: num(m.requests && m.requests.count), amount: num(m.requests && m.requests.amount) } },
    requests: data.requests || null, rsvps: data.rsvps ?? null, archivedAt: Number(data.archivedAt) || null,
  };
}
/** One line per filed night, every column, for a spreadsheet. */
export function registerCsv(view) {
  const cols = ['date', 'time', 'tz', 'status', 'hidden', 'why', 'artist', 'artistId', 'plan', 'title', 'venue', 'city', 'country', 'placedBy', 'gigKey', 'hours', 'recordHours', 'setHours', 'people', 'networks', 'peakVoters',
    'votes', 'votesBought', 'requests', 'requestsAccepted', 'songsPlayed', 'topSong', 'moneyKnown', 'moneySource', 'moneyAsOf', 'roomTotalUsd', 'taggedUsd', 'untaggedUsd', 'tips', 'tipsUsd', 'packs', 'packsUsd', 'paidRequests', 'paidRequestsUsd',
    'merchOrders', 'merchItems', 'merchGoodsUsd', 'merchPostageUsd', 'merchAtShow', 'perHeadUsd', 'featuredSpots', 'featuredUsd', 'ratingAvg', 'ratings', 'rsvps', 'startedBy', 'endedBy', 'mergedFrom', 'showId'];
  const cell = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const iso = (ms) => (ms ? new Date(ms).toISOString() : '');
  const lines = [cols.join(',')];
  for (const r of (view && view.rows) || []) {
    if (r.status === 'silent') { lines.push([r.localDate, '', '', 'silent', '', r.why, r.artist.name, r.artist.id, r.artist.plan, '', r.venue, r.city, r.country].map(cell).join(',')); continue; }
    const m = r.money;
    lines.push([r.localDate, r.localTime, r.tz, r.status, r.hidden ? 'yes' : '', r.why, r.artist.name || (r.artist.left ? '(left)' : ''), r.artist.id, r.artist.plan, r.title, r.venue, r.city, r.country, r.placedBy, r.key, r.hours, r.recordHours, r.setHours, r.people, r.nets, r.peakVoters,
      r.votes, r.paidVotes, r.requests.count, r.requests.accepted, r.songsPlayed, r.topSong && r.topSong.title, m.known ? 'yes' : 'no', m.source, iso(m.asOf), m.total, m.gross, m.unattributed,
      m.tips.count, m.tips.amount, m.packs.count, m.packs.amount, m.requests.count, m.requests.amount,
      m.merch.orders, m.merch.items, m.merch.goods, m.merch.postage, m.merch.atShow, m.perHead, r.featured && r.featured.spots, r.featured && r.featured.cents / 100, r.rating && r.rating.avg, r.rating && r.rating.n, r.rsvps,
      r.startedBy, r.endedBy, r.mergedFrom && r.mergedFrom.join(' '), r.showId].map(cell).join(','));
  }
  return lines.join('\n') + '\n';
}

export { DEFAULT_ARTIST };
