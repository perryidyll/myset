# 2026-10-03 — Short cast receipts, and a network brings a bar's worth of phones (decisions 0148, 0149)

An overnight builder for the scale audit's phase two ("MySet Audit Solutions 2"), in worktree `scale-p2-fans` on branch `perf/fan-files`, stacked on `fix/play-is-one-write` (PR #219, itself on #218). Committed on the branch; not pushed, no pull request — the coordinating session reviews and opens it. The founder was asleep and had not seen either decision; both are `proposed`, `agent-recommended`.

## What was asked

Two audit rows each, from the coordinator:

1. **The vote write ceiling** (decision 0148, INVARIANT 0hv, ledger SCL-017). Every vote rewrites one of twelve fan files holding a twelfth of the room. Trim the receipts kept on each fan, and use more files for bigger rooms if a shape can be proved safe tonight; otherwise ship the trim and write the file design up. Measure 5,000 and 10,000 phones before and after.
2. **Fake devices** (decision 0149, INVARIANT 0hw, ledger SCL-018). Every fresh device id got free votes and nothing counted by network; fake "I'm here" pings stayed all night and slowed the room. Cap new devices per network per show — one constant, 200, its own commit — and count only recent presence for the polling rung and the board's length. Never show the room a free vote the server would refuse; do not edit `public/vote.html`.

## What was built

Two commits, in order: `6e85572` (0148, the receipts) and the commit that carries this note (0149, the network cap and the head count) — kept apart so the cap can be changed or dropped on its own.

**0148.** A cast receipt is `[key, at, votes, cost, remaining]` (the key a twelve-character hash of the cast id), at most `RECEIPTS_KEPT`, none older than `RECEIPT_MS`. `mutateFan` tidies every record's receipts in the file it is writing anyway (`pruneReceipts`); the old long receipts are read until then (`findReceipt`). `vote.mjs` uses the three helpers. `tools/roomsim.mjs` seeds receipts in the shape the code writes and gains `rMB`/`wMB` (the cost of a megabyte), `oldReceipts` and `replays`. More files for bigger rooms (12 → 48, forwarding records) is designed in 0148's "next step" and not built: fan records outlive a show, payments land at any time through files another session owns tonight, and `carryFans` is being changed by that session too.

**0149.** A phone's first stamp of the night — `markPresence`, or `settleFree` inside a first vote — counts the phones from its network already let in to its own fan file tonight, and is let in while that is under `NET_QUOTA` (28 a file for the founder's 200, worked out so a network of exactly 200 real phones loses under a tenth of a phone on average; a script on one network gets at most 336). Held out = the free allowance stamped as spent on nothing (`holdOut`), so every credit formula answers correctly without changing. A held-out phone with nothing to keep is never written. `/api/me` and the old `/api/show` show the same verdict (`freeView`). `countInRoom` counts only stamps from the last `PRESENCE_WINDOW_MS`; `/api/me` writes a phone's stamp again once it falls due (`presenceDue`).

## Verified

| Check | Result |
|---|---|
| `test/receipts.mjs` (new) | 28 ✓ / 0 ✗ |
| `test/netcap.mjs` (new) | 39 ✓ / 0 ✗ |
| `test/contention.mjs`, two new rooms | the night 0148 deploys (5,000 phones, long receipts, a rush, 200 retries): all 1,500 votes on the board, no long receipt left, 200 of 200 retries answered from memory, none twice; a one-network flood (5,000 fresh ids in a minute): every page answered, 336 let in, 336 records |
| Knock-outs, 0148 | four, each red: no tidy on write; long receipts not read; a window of zero; `vote.mjs` writing the long kind |
| Knock-outs, 0149 | seven, each red: the count never says out; a held-out phone written anyway; the head count forgets nobody; `/api/me` showing the raw record; the vote not deciding a phone; a stamp never falling due; a phone that moves network written with the new one |
| A voter's record, real write path | 794 → 565 bytes after three casts (receipts 358 → 124); 1,712 → 1,088 after eight |
| `tools/roomsim.mjs`, 5,000 phones, 1,500 votes in 20 s | a fan file 187 → 139 KB (149 with 0149's stamp time); 99 in 100 votes in 2.56 → 2.32 s |
| `tools/roomsim.mjs`, 10,000 phones, 3,000 votes in 20 s | 374 → 279 KB a file; refused 69 → 62 (597 → 429 at the audit's byte cost); the slowest 1% still about 14 s — the wall is the twelve files |
| `tools/loadsim.py --ceiling`, re-fitted to the new weight | the read wall's first size over the line 3,000 → 5,000 |
| `sh test/run.sh` after 0148 | exit 0, 5,265 ✓ / 0 ✗ |
| `sh test/run.sh` after 0149 | exit 0, 5,309 ✓ / 0 ✗ |

## What another session must know

- `mutateFan` now tidies receipts after the caller's change (two lines in its body); its parameters are unchanged, so week one's fifth `tries` argument still fits.
- `markPresence`'s body changed (the due-time refresh, the let-in decision, the first-network rule) and it returns the record it wrote or null. Its retries are untouched, so week one's `PRESENCE_TRIES` slots in where it passes them to `mutateFan`.
- `presenceCurrent(me, show, fanId, now)` replaces the inline `already` tests in `me.mjs` and `show.mjs`.
- No new kind of blob key: nothing new for `FAMILIES`.
- Anything that stamps `seenShow` goes through `settleFree`; anything that counts live heads uses `countInRoom` (recent stamps only).
- Pages unchanged: `/api/me`'s credits now say 0 free for a phone held out, and the page already reads them from there.

## Not checked

- A real room, a real bar's wifi, carrier-grade NAT (many mobile phones on one address).
- The store's real cost per megabyte (P3-005), which decides how much a smaller file is worth.
- The presence refresh's write cost in the simulator: its rooms last minutes and a refresh comes every quarter hour; it is arithmetic in 0149.
- `public/vote.html` in a browser: nothing in `public/` changed.

## Choices made where the founder did not say

- The receipt window is thirty minutes and twenty are still kept (0148). The page retries once, a moment after a failed try; nothing keeps a cast id longer.
- Every write to a fan file tidies every record in it, not only the writer's own (0148).
- The cast id is kept as a twelve-character hash, not as itself (0148).
- More files for bigger rooms written up, not built (0148).
- The network count lives in the fan file the phone lives in, not in a new counter document, so a flood cannot get past it by jamming a counter; the price is that 200 means "a network of 200 real phones fits, a script gets up to 336" (0149).
- Held out is represented as the free allowance already spent, so nothing that reads credits had to change (0149).
- A held-out phone with no pack leaves no record, and is not in the head count (0149).
- The head count's window is thirty minutes, refreshed every ten to twenty per phone (0149).
- Phones stamped tonight before the deploy keep their free votes and count as before.
- A phone keeps the network it was let in on for the night: a refreshed stamp no longer writes a new network (otherwise two addresses are a loop past the cap), which also ends the shard write on every wifi-to-mobile switch the audit flagged (0149).
- `tools/loadsim.py`'s measured record weight was re-fitted to the new bytes, as P3-013's row asked.
- `_requests.mjs` (song requests, shout-outs) does not decide a phone itself; a held-out phone that bought a pack and asks for a song before its next poll can spend free credits on it (0149, "What this makes harder").
