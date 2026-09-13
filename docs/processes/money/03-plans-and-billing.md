---
tab: Money
section: Plans and billing (subscriptions)
puzzle_section_id: 41973
sources:
  - netlify/functions/_billing.mjs (startCheckout, finishCheckout, syncSubscription, maybeSync, changePlan, applyRetention, portalLink, invoices, billingStatus, cancelForDeletion, handleBillingEvent)
  - netlify/functions/admin.mjs (planGet, planSync, planCheckout, planFinish, planChange, planRetainOffered, planRetain, planInvoices, planPortal, promoRedeem)
  - MYSET-MASTER-OVERVIEW.md §2.1–2.8
  - ACCOUNTS.md §3 (Plans and billing; The Studios), §4, §5, §7
  - docs/decisions/0003, 0004, 0005, 0037
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_billing.mjs startCheckout/changePlan/handleBillingEvent/billingStatus)
---

# Plans and billing (subscriptions)

**Who:** the account **owner** (members cannot bill — 403) and the server. **Trigger:** *Upgrade ↗* in the Studio, the plan sheet, or Settings → Your plan. **Outcome:** a Stripe subscription on **MySet's own** account (this is the one place money is MySet's, not the artist's), the registry's plan flipped by Stripe's word, and everything the plan gates enforced server-side.

