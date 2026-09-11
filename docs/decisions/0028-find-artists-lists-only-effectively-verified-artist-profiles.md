---
id: 0028
title: Find artists lists only effectively verified artist profiles
date: 2026-09-11
status: decided
decided_by: user
area: trust
reverses:
superseded_by:
invariants: [0bo, 0f9]
commits: []
tests: [test/artists.mjs, test/copy.mjs, tools/uicheck.mjs]
files: [netlify/functions/artists.mjs, public/studio.html]
---

## The question

Should an artist account appear in Find artists before it has earned the public
verification tick?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Show only artists with the verification flag and a current paid plan | New artists are absent until verification is complete | One server-side eligibility filter and one-time Studio notice | A qualifying artist with stale account state could be hidden |
| B | Show everyone but label unverified accounts | Maximizes directory inventory | More warning states on cards and maps | Fraudulent or abandoned profiles remain discoverable |
| C | Filter only in the browser | Looks equivalent in the interface | None on the server | Unverified profile and event data still leaves the public endpoint |

## What was chosen, and why

Option A. The user chose verified-only discovery to reduce fraudulent use and protect
the audience experience. The endpoint applies the same effective rule as the public
badge before it reads or returns any directory detail. Cards and the map therefore
cannot disagree.

The Get verified section states the consequence directly. The first Settings visit
also shows one account-scoped notice; dismissing it is remembered on that device.

## What this makes harder

Verification is now an acquisition gate, so payout setup and the verification flow must
remain understandable and reliable. A lapsed paid plan also removes an artist from
discovery because it removes the effective public tick.

## What would reverse it

Revisit only if the product deliberately introduces a separately reviewed public-listing
state that is safe without the verification tick.

## How it was verified

The directory test proves unverified, free-but-flagged and deleted accounts are absent
while qualifying profiles retain their cards and map occurrences. Copy and rendered
mobile checks verify the Settings explanation, exact first-visit notice, colors and
once-per-artist persistence. The full gate completed with 1,882 assertions and zero
failures; draft `6aa3bcce9fd9709b3a45eb9c` served one qualifying profile and no
unverified directory data.
