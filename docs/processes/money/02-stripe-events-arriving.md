---
tab: Money
section: Stripe events arriving (the webhook)
puzzle_section_id: 41972
sources:
  - netlify/functions/webhook.mjs (read in full 2026-09-12)
  - netlify/functions/_pay.mjs redeemSession, _requests.mjs authorizeRequestSession, _featured.mjs settleFeature, _billing.mjs handleBillingEvent, _feesplit.mjs settleSplit, _connect.mjs mutateConnect/mirrorToShow, _verify.mjs tryAutoVerify
  - ACCOUNTS.md §4, §5
  - INVARIANTS.md 5c, 7, 7b
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 — every branch below is a branch in webhook.mjs, in order
---

# Stripe events arriving (the webhook)

**Who:** Stripe calling `POST /api/webhook` (role *Stripe webhooks*). **Trigger:** any subscribed event. **Outcome:** the one path by which money and account events reach MySet without a person or a phone — the safety net that exists because on 2026-08-30 a buyer's browser never came back and a $3 purchase was charged and never granted.

Requires `STRIPE_WEBHOOK_SECRET`; absent, the endpoint is inert and the return page and the reconcile sweep still cover payments. **It always answers 200** once the signature is good — a thrown handler makes Stripe retry an event that will never succeed.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| w01 | Verify the signature | conditional | Automation | Stripe webhooks R · MySet server R | Stripe | Raw body bytes + `stripe-signature` header → `constructEventAsync`. Missing key or secret → 503 `webhook-not-configured`. No signature → 400. Bad signature → 400 — **never trust an unsigned payload**. `src: webhook.mjs 12–24` |
| w02 | Route by event type | conditional | Automation | MySet server R | Netlify | In code order: `charge.updated` (Connect only) → w03; `account.updated` → w04; subscription events → w06; `checkout.session.completed` / `async_payment_succeeded` → w07. Anything else → 200, ignored. Events for an unknown owner are ignored, not guessed at. `src: webhook.mjs` |
| w03 | Settle the exact fee split | payment | Automation | MySet server R · Venue manager I | Stripe | `event.account` present = a Connect charge. `artistForAccount(event.account)` → owner; if the charge carries a `balance_transaction`, `settleSplit`. Errors logged, never thrown. → *How a payment divides* d07. `src: webhook.mjs 34–45; _feesplit.mjs` |
| w04 | Mirror the account's status | database | Automation | MySet server R · Artist I | Netlify | `account.updated`: write `chargesEnabled`, `payoutsEnabled`, `detailsSubmitted`, `country` onto `connect_<owner>`, then `mirrorToShow` — **the one writer that flips a room's money buttons on**, mirrored onto the show record so the audience poll reads it for free. `src: webhook.mjs 47–70; _connect.mjs` |
| w05 | Try the verification tick | task | Automation | MySet server R · Artist I | Netlify | Artists only (not `v_` owners): Stripe has just finished checking who they are, so `tryAutoVerify` runs now rather than waiting for the artist to come looking. → *Artist lifecycle → Verification and the tick*. `src: webhook.mjs 63–67; overview §5.6` |
| w06 | Hand billing events to `_billing` | task | Automation | MySet server R · Artist I | Stripe | `customer.subscription.updated` / `.deleted`, `invoice.payment_failed`, and a `checkout.session.completed` in **subscription mode** (billing, not a purchase to redeem) → `handleBillingEvent` → `syncSubscription`: `past_due` applies the grace period. → *Plans and billing*. `src: webhook.mjs 72–78; _billing.mjs 343–360` |
| w07 | Fetch the session if not yet paid | conditional | Automation | MySet server R | Stripe | `payment_status !== 'paid'` → retrieve the session (in the connected account's scope when `event.account` is set — the only way to know the session lives on somebody else's account). `src: webhook.mjs 80–90` |
| w08 | Song-request hold? | conditional | Automation | MySet server R · Fan I | Stripe | `metadata.kind === 'request_hold'` → **deliberately not paid here**: `authorizeRequestSession` creates the request with its pledge; the artist's later play-completion is the only code allowed to capture. → *The gig → Requests and shout-outs*. `src: webhook.mjs 92–101` |
| w09 | Featured show? | conditional | Automation | MySet server R · Artist I | Stripe | `metadata.kind === 'feature'` and paid → `settleFeature` — its own path, **not** `redeemSession`, which knows votes, tips and merch and would write a claim marker for a kind it cannot grant. → *Featured shows*. `src: webhook.mjs 103–113` |
| w10 | Redeem the purchase | payment | Automation | MySet server R · Fan I | Netlify | Paid → `redeemSession(aid, session)` — replay-safe, so a retry racing the return page is fine. Errors swallowed; Stripe retries. → *The gig → Buying votes and tipping* b10. `src: webhook.mjs 114–120; INVARIANT 7` |
| w11 | Answer 200 | notification | Automation | MySet server R | Netlify | `{received: true}` so Stripe stops retrying. `src: webhook.mjs 122` |

## Connections

w01 —good→ w02; w02 —charge.updated→ w03 → w11; w02 —account.updated→ w04 → w05 → w11; w02 —subscription→ w06 → w11; w02 —checkout→ w07 → w08; w08 —hold→ w11; w08 —not a hold→ w09; w09 —feature→ w11; w09 —purchase→ w10 → w11; w02 —anything else→ w11.

## Events the endpoint must be subscribed to (the founder's one-time Stripe task)

`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` — and **`charge.updated`, still to add** (PER-001). `src: ACCOUNTS.md §5`
