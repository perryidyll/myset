---
id: 0100
title: The founder's tools need the founding page's owner seat on Media Dash and in the Studio too
date: 2026-09-28
status: decided
decided_by: claude
area: auth
reverses:
superseded_by:
invariants: [0gk]
commits: [7a84cb7]
tests: [test/founderseat.mjs, test/verification.mjs]
files: [netlify/functions/mediadash.mjs, public/studio.js, public/studio.html, test/founderseat.mjs, test/verification.mjs, test/run.sh, tools/mock.mjs, INVARIANTS.md]
---

## The question

Decision 0099 (`04e78db`, which landed while this change was waiting to ship) made the platform block in `admin.mjs` ask for `isPlatformOwner(aid)` and the owner role. It left out, on purpose, two more places that ask which page instead of who:

1. **The Studio** draws the founder's cards on `PLAN.owner`, which `planGet` sets from `isPlatformOwner(aid)`. A member or crew seat on the founding page therefore sees cards whose calls the server refuses since 0099, and each card misreads the refusal. The codes card reads "None yet." over a *Create code* form that is refused, the venues card reads "No venues have signed up yet.", and the sheet card reads "Could not ask the server.". MySet's books (already `OWNER_ONLY`) shows "Reading the balance…" and never finishes. Every Studio open also sends `promoList` and `venueList`, and both are refused.
2. **Media Dash.** `isFounder` in `mediadash.mjs` was `me.aid === DEFAULT_ARTIST` and nothing else. So a member or crew seat on the founding page could log a boost row on the public `/mediadash` dashboard, overwrite the founder's row by reusing its `boostId`, or remove it.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A `founder()` helper in `studio.js` (`PLAN.owner` and the owner role), used only where the founder's tools are drawn or loaded. `PLAN.owner` keeps its meaning. `isFounder` in `mediadash.mjs` also asks for the owner role. | One helper, eight call sites and one condition. | A test file, which includes a tripwire. | A later founder card gated on `PLAN.owner` would repeat the slip. The tripwire catches a founder call sent from a function it does not know. It cannot catch an old helper drawn on a new card. |
| B | Change `PLAN.owner` on the server to mean the founder's owner seat. | One line. | None. | `PLAN.owner` is also the founding page's plan-lock bypass (`has()`, `canHide()`, the seat cap). The server grants that bypass by page (`isPlatformOwner` in the setlist, pricing and moderation checks), so band mates would see paid features greyed out that the server still allows them. The page would be wrong in the other direction. |
| C | Send a second flag from `planGet` (say `founder`). | A server change as well as the page change. | Two flags that must agree with the gate. | Two answers to one question, which can drift apart. `PLAN.role` is already in the payload. |
| D — do nothing | — | — | — | After 0099, the cards keep misreading refusals. Until this ships, a band mate or the sound engineer can rewrite the public boost log. |

## What was chosen, and why

A, as the founder's brief set it out. The helper reads `PLAN.role`, which `planGet` already sends, and it is used only at the founder's tool sites. `PLAN.owner` is left alone because every seat on the founding page is owed that page's plan, and the server gives it to them by page.

The agent's calls inside the brief:

- **The bug list is now hidden from every other artist too.** `bugCard` had no gate at all, but `bugList` has always been the founder's on the server: it sits in the platform block, and each report (0029) carries every room's server errors. On every other page, "If something broke" opened "Nothing reported", even when that artist's own fans had filed reports (`saveBug` keeps them under each artist's own key). Hiding the card follows rule 3: never offer what the server refuses. Whether artists should read their own fans' reports, without other rooms' errors, is a product call and is left open.
- **Text that only changes wording stays on `PLAN.owner`.** Three places word things differently on the founding page: the Stripe-key sentence in *All payments* and *Where it came from*, and the backup line in the studio-code sheet. Each is true for any seat on that page, and none of them calls anything.
- **Media Dash needed only the server change.** The page's own door is `x-admin-code`, either the recovery key or the founding page's studio code, and `requireArtist` treats both as the owner. The page never sends a Bearer token, so nothing on the page changes.
- **`test/verification.mjs` checked for the name `PLAN.owner` in `flagCard`.** Its point was that the card is hidden from everyone else. It now checks for `founder()`, and checks that `founder()` reads `PLAN.owner`.
- **The mock learned two states: `?founder=1` and `?seat=member|crew`.** The founder's tools answer any other seat with the server's 401 or 403. `ledger` is refused to a seat that is not the owner. `planGet` strips the renewal date, the portal and the card's state from a non-owner (0dc), so the member view in the mock matches myset.vip.

