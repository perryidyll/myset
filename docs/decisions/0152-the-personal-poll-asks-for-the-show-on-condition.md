---
id: 0152
title: The personal poll asks for the show on condition, so an unchanged record sends no body; the separate "hot" show record is designed and not built
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: scale
reverses:
superseded_by:
invariants: [0hz]
commits: [821a7bc]
tests: [test/showkept.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/me.mjs, test/blobs-fake.mjs, test/showkept.mjs, test/run.sh]
---

## The question

`/api/me` is the personal half of the vote page's poll: every phone in the room, every interval, never cached. It reads two documents: the phone's twelfth of the fan files, and the whole show record. The show record carries the artist's song library and the night's play log, so the 2 October 2026 audit measured it at about 100 KB for a typical act and up to 540 KB, read 250 times a second at 5,000 phones. Almost every one of those reads finds the record exactly as the last one did: only the artist changes it, a few times a song.

The audit's line: *Split a 1 KB "hot" show record from the library and the play log.*

The brief for tonight said to build the split only if it could be made provably safe, and otherwise to write it up and say so. **The split is not built.** What is built is a smaller change that removes the same bytes from the same poll and cannot disagree with the show, because it adds no second document.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen, built** | A warm function instance keeps the show it last read for each artist, with the store's etag, and asks the store on condition (`getWithMetadata(key, { etag })`). 304: the kept copy is current, and no body crosses. 200: the new record replaces it, in the same read. Only `/api/me` uses it | Memory for up to `SHOW_MEMO_MAX` shows an instance; nothing on the write path | `getShowKept` in `_lib.mjs` | A store that answered 304 wrongly would serve an old record. The code uses the copy only on a 304 that carries the same etag, and the whole app's compare-and-swap already rests on the etag changing with the content |
| B — the audit's split, **not built** | A second document, `showhot_<aid>`, about 1 KB: what `/api/me` needs from the show, written after every show write | One more write per artist action; one more key kind | A second writer in `mutateShow`, a version stamp, a repair path, a FAMILIES line, a deletion line | Two documents that can disagree; see the hazards below |
| C | Keep the show in memory for a few seconds and skip the read | No read at all on a hit | A clock | A phone is told the old free-vote count, the old night, or that it still holds votes on a song that has started, for up to the lifetime. Unsafe |
| D | Move the library and the log out of the show record into their own documents | Every reader and writer of the show changes | A migration of a live record | The largest change of the four, on the record every action writes |
| E — do nothing | | | | 25 to 135 MB a second of show reads at 5,000 phones |

## What was chosen, and why

A, because it is the one that is safe by construction.

- **No second document.** The kept copy is not a copy the store does not know about: the store is asked, on every poll, whether it is still the current record, with the same strong read the poll always made. It can be no older than a plain read.
- **The bytes go, the reads stay.** One read per poll either way. On a warm instance an unchanged record answers 304 and sends nothing, so the library and the log stop crossing on every phone's poll. A changed record comes back whole in that same read, so there is never a second round trip. A cold instance, or one that has just seen the artist act, pays one full read, once.
- **Anything unexpected goes the ordinary way.** A conditional read that throws, a reply without the etag, a record that is not there: `readDoc` reads it plainly and decides what a failure means. A record that is not there is never kept.
- **Frozen.** Many requests share the kept copy. It is frozen all the way down, so code that tried to change it would throw in the request that did it, instead of changing the show for the next phone. The `/api/me` path was read for writes to the show and has none; the test runs every move the Live tab has and compares each answer with a plain read.
- **Bounded.** `SHOW_MEMO_MAX` artists an instance; the one used longest ago is let go first.
- **Only `/api/me`.** The vote path (`vote.mjs`) reads the show on every cast too; it is another builder's file tonight, and it is the obvious next caller. The old `/api/show` needs the artist's name. Nothing that writes reads through it.

### Measured on the simulator

