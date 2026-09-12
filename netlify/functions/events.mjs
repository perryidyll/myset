import { json, bad, jsonCached, publicArtist } from './_lib.mjs';
import { readEvents, occurrencesFor, readCityIndex, isVenueOwner, venueIdOf } from './_events.mjs';
import { readRsvp, rsvpCounts, occKey, HORIZON_DAYS } from './_rsvp.mjs';
import { localDate, addDays, tzOffsetMs } from './_time.mjs';
import { artistById } from './_auth.mjs';
import { venueById } from './_venues.mjs';
import { MARK } from './_canary.mjs';

const WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 28;   // `days=` on the city feed may widen the window this far

/* Public. Three shapes:
     ?places=1                 the country/city picker, with live counts
     ?country=&city=[&days=]   what's on there over the next 7 days (up to 28 with days=)
     ?a=<slug>                 one artist's upcoming gigs
   Every gig or event row carries `rsvp`, how many said they are coming (0 when
   nobody has) — read from the owner's one rsvp document in the same hop as their
   events, never a read per row (_rsvp.mjs).
*/
export default async (req) => {
  const url = new URL(req.url);

  /* ---- the picker ---- */
  if (url.searchParams.get('places')) {
    const idx = await readCityIndex();
    const countries = [];
    for (const [country, cities] of Object.entries(idx.countries || {})) {
      const list = [];
      for (const [city, ids] of Object.entries(cities)) {
        const n = await countUpcoming(ids);
        // never send someone to a city with nothing on — but keep it listed,
        // with the count, so the emptiness is visible before they commit
        list.push({ city, gigs: n,
                    artists: ids.filter((x) => !isVenueOwner(x)).length,
                    venues: ids.filter(isVenueOwner).length });
      }
      list.sort((a, b) => b.gigs - a.gigs || a.city.localeCompare(b.city));
      countries.push({ country, cities: list, gigs: list.reduce((s, c) => s + c.gigs, 0) });
    }
    countries.sort((a, b) => b.gigs - a.gigs || a.country.localeCompare(b.country));
    return jsonCached({ ok: true, src: MARK, countries }, 60);   // the front door's picker, one run a minute
  }

  /* ---- one artist's diary ---- */
  /* `?a=` present but EMPTY is the founding page, exactly as publicArtist reads
     it — the bare /vote.html has no slug in its path and still needs the diary
     for its between-shows countdown (decision 0039). Absent means the city feed. */
  const slug = url.searchParams.get('a');
  if (slug !== null) {
    const aid = await publicArtist(req);
    if (!aid) return bad('unknown artist', 404);
    // the cap is HORIZON_DAYS so an RSVP is never taken on a night the diary cannot show
    const days = Math.max(1, Math.min(HORIZON_DAYS, parseInt(url.searchParams.get('days'), 10) || 60));
    /* `n` is how many nights the caller will actually draw. The artist page shows
       24 and the vote page wants only the next one; a weekly residency over 90
       days is 60 rows at ~750 bytes each, 44KB on bar Wi-Fi for three visible rows. */
    const n = Math.max(1, Math.min(60, parseInt(url.searchParams.get('n'), 10) || 60));
    // the diary and its RSVP counts together: one hop, not two
    const [events, rs] = await Promise.all([readEvents(aid), readRsvp(aid)]);
    const counts = rsvpCounts(rs);
    const tz = guessTz(events);
    const from = localDate(Date.now(), tz);
    const occ = occurrencesFor(events, addDays(from, -1), addDays(from, days))
      .filter((o) => o.endsAt > Date.now())
      .slice(0, n);
    // thirty seconds at the edge — a diary changes by the week, `live` flips by the hour
    return jsonCached({ ok: true, src: MARK, artistId: aid, gigs: occ.map((o) => shape(o, counts)) }, 30);
  }

  /* ---- a city feed ---- */
  const country = (url.searchParams.get('country') || '').slice(0, 60);
  const city = (url.searchParams.get('city') || '').slice(0, 60);
  if (!country || !city) return bad('pick a country and a city');

  /* `days=` widens the window a week at a time for the front door's "View next
     week's events" — never narrower than the seven the feed always carried, never
     past four weeks (28: the calendar's own listing horizon is a month, and every
     extra shape is one more edge-cached copy per city). The page offers the button
     only when `window` comes back in the reply, so a server without this line
     shows no button rather than a button that leads to a shrug. */
  const days = Math.max(WINDOW_DAYS, Math.min(MAX_WINDOW_DAYS,
    parseInt(url.searchParams.get('days'), 10) || WINDOW_DAYS));

  const idx = await readCityIndex();
  const ids = ((idx.countries || {})[country] || {})[city] || [];
  const now = Date.now();

  /* Two kinds of thing are on tonight: a gig an ARTIST listed, and an event the
     VENUE itself listed (quiz night, a DJ, the football). Both come out of the
     same recurrence engine and go into the same feed, tagged so the page can
     tell them apart. Each owner is one parallel hop: their events, who they are,
     and their RSVP counts. */
  const rows = [];
  for (const id of ids) {
    const venueOwned = isVenueOwner(id);
    const [events, who, rs] = await Promise.all([
      readEvents(id),
      venueOwned ? venueById(venueIdOf(id)) : artistById(id),
      readRsvp(id),
    ]);
    if (!who) continue;
    const counts = rsvpCounts(rs);
    const tz = guessTz(events);
    const from = localDate(now, tz);
    for (const o of occurrencesFor(events, addDays(from, -1), addDays(from, days))) {
      if (o.city !== city || o.country !== country) continue;
      if (o.endsAt <= now) continue;                       // finished
      rows.push(venueOwned
        ? { ...shape(o, counts), kind: 'event', title: o.title || 'Event',
            artist: '', slug: '', venueSlug: who.slug || '', href: `/v/${who.slug || ''}`, _owner: id }
        : { ...shape(o, counts), kind: 'gig', artist: who.name, slug: who.slug,
            href: `/${who.slug || ''}`, _owner: id });
    }
  }
  rows.sort((a, b) => a.startsAt - b.startsAt);

  /* Group by the LOCAL day of the gig, not the viewer's day. A 10pm set that
     runs to 2am belongs to the night it started — and is still listed as on. */
  const tz0 = rows[0] ? rows[0].tz : 'UTC';
  const today = localDate(now, tz0);
  const byDay = [];
  for (const r of rows) {
    const d = byDay.find((x) => x.date === r.date);
    if (d) d.gigs.push(r);
    else byDay.push({ date: r.date, label: dayLabel(r.date, today), gigs: [r] });
  }
  /* FEATURED SHOWS — up to three paid spots at the top of each night.

     One extra blob read for the whole city feed (this is not the audience poll),
     and only when the flag is on. A featured row is MOVED out of `gigs` rather than
     copied, so nobody appears twice; a spot whose gig has since been cancelled
     simply finds nothing and is skipped, which is why the Promote sheet warns that
     cancelling spends the spot. */
  /* READ GLOBALLY, and so is the selling side (handleFeature). A per-artist
     override here would be meaningless — this feed is one city's list, not one
     artist's page — and if the two sides could disagree, an artist with a personal
     override could be sold a $10 spot that no city would ever draw. */
  let featuredOn = false;
  try {
    const { readFlags, flagValue } = await import('./_flags.mjs');
    featuredOn = flagValue(await readFlags(), 'featuredShows', '');
  } catch { featuredOn = false; }
  if (featuredOn) {
    const { cityKey, featuredFor } = await import('./_featured.mjs');
    const picked = await featuredFor(cityKey(country, city), today).catch(() => ({}));
    for (const d of byDay) {
      const want = picked[d.date] || [];
      if (!want.length) continue;
      const out = [];
      for (const w of want) {
        /* MATCHED ON THE OWNER AS WELL AS THE GIG ID, and that is not a detail.
           Event ids are chosen by the client (`eventSave` takes `event.id` from the
           body) and every gig's id is public in this very feed — so matching on the
           id alone let ANY artist in the city put a gig with somebody else's event
           id on their calendar and be rendered in the spot that artist had paid $10
           for. Found by an adversarial review, not by a user. */
        const i = d.gigs.findIndex((g) => g.eventId === w.eventId && g._owner === w.aid && g.date === d.date);
        if (i < 0) continue;                       // the gig has gone; the spot is spent
        out.push({ ...d.gigs[i], featured: true });
        d.gigs.splice(i, 1);
      }
      if (out.length) d.featured = out;
    }
  }

  byDay.forEach((d) => { d.count = d.gigs.length + ((d.featured || []).length); });
  /* `_owner` was only ever for matching a paid spot to the artist who bought it.
     It does not go out: the public feed names artists by slug, and an internal id
     in a payload is a thing somebody will eventually depend on by accident. */
  for (const d of byDay) for (const g of [...d.gigs, ...(d.featured || [])]) delete g._owner;

  // the city feed is the same for every phone in town: one run a minute at the edge
  return jsonCached({
    ok: true, country, city,
    today, horizon: addDays(today, days), window: days,
    total: rows.length,
    artists: ids.filter((x) => !isVenueOwner(x)).length,
    venues: ids.filter(isVenueOwner).length,
    days: byDay,
  });
};

