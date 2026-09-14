---
id: 0076
title: The money model prices the split and the open line from the simulator and the probe, never from list prices
date: 2026-09-14
status: decided
decided_by: perry-confirmed
area: scale
reverses:
superseded_by:
invariants: []
commits: []
tests: [finance/model-test.mjs]
files: [finance/model.html, finance/model-test.mjs, tools/actuals.py, finance/actuals.json, finance/marks.json]
---

## The question

The money model at `/moneymodel` still priced the audience poll the way the page polled before
11 September: one function call per tick per phone, each re-reading every fan record in the room.
Decision `0034` split that into a shared board and a small personal call; `0035` measured the
open line; `0036` (built in a parallel worktree, off by default, not yet merged) made the line an
add-on to polling. The repo's simulator (`tools/loadsim.py`) already knew the new shape. The
page did not — so every server figure on it, and the "breaks at arena size" verdict, described
code that no longer ran. The user asked for the model to reflect both changes and to use the
latest real-show numbers.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: port the simulator's ladder and split into the page's engine, pin the two together with a test, price the line from the probe's own bill** | The engine walks the same ladder as `tools/loadsim.py` (the server's floor, the terminal rung, jitter, the stage-only signature above 200 phones), counts board renders and personal calls separately, keeps the old one-call poll as a comparison column, and prices "Netlify + the open line" as Netlify plus Cloudflare | A day; the calibration targets re-pinned to today's simulator | new dials (personal-call time and reads, the edge-nodes guess, phones on the line, reconnections, the nudge's round trip); a "before the split" host | The page and the simulator drift again — which is why the suite now holds them within 5% on eleven cases |
| B — leave the engine, scale its outputs by the simulator's ratios | Multiply the old poll's bytes and compute by measured factors | An hour | none | Right at one room size, wrong at every other — the split changes the *shape* of the curve, not its height |
| C — replace the engine with the simulator's output tables | The page reads numbers the Python printed | A day | a build step a human must remember to run | The manual step goes stale — the failure shape this repo has already paid for |
| D — do nothing | The page keeps describing the old poll | Nothing | none | Every server line on the page is wrong; the arena verdict is wrong by 8× |

## What was chosen, and why

**A.** The page's engine is the only place a dial can be turned, so it has to carry the real
curve; the simulator is the reference and stays so. What the port changed, in numbers (the
Benchmark case, 1,000 artists):

- **A bar set costs a little more, a big room much less.** The 20-phone gig moves from 2.70¢ to
  3.01¢ on Pro (two requests per tick — web requests are now the biggest line at bar size, not
  compute). The 1,000-phone room moves from ~$0.65 to $0.57; the arena from $27 to $2.77; the
  festival from $3,006 to $144. The old engine over-counted big rooms by ~8× because it had no
  server floor and no stage-only signature.
- **What breaks a big room changed.** Function concurrency and reads a second collapse (the render
  is shared); what remains is the document store's bytes per second — the size table now carries
  "Store MB/s" and turns red past ~50, which is the simulator's ~2,500-phone wall at today's
  record size. The arena reads *at the edge*, not *breaks*, on today's code.
- **The open line costs more, not less.** A hidden page closes its socket and a shown one reopens
  it (INVARIANT 9d12), so every *glance* is a socket and two billed requests; at a bar the tally
  changes about as often as the stage does, so the ladder barely slows. It adds about half a cent
  per bar gig and buys a live tally. It is priced as "Netlify + the open line", never Cloudflare
  alone — the audit's "13× cheaper rewrite" was a different design and is not what was built.
- **The revenue line did not move.** Break-even 148 → 150 artists; profit $2,165 → $2,153 a month.
  The server is ~3% of revenue at any size the page charts.

The tracker (`tools/actuals.py`) now weighs a tick as board + personal bytes for any mark taken
since the split, and a first mark on the split code was taken on 14 Sep before the Ugly Duckling
gig. Seven real nights feed the page (30 Aug–13 Sep): 9.4 phones, 2.75 h, 2.32 actions a head,
and — three nights with readable takings — $0.68 a head, of which one $10 tip in a two-phone room
is most.

## What this makes harder

Two ladders must still be kept in step by hand (the page's JavaScript and the simulator's Python);
the test pins them, it does not generate one from the other. The "before the split" column runs the
old ladder too (the 5 s rung for 201–1,000 phones), so it is compared with the simulator's
`--legacy` on every case; a saved scenario can no longer bring a retired host back.

## What would reverse it

A measured personal-call duration (the 50 ms is an estimate), a measured edge-node count for a
bar, and one real night with the line on — each replaces a dial's guess with a number, none
reverses the shape. A store that no longer moves the whole bag per render (one small document per
fan) would move the ~2,500-phone wall and the "Store MB/s" column with it.

## How it was verified

`node finance/model-test.mjs` — 79 checks pass, including: ticks within 3.4%, board renders within
3.2% and credits within 4.3% of `tools/loadsim.py` on eleven rooms from 8 to 10,000 phones (best
and worst edge case, and before the split where the ladders agree); the 20-phone gig at 4.510
credits after and 4.056 before; the 1,000-phone room at $0.57; the store at the ~50 MB/s wall for
10,000 phones (simulator 48.7); the open line's sockets, nudges and 1.7 GB-s per 12,202
connections; the tracker's byte constants equal to the page's. Verified in the browser on the
local static server: every panel renders, the size table shows the new columns, the host list
prices "before the split" and "Netlify + the open line", no console errors. **Not measured:** the
personal call's real duration, the edge-node count, a night with the line on — all named on the
page as estimates.
