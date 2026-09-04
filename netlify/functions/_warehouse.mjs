import { readDoc, casDoc, getShow } from './_lib.mjs';
import { readArtists } from './_auth.mjs';
import { planOf, limitsFor, MAX_LIBRARY } from './_plan.mjs';
import { readHistIndex, readHistShow } from './_history.mjs';
import { readRequests } from './_requests.mjs';
import { readFeedback } from './_feedback.mjs';
import { readEvents, occurrencesFor } from './_events.mjs';
import { readVenues, venuePlanOf, getVenueProfile } from './_venues.mjs';
import {
  sheetsOn, sheetsOffReason, ensureTabs, writeTab, appendTab, tabIsEmpty, tabTitles,
} from './_sheets.mjs';

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
  shows: 'Shows',
  songs: 'Songs',
  requests: 'Requests',
  ratings: 'Ratings',
  gigs: 'Gigs',
  venues: 'Venues',
  growth: 'Growth',
};
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

/* ---------- the guide ----------
   Written once, in the same plain language Perry asks for in a report, because
   the person opening this spreadsheet in six months is him and not an engineer. */
const GUIDE = [
  ['Tab', 'What it holds', 'How it behaves'],
  ['Artists', 'Everyone who has signed up: their plan, when they joined, who sent them, whether they can take money yet.', 'Rewritten every sync — always "right now".'],
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
    Math.round((limits.cut || 0) * 100),
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

  const marks = {
    showsUntil: Math.max(showsSince, ...(fresh.map((s) => s.endedAt || 0)), 0),
    reqsUntil: Math.max(reqsSince, ...((reqs.list || []).map((r) => r.at || 0)), 0),
    fbUntil: Math.max(fbSince, ...((fb.list || []).map((r) => r.at || 0)), 0),
  };

  return {
    arow, showRows, songRows, reqRows, fbRows, gigRows, marks, cappedShows,
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
          'Tips', 'Money source', 'Asked for and not played', 'Average stars', 'Plan', 'Show id'],
  songs: ['Artist', 'Artist id', 'Song', 'Original artist', 'Key', 'Tags', 'State',
          'Times played', 'Votes all time', 'Votes per play', 'Song id'],
  requests: ['Date', 'When', 'Artist', 'Artist id', 'Kind', 'Asked for', 'Original artist',
             'Cost in votes', 'Status', 'Played it', 'Show id'],
  ratings: ['Date', 'When', 'Artist', 'Artist id', 'Stars', 'What they said', 'Show id'],
  gigs: ['Date', 'Start', 'End', 'Artist', 'Artist id', 'Venue', 'City', 'Country',
         'Time zone', 'Repeat', 'Past or future', 'Address', 'Tickets', 'Note'],
  venues: ['Name', 'Venue id', 'Page', 'Email', 'City', 'Country', 'Plan', 'Verified',
           'Verified by', 'Joined', 'Days in', 'Photos', 'Events listed', 'Amenities',
           'Has menu', 'Has offers', 'Phone', 'Website'],
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
  const emailOf = {};
  for (const [email, link] of Object.entries(reg.byEmail || {})) {
    if (link && link.artistId && !emailOf[link.artistId]) emailOf[link.artistId] = email;
  }

  const artists = [], shows = [], songs = [], requests = [], ratings = [], gigs = [];
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
    const a = { ...(reg.byId[aid] || {}), email: emailOf[aid] || '' };
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
      [TABS.songs]: [HEAD.songs, ...songs],
      [TABS.gigs]: [HEAD.gigs, ...gigs],
      [TABS.venues]: [HEAD.venues, ...venues],
    },
    /* Each log tab names which watermark field it carries, so a tab that appends
       successfully can have ITS mark committed even if a later tab fails. */
    log: {
      [TABS.shows]: { head: HEAD.shows, rows: shows, mark: 'showsUntil' },
      [TABS.requests]: { head: HEAD.requests, rows: requests, mark: 'reqsUntil' },
      [TABS.ratings]: { head: HEAD.ratings, rows: ratings, mark: 'fbUntil' },
      [TABS.growth]: { head: HEAD.growth, rows: growth, mark: null },
    },
  };

  if (dry) {
    return { ok: true, dry: true, counts: countsOf(plan), broke,
             tookMs: Date.now() - startedAt };
  }

  const made = await ensureTabs(TAB_LIST);
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
  for (const [tab, { head, rows, mark }] of Object.entries(plan.log)) {
    try {
      await appendTab(tab, rows, head);
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
    const { title, tabs } = await tabTitles();
    return { ...base, reachable: true, title, present: tabs.filter((x) => TAB_LIST.includes(x)),
             missing: TAB_LIST.filter((x) => !tabs.includes(x)) };
  } catch (e) {
    return { ...base, reachable: false, error: String(e.message || e).slice(0, 400) };
  }
}

export { sheetsOn, MAX_ARTISTS, MAX_SHOWS_PER_ARTIST };
