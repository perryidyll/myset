---
id: 0148
title: A cast receipt is short and short-lived; the room stays on twelve fan files until a split can be proved safe
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: scale
reverses:
superseded_by:
invariants: [0hv]
commits: [b4ac330]
tests: [test/receipts.mjs, test/contention.mjs, test/finality.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/vote.mjs, tools/roomsim.mjs, tools/loadsim.py, tools/overview.mjs, test/receipts.mjs, test/contention.mjs, test/finality.mjs, test/run.sh]
---

## The question

The scale audit of 2 October 2026 found a write ceiling on the live room. Every vote rewrites one of twelve shared fan files, each holding a twelfth of the room; one writer per file wins at a time and the rest retry. Its simulator: 5,000 phones are fine to about 75 votes a second and strained at 125; 10,000 phones at 150 a second see about 3% refused and the slowest 1% wait 14 seconds. Its fix, in two parts: *now*, trim the receipts kept on each fan (they triple the file) and use more files for bigger rooms; *later*, one small file per fan, or a Durable Object.

What a voter's record held, measured on the real write path (`vote.mjs` against the test store, one vote a cast, the free votes raised so eight casts fit):

| Casts | Record before | Receipts before | Record after | Receipts after |
|---|---|---|---|---|
| none (present only) | 103 bytes | — | 103 bytes | — |
| 1 | 390 | 126 | 312 | 48 |
| 3 | 794 | 358 | 565 | 124 |
| 8 (six songs) | 1,712 | 938 | 1,088 | 314 |

The receipts are `casts`: the outcome of every cast, kept so a retry with the same cast id is answered from memory instead of casting twice (INVARIANT 15h). Each was `{id, at, out: {voted, votes, cost, remaining}}` — the whole 32-character id and the outcome as an object, about 118 bytes — and twenty were kept for the whole night. Nothing else on the record is close: the vote rows `va` are money (and `liveFans`, decision 0147, reads their fourth field), the ledger fields are a few bytes each, and the grant proofs `gr` sit only on fans who paid.

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen** | Receipts become `[key, at, votes, cost, remaining]` (the key is twelve hex characters of the id's hash) and live `RECEIPT_MS`; every write to a fan file shortens or drops the receipts of every record in it; the long kind is still read until then | A loop over the file's records inside a write that is happening anyway; one hash per cast | A retry that arrives after the window is cast again. The page retries a moment after its first try fails and keeps no cast id past the tap |
| B | Grow the number of fan files for an artist (12 → 48) at a quiet moment, moving each record to its new home | Four times the files for every board render and Studio poll (each a quarter the size) | A record found in two places, or none, while it moves: a fan's credits or paid votes lost or doubled. See "The next step" below |
| C | One small file per fan | The board must still count the room, so it needs a tally kept elsewhere (per-song counters, or a log) | The largest change of the four; every reader of the fan files changes |
| D | The live room in a Cloudflare Durable Object | A second platform for the most important path | Decision 0035 probed it; not a night's work |
| E — do nothing | | | The ceiling stays where the audit found it, with the heaviest records it could have |

## What was chosen, and why

A, and B written up rather than built.

- **The receipt keeps what a retry needs and nothing else.** A replay answers with `{voted: true, votes, cost, remaining, replay: true}` — the same answer as before. The page reads `remaining` from it (`applyCast` in `vote.html`); nothing reads the id back out of the record, so the record keeps a hash of it. Twelve hex characters among one device's last twenty casts: a false match is about one in 10^13.
- **A window, not the whole night.** `test/finality.mjs` used to say a cast id was good "however long ago it was". A retry is the same tap asking again: `vote()` in `vote.html` posts, and on a failure waits under a second and posts once more with the same body. The page keeps no cast id after that. A first try fails at the latest when the phone's network gives up on a dead connection — minutes. The window in §2.1 is far past that.
- **The count stays at twenty.** It bounds a script; age is what keeps a real record small. Fewer would have saved little: a fan's receipts for the last half hour are a handful.
- **Every write tidies the whole file.** Without it, a fan who voted at nine and never again carried their receipts all night, in a file every later voter rewrites. The tidy runs inside `mutateFan`, after the caller's change and only when something is being written, so it costs no read and no write. It touches `casts` and nothing else on any record (`test/receipts.mjs` checks a neighbour's record is otherwise byte-identical).
- **Old records read correctly.** `findReceipt` matches the long kind by its id until a write shortens it, so a retry of a cast made the moment before this deploys is still answered from memory.
- **Not the grant proofs.** `gr` (the Stripe sessions already granted to a fan) is money and is another session's tonight. Measured: one Stripe session id is about 66 characters, about 70 bytes a purchase, only on fans who bought. Trimming it would take the same shape — a hash, a window — and the founder's word, because a lost proof is a pack granted twice.

## What it bought, measured

