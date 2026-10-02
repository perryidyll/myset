---
id: 0151
title: One tap, one song — a Play tap carries an id, its retry carries the same one, and the show answers an id it already obeyed
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: voting
reverses:
superseded_by:
invariants: [0hy]
commits: []
tests: [test/onetap.mjs]
files: [netlify/functions/admin.mjs, netlify/functions/_lib.mjs, netlify/functions/stage.mjs, public/studio.js, public/studio.html, test/onetap.mjs, test/run.sh]
---

## The question

The Studio's Play request has no clock, and the server's only defence against a double start is a window: a second Play Top within `DOUBLE_TAP_MS` (eight seconds) of the last start is refused, and a second Play of the song already playing is a no-op.

The scale audit of 2 October 2026 found the edge of that window. A Play that takes longer than eight seconds (bar wifi, a busy store, a sweep of twelve fan files) can land on the server while the Studio still shows nothing. The connection drops, the Studio says *Connection hiccup — try again*, and the artist taps again. By then the window has expired, so Play Top starts the **next** song down and the first goes to *played* without ever having been performed. A retried Play of a named song starts it a second time: a second entry in the night's list, a second play in the event log, and a new mark that collects the requests to hear it again that the room cast while it was playing.

The audit's line: *Give each tap an id the server remembers. Re-read the stage before allowing a retry.*

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The Studio makes an id for each Play tap and sends the same id with that tap's retry. The show keeps the last few ids that started a song (`TAPS_KEPT`), in the same write that starts it. An id the show already holds is answered with the stage (`repeat: true`) and nothing else happens. With no answer, the Studio reads the stage before it lets another tap through, and lets go of the id when the stage lists it | About 70 bytes a song on the show record; one extra field on two actions | `show.taps`, `playAct` in the Studio | A Studio that reused a stale id would have one deliberate tap answered as already done; the Studio forgets it after a couple of minutes and drops it as soon as the stage shows it landed |
| B | Widen the window (say to 60 seconds) | Nothing | None | Still a window: a minute-long Play is rarer, not impossible; and an artist who really does want the next song quickly is refused |
| C | A clock on the Studio's request, and no retry until the stage is read | Studio only | A timeout in `api()` | Fixes the Studio's half and not the server's: two copies of one tap still both act, and a request the Studio gave up on can still land after the retry |
| D | Make Play Top name the song it means to start (the Studio sends the id it shows) | Studio and server | Play Top becomes Play | The retry would start the right song a second time, as Play does today; it moves the hazard rather than removing it |
| E — do nothing | | | | A Play slower than eight seconds and a second tap burn a song in front of the room |

## What was chosen, and why

A, for these reasons.

- **Answered inside the write.** The check runs in the `mutateShow` callback, before anything else, so two copies of one tap can never both act: whichever writes second finds the first's id when its compare-and-swap sends it round again.
- **Recorded only when a song starts.** A tap the server refused (nothing left in the pool, the window) leaves no trace, so the Studio keeping that id for its retry is the same as a fresh one.
- **The first request finishes its own work.** A repeat does no sweep, files nothing and pushes nothing: the request that started the song does those, or already has. It answers with the stage as it stands, which names the song that tap started.
- **A loop that meets its own tap is not a repeat.** `mutateShow` reads the show back after writing it. If something else wrote in between, the loop goes round again and finds the tap it has just written. Each request carries a private `rq`, stored with the tap, so it knows the tap is its own and carries on with the sweep and the event log. (Without this the play's event-log entry and its sweep would be lost; without the tap check at all, the same loop could start a second song.)
- **The window stays.** It needs nothing from the page, so it still covers a Studio opened before this change, which sends no id.
- **Only Play and Play Top.** End song, the voting window, Last call, Unplay and Decline were each read for the same hazard: a retry of any of them either repeats the same change (harmless) or is refused with a message. None of them starts the next thing.
- **The Studio side is one function at the two Play call sites** (`playAct`, called from `startSong`). It holds the Studio's write lock while it reads the stage, so no tap gets through between the failure and the look.

## What this makes harder

- The show record carries up to `TAPS_KEPT` tap entries (`{id, rq, song, at}`). They are never cleared by a new night; they are bounded instead.
- A tap answered as a repeat shows the stage and no toast; the artist sees the song that started.
- Anything new that starts a song from the Studio should go through `playAct`, or it has the old hazard again.

## What would reverse it

- The live room leaving the show record for an ordered log (a Durable Object, decision 0147's reversal): the log would de-duplicate taps itself.
- A request clock and a stage summary in the Studio (the audit's separate rows) make a slow Play rarer; they do not make this unnecessary.

## How it was verified

- `node --import ./test/register.mjs test/onetap.mjs`: 40 ✓, 0 ✗. The window is scaled to 300 ms; reads are slowed until Play Top itself takes longer than the window (687 ms on the run recorded), then the retry arrives after it. Then: answered as done, alpha still playing, bravo not started, nothing in *played*, one count, one entry, one play in the event log. Also: a new id after the window starts the next song; a page that sends no id is served as before; two copies of one tap in flight at once (one acts, one is a repeat, one play in the event log); a retried Play of a named song (no new count, mark, entry or event); the show keeps `TAPS_KEPT`; an id is cleaned and cut. And the case the `rq` exists for, made on purpose: Play's write lands, the test writes the show before Play's read-back looks, and the play is still answered as the tap that acted, with its event-log entry (two votes) and its sweep.
- The Studio's `playAct`, taken out of the shipped `public/studio.js` and run with `act()` and `load()` stubbed: an id per tap, the same id on the retry and after a refusal, released by a landed answer or by a stage that lists it, a new id for another song and once the tap is old, the write lock held while the stage is read, and no id from a practice round.
- Six knock-outs, each red: no tap check (15 ✗); a found tap always treated as somebody else's (3 ✗); a tap never recorded (the file stops at the check of what the show keeps); the stage without `taps` (1 ✗); the Studio making a new id every tap (4 ✗); no stage read after no answer (2 ✗).
- `sh test/run.sh` exited 0.
- **Not checked:** a real Studio on a real slow network; the Studio opened in a browser (nothing it draws changed); a Studio page opened before the deploy (it sends no id and keeps the window, as tested).
