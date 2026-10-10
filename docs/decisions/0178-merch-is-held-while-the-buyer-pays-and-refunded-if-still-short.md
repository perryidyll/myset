---
id: 0178
title: Merch is held while the buyer pays, and a payment that still finds it short is refunded at once
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: money
reverses:
superseded_by:
invariants: [0ir, 0iq, 0fo, 0fp, 0hm]
commits: [623f6ce]
tests: [test/stockholds.mjs]
files: [netlify/functions/_profile.mjs, netlify/functions/pay.mjs, netlify/functions/_pay.mjs, netlify/functions/webhook.mjs, netlify/functions/_ordernote.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, public/shop.html, public/community.html, public/studio.js, public/venue-studio.js, tools/mock.mjs]
---

**The founder has not answered.** His desk offers *Hold for 30 minutes, refund if still short* (recommended) and *Hold for 30 minutes, the artist refunds by hand*. This builds the recommended one, overnight, without his word. It is `proposed` until he picks.

## The question

The scale audit of 2 October 2026 (row "Limited merch can be oversold"): `pay.mjs` checked the count when checkout opened and `redeemSession` took it after payment, with nothing in between and no refund path. Two fans could open checkout on the last tee, both pay, and the artist had one shirt, two orders and two pickup codes. A Checkout Session also stayed payable for Stripe's default 24 hours. The audit's fix: a 30-minute checkout expiry and an automatic refund when short; then hold stock at checkout.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: hold, refund if still short** | Opening checkout holds the quantity until its checkout expires (~31 min); paying takes the stock and lets the hold go; a payment that is still short is refunded in full at once | One small write per merch checkout; one read and the existing write per merch payment | `mhold_<owner>`; `expires_at` on every merch session; `settleShort` | A buyer who sees "1 left" can be told at the tap that someone else is paying for it |
| B — hold, the artist refunds by hand | A, but a short order is only flagged; the artist refunds it in Stripe's dashboard | Less code | The same hold document | The buyer waits on a person; an artist who misses it keeps money for nothing |
| C — expiry and refund, no hold | The audit's first step: checkout expires, a short payment is refunded | The smallest change | `settleShort` | The second buyer pays and is refunded every time the last one is contested — no hold means the refund is the normal path, not the backstop |
| D — reserve by taking the stock at checkout | The count comes down when checkout opens and goes back up when it expires | A profile write (and a kept version, 0067) per tap | An exactly-once release | A release that runs twice mints stock; one that is lost strands it until the artist notices |
| E — do nothing | — | — | — | Two orders for the last one, whenever demand beats stock |

## What was chosen, and why

A, because it is the founder's recommended answer, and because it keeps the one place stock is taken exactly where it was — the paid claim — and adds the hold as an overlay the count is read against, so nothing can ever put stock back that was not there.

