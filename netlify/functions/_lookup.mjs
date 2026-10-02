import { readDoc, casDoc, store, own, inTurn, cleanArtistId } from './_lib.mjs';

/* ONE SMALL FILE PER PAGE ADDRESS AND PER ARTIST, BESIDE THE ARTIST LIST (decision
   0176, INVARIANT 0ip).

   `artists` holds every artist in one document, and the audience path asked it two
   questions: which artist is this page address (every poll, vote and page load on a
   cold instance — decision 0141 keeps a copy for a minute on a warm one), and what
   is the artist called (every vote, every board, through getShow). At 1,000 artists
   that document is about 215 KB; at 10,000, 2 to 3 MB (the 2026-10-02 audit). So two
   small kinds of document answer those two questions:

     aslug_<slug>   { aid, seq }           the artist a page address answers for
     arow_<aid>     { row, names, seq }    that artist's line of the list without its
                                           two sign-in facts, and every address that
                                           answers for it

   THE LIST STAYS THE TRUTH. These are copies, written after the list's own write
   has succeeded (mutateArtists is the one writer) and never instead of it:
     · missing, unreadable, or the two disagreeing  -> the list is read
     · an artist on the way out (`del`)              -> the list is read, so an undone
       deletion comes back at once (0141's rule: only a YES is taken from a copy)
     · out of date because the copy's write was lost -> the heal, rung by citycron,
       puts it right within HEAL_GAP_MS. Until then it can answer YES for a page that
       left: the one stale answer this allows, the same kind 0141's minute allowed
   Sign-in, roles, revocation, the leaving gate and prices never read a copy: they
   grant access or take money, and a copy cannot prove it is current without reading
   the list (0dd, INVARIANT 0hp). The public address lookup (publicSlug) and the name
   and address on a page (rowOf, behind artistById) are the only readers.

   `seq` is the list's version, moved by every write (nextSeq). A copy carries the
   version it was made from, and a copy made from an older list never overwrites one
   made from a newer: two writers finishing in the wrong order cannot leave the old
   answer behind. It never falls behind the clock, so a list put back from a backup
   is ahead of every copy made before it the next time it is written, and the heal
   can tell its copies from newer ones before then (ROLLBACK_MS).

   Never `list()` (INVARIANT 1): every key is computed from the list. Never copied
   off-site (_mirror.mjs FAMILIES): rebuilt from `artists`, which is — and a copy put
   back beside a list from a different moment is the one way they could disagree.
   No copy carries an email address; an address-to-artist copy is the next step and
   is not built, because the only reader of an address is sign-in. */

export const SLUG_KEY = (slug) => `aslug_${slug}`;
export const ROW_KEY = (aid) => `arow_${aid}`;
export const HEAL_KEY = 'alookheal';

/** The list's next version: one more than the last, and never behind the clock. */
export const nextSeq = (reg) => Math.max((Number(reg && reg.seq) || 0) + 1, Date.now());

/* The two sign-in facts a row carries stay on the list alone. The verifier reads them
   there on every request (verifyToken), and a copy of them would be a second answer
   to "is this device signed out" that could be wrong. It also keeps a sign-out from
   rewriting a copy nobody reads it from. */
const lean = (row) => { const { rev, dead, ...rest } = row || {}; return rest; };

/** What the copies of this list should say: every address that answers for a row
 *  that is there — a current name before an old one, the order publicArtist has always
 *  read them in — and every row with its addresses. */
export function lookupDocs(reg) {
  const byId = (reg && reg.byId) || {};
  const point = new Map();
  for (const [s, v] of Object.entries((reg && reg.oldSlug) || {})) point.set(s, v && v.aid);
  for (const [s, aid] of Object.entries((reg && reg.bySlug) || {})) point.set(s, aid);
  const slugs = new Map(), names = new Map();
  for (const [s, aid] of point) {
    if (typeof aid !== 'string' || !own(byId, aid)) continue;   // a name for nobody has no copy
    slugs.set(s, aid);
    if (!names.has(aid)) names.set(aid, []);
    names.get(aid).push(s);
  }
  const rows = new Map();
  for (const aid of Object.keys(byId)) rows.set(aid, { row: lean(byId[aid]), names: (names.get(aid) || []).sort() });
  return { slugs, rows };
}
/** Every copy's key and what it should hold (without `seq`). */
function lookupWants(reg) {
  const { slugs, rows } = lookupDocs(reg);
  const out = new Map();
  for (const [s, aid] of slugs) out.set(SLUG_KEY(s), { aid });
  for (const [aid, d] of rows) out.set(ROW_KEY(aid), d);
  return out;
}
/** A fingerprint of every copy, taken inside the list's write before it changes
 *  anything, so the copies rewritten afterwards are only the ones it changed. */
