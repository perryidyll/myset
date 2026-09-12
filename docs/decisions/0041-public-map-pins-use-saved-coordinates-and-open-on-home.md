---
id: 0041
title: Public map pins use saved coordinates and the home map opens without navigation
date: 2026-09-12
status: decided
decided_by: perry
area: ui
reverses: 0040
superseded_by:
invariants: [0ah]
commits: []
tests: [test/place.mjs, test/copy.mjs, tools/uicheck.mjs]
files: [public/index.html, public/artists.html, public/studio.html, netlify/functions/admin.mjs]
---

## The question

Address geocoding at map-open time rejected valid Thai addresses and made pins and
list letters disappear. The home-page View on map link also navigated to Find artists
before that page opened its own modal, so closing the modal left the user on the wrong
screen.

## What was chosen

Coordinates stored on a gig are the only source for public pin placement. When a gig is
saved, Studio resolves its allow-listed Maps link, geocodes the canonical address once,
and includes the resulting latitude and longitude in the event record. Editing without
changing the place preserves them; changing the place resolves a new pair. Public map
pages read those numbers directly and never geocode a venue or address.

View on map on the main home page is a real button with a modal owned by that page. It
does not share hit space with Search for artists, does not navigate, and closing it
returns focus to the same button on the unchanged home page.

## Migration

The six current recurring event records were backed up, then populated with canonical
addresses and coordinates for the five unique venues. The read-back matched the written
document byte-for-byte and every record now has both numbers.

## Failure boundary

If a future gig cannot be resolved at save time, it remains in event lists and keeps its
Directions link, but it cannot receive a public map pin until coordinates are saved.

## Verification

- Event tests pin coordinate resolution and persistence.
- Copy tests require both public maps to be coordinate-only.
- Rendered checks require the home modal to open and close without changing pathname.
- Production verification must confirm five unique markers and nonblank list letters.
