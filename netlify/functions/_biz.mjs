import { casDoc, readDoc, KEY } from './_lib.mjs';
import { PLANS, isPlatformOwner } from './_plan.mjs';

/* THE ARTIST'S BOOK  (decision 0065)

   What a show was worth to the person who played it: what they were paid, who in
   the band got what and what their own cut was, cash tips, merch sold at the
   door, the costs, four kinds of time and the gear. None of it is on Stripe and none of it was anywhere in MySet
   — the Money tab could say what fans paid through the app and nothing else, so
   an artist who wanted a real $/hour kept a spreadsheet beside it.

   ONE DOCUMENT PER ARTIST, `biz_<aid>`, one strong read. Not the event rule (that
   is whitelisted by normEvent and rewritten whole on every save), not the filed
   night (it does not exist before the show, and its index row is rebuilt on every
   archive), not the live show (CAS on every vote — bytes there are paid for by
   every phone in the room). Two maps inside it:

     rules[eventId]   what a run of gigs is worth by default — typed once on the
                      gig form, applied to every night of the run that has no
                      record of its own, past and future (D5)
     gigs[key]        one night's own numbers, where key is the calendar
                      occurrence `<eventId>@<date>` (the same key the scheduler
                      stamps on the show, now copied onto the filed night) or, for
                      a night that matched no gig, its showId

   A night is COUNTED only when it has a record here or a filed night behind it; a
   rule alone is a plan, not income (INVARIANT 0ef, decision 0031).

   BYTE-CAPPED, because a document that grows for ever is the one kind the store
   does not warn about. Four hundred kilobytes is years of a busy artist's nights
   at a few hundred bytes each; when it is full the write is refused with the
   sentence below, and the expansion path is a YEAR SHARD, `biz_<aid>_<yyyy>`, read
   alongside this one for a period that reaches into it. Not built until somebody
   fills the first document. */

export const BIZ = KEY.biz;
export const BIZ_MAX_BYTES = 400000;
export const MAX_RULES = 200;                  // one per gig rule; the calendar holds MAX_EVENTS
export const BIZ_FULL = 'This year’s book is full — MySet will split it by year in a later release';

/* Fixed caps, mirrored in public/biz.js as Biz.LIMITS — test/bizmath.mjs pins the
   two literals equal, so a change here that is not made there fails the suite.
   The plan-sized caps (band members, costs a show) live in PLANS, not here. */
export const LIMITS = { merch: 20, gear: 30, gearChars: 80, name: 60, note: 300, cents: 1e7, minutes: 2880, qty: 999 };
/* The four kinds of time, in the order the page shows them. Everything that
   touches minutes iterates this list — a fifth kind is one line here and one in
   public/biz.js (pinned equal by the same test). */
export const TIME_KINDS = [['perform', 'On stage'], ['break', 'Breaks'], ['travel', 'Travel'], ['setup', 'Set-up / break-down']];

const hoursOn = () => Object.fromEntries(TIME_KINDS.map(([k]) => [k, true]));
export const emptyBiz = () => ({ v: 1, at: 0, prefs: { hours: hoursOn() }, rules: {}, gigs: {} });

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const fill = (d) => {
  d.prefs = obj(d.prefs); d.prefs.hours = { ...hoursOn(), ...obj(d.prefs.hours) };
  d.rules = obj(d.rules); d.gigs = obj(d.gigs);
  return d;
};

export async function readBiz(aid) {
  const { data } = await readDoc(BIZ(aid), null);
  return fill({ ...emptyBiz(), ...(data || {}) });
}

/** Returns { ok, full, data }. `full` means the write was refused for size —
 *  nothing was written and the caller owes the artist BIZ_FULL. */
export async function mutateBiz(aid, fn) {
  let full = false;
  const r = await casDoc(BIZ(aid), emptyBiz, (d) => {
    fill(d);
    /* THE CAP IS ON GROWTH, NOT SIZE (INVARIANT 0s: a cap never deletes anything,
       and the plan caps in this same file already follow the rule). A document
       that is somehow past the line — a heal, the year-shard migration, a bigger
       `at` — must still let the artist remove a record, because a remove is the
       way out; refusing it would make the book read-only from their side for
       good. So a write is refused only when it ends over the cap AND bigger than
       it started. */
    const before = Buffer.byteLength(JSON.stringify(d));
    const out = fn(d);
    if (out === false) return false;
    const after = Buffer.byteLength(JSON.stringify(d));
    if (after > BIZ_MAX_BYTES && after > before) { full = true; return false; }
    d.at = Date.now();
    return true;
  });
  return { ok: !!r.ok, full, data: r.data };
}

/* WHICH CAPS APPLY. The founder predates the registry and reads as free, so every
   plan gate carries `isPlatformOwner` in front of it (the bypass is load-bearing —
   see _plan.mjs). A yes/no gate can bypass to "yes"; a NUMBER has to bypass to a
   number, and the only honest one is the top plan's. */
export const bizCaps = (aid, limits) => (isPlatformOwner(aid) ? PLANS.pro : (limits || PLANS.free));

const KEY_RE = /^[a-z0-9]{1,16}@\d{4}-\d{2}-\d{2}$/;
/* A showId is `YYYY-MM-DD-HHmm-<4 base36>` (newShowId); the founder's oldest nights
   were minted without the tail, so it is optional. */