export function lookupPrints(reg) {
  const out = new Map();
  for (const [k, d] of lookupWants(reg)) out.set(k, JSON.stringify(d));
  return out;
}
/** The copies that belong to one artist: what a purge deletes with the account. */
export function lookupKeys(reg, aid) {
  const names = [];
  if (reg && own(reg.byId || {}, aid)) {
    for (const [s, v] of Object.entries(reg.oldSlug || {})) if (v && v.aid === aid && own(reg.bySlug || {}, s) === undefined) names.push(s);
    for (const [s, a] of Object.entries(reg.bySlug || {})) if (a === aid) names.push(s);
  }
  return [ROW_KEY(aid), ...names.sort().map(SLUG_KEY)];
}

/* A copy from an older list never overwrites one from a newer; the same version has
   already written the same words. A few tries, not forty: a copy that cannot be
   written is the heal's to put right, and the person who changed the list is waiting. */
const putLookup = (k, d, seq) => casDoc(k, () => ({}), (cur) => {
  if (Number(cur.seq) >= seq) return false;
  for (const x of Object.keys(cur)) delete cur[x];
  Object.assign(cur, d, { seq });
  return true;
}, null, 4);

/** After the list's write: rewrite every copy whose words changed, delete every copy
 *  that no longer has a row or an address behind it. Never throws — the list's write
 *  has already happened, and a copy that failed is read past (it is missing or older,
 *  and the list answers) until the heal rewrites it. */
export async function writeLookups(before, reg) {
  const seq = Number(reg && reg.seq) || 0;
  const jobs = [];
  const want = lookupWants(reg);
  for (const [k, d] of want) if (before.get(k) !== JSON.stringify(d)) jobs.push([k, d]);
  for (const k of before.keys()) if (!want.has(k)) jobs.push([k, null]);
  const out = { wrote: 0, deleted: 0, failed: 0 };
  await inTurn(jobs, async ([k, d]) => {
    try {
      if (d) { await putLookup(k, d, seq); out.wrote++; }
      else { await store().delete(k); out.deleted++; }
    } catch { out.failed++; }
  });
  return out;
}

/* ---------- the readers ---------- */

/* The name and address on a page: the artist's own copy, and the list only when the
   copy is not there to read. Never for sign-in, a role or a price. */
export async function rowOf(aid) {
  if (typeof aid === 'string' && aid && cleanArtistId(aid) === aid) {
    try {
      const { data } = await readDoc(ROW_KEY(aid), null);
      if (data && data.row) return data.row;
    } catch { /* a copy that cannot be read is no answer: the list is */ }
  }
  const { readArtists } = await import('./_auth.mjs');
  const row = own((await readArtists()).byId, aid);
  return row ? lean(row) : null;
}

/* A YES, kept a minute on a warm instance: the same minute decision 0141 chose, for
   the same reason — every phone in a room asks the same question. A NO is never kept.
   A write to the list from this instance forgets them all (mutateArtists). */
const PUBLIC_TTL = 60e3;
const KEPT_MAX = 5000;
const seen = new Map();
export const forgetLookups = () => seen.clear();

/** Which artist is this page address? `want` is already cleaned (cleanSlug).
 *  `fromList` asks the list itself, the way publicArtist always has. */
export async function publicSlug(want, fromList) {
  if (!want) return null;
  const kept = seen.get(want);
  if (kept && Date.now() - kept.at < PUBLIC_TTL) return kept.aid;
  let aid = null;
  try { aid = await fromCopies(want); } catch { aid = null; }   // unreadable: the list decides
  if (!aid) aid = await fromList();
  if (aid) {
    if (seen.size >= KEPT_MAX) seen.clear();
    seen.set(want, { aid, at: Date.now() });
  }
  return aid;
}
/* Two small reads. The address's copy names an artist; that artist's copy must be
   there, not leaving, and list the address too — two copies written by the same
   write that agree. Anything else is not a yes, and the list is asked. */
async function fromCopies(want) {
  const s = (await readDoc(SLUG_KEY(want), null)).data;
  const aid = s && typeof s.aid === 'string' ? s.aid : '';
  if (!aid || cleanArtistId(aid) !== aid) return null;
  const r = (await readDoc(ROW_KEY(aid), null)).data;
  if (!r || !r.row || r.row.del) return null;
  if (!Array.isArray(r.names) || !r.names.includes(want)) return null;
  return aid;
}

/* ---------- the heal ---------- */

