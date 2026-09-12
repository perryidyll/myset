---
id: 0057
title: A filed night can be renamed by hand from the Money tab
date: 2026-09-12
status: decided
decided_by: perry-confirmed
area: history
reverses:
superseded_by:
invariants: [0fm]
commits: []
tests: [test/histname.mjs]
files: [netlify/functions/_history.mjs, netlify/functions/history.mjs, public/studio.js]
---

## The question

The founder asked (2026-09-12) for the title of a show on the Money tab to be editable when tapped. What pressed for it is the show started by hand: an artist who taps "Start the show" on the Live tab with a venue typed in — or with nothing typed — gets a night filed under that venue or as "Untitled show – <date>", and until now nothing could change that name. `placeShows` (invariant 0f5) renames only what the calendar can prove, on purpose, so a night with no gig under it stays "Untitled" for ever. What had to be decided is where a hand-typed name lives, what happens to it when the same night is archived again with more songs (archiveShow replaces a poorer snapshot with a richer one, INVARIANT 17c's other half), and who may set it.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `POST /api/history {action:'rename'}` writes `title` and `titleByHand:true` onto the detail document `hist_<aid>_<showId>`, then `title` onto the matching row in `histidx_<aid>`; archiveShow keeps both fields through a richer re-archive | two CAS writes per rename, one new flag on the detail | `renameShow` in `_history.mjs`, the action in `history.mjs`, a tappable title in the Studio | a name written to the row but not the detail (or the reverse) — the two disagree until the next heal |
| B | A separate title-only document per night (`histname_<aid>_<showId>`) read alongside the detail | one more read on every Money-tab open AND on every public-page read of the index, per night | a new key family, plus `keysFor` for deletion | the index rows, which `_vstats.mjs`, `_pitch.mjs` and the artist page read, would not carry the name unless every reader learned the new key |
| C — do nothing | Leave "Untitled show – <date>" as it is | — | — | the founder's ask stays unmet; a hand-started night is never called what it was |

## What was chosen, and why

A, because the founder asked for it and because the title already lives in exactly two places — the detail document (the record) and the index row (the summary every list reads) — so the rename goes where every other repair in `_history.mjs` goes: detail first, row second, the same lean as `placeShows` and `reconcileShow`. `healHistory` rebuilds rows from details (`title: doc.title || was.title`), so a rename that only reached the detail is repaired by the next heal rather than lost.

**`titleByHand` is the protection.** archiveShow replaces the detail with a strictly richer snapshot (more songs or more votes) and rebuilds the row from what was kept — the fix for an artist who ended by accident and carried on. That richer snapshot carries `show.archiveTitle`, which for a hand-started night is the dated fallback again, so a typed name would have been overwritten by the very night it named. The detail's CAS callback now remembers `title` and `titleByHand` before the `Object.assign` and restores them after; the row, built from `kept.title`, follows. A night nobody renamed still takes the richer archive's title, as before.

**100 characters**, cut and whitespace-folded in `history.mjs` before the call, and again inside `renameShow` so the function is safe from any caller; the reply carries the cut title so the Studio shows what was kept. **Owner-only** costs nothing: `requireArtist` already gates the endpoint and `HIST(aid, showId)` is a per-artist key, so another artist's showId is a document that does not exist — `null`, answered as 404, the same shape `reconcileShow` gives an unknown show. Nothing but the name moves: money, counts and times are untouched.

The Studio side: the title in each Past shows row and in the opened night's header is `data-act="histname"`, sitting inside a row that is itself `data-act="show"`; the click dispatcher takes the innermost `data-act`, so a tap on the name renames and never opens. `prompt()` in the Studio's own idiom (`renameList`), no call on an empty, cancelled or unchanged name, `HIST.shows[]` and `DETAIL` patched in memory on ok so the list does not reload.

## What this makes harder

A night now has two kinds of title and one field: `titleByHand` is the only thing telling them apart, and every future writer of `title` on a detail document (a smarter `placeShows`, a calendar back-fill, an import) has to read it first or it will quietly undo the artist. The row does not carry the flag — only the detail does — so a repair that works from rows alone cannot know which names are sacred. And `placeShows` still renames the VENUE, not the title, so a hand-named night can later have its venue corrected from the calendar while its name stays; the two fields are shown together and could read oddly.

## What would reverse it

An artist asking for the name to come from somewhere else — the calendar, the venue's own account — for a night they already named by hand, which would mean a precedence rule between `titleByHand` and that source, not the removal of this. Or the index rows growing a second hand-edited field, at which point the flag belongs on the row as well and the shape of B (a per-night document for everything typed) starts to pay.

## How it was verified

`test/histname.mjs` (`sh test/run.sh` § naming a night by hand), against the real handlers on the in-memory store: a five-song night archived under the dated fallback; rename with `'  Friday   at the pier '` → 200, reply `title: 'Friday at the pier'`, the detail carries it with `titleByHand: true`, the index row carries it, `GET ?show=` and the list both agree, `songsPlayed` still 5; a blank name is 400 with "name" in the error, an unknown night 404, another artist's token 404 and the name unmoved, no token 401; a thirteen-song re-archive of the same night with the fallback title again → detail has 13 songs and STILL "Friday at the pier", still `titleByHand`, the row keeps the name with the richer count; a second night archived twice with two titles and never renamed takes the second; a 140-character name → reply, detail and row all length 100 — **27 passed, 0 failed**. `test/place.mjs` 21 passed, `test/autoshow.mjs` 107 passed, `test/structure.mjs` and `test/copy.mjs` pass, `test/syntax.mjs` OK. In headless Chrome at 390px (scratchpad harness, both themes): the row title is `role=button` with a 12px muted pencil, a tap prompts "Name this night" with the current name and does NOT open the show, the POST carries `{action:'rename', show, title}` with the whitespace folded, the row and the memory show the new name, the toast says Renamed, the opened night's header renames too and its list row follows, and unchanged, blank and cancelled prompts send nothing — "unchanged" measured against what the prompt showed, so OK on a venue-named night's untouched prompt does not freeze the venue as a hand-typed title (the review caught the first cut comparing against `title` alone). Also from the review pass, at 390 and 320px both themes: the name is an inline-block, so a tap in the blank space right of a short name opens the show and only the words and the pencil rename; Enter and Space on the focused name prompt, since it is announced as a button; and the Past shows search finds a night by its typed name (`hay` reads `title` first). Not checked: a rename against production, and the 500 that a CAS `busy` throw inside `renameShow` would produce (the page reads it as "Connection hiccup", which is the honest answer).
