import { COUNTDOWN_MS, voteCounts, firstVotedAt, rankSongs, creditsUsed, costOf, unspentPaid,
         isUnlimited, countInRoom, pollFloorFor, boardLimitFor,
         GENRES, playable, votable } from './_lib.mjs';
import { MARK } from './_canary.mjs';
import { canTakeMoney } from './_pay.mjs';
import { VIBE_OPTIONS } from './_requests.mjs';

/* THE SHARED BOARD, AND THE ONE THING ON IT THAT IS YOURS.

   Until 2026-09-11 every phone in the room polled /api/show?fan=<id>, which answered
   with the whole board PLUS that phone's own credits in one payload. Nothing about
   it could be cached — ten thousand fan ids are ten thousand cache keys (INVARIANT
   0ep) — so the server re-read the whole audience bag once per phone per poll, and
   the internal read traffic grew with the SQUARE of the room. That quadratic, not
   money, is the honest ceiling in docs/reports/room-ceiling.html.

   This module is the split (decision 0034, P3-001). ONE payload is the same for every
   phone in the room (`buildBoard`) and carries no fan id in its address, so Netlify's
   edge can serve it from cache for the length of the polling interval: the audience
   bag is read once per interval, not once per phone. The OTHER (`buildMe`) is only
   what is true of this phone — credits, its own votes, paid packs, request statuses
   — and it reads ONE shard, not twelve.

   /api/show still exists and still answers the old shape, composed from the same two
   builders by `mergeForOne`, so a page opened before this deployed keeps working and
   the two payloads cannot drift: there is ONE definition of a song's shape, ONE of
   the rank, ONE of what a fan is owed. public/vote.html carries a copy of
   `mergeForOne` (it has to — the merge happens on the phone); test/split.mjs runs
   that copy against this one on the same fixtures so the two are held together by a
   test rather than by memory. */

/** The board everybody in the room sees. Nothing in it is about one phone.
 *  `at` is the moment the caller BEGAN reading the room, not the moment this ran:
 *  a phone compares it with the time of its own last cast, and a vote whose write
 *  landed while the twelve shards were being read is not in this board even though
 *  the render finished after it. Stamping the start makes that board honestly
 *  "older" than the vote. Handlers pass it; a caller that omits it gets now. */
