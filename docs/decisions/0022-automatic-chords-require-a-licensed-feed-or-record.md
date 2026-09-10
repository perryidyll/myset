---
id: 0022
title: Automatic chords require a licensed feed or recording-derived analysis
date: 2026-09-10
status: decided
decided_by: user-confirmed
area: media
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/copy.mjs, tools/uicheck.mjs]
files: [public/studio.html]
---

## The question

Artists want the current song's chords aligned above its lyrics inside the same live
sheet. Lyrics have a structured public source; chord/tab sites generally do not expose
an equivalent supported feed, and their arrangements are third-party content.

## The options

Every option that was genuinely on the table, including the one nobody liked. An
option list with only the winner in it is a justification, not a decision record.

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Keep the in-app chart surface ready; resolve a provider's exact result URL from search metadata until a licensed feed or recording analysis exists | One external handoff | Provider link resolver | Provider can change its result markup or URL |
| B | Scrape an existing chord site into MySet | Low initial work, permanent maintenance | Scraper and parser | Bot blocks, wrong matches, and content-rights exposure |
| C — do nothing | Keep only artist-entered My chart | No cost | None | Misses a valuable live feature |

## What was chosen, and why

Aligned display is easy once MySet has ChordPro-like source text. Reliably and properly
obtaining that text is the hard part. The feature must not pretend a search link is an
in-app generated chart or silently republish another site's chart.

## What this makes harder

Auto chords remain an external step today, so the musician leaves the live sheet. MySet
may read the provider's search-result metadata to bypass a broken mobile results handoff,
but it must never fetch, parse, store or display the chart itself.

## What would reverse it

A chord provider offers an embeddable/licensed API, or MySet accepts an audio source and
runs its own chord recognition. Either path can emit ChordPro and render in the existing
sheet without changing artist-authored My chart.

## How it was verified

`test/copy.mjs` pins the provider boundary, `test/unit.mjs` pins exact-match URL
resolution, and `tools/uicheck.mjs` pins the three separate controls and their physical
hit targets. No third-party chord chart is copied or scraped into MySet.
