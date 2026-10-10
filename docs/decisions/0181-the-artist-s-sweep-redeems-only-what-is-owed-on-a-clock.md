---
id: 0181
title: The artist's sweep redeems only what is owed, newest first, on a clock
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [5c]
commits: [b2dbfec]
tests: [test/delivery.mjs]
files: [netlify/functions/revenue.mjs]
---

## The question

The Money tab's "deliver what's missing" button (POST `/api/revenue`, INVARIANT 5c's
third road) redeemed every paid session in a 180-day window, one after another, and
each `redeemSession` began with a full read of the payments document. The scale audit
(PAY-7) worked it out: 500 paid sessions after a big night is past a function's time
limit, so the sweep died before it reached the payment that actually needed it.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Read the payments document once, keep only sessions with no delivered marker, newest first, stop at a 12-second budget, answer `left` | Nothing new | `SWEEP_BUDGET_MS` | A press that runs out of time leaves the rest for the next press, and says how many |
| B | Move the sweep into the bell with a cursor | A Stripe list per artist per ring | A cursor per artist | Cost grows with artists, not failures; 0138's owed list already covers the webhook's failures |
| C — do nothing | — | — | — | The one road an artist can press fails exactly on the biggest nights |

## What was chosen, and why

A. The delivered markers are already in one document, so one read sorts the window
into "done" and "owed"; a delivered session never costs a `redeemSession` again.
Newest first, because the payment a fan is standing at the bar asking about is the
most recent one. The budget keeps the reply inside the function's limit with room
for Stripe's own paging before it.

## What this makes harder

- The Studio should say "press again" when `left` is above zero. It does not read
  the field yet; a second press is what an artist does anyway when the count of
  undelivered payments does not reach zero.

## What would reverse it

- One file per payment (the audit's structural step).

## How it was verified

`test/delivery.mjs`: a press recovers the one owed session, says `left: 0`, and a
second press finds nothing to do. The whole suite: `sh test/run.sh`, exit 0.
**Not checked:** timing against a real account with hundreds of sessions.
