import { guard } from './_errlog.mjs';
import Stripe from 'stripe';
import { json, bad, cleanFanId, cleanArtistId, DEFAULT_ARTIST } from './_lib.mjs';
import { redeemSession } from './_pay.mjs';
import { stripeFor } from './_connect.mjs';

/* The fast path: the buyer lands back on /vote.html?paid=<session id> and this
   verifies the payment with Stripe server-side, then grants. The webhook and the
   artist's reconcile sweep are the safety nets for when the buyer never returns. */
const main = async (req) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return bad('payments-not-configured', 503);

  const url = new URL(req.url);
  const sessionId = (url.searchParams.get('session_id') || '').slice(0, 120);
  const fallbackFan = cleanFanId(url.searchParams.get('fan'));
  if (!sessionId) return bad('missing session_id');

  /* WHICH ACCOUNT to look on. A session created on a connected account (a direct
     charge) does not exist on the platform account, so retrieving without
     `stripeAccount` returns "no such session" and the buyer gets nothing — the exact
     2026-08-30 failure with a new cause. The artist is in the query string because
     the voting page knows it; the metadata is still what decides whose money it is. */
  /* `?a=` is a SLUG, not an id — vote.html builds it from the page address, and
     every other public endpoint resolves it with publicArtist(). Treating it as an
     id meant the hint missed for any artist whose slug differs from their id, which
     includes anyone who has renamed their page AND the founder himself
     (perryidyll vs perry-idyll) — so the session could not be retrieved and the
     buyer got nothing. */
  const { publicArtist } = await import('./_lib.mjs');
  let hinted = await publicArtist(req);
  const vq = url.searchParams.get('v');
  if (vq) {
    const { venueBySlug } = await import('./_venues.mjs');
    const { cleanSlug } = await import('./_auth.mjs');
    const vid = await venueBySlug(cleanSlug(vq));
    hinted = vid ? `v_${vid}` : hinted;
  }
  let session = null, sessionStripe = null, sessionOpts = {};
  for (const who of [hinted, DEFAULT_ARTIST].filter((v, i, a) => v && a.indexOf(v) === i)) {
    const { stripe, opts } = await stripeFor(who);
    if (!stripe) break;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, opts);
      sessionStripe = stripe; sessionOpts = opts; break;
    }
    catch { /* try the next scope */ }
  }
  /* Last resort: the platform account plainly, which is where the founder's own
     charges live and where anything created before Connect still is. */
  if (!session) {
    try {
      sessionStripe = new Stripe(key); sessionOpts = {};
      session = await sessionStripe.checkout.sessions.retrieve(sessionId);
    }
    catch { return bad('could not verify payment', 502); }
  }

  // whose money this is was decided when the session was created, not now
  const aid = cleanArtistId((session.metadata || {}).artist) || DEFAULT_ARTIST;
  if ((session.metadata || {}).kind === 'request_hold') {
    const { authorizeRequestSession } = await import('./_requests.mjs');
    const held = await authorizeRequestSession(
      aid, session, fallbackFan, sessionStripe, sessionOpts);
    if (!held.ok) return bad(held.error || 'could not authorize request', held.status || 409);
    return json(held);
  }
  if (session.payment_status !== 'paid') return bad('not paid', 402);

  const r = await redeemSession(aid, session, fallbackFan);
  if (!r.ok) return bad(r.error || 'could not grant', 409);
  return json(r);
};
export default guard('confirm', main);
