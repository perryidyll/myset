import { getShow, readFans, voteCounts, firstVotedAt, rankSongs, creditsUsed, costOf, unspentPaid,
         isUnlimited, publicArtist, json, bad, cleanFanId, markPresence,
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

  // songs still to play — narrowed to tonight's setlist, if one is chosen
  const { songs: pool, fellBack } = playable(show);
  const songsRaw = pool
    .filter((s) => s.id !== show.nowPlaying && !show.played.includes(s.id))
    .map(shape);
  const ordered = rankSongs(songsRaw, counts, firstAt);

  /* Already played — still votable at the higher replay cost. A song that has been
     played stays votable even if it is not in tonight's list: the room heard it,
     asking for it again is fair, and taking it away mid-show is confusing.

     Filtered through votable() so this payload and vote.mjs cannot disagree: a song
     the artist has since HIDDEN drops off the list rather than sitting there
     answering "that one isn't on tonight's list" when somebody taps it. */
  const canVote = votable(show);
  const played = show.played
    .map((id) => show.songs.find((s) => s.id === id))
    .filter((s) => s && canVote(s))
    .map(shape)
    .reverse();

  const np = show.songs.find((s) => s.id === show.nowPlaying) || null;

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
    totalVotes: Object.values(counts).reduce((a, b) => a + b, 0),
    // INVARIANT 0ad: never show the room a button that leads to a shrug
    paymentsEnabled: canTakeMoney(aid, show),
    flags,
    updatedAt: show.updatedAt,
  });
};
