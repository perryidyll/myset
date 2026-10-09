---
id: 0173
title: Background jobs keep up — a purge deletes leaves first and carries on, the nightly copy skips what cannot change and rings four times as often, the sheet sync starts where it stopped; the register's fold is left for its own decision
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: storage
reverses:
superseded_by:
invariants: [0im, 0dh, 0bw, 0ft]
commits: []
tests: [test/background.mjs, test/sheets.mjs, test/clips.mjs]
files: [netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, netlify/functions/_video.mjs, netlify/functions/_mirror.mjs, netlify/functions/mirrorcron.mjs, netlify/functions/_warehouse.mjs, test/background.mjs, test/blobs-fake.mjs, test/sheets.mjs, test/clips.mjs, test/run.sh]
---

## The question

The scale audit of 2 October 2026 found four jobs that work at today's size and fall behind at a few hundred accounts:

- **The nightly copy covers about 320 owners a day.** A ring has 5.5 s and there were 72 rings a day. Each owner's key list was read one night at a time before the ring's clock even started, so an owner with a few hundred nights could take a whole ring on its own.
- **The register reads all of its history on every fold.** Every month shard and the whole working document, every time a show starts or ends.
- **The sheet sync only ever reads the first 400 artists.** The 401st artist's nights never reach the sheet, which is the thing INVARIANT 0bw says a cap must not do. And at 25 to 430 reads an artist, a run is killed somewhere between 15 and 50 artists and writes nothing.
- **A purge deletes the indexes first.** The key list starts with `show_`, `histidx_` and `histids_`. A run killed after them leaves every night, event log, version, lyric sheet and chart behind with nothing able to name them, because `list()` is banned (INVARIANT 1). It is also one delete at a time, inside the cron that starts tonight's shows.

The audit's fix: *work from a "changed" list, add cursors, delete leaves first and the index last.*

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A fix per job. **Purge:** walk the key list from the end, documents nothing is read off side by side, an index alone; time-boxed, with the key it reached kept on the queue; Undo refused once it has begun. **Copy:** the key list read side by side; a version or a sealed log part already across is not asked for its etag again; the bell rings every 5 minutes, not 20. **Sheet:** a run starts where the last one stopped and stops taking artists when its time is up. **Register:** not changed (below) | About 216 more one-read rings a day for the copy; one more small write per purge ring | `eraseKeys`, `namers` on the two key lists, `sealed`, `cursor` on the sync state | A key list that names something before the document it is read off: the purge could orphan it. The kill-anywhere test is what holds that |
| B | A "changed" list: every writer marks its owner dirty, and the copy visits only dirty owners | One write more on every path that writes, including paths near the room | A dirty document every writer must remember | It cannot be proved complete — one writer that forgets, and that owner is never copied again. It needs the full walk behind it anyway |
| C | Move each job to a background function (15 minutes, not 10 seconds) | Billed by the minute | Four new functions, and `autocron` (another session's file tonight) would have to call one | The same ordering bug, with more time to hit it |
| D — do nothing | | | | At a few hundred accounts the copy runs days behind, the sheet stops, and a killed purge leaves documents nobody can find |

## What was chosen, and why

A.

- **The purge (INVARIANT 0im).**
  - `keysFor` and `keysForVenue` promise an order: a document is named before any key read off it. They now also say which documents they read to name the rest (`namers`): the index, the history id list, the library, the profile, the feed, the pending clips, the diary, the inbox, each night's log head, and the version, post and inbox archives.
  - `eraseKeys` walks the list from the end. Up to eight documents nothing is read off go side by side; an index goes alone, and only after everything below it is gone. A delete that fails stops the walk there, so nothing it names is orphaned.
  - A clip's bytes leave R2 inside the walk (`dropClipKey`). If R2 refuses, the walk stops before the post or the pending list that names the clip. Until now a refused delete was parked on the pending list, and the same purge then deleted that list.
  - `purgeDue` gives the walk `PURGE_BUDGET_MS`. It runs before the show sweep in `autocron`, a file another session owns tonight, so the box is what keeps it from delaying a gig. The queue keeps `cur[owner]`: set before the first delete, then the key each ring reached. The next ring finds that key in the same list (its index is still there to name it) and carries on below it.
  - **Undo is refused once `cur[owner]` exists.** The grace is unchanged: nothing is deleted before `purgeAt`, and Undo works until the purge actually starts. After that, Undo would bring back an account with half its documents gone.
- **The copy.**
  - The key list is read side by side, eight at a time, in the same order as before. Sixty nights at 5 ms a read: 51 ms, where one after another would be over 300.
  - A version (`ver_`) and a sealed part of an append-only log are written once with `onlyIfNew` and never again. Once one is in the manifest, the pass does not ask for its etag. A part counts only when its head is on the same list and is one of the five logs, so a venue called "P12" (`postsarch_v_p12`, a head that does change) is never mistaken for one.
  - The bell rings every 5 minutes. A ring after a finished pass is one read.
  - The "changed list" (B) was considered and not built, for the completeness reason in the table. The full walk stays, made cheaper.
- **The sheet.**
  - `cursor` in `sheetsync` names the first artist a run did not take, by id, and by place if that artist has since left. The next run starts there and wraps round; a run that takes everyone clears it.
  - `WALK_MS` stops taking artists in time for the writes, after at least one. An artist either has all their rows or none, as before (0bw).
  - A run that failed a log tab does not move the cursor, so its artists are taken first again.
  - The cron is still once a day. Past the cap, a full turn of the list takes several days, and each run's snapshot tabs show the artists it took.
- **The register is not changed.** Its fold re-reads every month shard because the roll-ups at the top of the founder's dashboard (totals, by artist, venue, city, month, weekday, the top songs, the money model's block) are computed from every row, and none of them can be updated from one month alone as written. Several are averages of rounded figures, sets of names, or a night merged across two records (`mergeSplitNights`), which can straddle a month's end. Making them incremental means a per-month partial for each figure, a merge, and proof that every number on a page the founder audited by hand on 1 October (0132) comes out the same. That is its own decision with its own test, not a night's side job. The design is in the session note. Today a fold is a few dozen reads; the audit puts the trouble at about 1,000 shows a night.

