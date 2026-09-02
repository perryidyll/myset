import Stripe from 'stripe';
import { casDoc, readDoc, mutateShow } from './_lib.mjs';
import { planForArtist, PLANS, isPlatformOwner } from './_plan.mjs';

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
   vote pack a Plus artist pays roughly 45c to Stripe and 10c to MySet. "2% to
   MySet" is therefore not the same as "you keep 98%", and the Studio copy has to
   say so rather than let an artist discover it from a payout.

   ONE MORE THING THAT BITES: a session created on a connected account can only be
   RETRIEVED with that same account in scope. `stripeFor(aid)` exists so the return
   page, the webhook and the reconcile sweep all retrieve the same way and none of
   them can drift into looking on the platform account and finding nothing. */

const CK = (aid) => `connect_${aid}`;
const ACCT_INDEX = 'acctindex';          // acct_xxx -> artistId, for webhooks

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
   pricing page cannot drift from what is charged. Perry set these:
     free  10%   ·   plus ($10/mo)  2%   ·   pro ($20/mo)  0% */
export const cutOf = (plan) => {
  const p = PLANS[plan] || PLANS.free;
  const c = Number(p.cut);
  return Number.isFinite(c) && c > 0 ? c : 0;
};
/** The fee in cents. Rounded down, so MySet never takes more than its stated share. */
export const feeCents = (amountCents, plan) => {
  const cut = cutOf(plan);
  if (!cut) return 0;
  return Math.max(0, Math.min(amountCents, Math.floor(amountCents * cut)));
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
export async function ensureAccount(aid, email, country) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const existing = await readConnect(aid);
  if (existing.acct) return { ok: true, acct: existing.acct, existing: true };

  let acct;
  try {
    acct = await stripe.accounts.create({
      type: 'express',
      email: email || undefined,
      country: country || undefined,
      business_type: 'individual',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      /* The fee is taken from the artist's balance, so the artist is the one who
         pays Stripe's processing fee too. Said out loud in the Studio. */
      settings: { payouts: { schedule: { interval: 'daily' } } },
      metadata: { myset_artist: aid },
    });
  } catch (e) {
    return { ok: false, error: e.message || 'could not create account' };
  }
  await mutateConnect(aid, (c) => { c.acct = acct.id; c.at = Date.now(); return true; });
  await indexAccount(acct.id, aid);
  return { ok: true, acct: acct.id };
}

/** A fresh onboarding link. They expire quickly, so this is generated on demand. */
export async function onboardingLink(aid, origin) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const c = await readConnect(aid);
  if (!c.acct) return { ok: false, error: 'no account yet' };
  try {
    const link = await stripe.accountLinks.create({
      account: c.acct,
      type: 'account_onboarding',
      refresh_url: `${origin}/studio?connect=retry`,
      return_url: `${origin}/studio?connect=done`,
    });
    return { ok: true, url: link.url };
  } catch (e) {
    return { ok: false, error: e.message || 'could not start onboarding' };
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
  return { ok: true, connect: { ...c, ...next } };
}

/** The one writer of `show.pay`. Keep the shape tiny — it rides on every poll. */
export async function mirrorToShow(aid, c) {
  const ready = connectUsable(c);
  await mutateShow(aid, (sh) => {
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
  const { plan } = await planForArtist(aid);
  const cut = cutOf(plan);
  return {
    acct: c.acct ? c.acct.slice(0, 8) + '…' : '',     // never the whole id to a client
    started: !!c.acct,
    detailsSubmitted: !!c.detailsSubmitted,
    chargesEnabled: !!c.chargesEnabled,
    payoutsEnabled: !!c.payoutsEnabled,
    ready: connectUsable(c),
    country: c.country || '',
    plan,
    cutPct: Math.round(cut * 1000) / 10,
    /* Not decoration. An artist who reads "2%" and then sees a $5 pack land as
       ~$4.45 will think they have been lied to. Direct charges put Stripe's fee on
       them, and they should hear it from us first. */
    stripeFeeNote: 'Stripe’s own card fee (about 2.9% + 30¢) comes out of your side too, because the payment is yours.',
    /* The founder's own account predates Connect and charges on the platform
       account, so the Studio should not nag him to onboard. */
    platformOwner: isPlatformOwner(aid),
  };
}
