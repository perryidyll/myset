---
id: 0017
title: Artist transaction fees are 25%, 10%, and 2.5%, with the platform-owner account exempt
date: 2026-09-09
status: decided
decided_by: user
area: money
reverses:
superseded_by:
invariants: [0r0]
commits: []
tests: [test/connect.mjs, test/billing.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/_connect.mjs, netlify/functions/pay.mjs, public/studio.html]
---

## The question

What platform fee should be taken from artist tips, vote packs and merch on each
subscription tier, and should the platform-owner account pay a fee to itself?

## The options

| Option | Fee ladder | Benefit | Cost |
|---|---|---|---|
| **A — chosen** | Free 25%, Plus 10%, Pro 2.5%; platform-owner exempt | A clear subscription/fee trade-off without a circular self-fee | Higher fee than before for every ordinary artist tier |
| B | Keep 10%, 2%, 0% | No customer change | Does not match the requested business model |
| C | Apply the new ladder to every account | One mechanical rule | The platform would charge itself and add accounting noise without moving value |

## What was chosen, and why

Option A. `PLANS[*].cut` remains the single definition. Direct Stripe charges derive
`application_fee_amount` from it and round down to whole cents. The platform-owner
exemption is enforced in the payment path even if that account later connects a
payout account, and the payout status reports the same zero-fee answer.

## What this makes harder

- Pro is no longer the zero-fee tier; every plan explanation must show 2.5% exactly,
  without rounding it to 3%.
- Financial exports must preserve one decimal place for this field.
- Stripe's own processing fee remains separate and still comes from the connected
  artist's side.

## What would reverse it

A later pricing decision, backed by an updated plan ladder and corresponding Stripe,
copy, export and regression-test changes.

## How it was verified

`test/connect.mjs` checks the three source values, whole-cent rounding, the actual
Checkout application fee on all tiers, and the platform-owner exemption.
`test/billing.mjs` confirms artist fees are not altered by the venue fee-sharing rule.

