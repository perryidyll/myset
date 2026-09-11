# 2026-09-11 — The shared-board split (P3-001)

**Asked:** build P3-001. Split the audience poll — `GET /api/show?fan=<id>&in=1`, polled
by every phone in the room and uncacheable because the fan id is in the address — into a
shared board with no fan id that the edge can hold for the polling interval, and a tiny
per-fan call for what is personal. Keep the audience poll under the read ceiling
`test/cost.mjs` enforces; no dependencies; do not touch `public/sw.js`; never `list()`;
every failure degrades to "the room can still vote". Measure with `tools/loadsim.py`
before and after and record the honest new ceiling.

**Started on top of another session's uncommitted work** (the user chose this when asked):
burst 20, the live Maps CSP, finance actuals, the artists-page interactive map. Those
files are untouched by this session; the finance work was committed to `main` during it
(`210683d`, `790fab5`), the rest is still uncommitted. Two more sessions hold uncommitted
work in worktrees — R2 on `claude/r2-clips` (which took decision 0033 and INVARIANT 0fd,
so this split is 0034 and 0fh–0fk) and the open line — and nothing here touches theirs. One rendered check in
`tools/uicheck.mjs` (the artists-page static-map pin) fails because of that other work,
not this.

**Built — uncommitted, not deployed.**

- `netlify/functions/_board.mjs` — `buildBoard` (everything the room shares; carries a
  `tail` of `[id, votes, firstAt]` below a shortened board's cut so a phone can put its own
  song back — INVARIANT 0el), `buildMe` (credits, own votes per song, the titles it holds,
  request statuses, `lastAt`), `mergeForOne` (the old shape from the two halves),
  `freshCredits`.
- `netlify/functions/board.mjs` — `GET /api/board?a=<slug>`: 14 reads, no write, `at`
  stamped **before** the reads; `netlify-cdn-cache-control: public, durable,
  s-maxage=<n>, stale-while-revalidate=<n>` with `n = pollFloorFor(heads)` in seconds;
  browser `max-age=0, must-revalidate`.
- `netlify/functions/me.mjs` — `GET /api/me?fan=<id>&in=1`: the show record and one shard
  (2 reads on the founding page, 3 for a slug); stamps presence when `in=1`; `no-store`.
- `netlify/functions/show.mjs` — kept for open tabs; now `mergeForOne(buildBoard, buildMe)`.
- `netlify/functions/vote.mjs` — the answer carries `at`, taken after the write is verified.
- `netlify/functions/_lib.mjs` — `getShow(aid, { withName: false })`; the dial comment.
- `public/vote.html` — `load()` fetches both and merges (`mergeBoard`, a copy of
  `mergeForOne`); `SHOWN` keeps what the phone showed itself when it cast until a board
  rendered after the cast arrives; `CAST_AT` outranks a stale personal reply; `applyCast`
  writes the vote's answer into the held personal state; only a fresh board feeds the
  countdown; `render()` is back inside a try; a refused cast clears its overlay; a
  personal state from another night is ignored.
- `test/split.mjs` — 80 assertions, in `test/run.sh`. `test/cost.mjs` — board ≤ 15,
  personal ≤ 3 (one shard, no global on the founding page, no write once present),
  legacy ≤ 15. `test/errlog.mjs` — `board` and `me` are guarded. `test/audit-0902.mjs` —
  the "null when unlimited" source check now reads `_board.mjs`. `test/blobs-fake.mjs` —
  `__slowReads(ms)`.
- `tools/loadsim.py` — models the split by default (`--legacy` for the old shape),
  counts board renders from the real poll timings, models the store's read traffic, and
  `--ceiling` walks room sizes at two record weights.
- INVARIANTS 0fh–0fk (new), 0em/0ep/0ek/0el/15i/9d13 (updated). Decision `0034`.
  Master overview §5.3, §6.2 and the "not built" bullet; `PERFORMANCE-PLAN.md` #10.

**Measured.**

- Reads: board render 14 (ceiling 15), personal poll 2 (ceiling 3), legacy 14.
- Payloads on a synthetic 40-song room: board 7,314 bytes vs the old 8,529 (0.86);
  personal 427.
- A fan's record on the real write path: 101 bytes present-only, **412 after one cast,
  864 after three, 2,010 after eight** — the cast receipts kept for idempotency are most
  of it. The room-ceiling report assumed 152.
- `tools/loadsim.py`, 3-hour gig, Pro rate — before → after: 20 people 2.70¢ → **3.01¢**
  (two requests a tick, a cache hit is still billed, 61% of board requests are edge hits
  at that size); 200 $0.359 → $0.322; 1,000 $0.978 → $0.859; 2,000 $1.281 → $1.123;
  10,000 $4.29 → **$3.76**. Blob reads at 10,000: 13.2M → 1.76M.
