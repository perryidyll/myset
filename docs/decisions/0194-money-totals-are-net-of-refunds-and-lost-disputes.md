---
id: 0194
title: The Money tab, the stats and the night's log count money net of refunds and chargebacks
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [0iq]
commits: []
tests: [test/delivery.mjs, test/metrics.mjs]
files: [netlify/functions/revenue.mjs, netlify/functions/_metrics.mjs, netlify/functions/_evlog.mjs, netlify/functions/venueadmin.mjs, public/studio.js, public/venue-studio.js]
---

## The question

Decision 0177 records what a refund or a chargeback took back on the payment's marker
(`meta.paid[sid].lost`, cents) and on the tip and order rows, and set the rule:
anything that sums money subtracts `lost`. It fixed the night's money, tonight's tips,
the tipper set and the register, and named the readers it left at face value:
the Money tab's payment list (`revenue.mjs`), current show stats (`_metrics.mjs`), the
night's event log (`_evlog.mjs` `moneyEvents`), the venue Studio's tip list and the
warehouse export. A refunded $15 tip still read $15 on the artist's Money tab and in
its totals.

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen: net amounts, gross kept beside** | Each reader subtracts `lost`; the Money tab's row keeps `gross` and carries `lost`, `refunded`, `dispute` | A few lines per reader | None new: `lost` is already capped at what was paid |
| B — a separate "refunds" line under the totals | Totals stay gross, a refund line follows | A second figure the artist has to subtract themselves | The headline figure is still money MySet does not hold |
| C — leave them | — | — | The Money tab over-counts every refund and chargeback |

## What was chosen, and why

A, because it is 0177's rule applied to the readers it named. It is the same under any
of 0177's three options: each one writes `lost`.

- **The Money tab (`revenue.mjs`).** Each row's `amount` is `(amount_total − lost) / 100`;
  `gross` is the original charge in dollars; `lost` and `refunded` are cents, the same
  unit as every other `lost` (marker, tip row, order row); `dispute` is the status
  string, `''` when there is none. `lost` is capped at the charge. `totals` sum the net
  amounts; `count` still counts every row, because a refunded payment is still listed.
- **The Studio's row** says what happened with the order list's own words (`lossNote`):
  *$5 refunded*, *Disputed*, *Dispute won*, plus *was $15.00* while anything went back.
  The donut under it reads the same net totals.
- **Current show stats and the night's event log.** Money is net; a payment gone in
  full is left out, as `moneyForShow` and `tipsTonight` already do.
- **The venue's tip list (`venueadmin.mjs` `payStatus`).** Totals and counts are net and
  leave out a tip gone in full; the recent list still shows it, at what is left, with
  *$x went back*.

## What this makes harder

- **Still at face value:** `_warehouse.mjs` lines 523–524 (`packs` from `meta.paid`,
  `tips` from `meta.tips`), counted at lines 550–551 — a pack or tip refunded in full
  is still counted there. Another session owns that file. Its dollar column
  (`m.gross`, line 380) comes from `moneyForShow` and is already net.
- **Also face value, not in this change:** `stage.mjs` line 63 (`allTime`, the stage's
  all-time tips) and `_lifecycle.mjs` `nightPaid` (the discard warning's money line).
- The Money tab has no charge expansion, so a refund that reached Stripe but never
  reached the webhook is not seen there; `moneyForShow` also reads the charge's own
  `amount_refunded` and is the better figure for a night.

## What would reverse it

The founder asking for gross figures with refunds as their own line (option B).

## How it was verified

- `node --import ./test/register.mjs test/delivery.mjs`: a $15 tip with `lost: 500,
  refunded: 500` reads $10 on its row, `gross` 15, the flags carried, `totals.all` and
  `totals.tips` $5 less and equal to the sum of the rows; a chargeback on the rest reads
  $0 with `dispute: 'needs_response'`; a `lost` larger than the charge reads $0.
- `node test/metrics.mjs`: `artistPart` money and `moneyEvents` are net, a payment gone
  in full is left out.
- `sh test/run.sh`: exit 0.

**Not checked:** the venue tip list has no test of its own; a real refund event on a
real account.
