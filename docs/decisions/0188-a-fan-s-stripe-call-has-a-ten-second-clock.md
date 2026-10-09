---
id: 0188
title: A fan's Stripe call has a ten-second clock
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [0hr]
commits: []
tests: [test/request-payments.mjs]
files: [netlify/functions/_connect.mjs, netlify/functions/pay.mjs, netlify/functions/confirm.mjs]
---

## The question

Every Stripe client in MySet was `new Stripe(key)`, and stripe-node waits 80 seconds
for a request by default. The scale audit (PAY-10) pointed out that this is longer than
a synchronous function lives. In a Stripe brownout a fan pressing Buy, or coming back
from Checkout, waited until Netlify killed the function and got no answer at all — and
every one of those waits held a function open on the busiest night.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `STRIPE_OPTS = { timeout: 10000, maxNetworkRetries: 1 }` on the shared client (`stripeClient`, which `stripeFor` uses) and on the two clients `pay.mjs` and `confirm.mjs` make themselves | Nothing | One constant | A Stripe call that really takes more than ten seconds fails; the page says try again, and the webhook and the bell still deliver |
| B | A clock on every client, including the night's pricing and the books | — | — | Ending a show and pricing it belong to the phase-two session's `_lifecycle`/`_history` change, which sets its own deadline |
| C — do nothing | — | — | — | No answer at all during a brownout |

## What was chosen, and why

A. Ten seconds is many times a healthy Stripe call and well inside a function's life.
One retry on a network error is what stripe-node does by default for idempotent calls;
the checkout create carries an idempotency key whenever the page sent an attempt id.

## What would reverse it

- Evidence of real Stripe calls on these paths taking longer than ten seconds when
  healthy.

## How it was verified

`test/request-payments.mjs` "A FAN’S STRIPE CALL HAS A CLOCK": the client the buy
button builds carries a timeout of fifteen seconds or less. The whole suite:
`sh test/run.sh`, exit 0. **Not checked:** a real Stripe brownout.
