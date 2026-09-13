import { casDoc, readDoc } from './_lib.mjs';
import { appendLog, readLog, logKeys } from './_append.mjs';

/* WHAT THE ROOM THOUGHT OF MYSET.

   An iOS-style "enjoying this?" prompt, asked of the AUDIENCE — the people who
   experience the product without ever signing up for it, and who therefore never
   get asked anything.

   Two rules keep it from being an annoyance, and both are enforced HERE as well as
   in the page, because a client-side limit is a suggestion:

     · at most one rating per device per week
     · nothing stored without a star count — a stray tap is not feedback

   The running total is kept separately from the list of notes, so the average
   survives trimming and the document stays small. `count`/`sum` are the truth;
   `list` is the most recent notes for the artist to read. */

const K = (aid) => `fb_${aid}`;
export const MAX_NOTES = 200;
export const ONE_WEEK = 7 * 24 * 3600e3;
export const MAX_NOTE = 400;

const empty = () => ({ v: 1, count: 0, sum: 0, list: [] });

export async function readFeedback(aid) {
  const { data } = await readDoc(K(aid), null);
  const d = { ...empty(), ...(data || {}) };
  d.list = Array.isArray(d.list) ? d.list : [];
  return d;
}

/** Returns { ok, error, already } — `already` when this device rated recently. */
export async function saveFeedback(aid, fanId, stars, note, showId) {
  const n = Math.round(Number(stars));
  if (!Number.isFinite(n) || n < 1 || n > 5) return { ok: false, error: 'stars' };
  const text = String(note || '').trim().slice(0, MAX_NOTE);
  const now = Date.now();
  let already = false, full = false;

  await casDoc(K(aid), empty, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    /* One per device per week, server-side. The check is against the stored notes
       rather than a per-fan index, because an index keyed by fan id would grow with
       every phone that ever opened the page and this is read by the Studio. The
       honest limit of that: a rating older than the trim window can be repeated. */
    const mine = d.list.find((r) => r && r.fan === fanId);
    if (mine && now - (mine.at || 0) < ONE_WEEK) { already = true; return false; }
    if (mine) {
      // same device, a week later: replace rather than accumulate rows per phone
      d.sum = Math.max(0, (d.sum || 0) - (Number(mine.stars) || 0));
      d.count = Math.max(0, (d.count || 0) - 1);
      d.list = d.list.filter((r) => r !== mine);
    }
    d.count = (d.count || 0) + 1;
    d.sum = (d.sum || 0) + n;
    d.list.push({ fan: fanId, stars: n, note: text, at: now, show: showId || '' });
    full = d.list.length > MAX_NOTES;
    return true;
  });
  // the Studio reads MAX_NOTES and nothing is lost; costs nothing until it is full
  if (full) await spillFeedback(aid).catch(() => {});

  return already ? { ok: true, already: true } : { ok: true };
}

/** The compact shape the Studio renders. Notes only — never a device id. */
/* The Studio's list is capped at MAX_NOTES; what the room said is not thrown away
   past it. The overflow goes to `fbarch_<aid>` (append-only, never trimmed —
   _append.mjs, decision 0068) before it leaves the list. Same at-least-once shape
   as the community feed's archive: a crash between the two writes appends again,
   and the reader dedups. */
export const ARCH = (aid) => `fbarch_${aid}`;
export async function spillFeedback(aid) {
  const { data } = await readDoc(K(aid), null);
  const list = Array.isArray(data && data.list) ? data.list : [];
  if (list.length <= MAX_NOTES) return 0;
  const over = list.slice(0, list.length - MAX_NOTES);
  await appendLog(ARCH(aid), over);
  const gone = new Set(over.map((r) => `${r.fan}|${r.at}`));
  await casDoc(K(aid), empty, (d) => {
    d.list = (Array.isArray(d.list) ? d.list : []).filter((r) => !(r && gone.has(`${r.fan}|${r.at}`)));
    return true;
  });
  return over.length;
}
export async function readArchivedFeedback(aid) {
  const log = await readLog(ARCH(aid));
  const seen = new Set(), out = [];
  for (const r of log.list) { const k = r && `${r.fan}|${r.at}`; if (k && !seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}
export const archiveKeys = (aid) => logKeys(ARCH(aid));

export function shapeFeedback(d) {
  const count = d.count || 0;
  const withNotes = d.list.filter((r) => r && r.note).slice(-20).reverse();
  const spread = [1, 2, 3, 4, 5].map((s) => d.list.filter((r) => r && r.stars === s).length);
  return {
    count,
    average: count ? Math.round((d.sum / count) * 10) / 10 : null,
    spread,                                   // how many of each star, from the kept notes
    recent: withNotes.map((r) => ({ stars: r.stars, note: r.note, at: r.at })),
  };
}
