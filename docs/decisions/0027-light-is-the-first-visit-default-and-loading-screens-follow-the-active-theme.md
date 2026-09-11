---
id: 0027
title: Light is the first-visit default and loading screens follow the active theme
date: 2026-09-11
status: decided
decided_by: user
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/copy.mjs, tools/uicheck.mjs]
files: [public/theme.js, public/index.html, public/about.html, public/artist.html, public/venue.html, public/vote.html, public/community.html, public/artists.html, public/stage.html, public/studio.html, public/venue-studio.html]
---

## The question

What theme should a first visit use, and what should appear before the full page styles
and scripts are ready?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Default to light, preserve a saved choice, and paint every loading state in the active theme | None | A tiny theme bootstrap on each page | A stale bootstrap could flash the wrong color |
| B | Follow the operating-system preference on first visit | Less explicit product control | A live system-preference listener | A first visit may still open dark |
| C | Keep dark as the first-visit default | Nothing | None | Contradicts the requested default and keeps the light-mode loading flash |

## What was chosen, and why

Option A. A visitor with no saved preference sees light mode. A visitor who chose dark
still gets dark immediately, before the page paints. Loading, intro and transition
surfaces derive from the same active palette instead of hard-coding black.

## What this makes harder

Every new top-level page must include the same early bootstrap so it cannot flash the
wrong theme before the shared script loads.

## What would reverse it

Revisit if the product deliberately returns to an operating-system or dark first-visit
default.

## How it was verified

The copy suite checks every page's first-visit and saved-dark bootstraps. Rendered checks
clear storage, confirm the light first frame, and switch dark to light while a loading
screen is present. The full suite completed with 1,876 assertions and zero failures.
