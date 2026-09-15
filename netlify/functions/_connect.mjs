import Stripe from 'stripe';
import { casDoc, readDoc, mutateShow } from './_lib.mjs';
import { logErr } from './_errlog.mjs';
import { planForArtist, PLANS, isPlatformOwner } from './_plan.mjs';
import { VENUE_PLANS } from './_venues.mjs';

/* OWNERS. Everything here is keyed by an OWNER id: an artist id, or `v_<vid>` for a
   venue (2026-09-04 — venues take money for their merch the same way, on their own
   Express account, with MySet's fee off the top). Artist ids are stripped to
   [a-z0-9-], so the underscore can only ever mean a venue. */
export const isVenueOwner = (o) => String(o || '').startsWith('v_');

/* STRIPE CONNECT — DIRECT CHARGES.

   The identity this encodes: MySet is not selling the night. The ARTIST is selling
   it, and MySet provides the infrastructure and takes a platform fee. So the
   connected account is the merchant of record — the charge is created ON their
   account, the money lands in their balance, Stripe's processing fee comes off
   their side, and MySet takes an `application_fee_amount` off the top.

   This is what closes INVARIANT 0r, which has been an open note since multi-tenancy
   shipped: until now a second artist's audience paid into the FOUNDER's Stripe
   balance, and the platform cut existed only as a number in a plan table.

   WHY DIRECT AND NOT DESTINATION CHARGES. Destination charges make MySet the
   merchant of record for every gig — MySet's name on the statement, MySet holding
   the funds, MySet answering the chargeback for a night it did not play. Direct
   charges keep each artist's money legally theirs and make the fee an explicit,
   visible platform charge rather than a silent split. It is also the more portable
   shape if MySet ever moves off Netlify or adds a second payment provider.

   THE TRADE, STATED PLAINLY SO NOBODY IS SURPRISED: with direct charges, Stripe's
   own processing fee (~2.9% + 30c) is charged to the ARTIST, not to MySet. On a $5
   vote pack a Plus artist pays roughly 45c to Stripe and 50c to MySet. "10% to
   MySet" is therefore not the same as "you keep 90%", and the Studio copy has to
   say so rather than let an artist discover it from a payout.

   ONE MORE THING THAT BITES: a session created on a connected account can only be
   RETRIEVED with that same account in scope. `stripeFor(aid)` exists so the return
   page, the webhook and the reconcile sweep all retrieve the same way and none of
   them can drift into looking on the platform account and finding nothing. */

const CK = (aid) => `connect_${aid}`;
const ACCT_INDEX = 'acctindex';          // acct_xxx -> owner id, for webhooks

export const emptyConnect = () => ({
  v: 1, acct: '', chargesEnabled: false, payoutsEnabled: false,
  detailsSubmitted: false, country: '', at: 0,
});

export async function readConnect(aid) {
  const { data } = await readDoc(CK(aid), null);
  return { ...emptyConnect(), ...(data || {}) };
}
export const mutateConnect = (aid, fn) => casDoc(CK(aid), emptyConnect, fn);

/** Is this account able to take a card payment right now, as STRIPE sees it? */
export const connectUsable = (c) => !!(c && c.acct && c.chargesEnabled);

/* ---------- the platform's share ----------
   Basis points, from the plan table, so there is ONE definition of the cut and the
   pricing page cannot drift from what is charged:
     free  25%   ·   plus ($10/mo)  10%   ·   pro ($20/mo)  2% */
const planRow = (plan, kind) =>
  (kind === 'venue' ? (VENUE_PLANS[plan] || VENUE_PLANS.free) : (PLANS[plan] || PLANS.free));
export const cutOf = (plan, kind = 'artist') => {
  const c = Number(planRow(plan, kind).cut);
  return Number.isFinite(c) && c > 0 ? c : 0;
};
/* STRIPE'S OWN FEE, ESTIMATED. Card processing is about 2.9% + 30¢ in the US and
   differs by country and card; the true figure is only known after the charge, on
   the balance transaction. So "split evenly" can only be an estimate at checkout —
   said plainly here and in the Studio. An exact split would need a second transfer
   after each charge, from the real balance-transaction fee; noted in ACCOUNTS.md. */
export const stripeFeeEstimate = (amountCents) => Math.round(amountCents * 0.029 + 30);
/** The fee in cents. Rounded down, so MySet never takes more than its stated share;
 *  when the plan row says `splitFee`, half of Stripe's estimated fee comes off it,
 *  never below zero. */
export const feeCents = (amountCents, plan, kind = 'artist') => {
  const row = planRow(plan, kind);
  const cut = cutOf(plan, kind);
  if (!cut) return 0;
  let fee = Math.floor(amountCents * cut);
  if (row.splitFee) fee -= Math.round(stripeFeeEstimate(amountCents) / 2);
  return Math.max(0, Math.min(amountCents, fee));
};

