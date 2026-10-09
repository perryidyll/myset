---
id: 0184
title: A paid plan is applied before it is marked synced, grace counts from the failed renewal, and Stripe is asked before a second subscription
date: 2026-10-03
status: decided
decided_by: claude
area: plans
reverses:
superseded_by:
invariants: [0ct, 0dm, 0hm, 0id]
commits: []
tests: [test/billing.mjs]
files: [netlify/functions/_billing.mjs, test/stripe-fake.mjs]
---

## The question

The 2026-10-02 scale audit (money, PAY-9) found three ways plan billing leaked, all
in `_billing.mjs`:

1. **A paid upgrade not applied.** `syncSubscription` wrote the billing record —
   including `lastSyncAt` — and only then wrote the plan onto the registry row. When
   that registry write failed (it is one global document, contended in a sign-up
   spike), the sync looked done. `handleBillingEvent` swallowed the throw, so the
   webhook told Stripe "received", and `maybeSync` would not look again for six
   hours. The artist had paid; every fan payment took the free plan's cut. Decision
   0138 had made `webhook.mjs` let a billing throw through, but each sync inside
   `handleBillingEvent` still had its own `.catch(() => {})`, so nothing ever reached it.
2. **Grace longer than stated.** `past_due` kept the plan until
   `current_period_end + 3 days`. Every page says three days of grace. But when a
   renewal is declined Stripe has already moved the period on: `current_period_start`
   is the renewal that failed and `current_period_end` is a month after it. The grace
   was the whole retry schedule — weeks, not days.
3. **Two subscriptions.** The "already subscribed" refusal read only the billing
   record. An owner who paid in one tab and pressed Upgrade in another before the
   webhook or the return trip landed passed the check and could start a second
   subscription, billed side by side.

The founder's word (2026-10-02): fix everything in the audit's first week, permanently.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Registry first, then the stamp; the webhook's syncs throw. Grace from `current_period_start` once a renewal has failed. `subscriptions.list` on the customer before a subscription Checkout | One Stripe list call per upgrade click by somebody who already has a customer | `currentPeriodStart` on the billing record | A Stripe outage refuses an upgrade click (it would have failed at Checkout anyway) |
| B | Keep the order, add a read-back verify on the registry | Nothing | None | The stamp still lands when the verify fails, and the webhook still answers 200 |
| C | Grace from the latest invoice's creation (`latest_invoice`, expanded) | An expand on every retrieve | A second Stripe object in every sync | None that A does not have; more to read for the same date |
| D | Stop two tabs by expiring the customer's other open Checkout sessions | One list and an expire per click | Session bookkeeping | Not asked for; noted below as the remaining gap |

## What was chosen, and why

A, one fix per leak.

- **The plan lands first.** `syncSubscription` writes the registry row, then the
  billing record with `lastSyncAt`. A registry write that fails throws before the
  stamp: the webhook answers 500 so Stripe redelivers (0138, INVARIANT 0hm), and an
  owner with a recorded subscription is re-synced on the next Studio boot because the
  stamp is old. `handleBillingEvent` no longer catches, and a sync that could not
  read the subscription throws too. Every branch only re-reads Stripe, so a
  redelivery is harmless. The registry and billing writes keep their compare-and-swap.
- **Three days from the renewal that failed.** The field is
  `current_period_start`. `past_due` (and `unpaid`) only ever follows a declined
  *renewal* — a first payment that fails is `incomplete`, not `past_due` — and a
  renewal invoice is raised at the start of the new period, so the start of the
  current period is the moment the card failed. Upgrades use `create_prorations`,
  which adds to the next invoice rather than raising one, so no mid-period invoice can
  make a subscription `past_due`. `latest_invoice` would give the same date at the
  cost of an expand; the start is already on the subscription. A healthy subscription
  still gets the period end plus three days, which covers a renewal whose answer has
  not arrived yet. `billingStatus.graceUntil` uses the same helper (`graceEnd`), so
  the Studio's banner names the same day the plan actually ends. This matches what the
  docs already state — "three days' grace after the period end" meant the period that
  was paid for (overview §2, INVARIANT 0ct); only the code had drifted.
- **Stripe is asked.** Before a subscription Checkout, `startCheckout` lists the
  customer's subscriptions (`status: 'all'`) and refuses with the existing
  `already-subscribed` answer if one is `active`, `trialing`, `past_due` or `unpaid`
  — the same list as the record check, for the reason written there (0dm). It syncs
  the one it found, so the Studio's "change it below instead" leads to a plan that is
  there. An owner with no customer yet has nothing to ask about; the record's answer
  stands. A failed list call refuses the click rather than risk a second subscription.

**Left alone (PAY-14):** `rewardReferrer`'s free month is overwritten by the next
sync for a referrer who already pays. The honest fix is a credit on their Stripe
subscription (a coupon or a customer balance), which is MySet giving money back
through Stripe — not a small, clearly-correct change, and a money decision for the
founder. A referrer on a comp or on Free still gets their month.

## What this makes harder

- A subscription Stripe answers `resource_missing` for is treated as nothing to sync, not an error: it can never succeed, and an error would have Stripe redeliver it for three days.

- A sync that fails inside a webhook now shows as a failed delivery on Stripe's
  dashboard and is retried for up to three days. That is the point; it is also noise.
- A subscription that Stripe cannot find (a test-mode id reaching live) is retried
  for three days instead of being ignored.
- **The race this does not close:** two Checkout pages opened before either is paid
  can both be paid. The list call only sees a subscription once one exists. Option D
  would close it.

## What would reverse it

- The registry becoming per-owner documents: then the order would matter less, though
  "stamp after the work" would still be right.
- Stripe moving `current_period_start` / `current_period_end` off the subscription onto
  its items, which newer API versions do. The pinned `stripe` package (17.x) still
  reads them from the subscription; an upgrade of that package has to re-check this.

## How it was verified

`node --import ./test/register.mjs test/billing.mjs` — 158 passed, 0 failed. New
section "PLAN BILLING DOES NOT LEAK", run through the real webhook and admin handlers:

- with the registry's writes failing, `checkout.session.completed` answers 5xx, the
  plan does not move and `lastSyncAt` stays 0; Stripe's redelivery then lands Pro and
  stamps the sync;
- a renewal declined one day ago keeps Pro until exactly `current_period_start + 3 days`
  and the Studio's `graceUntil` names the same instant; five days in the plan is Free
  and the banner says the grace ran out; a retry that goes through brings Pro back to
  the period end plus three days;
- a second tab's checkout is refused after the first was paid but before the record
  heard, no second Checkout is created, Stripe was asked by customer with
  `status: 'all'`, the record learned the subscription, and the customer holds one
  live subscription; somebody with no customer is not asked about.

Against the old `_billing.mjs` the same file fails seven of those checks (and stops at
the list-call assertion). The whole suite: `sh test/run.sh`, exit 0.

**Not checked:** real Stripe. That a declined renewal's `current_period_start` is the
renewal date is from Stripe's documented behaviour and not observed on MySet's own
account; the first real `past_due` will show it in the billing record.
