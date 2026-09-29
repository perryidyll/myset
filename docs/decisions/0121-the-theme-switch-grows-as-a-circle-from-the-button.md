---
id: 0121
title: The theme switch grows as a circle from the button, everywhere theme.js runs
date: 2026-09-29
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/copy.mjs]
files: [public/theme.js, test/copy.mjs]
---

## The question

HQ's light/dark button (decision 0108's page, `public/crm.html`) reveals the new
theme as a circle growing out of the button. The user asked for the same effect in
the app itself, and asked whether it would cause lag. Every page's toggle goes
through `public/theme.js`, so the question was how to add it there without costing
a slow phone anything, and without fighting the home-screen reload that the toggle
already does on iPhone (theme.js: iOS reads the status-bar colour only at load).

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | View Transitions API in theme.js: snapshot, swap, grow a `clip-path` circle on `::view-transition-new(root)` from the tapped button, 720 ms | ~40 lines in one shared file; the CSS is injected by theme.js on first use, so no page changes | none (browser API, no dependency) | falls back to today's instant switch |
| B | Per-page CSS overlay circle painted in the new colour | a fake: text would pop, not reveal; edits in eleven pages | an overlay element per page | mismatched colours per page |
| C | Leave the app as it is | nothing | none | none |

## What was chosen, and why

A. The browser photographs the old page and composites the new one through a
growing circle on the GPU; nothing is re-laid-out during the animation, so there is
no lag to speak of. It runs only where `document.startViewTransition` exists (iOS 18+,
recent Chrome), never with `prefers-reduced-motion: reduce`, never while the page is
hidden, and any throw falls back to the instant swap — "nothing may break the gig".
Taps pause for the 0.72 s the circle plays. The home-screen reload now waits for
`finished` before reloading, so the circle is not cut in half; the scroll nudge that
makes iOS re-sample the status-bar colour also waits for it. `.theme-now` switches off
CSS transitions for the one frame of the swap so the new snapshot is the finished
colours (the same trick as HQ's `.thm-now`).

## What this makes harder

A page that one day uses its own view transitions has to share the root one with
theme.js. `MySetTheme.toggle(el)` now takes an optional origin element; called bare,
the circle grows from the top centre.

## What would reverse it

Reports of stutter or a stuck page on a real phone at a show, or iOS changing how
view transitions interact with the standalone reload. Reversing is deleting the
`startViewTransition` branch; the instant swap is still the fallback path.

## How it was verified

`sh test/run.sh` green (new check in `test/copy.mjs`). Headless Chrome at 390×844
against `tools/mock.mjs` `/studio?tab=settings`: 300 ms after the tap the
`::view-transition-new(root)` animation ran `circle(0px at 262px 34px)` →
`circle(851px …)` from the button, the screenshot showed dark inside the circle and
light outside; at 1.2 s the theme was dark, stored, the icon ☀︎ and no class left
behind. With reduced motion emulated the switch was instant. Not checked: a real
iPhone, including the home-screen reload after the circle.
