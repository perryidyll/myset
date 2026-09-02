import Stripe from 'stripe';
import { json, bad, cleanFanId, getShow, publicArtist, sha } from './_lib.mjs';
import { canTakeMoney } from './_pay.mjs';
import { readConnect, connectUsable, feeCents } from './_connect.mjs';
import { planForArtist } from './_plan.mjs';

/** What this checkout is worth, in cents — the base the platform fee comes off. */
const amountCents = (line) =>
  Number(((line || {}).price_data || {}).unit_amount) * Number((line || {}).quantity || 1) || 0;

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return bad('payments-not-configured', 503);

  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');

  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  /* Not this artist's money to take yet — see canTakeMoney in _pay.mjs. The page
     should never have offered the button, so this is the backstop, not the UI. */
  const show = await getShow(aid);
  if (!canTakeMoney(aid, show)) return bad('payments-not-configured', 503);
  const artist = show.artist || 'the artist';
  const origin = new URL(req.url).origin;
  const stripe = new Stripe(key);

  let line, metadata;
  if (body.kind === 'votes') {
    // price is whatever the artist set — never what the client claims
    const pack = show.packs && show.packs[body.pack];
    if (!pack) return bad('unknown pack');
    line = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: pack.cents,
        product_data: {
          name: `${pack.votes} extra votes — ${artist}`,
          description: 'Extra votes for tonight’s setlist',
        },
      },
    };
    metadata = { fan, kind: 'votes', votes: String(pack.votes), pack: String(body.pack),
                 show: show.showId || '', artist: aid };
  } else if (body.kind === 'tip') {
    const cents = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(cents) || cents < 100 || cents > 50000)
      return bad('Tip must be between $1 and $500');
    line = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: cents,
        product_data: { name: `Tip for ${artist}`, description: 'Thanks for the music' },
      },
    };
    metadata = { fan, kind: 'tip', note: String(body.note || '').slice(0, 120),
                 show: show.showId || '', artist: aid };
  } else {
    return bad('unknown kind');
  }

  /* One tap, one Checkout Session, however many times the request is retried.
     The client mints `attempt` per TAP, so a retry of the same tap reuses the
     session while a deliberate second purchase gets a new one.

     Worth being honest about what this does and does not buy us. It is NOT what
     stops a double charge — an abandoned session is never charged, and the money
     path is already replay-safe through redeemSession (INVARIANT 7). It stops
     duplicate session objects, and it is the habit that matters the moment we
     ever create a charge or a refund server-side, where a retry DOES cost money.
     No attempt id (an older cached page) means no key, rather than a made-up one
     that could collide with somebody else's purchase. */
  const attempt = String(body.attempt || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  /* DIRECT CHARGE, when this artist has their own connected account: the session is
     created ON that account, so the money is theirs and MySet's share is an explicit
     application fee. Without one, this is the founder's own platform account and
     behaves exactly as before. `stripeAccount` must also be in scope to RETRIEVE the
     session later — see stripeFor() in _connect.mjs. */
  const conn = await readConnect(aid);
  const direct = connectUsable(conn);
  const opts = {
    ...(attempt
      ? { idempotencyKey: sha(`myset-pay|${aid}|${fan}|${body.kind}|${attempt}`).slice(0, 48) }
      : {}),
    ...(direct ? { stripeAccount: conn.acct } : {}),
  };

  /* The platform's share, from the plan table so there is one definition of the cut
     (10% free / 2% Plus / 0% Pro). Zero is omitted rather than sent as 0 — an
     application fee of nothing is not a fee. Never applied to the founder's own
     platform charges, where there is nobody to take a fee from. */
  const { plan } = await planForArtist(aid);
  const fee = direct ? feeCents(amountCents(line), plan) : 0;

  /* Back to the page they came from, not to the founding artist's. success_url
     hard-coded /vote.html, which drops the slug — so every registered artist's
     paying fan landed on Perry's voting page, was written into HIS fan store, and
     could vote in his live tally from a room they were not in. INVARIANT 5b still
     holds: /:slug/vote serves vote.html, which is what calls /api/confirm. */
  const { artistById } = await import('./_auth.mjs');
  const who = await artistById(aid);
  const back = who && who.slug ? `/${who.slug}/vote` : '/vote.html';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [line],
      metadata,
      ...(fee > 0 ? { payment_intent_data: { application_fee_amount: fee } } : {}),
      // MUST be the page that calls /api/confirm — only vote.html redeems the session
      success_url: `${origin}${back}?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${back}?cancelled=1`,
    }, opts);
    // the id goes back so the buyer's phone can re-try redemption if the
    // return trip fails (INVARIANT 5c)
    return json({ ok: true, url: session.url, id: session.id });
  } catch (e) {
    return bad(e.message || 'stripe error', 502);
  }
};
