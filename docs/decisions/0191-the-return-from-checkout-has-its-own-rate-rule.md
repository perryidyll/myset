---
id: 0191
title: The return from Checkout has its own rate rule at the edge
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/roomsize.mjs]
files: [netlify.toml]
---

## The question

`/api/confirm` is where a phone lands back from Stripe Checkout. It needs no sign-in
(the session id is the ticket) and, to find the session, asks Stripe up to three
times per call (the hinted artist's account, the founder's, then the platform). The
scale audit (PAY-12) noted it had no limit at all: a loop of made-up session ids
spends Stripe's read quota on the artist's account, at no cost to whoever runs it.
The edge rule for `/api/*` (decision 0160) caps one address at 60,000 a minute, which
is sized for polling and does nothing here.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A third Netlify rate rule: `/api/confirm`, 1,000 a minute per address | Nothing; the Pro plan (since 2026-10-03) allows five rules | One redirect | A room bigger and keener than the sizing below sees 429 on the return trip for a minute; the webhook and the bell still deliver every payment |
| B | A token bucket in the function, like the checkout door (0111) | A blob write on every return trip | A limiter document | Costs the return trip of every honest buyer |
| C — do nothing | — | — | — | Stripe's read quota is free for anyone to spend |

## What was chosen, and why

A. The edge refuses before a function runs, so the limit costs nothing and needs no
storage. 1,000 a minute is the busiest buying minute the audit modelled on one wifi —
5,000 phones, a tenth of them paying, each page confirming twice — and holds a script
to about 17 calls a second, so at most about 50 Stripe reads a second.

A refused return trip is not a lost payment: the webhook delivers whatever the phone
does (0138), and the bell retries what the webhook could not.

## What would reverse it

- A real room meeting it. Widen it; never lower it below a room's buying minute.

## How it was verified

`test/roomsize.mjs`: the rule exists, sits above `/api/*`, fits a 5,000-phone room's
buying minute, and holds a script under twenty a second. **Not checked:** Netlify
enforcing it (rate rules apply only on the live site).
