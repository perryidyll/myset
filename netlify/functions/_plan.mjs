import { casDoc, readDoc, DEFAULT_ARTIST } from './_lib.mjs';
import { readArtists, mutateArtists } from './_auth.mjs';

/* What each plan gets.

   The fundamentals are in every row: unlimited shows, unlimited voters, the
   whole Studio, the lyrics sheet, the gig calendar, the city feed. A free
   artist can run six nights a week forever. What free costs is a 10% cut on
   money that comes through the app, and a ceiling on setlist size. */

export const PLANS = {
  free: {
    label: 'Free', price: 0,
    songs: 50,
    cut: 0.10,            // platform share of tips and vote sales
    seats: 1,
    promote: false,       // list gigs in cities you don't normally play
    analytics: false,     // earnings by venue / night / song
    presskit: false,
    branding: false,      // your colours and logo on the audience pages
  },
  plus: {
    label: 'Plus', price: 1000,
    songs: Infinity,
    cut: 0,
    seats: 1,
    promote: false, analytics: false, presskit: false, branding: false,
  },
  pro: {
    label: 'Pro', price: 2000,
    songs: Infinity,
    cut: 0,
    seats: 5,
    promote: true, analytics: true, presskit: true, branding: true,
  },
};
export const PLAN_KEYS = Object.keys(PLANS);

/** The plan actually in force — a comped period that has run out falls back. */
export function planOf(artist) {
  if (!artist) return 'free';
  const p = PLAN_KEYS.includes(artist.plan) ? artist.plan : 'free';
  if (p === 'free') return 'free';
  if (artist.planUntil && Number(artist.planUntil) < Date.now()) return 'free';
  return p;
}
export const limitsFor = (plan) => PLANS[plan] || PLANS.free;

export async function planForArtist(aid) {
  const reg = await readArtists();
  const artist = reg.byId[aid];
  const plan = planOf(artist);
  return { plan, limits: limitsFor(plan), artist: artist || null };
}

/** Only the founding artist can mint or revoke codes. */
export const isPlatformOwner = (aid) => aid === DEFAULT_ARTIST;

/* ---------- promo codes ---------- */
const PROMOS = 'promos';
export const emptyPromos = () => ({ v: 1, codes: {} });

export const cleanCode = (v) =>
  String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);

export async function readPromos() {
  const { data } = await readDoc(PROMOS, null);
  const d = data || emptyPromos();
  d.codes ||= {};
  return d;
}
export const mutatePromos = (fn) =>
  casDoc(PROMOS, emptyPromos, (d) => { d.codes ||= {}; return fn(d); });

/** Applies a code to an artist. 100% comps the plan outright; anything less is
 *  recorded so a future subscription checkout can discount it — there is no
 *  billing to halve yet, and pretending otherwise would be a lie. */
export async function redeemPromo(aid, rawCode) {
  const code = cleanCode(rawCode);
  if (!code) return { ok: false, error: 'Enter a code' };

  let promo = null, why = null;
  await mutatePromos((d) => {
    const c = d.codes[code];
    if (!c) { why = 'That code isn’t recognised'; return false; }
    if (c.revoked) { why = 'That code has been turned off'; return false; }
    if (c.maxUses && (c.usedBy || []).length >= c.maxUses) { why = 'That code has been used up'; return false; }
    if ((c.usedBy || []).includes(aid)) { why = 'You’ve already used that code'; return false; }
    c.usedBy = [...(c.usedBy || []), aid];
    promo = { plan: c.plan, months: c.months, pct: c.pct };
    return true;
  });
  if (!promo) return { ok: false, error: why || 'Could not apply that code' };

  const until = Date.now() + (promo.months || 12) * 30 * 86400000;
  await mutateArtists((reg) => {
    const a = reg.byId[aid];
    if (!a) return false;
    if (promo.pct >= 100) { a.plan = promo.plan; a.planUntil = until; a.compedBy = code; }
    else { a.discountPct = promo.pct; a.discountCode = code; a.pendingPlan = promo.plan; }
    return true;
  });

  return {
    ok: true, code, plan: promo.plan, pct: promo.pct, months: promo.months,
    comped: promo.pct >= 100, until: promo.pct >= 100 ? until : null,
  };
}
