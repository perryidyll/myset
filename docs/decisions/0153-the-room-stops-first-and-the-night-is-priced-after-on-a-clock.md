---
id: 0153
title: The room stops first, and the night is priced after, on a clock — a count Stripe did not finish is flagged and finished later
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: money
reverses:
superseded_by:
invariants: [0ii, 17c, 0ga]
commits: [3111e4c]
tests: [test/endfirst.mjs, test/latetips.mjs, test/stripefees.mjs]
files: [netlify/functions/_lifecycle.mjs, netlify/functions/_history.mjs, netlify/functions/history.mjs, netlify/functions/_register.mjs, public/studio.js, test/stripe-fake.mjs, test/endfirst.mjs]
---

## The question

`endShow` did three things before it flipped the show to "ended": it captured and released the night's request holds (Stripe), it read the fans, and it filed the night — and filing priced the night from Stripe, up to ten pages of a hundred sessions, with no clock. Only then was the show record flipped.

The scale audit of 2 October 2026 named two faults in that order:

- **The room kept voting after End.** Every second Stripe took was a second the show stayed live. A slow Stripe made the End tap slow, and a tap that ran out of time ended nothing, because the flip was the last write.
- **Past a thousand payments the money was cut short with no flag.** The loop stopped at ten pages and filed what it had as `source: 'stripe'` — Stripe's whole answer. A non-connected artist is priced on the platform's own account, whose window holds every artist's payments in those hours, so a thousand is reached long before one artist takes a thousand payments.

The same pricing ran before every fresh start (re-filing the previous night) and on every open of the Money tab, also with no clock.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Flip first. Then release the holds and file the night with a pricing deadline. A count stopped by the deadline, the page limit or a Stripe error part-way is filed `stripe-partial` with a place-marker, and carried on from there by the register's bell and by Re-check until it is whole | A new `source` value; one block on the money record | `moneyForShow({ deadline, resume })`, `priceNight`, `MONEY_PAGES`, `MYSET_MONEY_AT_END_MS` | A reader that treats any source as known shows a short figure — every reader found asks `source === 'stripe'` |
| B | Flip first, and file the night with no pricing; price it only from a scheduled job | The End never touches Stripe | A queue of nights to price | Every night is "money not available" for up to ten minutes; the first-night letter and the Money tab would read an unpriced night |
| C | Keep the order, add a deadline to the pricing | Small | A deadline | The room still votes while the holds are released and the archive writes; a cut-short count is still silent unless flagged anyway |
| D | Raise the page limit | One number | None | Moves the cliff, keeps the silence, and makes the End slower |
| E — do nothing | | | | Rooms that keep voting after End; nights filed short as if whole |

## What was chosen, and why

A.

- **The flip is the first write.** Ending wipes no tally — only a fresh start does (INVARIANT 17c) — so filing after the flip still files the whole night. The archive now reads the fans after the flip, when no more votes can land, which is more exact than before (votes cast while Stripe was being asked used to miss the archive). Whether a calendar night was quiet (0120) is still decided before the flip, because the flip itself gives it back; the fans are read for that only when the night was the calendar's.
- **The holds are released after the flip and before the archive.** After, because no new hold can arrive once the show is not live (`createRequest` refuses, and a late return cancels its own authorization). Before the archive, so a hold captured at End is in the night's money.
- **One clock for the End and the start's re-file:** `MYSET_MONEY_AT_END_MS`, 3,000 ms by default, checked between pages (a slow page can run past it by its own length). The Money tab's load and Re-check get 5,000 ms (`PRICE_MS` in `history.mjs`).
- **A count that stops early says so.** `moneyForShow` returns `source: 'stripe-partial'` with `partial: { after, gte, lte, until, pages }` when it stops with pages left — out of time, out of pages (`MONEY_PAGES`, ten, per ask), or Stripe failing after at least one page. Every reader found (`Biz.join`, the register, the Sheet, the morning-after letter, `tools/actuals.py`) treats anything but `'stripe'` as not known, so a short count shows as "app money not available" with Re-check, never as a short total. The row's paid counts and tips stay unknown (`paidOf`, `tippedOf`), never a short number. A first page that fails is still `stripe-unreachable`, as before.
- **Finished later, from the place-marker.** `priceNight` resumes from `partial.after` with the sums so far and the window it began with, until Stripe says there is nothing left. Callers: the register's bell (`recheckSome`, `PARTIALS_PER_RING` = 2 a ring, whatever the night's age or status, never marked as asked so it comes back until whole; the morning-after late-tip ask waits until then) and Re-check on the night (`reconcileShow` carries a partial on instead of starting again). The scheduler (`autocron`, `_auto.mjs`) was not needed and not touched.
- **Never an older count over a newer one.** The detail is written only if its place-marker is still the one the run started from; a run that finds it moved writes nothing. Each run writes an absolute figure, so the guard is what stops a slow run putting a shorter count back over a finished one. A row left flagged while its detail is whole is put right from the detail.
- **A part never overwrites a whole on the row.** The Money tab's tile figure is written onto the filed row only when it is Stripe's whole answer (`source === 'stripe'`, the existing rule of 0ga), so a tile cut short leaves a whole row alone. The tile carries `partial: true` and the Studio says "Still counting".
- **The Studio** says on a night's page that Stripe has not finished counting and that Re-check carries on.

