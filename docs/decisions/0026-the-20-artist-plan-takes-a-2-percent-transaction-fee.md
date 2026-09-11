---
id: 0026
title: The $20 artist plan takes a 2 percent transaction fee
date: 2026-09-11
status: decided
decided_by: user
area: money
reverses:
superseded_by:
invariants: [0r0]
commits: []
tests: [test/connect.mjs, test/copy.mjs, finance/model-test.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/_connect.mjs, netlify/functions/pay.mjs, public/studio.html, finance/model.html, INVARIANTS.md, STRIPE-CONNECT.md]
---

## The question

What transaction fee should the $20/month artist plan take from direct charges?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Take 2% on the $20/month plan | Reduces MySet revenue by 0.5 percentage points | None | The tier contributes less margin per transaction |
| B | Keep the former 2.5% | Preserves more transaction revenue | None | The product and pricing would not match the requested offer |
| C | Take no transaction fee | Maximizes artist proceeds | A larger pricing and economics change | Subscription revenue may not cover service and support costs |

## What was chosen, and why

Option A. The user explicitly set the $20/month plan fee to 2%. The server plan table
remains the single source of truth; checkout fees, Studio copy, documentation and the
finance model now agree with it.

## What this makes harder

The Pro tier has slightly less transaction margin. The existing financial model remains
the place to reassess the tradeoff as real payment volume becomes available.

## What would reverse it

Revisit only after a deliberate pricing decision supported by actual unit economics.

## How it was verified

The direct-charge suite verifies the 2% plan value and exact application fee in cents;
the copy suite verifies the displayed price; the finance model tests pass. The full
suite completed with 1,876 assertions and zero failures.
