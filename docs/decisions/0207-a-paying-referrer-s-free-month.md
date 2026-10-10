---
id: 0207
title: The referral month is a month of Bar Star for a Hobbyist — a referrer who already pays is owed nothing, and the Studio says so
date: 2026-10-09
status: decided
decided_by: perry-confirmed
area: money
reverses:
superseded_by:
invariants: []
commits: [80cc05a]
tests: []
files: [public/studio.js, netlify/functions/_plan.mjs]
---

## The question

When an artist you invited goes paid, `rewardReferrer` (`_plan.mjs`) adds thirty days to your `planUntil` and, if you are on Hobbyist, moves you to Bar Star for them. For a referrer already on a paid plan the next billing sync (decision 0184: the plan is written from the subscription) overwrites that `planUntil`, so they get nothing — and the Studio's "Invite another musician" card never said what the reward was, so nobody could tell.

The scale audit's week-one pass found it (PAY-12). The founder's desk card offered a credit on the next invoice (money back: one month's plan price, $10 or $20) or leaving it; he took the recommendation, "leave it", on 2026-10-09.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The free month is for Hobbyists only, and the card says so in one sentence | Nothing | One line of copy | A paying referrer reads it and feels short-changed; the sentence is there so nobody is surprised |
| B — a credit on the next invoice | Stripe takes one month's plan price off the referrer's next bill | $10 or $20 per paying referrer per referral | A Stripe customer-balance write from `rewardReferrer`, a line in the books | Money leaves on a code path nobody has watched; a refund-shaped surprise in the accounts |
| C — extend the paid plan by a month | Move the subscription's next billing date | The same money, later | A subscription update from `rewardReferrer`, and 0184's sync must learn to keep it | The sync and the reward fighting over `planUntil` |

## What was chosen, and why

A. The reward's purpose is to bring a working musician onto a plan, and a Hobbyist is the one it moves. Giving money back to someone already paying is a pricing decision the founder has not made, and it would be the first automatic money-out path in MySet apart from refunds; he chose not to open it today. The card under Invite another musician now reads: *"When someone you invited goes paid, you get a month of Bar Star on us — while you're on Hobbyist."* `rewardReferrer` is unchanged: a paying referrer's `planUntil` still gets the thirty days and the sync still takes them back, which is harmless and keeps the code one line shorter than a special case would.

## What this makes harder

- Nothing in the code. The sentence is a promise that must stay true: a change to `rewardReferrer` changes the copy in the same commit.

## What would reverse it

- The founder deciding a paying referrer earns a credit (B): then `rewardReferrer` writes a Stripe customer balance and the books get a line, and the sentence changes.

## How it was verified

- The Studio on the deploy preview shows the sentence under Invite another musician at phone width; `node tools/stamp.mjs` re-stamped `studio.html`.
- **Not checked:** a real referral going paid (no Stripe in previews).
