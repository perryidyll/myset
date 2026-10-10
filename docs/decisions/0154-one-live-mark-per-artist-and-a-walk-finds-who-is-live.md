---
id: 0154
title: One live mark per artist — no start or end writes a shared document; a walk from the registry finds who is live
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: scale
reverses:
superseded_by:
invariants: [0ij, 0gi, 1]
commits: [3111e4c]
tests: [test/livewalk.mjs, test/autoshow.mjs, test/everyshow.mjs]
files: [netlify/functions/_lifecycle.mjs, netlify/functions/registercron.mjs, netlify/functions/_register.mjs, test/livewalk.mjs, test/autoshow.mjs, test/everyshow.mjs]
---

## The question

Every Start and every End wrote `gigsched`, the one document the scheduler also uses for its lock, its sweep and its daily pass: `markLive` put the artist on the idle sweep's `live` list and left the register's `regdirty` mark (decision 0095), and `unmarkLive` took it off. Both were `casDoc(...).catch(() => {})`.

The scale audit of 2 October 2026: about a thousand starts around the top of the hour all write that one document, beside the bell's own writes. A CAS that runs out of its forty tries throws, and the throw was swallowed:

- a lost `live` mark is a show the idle sweep never finds, so a show left running by hand is never ended for inactivity;
- a lost `regdirty` mark delays the register by up to its six-hour full walk;
- each start and end spent up to forty tries — seconds — on a write nobody waited for, and each of those writes competed with the bell taking its own lock on the same document.

**Who reads it.** `live` is read by `_auto.mjs` `sweepIdle` and nothing else. `regdirty` is read by `_register.mjs` (`readDirty`, `clearDirty`) and `registercron.mjs`. `notes` (the first-night letter, once per account) by `sweepNotes`; `lastRunAt` by `_watch.mjs`. The front door's "Tonight", `events.mjs` and `venue.mjs` decide "on now" from the calendar's time windows; `profile`, `community` and `diary` from the show record. None of those reads `gigsched`.

