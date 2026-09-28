---
id: 0107
title: The pre-show checklist asks for one big sign and 25–50 small table cards, and the sign page prints both in one go
date: 2026-09-28
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: [c940a6e]
tests: [test/tipdecks.mjs, test/structure.mjs]
files: [public/sign.html, public/studio.js]
---

## The question

The founder, 2026-09-28: "make sure the pre-show checklist doesn't just say print one large QR code but also to print 25-50 small ones to place on the tables and bars (do this for the actual live pages as well)". The first-gig card said *Print your sign — Big QR, your name, one tap to print*, and the Today checklist before every later show said *QR code printed or shown*. The sign page printed one page, one code. A room votes from its seats, and one sign at the door reaches the people who walk past it, not the ones sitting down.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Both checklists ask for one big sign plus 25–50 small cards. The sign page prints the big sign on page one, then **Table cards**: None · 24 · 36 · 48, twelve to a page with dashed cut lines. The default is 36, and each phone remembers its choice. One Print does both | Four pages of paper by default | A card grid in `sign.html`, one choice kept in `localStorage` | Someone prints 36 cards when they wanted one sign. The switch is on the same screen, and the choice is remembered |
| B | Change the checklist wording only, and let artists make their own small codes | — | — | The checklist asks for something the product cannot make |
| C | A separate "table cards" page | Two print pages to keep in step | A second page | The checklist's one tap prints only half of what it asks for |
| D — do nothing | — | — | — | What the founder asked for is not there |

## What was chosen, and why

A. The founder's words: the checklist names both and the room gets both. Twelve cards to a US Letter or A4 page give a code about 4 cm across, which scans from a table. Twenty-four, 36 and 48 are two, three and four pages, and they bracket the 25–50 the founder named. Thirty-six is the middle. Each card carries the same four things as the sign: the name, *Pick the next song*, the code, the address. The code is drawn once and shared by every card, so 48 cards load as fast as one.

The same round updated every other place that talked about printing:
- The first-run's last step: "One big one for the door, and 25–50 small ones for the tables and the bar: the print has both", with the button **Print my QR codes**.
- The big-code sheet now has a **Print** button.
- Settings → Codes to print: "…print the big sign and 25–50 table cards in one go".
- The *Earn more tonight* tip: "Put a small QR card on every table and along the bar".

In a sample's look-only Studio, printing opens the claim sheet instead. A sample has no public code until it is claimed.

## What this makes harder

Nothing much. The print page is one page longer to read. A venue's codes are unchanged: a venue has no pre-show checklist.

## What would reverse it

Artists reporting that the cards are too small to scan in a dark room (go to nine to a page), or printers cropping the grid (the page uses `@page` margins of 10 mm).

## How it was verified

The sign page on `tools/localhost.mjs` at 375 px shows the switch, with 36 chosen and three sheets. Printed to PDF by headless Chrome, it came out as four pages: the big sign, then three pages of twelve cards each, cut lines and the pink-orange line intact (checked by rendering pages 1 and 2 to images).

The Studio's two checklists read *Print your QR codes — One big sign, plus 25–50 small ones for the tables and the bar* and *QR codes out — The big sign, plus 25–50 small ones on the tables and the bar*. That was read off the rendered cards, and the first-gig card was seen in a sample's Studio at 375 px.

Not checked: a real printer, an iPhone's own print sheet, the live site.