`tools/roomsim.mjs` on this tree and on the tree before it, the same simulator in both (it seeds a voter's receipts in the shape the code writes). The simulator's default byte cost (20 ms a megabyte read, 40 written) and the audit's own model (100 and 200) are both shown, because the size of a file only matters as much as a megabyte costs, and nobody has measured that (P3-005).

| Room | Byte cost | KB a file | Refused | Half answered in | 99 in 100 in | Slowest | Over 10 s | MB read |
|---|---|---|---|---|---|---|---|---|
| 5,000 phones, 1,500 votes in 20 s | default | 187 → **139** | 0 → 0 | 463 → 451 ms | 2.56 → 2.32 s | 5.2 → 3.8 s | 0 → 0 | 1,085 → 782 |
| | audit's | 187 → **139** | 0 → 0 | 819 → 594 ms | 5.42 → 4.38 s | 8.3 → 7.9 s | 0 → 0 | 1,596 → 1,050 |
| 10,000 phones, 3,000 votes in 20 s | default | 374 → **279** | 69 → 62 | 2.15 → 1.83 s | 13.9 → 13.7 s | 14.5 → 14.1 s | 212 → 157 | 16,280 → 11,212 |
| | audit's | 374 → **279** | 597 → 429 | 7.95 → 5.81 s | 18.5 → 17.2 s | 18.7 → 17.5 s | 1,313 → 1,045 | 27,589 → 18,760 |

A quarter off every file, and a quarter to a third less read and written. Where a megabyte is dear it matters most: on the audit's byte cost the 10,000-phone room refuses 429 votes instead of 597. The READ wall moves too: `tools/loadsim.py --ceiling` at the measured weight of a fan who cast eight times (now 1,127 bytes in its fit, was 2,021) first crosses the 50 MB/s the store is known to serve at 5,000 phones instead of 3,000. It does not move the write wall: 10,000 phones at 150 votes a second are still past what twelve files can take. That needs more files. (Two runs of the same tree can differ by a few votes: the clock a run starts on changes how many bytes a timestamp takes.)

## The next step: more files, safely (B), not built tonight

Why not tonight: fan records outlive a show (paid credits carry to the next night), payments land at any time through `_pay.mjs` and the webhook (another session's files tonight), and `carryFans` is being changed by that session too. A split that loses or doubles one fan's paid votes is worse than the ceiling. This is the design to build and prove next.

- **A per-artist count that only grows by four.** `show.fanFiles`: absent means 12; the only step is to 48. A fan's home is its hash mod the count, so its home under 48 is always one of four "children" of its home under 12 (file k splits into k, k+12, k+24, k+36). Splitting one file touches only its own children. The count stays computable from the show record (INVARIANT 1).
- **A record moves by forwarding, never by copy-then-delete.** In the old file, under compare-and-swap, the record is replaced by a forwarding entry that carries it frozen: `{to: 48, rec}`. Nothing ever changes a frozen record. Then, in the new file, the record is inserted only if that file holds none for the fan. Then the forwarding entry is removed. Any reader or writer that meets a forwarding entry and finds nothing at the new home does the insert itself, so a mover killed half way loses nothing and a mover run twice inserts the same frozen record once.
- **One rule for every reader.** A record counts only from its home under the current count; a forwarding entry counts only when the home holds nothing. A board render that reads the 48 files at slightly different moments then sees each fan once — from the new home if the copy had landed when it read it, from the frozen entry if not — never twice, never not at all.
- **Writers follow the forwarding.** `mutateFan` tries the old home while a split is under way; meeting a forwarding entry it completes the move and writes at the new home. The mover's freeze and a writer's change are compare-and-swaps on the same file, so one of them retries.
- **Sweeps complete moves before they touch a file** (`dropSongVotes`, `wipeBoard`, `refundSongVotes`, `carryFans`, `wipeFans`), so a vote cannot sit in a frozen record while its song is collected.
- **When.** At `startShow` for a new night, after `carryFans`, when the room is the smallest it will be, for an artist whose plan or last night's head count says the room may pass a threshold. Never back down.
- **Everything that lists the files lists the count:** `readFans`, `me.mjs`, the sweeps, `keysFor` (deletion and export), `tools/roomsim.mjs`, `tools/loadsim.py`, the overview.
- **To prove before it ships:** the fake store's `__failWrites` on each step of a move in turn, with votes, grants and Play running against it under `__latency`; after each, every fan's `extra`, `used`, `freeUsed`, `va` and `gr` exactly as before the split, the board's tallies identical, and the end of the night filing every vote once (INVARIANT 0fq). Then the simulator at 10,000 phones on 48 files.

## What this makes harder

- A retry that arrives after the receipt window is cast again. Nothing in the page can send one; a page that one day keeps cast ids across a reload (an offline queue) must keep its own window shorter than this one.
- Every write to a fan file now walks every record in it. Measured cost is small beside the parse and the serialise of the file, which already walk it; it is the same order of work.
- The id is no longer readable in the record, so a support question ("did cast X land?") is answered by hashing X first.

## What would reverse it

- B or C landing: the receipts can stay as they are, but the ceiling moves for a different reason.
- A page that needs receipts for longer than the window (an offline outbox).

## How it was verified

- `node --import ./test/register.mjs test/receipts.mjs`: 28 ✓, 0 ✗ — the short shape; a retry answered with the first answer and nothing cast twice; an unlimited phone's replay; a long receipt written straight into a file honoured, then shortened by a neighbour's write, with the stale one dropped and nothing else on that record moved; the twenty-kept limit; a record with no live receipts carrying no list; a three-cast record at most 600 bytes with receipts at most 130.
- `test/contention.mjs` gains a room: 5,000 phones seeded with long receipts, 1,500 votes in 20 seconds, then two hundred retries with the same cast ids. Every vote on the board, no long receipt left in any file, no record over twenty, all two hundred retries answered from memory, none cast twice.
- Knock-outs, each red then restored: the write no longer tidies the file (`test/receipts.mjs` 5 ✗; the deploy room leaves 7,440 long receipts); the long kind no longer read (5 ✗, a retry of a cast from before the change cast again); a window of zero (the test stops at its first check; the deploy room's 200 retries all cast twice); `vote.mjs` writing the long kind (stops at its first shape check).
- `sh test/run.sh` exited 0: 5,265 ✓, 0 ✗, in 3 min 42 s. The new room: 8,940 short receipts in the files, half the votes answered in 454 ms, 99 in 100 in 1.98 s.
- **Not checked:** a real room; the store's real per-megabyte cost (P3-005), which decides how much a smaller file is worth; a page open across the deploy beyond the shape test (its retry carries a cast id this code reads in either shape).
