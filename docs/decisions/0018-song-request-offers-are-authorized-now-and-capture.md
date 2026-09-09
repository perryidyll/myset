---
id: 0018
title: song request offers are authorized now and captured only after the song finishes
date: 2026-09-09
status: decided
decided_by: user
area: money
reverses:
superseded_by:
invariants: [0w, 0ab, 0ab1, 0ac]
commits: []
tests: [test/request-payments.mjs, test/connect.mjs, tools/uicheck.mjs]
files: [netlify/functions/_requests.mjs, netlify/functions/pay.mjs, netlify/functions/confirm.mjs, netlify/functions/webhook.mjs, netlify/functions/admin.mjs, public/vote.html, public/studio.html]
---

## The question

An audience member may make an off-setlist song request more compelling by offering
money, but the artist must see the amount before deciding and the fan must not be
charged merely because the request was submitted or accepted. Ordinary request votes
also need to come back when the artist declines.

## The options

Every option that was genuinely on the table, including the one nobody liked. An
option list with only the winner in it is a justification, not a decision record.

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Authorize a whole-dollar offer at request time, add $1-per-paid-vote weight on acceptance, capture only after completion | Manual-capture lifecycle and expiry handling | PaymentIntent id, connected-account scope, webhook/return idempotency, completion hook | A missed completion could leave the authorization uncaptured |
| B | Charge immediately and refund on decline | Simpler payment flow, more refunds and unhappy card statements | Refund lifecycle | Fans are charged for requests that never happen |
| C — do nothing | Keep every request vote-only | No payment complexity | None | Removes the requested incentive and artist-visible offer |

## What was chosen, and why

Use Stripe manual capture. Checkout creates an authorization, not a completed charge.
The artist sees the offered amount. Accepting the request adds the corresponding paid
votes to that song but does not capture. Ending the song, or starting another song
after it, is the completion signal that captures once. Decline cancels the hold and
returns the ordinary request votes. Ending the show cancels any unfinished offer.

## What this makes harder

An authorization is temporary, supported payment methods are narrower than ordinary
Checkout, and a long delay between request and performance can allow the authorization
to expire. Completion now spans voting, request state, song lifecycle and Stripe.

## What would reverse it

Revisit if real shows regularly last beyond card authorization windows, if non-card
payment methods become essential, or if completion cannot be recorded reliably enough
to capture accepted offers.

## How it was verified

`test/request-payments.mjs` verifies 35 request/replay payment assertions: three-vote
birthday defaults, authorization without charge, artist-visible offer, paid-vote
attribution, capture only on completion, decline refund/cancel, webhook idempotency and
show-end release, callback races, stale-show returns and non-Latin request titles.
`test/connect.mjs` verifies the same capture remains scoped to the
artist's connected account. `tools/uicheck.mjs` verifies the payment controls and copy
at phone width. The complete suite is also run before any preview deployment.
