---
id: 0021
title: Live shows end after three hours without artist or audience voting activity and are filed with a dated title
date: 2026-09-10
status: decided
decided_by: perry
area: ops
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/autoshow.mjs]
files: [netlify/functions/_auto.mjs, netlify/functions/_lifecycle.mjs, netlify/functions/_history.mjs]
---

## The question

An accidentally abandoned live show could remain open indefinitely. Perry chose a
three-hour inactivity boundary and asked for automatic endings to remain useful in the
artist's records.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Track live shows; end after three idle hours | One bounded cron pass | A live index | Missing activity could end early |
| B | End at a fixed duration after start | Simpler | None | Long real shows end early |
| C — do nothing | Leave shows open | None | None | Stale live pages and merged records |

## What was chosen, and why

Perry explicitly chose inactivity rather than a fixed show length. Artist actions and
audience votes/requests refresh activity. Manual endings accept a title; automatic ones
use `Untitled show – YYYY-MM-DD`.

## What this makes harder

The scheduler reads each indexed live show and its fan records until it ends.

## What would reverse it

Revisit if legitimate shows regularly contain silent gaps longer than three hours, or
if the live index becomes a measurable scheduler cost.

## How it was verified

`test/autoshow.mjs` asserts manual titles, explicit discard-without-history, three-hour
idle endings, the inactivity reason, and automatic dated titles. The full gate stamped
1,825 passing assertions.
