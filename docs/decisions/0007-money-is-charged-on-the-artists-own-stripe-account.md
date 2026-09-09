---
id: 0007
title: Every charge is created on the artist's own Stripe account, not on MySet's
date: 2026-09-02
status: decided
decided_by: claude
area: money
invariants: [5b, 5d]
commits: []
tests: [test/connect.mjs, test/billing.mjs]
files: [netlify/functions/_connect.mjs, netlify/functions/pay.mjs, STRIPE-CONNECT.md]
---

## The question

When a fan buys votes or tips, whose money is it on the way through?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Direct charges on the artist's connected account** | Money is legally the artist's; MySet takes a platform fee off the top | Stripe's own ~2.9% + 30¢ is charged to the **artist**, not to MySet | Stripe Connect Express onboarding, per-artist account keys | An artist mistakes the platform fee for the whole cost of taking a card |
| B — destination charges | MySet is merchant of record, holds the funds, pays out | MySet answers the chargeback for a night it did not play, and holds other people's money | payout scheduling, float, disputes | A regulatory and reputational surface MySet cannot staff |
| C — no payments | Simplest | The product has no revenue and the artist has no tip jar | none | No business |

## What was chosen, and why

A, and it encodes an identity: **MySet is not selling the night — the artist is, and
MySet provides the infrastructure.**

**The trade, stated plainly:** on a $5 vote pack a Plus artist pays roughly 45¢ to
Stripe and 10¢ to MySet. The Studio says this before an artist onboards, because
*The platform fee is not the whole cost of taking a card.*

**Nobody takes money until Stripe says so.** The gate is Stripe's own `charges_enabled`,
never a local "they clicked onboarding" flag. Started is not ready.

**Venues are the same flow with a different key** (`v_<venueId>`) and one difference
Perry asked for: Stripe's card fee is **shared evenly**. The application fee is
`max(0, floor(amount × cut) − round((amount × 0.029 + 30) / 2))`, so a $12 item on venue
Pro sends MySet nothing at all, because the fee floors at zero. Artists are not split.

## What this makes harder

- **The founder's own money cannot be separated by account.** Perry's vote packs predate
  Connect, so they sit on the platform account beside every artist's subscription. That
  had to be solved by *tagging* (`kind` and `artist` on the payment intent) rather than
  by account, and a "Your earnings" card built naively on that balance would have read
  other people's subscription payments back to him as income.
- **Money is attributed by tag, never by timestamp.** An early version reported $133 of
  somebody else's business as MySet revenue.
- A payment must have **more than one path to delivery** — the browser return trip, a
  Stripe webhook, and a reconcile sweep — and **claimed is not delivered**: the claim is
  marked undelivered until the votes actually land, so a failure leaves the money owed
  rather than silently settled.

## What would reverse it

Nothing short of Stripe withdrawing direct charges for this shape of platform.

## How it was verified

`test/connect.mjs` inspects the options of every stubbed Stripe call, which is how a
direct charge is *proved* to be direct rather than assumed. It also pins that
`application_fee_amount: 0` is never sent — Stripe treats a zero fee differently from no
fee.
