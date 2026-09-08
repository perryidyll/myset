---
id: 0015
title: The artist profile has one live voting call to action, and show controls are not duplicated in Settings
date: 2026-09-09
status: decided
decided_by: user
area: ui
invariants: [0ad, 16]
commits: []
tests: [test/copy.mjs, tools/uicheck.mjs]
files: [public/artist.html, public/studio.html, public/vote.html]
---

## The question

The live artist profile offered two links to the same voting page: a cover-photo pill
and the primary button beneath the artist identity. Settings also repeated controls
whose operational homes are the Live and Gigs tabs. The user asked for one clear profile
action and a shorter Settings page.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Keep one primary live CTA, remove the cover pill, and remove duplicate show controls from Settings | Fewer shortcuts, with each action living in one place | None | An action disappears instead of moving to its canonical tab |
| B | Keep both profile CTAs and all Settings controls | No change | None | The two surfaces continue competing for attention and can drift apart |
| C | Merge the proposed profile branch as written | Fastest path to its visible result | None | Its unrelated escaping change would allow profile data to become HTML |

## What was chosen, and why

Option A. While live, the profile's single primary action reads **TAP TO VOTE THE
SETLIST** and links to the same per-artist voting route for every profile. Starting,
ending and resetting a show remain on Live. Venue, city and time remain calendar-gig
data. Open and paused voting remain at the top of Live. The auto-start control now sits
immediately beneath Requests from fans in Settings.

The proposed branch was not merged. Its two intended display edits were reproduced
manually while retaining the existing `esc()` function, which safely entity-encodes
profile content before inserting it into HTML and attributes.

## What this makes harder

Some actions have only one route instead of two. That is deliberate: each still has a
visible canonical home, and the removed Settings-only `saveGig()` function no longer
has absent inputs to dereference.

## What would reverse it

Real-gig evidence that people cannot find the voting entry point, or that artists need
one of the removed duplicate controls while already working in Settings.

## How it was verified

`test/copy.mjs` pins the single CTA, removed sentence and absent Settings controls.
`tools/uicheck.mjs` renders the profile and Settings at phone width, checks that the
cover has no duplicate CTA, and verifies the Settings section order. The full suite
passes 1,737 assertions. Draft deploy `6aa04e5930bf024ac5cfb479` served the new profile
label and Settings order/copy while omitting the retired strings.
