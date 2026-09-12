---
id: 0053
title: The Studio's script is a file the phone keeps
date: 2026-09-12
status: decided
decided_by: perry-confirmed
area: performance
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/structure.mjs, test/_src.mjs]
files: [public/studio.js, public/studio.html, tools/stamp.mjs, netlify.toml, test/_src.mjs]
---

## The question

The Artist Studio was one 312 KB file (98 KB packed), most of it script, and a phone
downloaded and read all of it on every open before the first line of code could run.
After decision 0050 (the head start) and the 6-second render bug found the same
evening, a fresh open measured about 1.8 s — and the founder asked for the page to
stop arriving as one lump. The question was how to split it without making the
Studio worse to use during a gig.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The script moves verbatim to `public/studio.js`, addressed by its own hash (`?v=sha1[:8]`) and served immutable for a year; the shell is 49 KB | One tool to run after editing the script; tests read the pair | `tools/stamp.mjs`, `test/_src.mjs`, one header rule | A forgotten stamp ships old script under a new shell — the suite refuses that |
| B | One page per tab, each its own file | Every tab tap becomes a full page load plus a fresh `stage` read; the shared brain (sign-in, live poll, offline handling) copied five times | five pages | Slower on gig night, five places to fix one bug |
| C | A build step that fingerprints assets | Changes what `public/` means for every session and every rule that assumes it is what is served | a build pipeline | Every deploy depends on a build nobody here has run |
| D — do nothing | 312 KB every open | 98 KB of download and a full parse per open, worse on cellular | none | none |

## What was chosen, and why

A. The founder asked for the effect of B ("the setlist tab as its own page, the
rest in the background"); the tabs were never the weight — they already load their
own data only when opened — so A gives that effect without B's cost. No build
step (C) because nothing else in this repo has one and every session's mental
model is "public/ is the site".

## What this makes harder

Editing the Studio is now two files, and `node tools/stamp.mjs` must run after
every edit to `studio.js` (the structure suite fails loudly if it did not). A
session with an in-flight edit to the old inline script has to port it into
`studio.js` — the code is line-for-line the same, only the file changed. The Venue
Studio is still one file; the same move is open to it.

## What would reverse it

A build step arriving for another reason (then fingerprinting belongs there and the
stamp tool goes), or a measured open where the script download is no longer on the
critical path at all.

## How it was verified

`sh test/run.sh` — the whole suite, 40 files, 0 failed, including the new
`studio.js stamp matches` and `keeps only its small inline scripts (3)` checks.
Deploy preview: `/studio.js` answers `cache-control: public, max-age=31536000,
immutable`, the shell references the stamped URL, and the signed-out gate paints
with no console errors. The signed-in open was measured on production after the
merge with the Settings-tab stopwatch (numbers in the session note).
