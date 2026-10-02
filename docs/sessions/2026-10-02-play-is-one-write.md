# 2026-10-02 — Scale audit, phase two: Play is one write

The third item of phase two (the first two are in `2026-10-02-scale-audit-phase-two.md`, on their own branch). Built in worktree `scale-p2-play`, branch `fix/play-is-one-write`, off origin/main `d8a3e56`. Nothing committed or pushed.

## What was wrong

A cast reads the show once and then retries its write. In a rush, a vote that set off before Play could land after Play's sweep had passed its fan file. It stayed on the song that had just started, and later counted as a request to hear it again at the ordinary price. The audit simulated 1 to 13 per Play at 5,000 phones. A sweep that ran out of tries was swallowed, with the same effect for a twelfth of the room.

## What changed (decision 0147, INVARIANT 0hu, ledger P3-017)

- `_lib.mjs`: `show.plays` and `show.col` in `normShow`; `chargeVotes` writes a fourth field on each vote row, the `plays` its cast read; `liveFan` / `liveFans` leave out rows stamped lower than their song's mark, on records already read.
- `admin.mjs`: Play and Play Top mark the song inside the show write; Play Top ranks the filtered tally. The show read it needs is the one it already made.
- `_board.mjs` (`buildBoard`, `buildMe`) and `stage.mjs`: filtered.
- `_lifecycle.mjs`: a new night clears the marks.
- `test/blobs-fake.mjs`: `__slowReads(ms, re)` can hold one caller on matching keys.
- `test/playonewrite.mjs`, in `test/run.sh`.

Nothing in `public/` changed. Votes bought for a song at checkout are untouched by the rule.

## What was verified

| Check | Result |
| --- | --- |
| `test/playonewrite.mjs` | 29 ✓ / 0 ✗ |
| Seven knock-outs | all red |
| `sh test/run.sh` | exit 0 |
| The audit's simulator against this tree, 5,000 phones, Play mid-rush, three runs | landed after the sweep: 4, 7, 4; on the board: 0, 0, 0 |

## What was not checked

- A real room.
- A page left open across the deploy.

## Choices made where the founder did not say

- A vote collected this way is not refunded: the fan voted for the song and it is playing.
- The sweep was kept (it files the votes with the play). The audit's line said "no sweep needed"; dropping it would move every vote's filing to the end of the night, which changes the event log (decision 0066).
- Paid song votes from checkout are never collected by the mark.

## Next

- Rebase on week one's `_lib.mjs` change before shipping.
- Done 2026-10-03: this branch is stacked on 0145's, `test/contention.mjs` asserts zero stranded votes and `tools/roomsim.mjs` counts the board's view (23 ✓). Merge 0145/0146 first.
