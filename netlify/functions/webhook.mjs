import Stripe from 'stripe';
import { json, bad, cleanArtistId, DEFAULT_ARTIST } from './_lib.mjs';
import { redeemSession } from './_pay.mjs';
import { artistForAccount, mutateConnect, mirrorToShow, readConnect } from './_connect.mjs';

/* The safety net. /api/confirm only runs if the buyer's browser makes it back to
   the site — on 2026-08-30 one didn't, and a $3 purchase was charged and never
   granted. Stripe calls this regardless of what the buyer's phone does.
   Requires STRIPE_WEBHOOK_SECRET; absent, this is inert and the return page and
   the artist's reconcile sweep still cover it. */
export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return bad('webhook-not-configured', 503);

  const sig = req.headers.get('stripe-signature');
  if (!sig) return bad('no signature', 400);

  const raw = await req.text();          // raw body — signature is over the bytes
  const stripe = new Stripe(key);
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch {
    return bad('bad signature', 400);    // never trust an unsigned payload
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
      const { tryAutoVerify } = await import('./_verify.mjs');
      await tryAutoVerify(who).catch(() => {});
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
    // redeemSession is replay-safe, so a webhook retry racing the return page is fine
    if (session && session.payment_status === 'paid') {
      const aid = cleanArtistId((session.metadata || {}).artist)
                  || (event.account ? await artistForAccount(event.account) : '')
                  || DEFAULT_ARTIST;
      try { await redeemSession(aid, session); } catch { /* Stripe will retry */ }
    }
  }
  return json({ received: true });       // 200 so Stripe stops retrying
};
