---
id: 0036
title: the artist event map is interactive and asks the browser for location only when opened
date: 2026-09-12
status: decided
decided_by: user
area: ui
reverses: 0025
superseded_by:
invariants: [0ag, 0ah, 0al]
commits: []
tests: [test/copy.mjs, test/syntax.mjs, test/run.sh]
files: [public/artists.html, netlify.toml]
---

## The question

The static thirty-day event map shipped safely, but the user explicitly wanted to pan
and zoom it, tap events for details and a Google Maps destination, and see their current
location as a blue dot. That is exactly the reversal condition recorded in decision
0025, so the interaction requirement now outweighs the static image's smaller payload.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Lazily load Google Maps JavaScript after the map button is tapped; geocode address-only venues in the browser; add event popups and browser geolocation | More Google map usage and browser work | Maps JavaScript API, Geocoding API and location-permission handling | Provider/config failure could blank the map |
| B | Keep the static image and hand every interaction to Google Maps | Lowest runtime cost | None | Does not provide in-place browsing or a location dot |
| C | Build a custom tile map on public OpenStreetMap services | Avoids Google JavaScript | Tile maths, controls, geocoder policy and caching | Greater maintenance and reliance on services without a production SLA |
| D — do nothing | Leave the shipped static map unchanged | Nothing | None | The requested interactions remain impossible |

## What was chosen, and why

Option A, because the user asked for the richer interaction and the existing Google key
and event-address payload make it the smallest dependable implementation. The library is
still lazy: opening the directory alone contacts no map provider. Filters still constrain
both cards and pins. A failed provider, denied location permission or failed venue geocode
leaves the complete event list and its directions actions usable.

## What this makes harder

The map now depends on two more enabled Google APIs and additional CSP hosts. Address-only
venues incur browser-side geocoding. Browser location prompts can be declined or disabled
at the OS layer, and the feature must explain that state without blocking the event map.

## What would reverse it

Revisit if measured Google usage becomes material, if the JavaScript map meaningfully
slows real phones, or if a provider/config incident prevents event browsing despite the
list fallback. A native or open-source map is justified only with a reliable tile and
geocoding service MySet can operate within its terms.

## How it was verified

`test/copy.mjs` passed 37/37 and checks the interactive loader and browser-geolocation
path. `test/syntax.mjs` passed every public page and function. `sh test/run.sh` completed
with 2,095 assertions and zero failures. Draft `6aa44be7f6f826fb693f313b` was checked in
Chrome: five unique live venues rendered, an event-row tap opened the correct dated
popup and Google Maps link, a drag changed the center, and Zoom in changed level 12 to
13. Chrome's location permission was set to Allow, but macOS did not return a physical
position to this browser session, so the actual blue-dot placement remains unverified on
a device; the retry control and denial fallback were observed.
