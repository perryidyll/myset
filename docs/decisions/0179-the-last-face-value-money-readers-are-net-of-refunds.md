---
id: 0179
title: The last face-value money readers are net of refunds
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: money
reverses:
superseded_by:
invariants: [0iq]
commits: []
tests: [test/netreaders.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/_lifecycle.mjs, netlify/functions/stage.mjs, netlify/functions/_warehouse.mjs]
---

## The question

Decision 0177 writes what a refund or a chargeback took back as `lost` (cents) on the tip or the paid marker. Decision 0194 netted the revenue feed, the metrics, the event log and the venue list. Three readers still summed `amount` as it was: the discard warning's "money taken tonight" (`nightPaid`), the Money tab's all-time tips, and the Google Sheet's pack and tip counts. A refunded $10 tip still counted as $10 in all three.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One helper pair in `_lib.mjs` (`netOf`, `tipGone`, the same rule `tipsTonight` already used) and the three readers read through it | Six lines | None | A new reader that sums `amount` directly repeats the gap (INVARIANT 0iq names the rule) |
| B | Rewrite `amount` itself when money goes back | Fewer readers to change | None | The record of what was paid is lost; 0177 keeps both on purpose |
| C — do nothing | | | | Three places overstate money after a refund |

## What was chosen, and why

A. `tipGone` (already in `_lib.mjs` since 0177) is exported, and `netOf(row)` is `amount − lost / 100`, never below zero. A row refunded in full is not counted at all; one refunded in part counts what stayed. `amount` stays the record of what was paid.

## What this makes harder

Nothing new: the rule already existed for tonight's tips.

## What would reverse it

Money rows moving to cents throughout, with `lost` folded in at write time.

## How it was verified

- `test/netreaders.mjs` 6 ✓: the helpers; `nightPaid` over a full refund, a part refund and an old tip; the Money tab's all-time tips through the real `stage` payload ($20 + $0 + $5 = $25, not $38).
- Two knock-outs, both red: `nightPaid` without `tipGone`; all-time tips at face value.
- **Not checked:** the sheet's counts (a filter on the same helper, no test of its own); anything on production. The founder has not seen this: it rides on 0177, whose answer is pending.
