---
id: 0165
title: A sample link's share card shows the sample's own photo
date: 2026-10-03
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/samples.mjs]
files: [netlify/functions/artistpage.mjs]
---

## The question

A real artist's link shows their portrait in iMessage, WhatsApp and Instagram (artistpage.mjs, 2026-09-27). A sample link showed the MySet icon: its address is no account, so the card found nobody. The founder asked for samples to show their main photo too.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | When the address carries `?sample-profile` (0164) and is no account, artistpage.mjs reads the sample and puts its portrait, else its cover, on the card, with its name and the labelled address | One sample-register read on a labelled link | None new: the label is not a secret (0101) |
| B | Put the picture on every bare address that holds a sample | The same read on every unknown address | Reverses 0101's "the bare address is no such page" |

## What was chosen, and why

A. The same picture rule as an artist (portrait, else cover), the same 1.5 s cap, and the same fall-back to the untouched page. Only possible since 0164: a crawler never sees a `#`, so the old links could not have carried the label to the server. Venue pages have no share card of their own yet; they are not changed.

## What would reverse it

- A sample that should not show a photo before it is claimed.

## How it was verified

- `test/samples.mjs`: a labelled link (by path and by the rewrite's query) gets the sample's portrait, name and labelled address; the bare address keeps the plain card.
- The full suite exits 0.