**0140's `on` mark** is not a live mark: it sits on the calendar index entry (`byArtist[aid].on`), says tonight's *start* is settled, stays after the artist ends the show, and a show started by hand with no gig has no entry to carry it. It was not reused, and no second copy of it was made.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The live mark is the artist's own show record (`status`, `startedAt`, `endedAt`, written in the same CAS as the flip). No start or end writes a shared document. A walk at the top of the register's bell reads the registry and one show record per artist from a cursor and folds what it saw into `live` and `regdirty` in one write | One show-record read per artist a ring, up to `LIVE_WALK`; one write when something changed | `walkLive`, `LIVE_WALK`, `LIVE_WALK_MS`, `liveSeen`, `liveCursor` | The list and the marks are up to one lap late |
| B | Shard the index: a start writes `liveidx_<hash % 32>` | 1/32 of the contention | 32 new keys; every reader reads 32 | Still a shared write on every start; `sweepIdle` (not this branch's to change tonight) reads `gigsched.live` |
| C | Keep the write; retry it, or flag a failure on the show | Small | A retry path | The same contention with the bell's lock; a flag still needs a walk to be found |
| D | A small per-artist document `live_<aid>` plus a walk | A second write on every start and end | A key family | Two records of one fact; the show record already is it |
| E — do nothing | | | | Shows the idle sweep never finds; the bell competing with a thousand writes for its own lock |

## What was chosen, and why

A.

- **The show record is the mark.** It is written in the flip's own CAS, so the mark cannot be lost apart from the start or the end. `startShow` and `endShow` no longer touch `gigsched` (`markLive` and `unmarkLive` are deleted). The first-night note still lands there: once per account, ever, not once per start.
- **The walk (`walkLive`, `_lifecycle.mjs`).** Reads the artist registry and `gigsched`, then up to `LIVE_WALK` (300) show records, eight at a time, round the registry from `liveCursor`, stopping at `deadline` (`LIVE_WALK_MS`, 2 s) but never before one. For each artist seen: a live show goes on `live` with its last sign of life (the later of its start and its last write) and is only ever moved forward — the idle sweep's own rule; a show seen not live comes off. When the night's status, start or end differ from what the walk last saw (`liveSeen`), it sets `regdirty`. A record it cannot read is left exactly as it was. Artists who have left are forgotten from `liveSeen` once a lap. One write, only when something changed; when nothing did, no write and no second read.
- **Where it runs.** At the top of `registercron.mjs`, every ten minutes, before the ring decides whether to fold — so the fold in that same ring files the nights the walk marked. A walk that fails is logged and the ring goes on. The register's freshness is unchanged up to 300 artists; beyond, a lap takes `artists ÷ 300` rings.
- **The idle sweep is unchanged** (`_auto.mjs` is week one's tonight): it reads the same `live` list. A show started by hand reaches it within one lap, stamped with its own last write, so it is still ended three hours after its last sign of life.

**The hook the scheduler can take later** (not built: `_auto.mjs` and `autocron.mjs` are not this branch's tonight). In `autocron.mjs` `ring()`, after the idle sweep:

```js
const walked = await step('live walk', async () => (await import('./_lifecycle.mjs')).walkLive({ now, deadline }));
```

That cuts a lap from ten minutes to two. Nothing else is needed: the walk is idempotent and keeps its own cursor. `sweepIdle`'s comment ("`live[aid]` is the last time this show was KNOWN to be active — the start, until a ring looks") should then say "the live walk's sighting"; it is true in effect today.

## What this makes harder

- The idle list and the register's marks are up to one lap late (ten minutes today). A show that starts and ends inside a lap still gets its mark: the walk compares start and end, not only live and not live.
- The first lap after this ships marks every artist who has a night; the register folds them over its next rings, time-boxed, as a full walk would.
- `gigsched` carries one short string per artist (`liveSeen`) and a cursor.
- A walk reads one show record per artist per lap, artist or not on stage. At 300 artists that is 300 reads every ten minutes; the record says where it stops being cheap (below).

## What would reverse it

- The open line (Durable Objects, P3-002) holding live rooms, which would know who is live without a walk.
- Thousands of artists: a lap longer than the three-hour idle threshold. Then the walk moves into the scheduler's ring (the hook above) and, past that, a sharded index of live artists written only by the walk.

## How it was verified

- `node --import ./test/register.mjs test/livewalk.mjs`: 42 ✓, 0 ✗. With every write to `gigsched` failing, a Start through `admin.mjs` goes through and writes no shared document; the walk then finds the show from its record, puts it on the list with its last write and marks the register; a walk with nothing new writes nothing and reads the index once. The idle sweep (unchanged) ends it three hours later; the next walk sees the end and marks the register again without putting it back. An End comes off the list at the next walk and moves the mark. Two at a time, the registry is covered in `ceil(n ÷ 2)` walks; out of time, a walk still reads one and moves the cursor past it; a departed artist is forgotten after a lap. A record that cannot be read is not taken off on a guess. A ring of the register's bell with no full walk due folds because of the walk's mark, and the night is in the register with its mark cleared. 290 starts at once: no write to any shared document, and one walk puts all 290 on the list and marks them.
- Five knock-outs, each red, each restored: a start writing `gigsched` again (2 fail); the bell not walking (2); the walk never taking an ended show off (3); the walk leaving no mark (6); an unreadable record counted as not live (1).
- Existing tests that read the old write changed, each saying why: `test/autoshow.mjs` (two idle cases walk before the sweep) and `test/everyshow.mjs` ("starting wrote no mark itself", then the walk's mark; the idle bell's read count is the walk's plus two, and it writes nothing).
- No new key family: `liveSeen` and `liveCursor` are fields on `gigsched`, already mirrored. No `_mirror.mjs` FAMILIES line is needed.
- **Not checked:** a walk over hundreds of real show records on production (its read time per record is the fake's); the bell's total time with a walk, a fold and the morning-after asks in one ring.
