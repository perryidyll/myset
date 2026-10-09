---
id: 0135
title: An About reads one sentence a line, and a cover crops to where the photo is busiest
date: 2026-10-02
status: decided
decided_by: perry
area: pages
reverses:
superseded_by:
invariants: []
commits: [5c0f812]
tests: []
files: [public/fan.js, public/app.css, public/venue.html, public/artist.html]
---

> **Revised by 0158:** the founder later asked for two sentences with a space between them, so the black line is gone. The cover crop stands.

## The question

Looking at Sand & Tan's sample, the founder asked for two changes, on venue pages and on sample artist pages: the cover "could be cropped better", and the About should be "spaced out with a black line between each sentence rather than one big block of text".

Sand & Tan's five photos are all portrait (1440 × 1800). With no wide cover, the page uses the last photo as its cover (decision 0131) and shows it 16:10 at a fixed `center 40%`. On that photo, the window landed mostly on sky, above the tables.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | In the browser, read the 48-px placeholder the page already has, and slide the 16:10 window to the rows with the most detail, weighted just above the middle because the cover's foot sits under the fade and the tiles | No server work, no dependency, about a millisecond | A busy but dull area (gravel, a crowd of chairs) can win over the subject |
| B | Work out a focus point in the factory when the photo is taken | Image decoding on the server needs a dependency, which this repo does not add | — |
| C | A crop control in CRM | The founder places every cover by hand, which they asked not to do | — |

For the About: split the text into sentences and draw a hairline in the ink colour between them. The writer's own line breaks stay as breaks. A full stop after a short abbreviation (St., Dr., e.g.) or before a lower-case word does not end a sentence.

## What was chosen, and why

A, plus the sentence lines.

- **The crop:** a cover that already carries a focus point keeps it. That covers an artist cover taken off a video frame (decision 0101) and any crop the artist set themselves. Only a cover with no focus point is read.
- **Venue pages:** every venue's About is split into sentences.
- **Artist pages:** only a sample's About is split. An artist's own bio keeps the shape they gave it, so a claimed page goes back to plain paragraphs.
- **Motion:** the lines draw in from the left as the card scrolls into view, where the browser supports scroll-driven animation, and on load otherwise. They appear instantly with reduced motion.

## What would reverse it

A cover chosen badly often enough that a stored focus point (option B or C) earns its cost. Artists asking for the sentence lines on their own bios.

## How it was verified

- On `tools/localhost.mjs` at 375 px, with Sand & Tan's real cover photo (p4) placed as Harbour Bar's cover, the crop chose `50% 97%`: the sea and the lit tables, where `center 40%` had shown sky.
- Sand & Tan's three-sentence About drew as three lines with two hairlines. The Tide Lines sample bio drew as two lines, and its stored cover focus (`50% 35%`) was kept. Dark theme: the hairline takes the light ink colour. No horizontal overflow.
- `sh test/run.sh`: exit 0.
- NOT checked: Sand & Tan on production (opens are counted); a real artist page's bio, which is unchanged by design.
