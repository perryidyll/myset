import { COUNTDOWN_MS, getShow, readFans, voteCounts, firstVotedAt, rankSongs, creditsUsed, costOf, unspentPaid,
         isUnlimited, publicArtist, json, bad, cleanFanId, markPresence, countInRoom,
         pollFloorFor, boardLimitFor,
         GENRES, playable, votable, roomHash, clientIp } from './_lib.mjs';
import { MARK } from './_canary.mjs';
import { canTakeMoney } from './_pay.mjs';
import { readRequests, myRequests } from './_requests.mjs';
import { readFlags, flagsFor } from './_flags.mjs';

export default async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const url = new URL(req.url);
  const fanId = cleanFanId(url.searchParams.get('fan'));
  /* `in=1` means "this is a phone in the room", which is only ever sent by the
     voting page. Profile views and the artist's own previews poll this endpoint
     too, and counting them would inflate the head-count with people who were
     never there. */
  const inRoom = url.searchParams.get('in') === '1';
  const [show, fans, flagDoc] = await Promise.all([getShow(aid), readFans(aid), readFlags()]);
  const flags = flagsFor(flagDoc, aid);
  /* Don't call markPresence when the stamp is already there. It goes mutateFan ->
     casDoc -> readDoc of the SAME shard `readFans` merged microseconds earlier in
     this very invocation, then returns false and writes nothing — so the answer is
     already in `fans`. This is the same test markPresence applies internally; the
     point is to reach it without paying for the read.

     MEASURED from inside a live function on this account: one strong blob read is
     42ms, and a whole poll bills ~155ms. So this removes ~27% of the billed duration
     of ~99.9% of all polls, which is the largest saving per line of code in the app.
     Presence is best-effort by design (INVARIANT 0af) so a miss is harmless. */
  /* HOW BIG THE ROOM IS TONIGHT — and NOBODY IS EVER TURNED AWAY.

     A plan's `audience` number is a BILLING line, not a turnstile. Going over it
     does not close the door, refuse a vote, or interrupt anybody: the room slows
     down, the board shortens, and the artist is told afterwards. That is the
     market's own answer — Mentimeter publishes it as policy, and it is the humane
     one as well as the cheap one. A single oversized night costs cents; a fan
     locked out mid-song in front of the artist costs the artist.

     The count is free: the bag was read a line ago. It is not atomic either — a
     burst of arrivals inside one polling interval all read the same number — and
     that is fine, because nothing hinges on the exact value. */
  const roomCap = Number(show.roomCap) > 0 ? Number(show.roomCap) : null;
  const live = show.status === 'live';
  const heads = live ? countInRoom(fans, show) : 0;

  if (inRoom && fanId) {
    const me0 = fans[fanId];
    const already = me0 && me0.seenShow === show.showId
      && me0.ipH === roomHash(aid, clientIp(req));
    if (!already) await markPresence(aid, fanId, show, req);
  }
  const counts = voteCounts(fans);
  const firstAt = firstVotedAt(fans);
  const me = fans[fanId] || { v: [], extra: 0 };
  const mine = me.v || [];
  const total = show.freeCredits + (me.extra || 0);
  const used = creditsUsed(me, show);
  const unl = isUnlimited(fanId, show);

  const shape = (s) => ({
    id: s.id, title: s.title, artist: s.artist || '',
    votes: counts[s.id] || 0, mine: mine.includes(s.id),
    // how many of THIS fan's votes sit on it — `mine` stays for older clients
    mineCount: mine.filter((x) => x === s.id).length,
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
    votes: 0, mine: false, mineCount: 0, cost: 1, firstAt: null, tags: s.tags || [],
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
  const dark = show.status !== 'live';

  // songs still to play — narrowed to tonight's setlist, if one is chosen
  const { songs: pool, fellBack } = playable(show);
  const songsRaw = pool
    .filter((s) => dark || (s.id !== show.nowPlaying && !show.played.includes(s.id)))
    .map(dark ? blank : shape);
  const orderedAll = rankSongs(songsRaw, counts, firstAt);
  /* THE SHORT BOARD, AND THE ONE THING IT MUST NEVER DROP.

     Past a few hundred phones the response carries the top of the chart instead of
     all of it. What survives the cut regardless of position is ANYTHING THIS FAN
     VOTED FOR — a person who casts a vote and then cannot find their song has been
     given every reason to believe MySet lost it. Their own song stays on their own
     board even when it is 90th. */
  const boardMax = boardLimitFor(heads);
  const ordered = boardMax === null ? orderedAll : (() => {
    const top = orderedAll.slice(0, boardMax);
    const shown = new Set(top.map((s) => s.id));
    return top.concat(orderedAll.filter((s) => s.mineCount > 0 && !shown.has(s.id)));
  })();

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

  /* One extra blob read, and only when there is something to read. This endpoint
     is polled by every phone in the room, so nothing goes on it unconditionally. */
  const asking = show.requests.on || show.birthdays.on;
  const myAsks = asking && fanId
    ? myRequests(await readRequests(aid), fanId, show) : [];

  return json({
    ok: true,
    src: MARK,                                 // provenance — see _canary.mjs
    artistId: aid, artist: show.artist, venue: show.venue, city: show.city, showTime: show.showTime,
    status: show.status, windowOpen: !!show.windowOpen,
    /* MILLISECONDS LEFT, not the moment it ends — see the `countdown` action in
       admin.mjs. Absent unless one is actually running. */
    countdownIn: (() => {
      const left = (show.countdownAt || 0) - Date.now();
      return (!dark && left > 0 && left <= COUNTDOWN_MS) ? left : 0;
    })(),
    showId: show.showId || '',                // so "say something about tonight" can name the night
    nowPlaying: np ? { id: np.id, title: np.title, artist: np.artist || '' } : null,
    songs: ordered, played,
    replayCost: show.replayCost || 5,
    packs: show.packs,
    /* Only the genres actually used by a song the room can see — a filter row of
       fifteen chips where twelve match nothing is worse than no filter row. */
    setlist: show.listId ? { name: show.listName } : null,
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
    },
    myAsks,
    credits: {
      unlimited: unl,
      remaining: unl ? null : Math.max(0, total - used), total: unl ? null : total, used, extra: me.extra || 0,
      // the fan id matters: without it an UNLIMITED device's pack reads as spent
    paidLeft: unspentPaid(me, show, fanId),
      decided: me.decided === show.showId,       // already chose what happens to them
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
       and turning it down mid-song.

       `board` is the same idea applied to bytes: past a few hundred phones the
       response carries the top of the chart rather than all of it, which is what
       YouTube's "Top chat" default is. It is labelled on the page — a fan who
       cannot see their song must never be left wondering whether the vote counted. */
    room: { cap: roomCap, in: heads, over: !!(roomCap && heads > roomCap) },
    nextPollMs: pollFloorFor(heads),
    board: boardLimitFor(heads),
    totalVotes: Object.values(counts).reduce((a, b) => a + b, 0),
    // INVARIANT 0ad: never show the room a button that leads to a shrug
    paymentsEnabled: canTakeMoney(aid, show),
    flags,
    updatedAt: show.updatedAt,
  });
};
