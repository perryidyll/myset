# 2026-09-11 — Filtered event map

## Asked

After shipping the artist-directory batch, begin the most effective, attractive and
simple implementation of a popup map showing the actual locations of all events.

## Changed

- The public artist payload now includes every occurrence over exactly thirty local
  calendar dates, with its existing address, coordinates and directions-link shape.
- Find artists has a readiness-gated **View map** action. It opens a compact bottom sheet
  with a labeled static map and the full chronological show list underneath.
- Artist, text, country and city filters also filter the map. The first fifteen unique
  pinnable places appear on the image; every filtered event remains in the list.
- Pins require coordinates, an address, or venue plus city. A bare venue is not guessed.
- Existing exact directions links are preserved. If the image fails, the event list and
  directions remain useful.
- The map image loads only after a tap. No provider request happens during directory load.
- A missing provider key hides the action, so production never offers a dead control.

## Verified

- `test/artists.mjs`: 13 passed, 0 failed.
- `test/copy.mjs`: 33 passed, 0 failed.
- `tools/uicheck.mjs`: popup, exact-coordinate pin, source directions link, accessibility,
  filters and 320px fit passed; all other rendered checks passed.
- `sh test/run.sh` and `node tools/overview.mjs --tests`: 1,876 assertions, 0 failures.
- Draft `6aa3ab8413b61425b33b9fcb` serves the new page and `/api/mapconfig`; the endpoint
  honestly returns disabled because no Google Maps browser key exists.
- Combined draft `6aa3b8e8eedd9a5d7e4e5391` serves the later plan/theme/eligibility
  refinements while keeping the same honest disabled state.

## Production release

The map shipped in production commit `d1a6531`. Google billing and Maps Static API are
active. The browser key is limited to Static Maps and the `https://myset.vip/*` plus
`https://*.mysetvip.netlify.app/*` referrers, and Netlify stores it as a secret in all
hosted contexts. Production reports the map enabled, and a referrer-valid request
returned a real 50,325-byte PNG.
