import { casDoc, readDoc, sha } from './_lib.mjs';

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
   night. The diary and the city feed already read one document per owner for
   the events themselves; the counts ride alongside in the same Promise.all, one
   hop, not one per row. And a weekly residency would otherwise be fifty-two
   documents that nothing could find without list() (INVARIANT 1). Nights more
   than KEEP_DAYS gone are pruned on write, and a night further ahead than
   HORIZON_DAYS — the furthest the diary itself will show — is refused (rsvp.mjs),
   so the document stays the size of the calendar a page can draw, whatever the
   residency's age. Without the far edge a repeating rule accepts any Tuesday to
   the end of time and the document grows by one night per anonymous POST.

   The honest limits, said once: a count is a SOCIAL SIGNAL, not a headcount. A
   script with a fresh id per call can inflate it; a cleared browser forgets it
   was going; the hash is of a self-chosen id, so it proves nothing about who.
   Never money, never identity, never a number a venue should plan a night on. */

const K = (ownerId) => `rsvp_${ownerId}`;
export const MAX_FANS = 5000;
export const KEEP_DAYS = 3;
export const HORIZON_DAYS = 120;   // the diary's own `days=` cap (events.mjs reads this one)
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
 *  belong to this owner and to not have finished. */
export async function toggleRsvp(ownerId, occurrence, fanId, on) {
  const key = occKey(occurrence.eventId, occurrence.date);
  const h = sha(fanId).slice(0, 16);
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
    const had = !!o.fans[h];
    if (on && !had && Object.keys(o.fans).length < MAX_FANS) { o.fans[h] = now; changed = true; }
    else if (!on && had) { delete o.fans[h]; changed = true; }
    o.n = Object.keys(o.fans).length;
    out = { on: !!o.fans[h], n: o.n };
    if (!o.n) delete d.occ[key];             // never keep an empty night
    return changed;                          // nothing moved: no write at all
  });
  return out;
}
