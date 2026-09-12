import Stripe from 'stripe';
import { casDoc, readDoc } from './_lib.mjs';
import { readArtists, mutateArtists } from './_auth.mjs';
import { PLANS, planOf } from './_plan.mjs';

/* BILLING — Plus and Pro as Stripe subscriptions.

   Until 2026-09-04 a plan was set by a promo code or by Perry's hand, and the
   Studio's plan cards led nowhere. This is the missing half: Stripe Billing on the
   PLATFORM account (the artist pays MySet — this is MySet's own product, unlike a
   tip, which is the artist's), Stripe Checkout to start, Stripe's Customer Portal
   for cards and invoices, and webhooks to keep the registry honest.

   The shape, copied from how subscription products that work actually do it:
     · one Product per tier, one recurring Price each, found by LOOKUP KEY and created
       on first use — so nothing has to be clicked in the Stripe dashboard and a
       fresh Stripe account works the first time
     · the registry's `plan` / `planUntil` stay the ONLY thing the app reads — billing
       writes them, nothing else changes. A comped plan (promo code) and a paid plan
       look identical to every gate in the app
     · a Customer per owner, remembered, so the portal and invoices attach to one
       person; the owner id rides in metadata on the customer, the session and the
       subscription, so a webhook can always find its way home
     · upgrades are immediate with proration; a downgrade to a cheaper tier is
       immediate with proration; a downgrade to Free is "cancel at the end of the
       period you already paid for" — never a refund, never a cliff
     · the RETENTION offer Perry asked for: leaving Pro first asks "are you sure",
       then offers one month at 50% off. Accepting applies a one-time 50% coupon to
       the live subscription, so Stripe bills it — MySet does not keep a second
       ledger of what was promised. Offered once per owner, recorded on the billing
       doc, so it cannot be farmed
     · a promo code below 100% (recorded by redeemPromo as `discountPct`) becomes a
       coupon on the checkout, so the promise "saved for when billing opens" is kept

   Webhooks: `checkout.session.completed` (mode subscription),
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Perry has to tick those in the Stripe dashboard — and
   because he might not, the return trip from Checkout syncs the subscription
   itself, and `planGet` re-syncs a subscribed owner once every six hours (one
   Stripe call). Belt, braces.

   Venues: the same machinery with owner `v_<vid>`, one tier (Pro, $20). */

const BK = (owner) => `billing_${owner}`;
export const isVenueOwner = (o) => String(o || '').startsWith('v_');

/* Tier → lookup key → price. Amounts come from the plan tables so the pricing page,
   the Studio and Stripe cannot drift (0r0). */
export const TIERS = {
  artist: { plus: { key: 'myset_plus_monthly', name: 'MySet Bar Star', cents: PLANS.plus.price },
            pro:  { key: 'myset_pro_monthly',  name: 'MySet Rock Star',  cents: PLANS.pro.price } },
  venue:  { pro:  { key: 'myset_venue_pro_monthly', name: 'MySet Pro for venues', cents: 2000 } },
};
export const RETAIN_COUPON = 'myset_stay_50';
export const SYNC_EVERY_MS = 6 * 3600e3;

export const emptyBilling = () => ({ v: 1, customerId: '', subId: '', priceKey: '', status: '',
  currentPeriodEnd: 0, cancelAtPeriodEnd: false, retention: null, lastSyncAt: 0 });
export async function readBilling(owner) {
  const { data } = await readDoc(BK(owner), null);
  return { ...emptyBilling(), ...(data || {}) };
}
export const mutateBilling = (owner, fn) => casDoc(BK(owner), emptyBilling, fn);

const stripeClient = () => (process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null);

/* ---------- the registry, whichever kind of owner ---------- */
async function mutateOwner(owner, fn) {
  if (isVenueOwner(owner)) {
    const { mutateVenues } = await import('./_venues.mjs');
    return mutateVenues((reg) => { const r = reg.byId[owner.slice(2)]; return r ? fn(r) : false; });
  }
  return mutateArtists((reg) => { const r = reg.byId[owner]; return r ? fn(r) : false; });
}
async function readOwner(owner) {
  if (isVenueOwner(owner)) {
    const { readVenues } = await import('./_venues.mjs');
    return (await readVenues()).byId[owner.slice(2)] || null;
  }
  return (await readArtists()).byId[owner] || null;
}
const kindOf = (owner) => (isVenueOwner(owner) ? 'venue' : 'artist');

