import { bad } from './_lib.mjs';
import profile from './profile.mjs';
import events from './events.mjs';
import board from './board.mjs';
import me from './me.mjs';
import community from './community.mjs';
import venue from './venue.mjs';

/* THE ONE WARM DOOR FOR EVERYTHING A FAN READS (decision 0049).

   Every function here is its own little program on Netlify, and each one falls
   asleep on its own after a few quiet minutes: measured 2026-09-12, the first
   call to a sleeping one costs ~1.5s more than a warm one (/api/me 2.06s cold,
   0.57s warm). A fan opening an artist page woke two of them; the vote page two
   more. Waking six programs on a schedule would be six pings; waking one is one.

   So the six public reads are bundled into THIS function and chosen by `what=`.
   The handlers are the same modules the old addresses still serve — nothing is
   duplicated, and the old addresses stay up for any page a phone cached before
   the switch. The pages ask for /api/fan?what=profile&a=…, ?what=board&a=…, and
   so on. Each handler keeps its own cache headers, so a shared read (profile,
   events, venue, board) is still kept at the edge under its own URL and a
   personal one (me, community) is still never kept (INVARIANT 9d6: the URL is
   the whole key, and `what=` is part of it).

   `what=warm` is the ping: autocron rings it every four minutes so the door is
   awake when the first fan of the evening arrives. It reads nothing and is
   never cached. */
const DOORS = { profile, events, board, me, community, venue };

export default async (req, ctx) => {
  const what = new URL(req.url).searchParams.get('what') || '';
  if (what === 'warm') {
    return new Response('warm', { status: 200, headers: {
      'cache-control': 'no-store', 'netlify-cdn-cache-control': 'no-store' } });
  }
  const door = DOORS[what];
  if (!door) return bad('unknown read', 404);
  return door(req, ctx);
};
