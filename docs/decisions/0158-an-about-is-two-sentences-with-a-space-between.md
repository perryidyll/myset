---
id: 0158
title: An About is two sentences, with a space between them and no line
date: 2026-10-02
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/factory.mjs]
files: [netlify/functions/_fai.mjs, public/app.css, public/fan.js]
---

## The question

Decision 0135 split a sample's About into one sentence per line, with a hairline between them. The founder looked at the result on Andrew's page and on Sand & Tan's and asked for two sentences with a space between them, not a line. The same applies to venue pages.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | The generator writes exactly two sentences (360 characters asked, 400 kept). The page keeps one sentence per block, with a blank space between them and no hairline. | A prompt change, a cap, one CSS block | A thin set of facts may give only one sentence, and the existing gate sends that page to review |
| B | Show only the first two sentences of whatever is stored | One line in `aboutLines` | It silently hides words someone wrote, on real venue pages too |
| C | Keep the hairline, cap at two | One cap | Not what was asked |

## What was chosen, and why

A.

- **Generator:**
  - `COPY_SYSTEM` (bio) and `VENUE_COPY_SYSTEM` (about) ask for exactly two sentences, at most 360 characters in all.
    - Artist: the first says who they are and what they play; the second, where they play or one thing they are known for.
    - Venue: the first says what the place is and where; the second, the music and what to expect.
  - `tidyCopy` keeps two sentences at most, 400 characters in all. A sentence that would take the About past 400 is passed over, so a long first line still leaves room for a short second one.
- **Page:**
  - `.aline + .aline` has a 1em top margin instead of the hairline.
  - The second sentence rises in, scroll-driven where the browser supports it. With reduced motion it is simply there.
  - `aboutLines` is unchanged, so an About someone typed by hand still shows every sentence it has.
- **The two live samples:** Andrew's and Sand & Tan's Abouts were rewritten by hand to two sentences from the same facts, through CRM's `edit` action. These are data edits, not code.

## What would reverse it

- The founder wanting more than two sentences for a richer source.
- Pages coming back with only one sentence too often. The gate's `sentences >= 2` already sends those to review.

## How it was verified

- `test/factory.mjs`:
  - the bio stops at two sentences;
  - a second sentence that would pass 400 characters is passed over for one that fits;
  - the end-to-end factory run gives two sentences, under 400.
- `sh test/run.sh` exits 0.
- NOT checked: a real (paid) generator run.