/* A copy whose write was lost stays wrong until something rewrites it, so a pass over
   the list compares every artist's copies with the list and rewrites the ones that
   differ. Rung by citycron (hourly); a pass at most every HEAL_GAP_MS; inside a ring it
   stops at its budget after at least one batch, and the next ring carries on from the
   artist after the last it finished (`after`). A ring after a finished pass is one read.

   It never overwrites a newer copy: one whose version is past the list it read was
   written by a change made since, unless that version is also older than the read by
   ROLLBACK_MS — impossible for a change made since, so the list was put back from a
   backup and its copies are the ones that are wrong. Each rewrite is conditional on
   the copy it read, so a write landing between the two is never clobbered. */
export const HEAL_GAP_MS = 6 * 3600e3;
export const ROLLBACK_MS = 10 * 60e3;
export const HEAL_BUDGET_MS = () => Math.max(0, Number(process.env.MYSET_LOOKUP_HEAL_BUDGET_MS ?? 3000));
const HEAL_BATCH = 16;

export async function healLookups({ now = Date.now(), budgetMs = HEAL_BUDGET_MS() } = {}) {
  const deadline = Date.now() + budgetMs;
  const { data: h0 } = await readDoc(HEAL_KEY, null);
  const h = h0 || {};
  if (!h.after && h.passAt && now - h.passAt < HEAL_GAP_MS) return { done: true, idle: true, passAt: h.passAt };
  const { readArtists } = await import('./_auth.mjs');
  const readAt = Date.now();
  const reg = await readArtists();
  const seq = Number(reg.seq) || 0;
  const { rows } = lookupDocs(reg);
  const aids = [...rows.keys()].sort();
  const out = { done: false, walked: 0, of: aids.length, fixed: 0, kept: 0, raced: 0, failed: 0, orphans: 0 };
  const same = (have, d) => { const { seq: _s, ...rest } = have; return JSON.stringify(rest) === JSON.stringify(d); };
  const fix = async ([k, d]) => {
    let cur;
    try { cur = await readDoc(k, null); } catch { out.failed++; return; }
    const have = cur.data;
    if (have && same(have, d)) return;
    const hs = Number(have && have.seq) || 0;
    if (have && hs > seq && hs >= readAt - ROLLBACK_MS) { out.kept++; return; }
    const w = await store().set(k, JSON.stringify({ ...d, seq }), cur.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true }).catch(() => null);
    if (w && w.modified !== false) out.fixed++; else out.raced++;
  };
  let i = 0;
  if (h.after) { i = aids.findIndex((a) => a > h.after); if (i < 0) i = aids.length; }
  else await sweepSamples(reg, out);
  const start = i;
  while (i < aids.length && (i === start || Date.now() < deadline)) {
    const batch = aids.slice(i, i + HEAL_BATCH);
    i += batch.length;
    const jobs = [];
    for (const aid of batch) {
      const d = rows.get(aid);
      jobs.push([ROW_KEY(aid), d]);
      for (const s of d.names) jobs.push([SLUG_KEY(s), { aid }]);
    }
    await inTurn(jobs, fix, HEAL_BATCH);
  }
  out.done = i >= aids.length;
  out.walked = i - start;
  const after = out.done ? '' : aids[i - 1];
  await casDoc(HEAL_KEY, () => ({}), (d) => {
    d.after = after; d.passAt = out.done ? now : (h.passAt || 0); d.at = now;
    return true;
  }).catch(() => {});
  return out;
}

/* A PAGE WHOSE CLAIM WAS UNDONE (decision 0101) leaves the list and goes back to the
   sample register. If the function that took it off the list died before its copies
   were deleted, they would go on answering for it, and a pass over the list never
   meets it. So each pass starts with the few pages the sample register holds: one the
   list does not have has no copy. A claim in flight is left alone. */
async function sweepSamples(reg, out) {
  let sreg;
  try { const { readSampleReg } = await import('./_sample.mjs'); sreg = await readSampleReg(); } catch { return; }
  const jobs = [];
  for (const [owner, row] of Object.entries((sreg && sreg.byId) || {})) {
    if (owner.startsWith('v_') || own(reg.byId, owner) || (row && row.st === 'claiming')) continue;
    if (cleanArtistId(owner) !== owner) continue;
    jobs.push([ROW_KEY(owner), owner]);
    if (row && row.slug) jobs.push([SLUG_KEY(row.slug), owner]);
  }
  await inTurn(jobs, async ([k, owner]) => {
    try {
      const { data } = await readDoc(k, null);
      if (!data || (k.startsWith('aslug_') && data.aid !== owner)) return;
      await store().delete(k);
      out.orphans++;
    } catch { out.failed++; }
  });
}
