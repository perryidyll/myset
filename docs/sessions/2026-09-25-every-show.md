# 2026-09-25 — Every show on the platform: the register, the dashboard, the live feed

**Asked:** "set up a robust system for tracking and reporting the numbers from ALL shows from
ALL artists … i want to see literally the data on every single show on the platform — who
hosted it (artist & venue), what country/city, how long, how many people, how many tips/votes
bought/merch bought, etc. — track and report all of it … create an entirely new dashboard for
this that then feeds into and continuously updates the money model."

**Shipped (this PR):** decision `0095`, INVARIANT 0gi.

## What is new

- **The register** — `netlify/functions/_register.mjs`. One lean row per night any artist has
  filed, in month shards (`register_<YYYY-MM>`) under a head (`register`) with the roll-ups
  (by artist, venue, country, city, month, weekday; most-played songs; sign-ups by month and
  first touch; totals) and the exact block the money model's Real shows panel takes (`act`).
  Working state in `register_work` (row signatures, frozen counts, song tallies, silent gigs,
  departed artists, re-check marks); the bell's state in `registersync`.
- **One writer, incremental, time-boxed.** `foldRegister` under the lock in `registersync`,
  from the bell (`registercron.mjs`, every ten minutes — an idle ring is two reads) or the
  dashboard's Refresh. A show starting or ending, a rename, a hide or a re-check leaves a
  `regdirty` mark on `gigsched` inside a write already made (`_lifecycle.mjs`
  markLive/unmarkLive, `history.mjs`); the next ring folds those artists first; a full walk
  at least every six hours. Per artist: index + id list + calendar; a night's detail only
  when new, changed (`rowSig`) or the calendar changed (etag); the other five documents only
  then. BUDGET_MS with a cursor.
- **One night rule** — `netlify/functions/_nightrule.mjs` (`judgeNight`, `judgeRow`,
  `placeNight`, `occurrences`), the tracker's rules ported line for line; `_metrics.mjs`
  re-exports and uses it (the stats snapshot's `real`), `_warehouse.mjs` uses it (the Sheet's
  "Real night"); `tools/actuals.py` is pinned to the same answers on two production snapshots.
- **What the store forgets, the register keeps.** Requests (`req_` keeps 80 rows), RSVPs
  (`rsvp_` prunes after three days) and ratings (a device re-rating replaces its row) are
  frozen on first observation and only ever raised — `interactions` is a model dial. The
  archive now files request counts by kind/outcome, RSVPs, the plan the night was played on,
  who started and ended it, the gig's country and zone; `hidden` survives a re-archive;
  `_pay.mjs` tags tips and paid marks with the show. Mirrored (`_mirror.mjs` GLOBALS +
  `globalKeys()` for the shards).
- **Money.** Stripe's answer or "unknown", never $0. `$ a head` = tips + packs + paid requests
  ÷ phones over money-known nights; merch apart (goods and postage, "during the show"
  separately). Untagged money is a window figure: taken once on a merged night, and
  `moneyForShow` no longer counts an untagged payment made after the next night began. The
  morning after a night (10 h) the bell asks Stripe once more (two a ring).
- **The dashboard** — `finance/shows.html` served by `moneymodel.mjs` at
  **`/moneymodel/shows`** (`myset.vip/shows` 301s there) through `_showsdash.mjs`, behind
  the model's passcode (`_passgate.mjs`, extracted from moneymodel.mjs; the `fm` cookie,
  scoped to `/moneymodel`, covers the page, `shows.json`, `shows.csv`, `shows/night.json`,
  `shows/refresh` and `live.json`). KPI band, filters (range, artist, venue, country, plan,
  status, search), the table of every show (a tap opens the night's songs, what the room
  asked for, every money line, rating, RSVPs — read on demand from the `hist_` document,
  stripped of anything a fan typed), four charts, roll-ups, sign-ups, most-played songs,
  silent gigs, "How these numbers are made", CSV, Refresh now. Hidden as a flag (greyed);
  silent gigs as rows; a departed artist's nights nameless. The Thai-floor sentence is
  computed from the rows' countries.
- **The live feed into the model** — `/moneymodel/live.json`; `finance/model.html` asks it on
  load and lays the block over its seed keeping METER_KEYS (ticks per phone-hour, credits a
  night, deploys, the two bills). Precedence: live → a paste made after the live build → the
  seed; the REAL SHOWS stamp names the winner; "Forget them" returns to live; a paste stamps
  `pastedAt`. The artifact copy keeps the seed.
- **Housekeeping.** RESERVED gains `shows`, `moneymodel`, `financialmodel`, `report`,
  `metrics`, `artists` (none held on 2026-09-25) and `test/structure.mjs` checks every routed
  first segment is reserved; `test/cost.mjs` watches the register's globals; the overview's
  "served at" sentence names `/moneymodel/shows`; decision 0071 marked superseded (MET-001
  retired); `finance/fixtures/2026-09-25/` — a read-only production snapshot with tip notes,
  fan ids, names and session ids stripped.

## How the design was reviewed

A read-only understanding pass (six readers, one synthesis) mapped every record a show
leaves; a design brief was then attacked by three critics (data correctness, operations and
cost, product fit) and synthesised. Accepted and built: no fold on the End tap (dirty marks
in the scheduler's own CAS); one writer; month shards with lean rows and the night on demand;
time-boxed rings, idle ring two reads; one night rule; frozen never-go-down counts; hidden as
a flag; the live feed beating a stale paste; the register mirrored; the dashboard under the
model's door; `$ a head` defined and merch outside it; untagged money once; departed artists
as tombstones; the routed names reserved; `plan`/`country`/`tz` stamped and cleared with
venue/city; the morning-after re-check; the request/RSVP counts filed with the night.
Deferred, and written into 0095: porting `tools/actuals.py`'s calendar expansion to the
scheduler's (`until`, monthly, biweekly semantics — identical on every calendar so far);
`venueId` on gigs; PER-010 (`FINMODEL_CODE`), which is the founder's step and matters more
now. Rejected: excluding hidden nights from the totals (the tracker cannot see the flag —
both sides count them).

## Numbers seen

- 25 Sep production snapshot: 6 artists, 1 with nights; 30 filed nights (29 in the index),
  12 hidden by the founder (all of them refused by the rule anyway); 8 calendar rules; the
  register counts 15, 2 unused, 13 refused, 5 silent — the fortnight audit's figures
  ($1.037 a head over 11 money-known nights; 8.6 phones; 2.73 h; 2.09 actions a phone; 10
  songs a night; 22 gigs on the calendar).
- Two spellings of the Ugly Duckling are one venue in the roll-ups (`venueKey`).

## Verified

- `node --import ./test/register.mjs test/everyshow.mjs` — 91 ✓.
- `node finance/model-test.mjs` — all passed (live feed precedence and meters pinned).
- `python3 tools/actuals-test.py` — all passed (25 Sep snapshot pinned).
- `sh test/run.sh` — 55 files, 3,601 ✓, 0 failed, exit 0.
- The dashboard opened in a real browser against `tools/localhost.mjs` (real functions,
  in-memory store): the gate, the passcode, the page, Refresh, the rows and the night drawer.

## Not verified here

- A fold against production's live store — the first ring after the merge does it; the
  head's `build` block (reads, ms, artists walked) is on the page's footer.
- The empty-day meter after a day of ten-minute rings (0ge) — re-take it.
- Netlify's real scheduled-function timeout; BUDGET_MS is six seconds.

## Numbering

0090 and 0092 are on origin/main (loaders; mediadash); 0091 is held uncommitted by the
perf/sw-navigations worktree; this PR is **0095 / 0gi**.
