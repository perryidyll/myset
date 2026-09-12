---
id: 0037
title: The free plan allows ten shows a calendar month
date: 2026-09-12
status: decided
decided_by: perry
area: plans
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/limits.mjs, test/tenancy.mjs]
files: [netlify/functions/_plan.mjs, public/studio.html]
---

## The question

Decision 0003 caps the free tier on shows played, not on features, because shows
are what MySet actually costs to run. The number was four a month: a hobbyist. On
2026-09-12 the founder asked for ten. What forced it is positioning, not cost — a
free plan that runs out after one weekend a month is a taster, and the founder
wants an artist who gigs every Friday and Saturday to be able to use MySet for
real before being asked to pay.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: ten a month** | `gigs: 10` in `_plan.mjs`; every screen and refusal reads it | Worst case 10 × 200 phones ≈ $3.20 a month per free artist (was $1.28) | None — one number | Fewer artists upgrade for the show count alone; Plus has to sell on setlists, pricing, merch and the lower cut |
| B — eight a month (two a week) | Same, `gigs: 8` | ≈ $2.56 | None | Same as A, slightly less so |
| C — do nothing (four) | — | — | — | A weekly performer hits the wall in the second weekend and leaves |

## What was chosen, and why

The founder said ten. The plan file is the single source: the Studio's Live-tab
warning, the past-due banner, the refusal in `_lifecycle.mjs`, the overview's
plan table and both test suites all read `PLANS.free.gigs`, so the change is one
line plus the plans-card copy (`TIER_COPY` in `studio.html`, a static string).

While there, the past-due banner's `PLAN.plans.free.gigsPerMonth` — a field the
server never sent, so the banner said "undefined shows a month" — now reads
`PLAN.plans.free.gigs`, which it does send (the 2026-09-06 audit had flagged it).

## What this makes harder

Plus is now a smaller step up on the one axis fans never see. The room-size cap
(200 phones) is unchanged and still the real ceiling on cost.

## What would reverse it

The free tier's share of the Netlify bill crossing what the paid tiers bring in;
or the founder deciding the number again — this one is his call and not one to
re-argue.

## How it was verified

`node --import ./test/register.mjs test/limits.mjs` — 84/84, including "ten shows a
month" reading `PLANS.free.gigs`. `test/tenancy.mjs` — 80/80, the cap loop counts
to `PL.free.gigs` and the eleventh is refused with 402. `node tools/overview.mjs`
regenerated the plan table row to 10. Not run against production.
