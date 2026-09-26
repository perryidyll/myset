# 2026-09-26 — the money model in the /mediadash look

**Asked:** the same redesign on the money model page; on the tables, column headings
larger, bold and black; the totals row not in black text but the whole row shaded a
light MySet orange; the By artist and By venue tables full width, stacked, not crammed
side by side; the "how these numbers are made" section on a darker background; a
divider line above the main Every show table, and the part above it made to feel like a
hero with a subtle design technique.

**Done (EVS-003, a second amendment to decision 0095):**

- `finance/model.html`: the `<style>` block and the markup around the dials rewritten on
  the shows page's tokens. Dark first, light under `prefers-color-scheme: light` and
  `data-theme`; the theme key is still `myset.model.theme`, shared with the shows page.
  No Google Fonts link any more: the charts take the system face (`SANS`, `MONO`).
  The engine block, `summarize`, `applyActuals`, `mergeLive`, `pickAct`, `withDefaults`
  and the seed are untouched, so `finance/model-test.mjs` reads the same code.
- Hero: a dot grid that fades out, a wash of surface, the stamp line, a gradient
  headline, the KPI tiles (revenue, costs, profit at double width), the "what is carrying
  these numbers" band, then a lit divider.
- Tables: headings 12 px, weight 800, ink; alternate columns shaded; `tr.sum` rows in
  the light orange with deep-orange text; the selected host and the scenario's own size
  (`tr.hi`) in a blue wash; a sticky first column; `frameAll()` caps each window at
  fifteen body rows (the formula table and the growth table are the two that scroll).
- Charts: `axisTitle()` on both axes of every bar and line chart; the doughnuts have
  none to name.
- The four notes and the sources sit in a dark band at the foot of the page.
- `finance/shows.html`: headings bold ink; totals row light orange, text deep orange;
  hero dot grid and divider; breakdowns two to a page stacked full width, the track
  sized to the page in view; rules three across in the dark band.
- Two visible uses of the founder's first name in the model's copy now say "the founder".

**Verified:** `sh test/run.sh` exit 0, 3,673 ✓; `node finance/model-test.mjs` all
passed. Both pages in the app's browser, light and dark, and at 375 px with no sideways
page scroll. The shows carousel went 1–2 → 3–4 of 9 and the track followed the page's
height (916 → 388 px).

**Not verified:** production (after the merge); Safari.
