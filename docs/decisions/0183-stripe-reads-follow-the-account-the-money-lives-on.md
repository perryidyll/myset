---
id: 0183
title: Stripe reads follow the account the money lives on, even while Stripe has paused it
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [0ic]
commits: [b2dbfec]
tests: [test/books.mjs]
files: [netlify/functions/_connect.mjs]
---

## The question

`stripeFor(aid)` scoped a call to the artist's Connect account only when Stripe said
the account could take charges (`chargesEnabled`). Stripe switches that off mid-show
when an account crosses a verification threshold. The scale audit (PAY-8) followed
what happened next: every read fell back to the platform account. Fans who had just
paid could not confirm (`/api/confirm` tried the platform three times and answered
502), the Money tab's sweep found nothing, and the night archived $0 with
`source: 'stripe'`. Only the webhook still delivered.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `stripeFor` scopes by the account id alone; the founder keeps his platform scope until his own account can charge | Nothing | None | A caller that creates a charge through `stripeFor` would charge a paused account — none does; `pay.mjs` checks `connectUsable` itself and fails closed |
| B | A second helper for reads, leaving `stripeFor` as it was | Two names for one idea | One function | Every caller is a read today, so the old meaning has no user |
| C — do nothing | — | — | — | A paused account's night reads as $0 and its buyers cannot confirm |

## What was chosen, and why

A. Every caller of `stripeFor` reads — retrieve, list, statements, balance
transactions — and the money lives on the connected account whether or not Stripe is
letting it take new charges. Charge creation never came through this helper. The
founder's clause stays because his sessions predate Connect and live on the platform.

## What this makes harder

- A future caller that creates money through `stripeFor` must check `connectUsable`
  itself, as `pay.mjs` does. The comment on `stripeFor` says so.

## How it was verified

`test/books.mjs`: an artist with an account whose charges are paused reads on that
account; an artist with none gets the unscoped platform client; the founder with an
unfinished account still reads the platform. The whole suite: `sh test/run.sh`, exit 0.
**Not checked:** a real paused account.