## What this makes harder

- A new key family read off a document must name that document in `namers`, or the purge may delete the document while what it names is in flight. `test/background.mjs` kills the walk after every possible delete, with deletes landing out of order, and fails on anything left unnamed. It only covers the families its test account has.
- Once a purge has begun, Undo answers "already being deleted".
- The copy's bell is four times as many function calls, most of them one read.
- The sheet's snapshot tabs show a different set of artists each day once there are more than 400 (or more than one run's time allows). Before, they always showed the same first 400.

## What would reverse it

- A store that lists cheaply and consistently: the purge could find orphans, and the order would stop mattering.
- The register decision above landing: its own record.
- A per-artist cache of the sheet's snapshot rows. Then snapshot tabs could be whole again past the cap; this decision only makes sure nobody is left out for ever.

## How it was verified

- `node --import ./test/register.mjs test/background.mjs`: 31 ✓, 0 ✗.
  - **Purge.** An account with one of every family a key list is read off (108 documents). The walk is killed after each of 0 to 108 deletes, with deletes sent side by side landing out of order. Each time, everything left is still named by the account's key list, and the next walk finishes. With no time at all, a ring deletes one step; ring after ring finishes it, every ring moving it on. Undo is refused once it has begun. The registry row goes last; the queue forgets the owner and its cursor. With R2 refusing, the walk stops before the post and the pending list, and every clip still on R2 is still named; when R2 is back the next walk finishes.
  - **Copy.** The second pass asks none of the 31 written-once documents for an etag and still skips them all. A log head that moved is copied. "P12" is a head.
  - **Key list.** Sixty nights read in 51 ms at 5 ms a read.
- `test/sheets.mjs`: 214 ✓, 0 ✗. The new section caps at two with five artists: each run takes two, no two runs in a row take the same two, everyone reaches the sheet within a turn. With no time left a run takes one artist and says the rest come next. With room, a run takes everyone and clears the cursor.
- `test/clips.mjs`: 163 ✓. `dropClipKeys` became `dropClipKey`, which throws on refusal.
- Six knock-outs, each red, then restored:
  - the walk run in the list's own order (7 red);
  - indexes batched with everything else (2 red: orphans once deletes land out of order);
  - the sealed skip removed (1 red);
  - the sheet's cursor ignored (2 red);
  - the sheet's time box removed (2 red);
  - (without the out-of-order landing, the second knock-out stayed green; that is why the fake has `jitter`).
- `sh test/run.sh`: exit 0, 5,240 ✓, 0 ✗ (`test/keyfamilies.mjs`: no new kind of document).
- **Not checked:**
  - real Netlify delete latency, so how many rings a large purge takes;
  - the function time limit the purge box assumes;
  - the 5-minute bell on the real bill;
  - the sheet against Google's real API past the cap;
  - any production account. Nothing here touched production.
