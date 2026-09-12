import { guard } from './_errlog.mjs';
import { json, bad, cleanFanId, publicArtist } from './_lib.mjs';
import { readEvents, occurrencesFor } from './_events.mjs';
import { venueBySlug } from './_venues.mjs';
import { toggleRsvp, HORIZON_DAYS } from './_rsvp.mjs';
import { localDate, addDays } from './_time.mjs';

/* Public, like /api/vote — the audience never signs in (INVARIANT 9g), so this is
   anonymous by design. A device id, a night, and on or off; the reply is that
   fan's state and the night's count. Personal, so never cached (json, not
   jsonCached). What the count is and is not: _rsvp.mjs.

     POST /api/rsvp?a=<slug>   an artist's gig  (`a=` empty is the founding page,
                                                exactly as publicArtist reads it)
     POST /api/rsvp?v=<slug>   an event the venue itself listed
     { fan, eventId, date, on }  ->  { ok, on, n } */
const main = async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('invalid'); }
  if (!body || typeof body !== 'object') return bad('invalid');

  const fan = cleanFanId(body.fan);
  if (fan.length < 6) return bad('missing fan');
  const eventId = typeof body.eventId === 'string' && body.eventId.length <= 80 ? body.eventId : '';
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : '';
  if (!eventId || !date || typeof body.on !== 'boolean') return bad('invalid');

  /* Whose night. The venue owner id is the `v_<venueId>` the events index already
     uses (isVenueOwner in _events.mjs), so a venue's counts live next to its events. */
  const url = new URL(req.url);
  let ownerId = null;
  if (url.searchParams.get('a') !== null) ownerId = await publicArtist(req);
  else if (url.searchParams.get('v') !== null) {
    const vid = await venueBySlug(url.searchParams.get('v') || '');
    ownerId = vid ? `v_${vid}` : null;
  } else return bad('whose show?');
  if (!ownerId) return bad('unknown artist', 404);

  /* The night must be one THIS owner actually has, not over, and no further ahead
     than the diary will ever show — a count on a gig that never existed is a
     number somebody would eventually depend on, and a repeating rule would
     otherwise answer for any Tuesday in 2034 (no page offers it; the document
     would grow a night per POST). */
  const events = await readEvents(ownerId);
  const occ = occurrencesFor(events, date, date)
    .find((o) => o.eventId === eventId && o.date === date && o.endsAt > Date.now());
  if (!occ || date > addDays(localDate(Date.now(), occ.tz), HORIZON_DAYS)) return bad('no such show', 404);

  const r = await toggleRsvp(ownerId, occ, fan, body.on);
  return json({ ok: true, on: r.on, n: r.n });
};
export default guard('rsvp', main);
