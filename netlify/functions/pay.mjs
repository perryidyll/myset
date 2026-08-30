import Stripe from 'stripe';
import { json, bad, cleanFanId, getShow } from './_lib.mjs';

export const VOTE_PACKS = {
  small: { votes: 5, cents: 300, label: '5 extra votes' },
  big:   { votes: 15, cents: 700, label: '15 extra votes' },
};

export default async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return bad('payments-not-configured', 503);

  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }

  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');

  const show = await getShow();
  const artist = show.artist || 'the artist';
  const origin = new URL(req.url).origin;
  const stripe = new Stripe(key);

  let line, metadata;
  if (body.kind === 'votes') {
    const pack = VOTE_PACKS[body.pack];
    if (!pack) return bad('unknown pack');
    line = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: pack.cents,
        product_data: { name: `${pack.label} — ${artist}`, description: 'Extra votes for tonight’s setlist' },
      },
    };
    metadata = { fan, kind: 'votes', votes: String(pack.votes) };
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
    metadata = { fan, kind: 'tip', note: String(body.note || '').slice(0, 120) };
  } else {
    return bad('unknown kind');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [line],
      metadata,
      // MUST be the page that calls /api/confirm — only vote.html redeems the session
      success_url: `${origin}/vote.html?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vote.html?cancelled=1`,
    });
    return json({ ok: true, url: session.url });
  } catch (e) {
    return bad(e.message || 'stripe error', 502);
  }
};
