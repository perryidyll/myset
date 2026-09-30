import { readDoc, casDoc } from './_lib.mjs';

/* A VENUE SAYS WHICH SHOWS ARE REALLY AT ITS PLACE (decision 0128, the founder,
   2026-09-30: "make sure that venues have a way to approve/deny events that artists
   say are happening at their venue – if it is a recurring show they only have to
   approve it once, but it must be made clear that they are confirming it's a
   recurring show").

   Nothing links an artist's gig to a venue but the name the artist typed (INVARIANT
   0y); this is the venue's answer to that claim, kept on the venue's side, one
   document per venue. The key is the artist and the calendar RULE (`<aid>:<eventId>`),
   not a date, so a weekly residency is one answer for every week.

     ok   the venue confirmed it. `rec` says it confirmed a RECURRING show; if the
          artist later turns a one-off into a repeat (or back), the answer no longer
          fits and the show waits again.
     no   the venue says it is not at their place: it leaves the venue's page. The
          artist's own page and calendar are theirs and are not touched.
   No answer is "listed by the artist", exactly as before, so a venue that never
   opens its Studio loses nothing. */
const KEY = (vid) => `gigok_${vid}`;
export const GIGOK_MAX = 400;
export const gigKey = (aid, eventId) => `${aid}:${eventId}`;
export const validGigKey = (k) => /^[a-z0-9-]{1,40}:[a-zA-Z0-9_-]{1,24}$/.test(String(k || ''));

export async function readGigOk(vid) {
  const { data } = await readDoc(KEY(vid), null);
  return { v: 1, by: {}, ...(data || {}) };
}

/** What the venue said about this rule, given whether it repeats now: 'ok', 'no' or ''. */
export function gigStatus(doc, aid, eventId, repeats) {
  const a = ((doc && doc.by) || {})[gigKey(aid, eventId)];
  if (!a) return '';
  if (a.st === 'no') return 'no';
  return a.st === 'ok' && !!a.rec === !!repeats ? 'ok' : '';
}

/** Set, or clear with st ''. A recurring rule is confirmed only with `recurring: true`. */
export async function setGigOk(vid, key, st, { repeats = false, recurring = false, now = Date.now() } = {}) {
  if (!validGigKey(key)) return { ok: false, error: 'Unknown show', status: 400 };
  if (!['ok', 'no', ''].includes(st)) return { ok: false, error: 'Unknown answer', status: 400 };
  if (st === 'ok' && repeats && !recurring) return { ok: false, error: 'This is a recurring show — confirm that it repeats.', status: 409, recurring: true };
  await casDoc(KEY(vid), () => ({ v: 1, by: {} }), (d) => {
    d.by ||= {};
    if (!st) delete d.by[key];
    else d.by[key] = { st, at: now, ...(st === 'ok' ? { rec: !!repeats } : {}) };
    const keys = Object.keys(d.by);
    if (keys.length > GIGOK_MAX) keys.sort((a, b) => d.by[a].at - d.by[b].at).slice(0, keys.length - GIGOK_MAX).forEach((k) => delete d.by[k]);
    return true;
  });
  return { ok: true };
}

/* A NEW LISTING TELLS THE VENUE. When an artist saves a gig whose place names a
   venue on MySet in the same city, that venue's phones hear it once — the first save
   of that rule, or a save that moved it to this venue. Best-effort and time-boxed:
   the artist's save never waits on it (INVARIANT 16). */
export const GIG_NOTE_MS = 1500;
export async function tellVenueOfGig(aid, artistName, ev, before) {
  try {
    if (!ev || !ev.venue || !ev.city) return;
    const { readVenues, sameVenue } = await import('./_venues.mjs');
    if (before && before.venue && sameVenue(before.venue, ev.venue) && before.city === ev.city) return;   // not new here
    const reg = await readVenues();
    const hits = Object.entries(reg.byId || {}).filter(([, v]) => v && !v.del && v.city === ev.city
      && (!v.country || !ev.country || v.country === ev.country) && sameVenue(ev.venue, v.name)).slice(0, 2);
    if (!hits.length) return;
    const { notify } = await import('./_push.mjs');
    if (!artistName) { const { artistById } = await import('./_auth.mjs'); artistName = ((await artistById(aid).catch(() => null)) || {}).name; }
    const repeats = !!ev.repeat;
    await Promise.race([
      Promise.allSettled(hits.map(([vid]) => notify('v_' + vid, {
        title: `${String(artistName || 'An artist').slice(0, 40)} listed a show at your place`,
        body: repeats ? 'A recurring show — approve it once in your Venue Studio.' : 'Approve it, or say it isn’t at your place.',
        url: '/venues?tab=shows', tag: 'gig-' + aid }, { tab: 'shows' }))),
      new Promise((r) => setTimeout(r, GIG_NOTE_MS)),
    ]);
  } catch { /* a courtesy; the gig is saved */ }
}
