import { guard } from './_errlog.mjs';
import { json, bad, jsonCached } from './_lib.mjs';
import { venueBySlug, venueById, getVenueProfile, shapeVenue, sameVenue } from './_venues.mjs';
import { readEvents, occurrencesFor, readCityIndex } from './_events.mjs';
import { readRsvp, rsvpCounts, occKey } from './_rsvp.mjs';
import { localDate, addDays } from './_time.mjs';
import { artistById } from './_auth.mjs';
import { readVouches, MIN_VOUCHES } from './_verify.mjs';
import { MARK } from './_canary.mjs';
import { readGigOk, gigStatus, gigKey } from './_gigok.mjs';

/* Public. A venue page, and who is playing there.

   Nothing is stored linking a gig to a venue. The artist typed the venue's name
   into their own calendar, and this matches on that name within the venue's own
   city. That means a venue signing up today already has its whole gig list — no
   backfill, no job, and nothing for an artist to re-enter. It also means the
   listings are the ARTIST's claim, which the page says out loud — until the venue
   answers it (decision 0128): a show it confirmed says so, one it says is not at
   its place leaves this page. */

const HORIZON = 60;              // days ahead
const MAX_ARTISTS = 60;          // per city, per page view

const main = async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get('v') || '';
  if (!slug) return bad('which venue?', 400);

  const vid = await venueBySlug(slug);
  if (!vid) return bad('unknown venue', 404);
  return jsonCached(await venuePayload(vid), 30);   // public, shared by every phone: 30s at the edge
};

/* THE PAGE'S DATA, for a public venue page AND for a venue sample (decision 0101): a
   sample is not in the venue registry, so the private sample door hands its row in
   as `reg`. One shape, one page. */
export async function venuePayload(vid, { reg: given = null } = {}) {
  // the vouches need only the id, so they travel with the registry and profile reads
  const [reg, prof, vouches] = await Promise.all([given ? Promise.resolve(given) : venueById(vid), getVenueProfile(vid), readVouches(vid)]);
  const venue = shapeVenue(prof, reg);

  const [gigs, own] = await Promise.all([gigsAt(venue, vid), ownEvents(vid, venue)]);

  const acts = [];
  for (const g of gigs) {
    if (g.slug && !acts.some((a) => a.slug === g.slug)) acts.push({ name: g.artist, slug: g.slug });
  }

  // both kinds of thing on, in one time order
  const whatsOn = [...gigs, ...own].sort((a, b) => a.startsAt - b.startsAt).slice(0, 200);
  const names = Object.values(vouches.by || {}).map((x) => x.name).filter(Boolean);

  return { ok: true, src: MARK, venue,
                gigs: whatsOn, artists: acts.slice(0, 24),
                vouches: { count: names.length, need: MIN_VOUCHES, names: names.slice(0, 12) },
                truncated: whatsOn.length >= 200 };
}

/** The venue's own listings — a quiz night, a DJ, the football. Same engine. */
/* Every row carries `eventId` and `rsvp` (the count, never a fan), read in the
   same hop as the owner's events — the venue page offers the same RSVP the city
   feed does (decision 0056; the founder asked for it here on 2026-09-12), and a
   row without its id would be a button that leads to a shrug. */
async function ownEvents(vid, venue) {
  const [events, rs] = await Promise.all([readEvents(`v_${vid}`), readRsvp(`v_${vid}`)]);
  if (!(events.list || []).length) return [];
  const counts = rsvpCounts(rs);
  const tz = ((events.list || []).find((x) => x.tz) || {}).tz || 'UTC';
  const now = Date.now();
  const from = localDate(now, tz);
  return occurrencesFor(events, addDays(from, -1), addDays(from, HORIZON))
    .filter((o) => o.endsAt > now)
    .map((o) => ({
      kind: 'event', eventId: o.eventId, rsvp: counts[occKey(o.eventId, o.date)] || 0,
      date: o.date, time: o.time, endTime: o.endTime, tz: o.tz,
      startsAt: o.startsAt, endsAt: o.endsAt,
      title: o.title || 'Event',
      artist: '', slug: '',
      note: o.note, ticketUrl: o.ticketUrl, repeating: o.repeating,
      live: now >= o.startsAt && now < o.endsAt,
    }))
    .slice(0, 120);
}

/* Every artist gig rule that names this venue in its city, with each one's upcoming
   nights. Shared by the public page (gigsAt) and the Venue Studio's approvals
   (gigRules), so both see exactly the same shows. */
async function listings(venue, vid) {
  if (!venue.country || !venue.city || !venue.name) return [];
  const [idx, ok] = await Promise.all([readCityIndex(), readGigOk(vid)]);
  const ids = (((idx.countries || {})[venue.country] || {})[venue.city] || []).filter((x) => !String(x).startsWith('v_')).slice(0, MAX_ARTISTS);
  const now = Date.now();
  const out = [];
  for (const aid of ids) {
    const [events, who, rs] = await Promise.all([readEvents(aid), artistById(aid), readRsvp(aid)]);
    if (!who) continue;
    const tz = ((events.list || []).find((x) => x.tz) || {}).tz || 'UTC';
    const from = localDate(now, tz);
    const nights = occurrencesFor(events, addDays(from, -1), addDays(from, HORIZON))
      .filter((o) => o.endsAt > now && o.city === venue.city && o.country === venue.country && sameVenue(o.venue, venue.name));
    for (const e of events.list || []) {
      const mine = nights.filter((o) => o.eventId === e.id);
      if (!mine.length) continue;
      out.push({ aid, who, rule: e, nights: mine, rs, st: gigStatus(ok, aid, e.id, !!e.repeat) });
    }
  }
  return out;
}

async function gigsAt(venue, vid) {
  const now = Date.now();
  const rows = [];
  for (const L of await listings(venue, vid)) {
    if (L.st === 'no') continue;                         // the venue said it is not here
    const counts = rsvpCounts(L.rs);
    for (const o of L.nights) {
      rows.push({
        kind: 'gig', eventId: o.eventId, rsvp: counts[occKey(o.eventId, o.date)] || 0,
        date: o.date, time: o.time, endTime: o.endTime, tz: o.tz,
        startsAt: o.startsAt, endsAt: o.endsAt,
        artist: L.who.name, slug: L.who.slug,
        listedAs: o.venue, note: o.note, ticketUrl: o.ticketUrl,
        repeating: o.repeating, confirmed: L.st === 'ok',
        live: now >= o.startsAt && now < o.endsAt,
      });
    }
  }
  return rows.sort((a, b) => a.startsAt - b.startsAt).slice(0, 200);
}

/** The Venue Studio's list to approve: one row per artist RULE, never per night. */
export async function gigRules(vid) {
  const [reg, prof] = await Promise.all([venueById(vid), getVenueProfile(vid)]);
  const venue = shapeVenue(prof, reg);
  return (await listings(venue, vid)).map((L) => ({
    key: gigKey(L.aid, L.rule.id), artist: L.who.name, slug: L.who.slug, listedAs: L.rule.venue,
    next: L.nights[0].date, time: L.nights[0].time, endTime: L.nights[0].endTime || '',
    repeat: (L.rule.repeat && L.rule.repeat.freq) || '', nights: L.nights.length, st: L.st,
    startsAt: L.nights[0].startsAt,
  })).sort((a, b) => a.startsAt - b.startsAt);
}
/* guard(): a store that does not answer is a 503 "busy", never an empty page or a crash (decision 0142). */
export default guard('venue', main);
