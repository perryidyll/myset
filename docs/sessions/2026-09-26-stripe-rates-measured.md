# 2026-09-26 — the money model's Stripe rates, from the exact fees

**Asked:** update the money model's Stripe rates to the real fees.

**Measured:** all 12 money-known nights had Stripe's own fee by 10:08 UTC. Five of them
took money, over 12 payments: $85 in all, with $7.02 in fees, 8.3% all-in. Solving
fee = 2.9% × amount + 1.5% × (amount on foreign cards) + 30¢ per payment, night by night:

| night | paid | payments | fee | from abroad |
| --- | ---: | ---: | ---: | ---: |
| 20 Sep | $35 | 4 | $2.67 | $30.3 |
| 16 Sep | $15 | 2 | $1.04 | $0.3 |
| 14 Sep | $22 | 4 | $2.14 | $20.1 |
| 13 Sep | $10 | 1 | $0.74 | $10.0 |
| 30 Aug | $3 | 1 | $0.43 | $2.9 |

That is 75% of the dollars on cards from abroad. The residuals are rounding, so the US
base rate and the 30¢ both hold.

**Changed:** `finance/model.html` `P0.stripe.intlShare` 13 → 75, plus the dial's unit
text and the "whose Stripe fee is whose" note. `_showcosts.mjs` `STRIPE_RATES` follows,
and the test holds the two equal. At the default scenario: Stripe $1,867 → $1,933 a month,
margin 78.1% → 77.6%, break-even 37 unchanged.

**Caveat:** these are fans' cards in Thai rooms. The model applies the rate to MySet's
own charges (plans, featured shows), which artists pay, and their cards may differ.
Saved scenarios keep whatever the dial said when they were saved.
