# 2026-10-03 — Background jobs keep up; the city index carries its gigs; dated copies on R2

An overnight builder for the scale audit's phase two ("MySet Audit Solutions 2"), in worktree `scale-p2-jobs` on branch `fix/background-cursors`, cut from `test/contention-sim` (PR #218, decisions 0145 and 0146). Nothing was pushed, merged or deployed; nothing touched production. The founder was asleep and has seen none of it: every record here is `proposed`, `agent-recommended`.

## What was asked

Three of the audit's rows, one decision each:

1. **Background jobs fall behind** (0173, INVARIANT 0im, SCL-010) — the nightly copy, the register, the sheet sync, the purge.
2. **The front door, a city's feed and a venue page walk every artist** (0174, INVARIANT 0in, SCL-011).
3. **Dated snapshots on R2** (0175, INVARIANT 0io, SCL-012) — built at 90 days in its own commit, because the founder has not chosen between 30 days, 90 days and none.

## What was built — decision 0173

- **The purge deletes leaves first and the index last.** `keysFor` and `keysForVenue` keep their order (a document before anything read off it) and now collect the documents they read (`namers`). `eraseKeys` walks the list from the end, eight at a time for documents nothing is read off, one at a time for an index, and stops at a failed delete. `purgeDue` gives it `PURGE_BUDGET_MS` and keeps `cur[owner]` on `delqueue`; Undo is refused once that exists. Clip bytes leave R2 inside the walk (`dropClipKey`, which throws on refusal); `dropClipKeys` is gone.
- **The nightly copy** reads an account's key list side by side, skips the etag read for a version or sealed log part already across (`sealed`), and rings every five minutes instead of twenty.
- **The sheet sync** starts where the last run stopped (`cursor` in `sheetsync`) and stops taking artists after `WALK_MS`.
- **The register was not changed.** Design for its own decision, below.

### The register, designed and not built

Every fold reads every month shard and rewrites `register_work`, because `rollup` builds the head from every row. To make it incremental:

1. **Per-month partials.** Beside each shard, a partial of every figure the head shows, kept as raw sums, counts, minimums and maximums, never rounded. That covers the totals, by artist, venue, country, city, weekday and month, the money block, and the song tallies. Sets of names (countries per artist, cities per country, the venues an artist played) are kept as sets.
2. **Per-month work.** `register_work` split by month the same way, so a fold reads and writes only the months its dirty artists touched.
3. **Merge at the head.** The head is the merge of every month's partial, rounded once at the end. A fold reads the partials, about a kilobyte a month, not the shards.
4. **The edges.**
   - `mergeSplitNights` can join two records across a month's end: a night that starts at 23:30 on the 31st and is ended and restarted after midnight. The partials must merge those first, or that night counts twice.
   - Averages of rounded per-row figures (`hours`, `people`) must come out the same as today's `avg` over the rows.
5. **The proof.** A property test that builds random rows, computes `rollup(all)` and `merge(partials)`, and compares every field of the head byte for byte. Plus `test/everyshow.mjs` unchanged and green. The founder audited every number on that page on 1 October (0132), so the bar is identical output, not close.

Not built tonight: it touches every number on a page the founder checked by hand, and the audit puts the need at about a thousand shows a night. Today a fold is a few dozen reads.

## Verified — 0173

| Check | Result |
| --- | --- |
| `node --import ./test/register.mjs test/background.mjs` | 31 ✓, 0 ✗ |
| `test/sheets.mjs` | 214 ✓, 0 ✗ (new section: past the cap, the next sync starts where this one stopped) |
| `test/clips.mjs`, `billing`, `biz`, `diaries`, `featured`, `foundations`, `password` | all green |
| Knock-outs | walk in list order (7 red); indexes batched with leaves (2 red, with out-of-order deletes); sealed skip removed (1 red); sheet cursor ignored (2 red); sheet time box removed (2 red). All restored |
| `sh test/run.sh` | exit 0, 5,240 ✓, 0 ✗ |

## Not checked

- Anything against production: Netlify's real delete latency, the real function limits, the real bill for the five-minute bell, Google's real API past the cap.
- A real account's purge.

## Choices made where the founder did not say

- The purge's box is 4 s (`PURGE_BUDGET_MS`), because it runs before the show sweep in `autocron`, which another session owns tonight.
- Undo is refused once the purge has begun. Before that the thirty days are untouched.
- The copy's bell went from every 20 minutes to every 5. That is about 216 more one-read rings a day.
- A sheet run's walk stops after 15 s (`WALK_MS`), leaving time for Google's writes. Past the cap, each day's snapshot tabs show a different set of artists.
- The register was written up, not built.
- The founder's console erase of a sample page (`eraseData` in `_sample.mjs`) still deletes in list order. It was not in the audit's row; it is one request on a small account, but it has the same flaw.
