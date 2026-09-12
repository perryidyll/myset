import { json, bad, jsonCached } from './_lib.mjs';
import { venueBySlug, venueById, getVenueProfile, shapeVenue, sameVenue } from './_venues.mjs';
import { readEvents, occurrencesFor, readCityIndex } from './_events.mjs';
import { localDate, addDays } from './_time.mjs';
import { artistById } from './_auth.mjs';
import { readVouches, MIN_VOUCHES } from './_verify.mjs';
import { MARK } from './_canary.mjs';

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

  const [gigs, own, vouches] = await Promise.all([
    gigsAt(venue), ownEvents(vid, venue), readVouches(vid),
  ]);

  const acts = [];
  for (const g of gigs) {
    if (g.slug && !acts.some((a) => a.slug === g.slug)) acts.push({ name: g.artist, slug: g.slug });
  }

  // both kinds of thing on, in one time order
  const whatsOn = [...gigs, ...own].sort((a, b) => a.startsAt - b.startsAt).slice(0, 200);
  const names = Object.values(vouches.by || {}).map((x) => x.name).filter(Boolean);

  return jsonCached({ ok: true, src: MARK, venue,   // public, shared by every phone: 30s at the edge
                gigs: whatsOn, artists: acts.slice(0, 24),
                vouches: { count: names.length, need: MIN_VOUCHES, names: names.slice(0, 12) },
                truncated: whatsOn.length >= 200 }, 30);
};

/** The venue's own listings — a quiz night, a DJ, the football. Same engine. */
async function ownEvents(vid, venue) {
  const events = await readEvents(`v_${vid}`);
  if (!(events.list || []).length) return [];
  const tz = ((events.list || []).find((x) => x.tz) || {}).tz || 'UTC';
  const now = Date.now();
  const from = localDate(now, tz);
  return occurrencesFor(events, addDays(from, -1), addDays(from, HORIZON))
    .filter((o) => o.endsAt > now)
    .map((o) => ({
      kind: 'event',
      date: o.date, time: o.time, endTime: o.endTime, tz: o.tz,
      startsAt: o.startsAt, endsAt: o.endsAt,
      title: o.title || 'Event',
      artist: '', slug: '',
      note: o.note, ticketUrl: o.ticketUrl, repeating: o.repeating,
      live: now >= o.startsAt && now < o.endsAt,
    }))
    .slice(0, 120);
}

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
        kind: 'gig',
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
