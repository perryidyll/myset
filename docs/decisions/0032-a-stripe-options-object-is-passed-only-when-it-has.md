---
id: 0032
title: A Stripe options object is passed only when it has something in it
date: 2026-09-11
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [0fc]
commits: [210683d]
tests: [test/billing.mjs, test/connect.mjs, test/books.mjs]
files: [netlify/functions/_connect.mjs, netlify/functions/_history.mjs, netlify/functions/revenue.mjs, netlify/functions/_ledger.mjs, netlify/functions/_requests.mjs, netlify/functions/pay.mjs, test/stripe-fake.mjs]
---

## The question

Every night archived from 2 Sep to 11 Sep 2026 said its money was `stripe-unreachable`,
including nights after the Stripe key had been replaced and verified live. The archive's
lookup passed the connector helper's options object — `{}` for an artist on the platform
account, which is the founder — to `stripe.checkout.sessions.list`, and stripe-node
treats a trailing object as options only when it carries a key it recognises; an empty
one is "Stripe: Unknown arguments", thrown before any request. The Studio's Money tab,
the books' balance pull, three request-hold cancels and the founder's own checkout
(when the phone sends no attempt id) shared the shape. The test double swallowed `{}`,
so fifty tests had never seen it.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: spread the options or nothing** | `scope(opts)` returns `[opts]` or `[]`; call sites write `...scope(opts)` | One helper, seven call sites | None | A new call site forgets it — the fake now throws exactly as the library does, so the suite catches it |
| B — make `stripeFor` return `undefined` | No object when there is no account | Every consumer that spreads or reads `opts.stripeAccount` has to null-check | Many small edits | A missed consumer throws on `undefined` instead |
| C — always pass a harmless known key | e.g. `{ maxNetworkRetries: 0 }` | Changes retry behaviour everywhere | None | Silent semantic change on every call |
| D — do nothing | — | No night can ever read its money; the Money tab and the books stay blind; held requests cannot be released | — | The room-money sample on the model stays at one night for ever |

## What was chosen, and why

**A**: the smallest change that makes the empty case impossible at the call site rather
than at every consumer, and the fake was made strict so the class of bug cannot return.
`retrieve` tolerates `{}` and was left alone.

## What this makes harder

Nothing meaningful. A reader has to know why `...scope(opts)` is there; the helper's
comment and INVARIANT 0fc say why.

## What would reverse it

stripe-node accepting an empty options object (a documented behaviour change), or the
platform-account path going away when every artist is on Connect.

## How it was verified

Reproduced locally against stripe-node: `list(p, {})`, `create(p, {})` and
`paymentIntents.cancel(id, {}, {})` throw "Unknown arguments"; `retrieve(id, {})` and
`list(p, ...[])` reach the network. `./test/run.sh` with the strict fake: the founder's
checkout test went red on the untouched `pay.mjs` site, green after the fix; 38 files,
0 failures. NOT verified: a production night archived with the fix (the next gig will
be the first); Wednesday 9 Sep's takings have not been re-read from Stripe.
