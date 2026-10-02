---
id: 0150
title: Every song the room can vote for is its own reply, fetched once per page open; the board names its version and can carry only the tallies
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: scale
reverses:
superseded_by:
invariants: [0hx]
commits: []
tests: [test/songlist.mjs]
files: [netlify/functions/_board.mjs, netlify/functions/board.mjs, netlify/functions/songs.mjs, netlify/functions/fan.mjs, test/songlist.mjs, test/run.sh]
---

## The question

Past a few hundred phones the board is cut to the top of the chart (`boardLimitFor`; its rungs are in §2.1 of the overview). The cut was made for bytes: the board is read by every phone in the room on every poll, and a 500-song library in every one of those replies is the room's biggest number.

The scale audit of 2 October 2026 found what the cut costs. The vote page lists and searches only what the board carries. Past 3,000 phones a fan can see fifteen songs, and a song nobody has voted for yet is nowhere on the page: it cannot be found, so it cannot get its first vote, and the early leaders freeze in place. The server never limited voting to the board (`vote.mjs` checks `votable`), so this is a page problem with a payload cause.

The audit's line: *Send the song list once per page open, cached. Let the poll carry only the tallies.*

This record is the **server half**. `public/vote.html` belongs to another session tonight; it is built to the contract below, later.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The list of every votable song is its own public reply, the same for every phone, kept at the edge for a day under a version that is a hash of what it says. The board names the version (`songsV`); a page refetches only when it changes. `lean=1` gives the board with tallies instead of song shapes | One more cached address a room; one hash per board render | `songList`, `leanBoard`, `songs.mjs`, a `songs` door | A page that trusted a list of another version would draw the wrong titles; every reply carries its own `v`, and the contract says what to do on a mismatch |
| B | Raise the cut (top 100) | Bytes on every poll, for every phone | None | Moves the freeze from 15 to 100; a 500-song library still has songs nobody can find |
| C | A search endpoint: the page asks the server for matches as the fan types | A function call per keystroke burst, per phone | A new uncached personal-ish read | The opposite of what a packed room needs; and the list view still shows fifteen |
| D | Put the list on the board, without tallies, and cut only the tallies | The whole library on every poll again | None | The bytes the cut exists to save |
| E — do nothing | | | | Past 3,000 phones a fan can choose from fifteen songs |

## What was chosen, and why

A.

