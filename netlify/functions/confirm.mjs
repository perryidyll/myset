import Stripe from 'stripe';
import { json, bad, cleanFanId } from './_lib.mjs';
import { redeemSession } from './_pay.mjs';

/* The fast path: the buyer lands back on /vote.html?paid=<session id> and this
   verifies the payment with Stripe server-side, then grants. The webhook and the
   artist's reconcile sweep are the safety nets for when the buyer never returns. */
export default async (req) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return bad('payments-not-configured', 503);

  const url = new URL(req.url);
  const sessionId = (url.searchParams.get('session_id') || '').slice(0, 120);
  const fallbackFan = cleanFanId(url.searchParams.get('fan'));
  if (!sessionId) return bad('missing session_id');

  let session;
  try { session = await new Stripe(key).checkout.sessions.retrieve(sessionId); }
  catch { return bad('could not verify payment', 502); }
  if (session.payment_status !== 'paid') return bad('not paid', 402);

  const r = await redeemSession(session, fallbackFan);
  if (!r.ok) return bad(r.error || 'could not grant', 409);
  return json(r);
};
