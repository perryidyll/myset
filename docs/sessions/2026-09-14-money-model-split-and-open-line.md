# 2026-09-14 — Money model: the split and the open line, priced from the simulator and the probe

## What the user asked

"Implement this plan in its entirety then ship it — use the latest numbers and data from the
Current Show Stats artifact wherever necessary." The plan is the six steps in
`docs/sessions/2026-09-12-model-theme-toggle-and-split-plan.md`.

## What was done, step by step

### 1 · The split is in the engine, pinned to the simulator — done

`finance/model.html`, the engine block:

- The ladder now matches `tools/loadsim.py` and `public/vote.html` exactly: the server's floor
  (`pollFloor`: 3 s to 200 phones, 10 s to 3,000, 20 s above — `pollFloorFor` in `_lib.mjs`), the
  four rungs (floor, ×10/3, ×25/3, ×20), ±20% jitter, and the stage-only signature above 200
  phones (a song every four minutes resets the ladder; other people's votes do not). The old
  engine had none of these, which is why it over-counted an arena's polls by ~8×.
- `gigTraffic` prices every tick as two requests: the shared board (rendered once per interval
  for the room — counted from the sampled phones' actual poll times, the way `board_renders` does
  in the simulator — and an edge hit otherwise) and the personal call (never cached, 50 ms
  estimated, 2 reads). Bytes are board 2,175 + personal 430 instead of one 2,530-byte poll.
- Under a 10 s interval the board's copy is per edge node, so renders are a range: a new
  `edgeSpread` dial slides between the best case (one node) and the worst (every tick renders),
  default the midpoint. The formula table shows all three numbers.
- The same gig is also computed "before the split" (`lgRequests`, `lgBytes`, `lgFnMs`,
  `lgReads`) and priced by a new host, **Netlify before the split**, which replaces the
  "3-second cache (not built)" host — the cache is built; it is the split.
- The store's bytes per second (`storeMBs`: one shard + the show record per personal call, the
  whole bag + the show record per render, at 101 + 240 × actions bytes per fan) is the new
  feasibility line: past ~50 MB/s the room breaks whatever the bill says. The size table has a
  "Store MB/s" column and a "Board renders" column; the arena now reads *at the edge* on today's
  code, the festival *breaks* on the store.
- New dials: function time and reads per personal call, bytes per board and per personal
  answer, the edge-nodes guess; the "big-room brake" dials are now "extra brake above the
  server's own floor".
- Copy rewritten wherever it said "every poll reads every fan record": the lede, the formula
  rows, the sources note, the tidal-wave note (which is now a built / to-do list).

