---
id: 0187
title: The error log is spread over four documents an hour, and every error is counted past the cap
date: 2026-10-03
status: decided
decided_by: claude
area: ops
reverses:
superseded_by:
invariants: [0fb]
commits: []
tests: [test/errlog.mjs, test/watch.mjs]
files: [netlify/functions/_errlog.mjs, netlify/functions/_watch.mjs]
---

## The question

`logErr` wrote every server error into ONE document an hour (`err_<hour>`), with three
CAS tries on it and a cap of 100 rows (decision 0029). The 2026-10-02 scale audit
(OPS-7) pointed out when that breaks: during an incident. Every failing request writes
to the same document at the same moment, most lose the race three times and their rows
are dropped; and once 100 rows are in, the hour is full, so the error count the watch
reads (decision 0157) stops at whatever survived. The error log failed exactly when it
was the thing to read.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Four shards an hour, picked at random, each counting** | A row goes to one of `err_<hour>`, `…_1`, `…_2`, `…_3`; a lost race moves to the next shard; each shard keeps `n`, every row it was handed | A bug report reads 12 documents instead of 3; the watch reads 8 instead of 2 | `ERR_SHARDS`, `shardKeys`, `readErrs`, the `n` field | Four times the rows kept per hour (400), still small documents |
| B — one document per error | No contention at all | Reading an hour needs `list()` — forbidden for live data (INVARIANT 1) | A key per row | Breaks INVARIANT 1 |
| C — a separate per-hour counter document | An exact count | The counter is one hot document again — the same race, moved | A counter key | The count fails during the incident, as before |
| D — more tries on the one document | Fewer dropped rows | Slows exactly the request that already failed (0029's rule) | None | Failing requests wait on the log |

## What was chosen, and why

A. Contention falls by the number of shards, every key stays computable, and the count
lives in the shards themselves, so it has no hot document of its own.

- **Shard 0 is the old key**, so an hour written before this deploy is still read, and
  nothing that reads `err_<hour>` by name breaks.
- **Three tries, each on a different shard**, starting at random. A lost race means
  somebody else is writing that shard; the next one is the better bet. Each try is a
  single CAS attempt (`casDoc(…, null, 1)`), so the worst case costs about what the old
  three tries did.
- **`n` counts every row a shard was handed this hour, past its cap.** `readErrs`
  returns the rows and, per hour, `n` and how many rows are still kept. An hour from
  before this change has no `n`; its row count stands in for it.
- **The watch** (`look()`) counts the kept rows in the last sixty minutes plus the
  current clock hour's overflow (`n − kept`) — every row of the current clock hour is
  inside the last sixty minutes. The previous hour's overflow is not added: its rows
  cannot be placed in time, so the number can only be low by that much, never high.
- **Store errors are still not logged** (decision 0142): a write to a store that is not
  answering would wait on the same failure.
- The mirror (`_mirror.mjs`) does not copy `err_` keys, and the cost test's global-
  document list does not name them; neither needed a change.

## What this makes harder

- A bug report reads twelve documents of error log, not three. Reports are already
  capped per device and per network (decisions 0030, 0111).
- Rows from one hour are spread over four documents; anything that reads a single
  `err_<hour>` key by hand sees about a quarter of them. Read through `readErrs` /
  `recentErrs`.

## What would reverse it

An error store outside the blob store (decision 0013's question), or a store with an
append operation, either of which makes the sharding unnecessary.

## How it was verified

`node --import ./test/register.mjs test/errlog.mjs` — 60 passed, 0 failed, including:

- `shardKeys` gives the four keys, the first the old one;
- 410 rows in one hour: at most 400 kept, spread over all four shards, the newest kept,
  and `n` summed to exactly 411 (with the one logged before);
- with every write to the hour's first key failing (`__failWrites`), all 20 rows still
  land in the other shards — the old code dropped all of them.

`node --import ./test/register.mjs test/watch.mjs` — 31 passed, 0 failed: a shard
holding one kept row and `n = 400` makes the watch report 400 errors in the last hour;
the existing burst and recovery checks clear all four shards.

**Not checked:** a real incident on production, or contention under the real store's
latency (the fake store answers reads and writes in turn, so it does not reproduce a
race between many writers on its own).
