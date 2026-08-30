import Stripe from 'stripe';
import { json, bad, checkAdmin, readMeta } from './_lib.mjs';
import { redeemSession } from './_pay.mjs';

/* Artist-only. Stripe is the source of truth for money; the app's own ledger can
   only ever be a cache of it. GET lists what Stripe actually charged and flags
   anything the app failed to grant. POST redeems those, so a payment can never be
   silently kept without the buyer getting what they bought. */
export default async (req) => {
  if (!(await checkAdmin(req))) return bad('unauthorized', 401);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ ok: true, enabled: false, payments: [], unredeemed: 0 });

  const stripe = new Stripe(key);
  let sessions = [];
  try {
    const r = await stripe.checkout.sessions.list({ limit: 100 });
    sessions = r.data || [];
  } catch (e) {
    return bad('could not reach Stripe', 502);
  }

  // ONLY sessions this app created. Perry's Stripe account also holds unrelated
  // charges; showing those in his MySet dashboard would be wrong, and sweeping
  // them would pollute the ledger with payments MySet never sold.
  const isOurs = (s) => {
    const k = (s.metadata || {}).kind;
    return k === 'votes' || k === 'tip';
  };
  const paidSessions = sessions.filter((s) => s.payment_status === 'paid' && isOurs(s));

  if (req.method === 'POST') {
    const results = [];
    for (const s of paidSessions) {
      const r = await redeemSession(s);
      if (r.ok && !r.already) results.push({ id: s.id, kind: r.kind, amount: r.amount, granted: r.granted });
    }
    return json({ ok: true, recovered: results.length, results });
  }

  const meta = await readMeta();
  const payments = paidSessions.map((s) => {
    const md = s.metadata || {};
    return {
      id: s.id,
      at: (s.created || 0) * 1000,
      amount: (s.amount_total || 0) / 100,
      currency: (s.currency || 'usd').toUpperCase(),
      kind: md.kind || 'unknown',
      votes: parseInt(md.votes, 10) || 0,
      fan: md.fan || '',
      note: md.note || '',
      email: (s.customer_details && s.customer_details.email) || '',
      redeemed: !!meta.paid[s.id],
    };
  }).sort((a, b) => b.at - a.at);

  const sum = (f) => Math.round(payments.filter(f).reduce((a, p) => a + p.amount, 0) * 100) / 100;
  return json({
    ok: true,
    enabled: true,
    payments,
    unredeemed: payments.filter((p) => !p.redeemed).length,
    totals: {
      all: sum(() => true),
      tips: sum((p) => p.kind === 'tip'),
      votes: sum((p) => p.kind === 'votes'),
      count: payments.length,
    },
  });
};
