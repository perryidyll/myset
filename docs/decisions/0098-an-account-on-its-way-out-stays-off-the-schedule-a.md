---
id: 0098
title: An account on its way out stays off the schedule, never starts a show by itself, and gets no first-night letter
date: 2026-09-27
status: decided
decided_by: user-confirmed
area: ops
reverses:
superseded_by:
invariants: [0dh]
commits: [2243aed, 1385b2b]
tests: [test/autoshow.mjs, test/firstgig.mjs, test/sharecard.mjs, test/sheets.mjs, test/accounts.mjs]
files: [netlify/functions/_auto.mjs, netlify/functions/artistpage.mjs, netlify/functions/_warehouse.mjs, netlify/functions/auth.mjs]
---

## The question

Soft delete (INVARIANT 0dh, ACCOUNTS.md §6.6) takes an artist's calendar out of the schedule index, `gigsched`, on day one. The calendar document itself stays for the thirty days, because the data never moves. The daily `heal()` in `_auto.mjs` walks every row of the artist registry and re-points it from its own calendar, and it never looked at the deletion mark. So the first heal after somebody left put their future gigs back in the index, and the sweep in the same ring started them: `autoTick` called `startShow(fresh, by: 'schedule')`, and neither checks deletion.

The result was a show nobody could reach (`publicArtist` already 404s the page), a gig taken off the month's cap, a night filed, and — when that night was the account's first — a morning-after letter queued to somebody who had left. Found read-only on origin/main fcdafe5 on 2026-09-27 while mapping the registry walks. Production was not affected: that day its registry held six accounts, none marked for deletion, and no `delqueue` had ever been written.

The same blind spot sat in `sweepNotes`, which sends the morning-after letter. A letter queued before the account was marked — a first night filed, then a deletion inside the next ten hours, including the night `startDeletion` itself files when a show is running — went out anyway, telling somebody who had just left to put their next show on the calendar.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The heal skips a marked row. `autoTick` asks `deletionOf` right before `startShow` and answers `drop`; `sweep` takes a dropped entry out instead of re-pointing it. | One registry read per scheduled start, not per ring. The heal saves one calendar read per marked row. | A `drop` flag beside `keep`. | A marked account whose entry never reaches the start (auto-start off, no songs on) keeps its entry until the window passes. Nothing starts. |
| B | The heal un-indexes a marked row (`reindexSched(aid, { list: [] })`) instead of skipping it, plus the same guard. | One write per marked row per day. | None. | An Undo that lands between the heal's registry read and its write loses the entry for up to a day, so a gig that should start itself does not. |
| C | The guard only; the heal unchanged. | As A. | As A. | Every heal re-adds every deleted account, and each of their gigs spends reads being refused. The index misstates who is scheduled. |
| D | The guard inside `startShow` (`_lifecycle.mjs`). | As A. | None. | Touches the one start/end implementation for nothing: a tap already gets 423 from admin.mjs. |
| E — do nothing | — | — | — | A deleted account's gig starts itself on the first heal after it leaves. |

## What was chosen, and why

A. The heal is where the bug was born, so it gets the fix: a marked row is skipped, the way a venue owner's already is. Undo re-indexes the account (`cancelDeletion`), and from then on it is walked like anybody else.

The guard is the second half because the heal cannot close the hole alone. It reads the registry once per pass, so an account that leaves mid-pass can still be re-indexed from a stale read, and any entry the old heal already wrote would still be in `gigsched` when this deploys. The guard is the check a tap on Start meets in admin.mjs, made at the one place a start has no request behind it. It sits right before `startShow`, not at the top of `autoTick`: during a gig the "already live" ring runs every two minutes and the registry is the largest global document, while the start happens once per gig.

Skip rather than un-index (B), because of which way each race fails. Skipping can leave an entry for an account that just left, and the guard then drops it. Un-indexing can take the entry away from an account that just came back, and then a gig does not start. Rule 1 in AGENTS.md — nothing may break the gig — ranks those two.

A live show on a marked account is still ended by the schedule's end branch and by the idle sweep, because the guard is on the start only. That matches day one, which files any running show.

The letter is dropped, not held. `sweepNotes` already reads the registry when a note is due, so the check costs nothing; a marked account's note moves to `noted` like a note whose night vanished. Holding it until Undo or the purge would re-read it on every ring for thirty days, for a letter whose moment has passed anyway. The founder asked for this half on 2026-09-28, with the go to ship.

## What this makes harder

Every walk over `reg.byId` has to decide what a marked row means for it; this one had not. A new background job that re-indexes from the calendar has to skip marked rows too, and a new letter has to ask about the mark before it sends.

An account that leaves and comes back inside the ten hours never gets its first-night letter.

## What would reverse it

If soft delete ever stops keeping the calendar for the window, the skip becomes redundant (and harmless). If an account on its way out should ever run a show — it should not, since nobody can reach its page — both halves come out together.

