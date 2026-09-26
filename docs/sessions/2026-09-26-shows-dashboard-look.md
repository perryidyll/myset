# 2026-09-26 — the shows dashboard in the /mediadash look

**Asked:** redesign the whole dashboard to match /mediadash; a `$` column beside
*Bought* and beside the tips; alternate shaded columns, with the vote columns one colour
and the two tip columns one colour; no table window over fifteen rows; a fixed totals row
at the top of the main table; every money figure above zero green; explain the
"Money a head, by country" chart and label both axes on every chart; the other tables
twice as large, two at a time, in a carousel turned by arrow buttons.

**Done (EVS-002, an amendment to decision 0095):** `finance/shows.html` only.

- Tokens copied from `public/mediadash.html`: black glass, SF system type, orange accent,
  Apple green. No web font is loaded, so the page check in `test/everyshow.mjs` now asks
  for no external stylesheet instead of `/vendor/model-fonts.css`.
- Main table: a group header row (Votes: all / bought / $ · Tips: count / $ · Merch:
  items / $ — merch was split the same way so the three money groups read alike),
  alternate shaded bands with each group one band, a totals row pinned under the headers
  (over whatever the filters show; money sums only nights Stripe answered), a sticky
  date column, rows open a side drawer.
- `frame()` pins each header row under the one above and caps every table window at
  fifteen body rows, measured, re-run on resize.
- Charts: both axes titled on all four; the by-country chart's "$0" was the dollar
  formatter on the category axis of a horizontal bar — moved to the value axis.
- Breakdowns: nine tables in a carousel, two in view (one under 900 px), arrows and
  arrow keys, wrapping at the ends, a chip per table, 15 px type and 15/18 px cell padding.

**Verified:** `sh test/run.sh` exit 0, 3,673 ✓. The page in the app's browser against a
read-only copy of production's `shows.json` and night pages (fetched with the passcode):
16 counted rows, window 760 px = 15 rows, totals 146 phones / $72 tips / $10 bought,
carousel 1–2 → 3–4 of 9, drawer, light theme, 375 px wide with no sideways page scroll.

**Not verified:** the page on production (after the merge); Safari (sticky header rows are
set per cell, which Safari supports).
