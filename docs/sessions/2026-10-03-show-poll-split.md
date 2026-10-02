# 2026-10-03 — Scale audit, phase two: one tap one song, the song list, the show's bytes

An overnight batch for the session "MySet Audit Solutions 2", while the founder slept. Built in worktree `scale-p2-show`, branch `fix/show-poll-split`, stacked on `fix/play-is-one-write` (PR #219). Committed on the branch; nothing pushed, no pull request, nothing deployed.

## What was asked

Three rows of the 2 October scale audit, in this order, one commit each, stopping after any of them if the next was unsafe:

1. *A slow Play, then a second tap, burns the next song* — decision 0151, INVARIANT 0hy, ledger SCL-004.
2. *Past 3,000 phones only the top 15 songs can be voted for* — the server half only — decision 0150, INVARIANT 0hx, ledger SCL-003.
3. *The whole song library rides on every phone's poll* — decision 0152, INVARIANT 0hz, ledger SCL-005.

## What was built

### 1. One tap, one song (0151)

- `admin.mjs`: Play and Play Top take an optional `tap` id. The check runs first inside the `mutateShow` callback; an id the show already holds is answered `{ ok: true, stage, repeat: true }` with no sweep, event-log entry or push. A tap that starts a song is written into `show.taps` in the same write, with a per-request `rq` so a loop that meets its own landed write carries on.
- `_lib.mjs`: `TAPS_KEPT`; `normShow` keeps `show.taps` to the last few.
- `stage.mjs`: the stage lists the tap ids (`show.taps`).
- `public/studio.js`: `playAct`, called from `startSong` (both Play call sites): one id per tap, the same id on its retry, the stage read again (under the write lock) when a tap got no answer. `public/studio.html` restamped.
- `test/onetap.mjs`, in `test/run.sh`.

## What was verified

| Check | Result |
| --- | --- |
| `test/onetap.mjs` | 40 ✓ / 0 ✗ |
| Knock-outs for 0151 (six) | all red |
| `sh test/run.sh` after 0151 | exit 0 |

## What was not checked

- A real Studio on a slow network; the Studio in a browser (nothing it draws changed).

## Choices made where the founder did not say

- Only Play and Play Top carry a tap id. End song, the voting window, Last call, Unplay and Decline were read for the same hazard and do not start the next thing on a retry.
- A repeat answers with the stage and no message: the artist sees the song that tap started.
- The Studio forgets a tap's id after a couple of minutes; the server keeps the last `TAPS_KEPT` and never clears them at a new night (they are bounded, and an id is never reused).
