/* WHAT ONE SHOW COST (EVS-004, an amendment to decision 0095)

   The dashboard's main table carries three cost columns after merch: the server, Stripe,
   and the two added up. Neither number is in the register, on purpose: the register is
   folded from the store and can read none of Netlify's meters (INVARIANT 0fx), and Stripe's
   real fee on a payment is not filed with the night. So this module prices each counted
   night from two things that ARE on file, and says which is which:

     · SERVER — the traffic credits the night added over an empty day, by Netlify's own
       per-day meters (finance/actuals.json meters.nights, written by tools/actuals.py from
       finance/credits.json). A night the meters were read for carries its own figure
       (`measured: true`); any other counted night carries the average of those nights.
       Credits become dollars at the auto-recharge pack's price on the plan in the latest
       reading: every credit past the month's grant is bought in that pack, so it is what
       one more night costs. Traffic only, never a deploy — a deploy is the shipping bill,
       the founder's, and never any show's (INVARIANT 0fx).
     · STRIPE — EXACT where the night's record carries Stripe's own fee (EVS-005: read off
       every payment's balance transaction when the night's money is asked, `stripeFees` on
       the row); a night filed before that is asked again by the register and carries an
       ESTIMATE until then, at the published card rates the money model uses (its P0.stripe:
       2.9% + 30¢, +1.5% on the 75% of money on cards from abroad — measured off the exact fees,
       EVS-006), 30¢ per payment. Merch is
       always the estimate: its orders are not in the night's payment list. A night whose
       room money Stripe never answered has no Stripe figure, never $0.

   Served beside the rows in shows.json; the register's own block stays meter-free. */

/* = finance/model.html P0.stripe (US account); test/everyshow.mjs holds the two equal */
export const STRIPE_RATES = { pct: 2.9, fixed: 0.30, intlShare: 75, intlPct: 1.5 };

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const sum = (xs) => xs.reduce((a, b) => a + (Number(b) || 0), 0);

export function costBlock(actuals, credits) {
  const reading = ((credits && credits.readings) || []).slice(-1)[0] || {};
  const plan = reading.plan || {};
  const pack = plan.pack || {};
  const m = (actuals && actuals.meters) || {};
  const byKey = {};
  for (const n of m.nights || []) if (n && n.key && Number.isFinite(n.creditsTraffic)) byKey[n.key] = n.creditsTraffic;
  const effPct = STRIPE_RATES.pct + (STRIPE_RATES.intlShare / 100) * STRIPE_RATES.intlPct;
  return {
    usdPerCredit: pack.credits ? round(pack.usd / pack.credits, 5) : null,
    plan: plan.name || null, pack: pack.credits ? { credits: pack.credits, usd: pack.usd } : null,
    creditsPerShow: Number.isFinite(m.creditsPerShow) ? m.creditsPerShow : (actuals && Number.isFinite(actuals.creditsPerShow) ? actuals.creditsPerShow : null),
    metersReadAt: m.readAt || null, measuredNights: Object.keys(byKey).length, byKey,
    stripe: { ...STRIPE_RATES, effectivePct: round(effPct, 3) },
  };
}

/** One row's costs, or null for a night that is not counted. */
export function costOf(row, B) {
  if (!row || !B || row.status !== 'counted') return null;
  const aid = (row.artist && row.artist.id) || row.artistId;
  const keys = (row.mergedFrom || [row.showId]).map((id) => `hist_${aid}_${id}`);
  const measured = keys.every((k) => B.byKey[k] != null);
  const credits = measured ? sum(keys.map((k) => B.byKey[k])) : B.creditsPerShow;
  const server = credits != null && B.usdPerCredit != null ? { usd: round(credits * B.usdPerCredit), credits: round(credits, 2), measured } : null;
  const m = row.money || {};
  let stripe = null;
  if (m.known) {
    const est = (vol, n) => vol * B.stripe.effectivePct / 100 + n * B.stripe.fixed;
    const roomN = (m.tips.count || 0) + (m.packs.count || 0) + (m.requests.count || 0);
    const merchN = (m.merch && m.merch.orders) || 0, merchUsd = (m.merch && m.merch.amount) || 0;
    const exact = Number.isFinite(m.stripeFees);
    const room = exact ? m.stripeFees : est(m.total || 0, roomN);
    stripe = { usd: round(room + (merchN ? est(merchUsd, merchN) : 0)), payments: roomN + merchN, volume: round((m.total || 0) + merchUsd, 2),
               estimate: !exact || merchN > 0, exact };
  }
  return { server, stripe, total: server && stripe ? round(server.usd + stripe.usd) : null };
}

/** The view, each row priced, and the block that says how. */
export function withCosts(view, B) {
  return { ...view, costs: B ? { ...B, byKey: undefined } : null, rows: (view.rows || []).map((r) => ({ ...r, costs: costOf(r, B) })) };
}
