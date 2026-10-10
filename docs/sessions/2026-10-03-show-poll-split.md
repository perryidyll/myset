# 2026-10-03 — Scale audit, phase two: one tap one song, the song list, the show's bytes

An overnight batch for the session "MySet Audit Solutions 2", while the founder slept. Built in worktree `scale-p2-show`, branch `fix/show-poll-split`, stacked on `fix/play-is-one-write` (PR #219). Committed on the branch; nothing pushed, no pull request, nothing deployed.

## What was asked

Three rows of the 2 October scale audit, in this order, one commit each, stopping after any of them if the next was unsafe:

1. *A slow Play, then a second tap, burns the next song* — decision 0151, INVARIANT 0hy, ledger SCL-020.
2. *Past 3,000 phones only the top 15 songs can be voted for* — the server half only — decision 0150, INVARIANT 0hx, ledger SCL-019.
3. *The whole song library rides on every phone's poll* — decision 0152, INVARIANT 0hz, ledger SCL-021.

## What was built

### 1. One tap, one song (0151)

- `admin.mjs`: Play and Play Top take an optional `tap` id. The check runs first inside the `mutateShow` callback; an id the show already holds is answered `{ ok: true, stage, repeat: true }` with no sweep, event-log entry or push. A tap that starts a song is written into `show.taps` in the same write, with a per-request `rq` so a loop that meets its own landed write carries on.
- `_lib.mjs`: `TAPS_KEPT`; `normShow` keeps `show.taps` to the last few.
- `stage.mjs`: the stage lists the tap ids (`show.taps`).
- `public/studio.js`: `playAct`, called from `startSong` (both Play call sites): one id per tap, the same id on its retry, the stage read again (under the write lock) when a tap got no answer. `public/studio.html` restamped.
- `test/onetap.mjs`, in `test/run.sh`.

### 2. Every song the room can vote for — the server half (0150)

- `_board.mjs`: `songList(show)` — every votable song (`songs` still to play, by title; `played`, newest first; `tags`), with `v`, a hash of the list and `SONGLIST_FORM`. Every board carries `songsV`. `leanBoard(board)` drops `songs`, `played`, `tail` and `tags` and adds `tally`. The genre chips moved into `usedTags`, now shared by the board and the list.
- `songs.mjs` (new), behind the fan door as `what=songs`: the current version kept a day, no version ten seconds, any other version not kept.
- `board.mjs`: `lean=1`.
- `test/songlist.mjs`, in `test/run.sh`.
- Nothing in `public/` changed: the page half belongs to week one's session, built to the contract in decision 0150.

### 3. The show's bytes on every personal poll (0152) — the split NOT built

- The audit's fix, a separate 1 KB "hot" show record, was **not built**: two documents written one after the other can disagree in ways a phone sees (an old night, an old free-vote count, votes still shown on a song that has started), and making that safe needs a version counter, an ordered hot write, a repair path, a rule for every writer of the show and a home for the song titles. The design, the hazards and the test plan are in decision 0152.
- Built instead: `getShowKept` in `_lib.mjs`, used by `me.mjs`. A warm instance keeps the show with the store's etag and asks on condition; a 304 carrying the same etag uses the kept copy (frozen), a changed record comes back whole in the same read, anything else reads plainly. No second document, so nothing can disagree with the show; one read per poll, as before.
- `test/blobs-fake.mjs`: a conditional read answers like Netlify's client (`data: null`, no body), noted as `304 <key>`, counted as no bytes under `__latency`.
- `test/showkept.mjs`, in `test/run.sh`. INVARIANT 0fj gained a clause (the poll reads through `getShowKept` now).

## What was verified

| Check | Result |
| --- | --- |
| `test/onetap.mjs` | 40 ✓ / 0 ✗ |
| Knock-outs for 0151 (six) | all red |
| `sh test/run.sh` after 0151 | exit 0 |
| `test/songlist.mjs` | 55 ✓ / 0 ✗ |
| Knock-outs for 0150 (six) | all red |
| `split`, `cost`, `fandoor`, `roomsize` after 0150 | unchanged, green |
| `sh test/run.sh` after 0150 | exit 0 |
| `test/showkept.mjs` | 19 ✓ / 0 ✗ |
| Knock-outs for 0152 (five) | all red |
| Simulator, 1,000 phones in the room and 1,000 opening the page, seeds 1–3, plain read vs `getShowKept` | bytes read 112.9 → 103.1, 117.5 → 105.0, 113.5 → 102.8 MB; p50 215 ms throughout |
| `sh test/run.sh` after 0152 | exit 0 |

## What was not checked

- A real Studio on a slow network; the Studio in a browser (nothing it draws changed).
- The edge keeping the versioned list for a day, and not keeping a stale one, on a real deploy. The vote page does not use the list or the lean board yet.
- That the real store answers a strong conditional read with 304 and the etag. If it does not, the cost is today's (a 200 every time) or one read more (a 304 without the etag), never an old answer.
- Memory and hit rate on real function instances. The simulator is one process, so one warm instance.

## Choices made where the founder did not say

- Only Play and Play Top carry a tap id. End song, the voting window, Last call, Unplay and Decline were read for the same hazard and do not start the next thing on a retry.
- A repeat answers with the stage and no message: the artist sees the song that tap started.
- The Studio forgets a tap's id after a couple of minutes; the server keeps the last `TAPS_KEPT` and never clears them at a new night (they are bounded, and an id is never reused).
- The list is its own reply behind the fan door (`what=songs`), not a field on the board, and the lean board is opt-in (`lean=1`) so the page in production is untouched.
- The version is a content hash, so the versioned address can be kept for a day; a stale version is answered but never kept.
- The list carries `cost` and `tags` per song and the genre chips, so the page needs nothing from the board to draw a song; the lean board leaves out `tags` for the same reason.
- `/api/me`'s `held` stays as it is: the page may stop reading it once it draws from the list.
- For 0152, the conditional read was chosen over the audit's split because it cannot disagree with the show; the split is written up, not built. Only `/api/me` reads through it: `vote.mjs` is the next caller, and another builder's file tonight.
- The kept copy is frozen (a write to it throws) rather than copied per request, so a mistake shows up in the request that made it.
- Up to `SHOW_MEMO_MAX` artists an instance, the one used longest ago let go first.
- The conditional read has no clock of its own on this base, like a plain read today; week one's 0142 adds the clock to `readDoc`, and the conditional read should take the same one when it lands.

## For the sessions that merge this

- `public/studio.html`'s stamp of `studio.js` will conflict with any branch that changed `studio.js` (week one's #205 and #214): rerun `node tools/stamp.mjs`.
- `me.mjs`: the `Promise.all` line's first argument changed (`getShowKept(aid)`); the fans builder changes the presence block and possibly the shard read on the line below.
- `test/blobs-fake.mjs`: the read's `__latency` line counts no bytes for a 304.
- No new kind of document: `show.taps` lives on the show; the song list is computed; the kept show is memory.