## How it was verified

- Failing first: the new section of `test/autoshow.mjs` ("AN ACCOUNT ON ITS WAY OUT") against the unfixed `_auto.mjs` printed `137 passed, 8 failed`. The heal put the account back (`{"s":1791302400000,"e":1791309600000,"k":"ggone@2026-10-06"}`); the sweep started the show (`{"status":"live","startedBy":"schedule"}`) and took a gig off the month (`gigCount` 1); an entry already in the index was started and then re-pointed at `gleft@2026-10-07`.
- With the fix: `145 passed, 0 failed`.
- Each half knocked out alone, then restored byte for byte: the heal's skip removed → 2 failed (the guard alone still stopped the start); the guard removed → 4 failed; `sweep` ignoring `drop` → 1 failed.
- The letter, failing first: the new section of `test/firstgig.mjs` ("AN ACCOUNT ON ITS WAY OUT IS NOT WRITTEN TO") against the unguarded `sweepNotes` printed `41 passed, 1 failed` — `{"got":[1,1],"want":[0,0]}`, one letter sent. With the guard: `42 passed, 0 failed`.
- The whole suite, on the final tree with both halves: `sh test/run.sh` exited 0 in 1m59s across its 59 sections, with no ✗ line.
- Production, read-only (`netlify blobs:get` of `artists` and `gigsched`, 2026-09-27): 6 accounts, 0 marked for deletion, 1 schedule entry, 0 live; `delqueue` does not exist.
- Not checked: a real cron ring against a deploy. A preview shares production data, so it is no place to exercise a write path.

## Amendment, 2026-09-28: every other walk

The founder asked for every other registry walk to be checked for the same gap. These are the places that walk `byId` of either registry, or resolve a slug outside `publicArtist`, and what a marked row means in each:

| Where | What it does | Verdict |
|---|---|---|
| `artistpage.mjs`, the `/:slug` share card | resolved the slug with `artistBySlug` alone | **The public gap.** A deleted account's name and portrait stayed on link previews. It now resolves through `publicArtist`. |
| `artists.mjs` | the public directory | already filters `.del` |
| `events.mjs` featured spots, `_vstats.mjs` | the city feed; a venue's stats | read the city index, which deletion empties on day one |
| messages, votes, pay, RSVP, diary, lyrics, community and the rest | public doors | all go through `publicArtist` |
| `img.mjs`, `vid.mjs` | photos and clips, by id or slug | left open on purpose: the edge keeps each URL for a year, and the export and the Studio carry `/api/img?a=<aid>` addresses for the whole window |
| `auth.mjs` sign-in doors, the studio-code door, `qr.mjs` | the owner signing in; a printable code | must keep working, because Undo needs a way in; a QR code carries only the address it was asked for |
| `_register.mjs` (registercron), `mirrorcron.mjs`, `tools/metrics.mjs`, the founder's venue list | the register of every night, the R2 copy, a local snapshot, venue verification | include marked accounts on purpose: the nights happened, and the data is kept for the thirty days |
| `_warehouse.mjs` (sheetcron) | the founder's Google Sheet | **The internal gap, marked at the founder's word.** A leaving account appeared as a normal artist, with its future gigs in the Gigs tab. It stays in the sheet, because its nights happened, and a new last column, `Being deleted on`, carries the purge date on its Artists, Gigs and Venues rows: the date the owner sees on the Studio's banner. Appended, not inserted, so no column the founder already uses moves; the snapshot tabs rewrite their header every sync, so nothing needs deleting by hand. |
| `auth.mjs` Settings | the names an artist has invited | **Cosmetic, hidden at the founder's word.** A leaving account's name stayed on its referrer's list, and in the count, until the purge; both now skip a marked row. `test/accounts.mjs` "AN ACCOUNT ON ITS WAY OUT LEAVES THE INVITE LIST" failed first (`135 passed, 1 failed`: `{"got":[1,["Kid Aldo"]],"want":[0,[]]}`) and passes after; the suite exited 0 across 60 sections. |

Verified: the new section of `test/sharecard.mjs` ("AN ACCOUNT ON ITS WAY OUT HAS NO CARD") failed first with `42 passed, 3 failed` — the card still read `"Bo Lind"` with the portrait — and passes after the fix, `45 passed, 0 failed`. The sheet: the new section of `test/sheets.mjs` ("AN ACCOUNT ON ITS WAY OUT SAYS SO") failed first with `199 passed, 7 failed` (the column absent, the leaving artist's gig listed unmarked) and passes after, `206 passed, 0 failed`; the artist, gig and venue marks knocked out one at a time each gave `205 passed, 1 failed`. The whole suite, on this tree rebased onto 04e78db (decision 0099): `sh test/run.sh` exited 0 across its 59 sections, with no ✗ line.
