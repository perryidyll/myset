import { casDoc, readDoc } from './_lib.mjs';
import { wallClockToMs, validTz, addDays, addMonths, daysBetween, utcToDate } from './_time.mjs';
import { normPlace, mapLinks } from './_maps.mjs';

/* Gigs are stored as RULES, not as materialised instances.

   A weekly residency is one record, not 52. Editing "every Thursday at the Ugly
   Duckling" is one edit, a residency with no end date needs no maintenance, and
   there is no job to run. The cost is that every read expands the rule over the
   window it cares about — cheap, because the window is only ever a week of feed
   or a month of calendar. */

const EV = (aid) => `ev_${aid}`;
const CITY_INDEX = 'cityindex';
export const MAX_EVENTS = 200;

export const emptyEvents = () => ({ v: 1, list: [] });

export async function readEvents(aid) {
  const { data } = await readDoc(EV(aid), null);
  const d = data || emptyEvents();
  d.list = Array.isArray(d.list) ? d.list : [];
  return d;
}
export const mutateEvents = (aid, fn) =>
  casDoc(EV(aid), emptyEvents, (d) => { d.list = Array.isArray(d.list) ? d.list : []; return fn(d); });

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

/* An end time is what a musician actually knows ("we finish at 1"), so the UI
   asks for that and this turns it into a length. An end BEFORE the start means
   the set runs past midnight — which is the normal case, not an error. */
const mins = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
function durationFrom(e) {
  const a = mins(e.time), b = mins(e.endTime);
  if (a != null && b != null) {
    let d = b - a; if (d <= 0) d += 1440;
    return Math.max(15, Math.min(720, d));
  }
  return Math.max(15, Math.min(720, parseInt(e.durationMin, 10) || 180));
}
export const endTimeOf = (ev) => {
  const a = mins(ev.time); if (a == null) return '';
  const t = (a + (ev.durationMin || 180)) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
const FREQ = new Set(['weekly', 'biweekly', 'monthly', 'yearly']);

export function normEvent(e) {
  const out = {
    id: str(e.id, 24),
    venue: str(e.venue, 80),
    city: str(e.city, 60),
    country: str(e.country, 60),
    tz: validTz(e.tz) ? e.tz : 'UTC',
    date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null,
    time: /^\d{2}:\d{2}$/.test(e.time) ? e.time : '20:00',
    durationMin: durationFrom(e),
    note: str(e.note, 140),
    // where exactly, so somebody reading the feed can actually get there
    ...normPlace(e),
    ticketUrl: /^https:\/\//.test(e.ticketUrl || '') ? String(e.ticketUrl).slice(0, 300) : '',
    repeat: null,
    skip: Array.isArray(e.skip) ? e.skip.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 200) : [],
    // cancelled AND dismissed from the artist's list — the skip has to stay, or
    // the night comes straight back
    hid: Array.isArray(e.hid) ? e.hid.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 200) : [],
    createdAt: Number(e.createdAt) || Date.now(),
  };
  if (e.repeat && FREQ.has(e.repeat.freq)) {
    out.repeat = {
      freq: e.repeat.freq,
      until: /^\d{4}-\d{2}-\d{2}$/.test(e.repeat.until || '') ? e.repeat.until : null,
    };
  }
  return out;
}

