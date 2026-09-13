---
id: 0066
title: every vote, play and dollar of a night is filed in an append-only event log as it happens — the archive keeps sums, the log keeps the night
date: 2026-09-14
status: decided
decided_by: perry
area: storage
reverses:
superseded_by:
invariants: [0fq]
commits: []
tests: [test/foundations.mjs, test/cost.mjs, test/votesstay.mjs, test/decline.mjs, test/finality.mjs]
files: [netlify/functions/_evlog.mjs, netlify/functions/_append.mjs, netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/_history.mjs, netlify/functions/history.mjs, netlify/functions/_account.mjs]
---

## The question

The founder asked (2026-09-13) that "literally ALL data is tracked for every
artist and every show — forever", and for the foundations an Instagram-sized
MySet would need laid now. The storage report written the same day found the one
real gap: **individual vote events were never written**. A vote was counted into
a tally; the tally into `show.log[]` when the song started (the top eight of the
board, cut) and into `hist_` at the end; the vote's own row on the fan record —
its cost, its paid part — was destroyed the moment the song played
(`dropSongVotes`). "When did the room arrive", "how did this song climb", "what
did the paid votes do" had no answer for any night that had ever happened, and
never would.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A timestamp on every vote row (`va[song][i]` = `[cost, paid, when]`); the three functions that take rows off the board (`dropSongVotes`, `refundSongVotes`, `wipeBoard`) hand back what they removed, and the Studio action that called them files it — with the play — in `evt_<aid>_<showId>`, an append-only chunked log (`_append.mjs`). At the end, whatever is still standing, the money in the window and the end time go into the head's replaced state. | **Nothing on the vote path** — no extra read, no extra write on a cast (test/cost.mjs holds 5 reads / 2 writes). One CAS write per song started, per decline, per removal, per clear; one at the end. | `_evlog.mjs`, `_append.mjs`, a third field on a vote row, `?log=` on `/api/history` | A log that fails to write must never stop a song — every call is caught; the loss then is the detail of that one play, and the sum is still in `show.log`. |
| B | Append an event on every cast, from `vote.mjs`, to the same log. | A second write on every vote in the room, on a key every voter in the room contends for — the exact thing sharding the fan records (rule 5) was built to avoid. 80 simultaneous voters would serialise on one document. | a shard scheme for the log | Contention on the hottest write path in the product. |
| C | Reconstruct events at archive time from the fan records. | Free on the vote path — but the rows of every song that PLAYED are gone by then. The log would hold only what never played. | none | The record would be the leftovers, which is the opposite of the record. |
| D — do nothing | The archive keeps sums. | Every analytics question the founder's vision needs is unanswerable for every night before the day it is built. | | The one fact "state is a cache of the log" depends on is never written. |

## What was chosen, and why

A, because it costs the cast nothing and loses nothing: the row is filed at the
moment it would otherwise be destroyed, by the code that destroys it. The vote
path stays exactly as measured (INVARIANT 9d13). What a play files is what THAT
song collected; the reset, refund and drop paths file what they took, each
labelled, so every vote appears in the log exactly once, with the reason it
left the board. The end files the rest — and replaces rather than appends its
part, so an accidental End, eight more songs and another End (the case 17c's
detail guard already handles) files every vote once.

`d` on a vote is `sha256(showId | device)` cut to twelve characters: stable for
the night, so "one phone, nine votes" is visible to the artist and to a future
analytics job, and unlinkable to any other night or to the phone — phones are
counted, never named (0bu). It is not stripped from the export, because it is
not a name.

The log is chunked because a 10,000-person gig is 50,000 events, and a CAS on a
3 MB document per song start is a bad idea. The head spills its first CHUNK
entries to a write-once part when full; every key is computable from the head
(INVARIANT 1). The same log module now backs the versions (0067) and the
archives the capped lists spill into (0068).

## What this makes harder

A vote row is three fields, not two; anything that writes `va` by hand must
write the third or the event will carry the song's first-vote time instead.
Every future path that removes votes from the board must harvest and file them
or the log goes silent for that path — `test/foundations.mjs` names the four
that exist. The log is one more key family in `keysFor()` (export and delete).

## What would reverse it

A measured cost on `play` that matters (it is one CAS write on a key nobody
polls). A privacy finding that a per-night pseudonym is still too much — then
`d` goes and the counts stay. A real event store (Kafka-shaped) at 10⁶ artists
— the log's shape is the same; only the append moves.

## How it was verified

`node --import ./test/register.mjs test/foundations.mjs` — 60 ✓: a vote row
carries its cast time; alpha played → its three votes and the play in the log
with two pseudonyms, neither a device id; declined → `refund`, removed → `drop`,
cleared → `reset`, each vote once; ended → the standing vote, the tip (500¢) and
`end`; ending again files nothing twice; `/api/history?log=` returns it for the
owner and 404s an unknown night. `sh test/run.sh` exit 0, 2,932 ✓ — including
`test/cost.mjs`: a vote is still 5 reads / 2 writes. Not checked: a real night
in production; the first is the measurement.