const SHOW_RE = /^\d{4}-\d{2}-\d{2}-\d{4}(-[a-z0-9]{1,8})?$/;
export const keyOk = (key) => KEY_RE.test(String(key || '')) || SHOW_RE.test(String(key || ''));

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const blank = (v) => v === '' || v == null;
/* Cents arrive as a number or a numeric string; anything else, negative, or past
   the ceiling is a refusal, not a clamp — a sheet that sends nonsense should hear
   about it rather than have it quietly rounded into somebody's tax figures. */
function cents(v) {
  if (blank(v)) return { n: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > LIMITS.cents) return { bad: true };
  return { n: Math.round(n) };
}
function minutes(v) {
  if (blank(v)) return { n: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > LIMITS.minutes) return { bad: true };
  return { n: Math.round(n) };
}

/* THE GROWTH RULE (INVARIANT 0s: a cap never deletes anything). A band of eight
   logged on Rock Star is still a band of eight after a downgrade to Bar Star — the
   record stays editable and only ADDING a ninth is refused. So the ceiling is the
   plan's cap or the record's own length, whichever is larger. */
function overCap(rows, cap, prev) {
  return rows.length > Math.max(Number(cap) || 0, (Array.isArray(prev) ? prev : []).length);
}
const capMsg = (what, caps) => (Number(caps[what]) < Number(PLANS.pro[what]))
  ? { err: `${PLANS.plus.label} allows ${PLANS.plus[what]} ${what === 'band' ? 'band members' : 'costs'} a show — ${PLANS.pro.label} allows ${PLANS.pro[what]}`, status: 402 }
  : { err: `That’s the ${PLANS.pro[what]} ${PLANS.pro.label} allows`, status: 400 };

/**
 * One show's numbers, shaped for storage: trimmed, capped, every amount an integer
 * of cents and every time an integer of minutes. Returns { gig } or { err, status }.
 * `limits` is the plan row in force (see bizCaps), `prev` the record being replaced,
 * for the growth rule.
 */
export function normGig(raw, limits, prev) {
  const g = obj(raw), was = obj(prev), caps = limits || PLANS.free;
  const line = (r) => {
    const c = cents(obj(r).cents);
    if (c.bad) return null;
    return { name: str(obj(r).name, LIMITS.name), cents: c.n || 0 };
  };
  const rows = (v) => (Array.isArray(v) ? v : []);
  const kept = (r) => r.name || r.cents;
  const out = {};

  const pay = cents(g.pay);
  if (pay.bad) return { err: 'That doesn’t look like an amount for the gig', status: 400 };
  out.pay = pay.n;

  const band = rows(g.band).map(line);
  if (band.includes(null)) return { err: 'That doesn’t look like an amount for a band member', status: 400 };
  out.band = band.filter(kept);
  if (overCap(out.band, caps.band, was.band)) return capMsg('band', caps);

  /* The artist's own share of the night, typed when it is not simply what is
     left after the splits and the costs (a band that shares the tips, say).
     Blank means "what is left", and the maths (public/biz.js calc) fills it in. */
  const cut = cents(g.cut);
  if (cut.bad) return { err: 'That doesn’t look like an amount for your cut', status: 400 };
  out.cut = cut.n;

  const tips = cents(g.tips);
  if (tips.bad) return { err: 'That doesn’t look like an amount for tips', status: 400 };
  out.tips = tips.n;

  /* A quantity has a ceiling too, for the same reason cents do: every other
     number in the record has one, and 1e300 t-shirts summed onto a report is
     not a typo anyone should have to find on paper. Mirrored in Biz.LIMITS.qty. */
  let badQty = false;
  const merch = rows(g.merch).slice(0, LIMITS.merch).map((r) => {
    const l = line(r); if (!l) return null;
    const q = Number(obj(r).qty);
    if (Number.isFinite(q) && q > LIMITS.qty) { badQty = true; return null; }
    return { ...l, qty: Number.isFinite(q) && q > 0 ? Math.round(q) : 0 };
  });
  if (badQty) return { err: 'That doesn’t look like a quantity for merch', status: 400 };
  if (merch.includes(null)) return { err: 'That doesn’t look like an amount for merch', status: 400 };
  out.merch = merch.filter((r) => kept(r) || r.qty);

  const costs = rows(g.costs).map(line);
  if (costs.includes(null)) return { err: 'That doesn’t look like an amount for a cost', status: 400 };
  out.costs = costs.filter(kept);
  if (overCap(out.costs, caps.costs, was.costs)) return capMsg('costs', caps);

  out.min = {};
  for (const [k, label] of TIME_KINDS) {
    const m = minutes(obj(g.min)[k]);
    if (m.bad) return { err: `${label}: that’s more than ${LIMITS.minutes / 60} hours — check the time`, status: 400 };
    out.min[k] = m.n;
  }

  /* Gear comes as lines; a bullet the sheet drew is stripped here as well as
     there, so nothing decorative is ever stored. */
  const gear = Array.isArray(g.gear) ? g.gear : String(g.gear == null ? '' : g.gear).split(/\r?\n/);
  out.gear = gear.map((l) => str(String(l == null ? '' : l).replace(/^[\s•·\-*]+/, ''), LIMITS.gearChars))
    .filter(Boolean).slice(0, LIMITS.gear);
  out.note = str(g.note, LIMITS.note);
  out.at = Date.now();
  return { gig: out };
}

/** Drop rule defaults whose gig is no longer on the calendar. Returns how many went. */
export function pruneRules(doc, events) {
  const keep = new Set(((events && events.list) || []).map((e) => e && e.id).filter(Boolean));
  let gone = 0;
  for (const id of Object.keys(obj(doc.rules))) if (!keep.has(id)) { delete doc.rules[id]; gone++; }
  return gone;
}