- `--ceiling`, busiest case (every screen on, eight votes a head), the store's reads:
  at the report's 152-byte record, 10,000 people 462 MB/s → 40.5 (reproduces the report's
  column to the decimal; the split is never over the 50 MB/s line up to 10,000). At
  today's 2 KB record: **before the split the wall was ~700–1,000, after it ~2,500**
  (2,000 → 34 MB/s, 3,000 → 77). **The honest new ceiling is ~2,500 in the busiest case
  at today's record weight**, which is inside GATE-003's 2,000 for the first time on
  reads; the old "~2,500" was optimistic because the record grew after it was written.
- Live, read-only: `/api/img` on myset.vip — the same `durable` directive through the
  same `/api/*` rewrite — answered `cache-status: "Netlify Durable"; hit` with `age` on
  the second and third request. The 3-second TTL itself is unverified until the deploy.
- Estimated, not measured: the personal call's billed duration (~50 ms from two parallel
  42 ms reads). Read it off the function log after the first gig.

**Verified.**

- `sh test/run.sh`: 2,017 assertions, 0 failing (1,926 before the session).
- Parity with HEAD's `show.mjs` on the same in-memory store, 15 scenarios: 0 differ
  (the reviewer's script, re-run by hand). `test/split.mjs`'s own "old door" checks are
  consistency checks — `/api/show` *is* the merge now.
- A real browser at phone width against the real handlers over HTTP: a vote through the
  sheet, stable across polls; `/api/me` returning 500 — the board keeps updating with
  other phones' votes and a fresh phone's cast is shown as its own with the server's
  `remaining`; `/api/board` returning 500 — the page keeps its board; no page errors.
- `tools/uicheck.mjs`: 104 pass; the one failure is the other session's map work.
- The ordering test goes red when the board's clock is moved back after its reads.

**The fresh-context review** (a second model, no memory of the build) found seven things
worth fixing, all taken: the board's clock after its reads vs a cast's before its write
(a board rendered across a vote could look newer than the vote while lacking it); a kept
board re-feeding the countdown during a board outage so it could never end; the lost
try/catch around `render()`; a refused cast leaving its optimistic number; a personal
state from another night painted onto a new show; the ceiling fed a record size the
vote path no longer writes; "no global document" only true of the founding page. Noted,
not done: cache the registry read for slugs (P3-014); the roomsize suite still exercises
the legacy door (its negative assertions were added on the new path in `split.mjs`).

**Not done, and why.**

- Not committed, not pushed, not deployed — the rules. The user says the word.
- The plan's audience tiers are not raised; the ceiling moved in a simulator.
- P3-013 (trim the cast receipts) is the cheapest next lever and is only filed.
- `public/sw.js` untouched; its comment "nothing under /api is ever cached" is now true of
  the worker only, and was left as it is.

**Next.** Deploy on the user's word; watch `/api/board` live (`cache-status`, `age`, the
3 s copy); read the personal call's duration off the log; P3-013; R2 when the user has
clicked the R2 subscription; then the open line on his word — he said not to wait for a
2,000-person booking.

---

## Later the same evening — committed, pushed, and what the live edge taught

The user said the word. Staged the split, the docs and his burst-20 change; left the
other session's artists-page map (`public/artists.html`, `netlify.toml`, `test/copy.mjs`)
uncommitted on purpose — undocumented, and its rendered check fails. `sh test/run.sh` on a
clean checkout of the commit: 2,017/2,017. Pushed `c3d0a4d`; the new page was live in
40 s and both endpoints answered correctly. (The R2 session pushed `a4e3657` right
after, from its worktree; its copy of the master overview predated this session's prose
in §5.3 and §6.2, which is why those passages were re-applied in the correction commit.)

**But the shared board was not being shared.** Every live request said
`"Netlify Durable"; fwd=bypass` and rendered afresh. Two free draft deploys with a
header switch (never committed) found the rule: **the durable cache ignores a lifetime
under 10 seconds** — 3 through 9 bypassed in every spelling (`max-age`, `s-maxage`, with
and without `stale-while-revalidate`), 10 and 60 hit with a ttl. Under 10 the copy still
lives on each edge node: a 3 s copy was `"Netlify Edge"; hit; ttl=2` on the same
connection and a miss from the next node, on the draft and on production.

**Fix:** the middle rung of `pollFloorFor` is 10 s, not 5 s (rooms of 201–3,000). Pubs
keep 3 s with a per-node copy — cheap either way, tally live. Same worst-case delay for a
mid room as a 5 s poll against a 10 s copy, half the requests. `test/roomsize.mjs` now
asserts the rung is at least the durable minimum from 201; `tools/loadsim.py` mirrors
the new rung, keeps the old one for `--legacy` and the `before` column, and prints
small-room costs as a range (best: one render per interval; worst: every poll renders).
1,000 phones: $0.98 → $0.56, 164 → 9 MB/s. 20 phones: 2.7¢ → 3.0–4.0¢. Decision `0034`
carries the story; INVARIANT 0fi the rule.

**What is still a simulation:** the honest ceiling (~2,500 busiest case at today's record
weight) and the personal call's ~50 ms. Read the function log after the first busy room.