- **The hold.** `pay.mjs` takes it last, after every other refusal (so a refused checkout never leaves one): `holdStock` in one compare-and-set on `mhold_<owner>`, on the same counter `takeStock` would take from — the size's own count when it is counting, else the item's (0fo, 0fp). An item nobody counts needs no hold. The row is keyed by an id minted from the tap (`attempt`), so a retried tap finds its own hold and its own clock, and Stripe's idempotency key sees an identical request. The same phone's earlier hold on the same item and size gives way: a buyer who backed out of Stripe's page and tapped Buy again is not blocked by their own first tap. The phone is stored only as a hash (0bu).
- **The clock.** Every merch session gets `expires_at` = the next whole minute plus 31 minutes — between 31 and 32 minutes away. Stripe refuses anything under 30 minutes from creation measured on its own clock, so a margin keeps a slow request or a skewed clock from being refused; the minute rounding gives every retry inside that minute the same figure. A hold counts until its checkout's expiry plus five minutes (`HOLD_GRACE_MS`, for a payment made in the last second and delivered a moment later).
- **A lost event cannot strand stock.** A hold past its time is simply not counted, by every reader, and the next write to the document drops it. `checkout.session.expired` lets the hold go at once — a nicety, not the mechanism.
- **The payment.** In the same compare-and-set that takes the stock, the count less every OTHER live hold must cover the order; this order's own hold is the stock it is paying for. Two payments for the last one meet in that write, so only one can take it. A hold read that fails counts as no holds — that can only refuse the other buyer at their own payment, never sell one item twice.
- **Short.** The order (already written by the claim) is closed at once — `short`, `done` — so nobody hands it over; the payment's marker goes undelivered while the refund is owed; the whole payment is refunded through the account it was paid on (`stripeFor`, 0183), with MySet's application fee returned on a connected account (nothing was sold), under the key `myset-short-<session>`; then the marker is delivered with `lost` and `told` set, so the `charge.refunded` that follows (0177) has nothing new to say. A refund that fails is noted owed and thrown: the webhook answers 500 (0hm), and the bell, Stripe's redelivery and the Studio's sweep all come back to the same refund under the same key.
- **Telling them.** The seats that fulfil orders hear *Sold out before a payment landed* (`{ tab: 'merch' }`, never *New merch order*). The buyer is told on the return page (*Sold out — you've been refunded*, on the shop page and the community page) and by one email to the address on the Stripe session, used once and never stored (0bu).
- **Deletion.** `mhold_<owner>` is in `keysFor` and `keysForVenue`, so an account's deletion removes it.

## What this makes harder

- **The shop page does not show held stock.** A buyer can see *1 left* and a Buy button, and be told at the tap *Someone’s checking out with the last one*. Rule 3 says the page should not offer it; showing it needs the shop's read (`community.mjs`, owned by another session tonight) to read `mhold_<owner>` too — one more read per shop page. The contract: subtract `heldOn(holds, item, key)` (from `_profile.mjs`) from each counted item's and size's count before it is sent.
- **A script can hold stock.** Rotating device ids, it can keep the last few held for half an hour at a time, bounded only by `payAllowed`'s buckets (0111). A per-network cap on live holds is the next step if it is ever seen.
- **Every merch checkout now expires in about half an hour**, where Stripe's default was a day. A buyer who leaves the card page open longer starts again.
- **The artist pays Stripe's fee on an auto-refunded order** (Stripe keeps its fee on a refund); MySet's fee goes back.
- An item the artist marks *Sold out* by hand after a checkout opened is not short: only the count decides. The order stands and the artist decides.
- The cancel page does not let the hold go early (it could expire the session through the API); the hold runs to its clock.
- **New key family** `mhold_<owner>`: the R2 mirror's families need a line (phase two,
  #218 — not on this branch): `[/^mhold_/, 'skip', 'merch held while a buyer pays: half an hour of state, rebuilt by the next checkout (0178)']`.
- `revenue.mjs` lists an auto-refunded order at full price until it subtracts `lost` (the contract in 0177).

## What would reverse it

- The founder picks **the artist refunds by hand**: drop the refund call in `settleShort` and leave the closed, `short` order for the artist; everything else stays.
- Real contention that the overlay cannot answer (a drop of a hundred limited items in a minute): one document per item, or a reservation with an exactly-once release.

## How it was verified

- `node --import ./test/register.mjs test/stockholds.mjs`: 69 ✓, 0 ✗ — the clock (31–32 minutes, the same inside a minute); the short rule against own, other, expired and size holds; the last one held, the next buyer told before the card and no checkout opened, a retried tap given the same hold and clock, a re-tap after backing out not blocked; two left, two holds, a third told; a hold past its checkout giving way with no event; a late payment refunded once, on the right account, its order closed, the holder's payment then landing, the count never below zero, a redelivery and the following `charge.refunded` changing nothing; two hold-less payments racing for the last one leaving one order; `checkout.session.expired` letting the hold go; on a connected account, a refund that fails answering 500, closing the order, owing the payment, and the bell making it with the fee returned and the artist told once; a venue's sizes held on their own counts and released on the venue's account.
- Knock-outs, each red then restored (a count where the run finished; "stops" where a later assertion threw first): no hold (8 ✗, stops), no expiry (1 ✗), holds counting for nothing (8 ✗, stops), a payment's own hold counted against it (6 ✗), holds never running out (3 ✗, stops), a re-tap blocked by its own hold (1 ✗), no short check (12+ ✗), no retry of the owed refund (4 ✗), a short marker left delivered (5 ✗, stops), a short order left open (3 ✗), the expired event ignored (3 ✗), a paid checkout keeping its hold (9 ✗).
- The shop's sold-out return in headless Chrome at 375 px, light and dark, against `tools/mock.mjs ?short=1`: the card reads, no sideways scroll.
- `sh test/run.sh`: exit 0 (see the session note).

**Not checked:** Stripe accepting `expires_at` at 31–32 minutes for real; a real `checkout.session.expired`; a real refund with `refund_application_fee` on a connected account; the buyer's email (mail is not configured in tests); the community page's sold-out card and the venue shop in a browser.
