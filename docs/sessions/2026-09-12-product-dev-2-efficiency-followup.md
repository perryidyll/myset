# Product Dev 2 — efficiency follow-up

## Asked

- Rename audience Tip buttons to Support and use “Show your appreciation”.
- Normalize the Setlist creation-button height and spacing.
- Give Studio song cards full-width copy, horizontal wrapping tags, and bottom actions.
- Extend and soften the right-edge glow on audience and artist scroll windows.
- Explain where the periodic MySet ratings and comments go.
- Make between-show countdowns red on the audience page and show live seconds there
  and on the artist profile; keep seconds as the product-wide countdown rule.
- Diagnose and fix The Ugly Duckling's incorrect map position.
- Repair the artist-profile seconds ticker and automatically double-check map pins
  against the event's actual Google Maps city and country.

## Changed

- Vote and Community support buttons now use the requested label and subtext. The
  underlying payment kind remains `tip`, so accounting and Stripe behavior do not move.
- Setlist creation controls are 56px high with a 10px gap before the organizer; song
  cards now reserve their full width for title/artist/status/tags and put actions below.
- Both existing edge-glow implementations now use a longer 6.4-second eased pulse and
  three shadow layers reaching 72px toward the screen edge.
- Day-scale countdowns no longer omit seconds. The audience countdown is red and both
  audience/profile timers continue to update every second. INVARIANT 0f6 records the
  global seconds rule.
- The interactive map's `?maps=1` data path resolves the exact address hidden behind a
  saved Google short link. The live Ugly Duckling source resolves to 145, 2 Taladkao
  Road instead of an ambiguous name search. Decision `0040` records the boundary.
- The profile ticker no longer waits on obsolete show state, so it starts as soon as
  the profile countdown button exists. The map now validates Google's structured
  address components against the saved city/country and, for partial results, a
  specific matching address fragment (including reverse-geocoding saved coordinates
  and Thai untyped address components). It omits any pin it cannot verify instead of
  showing a guess, without erasing the event's list letter.

## Where feedback goes

The periodic “Enjoying MySet?” answer is saved in the artist's feedback document in
Netlify Blobs. Artist Studio reads it under **Money → What the room said**: average,
count, and recent written notes, without device IDs. The store retains the aggregate
and up to 200 recent response rows; the Studio payload sends the latest 20 notes and
the current card renders six.

## Evidence

- Focused syntax, unit, artist-directory and real short-link resolution checks passed.
- `sh test/run.sh`: every section passed.
- `node tools/uicheck.mjs`: every rendered phone-width check passed.
- The rendered profile countdown advanced from `05s` to `04s`; the map validator
  rejected a wrong-city result, selected the correct matching result, and rejected a
  wrong-only response.
- Visual screenshots confirmed the compact buttons, card reflow, expanded glow, red
  seconds countdown, and Support dock.
- Draft `6aa508262ef6305007973b78` serves the requested content. Its map-rich API resolves
  the live Ugly Duckling address and exact source link. Google's browser key rejects the
  preview hostname, so its live canvas was checked after production deployment.
- Production commits `5cfa27d` and `51bf8a8` are pushed on `main`. Chrome verified the
  profile seconds advancing in real time and The Ugly Duckling marker at
  `9.72658, 100.00396`; the exact saved Google Directions link is unchanged.

## Coordinate-map correction

The address validator then proved too strict for valid Thai addresses: Google returned
house-number or untyped local-address components for Sand & Tan, Anantara Rasananda and
Seaflower, so their pins and list letters disappeared. At the user's direction, decision
`0041` replaces read-time address geocoding with saved coordinates. The six current
recurring event records (five venues) were backed up and populated with coordinates;
production immediately returned all five letters and markers. Studio now resolves and
stores coordinates when a gig is saved, both public maps consume only those numbers,
and the home View on map button owns a home-page modal instead of navigating through
Find artists.