/* ---------- talking to Stripe on the right account ---------- */
/* The countries MySet offers, as ISO-3166 alpha-2. An allow-list rather than "any
   two letters", because the first version sliced whatever it was sent down to two
   characters — which turns "Thailand" into TH by luck and "Germany" into GE, which
   is not a country. And an Express account's country cannot be changed afterwards,
   so a wrong guess is permanent. Add to this list when an artist needs one; Stripe
   supports more than these. */
export const PAYOUT_COUNTRIES = new Set(['TH','US','GB','AU','CA','NZ','IE','DE','FR',
  'ES','IT','NL','PT','SE','DK','NO','FI','SG','MY','JP','MX','BR']);
export const cleanCountry = (v) => {
  const c = String(v || '').trim().toUpperCase();
  return PAYOUT_COUNTRIES.has(c) ? c : '';
};

export const stripeClient = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
};

/** The client plus the request options every call about this artist's money needs.
 *  `opts.stripeAccount` is absent for the founder's own platform account, which is
 *  how his existing live payments keep working untouched. */
export async function stripeFor(aid) {
  const stripe = stripeClient();
  if (!stripe) return { stripe: null, opts: {}, acct: '' };
  const c = await readConnect(aid);
  if (connectUsable(c)) return { stripe, opts: { stripeAccount: c.acct }, acct: c.acct };
  return { stripe, opts: {}, acct: '' };
}

/** The options object, spread into a Stripe call — or NOTHING when it is empty.
 *  stripe-node treats a trailing object as options only if it carries a key it
 *  recognises; an EMPTY one is "Stripe: Unknown arguments ([object Object])",
 *  thrown client-side before any request. So for an artist on the platform account
 *  (no `stripeAccount`) every list / create / cancel that was handed `opts` threw —
 *  which is how every night from 2 Sep to 11 Sep 2026 was archived as
 *  'stripe-unreachable' with a working key. `retrieve` tolerates it; nothing else
 *  does. Use: `stripe.checkout.sessions.list(params, ...scope(opts))`. */
export const scope = (opts) => (opts && Object.keys(opts).length ? [opts] : []);

/** Which artist does a Connect webhook belong to? `event.account` is the only clue. */
export async function artistForAccount(acct) {
  if (!acct) return '';
  const { data } = await readDoc(ACCT_INDEX, null);
  return ((data || {}).by || {})[acct] || '';
}
const indexAccount = (acct, aid) =>
  casDoc(ACCT_INDEX, () => ({ v: 1, by: {} }), (d) => {
    d.by ||= {};
    if (d.by[acct] === aid) return false;
    d.by[acct] = aid;
    return true;
  }).catch(() => {});

/* ---------- onboarding ----------
   Express accounts: Stripe hosts the whole KYC flow, which is the difference
   between "paste your bank details" and building identity verification. */
/** What the Studio shows when Stripe refuses; the real reason goes to the error log. */
export const REFUSED = 'Stripe could not set up payments just now — MySet has been told. Try again later.';

export async function ensureAccount(aid, email, country) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const existing = await readConnect(aid);
  if (existing.acct) return { ok: true, acct: existing.acct, existing: true };

  const want = payoutScheduleFor(await planOfOwner(aid));
  let acct;
  try {
    acct = await stripe.accounts.create({
      type: 'express',
      email: email || undefined,
      country: country || undefined,
      // a bar is a business; Stripe asks the venue which kind during onboarding
      ...(isVenueOwner(aid) ? {} : { business_type: 'individual' }),
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      /* The fee is taken from the artist's balance, so the artist is the one who
         pays Stripe's processing fee too. Said out loud in the Studio. */
      settings: { payouts: { schedule: want } },
      metadata: { myset_owner: aid, myset_kind: isVenueOwner(aid) ? 'venue' : 'artist',
                  ...(isVenueOwner(aid) ? {} : { myset_artist: aid }) },
    });
  } catch (e) {
    /* Stripe's refusal is about the PLATFORM more often than the artist — on
       2026-09-14 the first live press failed with "Please review the responsibilities
       of managing losses … /settings/connect/platform-profile", a dashboard
       acknowledgement only the founder can give. The artist cannot act on that
       text and must not be shown a Stripe URL; the founder reads the real message
       in the error log. */
    await logErr('connect.create', e, { aid });
    return { ok: false, error: REFUSED };
  }
  await mutateConnect(aid, (c) => { c.acct = acct.id; c.payout = payoutTag(want); c.at = Date.now(); return true; });
  await indexAccount(acct.id, aid);
  return { ok: true, acct: acct.id };
}