/** Every occurrence of one rule landing in [fromDate, toDate], inclusive. */
export function expand(ev, fromDate, toDate) {
  if (!ev.date) return [];
  const out = [];
  const skip = new Set(ev.skip || []);
  const stop = ev.repeat && ev.repeat.until ? ev.repeat.until : null;
  const push = (d) => {
    if (d < fromDate || d > toDate) return;
    if (skip.has(d)) return;
    const ms = wallClockToMs(d, ev.time, ev.tz);
    if (ms == null) return;
    out.push({
      eventId: ev.id, date: d, time: ev.time, tz: ev.tz, startsAt: ms,
      endsAt: ms + ev.durationMin * 60000,
      venue: ev.venue, city: ev.city, country: ev.country, endTime: endTimeOf(ev),
      note: ev.note, ticketUrl: ev.ticketUrl, repeating: !!ev.repeat,
      address: ev.address || '', mapUrl: ev.mapUrl || '',
      maps: mapLinks(ev, ev.venue),
    });
  };

  if (!ev.repeat) { push(ev.date); return out; }
  if (toDate < ev.date) return out;

  const { freq } = ev.repeat;
  const limit = stop && stop < toDate ? stop : toDate;
  let d = ev.date, guard = 0;

  if (freq === 'weekly' || freq === 'biweekly') {
    const step = freq === 'weekly' ? 7 : 14;
    // jump straight to the first occurrence at or after fromDate — a residency
    // running since 2020 must not be walked one week at a time
    if (d < fromDate) d = addDays(d, Math.ceil(daysBetween(d, fromDate) / step) * step);
    while (d <= limit && guard++ < 400) { push(d); d = addDays(d, step); }
  } else if (freq === 'monthly' || freq === 'yearly') {
    // Always measured from the ORIGINAL date. Stepping from the previous
    // occurrence makes "the 31st" clamp to the 28th in February and then stay
    // there for good — the gig quietly walks backwards through the year.
    const per = freq === 'monthly' ? 1 : 12;
    const cap = freq === 'monthly' ? 600 : 60;
    for (let i = 0; i < cap; i++) {
      d = addMonths(ev.date, i * per);
      if (d > limit) break;
      if (d >= fromDate) push(d);
    }
  }
  return out;
}

/** Every gig an artist has in a window, flattened and in time order. */
export function occurrencesFor(events, fromDate, toDate) {
  return events.list
    .flatMap((e) => expand(e, fromDate, toDate))
    .sort((a, b) => a.startsAt - b.startsAt);
}

/** The next gig starting, or the one running right now. A 10pm set that runs to
 *  2am is still "on" at 1am — the thing todo.today gets wrong. */
export function nextOccurrence(events, nowMs) {
  const from = utcToDate(nowMs - 2 * 86400000);
  const to = utcToDate(nowMs + 60 * 86400000);
  return occurrencesFor(events, from, to).find((o) => o.endsAt > nowMs) || null;
}

/* ---------- the public city index ----------
   One global document, rewritten whenever an artist's gigs change, so the public
   feed reads exactly one known key — never list(), which lags minutes
   (INVARIANT 1). */
export async function readCityIndex() {
  const { data } = await readDoc(CITY_INDEX, null);
  const d = data || { v: 1, countries: {} };
  d.countries ||= {};
  return d;
}

// NOT a space, and not a raw control byte in the source either:
// "Koh Phangan" must not come back out as a city called "Koh".
const SEP = '\u001f';
const placeKey = (country, city) => country + SEP + city;

/** Put this artist in exactly the places they now have gigs, and nowhere else. */
export async function reindexCities(aid, events) {
  const places = new Set();
  for (const e of events.list) {
    if (!e.country || !e.city) continue;
    if (e.repeat) { places.add(placeKey(e.country, e.city)); continue; }
    // a one-off that finished a week ago shouldn't keep an artist in a city
    const ms = wallClockToMs(e.date, e.time, e.tz);
    if (ms != null && ms > Date.now() - 7 * 86400000) places.add(placeKey(e.country, e.city));
  }
  await casDoc(CITY_INDEX, () => ({ v: 1, countries: {} }), (idx) => {
    idx.countries ||= {};
    for (const [country, cities] of Object.entries(idx.countries)) {
      for (const [city, ids] of Object.entries(cities)) {
        const keep = ids.filter((x) => x !== aid);
        if (keep.length) cities[city] = keep; else delete cities[city];
      }
      if (!Object.keys(cities).length) delete idx.countries[country];
    }
    for (const p of places) {
      const [country, city] = p.split(SEP);
      idx.countries[country] ||= {};
      idx.countries[country][city] ||= [];
      if (!idx.countries[country][city].includes(aid)) idx.countries[country][city].push(aid);
    }
    return true;
  }).catch(() => {});
}
