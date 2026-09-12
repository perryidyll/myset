import { guard } from './_errlog.mjs';
import { getShow, readFans, readMeta, voteCounts, paidVoteCounts, firstVotedAt, rankSongs, json, bad,
         requireArtist, roomCounts, GENRES, playable, votable , STORE_NAME } from './_lib.mjs';
import { readLists, readLearn, shapeLists } from './_lists.mjs';
import { canTakeMoney } from './_pay.mjs';
import { readRequests, shapeRequests } from './_requests.mjs';
import { readFeedback, shapeFeedback } from './_feedback.mjs';
import { readEvents, nextOccurrence } from './_events.mjs';
import { localTime } from './_time.mjs';

const main = async (req) => {
  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  return json(await stagePayload(me.aid));
};

/** Shared so a write can return the new state instead of forcing a second fetch. */
export async function stagePayload(aid) {
  const [show, fans, meta, reqs, lists, learn, fb, events] = await Promise.all([
    getShow(aid), readFans(aid), readMeta(aid), readRequests(aid),
    readLists(aid), readLearn(aid), readFeedback(aid), readEvents(aid).catch(() => ({ list: [] }))]);
  /* Tonight's gig, if there is one on the calendar within the next few hours or
     running now — ONE extra read on the Studio poll (21 of the 22 ceiling), so the
     Live tab can say when the show will start by itself (_auto.mjs). */
  let sched = null;
  try {
    const occ = nextOccurrence(events, Date.now());
    if (occ && occ.startsAt - Date.now() < 12 * 3600e3)
      sched = { startsAt: occ.startsAt, endsAt: occ.endsAt, venue: occ.venue || '',
                time: localTime(occ.startsAt, occ.tz), endTime: localTime(occ.endsAt, occ.tz) };
  } catch { sched = null; }
  const { artistById } = await import('./_auth.mjs');
  const who = await artistById(aid);
  /* An ended show keeps its board briefly so an accidental End can be resumed,
     but that recovery state is not a live setlist. Never expose its totals or
     refund affordances in the inactive Studio payload. A fresh show performs the
     durable carry/reset at the true night boundary. */
  const live = show.status === 'live';
  const counts = live ? voteCounts(fans) : {};
  const paidCounts = live ? paidVoteCounts(fans) : {};
  const firstAt = live ? firstVotedAt(fans) : {};
  const room = roomCounts(fans);
  const total = meta.tips.reduce((a, t) => a + (Number(t.amount) || 0), 0);

  return {
    ok: true,
    show: {
      artist: show.artist, venue: show.venue, city: show.city, showTime: show.showTime, status: show.status,
      windowOpen: !!show.windowOpen, nowPlaying: show.nowPlaying,
      played: show.played, freeCredits: show.freeCredits, replayCost: show.replayCost,
      packs: show.packs, showId: show.showId, startedAt: show.startedAt,
      artistId: aid, slug: (who && who.slug) || '',
      unlimited: !!show.unlimited, unlimitedFans: show.unlimitedFans || [],
      requests: show.requests, birthdays: show.birthdays,
      listId: show.listId, listName: show.listName,
      gigMonth: show.gigMonth, gigCount: show.gigCount,
      // who flipped it — 'artist' or 'schedule' — so the Live tab can say so
      startedBy: show.startedBy || null, endedBy: show.endedBy || null,
      sched, autoStart: show.autoStart !== false,
    },
    // the genre vocabulary, so the Setlist tab can render chips and filter by them
    tags: { builtin: GENRES.map(([id, label]) => ({ id, label })), own: show.tags },
    lists: shapeLists(lists, show),
    learn: learn.list,
    /* True when the chosen setlist has nothing votable left and the whole library
       is standing in for it. The artist has to be told — silently is worse. */
    listFellBack: playable(show).fellBack,
    voters: live ? Object.values(fans).filter((f) => (f.v || []).length).length : 0,
    // phones in the room tonight, not just phones that voted
    room: live ? room.phones : 0,
    nets: live ? room.nets : 0,
    asks: shapeRequests(reqs, show),
    songs: (() => {
      const on = new Set(playable(show).songs.map((x) => x.id));
      /* `votable` is the server's own answer to "could the room choose this right
         now", handed to the Studio so its queue and its "Start top voted" label
         cannot drift from playTop. See votable() in _lib.mjs. */
      const canVote = votable(show);
      return rankSongs(
        show.songs.map((x) => ({
          ...x, votes: counts[x.id] || 0, paidVotes: paidCounts[x.id] || 0,
          played: show.played.includes(x.id), now: show.nowPlaying === x.id,
          inSet: on.has(x.id),          // in tonight's setlist
          votable: canVote(x),          // in the setlist, or already played
        })), counts, firstAt);
    })(),
    tips: { total: Math.round(total * 100) / 100, count: meta.tips.length, recent: meta.tips.slice(-15).reverse() },
    feedback: shapeFeedback(fb),
    paymentsEnabled: canTakeMoney(aid, show),
    /* Why, if not. The artist should never have to guess where their money went. */
    payoutsNote: canTakeMoney(aid, show) ? null
      : (process.env.STRIPE_SECRET_KEY
          ? 'Card payments are off for your room until your payout account is connected — so nothing can land in the wrong place. We’ll tell you the moment it’s ready.'
          : 'Card payments aren’t switched on for MySet yet.'),
    /* Which blob store this deploy is reading. Artist-only, and only here so a
       preview's data isolation can be CHECKED from outside rather than trusted. */
    store: STORE_NAME,
  };
}
export default guard('stage', main);
