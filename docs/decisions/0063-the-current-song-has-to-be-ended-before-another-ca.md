---
id: 0063
title: The current song has to be ended before another can start — every ▶ in the Studio asks "End current song?" while one is playing
date: 2026-09-13
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/darkroom.mjs, tools/uicheck.mjs]
files: [public/studio.js, public/studio.html]
---

## The question

At the founder's show on 2026-09-13 (session `2026-09-13-peaceful-easy-feeling.md`)
a tap meant to *select* the top-voted song *started* it: the Studio filed the playing
song, spent the new one's vote and re-drew *Up next* without it, and on stage that
read as a vote vanishing. The Studio had allowed a ▶ at any moment, silently ending
whatever was playing. Three softer fixes were proposed (a toast, a greyed *Now
playing* row, a confirm); the founder wanted a rule instead.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The Studio refuses a ▶ while a song is playing: it opens a small centred window, *End current song?* — red *Yes, end it* / pink-orange-bordered *Keep playing*. *End current song* itself becomes a light-red filled, red-text button. | One more tap between songs when the artist forgot to end the last one | `startSong()` gate, `#ask` window | The window never opens → the old behaviour (a silent switch), nothing worse |
| B | Toast + scroll after a play; greyed *Now playing* row at the top of *Up next* | Explains the switch after the fact; the switch still happens | Toast, a synthetic row | Confuses the queue order |
| C — server refuses `play` while `nowPlaying` is set | Enforces it for every client | Breaks scheduled/automatic flows and eleven test files that start songs back to back; two round trips for "yes" | New 409 | A stale Studio shows a button that leads to a shrug (rule 3) |
| D — do nothing | — | Another vanished-vote night | — | — |

## What was chosen, and why

A, because the founder said so, and because it fits the wording of the record: the
only thing that can start a song is a person's thumb, so the gate belongs under the
thumb. *Yes, end it* sends the very same `play`/`playTop` the button would have —
the server already files the playing song as played and starts the new one in one
write, so there is no second round trip and no new server path. The rule is a
Studio rule, not a datastore one.

## What this makes harder

Rapid segues: an artist who used to tap ▶ on the next song mid-outro now taps
*Yes, end it* too. A second Studio client (the Venue Studio does not start songs)
would have to carry the same gate.

## What would reverse it

An artist asking for a "segue" setting; or the server growing a state machine that
makes the client gate redundant.

## How it was verified

`sh test/run.sh` exit 0 (2,318 ✓): `test/darkroom.mjs` asserts every ▶ goes through
`startSong`, never straight to `act('play'…)`, that the window carries *Yes, end it*
and *Keep playing*, and the three colours. `tools/uicheck.mjs` against a worktree
copy (117 ✓, 0 ✗): the End button computes `rgba(255, 59, 48, 0.14)` on
`rgb(255, 59, 48)`, a tap on ▶ during a song opens the window instead of starting,
*Yes* is `rgb(255, 59, 48)`, *Keep playing* is `rgb(255, 86, 80)`, *Keep playing*
closes it with nothing started. Headless shots `b12-endnow.png`, `b12-ask.png`.
Not checked: on a real phone; the deploy preview is the check.
