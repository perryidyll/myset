# 2026-10-10 — a document that never existed never gets a version (0205)

**Asked:** fix the flaky profile-version test on main (the founder, from a task chip raised while merging the scale audit's leftovers).

**Cause:** `casKeep` made its blank from `fallback()` once, and `casDoc` called `fallback()` again for each read of the missing document. `defaultProfile()` stamps `updatedAt: Date.now()`, so when the two calls fell in different milliseconds the read no longer matched the blank. A version of a never-written profile was then kept, and `test/foundations.mjs` "A VERSION BEFORE EVERY OVERWRITE" failed at random. Since 0197 that test is in a required check. Product Dev 2 traced it on 2026-10-10.

**Shipped:** `casKeep` hands `casDoc` a fallback made once: the same bytes, as a fresh object on each read. Decision 0205, ledger SCL-030, INVARIANT 0fr amended. **Live** as `b9467b6` (PR #269; production `version.json` read `b9467b6`, built 18:43 UTC).

**Verified:**
- `test/foundations.mjs` passes 106 / 0 on every run. On the old `casKeep` it fails 3: a drifting synthetic fallback, and the real `mutateProfile` with `Date.now` ticking. The second check was suggested by Product Dev 2 through MySet Audit Solutions 1.
- The full suite passes 6,831 / 0, and so did GitHub's `suite` on 301fe97.
- `/api/live` read 0 at the merge.

**Not checked:** whether any live profile already holds a blank version from before the fix. The Studio has no restore door yet (0067's open item), so a blank version is harmless unless the founder restores one by hand.
