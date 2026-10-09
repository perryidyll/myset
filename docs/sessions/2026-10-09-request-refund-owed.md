# 2026-10-09 — A declined request's votes owed back (scale audit leftovers)

**Asked:** the founder, 2026-10-09: do every audit item that needs no answer from him. The read-only pass over the audit's sixty findings that morning noted that 0155's failure shape ("Decline + refund" stranding credits) was still open in `resolveRequest`.

**Found:** declining a request gave the votes back in a second write and swallowed its failure; the Studio then said *"from an earlier show"*, which was false, and a second Decline answered *already dealt with*. 0155's song refund inherited the swallow through `declineRequestsForSong`.

**Built (branch `fix/request-refund-owed`, decision 0202, INVARIANT 0je, ledger SCL-025):** `owed` on the row in the decline's own write; `back:<id>` on the fan's `rq` in the refund's own write; `owed` off last; an honest 503; the Live tab's *Votes still owed back* lists requests too; `settleOwedRefunds` finishes them at the End and before a fresh start carries the fans; `declineRequestsForSong` throws while one is owed. 0155's record and INVARIANT 0ik amended.

**Verified:** `test/requestowed.mjs` 52 ✓; four knock-outs red; neighbours green (numbers in the decision record). The first knock-out of the fan mark stayed green, because the clamp at zero hid a second refund; the test now gives the fan other spending.

**Not checked:** a real store failure.
