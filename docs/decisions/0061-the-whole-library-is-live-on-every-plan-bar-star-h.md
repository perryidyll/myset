---
id: 0061
title: the whole library is live on every plan, Bar Star holds 200 songs, the cards say what the page does
date: 2026-09-13
status: decided
decided_by: perry
area: plans
reverses:
superseded_by:
invariants: [0be, 0ca]
commits: []
tests: [test/limits.mjs, test/split.mjs, test/darkroom.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/_profile.mjs, public/studio.js, public/studio.html, public/artist.html, public/theme.js, tools/overview.mjs]
---

## The question

The founder's second pass over the plan cards (2026-09-13, the day after 0060)
changed two rules along with the words. The free plan showed 50 songs to the room
at once and kept the rest switched off; he wants "add up to 100 songs — showcase
all of them for your audience to vote on", because "I don't want a small setlist
to be a constraint on whether they upgrade". Bar Star had a library of 2,000; the
card now says "add up to 200 songs". The rest of the batch is copy and surface:
Bandcamp and GoFundMe links on the profile (the card now promises them), the
"(coming soon)" line on Rock Star rewritten as a business dashboard, and the
status-bar band that survives a theme toggle in the installed Studio.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `_plan.mjs` free `featured: Infinity`, plus `library: 200`; the cap machinery (`toggleSong`, the accept refusal in 0be, `shapeLimits`' null) stays, so a future plan with a cap costs one number. `_profile.mjs` learns two link hosts. `theme.js` reloads the installed app 60 ms after a toggle. | A free room with 100 songs live is a longer list to scroll; the short board already answers that (0el). A Bar Star artist past 200 songs keeps them all — the cap refuses the next add, never a song (0s). | `hostOk` for wildcard hosts (`*.bandcamp.com`). | A rule on the card the code does not keep — so both moved together, as in 0060. |
| B | Remove the featured cap entirely from the code. | A bigger diff for no product reason; the next plan that wants a cap rebuilds it. | none | Silent drift between `toggleSong` and the payload builder. |
| C — do nothing | | The cards would sell rules the code does not keep. | | |

## What was chosen, and why

A. The founder said the free cap works against the upgrade rather than for it;
the library size is now the only per-plan number about songs. Bar Star's library
came down from 2,000 to 200 in the same breath, so the ladder reads 100 / 200 /
2,000 and each card names its own number — except Rock Star, whose 2,000 is
still not on its card.

The Rock Star dashboard line keeps an `(coming soon)` tag: decision 0005 says a
plan may not sell what does not exist, and the dashboard does not.

The founder's "feature and sell of your merch" was written as "feature and sell
your merch" (a typo, read as such).

The band under the clock: `theme.js` already replaces the theme-color meta
(0060); iOS reads it once at launch for an installed app and not again, so the
one thing that repaints it is a load. The toggle now reloads an installed page
(`navigator.standalone === true`) 60 ms after the theme is saved — a flash, once,
only in the installed Studio, never in Safari. Not verifiable on a Mac.

## What this makes harder

`featured` is a column with the same value in every row; a reader of §2.1 has to
be told the check is kept on purpose (it is, in `INVARIANTS.md` 0be and 0ca).
The Studio's toggle causes a navigation on an installed phone, so anything
unsaved in a form is lost — the theme button is in the header, not in a form.

## What would reverse it

An artist whose free room drowns in 100 live songs; or the founder wanting a
song-count reason to upgrade again. Either is one number in `_plan.mjs` plus the
card. The reload goes if a real iPhone shows the band fixed without it.

## How it was verified

- `sh test/run.sh` — exit 0, 2,303 ✓, 0 ✗ across 44 files. `test/limits.mjs`:
  Bar Star holds 200, Rock Star the most; the 101-song free import keeps 100.
  `test/split.mjs`: fifty added songs are all live to the room. `test/darkroom.mjs`:
  the link strip's order, Bandcamp and GoFundMe before Website.
- `node tools/uicheck.mjs` 113 ✓; `node tools/sheetcheck.mjs` 12 ✓ (run against
  the worktree).
- Headless Chrome: the plan sheet's text dumped and read line by line; the
  Profile tab shows the two new fields with their values; the artist page's
  *Listen & follow* strip shows six pills in order.
- Not checked: the installed Studio's toggle on a real iPhone; a real Bandcamp or
  GoFundMe URL through `saveProfile` against production.
