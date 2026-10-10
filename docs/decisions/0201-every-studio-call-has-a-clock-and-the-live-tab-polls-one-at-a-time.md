---
id: 0201
title: Every Studio call has a clock, and the Live tab polls one at a time
date: 2026-10-09
status: decided
decided_by: claude
area: ui
reverses:
superseded_by:
invariants: [0jd]
commits: [56555bc]
tests: [test/studioclock.mjs, test/onetap.mjs]
files: [public/studio.js, tools/mock.mjs, test/studioclock.mjs]
---

## The question

The scale audit of 2 October 2026 (*No request on any page has a timeout*, *The Studio slows down exactly when the room is biggest*) found that no call the Studio made had a clock. Decision 0143 gave the vote page one; the Studio was left as it was. A store that stalls holds a function for as long as the platform lets it run, and the Studio waited with it: the overlay stayed up, `WRITING` never let go so every tap after it was dead, and the Live tab's poll, a `setInterval` every four seconds, started a new stage read on top of the last one each lap. The stage read is the heaviest call the Studio makes (the show, the twelve fan files, the requests), so a store already slow under a big room was asked for more of it, by the artist's own phone, at the moment the room was biggest. The founder asked on 2026-10-09 for every audit item that needs no answer from him to be done.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: a clock on every call, by kind; one poll at a time** | `api()` races each call against a deadline and aborts the request when it passes: a GET at `READ_MS` (10 s), a POST at `WRITE_MS` (20 s: most of the Studio's reads are POSTs to `/admin`, and some ask Stripe), the first stage read at `FIRST_MS` (30 s: a failed first load shows the sign-in screen), a photo at `UPLOAD_MS` (60 s). The seven calls that cannot go through `api()` (two CSV downloads, the profile and lyrics reads, the map key, a sample's two doors) go through `clocked()`, the same abort at a deadline. The artist's own tap that gives up says *"No answer yet — it may still go through. Check the screen before you tap again."* and reads the stage. The Live tab's poll skips a lap while its last read is out. | A few lines in `api()` and `start()`; a write that lands after its clock reads as a hiccup until the stage read shows it. | One deadline per call; a flag on the poll. | A clock too short on a slow bar network turns a slow answer into a hiccup. The numbers sit well above the server's own 4 s read clock (0142), and the next poll recovers. |
| B — one clock for everything | 10 s on every call. | Simplest. | One constant. | A photo upload on bar wifi, a Stripe-backed Money read and the first load would fail that now succeed. |
| C — a stage summary that redraws only on change (the audit's second half) | A small payload in place of the whole stage. | `stage.mjs` and the Live tab's render; #240 is editing `stage.mjs`. | A second stage shape. | Larger change for the same night; left for later. |
| D — do nothing | — | — | — | The Studio hangs exactly when it is needed, and piles reads onto a slow store. |

## What was chosen, and why

A, because the danger was the Studio waiting for ever, and the cheapest fix is a clock, set per kind of call so that slow-but-healthy calls still finish. The tap message borrows decision 0151's rule: with no answer, read the stage before letting another tap through, because the write may have landed. A background POST (`quiet`) that gives up is a plain dropped connection: the artist did not ask for it and the next poll repeats it. The one-at-a-time poll is what the audit called the overlap guard, the Studio half of what 0143 did for phones.

## What this makes harder

A write that takes longer than 20 s now reads as *"may still go through"* while it is still running, and the artist sees the result on the next stage read rather than as the answer to the tap. A caller that legitimately needs longer must pass its own `timeout`; the four photo uploads do.

## What would reverse it

A real night where a healthy call takes longer than its clock (seen as a run of *Connection hiccup* toasts with the store answering): raise that clock. The stage summary (option C) would change the poll, not the clock.

## How it was verified

- `node test/studioclock.mjs` → 30 ✓ / 0 ✗. It runs `api()` and `start()` as shipped, with fetch, `load()` and the interval stubbed: a read that never answers gives up, is offline and aborts its request; the artist's tap that never answers says it may still land and reads the stage once; a quiet POST is a plain dropped connection; a body that never finishes is stopped and aborted; an answer in time is the answer, its clock stopped, and 0199's renewed token is still kept; three laps while a poll is out start nothing, the next lap after it answers does; `studio.js` has no `fetch` outside `api()` and `clocked()`, and `clocked()` aborts a request that never answers.
- Knock-outs, each red then restored and `cmp`-checked: the poll flag (5 ✗), the tap message (3 ✗), the abort (2 ✗).
- In the browser pane against `tools/mock.mjs` with a new `?slow=<ms>` switch: at `slow=12000` the Studio booted (12 s, under the first-load clock), and over 35 s on the Live tab 3 stage reads started, never more than 1 in flight, 2 gave up at 10 s, no sign-in screen, the show still live (before, a 4 s interval over 12 s reads keeps three in flight). At `slow=25000` an End-song tap answered after 20.1 s with the *may still go through* toast and `WRITING` released.
- Not checked: a real phone on bar wifi; a real slow store.
