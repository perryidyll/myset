---
id: 0062
title: The name is a first name or a band name plus an optional last name, the registry follows the profile, and the top video leads a drifting strip
date: 2026-09-13
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/sheets.mjs]
files: [netlify/functions/_profile.mjs, netlify/functions/admin.mjs, netlify/functions/_lib.mjs, netlify/functions/_board.mjs, netlify/functions/stage.mjs, netlify/functions/profile.mjs, netlify/functions/community.mjs, public/studio.js, public/artist.html, public/vote.html, public/community.html]
---

## The question

The founder, 2026-09-13, after the link strip went live: every "[artist's first name]"
on the site — *Support Perry*, *Give Perry some love*, *Perry decides*, *Let Perry keep
it* — must work for a band, so the Profile form needs a *first name or band name* field
and an optional *last name*. And with more than three videos, the one the artist ticks
is the hero at full size and the rest drift in a strip under *Watch more from <First>*.

Two things forced design choices. First, the site had **two names**: the registry row's
(written at sign-up, read by the voting page, the stage and the front door) and the
profile's (edited on the Profile tab, read by the artist page and the community page).
"Support Perry" came from the registry, so a Profile-tab edit never reached it. Second,
the voting page's board is the hot polling path (0054 counted its blob hops) — the band
name had to reach it without a profile read.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Profile stores `first` + `last`, rebuilds `name`; a save that carries them also writes the registry row's `name` and `first`; `getShow` hands `artistFirst` from the registry row it already reads; every page names the artist through one helper | One CAS write on the shared registry per profile save that changed the name | `firstOf()` in `_profile.mjs`; `artistFirst` on the board and stage payloads; `mediaHero` action + `hero` flag | A registry write racing a sign-up retries under CAS; a lost one leaves the old name on the voting page until the next save |
| B | Store `first` in the show doc instead of the registry | Same write count, but the show doc is under the room's CAS during a gig and the name would live in a third place | `artistFirst` on the show record | The front door (events.mjs reads the registry) would still say the sign-up name |
| C — do nothing | Keep splitting `name` on the first space | Nothing | None | A band called *The Weekend Warriors* is "Support The" for ever — the founder's complaint |

## What was chosen, and why

A, because the founder asked for band names everywhere and the registry is the one row
every hot path already reads. Making the registry follow the profile also closes the
two-names gap that existed before: what the artist types on the Profile tab is now what
the room reads. The hero is a flag on the media item (`hero`), one at most, and
`normProfile` moves it to the front so any reader that takes `media[0]` agrees with the
tick — the artist page shows it in full and drifts the rest (the `drift()` marquee from
decision-free 2026-09-13 work on the link strip) under *Watch more from <First>*; with
three or fewer videos nothing changes. A tap on a strip card lifts it into the hero slot,
puts the old hero back in the strip, and starts YouTube (`autoplay=1` on the tap).

Profiles saved before the split keep their `name`; the Profile form prefills *first*
from the first word and *last* from the rest — exactly what the site did until now — so
a solo artist saves once and nothing moves, and a band corrects the split once.

## What this makes harder

The registry row is no longer sign-up-only: anything that treats `byId[aid].name` as
immutable (nothing today) would be wrong. The slug never changes with the name. A
first-run flow that writes `name` without `first` leaves the registry as it was.

## What would reverse it

A registry CAS conflict rate visible in the logs, or a second field that needs to
reach the hot paths — at which point the profile's public shape should ride on the
registry row wholesale rather than field by field.

## How it was verified

`sh test/run.sh` exit 0 — 2,312 ✓ / 0 ✗ across 44 files; `test/sheets.mjs` asserts
first + last → name, a band keeps its whole name, a pre-split profile keeps its name,
`firstOf` for a band / a split name / nobody, one hero at most moved to the front, and
no tick → no hero with order kept. `tools/uicheck.mjs` against the worktree 113 ✓ / 0 ✗.
Headless Chrome, artist page with five videos (`shots9.mjs`): sections *Watch & listen*
then *Watch more from Perry*, hero = the ticked one, four real strip cards + four
ghosts, strip drifts 28 px/s; a tap on card m4 makes it the hero with
`…?autoplay=1` and puts the old hero into the strip. Studio Profile tab (`studio9.mjs`):
*first name or band name* prefilled `Perry`, *last name* `Idyll` from a pre-split name,
hero tick checked on the flagged row only. NOT checked: a real profile save against
production (deploy previews write production data), so the registry write path is
verified by reading the code and the suite, not by running it.
