# 2026-09-13 — Band names everywhere, the hero video and its strip

Branch `ui/hero-video-band-name`, worktree off `12b5e24`, Efficient Mode. Decision `0062`.

## What was asked

Right after the link strip shipped: with more than three YouTube embeds, the first shows alone as the hero (a tick box under each media row in the Profile setup for which is the hero) and the rest in an auto-scrolling strip like the cards and links above, under *Watch more from [artist's first name]*. And, app-wide, every "[artist's name]" / "[artist's first name]" must also work for a band — a *first name or band name* field and an optional *last name* on the Profile setup.

## What shipped

- `_profile.mjs`: `first`, `last` on the profile; `name` rebuilt from them when `first` is set; `firstOf(p, fb)`; media `hero` flag, one at most, moved to the front; `shapeMedia` carries `hero`.
- `admin.mjs`: `profileSet` accepts `first`/`last` and, when the save carries `first`, writes the registry row's `name` + `first` under CAS (only when changed); new `mediaHero` action (toggle; clears the others).
- `_lib.mjs` `getShow`: `artistFirst` from the registry row it already reads. `_board.mjs` and `stage.mjs` carry `artistFirst`. `profile.mjs` and `community.mjs` carry `first`.
- `vote.html`: `artistFirst(fb)` reads `ST.artistFirst`; the five inline `split(' ')[0]` sentences go through it. `community.html` `firstName()` reads `D.first`.
- `studio.js`: *First name or band name* (`#pfFirst`) + *Last name (optional — leave blank for a band)* (`#pfLast`) replace *Name*; prefilled by the old split for a pre-split profile; `saveProfile` sends `first`/`last`; a *Top video on your page* tick per media row (`data-act="mhero"`). `studio.html` restamped (`42899db1`).
- `artist.html`: `mediaCard()` / `reelCard()` / `firstName()` / module-level `ghost`; more than three videos → `#hero` + *Watch more from <First>* + `#reel` (drifts right-to-left, `drift('reel',1)`); a tap on a strip card swaps it into the hero slot, puts the old hero into the strip (real card and ghost) and plays with `autoplay=1`; `playMedia(b, auto)` extracted from the click handler.
- `test/sheets.mjs`: nine new assertions (name split, `firstOf`, hero). Docs: decision 0062, design-system, ledger, this note.

## Verified

Suite exit 0 — 2,312 ✓ / 0 ✗ / 44 files. uicheck 113 ✓ / 0 ✗ against the worktree. Headless: artist page with five videos (`shots9.mjs`, screenshot `b9-hero.png`), tap-to-lift; Studio Profile tab (`studio9.mjs`, `b9-studio-media.png`, `b9-studio-name.png`). Deploy preview and production by content after the merge (see the push log).

## Not done / open

The registry write on save is not exercised against production. The Studio's *Listen & follow* section label is unchanged. A pre-split band profile shows *first* = first word, *last* = the rest until the artist corrects it once.