`tools/roomsim.mjs` with 1,000 phones in the room and 1,000 more opening the page over 30 seconds (each one an `/api/me` call), a 100-song library (the free plan's cap; the show record is about 10 KB), three seeds. Bytes read from the store, before and after: 112.9 → 103.1 MB, 117.5 → 105.0 MB, 113.5 → 102.8 MB. The difference is the show record on every personal call. The rest is the fan files, which this does not touch. The simulator is one process, so it is one warm instance: in production every instance pays one full read per change of the show. Latency moved within the noise of the seeds (p50 215 ms in all six runs).

### The split the audit proposed — proposed, not built

**The design.** A document `showhot_<aid>`, written by `mutateShow` after the show itself, holding what `buildMe` needs: `showId`, `status`, `freeCredits`, `replayCost`, `played`, `col`, `unlimited`, `unlimitedFans`, `requests`, `birthdays`, and a version `rev`. `/api/me` reads it instead of the show.

**The hazards, and why they stopped it tonight.**

1. **Two writes, no transaction.** The show is written first (it is the truth), then the hot record. A hot write that fails, or a function stopped between the two, leaves the hot record behind the show: a phone told the old free-vote count, the old night (a personal state from another night is thrown away, so a fan with bought votes would be shown fresh credits), or that it still holds votes on a song that has started (an old `col`).
2. **Detecting a stale hot record needs the show.** A reader can only tell by comparing with the show's own version, which means reading the show, which is what the split was for. Ways round it: put `rev` in the show blob's metadata and read that with a HEAD, or have the cached board repair the hot record once an interval. Both are more moving parts on the hottest path.
3. **The version cannot be a clock.** Two function instances' clocks disagree; a hot write stamped by the faster clock could keep an older state in place for ever. It must be a counter in the show, raised inside `mutateShow`'s compare-and-swap, and the hot write must itself be a compare-and-swap that only moves `rev` forward, or two artist actions landing close together can leave the older one in the hot record.
4. **Every writer of the show.** Anything that writes `show_<aid>` without `mutateShow` (a restore from a backup, a tool, a future shortcut) leaves the hot record stale until the next artist action. It needs a rule and a test that finds such writers.
5. **The song titles.** `/api/me` names the songs a fan holds votes on (`held`), from the library. A 1 KB record cannot carry titles. Either the page takes titles from the song list (decision 0150) and `held` goes, or `/api/me` reads the library when the fan holds votes, which is most voters.
6. **A new kind of document.** A FAMILIES line in `_mirror.mjs` (derived, never mirrored), a line on the artist's deletion list, and the backup's coverage.

**The test plan, if it is built.** A hot write made to fail (`__failWrites(/^showhot_/)`) after a show write: the reader must never use the hot record whose `rev` is behind, and the next write or the repair must bring it level. Two artist actions interleaved so their hot writes land in the wrong order: the newer `rev` must stay. A writer of `show_` outside `mutateShow`: found by the structure test. A property test like `test/showkept.mjs`: every Live-tab move followed by `/api/me`, compared with a plain read. `test/cost.mjs` holding `/api/me` to its reads. `test/keyfamilies.mjs` classifying the new key.

**Whether it is still worth it.** With A in place the split saves the first read on each instance after each change, and the read count does not change either way. Its remaining value is for the vote path and for a store that bills by bytes on a 304. Measure A on a deploy first.

## What this makes harder

- Nothing may change a show object returned by `getShowKept`; it throws. A caller that needs to change one reads through `getShow`.
- Until week one's read-failure change (decision 0142) is merged here, the conditional read has no clock of its own: a throttled store can hold it as long as Netlify's client retries, as a plain read can today. **When 0142 lands, put the conditional read under its `READ_TIMEOUT_MS`** (the race `readDoc` uses), so a failing conditional read costs no more than a failing plain one. Its fall-through to `readDoc` already throws a `StoreError` under 0142.
- A warm instance holds a parsed show for each of up to `SHOW_MEMO_MAX` artists.

## What would reverse it

- A measurement that a 304 from the store costs what a full read does (time or money), which would leave only the split or D.
- The live room moving to a pushed board or a Durable Object (P3-002), where the phone is sent what changed and reads nothing.

## How it was verified

- `node --import ./test/register.mjs test/showkept.mjs`: 19 ✓, 0 ✗. The first poll reads the record whole and the next asks on condition and is told it has not changed, with one read of the show each time and the same answer a plain read gives. A change (the free-vote count, a song started, a write made straight to the store without `mutateShow`) is in the very next answer. Twelve Live-tab moves (prices, a vote, Play, unlimited on and off, End song, replay price, a new song, requests on, the show ended, a new night), two polls after each: all 24 answers equal the plain one, and the second poll after each move was a 304. The kept copy is frozen; a write to it throws and reaches nobody; the ordinary read still hands out a fresh copy. Seventeen artists: each their own, the newest kept, the one used longest ago read whole again; an artist with no show record costs one plain read a poll.
- `test/blobs-fake.mjs` answers a conditional read the way Netlify's client does (`data: null`, the etag, no body), notes it as `304 <key>`, and counts no bytes for it under `__latency`.
- Five knock-outs, each red: the kept copy used without asking (10 ✗); not frozen (3 ✗); a missing record kept (1 ✗); never let go (1 ✗); `/api/me` reading the ordinary way (2 ✗).
- `test/cost.mjs`, `test/split.mjs`, `test/finality.mjs`, `test/credits.mjs` unchanged and green. `sh test/run.sh` exited 0.
- The simulator figures above.
- **Not checked:** that Netlify Blobs answers a strong conditional read with 304 and the etag on the real store (the client sends `if-none-match` and returns `data: null` on 304; if the real store answered 200 every time, this would cost exactly what the plain read costs, and if it answered 304 without the etag, the code would fall back to a plain read, one read more than today); memory and hit rate on real instances; the vote path, which still reads the whole record.