/* ---------- prices and coupons, created on first use ---------- */
const priceCache = {};
export async function ensurePrice(stripe, kind, plan) {
  const t = (TIERS[kind] || {})[plan];
  if (!t) return null;
  if (priceCache[t.key]) return priceCache[t.key];
  const found = await stripe.prices.list({ lookup_keys: [t.key], active: true, limit: 1 });
  let price = (found.data || [])[0] || null;
  if (!price) {
    const product = await stripe.products.create({ name: t.name, metadata: { myset_tier: `${kind}:${plan}` } });
    price = await stripe.prices.create({ product: product.id, currency: 'usd', unit_amount: t.cents,
      recurring: { interval: 'month' }, lookup_key: t.key, transfer_lookup_key: true });
  }
  priceCache[t.key] = price;
  return price;
}
export function planFromPriceKey(key) {
  for (const [kind, tiers] of Object.entries(TIERS))
    for (const [plan, t] of Object.entries(tiers)) if (t.key === key) return { kind, plan };
  return null;
}
async function ensureCoupon(stripe, id, percent) {
  try { return await stripe.coupons.retrieve(id); }
  catch { return stripe.coupons.create({ id, percent_off: percent, duration: 'once', name: `${percent}% off one month` }); }
}

/* ---------- a customer per owner ---------- */
async function ensureCustomer(stripe, owner, email, name) {
  const b = await readBilling(owner);
  if (b.customerId) return b.customerId;
  const c = await stripe.customers.create({ email: email || undefined, name: name || undefined,
    metadata: { myset_owner: owner, myset_kind: kindOf(owner) } });
  await mutateBilling(owner, (d) => { if (d.customerId) return false; d.customerId = c.id; return true; });
  return (await readBilling(owner)).customerId || c.id;
}

/* ---------- start: a Checkout Session in subscription mode ---------- */
export async function startCheckout({ owner, plan, email, name, origin, back }) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const kind = kindOf(owner);
  const price = await ensurePrice(stripe, kind, plan);
  if (!price) return { ok: false, error: 'unknown plan' };
  const rec = await readOwner(owner);
  if (!rec) return { ok: false, error: 'unknown account' };
  const b = await readBilling(owner);
  /* `unpaid` BELONGS IN THIS LIST. Without it, an artist whose card kept failing
     until Stripe gave up could run Checkout again and end up with TWO live
     subscriptions on one account, billed twice, with the registry pointing at
     whichever synced last. It does NOT belong in `paidStatus` below: an unpaid
     subscription is genuinely not paid, and pretending otherwise gives away the
     product. Two lists, two different questions. */
  if (b.subId && ['active', 'trialing', 'past_due', 'unpaid'].includes(b.status))
    return { ok: false, error: 'already-subscribed' };       // change the plan instead
  const customer = await ensureCustomer(stripe, owner, email, rec.name);
  const discounts = [];
  const pct = Number(rec.discountPct) || 0;
  if (pct > 0 && pct < 100) {
    const c = await ensureCoupon(stripe, `myset_promo_${pct}`, pct);
    discounts.push({ coupon: c.id });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: owner,
      metadata: { owner, plan, kind: 'sub' },
      subscription_data: { metadata: { owner, plan } },
      ...(discounts.length ? { discounts } : { allow_promotion_codes: true }),
      success_url: `${origin}${back}?sub=done&cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${back}?sub=cancelled`,
    });
    return { ok: true, url: session.url, id: session.id };
  } catch (e) {
    return { ok: false, error: e.message || 'stripe error' };
  }
}

