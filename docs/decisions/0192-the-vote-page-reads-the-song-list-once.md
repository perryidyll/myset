---
id: 0192
title: The vote page reads the song list once and polls only the tallies, and falls back to today's board whenever the two do not agree
date: 2026-10-03
status: decided
decided_by: claude
area: scale
reverses:
superseded_by:
invariants: [0ig]
commits: [8f3298a]
tests: [test/split.mjs]
files: [public/vote.html, test/split.mjs]
---

## The question

The scale audit of 2 October 2026 found that past about 3,000 phones the board is cut to the top fifteen songs, and the vote page could list and search only what the board carried. A song nobody had voted for yet could not be found, so it could not get its first vote. Decision 0150 is the **server half**: the song list is its own reply (`what=songs`), kept at the edge under a version (`songsV` on every board), and `lean=1` gives the board with only the tallies. This record is the **page half**: how `public/vote.html` uses that, without breaking on today's server and without changing what the room sees.

It sits on decision 0185 (the board paints first, `/api/me` follows and is not on every tick). 0185's order is kept.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The `<head>` still starts today's full board. When a board names `songsV`, the page fetches the list at that version after the first paint, draws from it, and from then on polls `lean=1`. Any doubt (no list, a list of another version, a tally naming a song the list lacks) draws the full board | One full board per page open; one list fetch per artist action | `LIST`, `LIST_MISS`, `fromList`, `listed`, `tallyOf` | A list that is wrong for its version would draw wrong titles; the version check and the unknown-id check send the page to the full board instead |
| B | The 0150 contract to the letter: the `<head>` starts the lean board, the list without `v` and `/api/me` together | Saves one full board per open | The same, plus a `<head>` that must guess whether the server is new | On today's server a list request per open that can only fail; a lean board that cannot be drawn until the list lands; `/api/me` back on the first paint, undoing 0185 |
| C | Keep the full board and only raise the cut | Bytes on every poll | None | Moves the freeze from 15 songs to N |
| D — do nothing | | | | Past 3,000 phones a fan can choose from fifteen songs |

## What was chosen, and why

A.

- **Detection is the board itself.** A board with a string `songsV` comes from a server that answers `what=songs` and `lean=1`. Today's board has no `songsV`, and the page makes exactly the calls it made on #228: no list request, no `lean`. A board that carries a `tally` but no version is never drawn.
- **The first paint is today's board.** The `<head>` starts the full board as it always has (0185), so the first paint never waits for the list. If that board names a version, the list is fetched at that version (the address the edge keeps for a day, rather than the ten-second no-`v` one), and the page is drawn again from it. Then `/api/me`. The order is board, paint, list, paint, personal call, paint.
- **The lean poll only while the list matches.** A poll asks for `lean=1` only when the list held has the version the last board named. When a lean board names a new version (a song started, added, hidden, a setlist, a price, dark or live) the list is fetched once at that version, inside the same load, before the paint.
- **Nothing below `load()` changed.** `fromList` turns a tally plus the list back into a board of today's shape: the tally's to-play rows in order, then the rest of the list at 0 votes in the list's order (by title, which is the board's own order for unvoted songs), `played` from the list with the tally's votes, `tags` from the list, `board` and `tail` empty. `mergeBoard`, `render`, ranking, search, the replay section, the genre chips, prices and the paid paths all read the same shape as before. In a small room that board equals the server's own full board, song for song (tested, and checked in a browser against #226's server).
- **The "showing the top N" line goes when the list is drawn**, because nothing is cut from the page. `/api/me`'s `held` is no longer needed on that path (`mergeBoard` still reads it on the full-board path).
- **Fallback is today's page.** If the list fetch fails or times out (5 s), or the list it brings is not the board's version, or the tally names a song the list does not have, the page fetches the full board in the same load and draws it as it came. The list is let go when it disagrees with its own tally. A failed version is not asked for again for a minute (`LIST_MISS`), and a new version is tried at once. A list newer than the board (the edge's board is one poll old) is kept but not drawn under the older board; the next board names it and is drawn from it with no fetch. If the fallback board does not arrive either, the load is a load without a board (0143): the kept board stays and nothing else is asked.

## What this makes harder

- Two shapes now reach `load()`. Anything that adds a field to the board's songs must reach the list too (0150's `SONGLIST_FORM`), or the page will draw songs without it on the lean path.
- The page still downloads one full board per open, which at scale is the cut board (small). The 0150 contract's "fetch the lean board on open" saves that, at the cost of a `<head>` that must know the server.
- When the list cannot be had, the room is back to today's short board until it can. That is the intended floor, not a new failure.

## What would reverse it

- A pushed board (P3-002): the list is sent once on connect and tallies as they change, and this polling logic goes.
- Once every server names `songsV`, the `<head>` could start the lean board and the list together (option B) with the same fallback.

## How it was verified

- `test/split.mjs` "THE PAGE READS THE SONG LIST ONCE AND POLLS ONLY THE TALLIES" lifts `load()` with the list code and runs it against stubs of both servers: today's server makes #228's calls exactly; the first load is board, paint, list at the board's version, paint, personal call; forty songs are drawn instead of fifteen, in tally order then by title; every later poll is `lean` alone; a new `songsV` refetches the list once and moves the played song to `played` at the replay price; a list that fails falls back to the full board in the same load, is not retried for a minute, then is; a tally naming an unknown song falls back and lets the list go; a list newer than the board is kept and used by the next board without a fetch; a lean board with no list and no full board keeps the old board. Search: the merged board carries all forty and the page's own `match` finds an unvoted song far below the old cut. One definition: `fromList` on the real small-room board (tally plus a list built from it) equals the server's board. Knock-outs: an unknown id skipped instead of refused (5 ✗); a failed version retried at once (6 ✗); never lean, and never detecting `songsV` (the file stops).
- In the app's browser pane at 375 × 812 against #226's server (`tools/localhost.mjs` in a scratch worktree, this `vote.html` and #228's `fan.js` copied over, 36 songs, live): the first load called the board at 6 ms, the list at the board's version at 65 ms, and `/api/me` at 193 ms; 36 songs drawn; later polls were `lean=1` only. Searching "use some" kept focus and found Use Somebody; a vote on it went through (`/api/vote`, then a lean board, then `/api/me`), the pill went 3 → 2 and the song led Up next. The artist played it, then another song: each time one list fetch at the new version, then lean polls; Use Somebody showed under played at $5. With the list fetch blocked, a new version fell back to the full board in the same load and stayed on full boards. The merged lean-plus-list board equalled the merged full board in every field but the clock. No console errors; no horizontal scroll.
- The same page against this branch's own localhost (today's server, 16 songs): calls were the board and `/api/me`, then boards only; no list, no `lean`; the drawn songs equal the merged full board; no console errors; no horizontal scroll.
- `sh test/run.sh` exits 0.

**Not checked:** a real cut board in a browser (it needs 3,000+ phones in the room; the cut path is covered only by the stub test); the edge itself keeping the versioned list for a day; a real phone; dark mode.
