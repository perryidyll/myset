# 2026-09-13 — Batch seven: the cards' second pass, two more links, the band under the clock

Branch `ui/batch-seven`, worktree off `67c6d78` (PR #23), Efficient Mode. Decision `0061`.

## What was asked

The founder's next batch after batch six went live:

- the status-bar band still shows after a theme toggle inside the installed Studio; a refresh fixes it — "can we get that final bit fixed or is it not possible?"
- plan cards: "Your page" → *All-in-1 artist page – …*; *In-app merch store – …*; the community page line; ", lyrics" → ", and more"; Bar Star *Add up to 200 songs – showcase all of them …* (in the code too); Hobbyist *Add up to 100 songs – showcase all of them …* with the 50-live-song cap removed from the code ("I don't want a small setlist to be a constraint on whether they upgrade"); Rock Star's *(coming soon)* line → *Professional business dashboard – …*
- Bandcamp and GoFundMe fields in the profile setup and their links on the profile page

## What changed

- `netlify/functions/_plan.mjs` — free `featured: Infinity`; plus `library: 200`. The cap machinery stays (INVARIANTS 0be, 0ca annotated).
- `netlify/functions/_profile.mjs` — `links` gain `bandcamp` and `gofundme`; `LINK_HOSTS` allow `bandcamp.com` + `*.bandcamp.com`, `gofundme.com`, `www.gofundme.com`, `gf.me`; `hostOk()` handles the wildcard.
- `public/studio.js` — `TIER_COPY` in the founder's words; Profile form gains `#lkBc` and `#lkGfm` between YouTube Music and Website; `saveProfile` sends both. Restamped (`72f3dec6`).
- `public/studio.html` — `.tier .soon` (muted italic) for the `(coming soon)` tag kept on the dashboard line (decision 0005: never sell what does not exist).
- `public/artist.html` — `ICON` + `LABEL` for Bandcamp (teal) and GoFundMe (green); the strip reads Instagram, Spotify, Apple Music, YouTube Music, Bandcamp, GoFundMe, Website.
- `public/theme.js` — `toggle()` reloads an installed page (`navigator.standalone === true`) 60 ms after saving the theme. iOS reads `theme-color` once at launch for a standalone app; a load is the one thing that repaints the band. Safari is untouched.
- Tests: `test/limits.mjs` (Bar Star 200 / Rock Star the most), `test/split.mjs` and `test/limits.mjs` comments, `test/darkroom.mjs` link order.
- Docs: decision 0061, INVARIANTS 0be/0ca, `tools/overview.mjs` row label, overview regenerated, `docs/design-system.md` link-strip order, `docs/processes/money/03` p08, ledger UX-037 + PL-002.

## Verified

- `sh test/run.sh` — exit 0, **2,303 ✓, 0 ✗**, 44 files.
- `tools/uicheck.mjs` 113 ✓, `tools/sheetcheck.mjs` 12 ✓ (against the worktree).
- Headless Chrome: plan sheet text dumped and read line by line; Profile tab with both new fields filled from a fixture; artist page strip with six pills in order and the right hrefs.

## Not checked

- The installed Studio's toggle on a real iPhone (a Mac cannot be a standalone PWA).
- A real Bandcamp / GoFundMe URL through `saveProfile` against production.

## Readings to confirm

- "feature and sell of your merch" was written as "feature and sell your merch".
- `(coming soon)` stays on the dashboard line — the dashboard is not built.
- Rock Star's card does not name its 2,000-song library.