/* ---------- sync: Stripe is the authority, the registry is the cache ---------- */
export async function syncSubscription(owner, subId) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const b = await readBilling(owner);
  const id = subId || b.subId;
  if (!id) return { ok: true, plan: null, none: true };
  let sub;
  try { sub = await stripe.subscriptions.retrieve(id); }
  catch (e) { return { ok: false, error: e.message || 'could not read subscription' }; }
  const item = ((sub.items || {}).data || [])[0] || {};
  const key = (item.price && item.price.lookup_key) || '';
  const tier = planFromPriceKey(key);
  const paidStatus = ['active', 'trialing', 'past_due'].includes(sub.status);
  const periodEnd = (sub.current_period_end || 0) * 1000;
  const now = Date.now();
  await mutateBilling(owner, (d) => {
    Object.assign(d, { subId: sub.id, priceKey: key, status: sub.status, currentPeriodEnd: periodEnd,
                       cancelAtPeriodEnd: !!sub.cancel_at_period_end, lastSyncAt: now,
                       customerId: d.customerId || (typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || '') });
    return true;
  });
  /* The registry: a paid subscription sets the plan until the end of the paid
     period plus three days of grace for a late card; anything else falls to free
     at the period end (a cancelled-at-period-end sub stays paid until then). */
  const plan = paidStatus && tier ? tier.plan : 'free';
  const until = paidStatus ? periodEnd + 3 * 86400000 : Math.max(periodEnd, 0);
  await mutateOwner(owner, (r) => {
    if (plan === 'free') {
      // keep a comp untouched — it was never Stripe's to take away
      if (r.compedBy && Number(r.planUntil) > now) return false;
      r.plan = 'free'; r.planUntil = until || null; r.billing = 'none';
    } else {
      r.plan = plan; r.planUntil = until; r.billing = 'stripe'; delete r.compedBy;
      if (r.discountPct) { delete r.discountPct; delete r.discountCode; delete r.pendingPlan; }
    }
    return true;
  });
  return { ok: true, plan, status: sub.status, periodEnd, cancelAtPeriodEnd: !!sub.cancel_at_period_end };
}

/** The return trip from Checkout — belt for a webhook that may not be configured. */
export async function finishCheckout(owner, csId) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  let s;
  try { s = await stripe.checkout.sessions.retrieve(String(csId || '').slice(0, 120)); }
  catch (e) { return { ok: false, error: 'could not verify' }; }
  if ((s.metadata || {}).owner !== owner) return { ok: false, error: 'not yours' };
  const subId = typeof s.subscription === 'string' ? s.subscription : (s.subscription && s.subscription.id);
  if (!subId) return { ok: false, error: 'no subscription on that session' };
  const { rewardReferrer } = await import('./_plan.mjs');
  const r = await syncSubscription(owner, subId);
  if (r.ok && r.plan !== 'free' && !isVenueOwner(owner)) await rewardReferrer(owner).catch(() => null);
  return r;
}

/** Re-sync a subscribed owner if it has been a while — called from planGet. */
export async function maybeSync(owner) {
  const b = await readBilling(owner);
  if (!b.subId) return null;
  if (Date.now() - (b.lastSyncAt || 0) < SYNC_EVERY_MS) return null;
  return syncSubscription(owner).catch(() => null);
}

/* ---------- change, leave, and the offer on the way out ---------- */
export async function changePlan(owner, plan) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const kind = kindOf(owner);
  const b = await readBilling(owner);
  if (!b.subId) return { ok: false, error: 'no-subscription' };
  let sub;
  try { sub = await stripe.subscriptions.retrieve(b.subId); } catch { return { ok: false, error: 'could not read subscription' }; }
  const item = ((sub.items || {}).data || [])[0];
  if (!item) return { ok: false, error: 'no-subscription' };
  try {
    if (plan === 'free') {
      // the month is paid for; they keep it, and nothing renews
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    } else {
      const price = await ensurePrice(stripe, kind, plan);
      if (!price) return { ok: false, error: 'unknown plan' };
      await stripe.subscriptions.update(sub.id, {
        cancel_at_period_end: false,
        items: [{ id: item.id, price: price.id }],
        proration_behavior: 'create_prorations',
        metadata: { owner, plan },
      });
    }
  } catch (e) { return { ok: false, error: e.message || 'stripe error' }; }
  return syncSubscription(owner, sub.id);
}

/** "We're sad to see you go — keep your plan for 50% off for one more month?" Once. */
export async function applyRetention(owner) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const b = await readBilling(owner);
  if (!b.subId) return { ok: false, error: 'no-subscription' };
  if (b.retention && b.retention.acceptedAt) return { ok: false, error: 'That offer has already been used.' };
  const coupon = await ensureCoupon(stripe, RETAIN_COUPON, 50);
  try {
    await stripe.subscriptions.update(b.subId, { cancel_at_period_end: false, coupon: coupon.id,
      metadata: { retention: String(Date.now()) } });
  } catch (e) { return { ok: false, error: e.message || 'stripe error' }; }
  await mutateBilling(owner, (d) => { d.retention = { ...(d.retention || {}), acceptedAt: Date.now(), coupon: coupon.id }; return true; });
  const r = await syncSubscription(owner, b.subId);
  return { ...r, retained: true };
}
export async function noteRetentionOffered(owner) {
  await mutateBilling(owner, (d) => { d.retention = { ...(d.retention || {}), offeredAt: Date.now() }; return true; }).catch(() => {});
}