`finance/model-test.mjs`: the calibration targets were re-generated from today's simulator
(eleven rooms, 8 to 10,000 phones; ticks, renders best case, credits best and worst, credits
before the split where the ladders agree) and the suite holds the page within 3.4% / 3.2% /
4.2% / 4.2% / 4.3%. The audit-era assertions ("the cache changes the verdict", "DO is cheaper
but not 13×", "the brake at 15 s cuts arena polls 3×") were rewritten for what is built. 69
checks, all pass.

### 2 · Measure it at a real gig — partly done, the rest needs the founder

- Sunday 13 Sep, Sand & Tan: the Current Show Stats snapshot and a fresh read of production
  agree — 2 phones, 5 votes, 5 song starts, 2.8 h, a $10 tip. No bandwidth marks bracketed it
  (none were taken on Saturday), so the cache-hit ratio is still unmeasured.
- A mark was taken today at 17:00 (mark #3, 1,157,497,665 bytes used this period, 821.8 MB
  over 72.9 h since 11 Sep) — the BEFORE mark for tonight's Ugly Duckling gig (20:30). The
  founder's half: tomorrow morning `python3 tools/actuals.py --mark "after Mon gig"
  --studio-min N --clip-views 0`, then `--write`.
- `tools/actuals.py` now weighs a tick as board + personal (2,605 bytes) for any mark taken
  since the split and the old 2,530 for marks before it; the model test checks its constants
  against the page's.

### 3 · Ticks per phone-hour — done

The tracker's `pollsPerPhoneHour` field keeps its name (the page reads it) and now means
ticks; `calibrateLook` searches on the engine's tick count with the room's real floor.

### 4 · The open line, priced from measured numbers — done

The **Cloudflare Durable Objects (rewrite)** host is now **Netlify + the open line**:
Netlify's full bill (the ladder still runs; every landed vote waits `nudgeMs` — 130 ms
default — for its nudge) plus Cloudflare's: two requests per socket, one per nudge (one per
landed vote plus one per stage action), 1.7 GB-s per 12,202 connections (the probe's own bill,
decision 0035). What the build (0036, in the parallel worktree) changed in the ladder is in
the engine: with the line open the tally no longer resets anyone's ladder, and a stage message
makes every phone whose screen is on look once.

The finding that matters: **a hidden page closes its socket and a shown one reopens it**
(INVARIANT 9d12), so every *glance* is a socket — ~95 per phone over a 3-hour gig at 22%
screen-on — not every phone. At a bar the tally changes about as often as the stage does, so the
line barely slows the ladder. Net: the line costs about half a cent more per bar gig and 33%
more at arena size, and buys a live tally. It is not a saving, and the page says so. New dials:
phones on the line, reconnections per phone, the nudge's round trip.

### 5 · Measure the line at a real gig — not possible yet

The line's production code is still uncommitted in
`.claude/worktrees/compassionate-chatterjee-41ecbe` (its decision is numbered 0036 there, which
collides with main's 0036 — and main is now at 0075, so it needs renumbering at merge). It is
off until `LINE_URL` and `LINE_KEY` are set. Nothing to measure until it is merged and switched
on for one night.

### 6 · Projection deltas — done (below) and the artifact republished

## The numbers — Benchmark case, 1,000 artists

| | Old engine, 5 nights (11 Sep) | New engine, 5 nights | New engine, 7 nights (14 Sep) |
|---|---|---|---|
| Phones a gig | 11.0 | 11.0 | 9.4 |
| Length | 2.74 h | 2.74 h | 2.75 h |
| Actions a head | 2.35 | 2.35 | 2.32 |
| Room money a head | $0.375 (1 night) | $0.375 | $0.68 (3 nights; $10 of $13 is one tip) |
| Deploys a month | 216 | 216 | 264 (79 this period) |
| Revenue a month | $3,835 | $3,835 | **$5,520** ($3,408 if $0.375 a head is kept) |
| Profit a month | $2,165 | $2,153 | **$3,821** ($1,731 at $0.375) |
| Server per gig | 3.10¢ | 3.50¢ | 3.50¢ (3.95¢ with the open line) |
| Break-even | 148 | 150 | **92** (181 at $0.375) |

The whole move from $2,153 to $3,821 is the per-head figure going from $0.375 to $0.684 — and
that is one $10 tip in a two-phone room. Fewer phones a night (9.4 vs 11.0) pulls the other
way. The split itself moved profit by $12 a month. The open line by another $14.

Show sizes on Netlify, defaults: bar set $0.04 → $0.05; concert $0.52 → $0.19; arena $27 →
$2.77 (breaks → at the edge); festival $3,006 → $144 (breaks, on the store). With the open
line: bar $0.05, concert $0.23, arena $3.69, festival $196.

## What is measured, estimated, guessed — said on the page

Measured: bytes on the wire (board 0.86× the old poll, personal 430), reads per call, 42 ms a
read, the fan record's size, the probe's two requests per socket and 1.7 GB-s. Estimated: 50 ms
per personal call, the edge-node count (dial at 50%), the nudge's round trip from Netlify's
region, reconnections. Simulated: everything above 18 phones.

## Verification

- `node finance/model-test.mjs` — all 79 pass (run from the PR worktree; the test now reads the page beside it, not a hard-coded path).
- Browser, local static server on the PR worktree: page renders, no console errors; the size
  table shows Ticks / Board renders / Store MB/s; the hosts table prices "Netlify before the
  split" ($136) below today ($165) and "Netlify + the open line" ($170) above it at the
  scenario the browser had saved; the live spans in the tidal-wave note fill.
- `tools/actuals.py` run read-only against production twice (a mark, then `--write`).

## The independent review, and what it changed

A fresh-context reviewer read the diff against the simulator and the open-line build. Eight
findings; all eight taken:

1. The host list priced every host on the chosen host's traffic — the open line's row showed
   Netlify + $5 with zero sockets. Each host is now billed on the month IT would serve.
2. A saved scenario could bring the retired "3-second cache" host back (its `hosts` were
   deep-merged over today's). `withDefaults` now rebuilds the host list from today's keys and
   keeps only numeric rates of hosts that still exist; an unknown host falls back to Netlify.
3. "Before the split" ran today's ladder, understating 201–1,000-phone rooms by a third; it now
   runs the old 5 s rung, and the parity test compares every case (4.3% worst).
4. "A song every 4 minutes" was a constant dressed as a fact; it is the `songEveryMin` dial
   (4 = the simulator's assumption; the seven nights average ~18 min between song starts, and
   "Use real shows" fills it from `songs ÷ hours`). "Measured on the probe" was dropped from the
   nudge count — decision 0036 designed it; no gig has counted it.
5. Stage looks could push renders past one per interval above the durable cache — capped.
6. The nudge's wait is charged on landed votes only (× `changeShare`), matching the nudge count.
7. `lineShare` now blends the two ladders — phones without a socket poll as today.
8. The tracker's split timestamp was midnight UTC; the split landed 11:17 UTC. Fixed, and a
   bracket the split falls inside is refused with a reason instead of solved at the wrong weight.

Also from the review: the month total now carries only what sums (no per-gig rates in `T`).

## Not done / for the founder

- Tomorrow's AFTER mark (above), the first bracket of a gig on the split code.
- Merge the open line, renumber its decision, set `LINE_URL`/`LINE_KEY` for one night, then
  the `nudgeMs`, `reconnects` and `lineShare` dials get real numbers.
- $0.68 a head is one tip; treat it as a range ($0.15–0.70), not a figure.
- The SSD was not mounted; no mirror.
