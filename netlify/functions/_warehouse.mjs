import { readDoc, casDoc, getShow, DEFAULT_ARTIST } from './_lib.mjs';
import { readArtists } from './_auth.mjs';
import { planOf, limitsFor, MAX_LIBRARY } from './_plan.mjs';
import { readHistIndex, readHistShow } from './_history.mjs';
import { readRequests } from './_requests.mjs';
import { readFeedback } from './_feedback.mjs';
import { readEvents, occurrencesFor } from './_events.mjs';
import { readVenues, venuePlanOf, getVenueProfile } from './_venues.mjs';
import {
  sheetsOn, sheetsOffReason, ensureTabs, styleTabs, writeTab, appendTab, tabIsEmpty, tabTitles,
  existingKeys, rowKey,
  useSheet, activeSheetId, sheetUrl, sheetCells, createSheet, shareSheet, CELL_LIMIT,
} from './_sheets.mjs';
import { readLists, readLearn } from './_lists.mjs';
import { chartFlags } from './_chart.mjs';
import { readLyrics } from './_lyrics.mjs';
import { readSubs } from './_push.mjs';
import { readPosts } from './_community.mjs';
import { getProfile } from './_profile.mjs';
import { readSessions, readLog, recoveryStatus } from './_session.mjs';
import { listKeys as listPasskeys } from './_passkey.mjs';
import { readBiz } from './_biz.mjs';
import { readConnect, connectUsable } from './_connect.mjs';
import { readWishes } from './_wishes.mjs';
import { readMine as readFeaturedMine } from './_featured.mjs';
import { readMeta } from './_lib.mjs';
import { hasPassword } from './_cred.mjs';
import { occurrences, placeNight, judgeRow } from './_nightrule.mjs';

/* WHAT GOES IN THE SHEET.

   Perry's ask: everything the website needs to work, plus what marketing needs,
   plus what tells us which songs a room actually wants. Nine tabs, and the shape
   of each one is a deliberate choice between three kinds:

     SNAPSHOT  cleared and rewritten every sync. "How things are right now."
               Artists, Songs, Gigs, Venues.
     LOG       appended to, never rewritten. "What happened." Rows are immutable
               once written, so a chart built on one never moves under you.
               Shows, Requests, Ratings.
     SERIES    one row per sync. Growth — the only tab that exists purely to be
               a line on a chart.
     GUIDE     written once, if empty, and never touched again. Plain English so
               a reader who has never seen this code knows what they are holding.

   WHY THIS IS A WALK, NOT A SCAN. Two registries name every artist and every
   venue, and each artist's own history index names every show they have played.
   So the whole store is reachable without ever calling Blobs `list()`, which
   INVARIANT 1 forbids for good reason and INVARIANT 2 makes unreliable anyway.

   WHAT IS DELIBERATELY NOT HERE:

   · MONEY PER TRANSACTION. Stripe is the source of truth for money (INVARIANT
     5d) and it already has a better dashboard than a spreadsheet. What lands
     here is each night's total, which is the number a marketing decision
     actually rests on, read from the show's own archived record — so a sync
     makes no Stripe calls at all and cannot be slowed or broken by Stripe.
   · A FAN'S DEVICE ID. The audience never signs in (INVARIANT 9g) and the point
     of that is not to build a profile of them. Counts of phones, yes. Which
     phone, never.
   · ANYTHING ON A HOT PATH. Nothing in this file runs during a gig. It is a
     button and a nightly job, and both are outside the show. */

const SYNC = 'sheetsync';

/* ---------- which sheet, and when it is full (decision 0073) ----------
   A spreadsheet holds ten million cells and then refuses every write. The founder
   asked to hear about it before then and for the next one to be made on its own
   (2026-09-14). So: every sync measures the sheet in use; past WARN it emails the
   founder once per sheet; past ROLL it makes a new spreadsheet, shares it with the
   same people, records the hand-over in the `gsheet` document and carries on into
   the new one in the same run. The old sheet is left exactly as it was — nothing
   is moved, the log tabs simply continue in the successor, and the snapshot tabs
   are rewritten there in full. GSHEET_ID is only where the chain starts. */
const GSHEET = 'gsheet';
const emptyGsheet = () => ({ v: 1, id: '', since: 0, prev: [], warned: {} });
export const ROLL_AT = () => Math.round(CELL_LIMIT * (Number(process.env.MYSET_SHEET_ROLL_PCT) || 80) / 100);
export const WARN_AT = () => Math.round(CELL_LIMIT * (Number(process.env.MYSET_SHEET_WARN_PCT) || 60) / 100);
export async function readSheetDoc() {
  const { data } = await readDoc(GSHEET, null);
  const d = { ...emptyGsheet(), ...(data || {}) };
  d.prev ||= []; d.warned ||= {};
  return d;
}
/* Who a successor is shared with: GSHEET_SHARE (comma-separated) if set, else the
   owner addresses on the founder's own account — the people the first sheet was
   shared with by hand. Never the whole registry. */
async function shareWith(reg) {
  const env = String(process.env.GSHEET_SHARE || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /@/.test(x));
  if (env.length) return env;
  return Object.entries((reg && reg.byEmail) || {})
    .filter(([, v]) => v.artistId === DEFAULT_ARTIST && v.role !== 'member' && v.role !== 'crew')
    .map(([e]) => e);
}
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const baseTitle = (t) => String(t || 'MySet data').replace(/\s+·\s+from\s+\d{4}-\d{2}-\d{2}$/, '') || 'MySet data';

