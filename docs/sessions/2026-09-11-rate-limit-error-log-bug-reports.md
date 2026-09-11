# 2026-09-11 — Rate limit on casting, an error log that outlives the night, bug reports

**Asked:** proceed with the five steps at the end of `docs/reports/open-line.html`;
answer why the same person on Safari and Chrome is not recognised as one, and whether to
match by IP instead; add the token bucket the report recommended; and build a "report
bug" feature that stores the report with the function logs from the hours before it.

**Shipped — and live.** Production commit `e74292b` combined this resilience work with
the latest artist-discovery map entry point and plan-copy corrections, at the user's
request to publish all recent changes. The supporting documentation is in `af3c603`.

- `netlify/functions/_lib.mjs` — `takeCastToken`, `CAST_BURST = 20` (30 at first; the user lowered it the same day), `CAST_PER_MIN = 30`.
- `netlify/functions/vote.mjs` — the bucket is checked inside the mutation, after the
  credit check; a refused cast is a 429 in plain words and writes nothing.
- `netlify/functions/_errlog.mjs` — `logErr`, `recentErrs`, `guard`, `readBugs`,
  `saveBug`. Errors go to `err_<hour>` documents in the blob store, capped at 100 an
  hour; a report gathers the last three hours. Never throws.
- `netlify/functions/bug.mjs` — public `POST /api/bug`, one report per device per ten
  minutes, anonymous like `/api/vote`.
- 13 public handlers renamed to `main` and exported through `guard('<name>', main)`, so
  an uncaught throw is recorded and answered as a 500 instead of a crash.
- `admin.mjs` — action `bugList`, on demand, never on the Studio poll.
- `public/vote.html` — a "Something wrong?" link in the footer, a sheet with one text
  box, and an in-memory list of the last twenty things the page saw fail.
- `public/studio.html` — "If something broke" card under the money; opens the reports.
- `test/errlog.mjs` — 42 assertions; registered in `test/run.sh`.
- Decisions `0029` (supersedes `0013`, the Sentry proposal) and `0030`; INVARIANTS 0fa
  and 0fb; master overview §1.12 gained "Two things a room is protected from"; the
  ledger; `tools/overview.mjs` now prints the burst and refill numbers.

**Answered, not built:** the two-browsers question. The fan id lives in the browser's
storage and browsers do not share it; no honest web mechanism identifies a device
across browsers. IP matching is worse than nothing — one address for the whole bar on
venue Wi-Fi, and mobile-data phones rotate addresses mid-set. INVARIANT 0ae already
stamps a per-show network hash so the artist can see one network making many phones.
The real defence is that free votes are few and paid votes cost money per browser.

**Not done, and why:** steps 3–5 of the report. The shared-board split (step 3) is
~5 days of work and should start in a fresh session with the user's go-ahead, given his
stated credit budget. Clips on R2 (step 4) needs his own Cloudflare account, which he
sets up himself. The open line (step 5) is gated on a booked show over 2,000.

**Verified:** `sh test/run.sh` — 1,926 assertions, 0 failing; `node tools/overview.mjs
--check` current. Production HTML shows “View on map” to the left of “Search for
artists” and the Pro plan shows a 2% transaction fee with no stale 0% copy. The live
map configuration is enabled, Google returned a PNG for the production referrer, and
`https://myset.vip/vote.html` contains “Something wrong?”.