/* ---------- when the money lands ----------
   Decision 0080 (2026-09-15): a paid plan is paid out DAILY; Hobbyist WEEKLY, on
   Monday — most gigs are Friday to Sunday, so the weekend's money is in the bank
   to start the week. The schedule lives on the artist's own Stripe account, so it
   is set when the account is made and re-checked whenever the plan or the account
   is looked at. `c.payout` remembers what Stripe was last told, so the re-check
   costs nothing while nothing has changed and one call when it has. Venues follow
   the same rule by plan id. Stripe's $2-per-active-account fee is unchanged by
   this; only the 25¢-per-payout fee shrinks. The reason is the plan card, not the
   fee: "paid the next day" is something a paid plan gives. */
export const PAYOUT_WEEKLY_ANCHOR = 'monday';
export const payoutScheduleFor = (plan) =>
  plan === 'free' ? { interval: 'weekly', weekly_anchor: PAYOUT_WEEKLY_ANCHOR } : { interval: 'daily' };
export const payoutTag = (s) => (s.interval === 'weekly' ? `weekly:${s.weekly_anchor}` : 'daily');
/** What the Studio says under the Get-paid card. */
export const payoutLine = (tag) =>
  tag === 'daily' ? 'Paid out daily.' : 'Paid out every Monday — paid plans are paid out daily.';

async function planOfOwner(aid) {
  if (isVenueOwner(aid)) {
    const { venueById, venuePlanOf } = await import('./_venues.mjs');
    return venuePlanOf(await venueById(aid.slice(2)));
  }
  return (await planForArtist(aid)).plan;
}

/** Bring the account's payout schedule in line with the plan. Best-effort at every
 *  call site: a schedule that lags a day is not a broken gig. */
export async function syncPayoutSchedule(aid) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const c = await readConnect(aid);
  if (!c.acct) return { ok: true, payout: '' };
  const want = payoutScheduleFor(await planOfOwner(aid));
  const tag = payoutTag(want);
  if (c.payout === tag) return { ok: true, payout: tag, changed: false };
  try { await stripe.accounts.update(c.acct, { settings: { payouts: { schedule: want } } }); }
  catch (e) { await logErr('connect.payout', e, { aid }); return { ok: false, error: REFUSED }; }
  await mutateConnect(aid, (d) => { d.payout = tag; return true; });
  return { ok: true, payout: tag, changed: true };
}

/** A fresh onboarding link. They expire quickly, so this is generated on demand. */
export async function onboardingLink(aid, origin, back = '/studio') {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const c = await readConnect(aid);
  if (!c.acct) return { ok: false, error: 'no account yet' };
  try {
    const link = await stripe.accountLinks.create({
      account: c.acct,
      type: 'account_onboarding',
      refresh_url: `${origin}${back}?connect=retry`,
      return_url: `${origin}${back}?connect=done`,
    });
    return { ok: true, url: link.url };
  } catch (e) {
    await logErr('connect.link', e, { aid });
    return { ok: false, error: REFUSED };
  }
}

/** A link into Stripe's own dashboard for an Express account. */
export async function dashboardLink(aid) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const c = await readConnect(aid);
  if (!c.acct) return { ok: false, error: 'no account yet' };
  try {
    const l = await stripe.accounts.createLoginLink(c.acct);
    return { ok: true, url: l.url };
  } catch (e) {
    return { ok: false, error: e.message || 'could not open dashboard' };
  }
}

/* ---------- who Stripe says this account belongs to ----------

   An Express account has been through Stripe's own identity checks: documents,
   liveness, the lot, done by a company that does it professionally and is regulated
   for it. The name that comes out the other side is a far stronger fact than
   anything MySet could squint at, so it is the thing worth comparing against.

   `individual.verification.status` is Stripe's verdict on the PERSON. A company
   account has no individual, so the business name is used instead and the caller is
   told which it was — a business name matching a stage name proves less, and should
   not carry the same weight. */