- **Votes never change the list.** What the list says (titles, artists, prices, tags, which songs are still to play and which were played) changes when the artist does something, a few times a song at most. The tallies change all the time. Splitting them puts each where it belongs: the tallies on the poll, the list in a reply that can be kept for as long as it is true.
- **Content-addressed.** `v` is the first 16 hex of a SHA-256 of the list itself (plus `SONGLIST_FORM`), so the same list always has the same version, and nothing but that list can ever be stored under it. That is what makes a one-day edge lifetime safe.
- **Three answers by what was asked.** The address is the whole cache key (INVARIANT 9d6), so only the current version is kept long. No version: the current list for ten seconds (the durable cache's floor), for a page that has not seen a board yet. A version that is not the current one: the current list, kept nowhere, so an old address never holds new content.
- **One definition.** The list uses the board's own filters and prices (`playable`, `votable`, `costOf`), and the board's order for songs with no votes (`rankSongs`, by title). Between shows it is the whole setlist at 1 with nothing played, as the dark board is. The song playing is in neither half, as on the board.
- **The old board is untouched.** Without `lean=1` the board is byte-for-byte what it was, plus `songsV`. The page in production keeps working; nothing in `public/` changed.
- **`lean` is a room-wide address.** INVARIANT 0fi says the board's address carries only `?a=`, because a fan id in it would give every phone its own copy (0ep). `lean=1` is one more address for the whole room, not one per phone; it is cached exactly like the board.
- **0hu is kept.** `buildBoard` still calls `liveFans` first, and the lean tally is a projection of the board it builds, so a vote a song has already collected is in neither.

### The contract for the vote page

**1. The list.** `GET /api/fan?what=songs&a=<slug>&v=<songsV>` (the founding page omits `a`, as it does for the board). Also served at `/api/songs?…`, but the page should use the fan door (decision 0049). Response:

```json
{
  "ok": true,
  "src": "<canary mark>",
  "v": "<16 hex>",
  "songs":  [ { "id": "…", "title": "…", "artist": "…", "cost": 1, "tags": ["rock"] } ],
  "played": [ { "id": "…", "title": "…", "artist": "…", "cost": 5, "tags": [] } ],
  "tags":   [ { "id": "rock", "label": "Rock" } ]
}
```

- `songs`: every song still to play tonight that the room can vote for, ordered by title (the board's order for songs with no votes). `played`: songs already played that the room can ask for again, newest first, at the replay price. The song playing now is in neither. `tags`: the genre chips, exactly the board's `tags`.
- Cache: with `v` equal to the current version, kept at the edge for a day; without `v`, ten seconds; with any other `v`, not kept, and the body carries the current `v`. **The body's `v` is the truth about what is in it.** Fetch it without `cache:'no-store'`, as the board is fetched (0fi).

**2. The version on the poll.** Every board carries `songsV` (lean or not). It changes when the list does: a song started, ended into `played`, added, removed, hidden or shown; a setlist chosen; the replay price changed; a genre renamed; the room going dark or live. Votes never change it.

**3. The lean poll.** `GET /api/fan?what=board&a=<slug>&lean=1`. The same board, cached the same way, **without `songs`, `played`, `tail` and `tags`**, and with:

```json
"tally": [ ["<song id>", 12, 1790969118666], ["<song id>", 3, null] ]
```

- One row per song that holds at least one vote: `[id, votes, firstAt]` (`firstAt` is the server time of its first vote, or null). Songs still to play come first, in the board's rank order; then played songs holding requests to hear them again, in `played`'s order. A song in the list with no row holds no votes.
- Everything else on the board (status, nowPlaying, countdownIn, room, nextPollMs, board, totalVotes, numbers, flags, packs, freeCredits, replayCost, asks, paymentsEnabled, updatedAt, at, showId …) is unchanged.

**4. What the page does.**

- On open: fetch the lean board, `what=me`, and the list without `v`, together. If the list's `v` differs from the board's `songsV`, fetch the list again with `v=<songsV>`.
- On every poll: if `songsV` differs from the `v` of the list it holds, fetch `what=songs&v=<songsV>` once.
- Draw the songs to play as the tally's to-play rows in order, then every other song in `list.songs` in list order, with 0 votes. Draw `list.played` in its order with the tally's votes. Titles, artists, prices and tags come from the list; votes and `firstAt` from the tally.
- List and search over `list.songs` and `list.played`: every song the room can vote for.
- **May stop reading:** the board's `songs`, `played`, `tail` and `tags`, and `/api/me`'s `held` (it existed to put a fan's own song back on a cut board; every song is now drawn). `mine`/`mineCount` still come from `/api/me`'s `votes`.
- **If the list cannot be had** (the fetch fails, or the version it brings is not the board's after one refetch, or the tally names a song the list does not have): poll the board without `lean` until it can, which is exactly today's page. The room can still vote either way.
- The "showing the top N" label can go, since nothing is cut from the page; `board` is still on the board if the page wants it.

## What this makes harder

- Anything that changes what a song looks like to the room (a new field on a list entry) must bump `SONGLIST_FORM`, or a phone could be served a day-old copy of the old shape under a version that still matches.
- The board and the list must stay one definition: a filter added to one must go into the other (the test compares them).
- One more hash of the list per board render (once per interval for the room; per phone on the old `/api/show`).

## What would reverse it

- A pushed board (P3-002, the Durable Object line to the room): the list would be sent once on connect and the tallies as they change, and this reply would be the connect payload.
- A decision to drop the cut entirely because the board's bytes stop mattering.

## How it was verified

- `node --import ./test/register.mjs test/songlist.mjs`: 55 ✓, 0 ✗. A room of 3,001 phones: the board is cut to fifteen and a song with no votes is on neither the board nor its tail; the list has all forty, in title order, at the board's prices, with the version the board names; a vote for the quiet song is taken. The lean board has no song shapes, its tally equals the full board's numbers (top, tail and played), in rank order, and the rest of the board is identical. The version holds still through votes and changes for Play, a played song (which moves to `played` at the replay price), a new replay price, a new song, and a hidden song, and comes back when the song is shown again. The three cache answers. The dark list. A collected late vote is not in the lean tally (0hu). One read and no write for the list on the founding page; 404 for a page that does not exist.
- Six knock-outs, each red: the board names no version (8 ✗); the tally without the tail (2 ✗); an old version kept under its address (1 ✗); the playing song left in the list (2 ✗); `buildBoard` without `liveFans` (1 ✗); no `songs` door (the file stops at the first fetch).
- `test/split.mjs`, `test/cost.mjs`, `test/fandoor.mjs`, `test/roomsize.mjs` unchanged and green. `sh test/run.sh` exited 0.
- **Not checked:** the edge itself (that Netlify keeps the `v` address for a day and the stale one not at all) on a deploy; the page, which does not use any of this yet.
