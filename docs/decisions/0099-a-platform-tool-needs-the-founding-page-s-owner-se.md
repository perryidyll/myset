---
id: 0099
title: A platform tool needs the founding page's owner seat, and every name in the role tables is a real action
date: 2026-09-28
status: decided
decided_by: claude
area: auth
reverses:
superseded_by:
invariants: [0db, 0t, 0gj]
commits: [04e78db]
tests: [test/accounts.mjs, test/structure.mjs]
files: [netlify/functions/admin.mjs, test/accounts.mjs, test/structure.mjs, INVARIANTS.md]
---

## The question

A read-only look at origin/main `fcdafe5` found two holes in who may do what on the artist side. Both are in `admin.mjs`, and both are the class of bug INVARIANT 0db exists to close.

1. **The founder's platform tools asked which page, not who.** The block at the end of `handlePlan` holds the bug list, the feature flags, the Google Sheet, the ID review queue, a venue's plan and tick, and promo codes. It opened on `isPlatformOwner(aid)`, which is `aid === DEFAULT_ARTIST`. None of those actions is in `OWNER_ONLY` or `CAPABILITY`, so a member or crew seat signed in to the founding page could flip a flag for every artist, approve an ID check, mint a 100%-off code or set a venue's plan, one POST each.
2. **Seven `CAPABILITY` rows named actions no handler has:** `songSet`, `bulkSongs`, `setChart`, `setLyrics`, `listSave`, `listApply` and `eventUnskip`. The table is a deny-list, so an action missing from it needs nothing beyond being signed in. The real actions (`chartSet`, `lyricsSet`, `tagAdd`, `listNew`, `listUse`, `eventHide` and the rest) were open to crew, whose remit is "tonight only: run the show, see the queue and the requests". Crew could also empty the whole library in one POST with `clearSetlist`, which no row named. The same slip had happened once before, with `profileSave` for `profileSet`.

The direction of the fix came from the founder's brief: require the owner role alongside `isPlatformOwner`, correct the `CAPABILITY` names, write the failing tests first, and add a structure test that every key names a real handler.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The platform gate also asks for role `owner`. The table's rows are corrected to real names, and the library, calendar and community writes missing from it are added. A structure test refuses any name no handler takes. | One line and one table. | One static check in `test/structure.mjs`. | A crew seat that relied on a now-refused action (switching setlists mid-set, fixing a lyric) has to ask a member or the owner. The room keeps voting. |
| B | Turn the artist side into an allow-list (default-deny), the way `venueadmin.mjs` does with `CREW_OK` and `MANAGER_OK`. | Every action classified at once, about 80 names, in one change. | A crew list and a member list. | The same mistake the other way round: a name left off locks a seat out of the show mid-gig, which rule 1 ranks as worse. |
| C — do nothing | Nothing. | Nothing. | None. | A band mate on the founding page mints free plans; a sound engineer empties an artist's library. |

## What was chosen, and why

A. The founder gate is now `isPlatformOwner(aid) && me.role === 'owner'`, and it answers anyone else with the same 401 `unauthorized` as before: one door, one answer. The Studio code door and the recovery key are owner sessions already (`requireArtist`), and the founder's own sign-in already passes the same role check `OWNER_ONLY` applies to the books and the business dashboard, so the founder should lose nothing. The test pins the owner seat's token and the recovery key; production's registry was not read.

The agent's calls inside the brief:

- **Rows added beyond the renamed ones**, because each is a write the table's own comment says crew may not make: `clearSetlist`, `learnDone` (adds a song to the library), `lyricsFetch` (wipes the saved words, the artist's own included, and refetches from LRCLIB), `postPin`, and `eventHide`. `eventHide` replaces the phantom `eventUnskip`: `eventSkip` already undoes a skip, and `eventHide` deletes a one-off gig outright.
- **`listUse` is `library`**, as the table's author meant `listApply` to be. Choosing tonight's set is the band's call, and if crew is refused, the room keeps voting on the set in play.
- **Left open on purpose:** `chordsLink` (a read: it finds a chord chart, and the Studio falls back to a search link) and `lyricsWarm` (fills only songs with no words yet, and never replaces words that are there). Also left open: `toggleSong`, the price and room switches (`freeCredits`, `packs`, `replayCost`, `askSet`, `unlimited`, `unlimitedFan`, `crowdSet`) and the venue side (`pitchSend`, `vouch`). Those are closer to running the show, and which of them crew should have is a product call, not a spelling fix.
- **The structure test covers `OWNER_ONLY` too.** It is a deny-list for members in the same way, and it has no phantom names today. It also checks each `CAPABILITY` value against the capabilities `CAN` in `_session.mjs` gives to some role, because a misspelt value fails the other way: it locks every seat but the owner out of that action.

