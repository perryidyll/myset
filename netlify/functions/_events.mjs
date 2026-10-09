import { casDoc, readDoc, inTurn } from './_lib.mjs';
import { casKeep } from './_versions.mjs';
import { wallClockToMs, validTz, addDays, addMonths, daysBetween, utcToDate, localDate } from './_time.mjs';
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
/* casKeep: the calendar as it was is kept before every change (decision 0067). */
export const mutateEvents = (aid, fn) =>
  casKeep(EV(aid), emptyEvents, (d) => { d.list = Array.isArray(d.list) ? d.list : []; return fn(d); });

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
    id: str(e.id, 24).replace(/[^a-zA-Z0-9_-]/g, ''),     // an id is never markup — see eventSave
    /* Only a VENUE's own events have a title — a quiz night, a DJ, the football.
       For an artist's gig the artist IS the title, so this stays empty. */
    title: str(e.title, 70),
    venue: str(e.venue, 80),
    city: str(e.city, 60),
    country: str(e.country, 60),
    tz: validTz(e.tz) ? e.tz : 'UTC',
    date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null,
    time: /^\d{2}:\d{2}$/.test(e.time) ? e.time : '20:00',
    durationMin: durationFrom(e),
    note: str(e.note, 140),
    /* Which setlist to play, in THREE states — the difference is the whole design:
         ''     no opinion. Leave whatever the artist has picked alone.
         'all'  clear it: play the whole library tonight.
         <id>   that setlist.
       Applied when the artist taps Start the show (or New show), not before — a gig
       three weeks out must not change what tonight's room sees. */
    listId: String(e.listId || '').replace(/[^a-z0-9]/gi, '').slice(0, 12),
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
      title: ev.title || '',
      venue: ev.venue, city: ev.city, country: ev.country, endTime: endTimeOf(ev),
      note: ev.note, ticketUrl: ev.ticketUrl, repeating: !!ev.repeat,
      listId: ev.listId || '',
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

/** One night of one gig, as a key: `<eventId>@<date>`. The scheduler stamps it on
 *  the show it starts, the filed night keeps it, and the artist's book (_biz.mjs)
 *  files that night's numbers under it — one spelling, from here. */
export const occKey = (o) => `${o.eventId}@${o.date}`;

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
   (INVARIANT 1).

   It holds VENUE owners too, as `v_<venueId>`. Artist ids are stripped to
   [a-z0-9-] so the underscore can only ever mean a venue, and an existing array
   of artist ids keeps working untouched — no migration. */
export const isVenueOwner = (id) => String(id || '').startsWith('v_');
export const venueIdOf = (id) => String(id || '').slice(2);
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

/* THE CITY'S GIGS RIDE WITH THE INDEX — decision 0174, INVARIANT 0in.

   The front door's picker counted each city's gigs by reading every owner's
   calendar, one after another; a city's feed and a venue page read every owner in
   the city. They run in the same function as the live rooms, and once a walk timed
   out nothing was cached, so every visit walked again — the 2026-10-02 audit put
   the end at about 130 to 240 artists.

   So the write that puts an owner in a city keeps, beside the id, what every
   reader needs to know about their gigs THERE: each rule's date, time, zone,
   length, repeat, skipped nights and venue — `gigs[country][city][owner]`, with
   the owner's own zone (`tz`, what "today" means for them) and when it was
   written (`at`). Rules, not nights: a weekly residency never runs out, so nothing
   has to come back to top it up, and a count is worked out at read time from the
   clock. The picker reads one document; a feed and a venue page read the
   calendars of only the owners with something on, or at that venue. An owner the
   index has no rules for (written before this) is read the old way, so nothing
   goes missing on the day it ships.

   A LOST WRITE HEALS. A save does not wait on this write (`.catch`), as it never
   did. `healCityIndex` re-points every owner from their own calendar once a day,
   from `citycron` — never from a page. */
export const RULE_DAYS_BACK = 2;    // a night older than this is never in anybody's window
export const ownerTz = (events) => ((events.list || []).find((x) => x && x.tz) || {}).tz || 'UTC';

/** Membership and rules for one owner, from their calendar: pure. */
function placesOf(events, now) {
  const places = new Set();
  for (const e of events.list) {
    if (!e.country || !e.city) continue;
    if (e.repeat) { places.add(placeKey(e.country, e.city)); continue; }
    // a one-off that finished a week ago shouldn't keep an artist in a city
    const ms = wallClockToMs(e.date, e.time, e.tz);
    if (ms != null && ms > now - 7 * 86400000) places.add(placeKey(e.country, e.city));
  }
  const cutoff = utcToDate(now - RULE_DAYS_BACK * 86400e3);
  const rules = {};
  for (const e of events.list) {
    const k = placeKey(e.country, e.city);
    if (!e.country || !e.city || !places.has(k) || !e.date) continue;
    if (e.repeat ? (e.repeat.until && e.repeat.until < cutoff) : e.date < cutoff) continue;   // can never be on again
    (rules[k] ||= []).push({ id: e.id, date: e.date, time: e.time, tz: e.tz, durationMin: e.durationMin, repeat: e.repeat || null,
                             skip: (e.skip || []).filter((d) => d >= cutoff), venue: e.venue || '' });
  }
  return { places, rules };
}

