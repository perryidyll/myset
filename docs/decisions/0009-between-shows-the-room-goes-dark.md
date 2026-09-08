---
id: 0009
title: With no show running, a fan sees the setlist quiet — not last night's board
date: 2026-09-07
status: decided
decided_by: perry
area: ui
invariants: [0f7]
commits: [d4a24ed]
tests: [test/darkroom.mjs]
files: [netlify/functions/show.mjs, public/vote.html]
---

## The question

A fan opening the voting page between shows was being shown the **last one**: its votes,
its running order, its "Playing now", and the songs it had already played missing from
the list. All true of a night that is over, all wrong for the person holding the phone.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Blank it in the payload; change nothing stored** | Fan sees the whole setlist, no votes, nothing playing, everything priced at 1 | A second shape for the same payload | a `dark` branch in `show.mjs` | The dark branch leaks into a live show |
| B — wipe the show record when a night ends | Simpler payload | **"Resume it instead" stops working**, and an accidental End becomes unrecoverable | none | An artist loses a live gig to a mis-tap |
| C — show nothing at all | Honest | A fan who scanned a QR code on a table sees an empty app and learns nothing about the artist | none | The setlist is the only reason to keep the page open between sets |

## What was chosen, and why

A. **Nothing is deleted to do this.** It is display, and only display: the show record is
untouched, so "Resume it instead" still finds the night exactly as the artist left it,
and the Studio reads a different endpoint so the artist always sees the truth.

The test checks the **record** afterwards, because that is the half that could quietly
ruin a gig.

## What this makes harder

`show.mjs` now has two shapes and every future field has to answer "what is this when
the room is dark?". The `blank()` mapper is the one place that answer lives.

## What would reverse it

Nothing. This is a bug fix wearing a decision's clothes; it is recorded because option B
was genuinely considered and would have been destructive.

## How it was verified

`test/darkroom.mjs` (new, 37 assertions) against the real handlers, including the two
things that must NOT happen: the countdown must not close voting, and going dark must
not touch the show record.
