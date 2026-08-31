import { readHistIndex } from './_history.mjs';
import { readCityIndex } from './_events.mjs';
import { sameVenue } from './_venues.mjs';
import { readArtists } from './_auth.mjs';

/* What happened in this venue's room, by night and by act.

   Built entirely from show history that already exists — no new tracking, no
   extra writes. For each artist listed in the venue's city, the shows whose venue
   name matches this one.

   TWO THINGS ARE DELIBERATELY ABSENT:

   * MONEY. What an artist took in tips and vote sales is the artist's business
     and nobody else's. It is not in this payload at all, not even as a total.
   * Any artist who has switched sharing off. `shareStats !== false` is the
     default, because the whole point is that a venue can see what MySet did in
     their own room — but it is the artist's data and they get the switch. */

const MAX_ARTISTS = 80;

export async function venueStats(venue) {
  const out = {
    ok: true,
    totals: { nights: 0, people: 0, votes: 0, songs: 0, acts: 0 },
    byNight: [], byAct: [], busiest: null, first: null, last: null,
    hidden: 0,                       // acts who have sharing switched off
  };
  if (!venue || !venue.country || !venue.city || !venue.name) return out;

  const idx = await readCityIndex();
  const ids = (((idx.countries || {})[venue.country] || {})[venue.city] || [])
    .filter((id) => !id.startsWith('v_'))            // venue-run events have no shows
    .slice(0, MAX_ARTISTS);
  const reg = await readArtists();

  const acts = new Map();
  for (const aid of ids) {
    const who = reg.byId[aid];
    if (!who) continue;
    if (who.shareStats === false) { out.hidden++; continue; }

    let hist;
    try { hist = await readHistIndex(aid); } catch { continue; }
    const mine = (hist.shows || []).filter((s) => sameVenue(s.venue, venue.name));
    if (!mine.length) continue;

    let a = acts.get(aid);
    if (!a) { a = { name: who.name || '', slug: who.slug || '', nights: 0, people: 0,
                    votes: 0, songs: 0, best: null }; acts.set(aid, a); }

    for (const s of mine) {
      const people = s.room ?? s.peakVoters ?? 0;
      const votes = s.totalVotes || 0;
      const songs = s.songsPlayed || 0;
      const date = dayOf(s.endedAt || s.startedAt);

      out.byNight.push({ date, at: s.endedAt || s.startedAt || 0,
                         artist: a.name, slug: a.slug, people, votes, songs });
      a.nights++; a.people += people; a.votes += votes; a.songs += songs;
      if (!a.best || people > a.best.people) a.best = { date, people };

      out.totals.nights++; out.totals.people += people;
      out.totals.votes += votes; out.totals.songs += songs;
    }
  }

  out.byNight.sort((x, y) => (y.at || 0) - (x.at || 0));
  out.byAct = [...acts.values()].sort((x, y) => y.people - x.people || y.nights - x.nights);
  out.totals.acts = out.byAct.length;
  out.busiest = out.byNight.reduce((b, r) => (!b || r.people > b.people ? r : b), null);
  if (out.byNight.length) {
    out.last = out.byNight[0].date;
    out.first = out.byNight[out.byNight.length - 1].date;
  }
  return out;
}

function dayOf(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
