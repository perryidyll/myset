import { json, bad, publicArtist } from './_lib.mjs';
import { readEvents, occurrencesFor, readCityIndex } from './_events.mjs';
import { localDate, addDays, tzOffsetMs } from './_time.mjs';
import { artistById } from './_auth.mjs';

const WINDOW_DAYS = 7;

/* Public. Three shapes:
     ?places=1                 the country/city picker, with live counts
     ?country=&city=           what's on there over the next 7 days
     ?a=<slug>                 one artist's upcoming gigs
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
        list.push({ city, artists: ids.length, gigs: n });
      }
      list.sort((a, b) => b.gigs - a.gigs || a.city.localeCompare(b.city));
      countries.push({ country, cities: list, gigs: list.reduce((s, c) => s + c.gigs, 0) });
    }
    countries.sort((a, b) => b.gigs - a.gigs || a.country.localeCompare(b.country));
    return json({ ok: true, countries });
  }

  /* ---- one artist's diary ---- */
  const slug = url.searchParams.get('a');
  if (slug) {
    const aid = await publicArtist(req);
    if (!aid) return bad('unknown artist', 404);
    const days = Math.max(1, Math.min(120, parseInt(url.searchParams.get('days'), 10) || 60));
    const events = await readEvents(aid);
    const tz = guessTz(events);
    const from = localDate(Date.now(), tz);
    const occ = occurrencesFor(events, addDays(from, -1), addDays(from, days))
      .filter((o) => o.endsAt > Date.now())
      .slice(0, 60);
    return json({ ok: true, artistId: aid, gigs: occ.map(shape) });
  }

  /* ---- a city feed ---- */
  const country = (url.searchParams.get('country') || '').slice(0, 60);
  const city = (url.searchParams.get('city') || '').slice(0, 60);
  if (!country || !city) return bad('pick a country and a city');

  const idx = await readCityIndex();
  const ids = ((idx.countries || {})[country] || {})[city] || [];
  const now = Date.now();

  const rows = [];
  for (const aid of ids) {
    const [events, who] = await Promise.all([readEvents(aid), artistById(aid)]);
    if (!who) continue;
    const tz = guessTz(events);
    const from = localDate(now, tz);
    for (const o of occurrencesFor(events, addDays(from, -1), addDays(from, WINDOW_DAYS))) {
      if (o.city !== city || o.country !== country) continue;
      if (o.endsAt <= now) continue;                       // finished
      rows.push({ ...shape(o), artist: who.name, slug: who.slug });
    }
  }
  rows.sort((a, b) => a.startsAt - b.startsAt);

  /* Group by the LOCAL day of the gig, not the viewer's day. A 10pm set that
     runs to 2am belongs to the night it started — and is still listed as on. */
  const tz0 = rows[0] ? rows[0].tz : 'UTC';
  const today = localDate(now, tz0);
  const days = [];
  for (const r of rows) {
    const d = days.find((x) => x.date === r.date);
    if (d) d.gigs.push(r);
    else days.push({ date: r.date, label: dayLabel(r.date, today), gigs: [r] });
  }
  days.forEach((d) => { d.count = d.gigs.length; });

  return json({
    ok: true, country, city,
    today, horizon: addDays(today, WINDOW_DAYS),
    total: rows.length, artists: ids.length,
    days,
  });
};

const shape = (o) => ({
  eventId: o.eventId, date: o.date, time: o.time, endTime: o.endTime, tz: o.tz,
  startsAt: o.startsAt, endsAt: o.endsAt,
  venue: o.venue, city: o.city, country: o.country,
  note: o.note, ticketUrl: o.ticketUrl, repeating: o.repeating,
  live: Date.now() >= o.startsAt && Date.now() < o.endsAt,
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