/** Points the client at the sheet in use, and hands over to a new one if it is full. */
export async function settleSheet({ now = Date.now(), reg = null } = {}) {
  const doc = await readSheetDoc();
  const id = doc.id || activeSheetIdFromEnv();
  useSheet(id);
  let cells = 0, title = '';
  try { cells = await sheetCells(); title = (await tabTitles()).title; } catch { return { id, cells: 0, url: sheetUrl(id) }; }
  const out = { id, cells, url: sheetUrl(id), limit: CELL_LIMIT, pct: Math.round(100 * cells / CELL_LIMIT) };
  const people = await shareWith(reg);
  const { sendNotice } = await import('./_auth.mjs');
  const tell = (subject, lines) => Promise.all(people.map((e) => sendNotice(e, subject, lines).catch(() => null)));

  if (cells >= ROLL_AT()) {
    const next = await createSheet(`${baseTitle(title)} · from ${dayOf(now)}`);
    const shared = await shareSheet(next, people).catch(() => []);
    await casDoc(GSHEET, emptyGsheet, (d) => {
      d.prev = (d.prev || []).concat([{ id, from: d.since || 0, until: now, cells }]);
      d.id = next; d.since = now; d.warned = {};
      return true;
    });
    useSheet(next);
    await tell('Your MySet sheet was full, so a new one has started',
      [`The Google Sheet MySet writes to had ${cells.toLocaleString('en-US')} of Google's ${CELL_LIMIT.toLocaleString('en-US')} cells in use, so tonight's sync started a new spreadsheet and carried on there.`,
       `New sheet: ${sheetUrl(next)}`,
       `The old one is untouched and still yours: ${sheetUrl(id)}`,
       'Shows, Requests and Ratings continue in the new sheet from tonight; the snapshot tabs (Artists, Songs, Gigs, Venues, Signals, Features) are rewritten there in full.']);
    return { ...out, rolled: true, id: next, url: sheetUrl(next), from: id, shared, cells: 0, pct: 0 };
  }
  if (cells >= WARN_AT() && !doc.warned[id]) {
    await casDoc(GSHEET, emptyGsheet, (d) => { d.warned = { ...(d.warned || {}), [id]: now }; return true; }).catch(() => {});
    await tell('Your MySet sheet is getting big',
      [`The Google Sheet MySet writes to is at ${out.pct}% of Google's ten-million-cell limit (${cells.toLocaleString('en-US')} cells).`,
       `Nothing to do: when it reaches ${Math.round(100 * ROLL_AT() / CELL_LIMIT)}% the nightly sync starts a new spreadsheet by itself, shares it with you and tells you.`,
       `The sheet: ${sheetUrl(id)}`]);
    return { ...out, warned: true };
  }
  return out;
}
const activeSheetIdFromEnv = () => String(process.env.GSHEET_ID || '').trim();
/* A PERSISTENT PER-ARTIST SONG TALLY, and the reason it has to exist.

   The Songs tab is a snapshot: it is cleared and rewritten every sync. The first
   version built its play and vote counts from the shows that were NEW since last
   time — so the morning after a gig it read "played 1, votes 12", and the next
   sync, with nothing new to read, rewrote the same rows as "played 0, votes 0".
   Every night. Silently. The column said "Votes all time".

   It cannot be recomputed from live data either: the tally a song won is
   DESTROYED every time a song starts (INVARIANT 17b), so an archived show is the
   only record there will ever be. That makes it an accumulator, and an
   accumulator needs somewhere to live.

   KEYED BY SHOW, NOT BY A TIMESTAMP. The first attempt added each new night's
   plays onto a running total and used "newest night already counted" to avoid
   double-counting. That breaks on the case INVARIANT 17c is about: an artist who
   ends a show by accident, plays eight more songs and ends again RE-ARCHIVES the
   same showId with a later `endedAt` and a richer snapshot — so the night went in
   twice. Storing each show's own contribution means a re-archive REPLACES it, and
   the answer is right however many times a night is exported.

   Bounded to the same 100 shows the history index itself keeps (`_history.mjs`
   trims to 100), so this document cannot grow without limit — and the numbers it
   produces are honestly "across the nights still in your history", which is what
   the column header says. */
const SONGSTATS = (aid) => `songstats_${aid}`;
const emptySongStats = () => ({ v: 1, shows: {} });
const KEEP_SHOWS = 100;

/** Sums every stored show into one { songId: {plays, votes} }. */
function tallyOf(doc) {
  const out = {};
  for (const rec of Object.values((doc && doc.shows) || {})) {
    for (const [id, pair] of Object.entries(rec.by || {})) {
      const e = (out[id] ||= { plays: 0, votes: 0 });
      e.plays += pair[0] || 0;
      e.votes += pair[1] || 0;
    }
  }
  return out;
}

export const TABS = {
  guide: 'Guide',
  artists: 'Artists',
  signals: 'Signals',
  features: 'Features',
  shows: 'Shows',
  songs: 'Songs',
  requests: 'Requests',
  ratings: 'Ratings',
  gigs: 'Gigs',
  venues: 'Venues',
  growth: 'Growth',
};
/* WHAT THE FOUNDER ASKED FOR ON 2026-09-14: "ALL the pertinent information of each
   artist & venue … data that is universally considered crucial for making marketing
   decisions — trends, behaviours, which ICPs to target — and which features of the app
   are actually being used". Two more snapshot tabs, both one row per artist:

     SIGNALS   the marketing read: where they came from, how often they play, how big
               their rooms are, whether the room pays, how fast they got to a first show,
               whether they are still active — and a derived SEGMENT that says which
               kind of customer they are today (residency / regular / occasional / not
               yet played / gone quiet). Every column is a number the app already keeps;
               the segment is arithmetic on them, named as derived.
     FEATURES  adoption: one column per thing an artist can switch on or use, as a
               count or a yes — so "which features are used" is a column to sort by.

   Nothing here reads a fan. Nothing here runs during a show. */
export const TAB_LIST = Object.values(TABS);

/* Caps. A sync is bounded so it can never turn into a job that times out
   halfway and leaves the sheet in a state nobody can reason about. When a cap
   bites, the sync SAYS SO in its result and in the Growth row — a silent
   truncation is how a spreadsheet starts lying. */
const MAX_ARTISTS = 400;
const MAX_SHOWS_PER_ARTIST = 40;
const MAX_ROWS_PER_TAB = 5000;

const day = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(0, 10) : '');
const stamp = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(0, 16).replace('T', ' ') : '');
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

const emptySync = () => ({ v: 1, lastRunAt: 0, runs: 0, byArtist: {} });
export async function readSyncState() {
  const { data } = await readDoc(SYNC, null);
  const d = { ...emptySync(), ...(data || {}) };
  d.byArtist ||= {};
  return d;
}

/* Wind one artist's watermark back. Only healHistory calls this, and only when it
   restores a night older than what the sheet has already exported — otherwise that
   night is correct in the Studio and permanently missing from the sheet, which is
   the same trap the comment above `waiting` was written about. */
export async function mutateWarehouseState(aid, fn) {
  return casDoc(SYNC, emptySync, (d) => {
    d.byArtist ||= {};
    d.byArtist[aid] ||= {};
    return fn(d.byArtist[aid]);
  });
}

/* ---------- the guide ----------
   Written once, in the same plain language Perry asks for in a report, because
   the person opening this spreadsheet in six months is him and not an engineer. */
