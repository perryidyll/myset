---
id: 0171
title: A sample's Studio replays its tip decks on every visit
date: 2026-10-07
status: decided
decided_by: founder
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: [public/studio.js, public/venue-studio.js]
---

## The question

A sample's Studio (decision 0101) played its welcome and each tab's tip deck once per
phone (decision 0102, `Tips.first`, remembered in localStorage). The founder walks a
sample's Studio before sending the link, and that walk used up the decks: on the next
look they were gone, so the founder could not check them, and on a shared phone the
artist would not see them either. The public sample page already replays its welcome
every time the link is opened.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A sample replays the welcome each time its Studio opens, then each tab's deck the first time that tab is opened in the visit | A visitor who comes back sees the decks again | One in-memory set per Studio | Decks feel repetitive; the ? still exists either way |
| B | Every tab switch replays its deck | Nothing new | None | A deck in the way on every tap |
| C — do nothing | Once per phone | — | — | The founder's walk hides the decks from the artist on a shared phone, and from the founder's own second check |

## What was chosen, and why

The user's call: the decks open every time a sample's Studio is opened, on every tab,
as the public page's welcome already does. Once per tab per visit, not per tap, so a
tab switch back and forth does not interrupt twice. A reload is a new visit.

## What this makes harder

Nothing for real accounts: they keep `Tips.first`, once per phone. The practice
round's own decks (`pr-*`) still play once per phone.

## What would reverse it

Claimed artists reporting that the decks were in the way on their sample before
claiming.

## How it was verified

`sh test/run.sh`: 33 passed, 0 failed. Behaviour checked in a browser on the deploy
preview (see the PR).
