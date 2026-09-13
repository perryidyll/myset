# 2026-09-13 — the pink-orange pass

**Asked:** the founder, pleased with the previous day's four batches, asked for
one colour pass: every orange ring on the site to run the Search button's
gradient (pink-red at the left, orange at the right); every orange word — "vote on
your favorite songs", RSVP, Community, "Next: Tonight 6:30pm", the section
headings — to take the logo's pink-orange; the pulsing glow on the right edge of
the scrolling windows to match; the page menu's icon to be two bars in that colour
(two options, not three) with the two option icons in the same colour.

**Built** in a clean worktree off `origin/main` (`0000bc8`), Efficient Mode, one
Python pass with every replacement asserted to hit (`scratchpad/recolor.py`, not
kept):

- `--accent-2` is `#FF5650` — the middle of `--grad`, a touch warm of centre — in
  `app.css` and both Studios. Every word and fill that was `--accent-2` follows.
- The ring: a masked `::after` band of `var(--grad)` where the ring was an inset
  shadow (`.signin`, `.finder`, `.artistsearch`, every RSVP pill, `.ps.cta a`,
  `.fab`, `.share`, `.mapbtn`, `.askbtn`, `.sortbar`, `.orange-outline`, `.votebox`,
  `.upg`, the selected tab's pill in `lock.css`); the gradient painted to the border
  box where the box already had a real border or is an input (`.queue`,
  `.list.votelist`, `.askbox`, `.search input`, `.gig.feat`, `.scroll-shell`,
  `.tier`). Neither moves a pixel; the search input gives back its 1.5px in padding.
- `edgeGlow` and the tab pill's tint/glow: `rgba(255,122,69,…)` → `rgba(255,86,80,…)`;
  `studio.html` and `vote.html` stay byte-identical (`test/structure.mjs`).
- The artist and venue pages' `.sect` headings were `--accent-ink` (the deep pink);
  now `--accent-2`, as the Studios' headings already were.
- The menu (`artist.html`, `community.html`): `M4 9h16M4 15h16`, stroke
  `--accent-2`, pop icons `--accent-2`.
- `tools/uicheck.mjs` and `test/decline.mjs` now assert the gradient ring and the
  new colour where they asserted flat orange.

**Verified:** `sh test/run.sh` exit 0, 2,290 ✓, 0 ✗; uicheck 113 ✓; sheetcheck 12 ✓;
headless Chrome at 390×844 (fixtures from read-only GETs of production) on the front
door, the artist page, the vote page and the Studio's Live tab.

**Not checked:** a real iPhone; the Studio's Setlist and Gigs tabs from a signed-in
stage (uicheck renders their shells and passes); the deploy preview.

**Decision:** `0059`. **Puzzle:** a changelog entry for 0059 the same day; no
process sheet changed (the design system is the record).
