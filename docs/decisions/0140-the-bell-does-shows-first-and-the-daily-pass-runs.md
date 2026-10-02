---
id: 0140
title: The bell does shows first, and the daily pass runs on a clock
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: scale
reverses:
superseded_by:
invariants: [0bw, 9d13, 0ho]
commits: []
tests: [test/autoshow.mjs]
files: [netlify/functions/autocron.mjs, netlify/functions/_auto.mjs]
---

<!--
  FRONT-MATTER FIELDS

  id           four digits, in order. ./tools/decide.sh picks the next one.
  title        what is now TRUE, not what was done. "A vote never comes back",
               not "changed the vote logic".
  status       proposed | decided | superseded | reversed
  decided_by   perry | claude | perry-confirmed   (who actually chose — this matters
               later, because a decision Perry made is not one to re-litigate)
  area         voting | plans | money | storage | auth | media | scale | ops | ui | docs
  reverses     the id of a decision this overturns, if any
  superseded_by  filled in later, by whatever replaces this
  invariants   the INVARIANTS.md ids this created or changed
  commits      short hashes
  tests        the suites that would fail if somebody undid this
  files        the files where this decision physically lives

  Delete this comment when you fill the template in.
-->

## The question

`autocron` rings every two minutes and is what starts and ends shows from the
calendar. The 2026-10-02 scale audit found four ways it stops doing that as the
number of artists grows, all in the code as written:

- **The daily pass ran first, with no clock.** Once a day `heal()` visited every
  artist in series — one calendar read and one index write each — before the sweep,
  and saved its cursor only at the end. Timed on the real code in the audit's
  simulator: 164 ms an artist, so 100 artists is 17 s and 300 is 49 s. Netlify stops
  a scheduled function at 30 s by its documents, and this repo measured a kill at
  12.9 s (decision 0069). Past that point the ring dies before it reaches a single
  show, the cursor is never saved, and the next ring dies the same way.
- **A gig under way stayed "due" for its whole length**, and the sweep took the
  first 40 due entries. The 41st gig in progress was never looked at: it did not
  start itself and it did not end itself.
- **The idle sweep took the first 40 live shows**, every ring, reading 13 documents
  each. The 41st live show could never be ended for inactivity.
- **The warm pings were awaited before anything**, up to eight seconds.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Sweep first; a seven-second budget for beginning work; the daily pass in chunks of ten calendars with one write and the cursor saved per chunk; a night under way marked `on` and not due until its end; rotating cursors on both sweeps; five artists at once; warm pings alongside | A few marks on the index document | `RING_BUDGET_MS`, `HEAL_CHUNK`, `SWEEP_POOL`, `on`, `sweepAfter`, `idleAfter` | A mark wrongly kept would stop a start — so `on` is set only by `autoTick` saying the night is `settled`, and is dropped by any calendar write |
| B | Only move the sweep above the heal | One line | None | The heal still dies past ~100 artists and never completes; the 41st gig is still stranded |
| C | One scheduled function per job | More functions | Three schedules, three locks | More cold starts; the same 40-entry flaw in each |
| D — do nothing | Works at six artists | Nothing | None | Shows stop starting and ending themselves somewhere between 60 and 180 artists |

## What was chosen, and why

A. The order is the point: what a room is waiting on goes first, housekeeping gets
the time that is left, and each step is caught on its own so one failing cannot
take the rest with it.

- **Budget.** Nothing new is begun after seven seconds. The documents say thirty;
  the one measured kill was at twelve. Seven leaves the unit in hand room to finish
  inside the smaller figure.
- **The daily pass.** Ten calendars are read together and land in one write that
  also moves the cursor. Simulated on the same timings as the audit: 100 artists
  2.1 s (was 16.7 s), 300 artists 6.3 s (was 49.3 s). A chunk does not put back an
  entry somebody changed while its calendars were being read: the index is read
  first, and an entry that no longer matches that reading is left alone.
- **Settled nights.** `autoTick` returns `settled` when tonight's start is decided
  for good: started, already live, already started once, or ended by the artist.
  The sweep marks the entry `on` for that night. Not settled, on purpose: "no songs
  switched on" and "auto-start is off" — either can change mid-gig and the next ring
  should act on it.
- **Rotation.** Both sweeps walk what is due in id order from where the last ring
  stopped, so a ring that runs out of room or time leaves the rest first in line.
- **The live mark** (`live[aid]`) becomes "last known sign of life". A show seen
  busy has its mark moved up, so it is read again in three hours, not in two minutes.

## What this makes harder

- The index entry now carries marks (`skip`, `on`) that any code rewriting an entry
  for the same night must keep or knowingly drop. `reindexSched` keeps `skip` and
  drops `on`; the daily pass keeps both.
- Five starts at once all write the one index document. That file is already the
  audit's next item (one live mark per artist).

## What would reverse it

- Netlify raising or lowering the real limit: `RING_BUDGET_MS` is one constant.
- Thousands of starts in the same minute. Seven seconds of starts a ring is not
  enough for that; the fix is a start per artist on its own invocation, or a lazy
  start when the first fan arrives.

## How it was verified

`node --import ./test/register.mjs test/autoshow.mjs` — 180 passed, 0 failed. New cases:

- a started gig is marked `on`, the next ring reads only the index, and it is due
  again and ended when its end is;
- three rings with room for one reach three different acts; a ring out of time still
  does one and leaves a place-marker; a ring with time clears it;
- the daily pass out of time does one chunk, saves the cursor, does not stamp the
  day; ten calendars land in one write; with time it finishes, finds a lost entry
  and keeps a mark on the same night;
- a young live show costs the idle sweep one read; a busy three-hour show has its
  mark moved up and is not read again next ring; three hours after its last sign of
  life it is ended;
- with the daily pass due and a gig due, the ring writes the show before the pass
  reads anybody else's calendar.

The audit's simulator (`sim/heal.mjs`, 42 ms reads, 80 ms writes): 100 artists
2,085 ms, 300 artists 6,343 ms.

**Not checked:** a real ring on production with many artists. The registry held six
on the day of the audit.