export function buildBoard({ aid, show, fans, flags, at = Date.now() }) {
  /* HOW BIG THE ROOM IS TONIGHT — and NOBODY IS EVER TURNED AWAY.

     A plan's `audience` number is a BILLING line, not a turnstile. Going over it
     does not close the door, refuse a vote, or interrupt anybody: the room slows
     down, the board shortens, and the artist is told afterwards. That is the
     market's own answer — Mentimeter publishes it as policy, and it is the humane
     one as well as the cheap one. A single oversized night costs cents; a fan
     locked out mid-song in front of the artist costs the artist.

     The count is free: the bag was read to count the votes. It is not atomic either
     — a burst of arrivals inside one polling interval all read the same number —
     and that is fine, because nothing hinges on the exact value. */
  const roomCap = Number(show.roomCap) > 0 ? Number(show.roomCap) : null;
  const live = show.status === 'live';
  const heads = live ? countInRoom(fans, show) : 0;
  const counts = voteCounts(fans);
  const firstAt = firstVotedAt(fans);

  const shape = (s) => ({
    id: s.id, title: s.title, artist: s.artist || '',
    votes: counts[s.id] || 0,
    cost: costOf(s.id, show),
    firstAt: firstAt[s.id] || null,
    tags: s.tags || [],
    // the KEY and the artist's CHART are never in a public payload
  });
  /* The same song with the night taken off it. A separate function rather than a
     flag inside `shape`, because every one of these fields is a fact about a show
     that is not happening, and zeroing them in one place is what makes that legible.
     `cost` is 1 because nothing has been played yet — pricing a replay off the last
     night's played[] would quote 5 for a song the room can have for 1. */
  const blank = (s) => ({
    id: s.id, title: s.title, artist: s.artist || '',
    votes: 0, cost: 1, firstAt: null, tags: s.tags || [],
  });

  /* BETWEEN SHOWS, THE ROOM IS DARK.

     A fan who opens the page when no show is running was seeing the LAST one: its
     votes, its running order, the songs it had already played missing from the list,
     and "Playing now" pointing at whatever ended the night. All of it true of a night
     that is over, and all of it wrong for the person holding the phone. Perry, 2026-09-07.

     What they get instead is the setlist, whole and quiet — every song back in the
     list (nothing has been played in a show that has not started), no votes on it,
     and nothing claiming to be playing. Nothing is DELETED to do this: the show
     record is untouched, so "Resume it instead" still finds the night exactly as the
     artist left it. This is display, and only display. */
  const dark = !live;

  // songs still to play — narrowed to tonight's setlist, if one is chosen
  const { songs: pool } = playable(show);
  const songsRaw = pool
    .filter((s) => dark || (s.id !== show.nowPlaying && !show.played.includes(s.id)))
    .map(dark ? blank : shape);
  const orderedAll = rankSongs(songsRaw, counts, firstAt);
  /* THE SHORT BOARD, AND THE TAIL THAT MAKES IT SAFE.

     Past a few hundred phones the response carries the top of the chart instead of
     all of it. What must survive the cut regardless of position is ANYTHING THIS FAN
     VOTED FOR (INVARIANT 0el) — a person who casts a vote and then cannot find their
     song has been given every reason to believe MySet lost it. A shared board cannot
     know who is reading it, so instead of appending each phone's songs it carries a
     TAIL: [id, votes, firstAt] for every song below the cut that holds a vote at all.
     A song somebody voted for holds at least one vote, so their song is always in it,
     and the phone puts its own back on the board from the tail plus the titles the
     per-fan payload carries (`held`). Thirty to forty bytes a song with real ids, so a
     hundred voted songs cost under 4 KB — against the whole song shape it replaces. */
  const boardMax = boardLimitFor(heads);
  const songs = boardMax === null ? orderedAll : orderedAll.slice(0, boardMax);
  const tail = boardMax === null ? null
    : orderedAll.slice(boardMax).filter((s) => s.votes > 0).map((s) => [s.id, s.votes, s.firstAt]);

  /* Already played — still votable at the higher replay cost. A song that has been
     played stays votable even if it is not in tonight's list: the room heard it,
     asking for it again is fair, and taking it away mid-show is confusing.

     Filtered through votable() so this payload and vote.mjs cannot disagree: a song
     the artist has since HIDDEN drops off the list rather than sitting there
     answering "that one isn't on tonight's list" when somebody taps it. */
  const canVote = votable(show);
  const played = dark ? [] : show.played
    .map((id) => show.songs.find((s) => s.id === id))
    .filter((s) => s && canVote(s))
    .map(shape)
    .reverse();

  const np = dark ? null : (show.songs.find((s) => s.id === show.nowPlaying) || null);

  return {
    ok: true,
    src: MARK,                                 // provenance — see _canary.mjs
    /* WHEN THE ROOM WAS READ, server clock — taken before the reads began, see the
       note on `buildBoard`. A phone compares it with `lastAt` on its own payload to
       know whether the board it is holding is older than its own last vote — which,
       served from cache, it can be for a few seconds. */
    at,
    artistId: aid, artist: show.artist, artistFirst: show.artistFirst || '', venue: show.venue, city: show.city, showTime: show.showTime,
    status: show.status, windowOpen: !!show.windowOpen,
    /* WHEN THE NIGHT ENDED, server clock, only while it is ended. The voting page
       says "That's all — see you next time" for three hours after a show and then
       counts down to the next gig instead; without this it could only guess. A
       resumed show goes back to `live`, so a stale stamp is never sent. Absent
       (null) for shows ended before the stamp existed, which the page treats as
       "long ago". */
    endedAt: show.status === 'ended' ? (Number(show.endedAt) || null) : null,
    /* MILLISECONDS LEFT, not the moment it ends — see the `countdown` action in
       admin.mjs. Absent unless one is actually running. A cached copy is late by its
       age, and the page subtracts the `Age` header the edge sends with it. */
    countdownIn: (() => {
      const left = (show.countdownAt || 0) - Date.now();
      return (!dark && left > 0 && left <= COUNTDOWN_MS) ? left : 0;
    })(),
    showId: show.showId || '',                // so "say something about tonight" can name the night
    nowPlaying: np ? { id: np.id, title: np.title, artist: np.artist || '' } : null,
    songs, played, tail,
    replayCost: show.replayCost || 5,
    packs: show.packs,
    // what a phone that has never voted starts with — the page's fallback if /api/me is unreachable
    freeCredits: Math.max(0, show.freeCredits || 0),
    setlist: show.listId ? { name: show.listName } : null,
    /* Only the genres actually used by a song the room can see — a filter row of
       fifteen chips where twelve match nothing is worse than no filter row. */
    tags: (() => {
      const used = new Set();
      for (const s of pool) {
        for (const t of s.tags || []) used.add(t);
      }
      const labels = Object.fromEntries([...GENRES, ...show.tags.map((t) => [t.id, t.label])]);
      return [...used].filter((id) => labels[id]).map((id) => ({ id, label: labels[id] }))
        .sort((a, b) => a.label.localeCompare(b.label));
    })(),
    /* Only advertised when it is actually on, so the page never renders a button
       that leads to "sorry, not tonight". */
    asks: {
      song: show.requests.on ? { cost: show.requests.cost } : null,
      birthday: show.birthdays.on ? { cost: show.birthdays.cost } : null,
      vibe: { cost: 0, options: VIBE_OPTIONS },
    },
    /* THE THROTTLE DIAL, AND WHY IT IS SERVER-SIDE.

       The polling ladder used to live entirely in public/vote.html, which meant the
       only way to slow a room down was to ship a deploy that every phone in it had
       to reload to receive — i.e. no way at all, during the one event where it
       matters. Every large system that survives this hands the interval back with
       the data: YouTube live chat stamps `timeoutMs` on every response and its
       clients sleep exactly that long, at streams past eight million viewers.

       So the SERVER decides the floor now, from the real head count, and the page
       obeys it. One integer, and it is the difference between watching a room melt
       and turning it down mid-song. Since the split it is also how long the edge
       may keep this payload (board.mjs) — one interval, two while a copy is being
       replaced, against a ladder whose slowest rung is twenty.

       `board` is the same idea applied to bytes: past a few hundred phones the
       response carries the top of the chart rather than all of it, which is what
       YouTube's "Top chat" default is. It is labelled on the page — a fan who
       cannot see their song must never be left wondering whether the vote counted. */
    room: { cap: roomCap, in: heads, over: !!(roomCap && heads > roomCap) },
    nextPollMs: pollFloorFor(heads),
    board: boardMax,
    totalVotes: Object.values(counts).reduce((a, b) => a + b, 0),
    // INVARIANT 0ad: never show the room a button that leads to a shrug
    paymentsEnabled: canTakeMoney(aid, show),
    flags,
    updatedAt: show.updatedAt,
  };
}

