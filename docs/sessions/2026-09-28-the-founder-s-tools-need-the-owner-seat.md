# 2026-09-28 — The founder's tools need the owner seat, on Media Dash and in the Studio

**Asked (the founder):** decision 0099 made the platform block in `admin.mjs` require `isPlatformOwner(aid)` and the owner role, and left out two gaps of the same kind. Close them:

1. The Studio shows the founder's Settings tools on `PLAN.owner`, which describes the page, not the person. Add a `founder()` helper that also reads `PLAN.role`, and use it only at the tool sites. `PLAN.owner` keeps its meaning, because it also drives the plan-lock bypass.
2. `isFounder` in `mediadash.mjs` checks the page only. Add the owner role, with a test.

Write failing tests first, fix narrowly, run the suite, write the record, and check it in a browser at phone width. No commit or push.

**Where 0099 stood:** not shipped. It was uncommitted in another worktree (`fix/admin-role-gates`) and had not changed in the 18 minutes before the docs were written. This branch (`fix/founder-tools-owner-seat`) is cut from origin/main `45a8d07`. That is why this is a new record (0100) and a new invariant (0gk) beside 0099's 0gj, not an amendment to 0099.

**Built (decision `0100`, ledger ACC-005):**

- `mediadash.mjs`: `isFounder` also asks for `(me.role || 'owner') === 'owner'`. The page's own door, `x-admin-code`, is always an owner door, so the page itself did not change.
- `studio.js`: `founder()` gates `flagCard`, `sheetCard`, `idQueueCard`, `bugCard`, the codes-and-venues block, `booksCard`, the books read in `loadLedger`, and the `promoList`/`venueList` auto-load. The stamp is now `219d2fe4`.
  - `bugCard` had no gate at all. Every other artist's "If something broke" opened "Nothing reported", because `bugList` has always been the founder's. It is now hidden for them too.
  - `PLAN.owner` is unchanged in `has()`, `canHide()`, the seat cap and three places that only change the wording.
- Tests: `test/founderseat.mjs`, which is new and is added to `run.sh`. It is the first test of `/api/mediadash`, it holds the Studio's static checks, and it has a tripwire that reads the founder's actions out of `admin.mjs`. `test/verification.mjs`'s `flagCard` check now looks for `founder()`.
- `tools/mock.mjs` learned `?founder=1` and `?seat=member|crew`. For any other seat it answers the founder's tools with the server's 401 or 403, refuses `ledger`, and strips `planGet`'s billing fields, as 0dc does.
- INVARIANT 0gk.

**What broke on the way:** `test/verification.mjs` checked for the name `PLAN.owner` in `flagCard` and went red, as it should have. Its intent was that the card is hidden from everyone else, and that still holds, so the check was updated.

**Verified:**

- Failing first: `test/founderseat.mjs` printed `10 passed, 18 failed`. A member and a crew seat each got 200 for a new boost row, and for overwriting and removing the founder's row. The founder's row ended removed, and the public read carried two rows from other seats.
- After the fix: `28 passed, 0 failed`. `sh test/run.sh` exit 0, with 3,841 assertions.
- On a scratch copy with 0099's uncommitted code and tests applied as well: exit 0, 3,898 assertions.
- Mutations on `studio.js` (restored byte for byte afterwards) each went red: a new function sending `bugList`, the codes block back on `PLAN.owner`, `founder()` without its role half, and `has()` changed to use `founder()`.
- Browser: the mock at 375×812.
  - The founder's own seat saw every card, and its calls went out.
  - A member and crew saw none of them, sent none of their calls, and hit no 401.
  - An ordinary artist's Money tab has no books and no bug card.

**Not checked:** a signed-in member or crew seat on production, a physical phone, and production's registry of seats on the founding page.

**Found, not fixed (owner-only, 0dc/0db, not a founder tool):** a member seat on any page sees *Your earnings* read its `ledger` refusal as "Nothing to add up yet". The same seat is shown *Got a code?* and the sign-in *Add* field, which only the owner can use.

**Shipped:** live as `7a84cb7` (PR #118). 0099 landed first (#117, then its live-docs #119), and `1385b2b` (#120) landed while this was in review. The branch was merged onto each, with `INVARIANTS.md` resolved as 0gj then 0gk and the whole suite re-run on the merged tree: 3,915 assertions, 0 failing. Live as `7a84cb7` (PR #118): Netlify's production deploy `6ab9f51f` was ready at 05:04 UTC on 28 September, the `mediadash` bundle changed, and myset.vip serves `studio.js?v=219d2fe4` with `founder()`. An anonymous POST to `/api/mediadash` answers 401. Docs: ledger ACC-005, and Puzzle changelog 2431 (steps e06, y07 and i06, each reloaded from its sheet).