export const GUIDE = [
  ['Tab', 'What it holds', 'How it behaves'],
  ['Artists', 'Everyone who has signed up: their plan, when they joined, who sent them, whether they can take money yet.', 'Rewritten every sync — always "right now".'],
  ['Signals', 'The marketing read, one row per artist: how often they play, how big the rooms are, whether the room pays, how fast they got to a first show, whether they are still active — and a Segment that names what kind of customer they are today (derived from the numbers beside it).', 'Rewritten every sync.'],
  ['Features', 'What each artist actually uses: one column per feature, as a count or a yes, and a score out of 24. Sort by a column to see which features are used and by whom.', 'Rewritten every sync.'],
  ['Shows', 'One row per finished gig: where, how many people, how many votes, what it took.', 'Added to, never changed. Safe to chart.'],
  ['Songs', "Every song in everyone's library, with how often it was played and how many votes it pulled across the nights still in their history.", 'Rewritten every sync.'],
  ['Requests', 'Songs the room asked for that were not on the list. The best answer to "what should I learn next".', 'Added to, never changed.'],
  ['Ratings', 'What fans thought of MySet itself — stars out of five and their own words.', 'Added to, never changed.'],
  ['Gigs', 'The calendar: every gig booked, past and future, and where in the world it is.', 'Rewritten every sync.'],
  ['Venues', 'Bars and venues that have signed up, their plan and whether they are verified.', 'Rewritten every sync.'],
  ['Growth', 'One row each time this syncs: the running totals. This is the tab to chart.', 'One new row per sync.'],
  ['', '', ''],
  ['A few things worth knowing', '', ''],
  ['This sheet is a copy.', 'Nothing in MySet ever reads it. Editing or deleting anything here cannot break the app or lose real data.', ''],
  ['Money comes from the night, not from Stripe.', 'Each show row carries what that night took. Stripe is still the real ledger for anything that has to balance.', ''],
  ['No fan is identified.', 'Phones are counted, never named. There is no device id anywhere in this file.', ''],
  ['"Real night" on Shows', 'means the show started on a published gig (no earlier than 90 minutes before the slot, before it ended) and something happened in it; anything else is a test or an accident, and the Signals tab counts only real nights.', ''],
  ['Segment on Signals is derived', 'residency = a real night a week or more over the last 28 days; regular = two or more in 28 days; occasional = at least one in 90 days; not yet played = signed up, no real night; gone quiet = played before, nothing in 90 days.', ''],
  ['Blank money means Stripe was switched off', 'for that night, not that the night earned nothing. The Shows tab has a column that says which.', ''],
];

