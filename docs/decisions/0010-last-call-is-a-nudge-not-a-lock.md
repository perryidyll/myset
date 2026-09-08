---
id: 0010
title: The ten-second countdown nudges the room; it does not close voting
date: 2026-09-07
status: decided
decided_by: claude
area: ui
invariants: [0f8]
commits: [d4a24ed]
tests: [test/darkroom.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/show.mjs, public/studio.html, public/vote.html]
---

## The question

Perry asked for a ten-second countdown button on the Studio's Live tab, producing a
countdown box at the top of the audience page. The unstated question: when it reaches
zero, does voting close?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. A nudge. Voting stays open at zero** | One button, one meaning | Somebody may expect it to close voting | `show.countdownAt`, `countdownIn` in the payload | The artist thinks voting closed and it did not |
| B — close voting at zero | One tap does the whole job | A button that silently does two things is the harder one to explain on stage — and there is already a switch for closing voting, right above it | a coupling between two controls | An accidental tap ends voting mid-song |

## What was chosen, and why

A. There is already a Voting switch, and it lives in the same box. Two labelled controls
beat one that does two things.

Three implementation decisions worth keeping:

- **It sends time LEFT, not the moment it ends.** `show.countdownAt` is a server
  timestamp, but the payload carries `countdownIn` in milliseconds. A phone whose clock
  is four minutes fast would read an end time as long past and show nothing at all.
- **A later poll can never shorten a running countdown.** Polls land at unpredictable
  moments; a box that jumps backwards reads as broken.
- **The number lives in `_lib.mjs`, not in `admin.mjs`.** `show.mjs` is the endpoint
  every phone in the room polls and it must not import a handler to read a constant.

## What this makes harder

**The honest limit:** the audience polls every few seconds, so somebody may open on "7"
rather than "10" — and in a big room, where the poll interval is deliberately longer,
some phones will not see it at all. That is the cost of not holding a socket open per
person. A countdown is a nudge; it does not have to reach everyone to do its job.

## What would reverse it

An open line to the room (decision 0012), which would make it reach everybody. Even
then, whether it closes voting stays a separate question.

## How it was verified

`test/darkroom.mjs` asserts the countdown does not close voting, and
`tools/uicheck.mjs` renders the box in a real browser at a 390px viewport and checks it
pins to the top without reflowing the page.
