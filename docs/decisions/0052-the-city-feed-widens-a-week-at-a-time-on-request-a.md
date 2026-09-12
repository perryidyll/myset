---
id: 0052
title: The city feed widens a week at a time on request, and says how wide it is
date: 2026-09-12
status: decided
decided_by: claude
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [featured.mjs]
files: [netlify/functions/events.mjs, public/index.html]
---

## The question

The founder asked for a "View next week's events" control at the bottom of the front-door feed. The feed (`/api/events?country=&city=`) was hard-wired to seven days and said nothing about its own width, so the page had no honest way to ask for more: `/api/artists` carries thirty days but only verified paid artists and no venue-owned events, so building "next week" from it would have silently dropped free-plan artists' gigs and made "Nothing listed for next week yet" a false claim.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The city feed honours `days=` between 7 and 28 and echoes `window` and the matching `horizon`; the page draws the button only when `window` comes back | One more edge-cached copy per city per width tapped (14, 21, 28) | a clamp and one field | none for a phone: an older server sends no `window`, so the page draws no button |
| B | Build "next week" on the page from `/api/artists`' thirty days | nothing on the server | none | free-plan artists and venue events vanish from "next week"; the empty-week line would lie |
| C — do nothing | Seven days, no button | — | — | the founder's ask stays unmet |

## What was chosen, and why

A. The feed already knew how to widen its own window (the artist-diary shape takes `days=`); letting the city shape take the same parameter, clamped, keeps one source of truth for what is on. Echoing `window` is what lets the page follow rule 3 — never a button the server would refuse — and it is why the page shipped ahead of this record without showing anything wrong.

## What this makes harder

Three more cached shapes per city at the edge; a change to the feed's row shape now has four widths to think about. The picker's counts (`countUpcoming`) still count seven days, on purpose — the picker says what is on this week.

## What would reverse it

Enough listed gigs that a four-week city feed grows past what a phone on bar Wi-Fi should pull (the artist diary was cut from 44 KB to 13 KB for that reason; the same measure applies here), or a paged feed that makes the whole-window read unnecessary.

## How it was verified

`test/featured.mjs` § THE WINDOW: the plain feed says `window: 7` and does not list a gig ten days out; `days=14` says 14, moves `horizon`, and lists it; `days=3` stays 7; `days=99` stops at 28; `days=abc` is the plain feed — `75 passed, 0 failed`. The page side (button appears only with `window`, one fetch per tap, the empty-week line, the failure note) was exercised in a scratch browser harness against a fake server honouring `days=` — 45 checks, 0 failed — and, before this record, against a server without `window`: no button. Not checked: the real edge cache holding four widths per city.
