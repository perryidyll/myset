---
id: 0042
title: public reads are shared at the edge and every page paints the last thing you saw first
date: 2026-09-12
status: decided
decided_by: claude
area: performance
reverses:
superseded_by:
invariants: [9d6]
commits: []
tests: [test/run.sh (full suite), test/e2e.mjs, test/place.mjs, test/community.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/profile.mjs, netlify/functions/events.mjs, netlify/functions/venue.mjs, public/leave.js, public/artist.html, public/venue.html, public/community.html, public/vote.html, public/studio.html]
---

## The question

After decision 0038 (the splash on every tap, the head-started first call) the
founder timed the site and called it "manageable but amateur" next to an app such
as Airbnb. Production timings on 2026-09-12 said where the wait is: the HTML
arrives in 0.6–0.9s, but every `/api/*` read costs 0.7–2.2s (cold start plus
three to five storage reads in a row), `/api/events?days=90` returns 44KB for a
page that draws three rows, and the artist, venue and community pages hide
behind the logo screen until that read lands. What could be done in one cheap
pass, without the rewrite to a single-page app?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | (1) each page keeps its last good answer in localStorage and paints it at once, then redraws only if the fresh one differs; (2) `/api/profile`, `/api/events` (diary, picker, city feed) and `/api/venue` are kept at the edge for 15–60s the way `/api/board` already is; (3) `/api/events` takes `n=` and the pages ask for what they draw; (4) the three pages show a grey placeholder frame instead of the logo screen on a first visit | a Live pill or a diary change can be up to twice the TTL behind; the Studio must add `?t=` to its own profile read | `jsonCached` in `_lib.mjs`, `window.lastSeen` in `leave.js`, a `SKEL` per page | a cached reply that varied by caller would leak one person's view to another — so nothing cached may read a token or a fan id; the community read (which does) is deliberately left out |
| B | fold the five fan reads into one warm function with a `what=` switch | an afternoon; changes URLs, cache rules and tests | one function that all fan reads depend on | a bug there takes every fan read down at once |
| C | rebuild the fan pages as one single-page app | weeks; every fixed bug re-checked | a router, shared state | the whole product re-verified |
| D — do nothing | | | | the 2s first paint stays |

## What was chosen, and why

A, as the first of two passes the founder agreed to ("let's proceed with your
recommendation"): the four cheapest changes, measured on a phone before B is
decided. B is held because option A's edge copy may make the cold starts
invisible on its own — a cached reply never wakes a function — and because B is
the one step with real blast radius. C is not on the table this year.

The community read is NOT edge-cached: its reply carries the asking phone's own
likes and `canPost`, so the URL (which includes `fan=`) is per device and a
shared copy would be either useless or wrong. It gets the last-seen paint only.

## What this makes harder

Anything that must be visible to every phone the second it changes now has up to
2×TTL of lag on the public pages: a Live pill up to 30s, a diary edit or a
venue's what's-on up to 60s, the front door's city feed up to 2 minutes. A future
reader adding a per-caller field to profile, events or venue must switch that
handler back to `json()` or the field leaks between callers (INVARIANT 9d6: the
URL is the whole key). The last-seen copy means a removed artist's page can be
drawn once more from a phone that saw it — the fresh 404 replaces it a second
later.

## What would reverse it

A real report of one person seeing another's data on a public page (would mean a
per-caller field crept into a cached handler); the Live pill's lag mattering at a
real gig; or pass two (option B) landing and the timings showing the edge copy no
longer earns its lag.

## How it was verified

`sh test/run.sh` — the full suite, 44 files, 2116 assertions, 0 failed, after the
change. `node --check` on every touched function and every inline script of the
five pages. NOT verified: on a phone or in a browser (deliberately, to save the
founder's credits); the edge cache headers on production (not deployed yet — the
board's identical header is the evidence they work, decision 0034). The founder
is to tap artist → vote → community after the push and watch the first paint.
