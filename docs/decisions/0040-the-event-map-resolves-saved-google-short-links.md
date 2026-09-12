---
id: 0040
title: The event map resolves a saved Google short link before it guesses from venue text
date: 2026-09-12
status: decided
decided_by: perry
area: ui
reverses:
superseded_by: 0041
invariants: [0ag, 0ah]
commits: [5cfa27d, 51bf8a8]
tests: [test/unit.mjs, test/artists.mjs, tools/uicheck.mjs]
files: [netlify/functions/_maps.mjs, netlify/functions/artists.mjs, public/artists.html]
---

## The question

The Ugly Duckling carried the exact Google Maps share link the artist had pasted,
but the interactive map ignored that source for its pin. Short links contain no
visible coordinates, so the map geocoded the decorated venue name instead and could
choose another business with the same name. The exact source had to remain the truth
without turning every public-directory request into a Google request.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Only the map-rich directory request follows the first redirect from an allow-listed Google short link, extracts its address, and geocodes that exact address; the browser verifies Google's structured city/country before drawing a pin | At most one time-limited HEAD request per uncached unique short link, plus the map's normal geocode | A small resolver, bounded warm cache, and result validator | Google can change its redirect shape; an unverifiable result is omitted rather than shown in the wrong place |
| B | Require the artist to type an address as well as pasting a Maps link | No network lookup | More form validation and repair work for existing gigs | Exact links keep producing bad pins until every calendar is edited |
| C | Omit pins for short links and offer Directions only | No guessing | A visibly incomplete map | The exact place is known but MySet refuses to use it |
| D — do nothing | Keep geocoding venue name plus city | Nothing | — | Ambiguous names keep appearing in the wrong place |

## What was chosen, and why

A. The saved link is stronger evidence than text somebody typed into a venue field.
The resolver contacts only `maps.app.goo.gl`, does not follow or download the target,
validates the redirect as another permitted map URL, stops after 2.5 seconds, and
caches the extracted address. Ordinary `/api/artists` calls do no extra work; only
`?maps=1`, used by the interactive directory, asks for enrichment. The exact saved
source remains the Directions link. Its canonical Google address overrides conflicting
typed address text. Before the browser draws any pin it compares Google's typed
`address_components` with the saved city and country. A result Google calls partial is
accepted only when a specific structured address fragment still matches the saved
address, including Google's untyped local-address component used for Thai addresses;
saved coordinates are reverse-geocoded through the same check. If the location cannot
be verified, the event stays in the list with its exact Directions link but gets no pin,
and its list letter is never erased.

## What this makes harder

Opening the map can inherit one short Google redirect per previously unseen venue and
one geocode per unique location. The provider can also change its redirect parameters
or component vocabulary. Both failures are bounded and never break artist discovery;
an unverifiable location is listed without a pin.

## What would reverse it

If MySet stores a provider place ID or verified coordinates when a gig is saved, the
read-time resolver should disappear. That is both faster and independent of Google's
share-link redirect format.

## How it was verified

- The pure resolver test extracts the exact Taladkao Road address from the same
  redirect shape as the live Ugly Duckling link.
- A conflicting typed address is corrected by the canonical address from the saved
  Google place link.
- The browser-level map check rejects a plausible result in Amsterdam, accepts the
  matching Koh Phangan result, and omits the pin when no matching result exists.
- The draft endpoint resolved the live saved link to `145, The Ugly Duckling,
  2 Taladkao Rd, Ko Pha-ngan, … 84280, Thailand` and retained its exact source URL.
- The full test suite passed; the rendered phone-width suite passed.
- Production Chrome rendered The Ugly Duckling marker at `9.72658, 100.00396`, kept
  the exact saved Directions link, and omitted the former wrong-location result.