/** What is true of ONE phone and nobody else. Reads nothing: the caller hands it
 *  the fan's own record, which came out of one shard. */
export function buildMe({ show, fanId, me, myAsks }) {
  const rec = me || { v: [], extra: 0 };
  const mine = rec.v || [];
  const total = show.freeCredits + (rec.extra || 0);
  const used = creditsUsed(rec, show);
  const freeUsed = typeof rec.freeUsed === 'number'
    ? rec.freeUsed : Math.min(show.freeCredits || 0, used);
  const unl = isUnlimited(fanId, show);
  const dark = show.status !== 'live';
  /* How many of THIS fan's votes sit on each song. Between shows the board is blank
     (see buildBoard), so this is blank too — the record is untouched, only the display. */
  const votes = {};
  if (!dark) for (const id of mine) votes[id] = (votes[id] || 0) + 1;
  /* The songs this fan holds votes on, shaped WITHOUT a tally — the board owns the
     tally. This is what lets a phone put its own song back on a shortened board:
     the title comes from here, the count from the board's tail. */
  const held = Object.keys(votes)
    .map((id) => show.songs.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => ({ id: s.id, title: s.title, artist: s.artist || '', cost: costOf(s.id, show), tags: s.tags || [] }));
  return {
    ok: true,
    src: MARK,
    at: Date.now(),
    showId: show.showId || '',
    // when this phone last cast, server clock — stamped by vote.mjs
    lastAt: Number(rec.lastAt) || 0,
    votes, held,
    myAsks: myAsks || [],
    credits: {
      unlimited: unl,
      remaining: unl ? null : Math.max(0, total - used), total: unl ? null : total, used, extra: rec.extra || 0,
      freeRemaining: unl ? null : Math.max(0, (show.freeCredits || 0) - freeUsed),
      freeTotal: unl ? null : Math.max(0, show.freeCredits || 0),
      // the fan id matters: without it an UNLIMITED device's pack reads as spent
      paidLeft: unspentPaid(rec, show, fanId),
      decided: rec.decided === show.showId,       // already chose what happens to them
    },
  };
}

