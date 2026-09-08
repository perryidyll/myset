---
id: 0008
title: Every stored key must be computable, because list() is banned
date: 2026-08
status: decided
decided_by: claude
area: storage
invariants: [1, 2, 3, 4, 5]
commits: []
tests: [test/cost.mjs, test/e2e.mjs]
files: [netlify/functions/_lib.mjs]
---

## The question

Netlify Blobs offers `list()`. Reaching for it is the obvious way to answer "what shows
does this artist have?" or "what clips are orphaned?".

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Ban `list()` for live data; every key is computable** | Correct reads, always | Every collection needs an index document somebody has to keep current | `histidx_`, `histids_`, `cityindex`, `gigsched`, `vidqueue`, the two registries | An index and its documents drift apart |
| B — use `list()` | Less bookkeeping | It is **eventually consistent and has been measured lagging by minutes**. Vote counts read that way showed zero while the writes had already landed | none | Silent, intermittent data loss during a gig |
| C — a real database | Correct and queryable | A vendor, a schema, a migration path, a bill | a database | Weeks, for a problem indexes already solve |

## What was chosen, and why

A. The failure mode of B is the worst kind: it only appears under load, it looks like
data loss rather than staleness, and a gig is exactly when it happens.

Three more storage rules were learned the same way and belong with it:

- **Conditional writes need `@netlify/blobs` v10+.** v8 accepted `onlyIfMatch` and
  silently ignored it. Votes were lost.
- **Compare-and-swap alone is not enough.** Even on v10 a conditional write can report
  success without sticking. Every fan write is re-read after writing and retried.
- **Fan records are sharded across 12 documents** so a burst of voters does not contend
  on one key. Load-tested at 80 simultaneous voters, zero loss.

## What this makes harder

Every feature that wants to enumerate something has to bring its own index, and each
index is a thing that can be wrong. The history index alone has been the source of
several bugs: a cap of 100 that stranded row 101, a row built from the wrong snapshot,
and two writes that both ended in an empty catch. It now heals itself from every id it
can name.

The Google Sheet export is the proof the rule is liveable: two registries name every
artist and venue, and each artist's own history index names every show, so the entire
store is walkable without the call.

## What would reverse it

Netlify publishing a strongly-consistent list. Nothing else.

## How it was verified

`test/cost.mjs` counts blob reads per endpoint and fails the build above the ceiling —
15 on the audience poll. The read-back-after-write path is regression-tested by firing
N simultaneous votes from N distinct fans and asserting the tally equals N exactly.
