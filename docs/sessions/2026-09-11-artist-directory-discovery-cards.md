# 2026-09-11 — Artist directory discovery cards

## Asked

Separate artist names from their one-liners; add location, style, signed status,
community-star average, MySet shows over the next 30 days and total MySet shows to the
Find artists cards; expose matching filters; keep style off the public profile page.

## Changed

- Added a sanitized `style` field to the artist profile editor and profile record. The
  artist page does not render it.
- Directory data now derives future locations and 30-day counts from calendar rules,
  completed totals from the history index, and ratings from visible starred community
  posts. Hidden posts do not affect the average.
- Cards are roomier, with name and one-liner on separate spaced lines. Location, style,
  signed status, numeric/icon rating, released music and both show counts render as tags.
- Filters now cover country, city, style, minimum rating, signed status, released music
  and MySet shows in the next 30 days. Text search also includes style and locations.

## Verified

- `test/artists.mjs`: 9 passed, 0 failed.
- `test/community.mjs`: 116 passed, 0 failed.
- `test/copy.mjs`: 28 passed, 0 failed.
- `tools/uicheck.mjs`: directory data, all new tags/filters, name spacing and 320px fit
  passed; all other rendered checks passed.
- `sh test/run.sh`: full suite completed with zero failures.
- Draft `6aa3a5cdaf109164f02e0a0d` served the updated directory and the real public payload.
  Production was not changed.

## Map follow-up

A multi-event map popup is feasible, but precise pins require coordinates. The existing
event model supports address, source map URL and coordinates; the current production
artist's next 60 occurrences all have short Google Maps links but none currently expose
stored coordinates or addresses. Use a map provider/geocoder or resolve and persist exact
coordinates before rendering the popup; venue/city text alone should not be presented as
an exact event location.
