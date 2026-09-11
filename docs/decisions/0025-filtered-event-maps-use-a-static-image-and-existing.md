---
id: 0025
title: Filtered event maps use a static image and existing exact directions links
date: 2026-09-11
status: decided
decided_by: user
area: ui
reverses:
superseded_by:
invariants: [0ag, 0ah, 0al]
commits: []
tests: [test/artists.mjs, test/copy.mjs, tools/uicheck.mjs]
files: [netlify/functions/artists.mjs, netlify/functions/mapconfig.mjs, public/artists.html, netlify.toml]
---

## The question

The Find artists page needs a simple popup map of all relevant events without loading a
heavy map application, guessing a location from a bare venue name, resolving a person's
stored short link on the server, or showing a control before its provider is ready.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Build one Google Static Maps image on demand, with labeled pins and the full filtered event list beneath it | Provider usage and a restricted browser key | One read-only config endpoint | Bad key restrictions or billing make the image unavailable |
| B | Load a full interactive Google map | More provider usage and browser work | Google Maps JavaScript plus lifecycle and accessibility code | A heavy control crowds the small-screen directory |
| C | Use public OpenStreetMap tiles and browser-side geocoding | Nominally free | Tile rendering, geocoder policy compliance and cache/rate-limit handling | Public community services have no production SLA and disallow bulk use patterns |
| D — do nothing | Keep directions links only | Nothing | None | Visitors cannot see all show locations together |

## What was chosen, and why

Option A. The map opens only after a deliberate tap, so the directory remains fast and
does not contact the map provider on page load. It uses exact stored coordinates when
available, otherwise a stored address or venue plus city; a bare venue is never pinned.
The popup keeps the complete chronological event list and existing platform-aware
directions links even if the static image fails. Country, city and artist filters apply
to both the cards and map. The first fifteen unique locations are pinned because the
provider limits address-geocoded markers; every occurrence still appears in the list.

The intentionally public `GOOGLE_MAPS_BROWSER_KEY` must be restricted in Google Cloud
to the Maps Static API and MySet website referrers. Until it exists, the server reports
the map unavailable and the page does not show the button.

## What this makes harder

The map depends on a billed Google Maps API and a correctly restricted public key. An
image is not draggable or zoomable; the directions actions provide the interactive
handoff. Location text without stored coordinates is geocoded by Google, so exact
coordinates remain the strongest event record.

## What would reverse it

Replace the static image if visitors demonstrably need pan/zoom or map-based browsing,
if more than fifteen distinct locations in one filtered thirty-day view becomes normal,
or if provider cost or reliability is no longer acceptable.

## How it was verified

`test/artists.mjs` passed 13/13, including event payload shape and readiness gating.
`test/copy.mjs` passed 33/33. `tools/uicheck.mjs` opened the accessible popup at phone
width, verified the exact coordinate and label in the map request, preserved the source
directions link and found no horizontal overflow. The full suite and overview stamp
completed with 1,876 assertions and zero failures. Draft `6aa3ab8413b61425b33b9fcb`
served the map HTML and disabled config response. A real Google map image was not tested
because no restricted browser key exists yet; nothing from this decision is in production.
