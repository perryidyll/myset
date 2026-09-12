# 2026-09-12 — Interactive artist event map

**Asked:** replace the static event image with a map that pans and zooms, make events
tappable with basic details and a Google Maps destination, and show the visitor's
current location as a blue dot.

**Built in the working tree:**

- The map loads Google Maps JavaScript only after it is opened.
- Touch/mouse panning and native zoom controls work inside the sheet.
- Unique venues receive labeled pins. Address-only venues are geocoded in the browser.
- Tapping either a marker or an event row opens the event's artist, venue, date, time,
  location and a direct Google Maps action.
- Opening the map requests browser location. A successful result draws a blue dot and
  translucent accuracy circle; refusal leaves a visible retry button and never blocks
  events or directions.
- The CSP permits only the Google hosts required for the interactive map.
- Google Cloud enables Static Maps, Maps JavaScript and Geocoding for the website key.
  The key remains website-restricted to production and the current private QA draft.

**Verified:** `test/copy.mjs` 37/37; `test/syntax.mjs` all pages/functions; full suite
2,095/2,095. Draft `6aa44be7f6f826fb693f313b` rendered five real venue pins in Chrome.
An event-row tap opened the correct dated popup and Google Maps link; dragging changed
the center; Zoom in changed level 12 to 13. Chrome location is set to Allow, but macOS
did not return a physical position to this browser session, so actual blue-dot placement
still needs one device check. Nothing from this session is committed or live.
