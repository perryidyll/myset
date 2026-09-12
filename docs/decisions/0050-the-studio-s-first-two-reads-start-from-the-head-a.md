---
id: 0050
title: the studio's first two reads start from the head, and its functions are pinged awake
date: 2026-09-12
status: decided
decided_by: perry
area: performance
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/fandoor.mjs, test/structure.mjs, test/run.sh]
files: [public/studio.html, netlify/functions/autocron.mjs, netlify/functions/community.mjs]
---

## The question

The founder: the fan pages are faster now, but the artist Studio still takes
5–7s to open; cut it in half. What the Studio does on open: it is one 328KB page
(98KB compressed) whose script sits at the bottom, so nothing is asked of the
server until the whole page has arrived and parsed; then `/api/stage` and
`/api/admin` (planGet) are called together — two functions that each sleep on
their own and cost ~1.8s to wake (measured 2026-09-12: a sleeping function
answers in ~2.1s, a warm one in ~0.3–0.5s). `admin.mjs` also carries the Stripe
SDK at the top of `_billing.mjs`/`_connect.mjs`, so its wake is the heaviest.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | (1) a `<head>` script starts the stage read and planGet with the stored session before the page body arrives; `api()` uses each answer once; (2) autocron's warm ping also GETs `/api/stage` and `/api/admin` (unauthenticated, refused in ms, but awake) — three pings every fourth minute, ~32k calls a month in all | ~21k more function calls a month than 0049 alone | one head script; two more pings | a stale `__early` answer used twice — closed by nulling each slot on use |
| B | make the Stripe SDK lazy in `_billing.mjs`/`_connect.mjs` (17 sync call sites become async) | a wide edit through money code | none | a missed `await` in a payment path |
| C | split the Studio's script out of the page into a cached file | a refactor of a 4,900-line file another session is editing | a build step or a second file | merge conflicts, and a stale script against a fresh page |
| D — do nothing | | | | 5–7s stays |

## What was chosen, and why

A — the founder asked for half; A takes the two waits that are serial today (the
page parse before the first request, and the sleep) and leaves the ones that are
not (the page's own bytes, which the edge now serves in 0.05s on a repeat open,
decision 0048). B and C are real but wide, and touch files under another
session's hands tonight; they stay on the list if the phone check says A was not
enough. `venue-studio.html` was not changed — the founder asked about the artist
Studio; the same head script would fit it.

## What this makes harder

The head script must send exactly the headers `api()` sends, or the early
answer is a 401 and the Studio gates; the two are three lines apart in the
file with a comment pointing each way. Every extra function the Studio depends
on at first paint must be added to the ping or it sleeps alone. The ping
count is now a line item: ~32k calls a month at three pings per fourth minute.

## What would reverse it

Netlify pricing the pings above their worth; the Stripe SDK being made lazy in
the money modules (then `/api/admin` wakes fast on its own); the Studio's script
moving to a cached file (then the head start gains little).

## How it was verified

`sh test/run.sh`: 2191 assertions, 0 failed — including `test/structure.mjs`'s
rule that the offline flag is set in exactly one place in the Studio (the first
cut of the head start broke it and was rewritten so the early promise takes the
place of `fetch()` inside the same try). `test/fandoor.mjs` 23/23 checks the
three pings. NOT verified on a phone; production timings after the deploy in the
session note.
