# 2026-09-14 — Two bills, never one number: deploys can no longer masquerade as polling

## What the user asked

After the split landed in the model he asked, first, whether the reported "cost increase" was
really the week's deploys, and whether the two can be separated with 100% accuracy; then, for a
rule "into your data acquisition and ensuing formula creation … that eradicates the confusion
once and for all — this is the 2nd or 3rd time deploy costs have been calculated as polling
costs and screwed up the model's projections."

## The answer to the first question

Netlify meters production deploys (15 credits; previews, branch deploys and failed deploys are
free) separately from everything a room causes (web requests, bandwidth, compute). Two of the
meters are readable from the API exactly: the deploy list and the bandwidth counter. This
billing period (since 8 Sep): **84 production deploys = 1,260 credits; 1.167 GB of bandwidth =
23 credits** for everything every room did. Web requests and compute are only on Netlify's
Usage & billing › Credit usage breakdown page; the model puts them at 1–2 credits a gig. So
deploys are above 95% of the period's credits, and the exact split lives on that page.

And the "increase" he asked about (3.10¢ → 3.50¢ per gig, split vs before) was a simulated
figure with deploys held constant — but it DID carry the deploys spread over the gigs, because
`costPerGig` was `bill ÷ gigs` with the deploy line inside the bill. That is the third time.

## The rule, and where it now lives — INVARIANT 0fx, decision 0077

**The server bill is two bills, and no per-gig figure ever contains a deploy.**

- **Engine** (`finance/model.html`): `hostBill()` now returns `trafficUsd` (what the same
  month costs with zero deploys) and `deployUsd` (what the deploys add on top — their marginal
  cost, exact under Netlify's plan-and-pack steps). `costPerGig`, `serverPerGig` (the per-tier
  table) and every show-size figure come from the traffic bill alone. `month()` also returns
  `trafficPct`, `shippingPct`, `trafficUsd`, `shippingUsd`.
- **Page**: a new KPI "Shipping (deploys)" (red when it exceeds the traffic bill); the
  "Server ÷ revenue" KPI names both bills; the formula table has "Traffic bill", "Shipping
  bill" and "Server cost per gig (traffic only)"; the hosts table has Traffic / Shipping /
  Traffic-per-gig columns; the scale ladder shows "of which shipping"; scenario cards and the
  compare table report traffic per gig and shipping as two lines; the per-tier caption says
  the shipping bill is the platform's, not any artist's; the deploys dial is labelled "the
  shipping bill"; and a note, "Two bills, never one number", states the rule with this
  period's real split filled in from the tracker.
- **Tracker** (`tools/actuals.py`): emits `shipping` (deploys and credits — 30 days, this
  period, per day) and `traffic` (the bandwidth counter in bytes, GB and credits) as two
  objects; `BYTES` has no deploy entry; the note says which bill is which. Two more things it
  now does: it **refuses to write when the registry reads as empty** (a run from a worktree
  that is not `netlify link`ed read zero nights and would have replaced seven real nights with
  nothing, silently — caught here, not in production), and it reads the store through
  `MYSET_SITE_DIR` when set, the same convention as `tools/metrics.mjs`.
- **Tests** (`finance/model-test.mjs`, 87 pass): on every host, deploys 0 → 400 moves no
  per-gig, per-tier or per-show figure; traffic + shipping = the bill; at zero deploys the
  shipping bill is zero; 400 deploys on Netlify = 6,000 credits; the scenario summary carries
  the two lines; the tracker has the two objects, no deploy byte constant, no division of
  deploys by shows/phones/hours, the empty-read refusal and `MYSET_SITE_DIR`.
- **Docs**: INVARIANTS.md 0fx (in the Cost section beside 9d0 and 9d3, the first two times);
  `finance/README.md`; decision 0077; a feedback memory for the assistant.

## What changed in the numbers

Nothing about the traffic. The Benchmark case's per-gig figure is now the traffic bill only;
the shipping bill (269 deploys in 30 days ≈ $23–27 depending on the plan step) is its own line.
The per-tier "server" no longer charges an artist for the founder's deploys, so the three tier
nets sum to revenue − traffic − Stripe, and the shipping bill sits with fixed costs as the
platform's.

## Verification

- `node finance/model-test.mjs` — 87 pass.
- Browser (local static server on the PR worktree): no console errors; KPIs read "traffic
  $133 = 2.7¢ per gig × 5,000 · shipping $23 = 269 deploys" and "Shipping (deploys) $23"; the
  formula table's two bills sum to the total; the hosts table shows the split per host; the
  note's live line reads "84 deploys = 1,260 credits this billing period, against 1.17 GB = 23
  credits of bandwidth".
- `MYSET_SITE_DIR=~/Docs/MySet python3 tools/actuals.py --write` — 7 nights, `shipping` and
  `traffic` present; the same command from the unlinked worktree refused with the message.

## The exact split, read and recorded (the founder's ask)

Read from the dashboard in the in-app browser, 14 Sep 12:40 UTC, period from 8 Sep:

| Meter | Count | Credits | Share |
|---|---|---|---|
| Production deploys | 86 | 1,290 | 96.3% |
| Web requests | 39,505 | 7.9 | 0.6% |
| Compute (serverless functions) | 1.9 GB-hours | 20.8 | 1.6% |
| Bandwidth | 1.1 GB | 21.5 | 1.6% |
| AI inference | — | 0 | — |
| **Total** | | **1,340.2** | |

Per day (in `finance/credits.json`): no-gig days cost 2.5–3.4 credits of compute and ~1.3 of
requests — the background (scheduler every 2 min, warm-door pings every 4 min since 12 Sep,
nightly mirror and sheet sync); a gig adds roughly 1–2 credits. Deploys the same days: 60–600.
Bandwidth spikes (8.9 on 7 Sep, 7.5 on 11 Sep) are the clip uploads and the backup/metrics
reads, not polls. Previous period (8 Aug–7 Sep): ~3,000 credits, 53K requests, 1.5 GB-hours,
1.1 GB.

Kept in `finance/credits.json` (append-only; the API cannot give it); `tools/actuals.py`
carries the latest reading into `actuals.json` as `shipping.dashboard` / `traffic.dashboard`;
the page's "Two bills" note quotes it.

## For the user

- The exact request/compute split: Netlify › Usage & billing › Credit usage breakdown. I can
  read it from your logged-in Chrome if you want it in the record.
- 84 deploys in 6.5 days is a pace of ~380 a month ≈ $57 on top of the plan. Your call.
