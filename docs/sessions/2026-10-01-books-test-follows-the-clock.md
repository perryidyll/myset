# 2026-10-01 — `test/books.mjs` failed when the month turned

**Asked.** `test/books.mjs` failed on a clean origin/main (seen at `9d65c56` and `07159ae`) after passing in September. Because `test/run.sh` stops at the first failing suite, every suite after it went unrun in a full run. Find the failing assertions, decide whether the bug is in the test or in the books code (a real month-boundary bug would concern money), make the test independent of the wall clock, and confirm the suite runs to the end.

**Found.** One assertion: *A VENUE HAS BOOKS TOO → with the venue's own gross* got 0, wanted 3000. The test pins `NOW = Date.UTC(2026, 8, 15)` and puts the venue's $30 charge in `LAST` (August). The artist-side checks pass `now` into `_ledger.mjs`, but the venue door, `venueadmin.mjs` action `ledger`, takes no `now` and calls `statement()` with its default `Date.now()`. Asked for `months: 2`, it covered August–September until 30 Sep and September–October from 1 Oct, so the August charge fell outside.

**Verdict: a test bug, not a money bug.** A two-month statement asked for in October should cover September and October; the handler is right and was not changed. Letting a request choose its own `now` would be the real hole.

**Shipped.** `test/books.mjs` stubs `Date.now` to `NOW` for the venue token, the fixture and the `ledger` call, and restores it in `finally` — the pattern `latetips`, `stripefees` and `featured` already use. Merged as `c0fdbf0` (PR #191, squashed with `[skip ci]`; test-only, so nothing deploys).

**Verified.** Under a faked wall clock (a `--import` that shifts `Date.now`): the old test passes on 2026-09-20 and fails on 2026-10-01; the new one passes on 2026-09-20, 2026-10-01, 2027-01-03 and 2027-03-01. `sh test/run.sh` exit 0, 5,085 ✓ / 0 ✗ across every suite.

**Lesson for the next test.** When a handler reads the clock itself, a test with a pinned `NOW` must pin `Date.now` around the call too, or its fixtures drift out of the window once a month.
