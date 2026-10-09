import { guard } from './_errlog.mjs';
import Stripe from 'stripe';
import { json, bad, DEFAULT_ARTIST } from './_lib.mjs';
import { redeemSession, cleanOwnerId, noteOwed } from './_pay.mjs';
import { artistForAccount, mutateConnect, mirrorToShow, readConnect } from './_connect.mjs';

/* The safety net. /api/confirm only runs if the buyer's browser makes it back to
   the site — on 2026-08-30 one didn't, and a $3 purchase was charged and never
   granted. Stripe calls this regardless of what the buyer's phone does.
   Requires STRIPE_WEBHOOK_SECRET; absent, this is inert and the return page and
   the artist's reconcile sweep still cover it.

   TWO SECRETS, ONE URL. Stripe will not send a connected account's events to an
   endpoint scoped to "your account" — `account.updated`, `charge.updated` and a
   fan's `checkout.session.completed` on an artist's account all need a second
   endpoint scoped to "connected accounts", and every endpoint signs with its own
   secret. Until 2026-09-12 this function knew one secret, so the Connect half of
   the events below could never have arrived (decision 0058). Both endpoints point
   here; the signature is tried against each secret that is set, in order. */
export const webhookSecrets = () =>
  [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .map((s) => String(s || '').trim()).filter(Boolean);

/** The event, verified against whichever configured secret signed it — or null. */
export async function constructSigned(stripe, raw, sig, secrets) {
  for (const secret of secrets) {
    try { return await stripe.webhooks.constructEventAsync(raw, sig, secret); }
    catch { /* not this endpoint's secret — try the next */ }
  }
  return null;
}

const main = async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  const key = process.env.STRIPE_SECRET_KEY;
  const secrets = webhookSecrets();
  if (!key || !secrets.length) return bad('webhook-not-configured', 503);

  const sig = req.headers.get('stripe-signature');
  if (!sig) return bad('no signature', 400);

  const raw = await req.text();          // raw body — signature is over the bytes
  const stripe = new Stripe(key);
  const event = await constructSigned(stripe, raw, sig, secrets);
  if (!event) return bad('bad signature', 400);    // never trust an unsigned payload

  /* THE EXACT HALF OF STRIPE'S CARD FEE, once Stripe knows what it actually was.
     `event.account` is present only on a Connect event, which is exactly the
     charges this applies to. Never throws — the webhook always answers 200, or
     Stripe starts retrying an event that will never succeed. See _feesplit.mjs. */
  if (event.type === 'charge.updated' && event.account) {
    const owner = await artistForAccount(event.account);
    const ch = event.data.object || {};
    if (owner && ch.balance_transaction) {
      const { settleSplit } = await import('./_feesplit.mjs');
      await settleSplit(owner, event.account, ch).catch((e) => console.error('feesplit:', e && e.message));
    }
    return json({ received: true });
  }

  /* MONEY THAT WENT BACK (decision 0177): a refund, or a chargeback opening, moving
     or being decided — on the platform's own charges and, through the Connect
     endpoint, on every artist's and venue's. The payment's marker and its row say
     what went back, the fan's unspent wallet votes from it are taken back, and the
     artist is told once. Not caught (0138): a throw answers 500 and Stripe sends the
     event again; every step is safe to repeat. See _refunds.mjs. */
  if (event.type === 'charge.refunded' || String(event.type || '').startsWith('charge.dispute.')) {
    const { settleLoss } = await import('./_refunds.mjs');
    await settleLoss(event);
    return json({ received: true });
  }

  /* An account finished (or lost) onboarding. This is the ONE writer that flips a
     room's money buttons on, so it also mirrors the answer onto the show record
     where the audience poll can read it for free. */
  if (event.type === 'account.updated') {
    const a = event.data.object || {};
    const who = await artistForAccount(a.id);
    if (who) {
      await mutateConnect(who, (c) => {
        c.chargesEnabled = !!a.charges_enabled;
        c.payoutsEnabled = !!a.payouts_enabled;
        c.detailsSubmitted = !!a.details_submitted;
        c.country = a.country || c.country || '';
        c.at = Date.now();
        return true;
      }).catch(() => {});
      await mirrorToShow(who, await readConnect(who));
      /* The most likely moment of all: Stripe has just finished checking who they
         are. Try the tick now rather than waiting for the artist to come looking. */
      if (!String(who).startsWith('v_')) {
        const { tryAutoVerify } = await import('./_verify.mjs');
        await tryAutoVerify(who).catch(() => {});
      }
    }
    return json({ received: true });
  }

  /* Subscriptions (Plus / Pro / venue Pro) — see _billing.mjs. A subscription-mode
     checkout is billing, not a purchase to redeem. */
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted'
      || event.type === 'invoice.payment_failed'
      || (event.type === 'checkout.session.completed' && (event.data.object || {}).mode === 'subscription')) {
    const { handleBillingEvent } = await import('./_billing.mjs');
    /* Not caught (decision 0138): a throw reaches guard(), which logs it and answers
       500 — the only answer that makes Stripe send the event again. This used to
       be swallowed under a comment that said "Stripe will retry", and then answered
       200, so it never did. The handler only re-reads the subscription from Stripe,
       so a redelivery is safe. */
    await handleBillingEvent(event);
    return json({ received: true });
  }

  /* A MERCH CHECKOUT THAT RAN OUT (decision 0178) lets its stock go now rather than
     when the hold's own clock runs out a few minutes later. Only a nicety: a hold
     past its checkout's expiry stops counting whether or not this ever arrives. */
  if (event.type === 'checkout.session.expired') {
    const s = event.data.object || {}, md = s.metadata || {};
    if (md.kind === 'merch' && md.hold) {
      const owner = cleanOwnerId(md.artist) || (event.account ? await artistForAccount(event.account) : '') || DEFAULT_ARTIST;
      const { releaseHold } = await import('./_profile.mjs');
      await releaseHold(owner, String(md.hold));
    }
    return json({ received: true });
  }

  if (event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded') {
    let session = event.data.object;
    /* `event.account` is present on a Connect event, and it is the only way to know
        the session lives on somebody else's account rather than the platform's. */
    const evOpts = event.account ? { stripeAccount: event.account } : {};
    if (session.payment_status !== 'paid') {
      try { session = await stripe.checkout.sessions.retrieve(session.id, evOpts); } catch { session = null; }
    }
    /* A song-request offer is deliberately NOT paid here. Checkout has authorized
       it for manual capture; create the request now, then the artist's later
       play-completion action is the only code allowed to capture it. */
    if (session && (session.metadata || {}).kind === 'request_hold') {
      const aid = cleanOwnerId((session.metadata || {}).artist)
                  || (event.account ? await artistForAccount(event.account) : '')
                  || DEFAULT_ARTIST;
      try {
        const { authorizeRequestSession } = await import('./_requests.mjs');
        await authorizeRequestSession(aid, session, '', stripe, evOpts);
      } catch (e) { console.error('request authorization failed', e && e.message); }
      return json({ received: true });
    }
    /* A PROMOTED GIG IS NOT A FAN BUYING SOMETHING, so it does not go through
       redeemSession — which knows about votes, tips and merch and would write a
       claim marker for a kind it cannot grant. Same replay-safety, its own path. */
    if (session && session.payment_status === 'paid'
        && (session.metadata || {}).kind === 'feature') {
      try {
        const { settleFeature } = await import('./_featured.mjs');
        const { localDate } = await import('./_time.mjs');
        await settleFeature(stripe, session, { today: localDate(Date.now(), 'UTC') });
      } catch (e) { console.error('feature settle failed', e && e.message); }
      return json({ received: true });
    }
    // redeemSession is replay-safe, so a webhook retry racing the return page is fine
    if (session && session.payment_status === 'paid') {
      const aid = cleanOwnerId((session.metadata || {}).artist)
                  || (event.account ? await artistForAccount(event.account) : '')
                  || DEFAULT_ARTIST;
      /* A GRANT THAT FAILED IS STILL OWED (decision 0138). This caught the failure
         and fell through to the 200 below, so Stripe was told "received" for a
         payment whose votes never landed and did not come back. Now the session is
         written down for the bell to retry within minutes (noteOwed), and the throw
         goes on to guard(), which logs it and answers 500 so Stripe redelivers too.
         Both are safe to race: redeemSession claims the session before it grants. */
      try { await redeemSession(aid, session); }
      catch (e) {
        await noteOwed(aid, session.id, event.account || '').catch(() => {});
        throw e;
      }
    }
  }
  return json({ received: true });       // 200: handled, or not ours to handle
};
export default guard('webhook', main);
