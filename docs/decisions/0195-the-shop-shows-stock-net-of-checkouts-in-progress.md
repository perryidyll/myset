---
id: 0195
title: The shop shows stock net of checkouts in progress
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [0ad, 0fo, 0fp, 0gg]
commits: [28ff11b]
tests: [test/community.mjs]
files: [netlify/functions/community.mjs, public/shop.html]
---

## The question

Decision 0178 holds limited merch while a buyer is on Stripe's page (`mhold_<owner>`) and refunds a payment that still finds it short. It left the shop page reading the raw count: a fan could see *1 left* and a Buy button, then be told at the tap *Someone's checking out with the last one*. That is a button that leads to a shrug (rule 3, INVARIANT 0ad). 0178 wrote the contract for the half it could not build: the shop's read subtracts `heldOn(holds, item, key)` from each counted item's and size's count before it is sent.

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen: net count plus `held`** | The shop's read sends each counted item's and size's count less live holds, and `held` (how much of what was there is held) | One read of `mhold_<owner>` per shared-read miss, only when something is counted | A copy up to a minute old: the tap still refuses (0178) |
| B — net count only | The contract, nothing more | The same read | A held-out item reads *Sold out — ask about a restock*, which is false: it comes back if the buyer does not pay |
| C — leave the page as it is | — | — | The Buy button the server refuses, every time the last one is contested |

## What was chosen, and why

A. It is 0178's contract, plus one field so the page can tell the truth about *why* something reads sold out.

- **The server** (`community.mjs`, the GET branch only — POSTs never read it). `netOfHolds(merch, holds)` uses `heldOn` from `_profile.mjs` against the same counter `takeStock` and `holdStock` use: the size's own count when it is counting, else the item's (0fo, 0fp). The count goes out as `stock - held`; `held` is set only when it is above zero, and never more than the count — a hold on stock a hold-less payment already took is headed for a refund, not back to the shelf, so that reads plain *Sold out*. An expired hold counts for nothing, as with every other reader. Reads only: `pay.mjs` alone writes the hold document.
- **The cost.** The holds are read only when an item or a size on the page is counted (an uncounted item is never held), beside the reads already in flight. A read that fails counts as no holds — the page then shows the raw count and the tap refuses as before (rule 1: the shop never breaks over a nicety).
- **Still cached.** The shared read stays on the edge (30 s, stale 30 more, decision 0093): nothing in it is personal (0gg). A hold opened or released in the last minute can be missed; the hold runs for over thirty minutes, so the shop is right for almost all of it, and pay.mjs remains the referee.
- **The page** (`shop.html`). The existing count logic (*Only 2 left*, the quantity cap, sold out at zero) reads the net count unchanged. A count at zero only because of holds is *Sold out for now* on the card and the More strip, and the sheet says *Sold out — check back in a few minutes. Someone's checking out with what's left; if they don't pay, it comes back within half an hour.* — honest about the worst case (a hold lasts up to its checkout's 31–32 minutes plus five of grace). A held size is struck out like a sold-out one and tells a screen reader *held by someone checking out*. When the tap meets a hold the copy did not show yet, the page counts it held rather than marking it out for good.
- **Not the artist page.** Its merch card shows no counts and no Buy; 0178's contract named only the shop's read. The community page's shop card shows only the number of items.

## What this makes harder

- **The Studio and the shop now disagree on purpose.** The Studio's list shows the real count (3); the shop shows what a fan can buy (2). The Studio does not yet say *1 held*.
- **A held-out item tells the room someone is paying.** Nothing personal — no device, no name — but it is a new fact on a public read.
- The venue shop reads the same path (`v_<vid>`) and is covered by the code; it was not looked at in a browser.

## What would reverse it

- 0178 reversed (no holds): `netOfHolds` returns the list untouched when the document is empty, so nothing breaks; drop it and the `held` wording with it.
- Shop traffic where the extra read on a cache miss matters: fold the holds into the profile document, or cache them separately.

## How it was verified

- `node --import ./test/register.mjs test/community.mjs`: 306 ✓, 0 ✗. New section *HELD STOCK ON THE SHOP*: the count as saved with nobody paying; one held → 2 left and `held: 1`, on the shared read too, still edge-cached; the Studio still shows 3; all held → 0 and `held: 3`, the server refusing a third the same way; an expired hold still on the document but not counted; a size's hold coming off that size alone; a hold on stock already gone reading plain sold out; no holds read for a page with nothing counted, one for a page with a count.
- Knock-outs: the netting removed (4 ✗); `held` not capped at the count (1 ✗).
- `sh test/run.sh`: exit 0.
- The shop at 375 px in the Claude browser pane against `tools/localhost.mjs` (founder page, counted items seeded through the admin API, holds opened through the real `pay.mjs` path): *Only 2 left* on a 3-count tee with one held; *Sold out for now* on a 1-count poster whose one is held, its sheet with the check-back line and only Close; a hoodie with S held, struck out and announced as held, M buyable; a 0-count sticker reading plain *Sold out*; no sideways scroll.

**Not checked:** the edge cache's real behaviour on Netlify; dark mode; the venue shop in a browser.
