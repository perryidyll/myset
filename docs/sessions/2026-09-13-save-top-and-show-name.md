# 2026-09-13 — A second Save button, and the show record follows the name

Branch `ui/save-top`, worktree off `67199bf` (PR #28), Efficient Mode.

## What was asked

A second *Save profile* button at the top of the Profile tab. And, found while checking the founder's save: the live board still said `artistFirst: ""` after he saved his name.

## What shipped

`public/studio.js`: a *Save profile* button under *View your page ↗* (same `saveProfile()`); `studio.html` restamped `c0796b39`. `netlify/functions/admin.mjs` `profileSet`: after the registry write, a `mutateShow` that sets `artist` + `artistFirst` when they changed — `getShow` only reads the registry when the show record has no `artist`, and the founder's record carries one (`show_perry-idyll` in the datastore copy), so the board and the stage never saw the registry's `first`. `test/sheets.mjs`: the show record and the registry follow the profile; a solo name gives the full name on the show and the first name in the sentence.

## Verified

Suite exit 0 (44 files). uicheck 113 ✓ / 0 ✗. Headless `studio11.mjs` (`b11-studio-name.png`): the top button above *Who you are*. Reproduced the bug and the fix end to end against the fake store (`regsync5.mjs`: show record with its own `artist` → `profileSet first` → board `artistFirst` = the band name). The founder must save once more on production for the voting page to change.