/* ---------- one artist's rows ---------- */
async function artistRows(aid, artist, state, dry) {
  const plan = planOf(artist);
  const limits = limitsFor(plan);
  const show = await getShow(aid);
  const hist = await readHistIndex(aid);
  const reqs = await readRequests(aid);
  const fb = await readFeedback(aid);
  const events = await readEvents(aid);

  /* The two marketing tabs read the rest of what the artist owns — none of it
     on a hot path, all of it by name. A read that fails leaves a blank cell, never
     an empty row. */
  const safe = (p, dflt) => p.catch(() => dflt);
  const [lists, learn, subs, posts, profile, sess, log, rec, biz, connect, wishes, feats, meta, pkeys] = await Promise.all([
    safe(readLists(aid), { lists: [] }), safe(readLearn(aid), { list: [] }), safe(readSubs(aid), { subs: [] }),
    safe(readPosts(aid), { list: [] }), safe(getProfile(aid), {}), safe(readSessions(aid, null), { list: [] }),
    safe(readLog(aid, 100), []), safe(recoveryStatus(aid), { made: false }), safe(readBiz(aid), { gigs: {} }),
    safe(readConnect(aid), {}), safe(readWishes(aid), { list: [] }), safe(readFeaturedMine(aid), { list: [] }),
    safe(readMeta(aid), { tips: [], paid: {} }), safe(listPasskeys(aid), []),
  ]);
  const songIdsAll = (show.songs || []).map((x) => x.id).filter(Boolean).slice(0, 200);
  const charts = await safe(chartFlags(aid, songIdsAll), {});
  const lyricFlags = await Promise.all(songIdsAll.map((id) => safe(readLyrics(aid, id), null)));
  const lyricsSaved = lyricFlags.filter((d) => d && (d.lyrics || d.text || d.raw)).length;
  const chartsSaved = Object.values(charts).filter(Boolean).length;
  let pwSet = 0;
  for (const e of artist.emails || []) if (await safe(hasPassword(aid, e), false)) pwSet++;
  const rsvpDoc = await safe(readDoc(`rsvp_${aid}`, null), { data: null });
  const rsvps = Object.values(((rsvpDoc.data || {}).occ) || {}).reduce((a, o) => a + Object.keys((o && o.fans) || {}).length, 0);

  /* Which nights were REAL — the one rule (decision 0071, then 0095: `_nightrule.mjs`,
     shared with the stats page, the register and the tracker). */
  const allShows = (hist.shows || []).filter((x) => x && x.startedAt);
  const span = allShows.length ? [Math.min(...allShows.map((x) => x.startedAt)), Math.max(...allShows.map((x) => x.endedAt || x.startedAt))] : [Date.now(), Date.now()];
  const occs = occurrences(events.list || [], Math.min(span[0], Date.now() - 120 * 86400000), Math.max(span[1], Date.now() + 30 * 86400000));
  const gigOf = {}, judged = {};
  const judge = { hasCalendar: (events.list || []).length > 0, tz: ((events.list || []).find((e) => e && e.tz) || {}).tz || 'UTC' };
  for (const x of allShows) { const j = judgeRow(x, occs, judge); gigOf[x.showId] = j.gig; judged[x.showId] = j; }
  const isReal = (x) => judged[x.showId] && judged[x.showId].status === 'counted';
  const realNights = allShows.filter(isReal);

  const seen = state.byArtist[aid] || {};
  const showsSince = Number(seen.showsUntil) || 0;
  const reqsSince = Number(seen.reqsUntil) || 0;
  const fbSince = Number(seen.fbUntil) || 0;

  const songs = show.songs || [];
  const featured = songs.filter((s) => s.active !== false).length;

  /* Which shows are new to the sheet — OLDEST FIRST, which is the whole point.
     The history index is newest-first, and taking `.slice(0, 40)` off the front
     took the NEWEST forty and then set the watermark to the newest of those. Every
     older unsynced night was instantly behind the watermark and never exported
     again — while the code, the result note and INVARIANT 0bw all said "the rest
     come next sync". Reproduced by the review with 45 archived nights: five were
     lost permanently.

     Oldest-first means the watermark advances a batch at a time and the next run
     genuinely does pick up where this one stopped. */
  const waiting = (hist.shows || [])
    .filter((s) => (s.endedAt || 0) > showsSince)
    .sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0));
  const fresh = waiting.slice(0, MAX_SHOWS_PER_ARTIST);
  const cappedShows = waiting.length > fresh.length;

  /* The per-show song contributions, read once. Anything read below replaces its
     own entry rather than adding to a running total. */
  const { data: statsDoc } = await readDoc(SONGSTATS(aid), null);
  const mine = {};                 // showId -> { at, by: { songId: [plays, votes] } }
  let statsChanged = false;

  const showRows = [];
  for (const s of fresh) {
    let detail = null;
    try { detail = await readHistShow(aid, s.showId); } catch { detail = null; }
    const played = (detail && detail.played) || [];
    /* This night's own contribution, whole. Written under its showId, so ending a
       show twice replaces the record instead of adding a second one. */
    if (played.length) {
      const by = {};
      for (const p of played) {
        const pair = (by[p.songId] ||= [0, 0]);
        pair[0] += 1;
        pair[1] += (p.votes || 0);
      }
      mine[s.showId] = { at: s.endedAt || 0, by };
      statsChanged = true;
    }
    const m = (detail && detail.money) || {};
    const ratedThisShow = (fb.list || []).filter((r) => r && r.show === s.showId);
    const stars = ratedThisShow.length
      ? Math.round((ratedThisShow.reduce((a, r) => a + (r.stars || 0), 0) / ratedThisShow.length) * 10) / 10
      : '';
    const mins = s.startedAt && s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : '';
    showRows.push([
      day(s.endedAt), stamp(s.startedAt), artist.name || aid, aid,
      s.venue || '', s.city || '',
      mins,
      s.songsPlayed || 0, s.totalVotes || 0,
      s.room || 0, s.nets || 0, s.peakVoters || 0,
      pct(s.peakVoters || 0, s.room || 0),
      (detail && detail.stats && detail.stats.topSong && detail.stats.topSong.title) || '',
      money(m.gross), money(m.votes && m.votes.amount), money(m.tips && m.tips.amount),
      (m.votes && m.votes.count) || 0, (m.tips && m.tips.count) || 0,
      m.source || 'off',
      ((detail && detail.requested) || []).length,
      stars,
      plan, s.showId,
      isReal(s) ? 'yes' : 'test',
      gigOf[s.showId] ? `${gigOf[s.showId].venue || ''} ${gigOf[s.showId].date}`.trim() : '',
      s.room ? Math.round(((s.totalVotes || 0) / s.room) * 100) / 100 : '',
      s.paidVotes ?? '',
    ]);
  }

  /* Written NOW, not with the watermarks, and that is deliberate. Correctness
     depends only on which shows are recorded, not on whether a row reached
     Google — and the Songs tab is a snapshot rebuilt from this every run, so a
     failed sheet write simply means the next run writes the right numbers.
     Holding it back would leave the totals a day stale for no benefit.

     The merge happens INSIDE the CAS callback (INVARIANT 0bi), so two overlapping
     syncs cannot lose one another's shows. */
  let tally = tallyOf(statsDoc);
  if (statsChanged && !dry) {
    const merged = await casDoc(SONGSTATS(aid), emptySongStats, (d) => {
      d.shows = d.shows || {};
      for (const [sid, rec] of Object.entries(mine)) d.shows[sid] = rec;
      const keys = Object.keys(d.shows);
      if (keys.length > KEEP_SHOWS) {
        keys.sort((a, b) => (d.shows[b].at || 0) - (d.shows[a].at || 0));
        for (const k of keys.slice(KEEP_SHOWS)) delete d.shows[k];
      }
      return true;
    }).catch(() => null);
    /* Read back rather than trusting the local copy: casDoc may have retried
       against a document another sync had already added to. */
    const { data: fresh2 } = await readDoc(SONGSTATS(aid), null);
    tally = tallyOf(fresh2 || { shows: { ...((statsDoc || {}).shows || {}), ...mine } });
    void merged;
  } else if (statsChanged) {
    // a dry run reports what it WOULD be, without writing
    tally = tallyOf({ shows: { ...((statsDoc || {}).shows || {}), ...mine } });
  }

  const songRows = songs.map((sg) => {
    const e = tally[sg.id] || { plays: 0, votes: 0 };
    return [
      artist.name || aid, aid,
      sg.title || sg.id, sg.artist || '',
      sg.key || '',
      (sg.tags || []).join(' / '),
      sg.active === false ? 'off' : 'featured',
      e.plays, e.votes,
      e.plays ? Math.round((e.votes / e.plays) * 10) / 10 : '',
      sg.id,
    ];
  });

  const reqRows = (reqs.list || [])
    .filter((r) => r && (r.at || 0) > reqsSince)
    .map((r) => [
      day(r.at), stamp(r.at), artist.name || aid, aid,
      r.kind === 'birthday' ? 'birthday shout-out' : 'song',
      r.title || r.name || '', r.artist || '',
      r.cost || 0, r.status || '',
      r.status === 'accepted' ? 'yes' : r.status === 'declined' ? 'no' : 'waiting',
      r.showId || '',
    ]);

  const fbRows = (fb.list || [])
    .filter((r) => r && (r.at || 0) > fbSince)
    .map((r) => [
      day(r.at), stamp(r.at), artist.name || aid, aid,
      r.stars || '', r.note || '', r.show || '',
    ]);

  /* Gigs are RULES, not instances (INVARIANT 0e), so this expands the window a
     person would actually ask about: the last three months and the next six. */
  const from = day(Date.now() - 92 * 86400000);
  const to = day(Date.now() + 183 * 86400000);
  const gigRows = occurrencesFor(events, from, to).map((o) => [
    o.date, o.time, o.endTime || '',
    artist.name || aid, aid,
    o.venue || '', o.city || '', o.country || '', o.tz || '',
    o.repeating ? 'repeats' : 'one-off',
    o.date >= day(Date.now()) ? 'upcoming' : 'played',
    o.address || '', o.ticketUrl || '', o.note || '',
  ]);

  const nights = (hist.shows || []).length;
  const lifetimeVotes = (hist.shows || []).reduce((a, s) => a + (s.totalVotes || 0), 0);
  const lifetimeRoom = (hist.shows || []).reduce((a, s) => a + (s.room || 0), 0);
  const lifetimeGross = (hist.shows || []).reduce((a, s) => a + (s.gross || 0), 0);
  const lastNight = (hist.shows || [])[0] || null;

  const arow = [
    artist.name || '', aid, artist.slug || '',
    artist.email || '',                       // filled in by the caller, which holds byEmail
    plan, limits.label,
    artist.compedBy ? 'comped: ' + artist.compedBy : '',
    artist.planUntil ? day(artist.planUntil) : '',
    Math.round((limits.cut || 0) * 1000) / 10,
    artist.verified ? 'yes' : '',
    day(artist.createdAt),
    artist.createdAt ? Math.floor((Date.now() - artist.createdAt) / 86400000) : '',
    artist.referredBy || '', artist.src || '', artist.refSlug || '',
    artist.country || '',
    artist.connect ? 'started' : '',
    artist.payoutsLive ? 'yes' : '',
    songs.length, featured,
    limits.featured === Infinity ? 'unlimited' : limits.featured,
    MAX_LIBRARY,
    show.gigCount || 0, limits.gigs === Infinity ? 'unlimited' : limits.gigs,
    nights, lifetimeVotes, lifetimeRoom, money(lifetimeGross),
    nights ? Math.round(lifetimeRoom / nights) : 0,
    fb.count || 0, fb.count ? Math.round((fb.sum / fb.count) * 10) / 10 : '',
    (reqs.list || []).length,
    (events.list || []).length,
    lastNight ? day(lastNight.endedAt) : '',
    lastNight ? Math.floor((Date.now() - (lastNight.endedAt || 0)) / 86400000) : '',
    show.status || '', show.unlimited ? 'unlimited' : show.freeCredits,
    show.replayCost || '',
    show.requests && show.requests.on ? 'on' : 'off',
    show.birthdays && show.birthdays.on ? 'on' : 'off',
    artist.shareStats === false ? 'no' : 'yes',
  ];

  /* ---- Signals: the marketing read ---- */
  const now = Date.now();
  const inLast = (days) => realNights.filter((x) => x.startedAt > now - days * 86400000);
  const r28 = inLast(28).length, r30 = inLast(30).length, r90 = inLast(90).length;
  const realRoom = realNights.reduce((a, x) => a + (x.room || 0), 0);
  const realVotes = realNights.reduce((a, x) => a + (x.totalVotes || 0), 0);
  const realGross = realNights.reduce((a, x) => a + (Number(x.gross) || 0), 0);
  const packs = Object.values(meta.paid || {}).filter((p) => p && p.kind !== 'tip' && p.kind !== 'merch');
  const tips = (meta.tips || []);
  const firstReal = realNights.slice().sort((a, b) => a.startedAt - b.startedAt)[0] || null;
  const lastReal = realNights.slice().sort((a, b) => b.startedAt - a.startedAt)[0] || null;
  const upcoming = occs.filter((o) => o.startsAt > now && o.startsAt < now + 28 * 86400000).length;
  const due = occs.filter((o) => o.endsAt <= now && o.endsAt > now - 90 * 86400000);
  const usedKeys = new Set(realNights.map((x) => gigOf[x.showId] && (gigOf[x.showId].eventId + '@' + gigOf[x.showId].date)));
  const usedPct = due.length ? Math.round(due.filter((o) => usedKeys.has(o.eventId + '@' + o.date)).length / due.length * 100) : '';
  const cities = {};
  for (const o of occs) if (o.city) cities[o.city] = (cities[o.city] || 0) + 1;
  const city = Object.entries(cities).sort((a, b) => b[1] - a[1]).map(([c]) => c)[0] || '';
  const tagCount = {};
  for (const sg of songs) for (const tg of sg.tags || []) tagCount[tg] = (tagCount[tg] || 0) + 1;
  const genres = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(' / ');
  const segment = r28 >= 4 ? 'residency' : r28 >= 2 ? 'regular' : r90 >= 1 ? 'occasional'
    : realNights.length ? 'gone quiet' : 'not yet played';
  const srow = [
    artist.name || '', aid, plan, day(artist.createdAt),
    artist.createdAt ? Math.floor((now - artist.createdAt) / 86400000) : '',
    artist.src || '', artist.referredBy || '', artist.country || '', city,
    segment, inLast(14).length ? 'yes' : 'no',
    realNights.length, r30, Math.round((r28 / 4) * 10) / 10,
    Math.round((upcoming / 4) * 10) / 10, usedPct,
    realNights.length ? Math.round(realRoom / realNights.length) : '',
    Math.max(0, ...realNights.map((x) => x.room || 0)) || '',
    realRoom ? Math.round((realVotes / realRoom) * 100) / 100 : '',
    realNights.length ? Math.round(realVotes / realNights.length) : '',
    packs.length, realRoom ? Math.round((packs.length / realRoom) * 1000) / 10 : '',
    tips.length,
    realNights.length ? money(realGross / realNights.length) : '',
    realRoom ? money(realGross / realRoom) : '',
    firstReal && artist.createdAt ? Math.max(0, Math.floor((firstReal.startedAt - artist.createdAt) / 86400000)) : '',
    lastReal ? Math.floor((now - lastReal.startedAt) / 86400000) : '',
    fb.count ? Math.round((fb.sum / fb.count) * 10) / 10 : '',
    songs.length, genres, (artist.emails || []).length,
    allShows.length - realNights.length,
  ];

  /* ---- Features: adoption, one column each ---- */
  const links = Object.entries((profile && profile.links) || {}).filter(([, v]) => v).map(([k]) => k);
  const clips = (posts.list || []).filter((p) => p && p.clip).length;
  const hero = ((profile && profile.media) || []).some((m) => m && (m.hero || m.tick || m.pick)) || ((profile && profile.media) || []).length > 0;
  const signins30 = (log || []).filter((e) => e && /^signin/.test(e.e || '') && e.t > now - 30 * 86400000).length;
  const lastSignin = (log || []).find((e) => e && /^signin/.test(e.e || ''));
  const bizNights = Object.keys((biz && biz.gigs) || {}).length;
  const used = [
    (lists.lists || []).length, (learn.list || []).length, chartsSaved, lyricsSaved,
    show.requests && show.requests.on ? 1 : 0, show.birthdays && show.birthdays.on ? 1 : 0,
    show.replayCost && show.replayCost !== 1 ? 1 : 0, ((profile && profile.merch) || []).length, (wishes.list || []).length,
    (posts.list || []).length, clips, ((profile && profile.photos) || []).filter(Boolean).length, hero ? 1 : 0, links.length,
    profile && profile.bio ? 1 : 0, profile && profile.tagline ? 1 : 0,
    (pkeys || []).length, rec.made ? 1 : 0, pwSet, show.codeHash ? 1 : 0, (subs.subs || []).length,
    bizNights, connectUsable(connect) ? 1 : 0, (feats.list || []).length,
  ];
  const frow = [
    artist.name || '', aid, plan, used.filter(Boolean).length,
    (lists.lists || []).length, (learn.list || []).length, chartsSaved, lyricsSaved,
    show.requests && show.requests.on ? 'yes' : '', show.birthdays && show.birthdays.on ? 'yes' : '',
    show.replayCost && show.replayCost !== 1 ? show.replayCost : '',
    ((profile && profile.merch) || []).length, (wishes.list || []).length,
    (posts.list || []).length, clips, ((profile && profile.photos) || []).filter(Boolean).length, hero ? 'yes' : '',
    links.length, links.join(' / '), profile && profile.bio ? 'yes' : '', profile && profile.tagline ? 'yes' : '',
    (pkeys || []).length, rec.made ? `${rec.left} of ${rec.of} left` : '', pwSet ? `yes (${pwSet})` : '', show.codeHash ? 'yes' : '',
    (subs.subs || []).length, (sess.list || []).length, signins30, lastSignin ? day(lastSignin.t) : '',
    bizNights, connect && connect.acct ? (connectUsable(connect) ? 'live' : 'started') : '', (feats.list || []).length,
    (events.list || []).length, rsvps,
  ];

  const marks = {
    showsUntil: Math.max(showsSince, ...(fresh.map((s) => s.endedAt || 0)), 0),
    reqsUntil: Math.max(reqsSince, ...((reqs.list || []).map((r) => r.at || 0)), 0),
    fbUntil: Math.max(fbSince, ...((fb.list || []).map((r) => r.at || 0)), 0),
  };

  return {
    arow, srow, frow, showRows, songRows, reqRows, fbRows, gigRows, marks, cappedShows,
    venueUse: realNights.map((x) => ({ venueId: (occs.find((o) => o.eventId === (gigOf[x.showId] || {}).eventId) || {}).venueId || '', room: x.room || 0, votes: x.totalVotes || 0 })),
    venueGigs: [...new Set(occs.filter((o) => o.venueId).map((o) => o.venueId))],
    /* RUNNING TOTALS, not this sync's deltas. The Growth tab is a time series
       somebody charts, so every number in it has to be "how much there is", or a
       line on that chart means nothing. `reqs`/`ratings` are the whole stored
       list, not the new rows — those are counted separately as "rows added". */
    totals: { nights, votes: lifetimeVotes, room: lifetimeRoom, gross: lifetimeGross,
              songs: songs.length, paid: plan !== 'free' ? 1 : 0,
              reqs: (reqs.list || []).length,
              ratings: fb.count || 0, starSum: fb.sum || 0 },
  };
}

