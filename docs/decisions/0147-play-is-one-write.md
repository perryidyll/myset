---
id: 0147
title: Play is one write — a vote that set off before its song started is collected by it, whichever side of the sweep it lands
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: voting
reverses:
superseded_by:
invariants: [0hu]
commits: []
tests: [test/playonewrite.mjs, test/foundations.mjs]
files: [tools/roomsim.mjs, test/contention.mjs, netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/_board.mjs, netlify/functions/stage.mjs, netlify/functions/_lifecycle.mjs, test/playonewrite.mjs, test/blobs-fake.mjs]
---

## The question

Starting a song was two things: the show write that says what is playing, then a sweep of all twelve fan files to take that song's votes off the board (`consumePlayedVotes`).

A cast reads the show once, before its own write, and retries that write for as long as it takes. In a rush a vote that set off before Play can land after the sweep has passed its file. The scale audit of 2 October 2026 simulated 1 to 13 of these per Play at 5,000 phones, and "Last call" bunches votes on the leader just before Play, which is the worst moment for it.

What happened to such a vote:

- It stayed on the song that had just started. The fan was charged for it.
- Once the song was in `played`, it read as a request to hear the song again, bought at the ordinary price instead of the replay price. Play Top lets a played song back into the pool when it holds votes.
- Separately, a sweep that ran out of tries on one file was swallowed (`.catch(() => {})`), leaving a twelfth of the room's votes on the song, with nothing to try again.

The founder asked for phase two of the audit's fixes; the audit's line is *Play becomes one write: stamp "collected at", ignore older votes.*

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The show counts every song started (`plays`) and records the count each song was started at (`col`), in Play's own write. A cast stamps each vote row with the `plays` it read. A row stamped lower than its song's mark is collected: it is left out wherever the board is drawn. The sweep still runs, as housekeeping | One integer on a vote row; one small map on the show, cleared each night | `liveFan` / `liveFans`, called where the board, the fan's own votes and the Studio's queue are built | A reader that counts votes without the filter shows a few too many (the three that matter are tested; the night's totals deliberately count the file as it is) |
| B | After a cast lands, read the show again and move the vote if its song has started | One more strong read on every vote | A second write on the vote path | The vote path is the hot path: `test/cost.mjs` holds its read count, and this breaks it |
| C | Compare clocks: stamp "collected at" as a time and ignore older votes | Nothing new on the row | None | The stranded vote's own timestamp is *later* than Play's, so the clock says it is newer. It does not work |
| D | Drop the sweep and file every vote at the end of the night | Play really is one write | The event log changes shape: votes filed at the end, not with their play | Decision 0066's log is read by history and the register; a larger change than the fault deserves |
| E — do nothing | | | | A handful of wrong votes per Play in a big room, on the song that just played, at the wrong price |

## What was chosen, and why

A.

- **A count, not a clock.** Two function instances do not share a clock, and the stranded vote is written after Play. What tells them apart is what the vote had seen: it read a show in which fewer songs had started.
- **The rule.** `show.plays` goes up by one on every Play and Play Top; `show.col[song]` is set to the new count in the same write. `chargeVotes` writes `[cost, paid, when, plays seen]`. A row is collected when its fourth field is an integer lower than its song's mark.
- **Nothing is refunded.** The fan voted for a song and it is playing: the same outcome as a vote that landed a millisecond before Play. `used` does not move.
- **A request to hear it again still counts.** It is cast after the song started, so it reads the new count and its stamp is not lower than the mark.
- **Only a stamped row can be collected this way.** A row from before the stamp existed is left to the sweep, as today. Votes bought for a song at checkout (`grantPaidSongVotes`) carry no stamp on purpose: the rule never takes a vote somebody paid money for.
- **The filter works on records already read, never on the store.** The rows stay in the fan file until the sweep or the end of the night files them, so every vote is still filed once (INVARIANT 0fq). The night's totals read the file as it is, so a vote collected this way is still counted as a vote cast.
- **The sweep stays, as housekeeping.** It files the votes with the play and keeps the files small. If it loses, the board is still right.
- **No new read.** Play already read the show before its write (`prevShow`); that read moved up beside the fan files.

## What this makes harder

- Anything new that counts live votes from fan records must go through `liveFans(fans, show)` first, or it will count the few rows a song has already collected.
- A vote collected this way and then swept by a later replay of the same song is in neither play's `roundVotes`. The night's vote total can be short by those few.
- The show document carries one small entry per song played tonight.

## What would reverse it

- The live room leaving the twelve shared files (one small file per fan, or a Durable Object that orders casts and plays itself): the race goes away and so can the stamp.
- Option D, if the event log is ever rebuilt to file at the end of the night.

## How it was verified

- `node --import ./test/register.mjs test/playonewrite.mjs`: 29 ✓, 0 ✗. The race is made on purpose: the cast reads the show, is held on its fan file, and Play runs to completion before it lands. Then: accepted, in the file, not on the board, not in the fan's own votes, not in the Studio's queue, not a replay candidate; Play Top picks the next song.
- A sweep whose every write is acked and lost: the six votes are still in the files and the board is right anyway; the end of the night still files all six.
- Seven knock-outs, each red: Play does not mark; the board does not filter; the personal payload does not filter; the cast does not stamp; Play Top ranks unfiltered votes; an unstamped row is collected too; the Studio does not filter.
- The audit's simulator against this change, 5,000 phones, Play mid-rush: 4, 7 and 4 votes landed after the sweep in three runs; none was on the board. Without Play, 1,500 of 1,500 still land.
- Stacked on 0145, `test/contention.mjs` now asserts it on every run: the Play-mid-rush room ends with no vote counted on the song that just started (`tools/roomsim.mjs` counts the files through `liveFans`; the seeded run leaves 4 late rows in the files, none counted). On 0145 alone the same assertion is red.
- `sh test/run.sh` exited 0. One existing assertion changed: `test/foundations.mjs` pinned a vote row to three fields.
- **Not checked:** a real room. A page open across the deploy (the row gains a field old code ignores; rows it wrote carry no stamp and are swept as before). The vote page in a browser: nothing in `public/` changed.
