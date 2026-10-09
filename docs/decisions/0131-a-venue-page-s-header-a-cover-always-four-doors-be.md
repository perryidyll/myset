---
id: 0131
title: A venue page's header: a cover always, four doors beside the square, the links under the tagline
date: 2026-10-01
status: decided
decided_by: perry
area: venues
reverses:
superseded_by:
invariants: []
commits: [db02acf]
tests: [test/factory.mjs, test/samples.mjs]
files: [public/venue.html, public/sample.js, netlify/functions/_fai.mjs, netlify/functions/_fsrc.mjs, netlify/functions/_factory.mjs, netlify/functions/_sample.mjs]
---

## The question

The founder rebuilt Sand & Tan's generated page (2026-10-01) and found four things: the cover was missing (an empty gradient), a lone photo sat awkwardly above the Directions button, the links strip was far down the page, and the space to the right of the square photo was blank. They asked for the links directly under the one-sentence description, and for Menu, Events and a "What guests say" button (to the community page), built like the artist page's doors, in a 2×2 in that blank space.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The page falls back to its last photo as the cover; the generator also takes a venue's best wide photo (≥ 800 px) when none passes the strict cover bar; photos past the cluster live in the lightbox (swipe, arrows, "+N" on the last thumb); four doors beside the square; links under the tagline; the generator reads a menu link off the venue's own site | One more pass over a page's anchors; a lightbox that swipes | `jump()`, `GALLERY`, `parsePage().menu`, `payload.menuUrl` | A poor cover on a venue with only weak wide photos |
| B | Keep a rail for extra photos, fix only the cover | Nothing | None | The founder's "awkward" photo stays whenever a venue has five |
| C — do nothing | — | — | — | Every generated venue without a hero photo opens on a gradient |

## What was chosen, and why

The founder's word, and the third rule: each door appears only when it leads somewhere. Menu jumps to the menu, or opens the venue's own menu link; Events jumps to Coming up; What guests say opens `/v/<slug>/community` (on an unclaimed sample, whose community page does not exist yet, it says so in a toast rather than open a dead page); Directions opens the map. When one is missing, Call and then Share fill the gap; with only three, the last takes a whole row. The fourth door is Directions: the founder listed three and asked for four, and Directions was the one button the rest of the message named. A venue with no photos gets the doors as one row under its name.

## What this makes harder

The cluster is now full: a fifth photo can only be reached through the lightbox. A generated menu is a link, never items: nothing reads prices off a site.

## What would reverse it

Guests not finding the extra photos (then a rail comes back, but only for two or more), or covers picked by the fallback looking worse than the gradient did.

## How it was verified

- `test/factory.mjs` (152 ✓): a venue with no 1000-px cover takes its best wide photo, an artist does not, a tall photo is never a cover; a venue's menu link is found by its words, then by a menu path or PDF, same site and https only.
- `test/samples.mjs` (120 ✓): a sample made with a menu link serves it as `venue.menu.url`.
- `tools/localhost.mjs` at 375 px and 320 px, light and dark: four doors 112 px tall beside the 112-px square; three doors with the last spanning; the no-cover case draws the last photo as the cover with no stray photo; Menu jumps to the menu section and highlights it; the lightbox steps 2 / 5 → 3 / 5 → 1 / 5 and Escape closes it; a sample's What guests say shows its toast; no horizontal overflow.
- Not checked: Sand & Tan itself (a sample; not opened on production or a preview, since opens are counted). It needs a Rebuild for the generator's cover and menu changes; the page-side cover fallback applies without one.
- **Live as `db02acf` (PR #182, which carried 0131 and 0134):** merged on the founder's word 2026-10-01; checked by content on myset.vip — `/venue.html` carries `function ratingHtml`, `/crm` carries `function detailsHtml`. Suite 5,105 ✓ on the branch after merging main at 02a8aae.