/** Stripe's own portal: card, invoices, cancel. */
export async function portalLink(owner, origin, back) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const b = await readBilling(owner);
  if (!b.customerId) return { ok: false, error: 'no-billing' };
  try {
    /* Coming back marked, so the Studio can re-read Stripe on the spot. Without it
       `maybeSync` waits up to six hours, and somebody who has just fixed their card
       keeps being told their card did not go through. */
    const s = await stripe.billingPortal.sessions.create({ customer: b.customerId, return_url: `${origin}${back}?billing=back` });
    return { ok: true, url: s.url };
  } catch (e) { return { ok: false, error: e.message || 'stripe error' }; }
}

/** When an account is deleted: stop billing first, immediately. */
export async function cancelForDeletion(owner) {
  const stripe = stripeClient();
  const b = await readBilling(owner);
  if (stripe && b.subId) { try { await stripe.subscriptions.cancel(b.subId); } catch { /* best effort */ } }
  return true;
}

/** The receipts. Stripe keeps them; we just list them, and only when the Studio
 *  asks — never on a page load, because it is a network call to Stripe and the
 *  answer changes once a month. */
export async function invoices(owner, limit = 12) {
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: 'payments-not-configured' };
  const b = await readBilling(owner);
  if (!b.customerId) return { ok: true, list: [] };
  try {
    const r = await stripe.invoices.list({ customer: b.customerId, limit: Math.min(24, limit) });
    return { ok: true, list: (r.data || []).map((i) => ({
      id: i.id, number: i.number || '', status: i.status || '',
      total: i.total ?? i.amount_due ?? 0, paid: i.amount_paid || 0,
      currency: (i.currency || 'usd').toUpperCase(),
      at: (i.created || 0) * 1000,
      url: i.hosted_invoice_url || '', pdf: i.invoice_pdf || '',
    })) };
  } catch (e) { return { ok: false, error: e.message || 'stripe error' }; }
}

/** What the Studio shows. Never the raw ids. */
export async function billingStatus(owner) {
  const b = await readBilling(owner);
  /* THE CARD THAT DIDN'T GO THROUGH. Stripe marks the subscription `past_due` and
     retries on its own schedule; syncSubscription keeps the plan alive for the
     period end plus three days, so nothing is taken away while that is happening.
     What was missing is that nobody was TOLD. `graceUntil` is the date the Studio
     puts in the sentence, so the warning names a day rather than a threat. */
  const pastDue = b.status === 'past_due' || b.status === 'unpaid';
  return {
    subscribed: !!b.subId && ['active', 'trialing', 'past_due', 'unpaid'].includes(b.status),
    status: b.status || '',
    plan: (planFromPriceKey(b.priceKey) || {}).plan || null,
    renewsAt: b.currentPeriodEnd || null,
    cancelAtPeriodEnd: !!b.cancelAtPeriodEnd,
    retentionUsed: !!(b.retention && b.retention.acceptedAt),
    portal: !!b.customerId,
    pastDue,
    graceUntil: pastDue ? (b.currentPeriodEnd || 0) + 3 * 86400e3 : 0,
  };
}

/* ---------- the webhook's half ---------- */
export async function handleBillingEvent(event) {
  const obj = (event.data || {}).object || {};
  if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
    const owner = (obj.metadata || {}).owner || obj.client_reference_id;
    const subId = typeof obj.subscription === 'string' ? obj.subscription : (obj.subscription && obj.subscription.id);
    if (owner && subId) await syncSubscription(owner, subId).catch(() => {});
    return true;
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const owner = (obj.metadata || {}).owner;
    if (owner) await syncSubscription(owner, obj.id).catch(() => {});
    return true;
  }
  if (event.type === 'invoice.payment_failed') {
    const subId = typeof obj.subscription === 'string' ? obj.subscription : '';
    const owner = (obj.subscription_details && obj.subscription_details.metadata || {}).owner
               || (obj.metadata || {}).owner || '';
    if (owner && subId) await syncSubscription(owner, subId).catch(() => {});   // status → past_due; grace applies
    return true;
  }
  return false;
}