/** Put one owner in exactly `places`, with their rules there, and nowhere else (pure, on the index). */
function placeOwner(idx, owner, { places, rules }, tz, at) {
  idx.countries ||= {};
  idx.gigs ||= {};
  for (const [country, cities] of Object.entries(idx.countries)) {
    for (const [city, ids] of Object.entries(cities)) {
      const keep = ids.filter((x) => x !== owner);
      if (keep.length) cities[city] = keep; else delete cities[city];
    }
    if (!Object.keys(cities).length) delete idx.countries[country];
  }
  for (const [country, cities] of Object.entries(idx.gigs)) {
    for (const [city, by] of Object.entries(cities)) { delete by[owner]; if (!Object.keys(by).length) delete cities[city]; }
    if (!Object.keys(cities).length) delete idx.gigs[country];
  }
  for (const p of places) {
    const [country, city] = p.split(SEP);
    idx.countries[country] ||= {};
    idx.countries[country][city] ||= [];
    if (!idx.countries[country][city].includes(owner)) idx.countries[country][city].push(owner);
    ((idx.gigs[country] ||= {})[city] ||= {})[owner] = { at, tz, r: rules[p] || [] };
  }
}

/** Put this artist in exactly the places they now have gigs, and nowhere else. */
export async function reindexCities(aid, events, now = Date.now()) {
  const where = placesOf(events, now);
  const tz = ownerTz(events);
  await casDoc(CITY_INDEX, () => ({ v: 1, countries: {} }), (idx) => { placeOwner(idx, aid, where, tz, Date.now()); return true; }).catch(() => {});
}

/** What the index knows of one owner's gigs in one place — or null, when it was
 *  written before it knew (read the calendar instead). */
export const placeGigs = (idx, country, city, owner) => {
  const e = ((((idx && idx.gigs) || {})[country] || {})[city] || {})[owner];
  return e && Array.isArray(e.r) ? e : null;
};
/** Those rules' nights from the owner's own yesterday to `days` ahead, not yet over:
 *  the same window the feed has always drawn. */
export function upcomingAt(entry, country, city, now, days) {
  const from = localDate(now, entry.tz || 'UTC');
  return occurrencesFor({ list: entry.r.map((r) => ({ ...r, city, country })) }, addDays(from, -1), addDays(from, days))
    .filter((o) => o.endsAt > now);
}

/* THE HEAL. Every owner on the two registries, a few calendars at a time, inside
   the ring's budget, from where the last ring stopped (`heal.cursor` on the index).
   One write a ring. An owner whose rules were written by a save AFTER this ring
   read their calendar is left alone — the save is newer. An account on its way out
   is taken out, never put back (0dh). Ids on the index that no registry names (a
   sample page, a stray) are not touched. A pass a day; a ring after a finished
   pass is one read. */
export const HEAL_GAP_MS = 20 * 3600e3;
export const HEAL_BUDGET_MS = () => Math.max(0, Number(process.env.MYSET_CITY_HEAL_BUDGET_MS ?? 5000));
export async function healCityIndex({ now = Date.now(), budgetMs = HEAL_BUDGET_MS() } = {}) {
  const deadline = Date.now() + budgetMs;
  const h = (await readCityIndex()).heal || {};
  if (!h.cursor && h.passAt && now - h.passAt < HEAL_GAP_MS) return { done: true, idle: true, passAt: h.passAt };
  const [{ readArtists }, { readVenues }] = await Promise.all([import('./_auth.mjs'), import('./_venues.mjs')]);
  const [ar, vr] = await Promise.all([readArtists(), readVenues()]);
  const owners = [...Object.entries(ar.byId || {}).map(([id, a]) => [id, !!(a && a.del)]),
                  ...Object.entries(vr.byId || {}).map(([vid, v]) => ['v_' + vid, !!(v && v.del)])].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let i = Math.min(Number(h.cursor) || 0, owners.length);
  const seen = [];
  while (i < owners.length && (!seen.length || Date.now() < deadline)) {
    const batch = owners.slice(i, i + 8);
    i += batch.length;
    seen.push(...await inTurn(batch, async ([o, gone]) => {
      const readAt = Date.now();
      return { o, readAt, events: gone ? emptyEvents() : await readEvents(o) };
    }));
  }
  const finished = i >= owners.length;
  let fixed = 0, kept = 0;
  await casDoc(CITY_INDEX, () => ({ v: 1, countries: {} }), (idx) => {
    fixed = 0; kept = 0;
    for (const { o, readAt, events } of seen) {
      const was = ownerShape(idx, o);
      if (was.at > readAt) { kept++; continue; }               // a save since this ring read it
      placeOwner(idx, o, placesOf(events, now), ownerTz(events), now);
      if (JSON.stringify(ownerShape(idx, o).shape) !== JSON.stringify(was.shape)) fixed++;
    }
    idx.heal = { cursor: finished ? 0 : i, passAt: finished ? now : (h.passAt || 0), at: now };
    return true;
  });
  return { done: finished, walked: seen.length, of: owners.length, fixed, kept };
}
/* One owner's places and rules on the index, without the stamps — what a heal compares. */
function ownerShape(idx, owner) {
  const shape = [];
  let at = 0;
  for (const [country, cities] of Object.entries(idx.countries || {})) for (const [city, ids] of Object.entries(cities)) if (ids.includes(owner)) {
    const g = placeGigs(idx, country, city, owner);
    if (g) at = Math.max(at, Number(g.at) || 0);
    shape.push([country, city, g ? g.r : null]);
  }
  return { at, shape: shape.sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1)) };
}
