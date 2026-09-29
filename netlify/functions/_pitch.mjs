import { casDoc, readDoc } from './_lib.mjs';
import { newThreadId, pitchOpen, pitchAgain, pitchSay, readThread, shapeForVenueThread } from './_messages.mjs';

/* "Want to perform here?"

   An artist asks a venue for a spot. The reason this is worth more than an email
   is the thing on the other end of it: the venue gets a link to a real MySet page
   with real numbers on it — how many nights, how many people, how many votes —
   instead of a bio and a promise.

   Only a signed-in ARTIST can send one, deliberately. No open contact form: that
   is a spam funnel, and it throws away the only thing that makes this useful.

   Nobody's email address is exposed. Since decision 0123 a pitch is a
   conversation: it opens in the artist's Messages (the Venues folder) under the
   id kept on the pitch row (`tid`), the venue replies from its Venue Studio, and
   Keen / Not this time each drop one line into it. The conversation lives with
   the artist (`msg_<aid>_<tid>`, _messages.mjs); the venue reads it through its
   own pitch row, never by a key it could guess. `vunread` marks a pitch the
   artist has answered and the venue has not opened since. */

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
  const tid0 = newThreadId();                                       // so is the conversation's
  let already = false, full = false, changed = false, row = null, fresh = false;

  await casDoc(VK(vid), emptyPitches, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    already = false; changed = false; fresh = false; row = null;   // a CAS retry starts clean
    const mine = d.list.find((x) => x.aid === aid);
    if (mine) {
      already = true;
      let write = false;
      if (!mine.tid) { mine.tid = tid0; fresh = true; write = true; }   // a pitch from before 0123
      // resending the identical text is not a change, and must not say it was
      if (msg && msg !== mine.message) {
        mine.message = msg; mine.at = Date.now(); changed = true; write = true;
      }
      row = { ...mine };
      return write;
    }
    if (d.list.length >= MAX_PITCHES) { full = true; return false; }
    row = { id, aid, tid: tid0, slug: artist.slug || '', name: artist.name || '',
            message: msg, at: Date.now(), status: 'new' };
    d.list.push(row); fresh = true;
    return true;
  });
  if (full) return { ok: false, error: 'This venue has a lot of enquiries in — try again later' };

  // the conversation in the artist's Messages: opened once, and a changed ask is a new line in it
  const where = { vid, vslug: venueSlug, venueName, p: row };
  if (row && row.tid) {
    await pitchOpen(aid, row.tid, where).catch(() => {});
    if (changed && !fresh) await pitchAgain(aid, row.tid, msg).catch(() => {});
  }

  // the artist's pointer, so "venues I've asked" needs no scan of every venue
  await casDoc(AK(aid), emptyPitches, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    const at = d.list.findIndex((x) => x.vid === vid);
    const row = { vid, slug: venueSlug || '', name: venueName || '', at: Date.now() };
    if (at >= 0) d.list[at] = row; else d.list.push(row);
    d.list = d.list.slice(-60);
    return true;
  }).catch(() => {});

  return { ok: true, already, updated: changed, tid: row ? row.tid || '' : '' };
}

/* The one line each quick button drops into the conversation (0123). Undo sends nothing. */
export const STATUS_LINE = { keen: 'We’re keen — let’s talk.', nope: 'Not this time, but thanks for asking.' };

/** The pitch row with its conversation id, minting one for a pitch from before 0123. */
async function withThread(vid, id) {
  const tid0 = newThreadId();
  let row = null;
  await casDoc(VK(vid), emptyPitches, (d) => {
    row = null;
    const r = (d.list || []).find((x) => x.id === id);
    if (!r) return false;
    row = r;
    if (r.tid) return false;
    r.tid = tid0; return true;
  });
  return row ? { ...row } : null;
}
async function venueOf(vid) {
  const { venueById } = await import('./_venues.mjs');
  const v = await venueById(vid).catch(() => null);
  return { vslug: (v && v.slug) || '', venueName: (v && v.name) || '' };
}

export async function setPitchStatus(vid, id, status) {
  if (!STATUS.has(status)) return null;
  let row = null;
  await casDoc(VK(vid), emptyPitches, (d) => {
    row = null;
    const r = (d.list || []).find((x) => x.id === id);
    if (!r || r.status === status) return false;
    r.status = status; r.seenAt = Date.now();
    row = { ...r };
    return true;
  });
  if (row && STATUS_LINE[status]) {
    const p = await withThread(vid, id);
    if (p) {
      await pitchOpen(p.aid, p.tid, { vid, ...(await venueOf(vid)), p }).catch(() => {});
      await pitchSay(p.aid, p.tid, STATUS_LINE[status], { status }).catch(() => {});
    }
  }
  return row;
}

/** The venue writes back. Opening the conversation first means a pitch from
 *  before 0123 gets one the moment the venue answers it. */
export async function venueReply(vid, id, text) {
  const p = await withThread(vid, id);
  if (!p) return { ok: false, error: 'That enquiry is gone.' };
  const t = await pitchOpen(p.aid, p.tid, { vid, ...(await venueOf(vid)), p }).catch(() => null);
  if (!t) return { ok: false, error: 'Couldn’t open that conversation — try again.' };
  const r = await pitchSay(p.aid, p.tid, text);
  if (r.ok) await markVenueRead(vid, id).catch(() => {});
  return r;
}
/** The venue reads the conversation. A pitch with no conversation yet reads as
 *  its own message, and reading it opens nothing. */
export async function venueThread(vid, id) {
  const d = await readPitches(vid);
  const p = d.list.find((x) => x.id === id);
  if (!p) return null;
  const t = p.tid ? await readThread(p.aid, p.tid).catch(() => null) : null;
  if (p.vunread) await markVenueRead(vid, id).catch(() => {});
  if (t) return { ...shapeForVenueThread(t), name: p.name || '', slug: p.slug || '' };   // the thread is named for the venue; the venue is talking to the artist
  return { id: '', name: p.name || '', slug: p.slug || '', status: p.status || 'new',
           msgs: [{ by: 'artist', text: p.message || '', at: p.at || 0 }].filter((m) => m.text) };
}
async function markVenueRead(vid, id) {
  await casDoc(VK(vid), emptyPitches, (d) => {
    const r = (d.list || []).find((x) => x.id === id);
    if (!r || !r.vunread) return false;
    r.vunread = false; return true;
  });
}
/** The artist answered in Messages: the venue's list shows it as new. */
export async function venueUnread(vid, aid) {
  await casDoc(VK(vid), emptyPitches, (d) => {
    const r = (d.list || []).find((x) => x.aid === aid);
    if (!r || r.vunread) return false;
    r.vunread = true; return true;
  });
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
                at: p.at, status: p.status || 'new', unread: !!p.vunread,
                stats: { nights, people, votes, songs } });
  }
  return rows;
}

/** What the artist sees: their own asks, with the venue's current answer. */
export async function shapeForArtist(aid) {
  const sent = await readSent(aid);
  const out = [];
  for (const row of (sent.list || []).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 40)) {
    let status = 'new', tid = '';
    try {
      const d = await readPitches(row.vid);
      const mine = (d.list || []).find((x) => x.aid === aid);
      status = (mine && mine.status) || 'new';
      tid = (mine && mine.tid) || '';
    } catch {}
    out.push({ vid: row.vid, slug: row.slug, name: row.name, at: row.at, status, tid });
  }
  return out;
}