const HEAD = {
  artists: ['Name', 'Artist id', 'Page', 'Email', 'Plan', 'Plan name', 'Comped', 'Plan until',
            'Cut %', 'Verified', 'Joined', 'Days in', 'Referred by', 'Signed up from', 'Referral link',
            'Country', 'Payouts set up', 'Payouts live', 'Songs kept', 'Songs featured',
            'Featured allowed', 'Library cap', 'Shows this month', 'Shows allowed',
            'Nights played', 'Votes all time', 'Phones all time', 'Money all time',
            'Average room', 'Ratings', 'Average stars', 'Requests', 'Gigs booked',
            'Last night', 'Days since', 'Show status', 'Free votes', 'Replay cost',
            'Song requests', 'Birthdays', 'Shares stats with venues'],
  shows: ['Date', 'Started', 'Artist', 'Artist id', 'Venue', 'City', 'Minutes',
          'Songs played', 'Votes', 'Phones in room', 'Networks', 'People who voted',
          'Voted %', 'Top song', 'Money', 'From votes', 'From tips', 'Vote sales',
          'Tips', 'Money source', 'Asked for and not played', 'Average stars', 'Plan', 'Show id',
          'Real night', 'Published gig', 'Votes per phone', 'Paid votes'],
  signals: ['Name', 'Artist id', 'Plan', 'Joined', 'Days in', 'Signed up from', 'Referred by',
            'Country', 'City (from gigs)', 'Segment', 'Active (14 days)',
            'Real nights all time', 'Real nights last 30 days', 'Nights per week (28 days)',
            'Gigs on calendar per week (next 28 days)', 'Published gigs used %',
            'Average room', 'Biggest room', 'Votes per phone', 'Votes per night',
            'Vote packs bought', 'Pack conversion % (packs per phone)', 'Tips received', 'Money per night', 'Money per phone',
            'Days to first show', 'Days since last show', 'Average stars', 'Library size',
            'Top genres', 'Seats used', 'Test nights (not on a gig)'],
  features: ['Name', 'Artist id', 'Plan', 'Features used (of 24)',
             'Setlists', 'Songs to learn', 'Charts saved', 'Lyrics saved',
             'Song requests on', 'Birthday shout-outs on', 'Replay cost set', 'Merch items', 'Shop requests received',
             'Community posts', 'Clips posted', 'Profile photos', 'Hero video', 'Profile links', 'Which links', 'Bio written', 'Tagline written',
             'Passkeys', 'Recovery codes', 'Password set', 'Studio code set', 'Push alerts', 'Devices signed in', 'Sign-ins last 30 days', 'Last sign-in',
             'Business dashboard nights logged', 'Stripe Connect', 'Featured spots bought', 'Gigs on calendar', 'RSVPs received'],
  songs: ['Artist', 'Artist id', 'Song', 'Original artist', 'Key', 'Tags', 'State',
          'Times played', 'Votes all time', 'Votes per play', 'Song id'],
  requests: ['Date', 'When', 'Artist', 'Artist id', 'Kind', 'Asked for', 'Original artist',
             'Cost in votes', 'Status', 'Played it', 'Show id'],
  ratings: ['Date', 'When', 'Artist', 'Artist id', 'Stars', 'What they said', 'Show id'],
  gigs: ['Date', 'Start', 'End', 'Artist', 'Artist id', 'Venue', 'City', 'Country',
         'Time zone', 'Repeat', 'Past or future', 'Address', 'Tickets', 'Note'],
  venues: ['Name', 'Venue id', 'Page', 'Email', 'City', 'Country', 'Plan', 'Verified',
           'Verified by', 'Joined', 'Days in', 'Photos', 'Events listed', 'Amenities',
           'Has menu', 'Has offers', 'Phone', 'Website',
           'Artists playing here (calendar)', 'Nights played here (all time)', 'Phones here (all time)', 'Votes here (all time)',
           'Community posts', 'Merch items', 'Stripe Connect', 'Seats used', 'Password set', 'Last sign-in'],
  growth: ['When', 'Artists', 'Paying artists', 'Venues', 'Paying venues', 'Nights played',
           'Votes all time', 'Phones all time', 'Money all time', 'Songs in the system',
           'Requests', 'Ratings', 'Average stars', 'Gigs booked', 'Rows added this sync',
           'Artists read', 'Capped'],
};

