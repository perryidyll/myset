---
id: 0089
title: A night's server cost is read off Netlify's per-day meters; a bandwidth bracket needs a quiet pair of its own day
date: 2026-09-25
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [0ge]
commits: []
tests: [tools/actuals-test.py, finance/model-test.mjs]
files: [tools/actuals.py, finance/credits.json, finance/actuals.json, finance/model.html, finance/model-test.mjs, INVARIANTS.md, finance/README.md]
---

## The question

The founder asked for a full audit of the past fortnight's numbers and for the projections
to be "as solid as possible based on the real data". The model's one measured behaviour
dial — how often a phone in the room asks the server for the board — had never been
measured: the 22% screen-on guess of 5 Sep was still in force, and the instrument built to
replace it (the account-wide bandwidth counter, marked before and after a night) had
produced one bracket (14 Sep) that the tracker withheld for want of a quiet pair. On 25 Sep
the first quiet pair was taken (7.0 MB/h — and that hour held this audit's own reads of the
store, so even it was not quiet of agents). Laid over the 14 Sep bracket it reads 350–750
ticks per phone-hour depending on the background believed — 8–18× what the request meter
says — and the same counter, between 15 and 25 Sep, held seven nights and one 488 MB day with
nobody in the room; with the pair's background over those 249 h it reads negative.
Meanwhile Netlify's own Usage & billing page charts, per day, every meter it bills:
requests, compute, bandwidth. A quiet Saturday (19 Sep) read 3,200 requests, 1.7 credits
of compute and 13.7 MB; the seven gig days around it read 5,600–7,000 requests. That
difference is a night's cost, from the meter that writes the bill, with nothing to solve.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: read nights off Netlify's per-day meters; fence the bandwidth method** | The tracker takes a gig day minus an empty day on requests, compute and bandwidth (`solve_meters`), subtracts the Studio tick, page loads, votes and extra pages, halves the requests (a tick is two) and divides by phone-hours; the credits over the empty day are `creditsPerShow`. The bandwidth solver stays, but a quiet pair counts only within 48 h of the bracket and only if the pair itself is under 6 h, and a bracket over 24 h is withheld. The per-day counts are copied off the dashboard into `credits.json` by hand, with a `cleanFrom` date. `pollsSource` names the method used. | An afternoon; one more table to copy off the dashboard at each reading | `solve_meters`, three constants, `perDay.days[]` counts, `pollsSource` | The chart's daily counts are rounded to 0.1K (±2%); the Studio share is assumed (60%) and at a three-phone night it is most of the requests — the rate is phone-hour weighted for that; a day when an agent tests the site inflates a gig day (the 8–15 Sep days are excluded for that reason) |
| B — trust the 25 Sep quiet pair and solve the 14 Sep bracket | 350–750 ticks per phone-hour becomes the calibration | Nothing | none | The screen-on dial goes to the top of its range and every projection's traffic bill roughly triples; the number is 8–18× what the request meter shows |
| C — keep the 22% guess | Nothing changes | Nothing | none | The model keeps saying 95 ticks a phone-hour when the bill says ~40; every per-gig cost is ~35% high and the arena figures 2× |
| D — instrument the functions (count board hits server-side) | Exact ticks per night from the code | A deploy (15 credits), a counter document, a write per tick or a sampled one | a hot-path write | The count must not become the cost; the split exists to keep the hot path to two reads |
| E — do nothing | As C, plus the withheld bracket stays withheld | Nothing | none | As C |

## What was chosen, and why

**A.** The meter that writes the bill is the meter to calibrate against. Netlify's per-day
request, compute and bandwidth counts are what the traffic bill is made of, so "a gig day
minus an empty day" is a night's cost by definition, no bytes-per-tick constant in the way.
Over the seven nights of 16–23 Sep it says: about 3,100 requests, 1.6 credits of compute and
37 MB over an empty day — **about 3 credits a night (2.3–3.8)**, nearly flat in room size from
3 to 11 phones, because the Studio's own tick and the page loads are most of it. Read as ticks
it is ~40 per phone-hour, and the screen-on dial solves to about 9% (from 22%). The model's
own figure for the same night at that dial is within a tenth of the metered credits.

The bandwidth method is not thrown away: with three marks — two hours before, just before,
after — it reads one night exactly, and the tracker still does that. What it must never do
again is lay a quiet pair from another week over a bracket, or read a fortnight as a night,
so those three fences are constants with tests, and INVARIANT 0ge says why.

## What this makes harder

Every dashboard reading now means copying a dozen numbers off a chart by hand, and the day
labels are UTC while the nights are Bangkok evenings (they fit inside one UTC day today; a
show past 07:00 Bangkok would not). The Studio share stays an assumption inside the tick
count — the requests meter cannot tell the artist's phone from the room's. And a quiet pair
has to be quiet of agents too: this morning's held the audit's own store reads and came out at
7.0 MB/h, ten times the per-day chart's empty day — the marks for a night have to be taken with
nothing else running. The bandwidth
method will rarely qualify now, which is the point, but it means the three-marks-a-night
routine has to actually be followed for it to say anything.

## What would reverse it

A per-night counter in the functions (option D) that costs nothing on the hot path; or
Netlify exposing per-site, per-day counts through the API, which would make the hand-copied
table unnecessary. If the meter method and a properly bracketed bandwidth night ever
disagree by more than 2×, the Studio-share assumption is the first suspect.

## How it was verified

`python3 tools/actuals-test.py` — the night rules on the 11 Sep snapshot, the bandwidth
solver on synthetic marks (now at 3,470 B a tick), a quiet pair 20 days away refused with
the reason, a 30 h bracket refused, two marks 478 h apart refused as a pair, a one-phone night
or an empty slot inside a pair making it busy, the adjacent pair still applied, and the meter method on
a synthetic week (empty days, background rule, the 9-phone night's ticks and credits, a test
day excluded, the weighted rate) — all pass. `node finance/model-test.mjs` — the byte
constants match the page (board 3,040), the tracker carries `pollsSource`, the seed equals
`finance/actuals.json` including ticks per phone-hour and credits per show, and the seed's
ticks solve to a screen-on share between 3% and 20% with the modelled night within 35% of the
metered credits — all pass. `MYSET_SITE_DIR=~/Docs/MySet python3 tools/actuals.py --write`
against production, 25 Sep: 15 nights, ticks per phone-hour from the request meter, about
3 credits a night. Not checked: a night bracketed by three marks — none has been taken yet;
the first will be the founder's next gig.
