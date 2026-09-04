import { casDoc, readDoc, DEFAULT_ARTIST } from './_lib.mjs';
import { readArtists, mutateArtists } from './_auth.mjs';

/* What each plan gets.

   The fundamentals are in every row: unlimited shows, unlimited voters, the
   whole Studio, the lyrics sheet, the gig calendar, the city feed. A free
   artist can run six nights a week forever. What free costs is a 10% cut on
   money that comes through the app, and a ceiling on how many songs are
   featured at once.

   Lyrics were briefly a paid feature and were put back. An audience that gets a
   sing-along at one artist's gig and not the next one learns that MySet is
   unreliable, which costs more than the subscription is worth. Anything the
   ROOM experiences stays free. */

export const PLANS = {
  free: {
    label: 'Free', price: 0,
    featured: 50,       // how many can be live to the audience at once
    /* SHOWS PER CALENDAR MONTH (UTC — see gigMonthOf in _lib.mjs). This is the one
       limit that tracks what MySet actually costs to run: every phone in the room
       polls for the whole gig, so the bill is driven by gigs played, not by artists
       signed up. Capping the free tier on the real cost driver is what makes free
       survivable — a limit on features would punish the wrong people and save
       nothing. Four a month is a hobbyist; five is somebody earning from it.

       It was briefly two a week (2026-09-03) and was changed straight back to four
       a month at Perry's decision. If it ever moves again, the things that move
       with it are: the copy in the Studio's Live-tab warning, the founder's note
       under Your plan, both refusal messages in admin.mjs, and MYSET.md. The tests
       read this number rather than repeating it. */
    gigs: 4,
    cut: 0.10,            // platform share of tips and vote sales
    seats: 1,
    pricing: false,       // change free-vote count, pack prices, replay/ask costs
    setlists: false,      // named subsets of the library, one active at a time
    merch: false,         // sell things from the community page (Perry: a Plus feature)
    promote: false,       // list gigs in cities you don't normally play
    analytics: false,     // earnings by venue / night / song
    presskit: false,
    branding: false,      // your colours and logo on the audience pages
  },
  plus: {
    label: 'Plus', price: 1000,
    featured: Infinity,
    gigs: Infinity,
    /* 2%, Perry's number. The ladder is 10% free / 2% Plus / 0% Pro, so the
       subscription and the transaction fee trade off against each other and a new
       artist never pays a subscription before they have earned anything. Taken as
       a Stripe `application_fee_amount` on a direct charge — see _connect.mjs. */
    cut: 0.02,
    seats: 1,
    pricing: true, setlists: true, merch: true,
    promote: false, analytics: false, presskit: false, branding: false,
  },
  pro: {
    label: 'Pro', price: 2000,
    featured: Infinity,
    gigs: Infinity,
    cut: 0,
    seats: 5,
    pricing: true, setlists: true, merch: true,
    promote: true, analytics: true, presskit: true, branding: true,
  },
};
/* WHICH OF THOSE FLAGS IS A REAL FEATURE TODAY.

   The rows above describe the ladder we sell. Four of the flags describe things
   that are DESIGNED AND NOT BUILT — there is no code behind `promote`,
   `analytics`, `presskit` or `branding` anywhere in this repo.

   The Studio shows every locked feature rather than hiding it, which was Perry's
   call and is the right one: an artist should be able to see what paying gets
   them. But greying something as "Pro" implies that paying turns it on, and Perry
   is himself comped to Pro — so without this list he would open the Studio, see
   four features presented as his, and find four dead ends. Worse, so would the
   first person who ever pays.

   So a flag in here is shown as "coming", never as "yours", on every plan
   including Pro. Deleting a name from this list is the last step of building the
   feature, not the first — and `test/limits.mjs` asserts that anything NOT in
   here is actually enforced somewhere, so the list cannot rot in the other
   direction either. */
export const NOT_BUILT = ['promote', 'analytics', 'presskit', 'branding'];

/** Everyone can KEEP this many songs; plans only limit how many are live. */
export const MAX_LIBRARY = 2000;
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
/** May this artist sell merch? ONE answer for the Studio, the checkout and the page —
 *  the founder predates the registry (planForArtist says free for him), so the owner
 *  bypass is load-bearing here exactly as it is for pricing. */
export const merchAllowed = (aid, limits) => isPlatformOwner(aid) || !!(limits && limits.merch === true);

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

  const thanks = promo.pct >= 100 ? await rewardReferrer(aid) : null;
  return {
    ok: true, code, plan: promo.plan, pct: promo.pct, months: promo.months,
    comped: promo.pct >= 100, until: promo.pct >= 100 ? until : null,
    thankedReferrer: thanks,
  };
}

/** One free month to whoever brought them, each time a referral goes paid.
 *  Called from here now and from billing when it exists. */
export async function rewardReferrer(aid) {
  const reg = await readArtists();
  const me = reg.byId[aid];
  const refId = me && me.referredBy;
  if (!refId || !reg.byId[refId]) return null;

  let name = null;
  await mutateArtists((r) => {
    const ref = r.byId[refId];
    const mine = r.byId[aid];
    if (!ref || !mine) return false;
    // don't pay twice for the same referral
    mine.referralPaid = mine.referralPaid || [];
    if (mine.referralPaid.includes('upgrade')) return false;
    mine.referralPaid.push('upgrade');

    const base = Math.max(Date.now(), Number(ref.planUntil) || 0);
    ref.planUntil = base + 30 * 86400000;
    if (planOf(ref) === 'free') ref.plan = 'plus';
    ref.referralMonths = (ref.referralMonths || 0) + 1;
    name = ref.name;
    return true;
  });
  return name;
}