/* ---------- the sync ---------- */

/** Reads the store, writes the sheet. Returns a plain-language result either way. */
/** How long a run is assumed to still be going before another may start. */
const RUN_LOCK_MS = 5 * 60e3;

export async function syncSheet({ dry = false } = {}) {
  const off = sheetsOffReason();
  if (off) return { ok: false, off: true, error: off };

  const startedAt = Date.now();
  const state = await readSyncState();

  /* ONE SYNC AT A TIME. The 03:20 cron and Perry tapping the button a second
     later would both walk the store and both append — the same night twice in
     Shows, and the Studio's own busy flag is client-side so it cannot help. The
     lock is stale after five minutes so a run that dies cannot wedge it shut. */
  if (!dry) {
    let held = false;
    await casDoc(SYNC, emptySync, (d) => {
      const since = Date.now() - (Number(d.runningSince) || 0);
      if (d.runningSince && since < RUN_LOCK_MS) { held = true; return false; }
      d.runningSince = Date.now();
      return true;
    }).catch(() => {});
    if (held) return { ok: false, busy: true, error: 'A sync is already running. Give it a minute.' };
  }
  try {
    return await runSync({ dry, startedAt, state });
  } finally {
    if (!dry) await casDoc(SYNC, emptySync, (d) => { d.runningSince = 0; return true; }).catch(() => {});
  }
}

