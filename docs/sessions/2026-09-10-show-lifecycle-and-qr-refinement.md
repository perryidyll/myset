# Show lifecycle and QR refinement — 2026-09-10

## Outcome

- Moved the audience request card below the setlist and refined voting/Studio glows.
- Added a bounded live-show index and automatic ending after three idle hours.
- Added manual show titles and dated automatic history titles.
- Enlarged QR artwork, kept headline copy on one line and repaired downloads with a
  Blob URL rather than a data-URL navigation.

## Evidence

- `test/autoshow.mjs` — 86 passed, 0 failed.
- `tools/uicheck.mjs` — rendered UI checks passed.
- `sh test/run.sh` and `node tools/overview.mjs --tests` — 1,822 assertions, 0 failing.
- Follow-up: manual Start now always takes the fresh-show path; Studio rerenders retain
  page and internal queue scroll; and legacy Top-voted defaults migrate to stable A–Z.
- Draft deploy `6aa2211cc58dba57af41f4ba` verified by served content.
- Follow-up: scroll state now survives double-frame layout settling on audience and
  Studio windows; request controls have static orange borders; YouTube CSP/fallback and
  black legacy clip posters are repaired; the end sheet can discard; and pressed
  controls bridge directly into faster loading overlays.
- Full gate after the follow-up: 1,825 assertions, 0 failing.
- Replacement draft `6aa23a296298ae8f23f69f11` verified by served content and CSP
  headers and approved for production.
- Production remains unchanged pending visual approval.