export async function accountIdentity(aid) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const c = await readConnect(aid);
  if (!c.acct) return { ok: false, error: 'no account yet' };
  let a;
  try { a = await stripe.accounts.retrieve(c.acct); }
  catch (e) { return { ok: false, error: e.message || 'could not read account' }; }

  const ind = a.individual || null;
  const person = ind ? [ind.first_name, ind.last_name].filter(Boolean).join(' ').trim() : '';
  const business = (a.business_profile && a.business_profile.name)
    || (a.company && a.company.name) || '';
  /* The DOB Stripe holds after its own checks. A second independent fact about the
     same person, which is what turns a name match from "plausible" into "checked" —
     and it is the fact a stage name cannot fake. */
  const dob = (ind && ind.dob && ind.dob.year) ? {
    day: Number(ind.dob.day) || 0,
    month: Number(ind.dob.month) || 0,
    year: Number(ind.dob.year) || 0,
  } : null;
  return {
    ok: true,
    kind: person ? 'individual' : (business ? 'business' : 'none'),
    name: person || business || '',
    dob,
    /* Stripe's own answer about the human, not about the account being able to take
       money. An account can have charges_enabled while its identity check is still
       pending, so these are two different questions and both get asked. */
    idVerified: !!(ind && ind.verification && ind.verification.status === 'verified'),
    verificationStatus: (ind && ind.verification && ind.verification.status) || 'unknown',
    chargesEnabled: !!a.charges_enabled,
    payoutsEnabled: !!a.payouts_enabled,
    country: a.country || '',
  };
}

/* ---------- status, and mirroring it where the hot path can see it ----------
   `canTakeMoney` is read on EVERY audience poll. It must not cost a blob read, so
   the answer is mirrored onto the show record — which every one of those callers
   has already loaded. Stripe remains the authority; this is a cache with one
   writer. */
export async function syncFromStripe(aid) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const c = await readConnect(aid);
  if (!c.acct) return { ok: true, connect: c };
  let a;
  try { a = await stripe.accounts.retrieve(c.acct); }
  catch (e) { return { ok: false, error: e.message || 'could not read account' }; }
  const next = {
    chargesEnabled: !!a.charges_enabled,
    payoutsEnabled: !!a.payouts_enabled,
    detailsSubmitted: !!a.details_submitted,
    country: a.country || '',
  };
  await mutateConnect(aid, (d) => { Object.assign(d, next, { at: Date.now() }); return true; });
  await mirrorToShow(aid, { ...c, ...next });
  await indexAccount(c.acct, aid);
  await syncPayoutSchedule(aid).catch(() => {});
  return { ok: true, connect: { ...c, ...next } };
}

/** The one writer of `show.pay` (artist) or `vprofile.pay` (venue). Keep the shape
 *  tiny — the artist's rides on every poll. */
export async function mirrorToShow(owner, c) {
  const ready = connectUsable(c);
  if (isVenueOwner(owner)) {
    const { mutateVenueProfile } = await import('./_venues.mjs');
    await mutateVenueProfile(owner.slice(2), (p) => {
      const was = p.pay || {};
      if (!!was.ready === ready && was.acct === (c.acct || '')) return false;
      p.pay = { ready, acct: c.acct || '' };
      return true;
    }).catch(() => {});
    return;
  }
  await mutateShow(owner, (sh) => {
    const was = sh.pay || {};
    if (!!was.ready === ready && was.acct === (c.acct || '')) return false;
    sh.pay = { ready, acct: c.acct || '' };
    return true;
  }).catch(() => {});
}

/** Everything the Studio needs to draw the Get-paid card, including the honest
 *  note about who pays Stripe's own fee. */
export async function connectStatus(aid) {
  const c = await readConnect(aid);
  const kind = isVenueOwner(aid) ? 'venue' : 'artist';
  const plan = await planOfOwner(aid);
  const payout = c.acct ? (c.payout || payoutTag(payoutScheduleFor(plan))) : '';
  /* The platform-owner account is deliberately exempt even if it later connects
     a payout account. Keep the customer-facing number identical to the charge. */
  const cut = isPlatformOwner(aid) ? 0 : cutOf(plan, kind);
  const split = !!planRow(plan, kind).splitFee;
  return {
    kind, splitFee: split,
    acct: c.acct ? c.acct.slice(0, 8) + '…' : '',     // never the whole id to a client
    started: !!c.acct,
    detailsSubmitted: !!c.detailsSubmitted,
    chargesEnabled: !!c.chargesEnabled,
    payoutsEnabled: !!c.payoutsEnabled,
    ready: connectUsable(c),
    country: c.country || '',
    plan,
    cutPct: Math.round(cut * 1000) / 10,
    payout, payoutLine: payout ? payoutLine(payout) : '',
    /* Not decoration. An artist who reads "10%" and then sees a $5 pack land as
       ~$4.05 will think they have been lied to. Direct charges put Stripe's fee on
       them, and they should hear it from us first. */
    stripeFeeNote: split
      ? 'Stripe’s own card fee (about 2.9% + 30¢) is shared: MySet’s fee is reduced by half of it, estimated at checkout. The payment is yours, so Stripe takes its fee from your side.'
      : 'Stripe’s own card fee (about 2.9% + 30¢) comes out of your side too, because the payment is yours.',
    /* The founder's own account predates Connect and charges on the platform
       account, so the Studio should not nag him to onboard. */
    platformOwner: isPlatformOwner(aid),
  };
}
