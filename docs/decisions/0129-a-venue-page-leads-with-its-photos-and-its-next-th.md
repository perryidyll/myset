---
id: 0129
title: A venue page leads with its photos and its next three shows
date: 2026-09-30
status: decided
decided_by: founder
area: venues
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/samples.mjs, test/factory.mjs]
files: [public/venue.html, netlify/functions/_fai.mjs, netlify/functions/_factory.mjs, netlify/functions/_sample.mjs, netlify/functions/factory.mjs, public/crm.html, public/factory.html]
---

## The question

The founder, on the first generated venue page: "on venue pages (all, not just the sample ones) please only the next 3 performances and hide the rest in a collapsible section with a 'see more' button"; "make the links do the exact same scrolling carousel animation that the artist pages have"; "model the way the artist profiles are set up with the photos, and go ahead and plug in the best photos you can find for each slot when generating a page (right now sand & tan's are only at the bottom when they need to be the main feature)".

## What was chosen, and why

The artist page's parts, reused rather than reinvented.

- **Photos up top.** The cover as the artist page draws it (Netlify's image CDN, srcset, the stored URL on error), then the cluster over its foot: the first photo as the big square (a venue has no portrait) and the next three as the strip; any beyond four ride a rail under the name. Every picture opens the artist page's lightbox. The old three-column gallery at the bottom and its styles are gone. The thumbnails pop in, staggered; reduced motion draws them still.
- **Coming up**: on now, then the next three; the rest folded under **See more · N**, opened in place (grid rows 0fr → 1fr) and kept open through redraws; the chevron turns.
- **The links** drift like the artist page's: `drift('links', -1)` from `fan.js`, each pill drawn twice (`ghost`), with each network's mark. A finger stops it; reduced motion draws one set, still.
- **The generator** (`_fai.pickPhotos`, `_factory`): a venue wants five photos besides its cover, reads up to sixteen of its site's pictures, and keeps looking until it has five; `_sample.mjs` stores `p0`–`p4`; CRM's Edit profile and the old console offer six venue slots (an artist keeps a portrait and three).

## What would reverse it

A venue page whose best asset is its menu or its hours rather than its room.

## How it was verified

- Localhost at 375 px, a venue with a cover and five photos and a weekly residency: cover, square, strip and rail drawn; See more · 6 opens to its full height and reads See less; the links strip moves and nothing scrolls sideways. The image CDN answers only on Netlify (the page falls back to the stored picture on localhost, as the artist page does).
- Suite as a whole; `test/samples.mjs`, `test/factory.mjs`, `test/hq.mjs` unchanged and green.
- Not checked: a regenerated Sand & Tan on production (Rebuild in CRM after merge).