/* THE OLD SHAPE, FROM THE TWO NEW HALVES. This is what /api/show answers and what
   public/vote.html rebuilds on the phone from /api/board + /api/me, so it is written
   once here and copied once there (`mergeBoard` in vote.html), and test/split.mjs
   holds the copy to this original. If you change one, change both, and the test
   will tell you if you did not. */
export function mergeForOne(board, personal) {
  /* A personal state from a different night is no state at all: the phone may be
     holding one from before the artist started a new show while its personal call
     was unreachable, and the song ids are the same on both nights. */
  if (personal && personal.showId && board.showId && personal.showId !== board.showId) personal = null;
  const cnt = (personal && personal.votes) || {};
  const own = (s) => {
    const n = cnt[s.id] || 0;
    return { ...s, mine: n > 0, mineCount: n };
  };
  const songs = (board.songs || []).map(own);
  /* ANYTHING THIS FAN VOTED FOR comes back onto a shortened board regardless of
     rank (INVARIANT 0el): the tally from the tail, the title from `held`. */
  const shown = new Set(songs.map((s) => s.id));
  const held = Object.fromEntries(((personal && personal.held) || []).map((h) => [h.id, h]));
  for (const [id, votes, firstAt] of board.tail || []) {
    if (!(cnt[id] > 0) || shown.has(id) || !held[id]) continue;
    songs.push(own({ ...held[id], votes, firstAt: firstAt || null }));
    shown.add(id);
  }
  const { tail, ...rest } = board;
  return {
    ...rest,
    songs,
    played: (board.played || []).map(own),
    myAsks: (personal && personal.myAsks) || [],
    credits: (personal && personal.credits) || freshCredits(board),
  };
}

/** What a phone that has never voted is owed — and what the page shows if it can
 *  reach the board but not its own record: the honest "nothing spent yet" state,
 *  never a lie about a purchase. A tap still goes to the server, which is the truth. */
export function freshCredits(board) {
  const free = Math.max(0, Number(board && board.freeCredits) || 0);
  return { unlimited: false, remaining: free, total: free, used: 0, extra: 0,
           freeRemaining: free, freeTotal: free, paidLeft: 0, decided: false };
}