The ladder (prices, cuts, caps) is generated into overview §2.1. Two rules shape every screen: **locked features are shown greyed, never hidden** (decision 0004), and **an unbuilt feature is never shown as yours** — `NOT_BUILT` in `_plan.mjs` greys *Coming soon* on every plan including Rock Star (decision 0005). The artist ladder is sold as Hobbyist / Bar Star / Rock Star; the ids stay `free` / `plus` / `pro` (decision 0055). The free tier is capped by **shows per month**, never by features (decision 0003; the number moved to ten in 0036).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| p01 | Open the plan sheet | webpage | Person | Artist R | Netlify | Every tier in a brand-gradient-ringed box, name and price bold on a pink-orange banner, a **numbered** list where every line is a bold heading, an en dash, then the detail; a paid tier opens with *Everything in Hobbyist* / *Everything in Bar Star* rather than repeating the tier below (the founder reversed his earlier "never" on 2026-09-13); the transaction fee in pink-orange and called exactly that. *Comped until* shows only for a plan that came from a code or a referral, never on the founder's own account. Settings → Your plan: one big green button, plus *Card, invoices and receipts ↗* when subscribed. `src: ACCOUNTS.md §3 The Studios` |
| p02 | Is the caller the owner? | conditional | Automation | MySet server R | Netlify | `planCheckout`, `planChange`, `planRetain`, `planPortal`, `accountDelete` refuse non-owners with **403**. A band mate on a Rock Star seat cannot bill or delete. `src: ACCOUNTS.md §4` |
| p03 | Already subscribed? | conditional | Automation | MySet server R · Artist I | Netlify | `startCheckout` refuses (`already-subscribed`) when the record holds a sub in `active`, `trialing`, `past_due` **or `unpaid`** — change the plan instead. **`unpaid` belongs in this list**: without it an artist whose card kept failing could run Checkout again and hold **two live subscriptions** billed side by side (a real bug, fixed). It does *not* belong in `paidStatus` — an unpaid subscription is genuinely not paid. Two lists, two questions. `src: _billing.mjs 130–137` |
| p04 | Apply a promo code | conditional | Automation | MySet server R | Stripe | `promoRedeem` recorded `discountPct` on the account; below 100% it becomes a coupon `myset_promo_<pct>` on the checkout; 100% is a comp (no Stripe at all). Otherwise `allow_promotion_codes` lets Stripe's own codes in. Promo minting and revoking are owner-only tools in Settings. `src: _billing.mjs 140–146; admin.mjs promoCreate/promoRevoke` |
| p05 | Start the subscription checkout | payment | Automation | MySet server R · Artist R | Stripe | Stripe Checkout in `subscription` mode on the platform account; one customer per owner (`ensureCustomer`); prices and products are created by the app on first use (`ensurePrice`). `metadata = {owner, plan, kind: 'sub'}`. Success → `?sub=done&cs=…`; cancel → `?sub=cancelled` (*"No change made"*). `src: _billing.mjs startCheckout` |
| p06 | Finish on return | conditional | Automation | MySet server R · Artist I | Stripe | `planFinish` **reads the session from Stripe by id and checks `metadata.owner`** — `?sub=done` alone changes nothing (never trust the return URL). Rewards the referrer if there was one. → sync. `src: _billing.mjs finishCheckout; ACCOUNTS.md §4` |
| p07 | Sync the plan from Stripe's word | database | Automation | MySet server R · Stripe webhooks R | Netlify | `syncSubscription`: `active` / `trialing` / `past_due` → the paid plan with `planUntil = period end + a grace period`; anything else → free (unless comped). Runs on return, on every billing webhook, and lazily every `SYNC_EVERY_MS` on Studio boot (`maybeSync`). A promo's `pendingPlan` is consumed here. `src: _billing.mjs 164–200, 221` |
| p08 | Enforce the plan where the server refuses | conditional | Automation | MySet server R · Artist I | Netlify | Every gated thing is refused **on the server**, not merely hidden: the monthly show cap at `startShow`, the library's size (100 / 200 / 2,000 — every song in it is live to the audience since decision 0061), team seats, own prices, named setlists, merch, hiding a post (decision 0060). `test/limits.mjs` asserts that anything **not** in `NOT_BUILT` is genuinely enforced somewhere. `src: overview §2.2; _plan.mjs; decisions 0003, 0005` |
| p09 | Change the plan | conditional | Person | Artist R · MySet server R | Stripe | `changePlan`: **to free** → `cancel_at_period_end` (the month is paid for; they keep it, nothing renews). **Paid ↔ paid** → price swap on the existing subscription with `create_prorations`. No subscription → `no-subscription`. `src: _billing.mjs changePlan` |
| p10 | Offer to stay | conditional | Automation | MySet server R · Artist I | Stripe | Leaving Rock Star: *"Are you sure you want to lose your Rock Star membership benefits?"* (No in orange, Yes greyed) → *"We're sad to see you go… keep your plan for 50% off for 1 more month?"* `noteRetentionOffered` records the offer; `applyRetention` applies coupon `myset_stay_50` **once, ever** — the server answers once however many times the client asks (*"That offer has already been used."*). `src: _billing.mjs 258–275; ACCOUNTS.md §3, §4` |
| p11 | The card that didn't go through | conditional | Automation | Stripe webhooks R · MySet server R · Artist I | Stripe | `invoice.payment_failed` → sync → `past_due`; `billingStatus` carries `pastDue` and `graceUntil` at no extra call. The **dunning banner** has three states in the founder's voice, none shaming: grace left; the last day (naming every real consequence, built from the plan table so it cannot drift); run out. Suppressed over a live show except in Settings — *a bar about a card at 11pm on stage is the wrong pixel at the wrong moment*. `src: _billing.mjs 321–340; ACCOUNTS.md §7` |
| p12 | Card, invoices and receipts | link | Person | Artist R | Stripe | `portalLink` → Stripe's Customer Portal (the founder saved the default configuration in live mode once — the API refuses until one exists). The return URL carries `?billing=back` so the Studio re-reads Stripe on the spot instead of telling someone who just fixed their card that it failed for six more hours. `invoices.list` on demand only — never on page load. `src: _billing.mjs portalLink, invoices; ACCOUNTS.md §5, §7` |
| p13 | Read the plan in the Studio | notification | Automation | MySet server R · Artist I | Netlify | `billingStatus` on every Studio boot: `{subscribed, status, plan, renewsAt, cancelAtPeriodEnd, retentionUsed, pastDue, graceUntil, portal}`. Top right: *Upgrade ↗* on free; a green tag with the plan's name when paid. `src: _billing.mjs billingStatus; ACCOUNTS.md §3` |
| p14 | Cancel for deletion | payment | Automation | MySet server R | Stripe | `cancelForDeletion` cancels immediately — used only by account delete. → *Artist lifecycle → Leaving*. `src: _billing.mjs 293; ACCOUNTS.md §6.6` |

## Connections

p01 → p02 —owner→ p03 —not subscribed→ p04 → p05 → p06 → p07 → p08; p02 —member→ *403*; p03 —subscribed→ p09; p09 —to free→ p10 → p07; p09 —paid ↔ paid→ p07; p11 → p07; p07 → p13; p12 → p07 (on `?billing=back`); p14 → p07.

## The one-time Stripe setup behind this section (founder)

Webhook events for subscriptions; the Customer Portal configuration saved in live mode; nothing else — prices, coupons and products are created by the app. `src: ACCOUNTS.md §5`
