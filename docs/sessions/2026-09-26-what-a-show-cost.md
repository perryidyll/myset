# 2026-09-26 — what each show cost

**Asked:** each show's total cost in the main table, with the server and Stripe costs
beside it, grouped together like the votes and the tips, three columns after Merch.

**Done (EVS-004, a third amendment to decision 0095):**

- `netlify/functions/_showcosts.mjs`: `costBlock(actuals, credits)` and
  `costOf(row, block)`. Server = the night's traffic credits by Netlify's per-day meters
  (`finance/actuals.json` meters.nights) or the average of the measured nights (marked ≈),
  at the pack's $/credit ($5 for 500 on the Personal plan = 1¢). Stripe = an estimate at
  the model's P0.stripe rates (effective 3.095% + 30¢ a payment) over room money + merch.
  Total = the two. No Stripe figure where Stripe never answered.
- `_showsdash.mjs`: shows.json carries `costs` on each row and the block. The register
  is untouched and stays meter-free.
- `netlify.toml`: `finance/actuals.json` and `finance/credits.json` are bundled into the
  moneymodel function.
- `finance/shows.html`: a Costs group (Server · Stripe · Total) after Merch, with a red
  top rule. Costs are never green, and ≈ marks an estimate. They are in the totals row, and
  the KPI tiles are folded to twelve with a Costs tile. The drawer lists the three costs
  and the room money less costs. A rules card explains it.

**The numbers today:** the server runs about 3¢ a night, measured 2.3–3.8 credits.
Stripe is ≈ $0.61–$2.28 on the nights that took money and $0 on the rest. Over 12 nights
with money known, costs come to ≈ $6.29.

**Verified:** `sh test/run.sh` exit 0, 3,684 ✓, and `node finance/model-test.mjs` passed.
The page was checked in the app's browser on a read-only copy of production's rows,
priced locally.

**Not verified:** production (after the merge). Stripe's real fee per payment was not
checked; it is an estimate by design, and the decision note says how to make it exact.
