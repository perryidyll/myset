---
id: 0077
title: The server bill is two bills — traffic and shipping — and no per-gig figure ever contains a deploy
date: 2026-09-14
status: decided
decided_by: perry
area: money
reverses:
superseded_by:
invariants: [0fx]
commits: []
tests: [finance/model-test.mjs]
files: [finance/model.html, finance/model-test.mjs, tools/actuals.py, INVARIANTS.md, finance/README.md]
---

## The question

For the third time, a "server cost per gig" carried the production deploys spread over the
month's gigs, and polling looked expensive when shipping was. 31 Aug: ~240 credits of deploys
in an afternoon blamed on the poll (INVARIANT 9d0). 1 Sep: every change bought two production
deploys and the count was wrong by half (9d3). 14 Sep: the money model's own `costPerGig` and
the per-tier "server" line were `bill ÷ gigs`, with the deploy line inside the bill — so the
3.10¢ → 3.50¢ reported for the split carried $26 of deploys spread over 3,000 gigs, and the
founder, seeing a week of 83 deploys, reasonably asked whether the increase was the deploys.
The user's instruction: write a rule into the data acquisition and the formulas that ends the
confusion for good, whatever it takes — the model will carry critical decisions.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: two bills in the engine, the tracker and the page, held by a test that turns the deploys dial** | `hostBill()` returns the traffic bill (the month at zero deploys) and the shipping bill (what the deploys add); every per-gig / per-phone / per-tier / per-show figure is computed from the traffic bill; the tracker emits `shipping` and `traffic` as separate objects; the page names the bill on every server figure and carries the rule as a note; the suite turns deploys 0 → 400 on every host and fails if anything per gig moves | A few hours; one more KPI, two more columns | none — the same inputs, split | A future per-gig figure written without the test — which is why the test sweeps every host and the tracker's regexes, not one number |
| B — remove deploys from the model altogether | The model shows the traffic bill only | An hour | none | The real Netlify bill is mostly deploys; a model that hides the biggest line lies the other way |
| C — a "deploys per gig" dial | Spread deploys over gigs on purpose, visibly | An hour | one dial | It is the mistake, given a slider |
| D — a note on the page and nothing in the code | "Remember deploys are separate" | Ten minutes | none | It has been remembered three times |

## What was chosen, and why

**A.** The rule, in one sentence, now in INVARIANT `0fx`: **the server bill is two bills, and no
per-gig figure ever contains a deploy.** The split is defined so it is exact under Netlify's
plan-and-pack steps — the traffic bill is what the same month would cost with zero deploys,
the shipping bill is what the deploys add on top — so `costPerGig` at 400 deploys equals
`costPerGig` at 0 to the last digit, and the suite asserts that on every host, for the month,
the per-tier table and the show-size table. The tracker reports the two the same way and has
no deploy byte constant for a solve to pick up by accident. The page says which bill every
server figure belongs to, carries a "Two bills, never one number" note with the real split
(this period: 83 deploys = 1,245 credits; 1.17 GB = 23 credits of bandwidth for everything the
rooms did), and the shipping KPI turns red when it exceeds the traffic bill.

What this changed in the numbers: nothing about the traffic. The Benchmark case's "3.50¢ per
gig" is now stated as it should have been — the traffic bill alone, with the shipping bill
($26 at 264 deploys) on its own line. The per-tier "server" no longer charges an artist for
the founder's deploys.

## What this makes harder

The exact per-category credit split (web requests, compute) is not in Netlify's API; the
tracker can report deploys and bandwidth exactly, and the rest is on Usage & billing › Credit
usage breakdown. A future host with a per-deploy charge must express it through `deploys` in
`billOnce()` or the test's "400 deploys cost something" check will name it.

## What would reverse it

Netlify pricing deploys per gig — it will not. Nothing else; the two things are measured by
different meters and driven by different people.

## How it was verified

`node finance/model-test.mjs`: 86 checks pass, including the sweep (deploys 0 → 400 on every
host; per-gig, per-tier and per-show unchanged; traffic + shipping = the bill; 400 deploys =
6,000 credits) and the tracker regexes. `tools/actuals.py --write` against production carries
`shipping` and `traffic`. Browser: the KPI row, the formula table's two bills, the hosts table's
traffic/shipping columns and the note render; no console errors.

**Then the founder asked for the exact split to be read and recorded.** Read off Netlify's
own dashboard (Usage & billing › Credit usage breakdown) on 14 Sep at 12:40 UTC, for the
period from 8 Sep: **production deploys 86 = 1,290 credits (96.3%)**; everything every room
did — 39,505 web requests = 7.9 credits, compute 20.8 (1.9 GB-hours), bandwidth 21.5 — **50.2
credits (3.7%)**; total 1,340.2. The per-day chart (in `finance/credits.json`) shows a day
with no gig still costs ~3 credits of compute and ~1 of requests — the scheduler, the
warm-door pings, the nightly mirror — and a gig adds one or two on top. The previous period
(8 Aug–7 Sep) was ~3,000 credits, 53K requests, 1.5 GB-hours. The tracker now carries the
latest reading into `actuals.json` and the page's note quotes it.
