# 2026-09-14 — Nobody else's band on a new page

**Asked.** The founder made a test account (*The Last Cigarettes*) and its page
opened with the founder's own band photo as cover and portrait: "it
auto-populated my profile page with these images lol please fix that asap". And:
"make 'save profile' text centered please".

**Shipped (decision 0078, INVARIANT 0fy).**
- `_profile.mjs`: the default `photo` is `''`; `normProfile` no longer fills an
  empty one with the stock `band-sm.jpg`.
- `artist.html`: no cover → the `.pcover` box painted in the brand pink-orange
  gradient (`.pcover.blank`), no `<img>`; no portrait → `.pav.blank` with the
  band's initial. `og:image` → `/icons/icon-512.png` (it was `band.jpg` for every
  artist page).
- `community.html`, `shop.html`: the header avatar falls back to the same initial
  tile (`.av.blank`) instead of the band photo.
- `studio.js`: both *Save profile* buttons are `.big.mid`; `studio.html` defines
  it (`justify-content:center`). Restamped.

**Unchanged.** The founder's page stores `/img/band.jpg` by path (checked live:
`/api/fan?what=profile&a=perryidyll` → `photo: '/img/band.jpg'`), so it keeps its
picture. The two stock files stay for it.

**Broke on the way.** The first cut closed the page's big template literal after
the cover (`Unexpected token 'class'`); caught by the suite's syntax check and by
the mock screenshot before anything was pushed.

**Verified.** `test/sheets.mjs` 196 ✓ (three new: NOBODY ELSE'S BAND); suite exit
0; uicheck 244 ✓; mock screenshots of the empty page (pink-orange cover, "T"
tile) and the centred button.

**Puzzle.** Changelog entry for 0078.
