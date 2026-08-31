import { casDoc, readDoc } from './_lib.mjs';

/* "Want to perform here?"

   An artist asks a venue for a spot. The reason this is worth more than an email
   is the thing on the other end of it: the venue gets a link to a real MySet page
   with real numbers on it — how many nights, how many people, how many votes —
   instead of a bio and a promise.

   Only a signed-in ARTIST can send one, deliberately. No open contact form: that
   is a spam funnel, and it throws away the only thing that makes this useful.

   Nobody's email address is exposed. The venue marks a pitch "keen" and the
   artist sees that on their own Gigs tab; they take it from there through the
   links on each other's pages. */

export const MAX_PITCHES = 120;          // kept per venue
const STATUS = new Set(['new', 'keen', 'nope']);

const VK = (vid) => `vpitch_${vid}`;      // the venue's inbox — the canonical copy
const AK = (aid) => `apitch_${aid}`;      // the artist's pointers, so they can find their own

export const emptyPitches = () => ({ v: 1, list: [] });

const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

export async function readPitches(vid) {
  const { data } = await readDoc(VK(vid), null);
  const d = data || emptyPitches();
  d.list = Array.isArray(d.list) ? d.list : [];
  return d;
}
export async function readSent(aid) {
  const { data } = await readDoc(AK(aid), null);
  const d = data || emptyPitches();
  d.list = Array.isArray(d.list) ? d.list : [];
  return d;
}

/** Sends one. Idempotent per (artist, venue) — asking twice is not two asks. */
export async function sendPitch({ vid, venueName, venueSlug, aid, artist, message }) {
  const msg = clean(message, 400);
  const id = 'p' + Math.random().toString(36).slice(2, 10);      // outside the CAS
  let already = false, full = false, changed = false;

  await casDoc(VK(vid), emptyPitches, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    const mine = d.list.find((x) => x.aid === aid);
    if (mine) {
      already = true;
      // resending the identical text is not a change, and must not say it was
      if (msg && msg !== mine.message) {
        mine.message = msg; mine.at = Date.now(); changed = true; return true;
      }
      return false;
    }
    if (d.list.length >= MAX_PITCHES) { full = true; return false; }
    d.list.push({ id, aid, slug: artist.slug || '', name: artist.name || '',
                  message: msg, at: Date.now(), status: 'new' });
    return true;
  });
  if (full) return { ok: false, error: 'This venue has a lot of enquiries in — try again later' };

  // the artist's pointer, so "venues I've asked" needs no scan of every venue
  await casDoc(AK(aid), emptyPitches, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    const at = d.list.findIndex((x) => x.vid === vid);
    const row = { vid, slug: venueSlug || '', name: venueName || '', at: Date.now() };
    if (at >= 0) d.list[at] = row; else d.list.push(row);
    d.list = d.list.slice(-60);
    return true;
  }).catch(() => {});

  return { ok: true, already, updated: changed };
}

export async function setPitchStatus(vid, id, status) {
  if (!STATUS.has(status)) return null;
  let row = null;
  await casDoc(VK(vid), emptyPitches, (d) => {
    const r = (d.list || []).find((x) => x.id === id);
    if (!r || r.status === status) return false;
    r.status = status; r.seenAt = Date.now();
    row = { ...r };
    return true;
  });
  return row;
}

/** What the venue sees: the pitch plus the artist's real, public numbers. */
export async function shapeForVenue(d) {
  const { readHistIndex } = await import('./_history.mjs');
  const { getShow } = await import('./_lib.mjs');
  const rows = [];
  for (const p of (d.list || []).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 60)) {
    let nights = 0, people = 0, votes = 0, songs = 0;
    try {
      const [hist, show] = await Promise.all([readHistIndex(p.aid), getShow(p.aid)]);
      nights = hist.shows.length;
      people = hist.shows.reduce((a, x) => a + (x.room ?? x.peakVoters ?? 0), 0);
      votes = hist.shows.reduce((a, x) => a + (x.totalVotes || 0), 0);
      songs = (show.songs || []).filter((x) => x.active !== false).length;
    } catch { /* a missing history must not hide the enquiry */ }
    rows.push({ id: p.id, slug: p.slug, name: p.name, message: p.message || '',
                at: p.at, status: p.status || 'new',
                stats: { nights, people, votes, songs } });
  }
  return rows;
}

/** What the artist sees: their own asks, with the venue's current answer. */
export async function shapeForArtist(aid) {
  const sent = await readSent(aid);
  const out = [];
  for (const row of (sent.list || []).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 40)) {
    let status = 'new';
    try {
      const d = await readPitches(row.vid);
      const mine = (d.list || []).find((x) => x.aid === aid);
      status = (mine && mine.status) || 'new';
    } catch {}
    out.push({ vid: row.vid, slug: row.slug, name: row.name, at: row.at, status });
  }
  return out;
}