## What this makes harder

- A crew seat can no longer switch the setlist, fix a lyric or a chart, or add a genre during a gig; a member or the owner has to. The Studio has never hidden library controls from crew (Add song included), so crew still sees them and is told "That's not something this sign-in can do".
- A member or crew seat on the founding page still sees the founder's cards in Settings. The Studio shows them on `PLAN.owner`, which is page-level and also drives the plan-lock bypass, so it cannot simply change meaning. Those cards now misread the refusal. The codes card reads "None yet." over a *Create code* form that is refused, the venues card reads "No venues have signed up yet.", and the sheet card reads "Could not ask the server.". Every Studio open there also sends two refused calls (`promoList`, `venueList`). Nothing crashes or signs anyone out; only a refused `/stage` does that. The fix is for the Studio to also check `PLAN.role` for those cards. That is a page change with its own browser check, and it is not done here. Decision 0100 made it.
- `mediadash.mjs` decides "founder" by page alone as well (`isFounder`: `me.aid === DEFAULT_ARTIST`), so a member or crew seat on the founding page can log, override or remove a boost row on the public dashboard. Same class, outside `admin.mjs`, not fixed here. Decision 0100 fixed it.

## What would reverse it

- The founder deciding crew should keep setlist switching or lyric and chart fixes on the night. Move those rows off `library`, or give crew a capability for them in `_session.mjs`.
- Moving the artist side to an allow-list (option B). The structure test would then have less to guard; keep it until that happens.

## How it was verified

The tests were written first and run red against origin/main `fcdafe5` with only the tests added:

- `node test/structure.mjs`: `✗ every CAPABILITY name in admin.mjs is an action a handler takes (55) — no handler: songSet, bulkSongs, setChart, setLyrics, listSave, listApply, eventUnskip`.
- `node --import ./test/register.mjs test/accounts.mjs`: `85 passed, 46 failed`. Crew `clearSetlist` returned `{"got":200,"want":403}` and emptied the library (`{"got":0,"want":1}`). A member's `flagSet` returned `{"got":200,"want":401}` and wrote the flag. Two codes were minted (`{"got":["SEATMEMBER","SEATCREW"],"want":[]}`). The controls passed: a member may still make a setlist and write a chart, lyrics and a genre; the founder's owner seat and the recovery key keep every tool.

After the fix: structure OK (63 `CAPABILITY` names and 29 `OWNER_ONLY` names, each taken by a handler), `accounts.mjs` 131 passed, 0 failed. Origin moved during the work (decision 0098, an unrelated deleted-account fix, landed as `2243aed`), so the change was rebased onto origin/main `45a8d07` and renumbered 0099; there, `node tools/overview.mjs --tests` ran the whole suite: 3,870 assertions, 0 failing — and again, the same count, after a fast-forward onto `588f03c` (docs only) just before the pull request.

The structure checks were mutation-tested on a copy of `admin.mjs` restored byte for byte afterwards. The value `'libary'`, the key `eventHyde` and the `OWNER_ONLY` name `msgRepport` each turned the suite red, naming the bad entry.

An independent review in a fresh context re-ran both suites against `fcdafe5` and the fix, and found no path by which the founder loses a tool. It also found that none of the newly gated actions is sent by the Studio on its own during a show: starting a show applies the gig's setlist on the server (`_lifecycle.mjs`), not through `listUse`. It found holes of the same family outside this change: `mediadash.mjs` (above) and, in `auth.mjs`, `signOutOthers` and `sessionRevoke`, which let a crew seat sign the owner out. Those are left to their own change.

Not checked: the Studio in a browser (no page changed), production (nothing deployed), and production's registry roles for the founding page.
