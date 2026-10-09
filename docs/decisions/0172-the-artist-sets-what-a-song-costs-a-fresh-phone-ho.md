---
id: 0172
title: The artist sets what a song costs, a fresh phone holds one free vote, and a setlist row has one menu button
date: 2026-10-09
status: decided
decided_by: perry
area: voting
reverses:
superseded_by:
invariants: []
commits: [7c87dbe]
tests: [test/credits.mjs, test/defaults.mjs, test/tenancy.mjs, test/finality.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/stage.mjs, netlify/functions/_account.mjs, public/studio.js, public/studio.html, public/vote.html, tools/overview.mjs]
---

## The question

The founder asked for three things on 2026-10-09: make the number of votes each
song costs customizable, make the default number of free votes 1, and replace the
three red circles on each Studio setlist row (edit, hide, delete) with a "…"
button that opens the same sheet as a long press. Until now a vote on an unplayed
song always cost 1 (`costOf()` hard-coded it), a fresh room handed out 3 free
votes, and every setlist row carried three stacked 26 px buttons.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `show.songCost` (1–20, default 1) beside `replayCost`; `DEFAULT_FREE_CREDITS` 3 → 1 with a versioned migration (v3); a "…" per row that opens the hold sheet | One setting, one admin action, one migration step | `songCost`, `saveSongCost`, `rowMenu` | A room on 3 free votes chosen on purpose drops to 1 |
| B | A price per individual song | A field on every song and an editor per row | Many | Far more to explain to a fan |
| C — do nothing | | | | |

## What was chosen, and why

The founder said so. One number for the room keeps the fan's sheet to one
sentence ("Each vote on a song costs N votes tonight"), and it sits next to the
replay cost the Studio already had. It is pricing, so it is gated exactly like
`replayCost` (`canPrice`, a Bar Star feature; the founding page bypasses it). A
replay still costs `replayCost`; `costOf()` returns `songCost` for every song not
in `played[]`. A vote already cast keeps its price: `va` rows carry it.

The free default moves through the versioned migration in `normShow`, as the
5 → 3 move did: `VOTE_DEFAULTS_VERSION` 2 → 3, and a stored room on 3 (or on the
v1 default of 5) reads as 1. A room on any other number keeps it. Changing
`defaultShow()` alone would only have reached brand-new accounts.

The "…" opens `holdSheet()`, the sheet a long press opens (decision 0083). The
three real buttons stay in the row, clipped out of sight but still laid out,
because that sheet and the swipe tray are built by reading them. So the long
press, the swipe and the "…" are one code path, with no second list of actions.

On the fan page, `cost > 1` no longer means "this is a replay". `isReplay()` reads
`played[]`. A fan short of a song's price, with payments on, gets the sheet's
Buy more votes instead of a dead button (INVARIANT 0ad). Before, the button was
disabled unless the wallet was at zero.

## What this makes harder

A free artist's room now gives each phone one free vote, and the free plan cannot
change it (pricing is gated). A paid artist who chose 3 on purpose is moved to 1
by the migration. The two cases cannot be told apart in the stored document.

## What would reverse it

The founder asking for a different default, or rooms visibly voting less on the
free plan.

## How it was verified

`sh test/run.sh` on 3111e4c: exit 0, 5,805 ✓. New cases: test/credits.mjs "THE ARTIST SETS
WHAT A SONG COSTS" (2 votes charged per cast, refused when short, replay still at
replayCost, a cast keeps its price, clamp to 20); test/defaults.mjs (fresh = 1,
v1 five → 1, v2 three → 1, v2 eight kept, choosing 3 afterwards sticks);
test/tenancy.mjs (a free artist's songCost → 402). Fixtures that cast more than
one vote now set 3 free votes explicitly (connect, request-payments, storefail,
foundations, split, sheets, everyshow, playonewrite, netcap).

In a browser at 375 px against tools/mock.mjs: the setlist rows show one "…",
which opens the Actions sheet (Edit, Hide, Delete). Edit from that sheet opens
"Edit song". Settings shows "Votes per song" with 1 selected.

Live on myset.vip as `7c87dbe` (#250), production deploy 6ac8a059, checked by content: /studio serves studio.js?v=87d2e539 holding `saveSongCost`, `window.rowMenu` and `songmore`; /studio carries the `.songmore` style; /vote.html holds `isReplay`; /api/show answers `freeCredits: 1` for the founding room (migrated from 3).

**Not checked:** the fan vote sheet at 2 votes per song in a browser; the swipe
tray and long press on a real phone after the change.
