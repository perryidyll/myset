import { casDoc, readDoc, sha, roomHash } from './_lib.mjs';

/* WHO SAYS THEY ARE COMING.

   A fan on the artist page or the front door taps RSVP on a listed night and the
   card says "12 going". Nobody signs in — the audience never does (INVARIANT 9g) —
   so the fan is the same anonymous id the vote page keeps, and it is HASHED before
   it is written: this document never holds a raw device id, because it is read
   into the public feed's function on every city-feed run and copied by the weekly
   backup, and a device id is the one thing that could tie a night to a phone.

   Two rules, both enforced here rather than in the page, because a localStorage
   rule is a suggestion:
     · one RSVP per device per night, toggled. Tapping again takes it back, and
       repeating the state you are already in changes nothing — not even a write
     · a night holds at most MAX_FANS. Past that a new 'on' is a no-op that still
       answers the count, so the button can never lead to a shrug

   ONE DOCUMENT PER OWNER (the artist, or the `v_<venueId>` a venue's own events
   already live under), keyed inside by '<eventId>|<date>' — not one document per
   night. The gig list and the city feed already read one document per owner for
   the events themselves; the counts ride alongside in the same Promise.all, one
   hop, not one per row. And a weekly residency would otherwise be fifty-two
   documents that nothing could find without list() (INVARIANT 1). Nights more
   than KEEP_DAYS gone are pruned on write, and a night further ahead than
   HORIZON_DAYS — the furthest the gig list itself will show — is refused (rsvp.mjs),
   so the document stays the size of the calendar a page can draw, whatever the
   residency's age. Without the far edge a repeating rule accepts any Tuesday to
   the end of time and the document grows by one night per anonymous POST.

   The honest limits, said once: a count is a SOCIAL SIGNAL, not a headcount. A
   script with a fresh id per call can inflate it — up to RSVP_PER_NETWORK from any
   one network, see below; a cleared browser forgets it was going; the hash is of
   a self-chosen id, so it proves nothing about who.
   Never money, never identity, never a number a venue should plan a night on.

   ONE NETWORK MAY PUT AT MOST RSVP_PER_NETWORK DEVICES ON A NIGHT. The device id
   is chosen by the phone, so a loop that mints a fresh one per call is 5,000
   "going" from one laptop in under a minute — the one thing about this count that
   was unbounded. The network address is the one thing the caller does NOT choose
   (Netlify sets the header), so each night keeps a small map of network hash →
   devices admitted from it, on the occurrence already being written (the shape
   decision 0030 chose for casting: the limit lives on the record, a refused write
   writes nothing). Past the cap a new 'on' is the same no-op a full night is —
   the count is still answered, the button never leads to a shrug. Four hundred is
   deliberately twice the phones any bar has on one wifi — a venue's own gig list
   is RSVP'd from the venue's own network the week before, by staff and regulars
   alike — and the cost of being wrong is only that the 401st phone on one network
   is not counted. Taking an RSVP back frees a place on the network it is taken back
   from; the map is pruned to RSVP_NETS_KEPT entries (smallest first) so a festival
   crowd on mobile data cannot grow the document past a few kilobytes per night.
   The hash is roomHash (the owner id and the address, hashed), never the address.

   casDoc keeps its default retries: this is one document per owner that a whole
   room may tap at once, and a real fan losing the race forty times is not a thing
   a room produces. When it does happen, rsvp.mjs answers with a calm 503 the page
   already knows how to take, never the guard's 500. (The first build cut the
   retries to eight to starve a script; the per-network cap does that job, and a
   cut here would have been paid by real fans on a packed night. Decision 0111.) */

const K = (ownerId) => `rsvp_${ownerId}`;
export const MAX_FANS = 5000;
export const KEEP_DAYS = 3;
export const HORIZON_DAYS = 120;   // the gig list's own `days=` cap (events.mjs reads this one)
export const RSVP_PER_NETWORK = 400;   // distinct devices one network may put on one night
export const RSVP_NETS_KEPT = 300;     // network counters kept per night; the smallest fall off
export const occKey = (eventId, date) => `${eventId}|${date}`;

const empty = () => ({ v: 1, occ: {} });

export async function readRsvp(ownerId) {
  const { data } = await readDoc(K(ownerId), null);
  const d = { ...empty(), ...(data || {}) };
  d.occ = d.occ && typeof d.occ === 'object' ? d.occ : {};
  return d;
}

/** '<eventId>|<date>' -> how many are going. What every feed row carries. */
export function rsvpCounts(doc) {
  const out = {};
  for (const [k, o] of Object.entries((doc && doc.occ) || {})) out[k] = Number(o && o.n) || 0;
  return out;
}

/** Returns { on, n } — this fan's state AFTER the write and the night's total.
 *  `occurrence` is one row of occurrencesFor(), already checked by the caller to
 *  belong to this owner and to not have finished. `ip` is the caller's network
 *  (clientIp); without one — a local run, a test — no per-network cap applies.
 *  Throws when the document cannot be written; the caller answers. */
export async function toggleRsvp(ownerId, occurrence, fanId, on, ip = '') {
  const key = occKey(occurrence.eventId, occurrence.date);
  const h = sha(fanId).slice(0, 16);
  const net = roomHash(ownerId, ip);
  const now = Date.now();
  const floor = new Date(now - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  let out = { on: false, n: 0 };
  await casDoc(K(ownerId), empty, (d) => {
    d.occ = d.occ && typeof d.occ === 'object' ? d.occ : {};
    let changed = false;
    for (const k of Object.keys(d.occ)) {
      // the date is the tail of the key; an event id may not be boring
      if (k.slice(k.lastIndexOf('|') + 1) < floor) { delete d.occ[k]; changed = true; }
    }
    const o = d.occ[key] || (d.occ[key] = { n: 0, fans: {} });
    o.fans = o.fans && typeof o.fans === 'object' ? o.fans : {};
    o.nets = o.nets && typeof o.nets === 'object' ? o.nets : {};
    const had = !!o.fans[h];
    const room = !net || (Number(o.nets[net]) || 0) < RSVP_PER_NETWORK;
    if (on && !had && Object.keys(o.fans).length < MAX_FANS && room) {
      o.fans[h] = now; changed = true;
      if (net) o.nets[net] = (Number(o.nets[net]) || 0) + 1;
    }
    else if (!on && had) {
      delete o.fans[h]; changed = true;
      if (net && o.nets[net]) { o.nets[net] = Math.max(0, (Number(o.nets[net]) || 0) - 1); if (!o.nets[net]) delete o.nets[net]; }
    }
    const nets = Object.keys(o.nets);
    if (nets.length > RSVP_NETS_KEPT)
      for (const k of nets.sort((a, b) => o.nets[a] - o.nets[b]).slice(0, nets.length - RSVP_NETS_KEPT)) delete o.nets[k];
    o.n = Object.keys(o.fans).length;
    out = { on: !!o.fans[h], n: o.n };
    if (!o.n) delete d.occ[key];             // never keep an empty night
    return changed;                          // nothing moved: no write at all
  });
  return out;
}