async function runSync({ dry, startedAt, state }) {
  const reg = await readArtists();
  const ids = Object.keys(reg.byId || {});
  const capped = ids.length > MAX_ARTISTS;
  const use = ids.slice(0, MAX_ARTISTS);

  /* byEmail is the only place an artist's address lives, and it is keyed the
     other way round. One pass rather than a scan per artist. */
  const emailOf = {}, emailsOf = {};
  for (const [email, link] of Object.entries(reg.byEmail || {})) {
    if (link && link.artistId && !emailOf[link.artistId]) emailOf[link.artistId] = email;
    if (link && link.artistId) (emailsOf[link.artistId] ||= []).push(email);
  }

  const artists = [], signals = [], features = [], shows = [], songs = [], requests = [], ratings = [], gigs = [];
  const atVenue = {};            // venueId -> { artists:Set, nights, phones, votes }
  const marks = {};
  const broke = [];
  let cappedShows = false, budgetSpent = false;
  const t = { nights: 0, votes: 0, room: 0, gross: 0, songs: 0, paid: 0,
              reqs: 0, ratings: 0, starSum: 0 };

  for (const aid of use) {
    /* STOP TAKING ARTISTS, RATHER THAN TRIMMING ROWS AT THE END.
       There used to be a `trim()` that cut every tab to 5,000 rows AFTER the
       watermarks had been computed — so the dropped rows were behind the
       watermark and never came back, and nothing reported it. The cap now
       decides which artists this run covers; an artist either has all their rows
       and their watermark moves, or has none and it does not. */
    if (shows.length >= MAX_ROWS_PER_TAB || requests.length >= MAX_ROWS_PER_TAB
        || ratings.length >= MAX_ROWS_PER_TAB || songs.length >= MAX_ROWS_PER_TAB
        || artists.length >= MAX_ROWS_PER_TAB) { budgetSpent = true; break; }
    const a = { ...(reg.byId[aid] || {}), email: emailOf[aid] || '', emails: emailsOf[aid] || [] };
    let r;
    try {
      r = await artistRows(aid, a, state, dry);
    } catch (e) {
      /* One unreadable artist must not cost the other 399 their rows — but this
         catch also swallowed a genuine ReferenceError in my own code and turned a
         hard crash into "some columns are empty", which took a debugger to find.
         So the reason goes in the ROW, in a full-width row (a short one silently
         shifts every column after it), AND in the result, where a person or a log
         will actually see it. */
      const why = 'could not read: ' + String((e && e.message) || e).slice(0, 120);
      const row = new Array(HEAD.artists.length).fill('');
      row[0] = a.name || ''; row[1] = aid; row[2] = a.slug || ''; row[3] = a.email || '';
      row[4] = planOf(a); row[10] = day(a.createdAt);
      row[HEAD.artists.length - 1] = why;
      artists.push(row);
      broke.push({ artistId: aid, why });
      console.error(`sheet sync: ${aid} failed —`, (e && e.stack) || e);
      continue;
    }
    artists.push(r.arow);
    signals.push(r.srow); features.push(r.frow);
    for (const vid of r.venueGigs) { const v = (atVenue[vid] ||= { artists: new Set(), nights: 0, phones: 0, votes: 0 }); v.artists.add(aid); }
    for (const u of r.venueUse) if (u.venueId) { const v = (atVenue[u.venueId] ||= { artists: new Set(), nights: 0, phones: 0, votes: 0 }); v.nights++; v.phones += u.room; v.votes += u.votes; }
    shows.push(...r.showRows);
    songs.push(...r.songRows);
    requests.push(...r.reqRows);
    ratings.push(...r.fbRows);
    gigs.push(...r.gigRows);
    marks[aid] = r.marks;
    cappedShows = cappedShows || r.cappedShows;
    t.nights += r.totals.nights; t.votes += r.totals.votes; t.room += r.totals.room;
    t.gross += r.totals.gross; t.songs += r.totals.songs; t.paid += r.totals.paid;
    t.reqs += r.totals.reqs; t.ratings += r.totals.ratings; t.starSum += r.totals.starSum;
  }

  /* Venues. Their profiles are a second read each, so this reads the registry
     row for everything it can and the profile only for what only it has. */
  const vreg = await readVenues();
  const vids = Object.keys(vreg.byId || {});
  const vEmailOf = {};
  for (const [email, link] of Object.entries(vreg.byEmail || {})) {
    if (link && link.venueId && !vEmailOf[link.venueId]) vEmailOf[link.venueId] = email;
  }
  const venues = [];
  let paidVenues = 0;
  for (const vid of vids.slice(0, MAX_ARTISTS)) {
    const v = vreg.byId[vid] || {};
    /* getVenueProfile, not a hand-built key: the key is `vprofile_` and a guess
       at `vprof_` read nothing at all and reported every venue as blank. */
    let p = null;
    try { p = await getVenueProfile(vid); } catch { p = null; }
    const plan = venuePlanOf(v);
    if (plan !== 'free') paidVenues++;
    let evCount = 0;
    try { evCount = ((await readEvents('v_' + vid)).list || []).length; } catch { evCount = 0; }
    const o = 'v_' + vid, at = atVenue[vid] || { artists: new Set(), nights: 0, phones: 0, votes: 0 };
    const vsafe = (pr, dflt) => pr.catch(() => dflt);
    const [vposts, vconnect, vlog] = await Promise.all([vsafe(readPosts(o), { list: [] }), vsafe(readConnect(o), {}), vsafe(readLog(o, 50), [])]);
    const vEmails = Object.entries(vreg.byEmail || {}).filter(([, l]) => l && l.venueId === vid).map(([e]) => e);
    let vpw = 0;
    for (const e of vEmails) if (await vsafe(hasPassword(o, e), false)) vpw++;
    const vLast = (vlog || []).find((e) => e && /^signin/.test(e.e || ''));
    venues.push([
      v.name || (p && p.name) || '', vid, v.slug || '', vEmailOf[vid] || '',
      (p && p.city) || v.city || '', (p && p.country) || v.country || '',
      plan, v.verified ? 'yes' : '', v.verifiedVia || '',
      day(v.createdAt), v.createdAt ? Math.floor((Date.now() - v.createdAt) / 86400000) : '',
      ((p && p.photos) || []).filter(Boolean).length + ((p && p.photo) ? 1 : 0),
      evCount,
      ((p && p.amenities) || []).join(' / '),
      (p && p.menu && ((p.menu.items || []).length || p.menu.url)) ? 'yes' : '',
      (p && (p.offers || []).length) ? 'yes' : '',
      (p && p.phone) || '', (p && (p.links || {}).website) || '',
      at.artists.size, at.nights, at.phones, at.votes,
      (vposts.list || []).length, ((p && p.merch) || []).length,
      vconnect && vconnect.acct ? (connectUsable(vconnect) ? 'live' : 'started') : '',
      vEmails.length, vpw ? `yes (${vpw})` : '', vLast ? day(vLast.t) : '',
    ]);
  }

  const added = shows.length + requests.length + ratings.length;
  const shortOfArtists = capped || budgetSpent;
  const anyCap = shortOfArtists || cappedShows;

  const growth = [[
    stamp(startedAt), ids.length, t.paid, vids.length, paidVenues,
    t.nights, t.votes, t.room, money(t.gross), t.songs,
    t.reqs, t.ratings,
    t.ratings ? Math.round((t.starSum / t.ratings) * 10) / 10 : '',
    gigs.length, added, artists.length,
    anyCap ? 'yes — some rows were left for the next sync' : '',
  ]];

  const plan = {
    tabs: TAB_LIST,
    snapshot: {
      [TABS.artists]: [HEAD.artists, ...artists],
      [TABS.signals]: [HEAD.signals, ...signals],
      [TABS.features]: [HEAD.features, ...features],
      [TABS.songs]: [HEAD.songs, ...songs],
      [TABS.gigs]: [HEAD.gigs, ...gigs],
      [TABS.venues]: [HEAD.venues, ...venues],
    },
    /* Each log tab names which watermark field it carries, so a tab that appends
       successfully can have ITS mark committed even if a later tab fails. */
    log: {
      [TABS.shows]: { head: HEAD.shows, rows: shows, mark: 'showsUntil', keyCols: [HEAD.shows.indexOf('Show id')] },
      [TABS.requests]: { head: HEAD.requests, rows: requests, mark: 'reqsUntil', keyCols: [1, 3, 5, 10] },
      [TABS.ratings]: { head: HEAD.ratings, rows: ratings, mark: 'fbUntil', keyCols: [1, 3, 6] },
      [TABS.growth]: { head: HEAD.growth, rows: growth, mark: null },
    },
  };

  if (dry) {
    /* The plan rides along so a session can hand the same rows to a spreadsheet
       by another road (the first sync into the founder's Drive was an .xlsx built
       from this, before the service account existed — decision 0072). */
    return { ok: true, dry: true, counts: countsOf(plan), broke, plan,
             tookMs: Date.now() - startedAt };
  }

  const sheet = await settleSheet({ now: startedAt, reg });
  const made = await ensureTabs(TAB_LIST);
  await styleTabs(TAB_LIST).catch(() => {});      // looks are never the reason a sync fails
  if (made.includes(TABS.guide) || (await tabIsEmpty(TABS.guide))) {
    await writeTab(TABS.guide, GUIDE);
  }
  for (const [tab, rows] of Object.entries(plan.snapshot)) await writeTab(tab, rows);

  /* WATERMARKS COMMIT PER TAB, IMMEDIATELY AFTER THAT TAB'S APPEND.
     They used to all commit together at the end, which meant a failure on the
     LAST append re-sent every earlier tab's rows next time — one night appearing
     twice in Shows because a rating failed to write. Committing each feed as soon
     as its own rows have landed keeps INVARIANT 0bs (never move a mark over rows
     that did not land) without making unrelated tabs pay for each other. */
  const commit = (field) => casDoc(SYNC, emptySync, (d) => {
    d.byArtist ||= {};
    for (const [aid, m] of Object.entries(marks)) {
      if (!(field in m)) continue;
      d.byArtist[aid] = { ...(d.byArtist[aid] || {}), [field]: m[field] };
    }
    return true;
  }).catch(() => {});

  let failed = null;
  for (const [tab, { head, rows, mark, keyCols }] of Object.entries(plan.log)) {
    try {
      let fresh = rows;
      if (keyCols && rows.length) {
        const have = await existingKeys(tab, keyCols);
        fresh = rows.filter((r) => !have.has(rowKey(r, keyCols)));
      }
      await appendTab(tab, fresh, head);
      if (mark) await commit(mark);
    } catch (e) {
      /* Stop here rather than carrying on: a later tab appending after an earlier
         one failed would put the sheet in a state where "how far did I get" is
         different per tab AND out of order, which is harder to reason about than
         one clean stopping point. */
      failed = { tab, why: String((e && e.message) || e) };
      break;
    }
  }

  await casDoc(SYNC, emptySync, (d) => {
    d.lastRunAt = startedAt;
    d.runs = (d.runs || 0) + 1;
    return true;
  }).catch(() => {});

  if (failed) {
    throw new Error(`Wrote the snapshots, then failed on ${failed.tab}: ${failed.why}. `
      + `Nothing is lost — the rows that tab was carrying come again next sync.`);
  }

  return {
    ok: true, at: startedAt, tookMs: Date.now() - startedAt,
    made, counts: countsOf(plan), broke,
    sheet,
    capped: anyCap,
    note: capped
      ? `Read the first ${MAX_ARTISTS} artists of ${ids.length}. The rest come next sync.`
      : budgetSpent
        ? `Covered ${artists.length} artists before hitting this run's row budget. The rest come next sync.`
        : cappedShows
          ? 'Some artists had more new nights than one sync carries; the rest come next sync.' : '',
  };
}