## What this makes harder

- A new founder tool must use `founder()`, not `PLAN.owner`. The tripwire in `test/founderseat.mjs` reads the founder's actions out of `admin.mjs` and names any that the Studio sends from a function outside its list.
- Every artist other than the founder loses "If something broke" on the Money tab. It never worked for them.
- The Studio stops offering the founder's tools to a band mate. The server has refused those calls since 0099.
- Found on the way and not fixed here. A member seat on any page sees *Your earnings* read its `OWNER_ONLY` refusal of `ledger` as "Nothing to add up yet — this fills in once card payments are on and somebody has paid.". The same seat is shown *Got a code?* (`promoRedeem` is owner-only) and the *Add* field under *Who can sign in*. These are the owner's controls (0dc, 0db), not the founder's, and belong in their own change.

## What would reverse it

- The founder deciding that band mates on the founding page should run the platform tools. 0099's gate and `founder()` would then move together, for example to a capability in `_session.mjs`.
- A second page ever needing a founder-like role. At that point, option C (a flag from `planGet`) is cleaner than reading the role in two places.
- Artists getting a bug list of their own: their fans' reports, without the platform's errors. `bugCard` would then open for the owner seat instead of `founder()`.

## How it was verified

The tests were written first and run red against origin/main `45a8d07` with only the test added. `node --import ./test/register.mjs test/founderseat.mjs` printed `10 passed, 18 failed`. Member and crew seats each got 200 for a new row, for overwriting the founder's row `b1`, and for removing it (`{"got":200,"want":401}` six times). The founder's row ended removed (`{"got":[null,true],"want":[20,false]}`), and the public read carried `["member-row","crew-row"]` where it should have carried `["b1"]`. All nine Studio checks failed.

After the fix, the file printed `28 passed, 0 failed`. The first full run stopped at the old `flagCard` check in `test/verification.mjs` ("flagCard must gate on PLAN.owner"), as it should have. With that check updated, `sh test/run.sh` exited 0 with 3,841 assertions and none failing. On a scratch copy of this tree with 0099's uncommitted `admin.mjs`, `test/accounts.mjs` and `test/structure.mjs` applied on top, the whole suite also passed: exit 0, 3,898 assertions, 0 failing. The two changes share no code. 0099 then landed first (`04e78db`, PR #117). With this change merged onto it, `node tools/overview.mjs --tests` ran the whole suite again: 3,898 assertions, 0 failing.

The Studio checks were mutation-tested on `studio.js`, which was restored byte for byte afterwards (stamp `219d2fe4`). Four mutations each turned the file red and named the fault: a new function (`peekBugs`) sending `bugList`; the codes block put back on `PLAN.owner`; `founder()` without the role half; and `has()` changed to use `founder()`.

In a real browser with `tools/mock.mjs` at 375×812, the Studio served `studio.js?v=219d2fe4`:

- **The founder's own seat** (`?founder=1`): Settings showed *Waiting for you · 1*, *Trying things out*, *Your Google Sheet*, *Codes you hand out* (two codes and the *Make a code* form) and *Venues*. Money showed *MySet's books* and *If something broke*. The server log showed `promoList`, `venueList`, `idQueue`, `sheetStatus` and `books` sent.
- **A member** (`?founder=1&seat=member`): none of those headings appeared on Settings or Money. `PROMOS`, `VENUES`, `SHEET`, `IDQ`, `FLAGS_D` and `BOOKS` all stayed `null`. After a marker in the server log, the only admin calls were `pushKey` and the member's own `ledger`. The network list held no 401.
- **Crew** (`?founder=1&seat=crew`): the same as a member.
- **An ordinary artist's Money tab**: neither *MySet's books* nor *If something broke* appeared.

Live as `7a84cb7` (PR #118): Netlify's production deploy `6ab9f51f` was ready at 05:04 UTC on 28 September, the `mediadash` bundle changed, and myset.vip serves `studio.js?v=219d2fe4` with `founder()`. An anonymous POST to `/api/mediadash` answers 401. Not checked: a signed-in member or crew seat on production, a physical phone, and production's registry of seats on the founding page.
