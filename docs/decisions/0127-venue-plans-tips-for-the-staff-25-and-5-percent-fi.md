---
id: 0127
title: Venue plans: tips for the staff, 25 and 5 percent, five photos, hiding is Pro
date: 2026-09-30
status: decided
decided_by: founder
area: venues
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/billing.mjs, test/community.mjs, test/limits.mjs, test/gigok.mjs, test/sheets.mjs]
files: [netlify/functions/_venues.mjs, netlify/functions/pay.mjs, netlify/functions/_pay.mjs, netlify/functions/_ordernote.mjs, netlify/functions/venueadmin.mjs, netlify/functions/_suggest.mjs, netlify/functions/_warehouse.mjs, public/venue.html, public/venue-studio.js, public/venue-studio.html]
---

## The question

The founder walked the first generated venue page (Sand & Tan, 2026-09-30) and the Venue Studio's plans window, and asked, among other things: "take away the ability to hide posts on the free plan – venues can only hide or delete posts on the pro plan"; "change the transaction fee to 25% on the free plan and 5% on the pro plan"; "the free plan only says 3 photos so let's change that to 5"; "remove the duplicate features on the pro plan card – simply say 'everything in free plus'"; "what's the 'coming soon, included' mean on the pro plan card..? a tips feature for the staff should already be included and made very visible"; "add a suggestions/feedback button as well somewhere near the bottom"; "remove the sample testimonial cards at the bottom of the plans pop up window".

Tips for the staff had never been built: the card said "Coming soon", `tips` sat in `VENUE_NOT_BUILT`, and `pay.mjs` refused anything but merch for a venue. The Free fee (10%) could never be charged, because Free has no merch.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Staff tips built, on both plans; 25% Free, 5% Pro; five photos Free; hide/delete Pro; Pro card lists only what it adds; testimonials gone; a Suggestions & feedback sheet | A money path for venues | `kind: 'tip'` on the venue checkout, `tipsOn`, `moderate`, `_suggest.mjs`, a Sheet tab | A venue takes tips before it has thought about how its team shares them |
| B | Tips on Pro only | Nothing on Free | The same | The Free 25% is again a fee on nothing |
| C | Words only: drop "Coming soon" | Nothing | Nothing | The founder asked for tips to be real and visible |

## What was chosen, and why

Option A. The one call beyond the founder's words: **tips are on both plans**, the artist ladder's shape (Hobbyist artists take tips at 25%), so the Free fee is a fee on something real; Pro lowers it to 5%.

- `VENUE_PLANS`: `photos` 5 / 12, `cut` 0.25 / 0.05, `tips` true / true, `moderate` false / true. `VENUE_NOT_BUILT` is `['speakerVotes']`.
- **Staff tips.** `pay.mjs` takes `kind: 'tip'` on `?v=`: $1–$500, a direct charge on the venue's connected account with the plan's fee (Stripe's shared, `feeCents`), back to `/v/<slug>?paid=`. `redeemSession` writes it to the venue's own `meta.tips` exactly as an artist's; the fresh claim pushes the venue's phones (`tellVenueTip`, `{ tab: 'merch' }`). `shapeVenue` sends `tipsOn` (cards on AND the plan has tips), the one gate the page and the server share.
- **The venue page** draws a glowing **Tip the staff** bar under its buttons while `tipsOn`, with the community page's tip sheet; the return trip is verified by `/api/confirm?v=` (INVARIANT 6) and a lost one is retried on the next open.
- **The Venue Studio**: a *Tips for your staff* section first on the Merch tab — this month, the count, all time, the last ten with their notes, never who — from `payStatus`. The Numbers tab's "Coming soon" card is gone.
- **Hiding or deleting a post is Pro** (`moderate`). Showing a post hidden before stays open on every plan, so nothing is stuck. Free venues see a locked **Hide · Pro** that opens the plans.
- **The plans window**: Free lists everything; Pro opens with **Everything in Free, plus:** and lists only twelve photos, merch, hide or delete, the tick and the 5% fee. The testimonial placeholders and their styles are gone. **Suggestions & feedback** at the bottom opens a sheet; `venueadmin suggest` (any seat) keeps it in the `suggest` document (newest 300, ten a day per venue), pushes the founder, and the Sheet gets a **Suggestions** tab.

## What this makes harder

- A venue's tips land in its Stripe account; how the team splits them is the venue's business, and the Studio says so.
- A Free venue that hid posts before today can still show them again but not hide new ones.

## What would reverse it

- Venues asking for tips off their page: a switch in the Studio.
- The 25% keeping Free venues from switching cards on.

## How it was verified

- `test/billing.mjs` (130 ✓): a Pro venue's page offers Tip the staff; the checkout is on the venue's account, as a tip, with the 5% fee, back to the page; $0.50 is refused; the return trip redeems it; the Studio lists the amount and the note and never the fan; Free keeps tips at the 25% fee.
- `test/community.mjs` (289 ✓): a Free venue cannot hide or delete; Pro hides; back on Free a hidden post can be shown.
- `test/limits.mjs` (172 ✓): the plan table's numbers; only `speakerVotes` is unbuilt.
- `test/gigok.mjs`: a suggestion is kept with who sent it and their plan; empty refused; ten a day.
- `test/sheets.mjs`: thirteen tabs.
- Localhost at 375 px: the tip bar and sheet, the Studio's tips section, the locked Hide, both plan cards, Suggestions & feedback sent.
- Not checked: a real card through a venue's tip on production.
