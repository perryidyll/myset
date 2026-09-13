---
id: 0059
title: every ring is the brand gradient and the audience colour is the logo's pink-orange
date: 2026-09-13
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [tools/uicheck.mjs, test/decline.mjs, test/structure.mjs]
files: [public/app.css, public/lock.css, public/index.html, public/artist.html, public/vote.html, public/venue.html, public/community.html, public/artists.html, public/studio.html, public/venue-studio.html]
---

## The question

Since 2026-09-12 every thin ring on the site — the finder, the two front-door
chips, the RSVP pills, the Up next and setlist windows, the Studio's Upgrade and
"See what fans see", the selected tab's pill — was one flat orange (`--accent-2`,
`#FF7A45`), and the same orange carried the audience's words ("vote on your
favorite songs", RSVP, Community, "Next: Tonight 6:30pm", the Studio's section
headings) and the pulse on the right edge of the scrolling windows. The founder,
looking at the front door, asked for every ring to run the way the Search button
does — pink-red at the left, orange at the right — and for the orange words, the
glow and the page menu to take the logo's pink-orange instead of the flat orange.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Every ring paints `--grad` (the Search button's and the logo mark's fill). Where the ring was an inset `box-shadow`, a `::after` pseudo-element carries a 1.5px band of the gradient, masked out of a full cover, so nothing moves. Where the box already had a real border — a scroll window, whose pseudo-elements would scroll away with its rows; an input, which has none — the gradient is painted to the border box and the box's own colour to the padding box. `--accent-2` becomes `#FF5650`, the middle of the gradient. | Two recipes instead of one token; a page that draws a ring must say which. | The masked pseudo-element (`-webkit-mask` + `mask-composite`). | A browser without `mask-composite` shows a full gradient fill instead of a ring — every current phone has it. |
| B | Paint the gradient with `border-image`. | Loses the corner radius: `border-image` ignores `border-radius`, and every ring here is a pill or a card. | none | Square-cornered pills everywhere. |
| C | Keep flat rings, only retint `--accent-2`. | The founder's actual ask — the hue shift — is not met. | none | none, but it is not what was asked. |
| D — do nothing | | The site keeps a flat orange that is not the brand's colour. | | |

## What was chosen, and why

A. The founder asked for it, and the gradient was already the brand: the logo
mark, the Search button and every primary button are `--grad`. A flat orange next
to them was the odd one out. The pseudo-element recipe was chosen over a real
border because a ring that was an inset shadow costs no layout, and the pages
were tuned to the pixel the day before; the border-box recipe is used only where
a pseudo-element cannot work.

`--accent-2` is `#FF5650` rather than the exact midpoint (`#FF5152`) — a touch
warm of centre, so it still reads apart from `--accent` (`#FF375F`), which stays
the colour of warnings and the live state.

## What this makes harder

A new ring is two lines, not one: `position:relative` and the `::after` block (or
the double background on a bordered box). `docs/design-system.md` §2 carries both
recipes; copy one rather than reaching for a flat colour.

## What would reverse it

The founder looking at it on a phone and preferring the flat ring; or a phone
that does not compose masks turning up in the room (it would show a filled
gradient pill — visible, not broken).

## How it was verified

- `sh test/run.sh` — exit 0, 2,290 ✓, 0 ✗ (`test/decline.mjs` now asserts the
  gradient ring on the vote page's search, sort bar and list; `test/structure.mjs`
  still holds `@keyframes edgeGlow` byte-identical between `studio.html` and
  `vote.html`).
- `node tools/uicheck.mjs` against the branch — 113 ✓, 0 ✗, including the vote
  page's three rings, the Studio's Up next window reading `linear-gradient(135deg,
  rgb(255, 55, 95)…` on its border box, and the promotion sheet's bullets in
  `rgb(255, 86, 80)`.
- `node tools/sheetcheck.mjs` — 12 ✓.
- Headless Chrome at 390×844 (scratchpad harness, fixtures from read-only GETs of
  production): the front door, the artist page, the vote page and the Studio's
  Live tab were looked at — the rings run pink-red to orange, the words are the
  new colour, the menu is two bars, the glow is pink-orange.
- Not checked: a real iPhone; the Studio's Setlist and Gigs tabs painted from a
  signed-in stage (uicheck covers their shells); the deploy preview is the next
  look, then the founder's phone.