## What this makes harder

- `money.source` has a fourth value. Anything new that reads a night's money must treat only `'stripe'` as known.
- A partial count is finished over the night's original window (start − 5 min to end + 1 h). A tip that arrives after that is caught by the morning-after ask once the count is whole, or by the Money tab's tile for the newest night — as before.
- A re-check of a whole night that is itself cut short files the night as partial until it is finished (the last ask wins, as it always has; before this it would have filed the short figure as whole).
- The End still waits for the holds to be released (a Stripe call per open hold) before it answers; the room no longer does.

## What would reverse it

- A pricing source with no page limit and an answer in one call (a ledger of MySet's own payments, `_ledger.mjs`), which would make the night's money a read rather than a walk of Stripe.
- Stripe Checkout sessions becoming searchable by metadata, so a night is asked for by its tag instead of by its window.

## How it was verified

- `node --import ./test/register.mjs test/endfirst.mjs`: 45 ✓, 0 ✗. Through the real End tap (`admin.mjs` `status: ended`), the fake Stripe reads the show record each time it is asked: every one of three pages saw "ended". With each page made slow and the clock at 50 ms, one page is read, the night is filed `stripe-partial` at $100 with a place-marker and unknown paid counts; `priceNight` finishes it to $250, 125 packs and 125 tips, 625 bought votes, and the row follows. 1,050 payments: one ask stops at ten pages, flagged; Re-check carries on to 1,050. Two runs from the same marker: one is written. A slow run held inside Stripe while another finishes: it writes nothing, and the night stays whole. Stripe failing after one page: the page is kept and flagged; carrying on while it is still down changes nothing; Re-check finishes it once it is back. Stripe down at End: the show still ends and the night is `stripe-unreachable`. The register's `recheckSome` carries a partial night on, asks for a fold, and does not mark it asked. The Money tab's tile over 1,050 payments says `partial` and the filed whole row is not overwritten.
- Four knock-outs, each red, each restored: the archive moved back in front of the flip (the "room had already stopped" assertions fail); a cut-short count filed as `'stripe'` (eight fail); the place-marker guard removed from `priceNight` (five fail, the slow run puts $200 back over $250); the bell not carrying partial counts on (two fail).
- `test/stripe-fake.mjs` now honours `limit`, `starting_after` and `has_more` on `checkout.sessions.list`, and can be made slow, failing, or watched.
- The neighbouring suites unchanged: `latetips` 19, `stripefees` 29, `everyshow` 121, `autoshow` 180, `limits` 172, `firstgig` 42, `storefail` 35, `e2e` 71.
- **Not checked:** a real Stripe account with more than a hundred sessions in a window; how long a real page with the fee expansion takes (the 3-second figure is a guess sized to the scheduler's seven-second ring); the Studio's two new sentences in a browser.
