---
id: 0083
title: Every list row that has actions answers a swipe and a hold
date: 2026-09-18
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/structure.mjs]
files: [public/studio.js, public/studio.html]
---

## The question

The founder (2026-09-18): swipe-to-reveal and "hard press" are so common now that
people will try them everywhere, and having them would lift the whole Studio's feel
and perceived value. Which rows, which actions, and where does the code live?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One markup-free module at the foot of `studio.js`: any `.row` / `.songcard` / `.gigcard` that already carries action buttons gets a swipe-left tray and a press-and-hold sheet, both built from the row's own buttons (cloned by label, tapping one is the original button's click) | ~120 lines, a dozen CSS rules | The tray element, the hold timer, a one-time tip toast | A gesture eating a scroll or a tap — guarded by a direction test in the first 6 px and a swallowed click after a swipe |
| B | Per-list markup (`data-swipe` on each row naming its actions) | Every list touched, a second definition of each action to drift from the first | The same, plus a schema | Two code paths for one Delete |
| C | A true "hard press" | Impossible on the web since 3D Touch went; long-press is what every app does now | — | — |
| D — do nothing | Rows stay tap-only | Nothing | None | The founder's point stands |

## What was chosen, and why

A: the rows already declare their actions as buttons, so the gesture layer reads
them and never invents one. Rules: a full swipe only snaps the tray open and never
fires a button — a delete is a tap, not a slip; red only where the page already
paints red (`.act.warn`, or a label starting Delete/Remove); a vertical intent in
the first pixels hands the touch back to scrolling; one tray at a time; `render()`
throws the tray away with the row. The hold is 480 ms still, a haptic tick, and a
sheet with the row's name on top and *Open* first when the row itself is tappable;
the callout and text selection are switched off on rows and on that sheet, because
iOS otherwise starts selecting under the still-held finger (seen on the Simulator).

## What this makes harder

A row whose buttons are `onclick=` rather than `data-act` still works (the clone
clicks the original), but a button that is hidden by CSS is not offered
(`offsetParent` null). The Venue Studio does not have this yet — same module would
port; it was not asked for.

## What would reverse it

Artists swiping to scroll and opening trays by accident (raise the 6 px / 1.2×
direction test); a list whose rows have no buttons but want a hold (add buttons).

## How it was verified

`sh test/run.sh` exit 0. Chrome at 375px: a synthetic touch drag opens the tray with
*Edit · Hide · Delete* (Delete red, Hide grey), `translateX(-…)`, `.swopen`; a 650 ms
pointer hold opens the sheet *Best Part · Daniel Caesar · Edit / Hide / Delete*, and
tapping *Edit* there opens the real *Edit song* sheet. iOS Simulator (iPhone 17 Pro,
Safari, a real touch path): the tray slides in on *Best Part*, a tap on *Hide* fires,
a 0.9 s hold on a song opens the sheet with no selection handles after the
`user-select` rule. NOT checked: a gig row on a real device (the mock has no
events), a Money-tab row's hold, a mouse drag (swipe is touch-only by design).
