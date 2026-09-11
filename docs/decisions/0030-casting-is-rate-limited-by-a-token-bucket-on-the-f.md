---
id: 0030
title: Casting is rate-limited by a token bucket on the fan record
date: 2026-09-11
status: decided
decided_by: perry-confirmed
area: scale
reverses:
superseded_by:
invariants: [0fa]
commits: [e74292b]
tests: [test/errlog.mjs, test/cost.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/vote.mjs]
---

## The question

The open-line report named vote spamming as a denial-of-wallet hole: a script can cast
faster than any person, and every cast is a write that costs money. The user asked to
proceed with the report's recommendation — a small token bucket on the fan record,
about thirty casts a minute, checked inside the write that already happens — before the
open line, not after.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: token bucket on the fan record** | 20 casts in a row (30 at first; the user lowered it to 20 the same day), refilling at 30 a minute, stored as two numbers on the record the cast already writes; a refused cast writes nothing | Nothing — no extra read, no extra write | None | A real person hitting it — at 20 taps in a row, they will not |
| B — a limit by network address | Count casts per IP | A shared counter, a read and a write per cast | A new document under contention | The whole bar shares one address on the venue Wi-Fi, so the room is throttled as one; phones on mobile data rotate addresses and dodge it |
| C — a global per-show cap | Stop the room at N casts a minute | A hot counter every cast contends on | The exact hot document INVARIANT 1 and the shards were built to avoid | Throttles the honest room to stop one script |
| D — do nothing | — | The write bill is open to anyone with a loop | — | One script, one night, a Netlify bill |

## What was chosen, and why

**A.** It is the only option that costs zero extra operations and cannot hurt a real
room. The check runs after the credit check on purpose, so a fan who is out of votes
keeps hearing that (and keeps seeing the buy sheet), and only casts that would have
landed spend a token. On Durable Objects, later, the same bucket lives in memory and
an abusive connection is simply dropped — so this is built once, in the right place.

## What this makes harder

Nothing visible. A script that spaces its casts to one every two seconds is under the
limit — the bucket bounds the write RATE, it does not detect a bot. Vote counts are
still bounded by credits, which are bounded by money; this closes the bill, not the
contest.

## What would reverse it

A real fan hitting the 429 — the Studio's bug reports would show it as
`vote: Easy — that’s a lot of taps…`. If that ever appears from a human, raise the
burst before removing the limit.

## How it was verified

`test/errlog.mjs`: a fresh device gets exactly the burst and then nothing in the same
instant; two seconds later one more, not two; ten minutes idle refills to the burst and
never past it; a mangled record is treated as fresh, not as banned. Through `/api/vote`
with 200 free credits: the burst lands, the next cast is a 429 in words a person can act
on, nothing past the burst was written, another device is untouched, and a replay of a
kept cast is answered from memory rather than refused. `test/cost.mjs` still holds the
audience poll at its read ceiling. `sh test/run.sh` — 1,926 assertions, 0 failing.
