import { guard } from './_errlog.mjs';
import { getShow, publicArtist, json, jsonCached, bad } from './_lib.mjs';
import { songList } from './_board.mjs';
import { MARK } from './_canary.mjs';

/* EVERY SONG THE ROOM CAN VOTE FOR — /api/fan?what=songs&a=<slug>&v=<version>

   The song list a vote page fetches once when it opens, and again only when the
   board's `songsV` says the list has changed (decision 0150, INVARIANT 0hx). The
   board then needs to carry only the tallies (`lean=1`), and past 3,000 phones a fan
   can still find and vote for a song nobody has voted for yet — the short board was
   all the page could list or search.

   One read: the show record. The artist's name is the board's business.

   THREE ANSWERS, BY WHAT WAS ASKED FOR. The address is the whole cache key (9d6), so
   what is kept under it must be exactly what it names:
     · `v` is the list's current version: kept at the edge for a day. The version is a
       hash of the list itself, so nothing else can ever be served under it.
     · no `v`: the current list, kept for the shortest shared time (10 s) — what a page
       asks for on open, alongside its first board, before it knows the version.
     · any other `v` (a phone holding an older board): the current list, kept nowhere.
       Caching it under the old version would hand it to the next phone asking for the
       old one, and, if the artist puts the list back as it was, under the version it
       no longer is.
   Every answer carries its own `v`, which is the truth about what is in it. */
const DAY = 86400;
const main = async (req) => {
  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  const want = String(new URL(req.url).searchParams.get('v') || '').slice(0, 40);
  const list = songList(await getShow(aid, { withName: false }));
  const body = { ok: true, src: MARK, ...list };
  if (!want) return jsonCached(body, 10);
  return want === list.v ? jsonCached(body, DAY) : json(body);
};
export default guard('songs', main);
