---
id: 0019
title: Mood votes are free requests that let the artist choose the song
date: 2026-09-10
status: decided
decided_by: perry
area: voting
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/credits.mjs, tools/uicheck.mjs]
files: [netlify/functions/_requests.mjs, netlify/functions/show.mjs, public/vote.html, public/studio.html]
---

## The question

Fans needed a way to vote for a feeling rather than a specific title, without spending their finite song votes.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Store a free mood request and show it to the artist | One small request type | A fixed mood list | Spam or confusing free-credit accounting |
| B | Add moods as fake songs | Less request UI | Pollutes the setlist and ranking | A mood could incorrectly become “top song” |
| C — do nothing | Keep song-only voting | Nothing | None | Misses the requested interaction |

## What was chosen, and why

Mood votes use the existing request queue with a strict server-owned list of twenty choices and a zero cost. They never enter song rankings; the artist acknowledges or dismisses them after choosing an appropriate song.

## What this makes harder

Each fan may have one pending mood vote at a time. Aggregating identical moods would require a separate tally model later.

## What would reverse it

Revisit if real shows need mood tallies rather than individual prompts, or artists need configurable mood lists.

## How it was verified

`test/credits.mjs` proves an allowed mood reaches the artist without changing credits and rejects invented values. `tools/uicheck.mjs` proves twenty zero-vote choices render in their own horizontal scroller.
