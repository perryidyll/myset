---
id: 0142
title: A read that failed is an error, never an empty document
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: storage
reverses:
superseded_by:
invariants: [1, 4, 16, 0hq]
commits: [831dcb8]
tests: [test/storefail.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/_errlog.mjs, public/studio.js, test/blobs-fake.mjs]
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

`readDoc` is the one function every document read goes through. It wrapped the
store call in `try { … } catch {}` and returned the caller's fallback on any error.
So "the store did not answer" and "nothing is stored there" were the same value to
every caller. The 2026-10-02 scale audit traced what that does when the store errors
or throttles, which is most likely when load is highest:

- The board is built from twelve fan files. One unreadable file meant a board short
  a twelfth of the room's votes — and that board is kept at the edge for the whole
  room.
- A fan whose file could not be read was shown fresh credits.
- Play picked a winner from partial votes.
- A sign-in check found no artist list, or no show, answered "unauthorized", and
  the Studio removed the artist's sign-in and showed the sign-in screen mid-gig.
- Netlify's Blobs client waits five seconds and retries, up to five times, on a 429
  or 5xx. With no clock around the read, a throttled read was a request that hung
  for up to 25 seconds.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `readDoc` throws a `StoreError` when the store throws or does not answer in four seconds. A missing document is still the fallback. `guard()` answers a `StoreError` with 503 "busy". Every request handler is behind `guard()`. `casDoc` retries one failed read and gives up on the second. The Studio treats a 5xx like a dropped connection. | A request that used to "succeed" with wrong data now fails | `StoreError`, `isStoreError`, `READ_TIMEOUT_MS` | A caller nobody found that relied on the silent fallback now answers 503 during a store error — which is the honest answer |
| B | Fix the callers one by one (board, me, vote, sign-in) | 135 call sites to judge | A second read helper | The next caller written forgets |
| C | Keep the last good copy of each document in the instance and serve that | Memory, staleness rules | A cache per document family | A stale fan file is a wrong credit count too |
| D — do nothing | An outage shows as wrong answers | Nothing | None | Votes dropped from a cached board, artists signed out mid-gig |

## What was chosen, and why

A. The fault is in one place, so the fix is in one place, and no future caller can
get the old behaviour by forgetting something.

- **Missing is still empty.** Only a thrown error or a read past the clock is a
  `StoreError` (`code: 'store-read'`, `message: 'store-unavailable'`, `key`).
- **Four seconds.** A healthy strong read is tens of milliseconds. Four seconds is
  shorter than the client's first five-second retry sleep, so a throttled read
  fails instead of hanging. `MYSET_READ_TIMEOUT_MS` overrides it.
- **`casDoc` keeps its tolerance for a blip.** One failed read is retried, as the
  loop always did by accident. A second in a row throws the store's error. A failed
  read is never followed by a write: there is no document in hand to write.
- **`guard()` answers 503 "busy"**, with `no-store` and `Retry-After`. It does not
  file the error in the error log, because that is a write to the same store.
  `logErr` skips a `StoreError` for the same reason.
- **Sixteen request handlers that had no `guard()` now have one** (`fan`, `profile`,
  `events`, `venue`, `venueadmin`, `venueauth`, `artists`, `diary`, `history`,
  `lyrics`, `revenue`, `img`, `vid`, `qr`, `mapconfig`, `moneymodel`). `artistpage`
  already catches its own read and serves the page as it always was.
- **The Studio.** `api()` marks a 5xx reply `offline`, so `load()` keeps the last
  good screen, the sign-in and the refresh timer, exactly as it does for a dropped
  connection (INVARIANT 16).

## What this makes harder

- During a store error the pages show "busy" or keep their last state, where before
  they showed something — wrong, but something. Rule 1 ("the room can still vote")
  is kept by the vote page holding its last board and retrying (decision 0143).
- Anything new that reads a document on a path that must never fail has to catch
  `StoreError` on purpose.
- Writes still have no clock. A conditional write that times out may still land, and
  a retry would then apply a non-idempotent change twice. Left for the step that
  gives each mutation an id.

## What would reverse it

A store whose reads fail often in normal running, so that 503s become routine. Then
option C (serve the last good copy, per family, with rules) is the next step — on
top of this, not instead of it.

## How it was verified

`node --import ./test/register.mjs test/storefail.mjs` — 35 passed, 0 failed, with the
fake store's reads made to throw (`__failReads`) or never answer:

- a missing document is the fallback; a throwing read is a `StoreError` with the
  key; a read that never answers gives up at the limit;
- `casDoc` retries one failed read and the write lands; with two in a row it throws
  and the stored document is byte-for-byte unchanged;
- with one fan file unreadable the board is 503 `no-store`, directly and through the
  fan door; the fan in that file gets 503 from `/api/me`, a fan in another file 200;
- a vote into the unreadable file is refused whole, writes nothing, and the same
  cast id lands once afterwards;
- with the artist list or the show unreadable the Studio gets 503 "busy", never
  "unauthorized"; an action is refused and writes nothing; the same sign-in works
  when the store is back;
- an unreadable profile is a 503 that the edge will not keep.

In a browser against the real handlers (`tools/localhost.mjs`): with `/api/stage`
answering 503 the Studio kept its screen, its sign-in and its timer.

The whole suite: `sh test/run.sh`, exit 0.

**Not checked:** a real store error or throttle on production. What the real client
throws on a 429 was read in its source (`@netlify/blobs` 10.7.13), not provoked.
