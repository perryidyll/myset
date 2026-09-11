---
id: 0031
title: A night is evidence only if it lines up with a published gig
date: 2026-09-11
status: decided
decided_by: perry
area: money
reverses:
superseded_by:
invariants: [0ef]
commits: [210683d]
tests: [tools/actuals-test.py, finance/model-test.mjs]
files: [tools/actuals.py, finance/fixtures/2026-09-11]
---

## The question

The first week of published gigs left 17 archived show records, and the user had also
started and ended shows by hand at random hours to test things. The tracker that feeds
the money model judged a night by its own shape — phones, votes, length — and on that
rule the week read as 13 nights with 6.7 phones and 4.6 hours each: three-quarters of it
tests. The user's instruction was explicit: only the shows that line up with the gigs he
published count.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: the published calendar decides** | A night counts only if it started on a gig day between 90 min before the slot and its end, read from the same calendar document the scheduler uses | One extra document read per artist | `gig_for()`, `merge_split_nights()`, `silent_nights()` in the tracker | An artist with no calendar falls back to the shape rules; a gig played off-calendar is not counted until it is put on it |
| B — tighter shape rules | Lower the length cap, raise the phone floor | Nothing | None | A real 6-hour record (the auto-end grace) or a real 7-phone night gets thrown out; a 9-hour daytime test with 7 drifting phones stays in |
| C — a "test" flag the artist sets | The Studio marks a show as a test | A tap the artist will forget | UI and a field | The week's tests were not marked, and never would be |
| D — do nothing | — | The model's people and hours dials read 6.7 and 4.6 from tests | — | Every projection built on a made-up room |

## What was chosen, and why

**A**, because the user said so, and because it is the only rule that needs no
judgement: the calendar is what he published, the slot is when the room existed. The
length rule follows from it — the record, unless the auto-end grace let it overrun the
slot, then the later of the slot and the last song anyone started (a room still voting
an hour past the slot was a room; a page left open was not). Two records inside one
slot are one night. Published gigs with no record are listed, so nights-per-week is
counted from what was published, not what was filed: 5 used of 11 this fortnight.

## What this makes harder

A gig that was never put on the calendar is invisible to the model until it is. A show
started more than 90 minutes early is a test by definition. Artists without a calendar
get the old shape rules, which are weaker.

## What would reverse it

An artist who plays real, well-attended nights without keeping a calendar; or the
archive gaining a `startedBy` / `endedBy` field good enough to tell a gig from a test on
its own.

## How it was verified

`python3 tools/actuals-test.py` — 25 checks against the 11 Sep production snapshot in
`finance/fixtures/2026-09-11`: five nights count, one is on-calendar-unused, fourteen
are named tests; hours 2.53 / 2.81 / 2.09 / 4.07; five silent published gigs listed in
order; a synthetic split night merges. The live run against production printed the
same five nights, 11.0 phones, 2.74 h. `node finance/model-test.mjs` asserts the rule
is present and the page's seed equals `finance/actuals.json`.
