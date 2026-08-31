import { json, bad } from './_lib.mjs';
import { venueBySlug, venueById, getVenueProfile, shapeVenue, sameVenue } from './_venues.mjs';
import { readEvents, occurrencesFor, readCityIndex } from './_events.mjs';
import { localDate, addDays } from './_time.mjs';
import { artistById } from './_auth.mjs';

/* Public. A venue page, and who is playing there.

   Nothing is stored linking a gig to a venue. The artist typed the venue's name
   into their own calendar, and this matches on that name within the venue's own
   city. That means a venue signing up today already has its whole diary — no
   backfill, no job, and nothing for an artist to re-enter. It also means the
   listings are the ARTIST's claim, which the page says out loud. */

const HORIZON = 60;              // days ahead
const MAX_ARTISTS = 60;          // per city, per page view

export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get('v') || '';
  if (!slug) return bad('which venue?', 400);

  const vid = await venueBySlug(slug);
  if (!vid) return bad('unknown venue', 404);
  const [reg, prof] = await Promise.all([venueById(vid), getVenueProfile(vid)]);
  const venue = shapeVenue(prof, reg);

  const gigs = await gigsAt(venue);
  const acts = [];
  for (const g of gigs) {
    if (!acts.some((a) => a.slug === g.slug)) acts.push({ name: g.artist, slug: g.slug });
  }

  return json({ ok: true, venue, gigs, artists: acts.slice(0, 24),
                truncated: gigs.length >= 200 });
};

async function gigsAt(venue) {
  if (!venue.country || !venue.city || !venue.name) return [];
  const idx = await readCityIndex();
  const ids = (((idx.countries || {})[venue.country] || {})[venue.city] || []).slice(0, MAX_ARTISTS);
  const now = Date.now();
  const rows = [];

  for (const aid of ids) {
    const [events, who] = await Promise.all([readEvents(aid), artistById(aid)]);
    if (!who) continue;
    const tz = ((events.list || []).find((x) => x.tz) || {}).tz || 'UTC';
    const from = localDate(now, tz);
    for (const o of occurrencesFor(events, addDays(from, -1), addDays(from, HORIZON))) {
      if (o.endsAt <= now) continue;
      if (o.city !== venue.city || o.country !== venue.country) continue;
      if (!sameVenue(o.venue, venue.name)) continue;
      rows.push({
        date: o.date, time: o.time, endTime: o.endTime, tz: o.tz,
        startsAt: o.startsAt, endsAt: o.endsAt,
        artist: who.name, slug: who.slug,
        listedAs: o.venue, note: o.note, ticketUrl: o.ticketUrl,
        repeating: o.repeating,
        live: now >= o.startsAt && now < o.endsAt,
      });
    }
  }
  return rows.sort((a, b) => a.startsAt - b.startsAt).slice(0, 200);
}
