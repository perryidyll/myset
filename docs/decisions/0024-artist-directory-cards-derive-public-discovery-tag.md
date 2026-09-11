---
id: 0024
title: Artist directory cards derive public discovery tags and counts from existing profile, calendar, history and visible community data
date: 2026-09-11
status: decided
decided_by: user
area: ui
reverses:
superseded_by:
invariants: [1, 0bu, 0ck]
commits: []
tests: [test/artists.mjs, test/copy.mjs, tools/uicheck.mjs]
files: [netlify/functions/_profile.mjs, netlify/functions/admin.mjs, netlify/functions/profile.mjs, netlify/functions/artists.mjs, public/studio.html, public/artists.html]
---

## The question

The directory card joined the artist name directly to the one-liner and exposed only
an upcoming count and released-music flag. The user asked for a roomier card with location,
style, signed status, fan-rating average, thirty-day MySet shows and total completed
MySet shows, with every discovery attribute represented in the filters.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Derive location and future shows from the calendar, totals from the history index, ratings from visible community posts, signed status from label/management, and store one directory-only style field | Two additional known-key reads per artist-directory entry | One profile string and more directory filters | A very large directory may outgrow the current batched request |
| B | Store duplicate directory counters and ratings on the registry | Faster directory reads | Every calendar, history and community write must maintain a global summary | Summaries drift and show false public numbers |
| C — do nothing | Keep the cramped card and former filters | Nothing | None | The requested discovery information stays absent |

## What was chosen, and why

Option A. The user explicitly requested the fields. Existing per-artist documents already
own every fact except style, so deriving the card avoids a second source of truth and
keeps hidden comments out of the rating. Style is saved in the profile editor but the
public profile page does not render it.

## What this makes harder

The directory now reads profile, calendar, history index and community posts for every
artist. The twelve-at-a-time batching prevents a request burst, but pagination or a
maintained discovery index will be needed if real directory latency grows with adoption.
“Signed” is inferred from a non-empty label/management value, excluding the explicit
values Independent, Unsigned and Self-managed; it is not a legal verification claim.

## What would reverse it

Revisit when the artist count makes `/api/artists` approach the function timeout, or
when artists need separate label, management and signing-state concepts rather than the
current directory tag.

## How it was verified

`test/artists.mjs` passed 9/9 for privacy, 30-day calendar counts, style, signed state,
rating average and total-show shape. `tools/uicheck.mjs` rendered the card and all new
filters at a 390px mobile viewport with no horizontal overflow. `sh test/run.sh`
completed with zero failures. Draft `6aa3a5cdaf109164f02e0a0d` served the new HTML and
real computed directory payload. No production deploy was made.