const shape = (o, counts = {}) => ({
  eventId: o.eventId, date: o.date, time: o.time, endTime: o.endTime, tz: o.tz,
  startsAt: o.startsAt, endsAt: o.endsAt,
  venue: o.venue, city: o.city, country: o.country,
  address: o.address || '', maps: o.maps || null,
  note: o.note, ticketUrl: o.ticketUrl, repeating: o.repeating,
  live: Date.now() >= o.startsAt && Date.now() < o.endsAt,
  rsvp: counts[occKey(o.eventId, o.date)] || 0,     // how many said they are coming
});

/** Everything an artist has is usually in one zone; use the soonest gig's. */
function guessTz(events) {
  const e = (events.list || []).find((x) => x.tz);
  return e ? e.tz : 'UTC';
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayLabel(date, today) {
  if (date === today) return 'Tonight';
  if (date === addDays(today, 1)) return 'Tomorrow';
  const [Y, M, D] = date.split('-').map(Number);
  return WEEKDAY[new Date(Date.UTC(Y, M - 1, D)).getUTCDay()];
}

/** How many gigs these artists have in the window — for the picker's counts. */
async function countUpcoming(ids) {
  let n = 0;
  const now = Date.now();
  for (const aid of ids.slice(0, 40)) {
    const events = await readEvents(aid);
    const tz = guessTz(events);
    const from = localDate(now, tz);
    n += occurrencesFor(events, addDays(from, -1), addDays(from, WINDOW_DAYS))
      .filter((o) => o.endsAt > now).length;
  }
  return n;
}