const countsOf = (plan) => ({
  ...Object.fromEntries(Object.entries(plan.snapshot).map(([k, v]) => [k, v.length - 1])),
  ...Object.fromEntries(Object.entries(plan.log).map(([k, v]) => [k, v.rows.length])),
});

/** What the Studio shows on the Sheet card. Never returns a secret. */
export async function sheetStatus() {
  const off = sheetsOffReason();
  const state = await readSyncState();
  const base = {
    ok: true, on: !off, reason: off || '',
    lastRunAt: state.lastRunAt || 0, runs: state.runs || 0,
    tabs: TAB_LIST,
    /* The address is not a secret — it is the thing Perry has to paste into
       Google's share dialog, and not showing it is what makes this setup fail. */
    account: off ? '' : (process.env.GSHEET_EMAIL || '').trim(),
  };
  if (off) return base;
  try {
    const doc = await readSheetDoc();
    useSheet(doc.id || '');
    const { title, tabs } = await tabTitles();
    const cells = await sheetCells().catch(() => 0);
    return { ...base, reachable: true, title, present: tabs.filter((x) => TAB_LIST.includes(x)),
             missing: TAB_LIST.filter((x) => !tabs.includes(x)),
             id: activeSheetId(), url: sheetUrl(), cells, limit: CELL_LIMIT, rollAt: ROLL_AT(),
             pct: Math.round(100 * cells / CELL_LIMIT),
             prev: (doc.prev || []).map((p) => ({ id: p.id, url: sheetUrl(p.id), from: p.from, until: p.until })) };
  } catch (e) {
    return { ...base, reachable: false, error: String(e.message || e).slice(0, 400) };
  }
}

export { sheetsOn, MAX_ARTISTS, MAX_SHOWS_PER_ARTIST };
