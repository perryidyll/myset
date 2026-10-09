---
id: 0143
title: The vote page waits longer when the room cannot be reached, and sends a busy vote again
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: scale
reverses:
superseded_by:
invariants: [9d, 15h, 0hr]
commits: [831dcb8]
tests: []
files: [public/vote.html]
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

Three faults on the vote page, found by the 2026-10-02 scale audit, that all show up
at the worst moment — when the server is already struggling:

- **A phone with no board asked every three seconds for ever.** The poll's ladder
  only slows down when a board arrives unchanged. A phone that never got one stayed
  on the fastest rung, and the "Couldn't reach the room" message tested for an
  empty page that the grey skeleton never is, so it was never shown. Five thousand
  such phones is about 3,300 requests a second at a backend that is failing.
- **No request had a timeout.** One call that never answered held the poll loop and
  the song's button.
- **A vote the server answered "busy" was rolled back** and the fan read the word
  "busy". Only a dropped connection was retried, though the cast id makes any
  retry safe.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Each load without a board doubles the wait, to a minute; every request has a clock; a "busy" vote is sent up to three more times with the same cast id; the message shows | A struggling room hears back from each phone more slowly | `timed`, `within`, `FAILS`, `TICKING` | A phone on bad wifi waits longer between tries — a tap, a pull or the screen coming on brings it back to one doubling |
| B | Have the server tell phones to slow down | Needs the server to answer | A header | The failure case is the server not answering |
| C — do nothing | | Nothing | None | A brown-out becomes an outage |

## What was chosen, and why

A, on the page, because the page is the only part that is still running when the
server is not.

- **Backoff.** `FAILS` counts loads in a row without a fresh board — unreachable,
  timed out, or a 503. The wait is the floor times two to that power: about 6, 12,
  24, 48 seconds, then a minute, with the usual ±20% jitter. A fresh board resets
  it. A full wake (screen on, a vote, a pull) drops it to one doubling.
- **The kept board stays on screen** the whole time; this only changes how often
  the page asks.
- **Clocks.** Ten seconds on reads and the vote, twenty on checkout and the payment
  confirm. One poll at a time.
- **A busy vote** is sent again after about 0.7, 1.6 and 3.2 seconds with the same
  cast id. The server remembers the outcome against that id, so a send that did
  land is answered from memory. A real no (out of votes, voting closed) is never
  retried. If all four fail the fan reads "The room is very busy and that vote
  didn't land — tap it again".

## What this makes harder

A room coming back from an outage refills over up to a minute, not three seconds.

## What would reverse it

Push instead of poll (the audit's long-term step) removes the ladder altogether.

## How it was verified

In a browser at 375 px against the real handlers (`tools/localhost.mjs`), with
`fetch` made to fail from the console:

- seven loads without a board: waits of 6.3, 10.5, 26.2, 39.7, 65.4, 49.2, 54.3
  seconds (jittered around 6, 12, 24, 48, 60, 60, 60); the kept board stayed on
  screen; a full wake set the count to 1; a good load set it to 0;
- a request that never answers gave up at 317 ms against a 300 ms limit;
- a vote answered "busy" twice was sent three times with one cast id and landed
  once: one credit spent, one vote counted, 3.2 seconds;
- a vote answered "busy" twice and then a real no was not sent a fourth time;
- an address with no room showed "Couldn't reach the room" in place of the skeleton.

`test/split.mjs` and `test/copy.mjs` pass. No automated test drives the page's
poll loop; these checks were by hand.

**Not checked:** a real phone on bar wifi; Safari older than AbortController (the
page falls back to a plain fetch there).
