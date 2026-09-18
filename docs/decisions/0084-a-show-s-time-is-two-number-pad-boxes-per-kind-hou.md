---
id: 0084
title: A show's time is two number-pad boxes per kind, hours and minutes, never parsed from one
date: 2026-09-18
status: decided
decided_by: perry
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/bizmath.mjs, tools/uicheck.mjs]
files: [public/biz.js, netlify/functions/_biz.mjs, public/studio-money.js, public/studio.js, public/about.html]
---

## The question

The time boxes took one string per kind — "2:15", "2h 15m", or a bare number that
meant hours — on the normal keyboard, so the letters could be typed. The founder
kept logging **hours where he meant minutes**: a bare "45" is refused past 48, but
"2" for two minutes of set-up is two hours and nobody is told. Decision 0082 had
just moved the boxes to the text keyboard to make "h" and ":" typeable; the fix is
not a better parser but no parser at all.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Two boxes per kind, **hours** and **minutes**, each a whole number on the phone's number pad; the unit sits after the box, not after the category; a minute box past 59 rolls into the hours on the way out; *On stage* on a gig form shows the slot's h and m as its placeholders | Two inputs where there was one; `parseHm` stays for the report's `?hours=` and old drafts | `Biz.parseHms(h, m)`, `data-u` on the box | A wrong roll-over — covered by `tools/uicheck.mjs` (90 → 1 h 30) |
| B | Keep one box, add "h" / "m" unit picker | A tap per entry the founder would not make | A picker | The same mistake with one more control |
| C | One box, minutes only | "135" for a two-and-a-quarter-hour set; nobody thinks in minutes past an hour | None | The opposite mistake |
| D — do nothing | Leave the parser | Nothing | None | The founder's book keeps hours that were minutes |

## What was chosen, and why

A. The mistake was structural: one field was carrying a unit the person had to
remember to type. Two fields carry the unit in their labels, so there is nothing to
remember and nothing to parse; the number pad follows because a whole number is all
either box takes. A decimal, a letter or a total past the cap is still refused with
the shake (the boxes are whole numbers: "1.5" in hours is 1 h and 30 in the next box).

The stored shape does not change — `min[kind]` is still minutes — so nothing on the
server, in the book or on the report moves. The category was also renamed at the
founder's word: *Set-up / break-down*, in the client and the server copy of
`TIME_KINDS` (the overview's §2.1 reads it from the server).

The button under the last show's tiles now reads *Edit last show's numbers*: it is
shown for whichever show was last, which is tonight's only on the night.

## What this makes harder

Nothing on the keyboard beyond digits — a "1.5" habit now shakes. A very long entry
(the 48-hour cap per kind) is 48 in the hours box; the minutes box takes any whole
number and rolls it, so "300" minutes is 5 h.

## What would reverse it

An artist asking for a duration typed as one string (a picker, option B, not the
parser back).

## How it was verified

`sh test/run.sh` — exit 0 (51 suites' "passed" lines; `test/bizmath.mjs` 190
assertions, `parseHms` blank / 2 h 15 / minutes alone / 90 unrolled / decimal, letters
and the cap refused). `node tools/uicheck.mjs` — exit 0, 244 ✓: two numeric boxes with
the label bare ("Travel"), a decimal minute box refused with the shake, 90 minutes
rolls to 1 h 30, the gig form's *On stage* placeholder is the slot's hours with the
hint naming the gig's length, a refused time still blocks *Add it* with the toast, the
refocus never lands in a dismissed sheet (two stale 0082 expectations in the same
tool — the fold at five and *Past shows* — were repaired in the same change). Looked at
in Chrome at 375px against `tools/mock.mjs`: four rows, `3 h 0 min` from the run's
slot, the sheet at 375/375. NOT checked: the number pad on a real phone (the
`inputmode` is asserted, the keyboard is not).
