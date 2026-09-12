---
tab: Money
section: How a payment divides (the fee ladder and the split)
puzzle_section_id: 41971
sources:
  - netlify/functions/_plan.mjs (PLANS[*].cut, splitFee), _connect.mjs (stripeFeeEstimate, feeCents), _feesplit.mjs (settleSplit), pay.mjs
  - MYSET-MASTER-OVERVIEW.md §2.1 (the ladders), §4.2, §4.4, §4.5
  - ACCOUNTS.md §3 (the fee split), §8 (the exact split)
  - ACCOUNTING.md § The same payment read from both sides
  - docs/decisions/0007, 0017, 0026
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_feesplit.mjs header and settleSplit; webhook.mjs charge.updated branch)
---

# How a payment divides (the fee ladder and the split)

**Who:** the server, at checkout and again when Stripe reports the real card fee. **Trigger:** any direct charge on a connected account. **Outcome:** the artist or venue keeps the money on their own Stripe account; MySet's application fee is taken off the top by the plan's cut; for venues, half of Stripe's card fee is given back exactly, once the real fee is known.

The percentages, prices and caps are **generated into overview §2.1** from `_plan.mjs`; nothing here copies them.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| d01 | Read the owner's plan row | database | Automation | MySet server R | Netlify | `PLANS[plan]` in `_plan.mjs` is the single definition of the cut (artist Free / Plus / Pro; venue Free / Pro) and of `splitFee` (venue rows only). Every checkout, every Studio sentence, every test reads it — a number that appears anywhere else is copy, and copy drifts. `src: _plan.mjs; overview §2.1; decisions 0017, 0026` |
| d02 | Is this the platform owner? | conditional | Automation | MySet server R | Netlify | The founder's own gigs are charged on the **platform** account (they predate Connect) and pay no application fee to themselves — a circular self-fee would add accounting noise and move no value. Enforced in the payment path even if that account later connects a payout account. **What must never be sent is `application_fee_amount: 0`** — Stripe treats a zero fee differently from no fee. `src: decision 0017; ACCOUNTING.md § One Stripe account, two businesses` |
| d03 | Compute MySet's fee | task | Automation | MySet server R | Netlify | `floor(amount × cut)` in whole cents. On a direct charge Stripe's own processing fee (roughly a percentage plus a fixed amount — the estimate lives in `stripeFeeEstimate`) is charged to the **connected account**, not to MySet. *"10% to MySet" is not "you keep 90%"* — the Studio says this before an artist onboards. `src: overview §4.2; decision 0007` |
| d04 | Venue row: subtract half of Stripe's estimate | conditional | Automation | MySet server R · Venue manager I | Netlify | `splitFee` → `fee = max(0, floor(amount × cut) − round(estimate / 2))`. On small items at the Pro cut the half-fee exceeds the cut and MySet's fee **floors at zero** — a negative application fee is not a thing, so MySet absorbs nothing beyond forgoing its cut. **Artists are not split.** It is an estimate at checkout and the Studio says so. `src: ACCOUNTS.md §3; overview §4.4` |
| d05 | Create the direct charge | payment | Automation | MySet server R | Stripe | Checkout on the connected account (`stripeAccount`), `application_fee_amount` from d03/d04, `payment_intent_data.metadata = {kind, artist, …}` so the money can later be bucketed by **tag, never by timestamp**. → *The gig → Buying votes and tipping* for the fan's path. `src: pay.mjs; overview §4.3` |
| d06 | Stripe settles the charge | payment | Automation | Stripe webhooks R | Stripe | With default async capture, `balance_transaction` and `application_fee` are both **null on `charge.succeeded`**; they exist on **`charge.updated`**. A handler on succeeded would quietly do nothing on most charges. `src: _feesplit.mjs (1); ACCOUNTS.md §8` |
| d07 | Venue row: settle the exact split | payment | Automation | Stripe webhooks R · MySet server R · Venue manager I | Stripe | `settleSplit(owner, acct, charge)` on `charge.updated` with `event.account`: read the **connected account's** balance transaction (in scope) and the **platform's** application fee (out of scope) — swapping them gives *no such object*, which is at least loud. Stripe's fee is `fee_details[type === 'stripe_fee']`, **never `bt.fee`** (on a direct charge that includes MySet's own cut). Convert with the balance transaction's own exchange rate (a Thai venue settles in THB); no rate → record `unconvertible` and stop. Then `applicationFees.createRefund` for the shortfall — **not** `transfers.create`, which Stripe refuses cross-border to Thailand. **It runs one way only: it pays the venue and never bills them.** Below roughly $29 at the Pro cut the fee was already zero → records `nothing`. Exactly-once: a claim in `meta_<owner>.fees` keyed by charge id (claimed ≠ delivered, INVARIANT 7b) plus a Stripe idempotency key derived from the charge id. Never throws — the webhook must answer 200. `src: _feesplit.mjs; ACCOUNTS.md §8` |
| d08 | Is `charge.updated` on the endpoint? | conditional | Person | Founder R | Stripe | **Not yet** (ledger PER-001). Without it the estimate stands and nothing breaks; with it MySet's share is exact to the cent. One click in the Stripe dashboard. `src: ACCOUNTS.md §5 (3); IMPLEMENTATION_STATUS.md PER-001` |
| d09 | Read the same payment from both sides | notification | Automation | MySet server R · Artist I · Founder I | Stripe | The artist's statement sees **one** `charge` whose `fee_details` hold both `stripe_fee` and `application_fee`: gross · Stripe's cut · MySet's cut · net. The platform's books see nothing for the charge (it never touched MySet's balance), one `application_fee`, and — when split — an `application_fee_refund` for a negative amount. Both are platform revenue, so **the split nets off automatically**. → *The books*. `src: ACCOUNTING.md` |

## Connections

d01 → d02; d02 —owner→ d05 (no fee); d02 —anyone else→ d03; d03 → d04; d04 —venue→ d05; d04 —artist→ d05; d05 → d06 → d07; d08 —not added→ *d07 never fires*; d07 → d09.

## The honest sentence (for the Studio and for anyone reading)

> MySet pays half of Stripe's card fee, up to the whole of MySet's own fee. On small items that means MySet takes nothing and the venue still carries the rest of Stripe's fee.

That is not an even split and is never called one. `src: ACCOUNTS.md §8`
