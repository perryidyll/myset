# ACCOUNTS.md — the account system

*Written 2026-09-04. What an account IS on MySet, what it can do, how it is paid for, and how it leaves. Read this before touching sign-in, plans, billing or deletion. The rules that must never break are in `INVARIANTS.md` (0cr–0cz).*

---

## 1. What was already here (and is kept)

MySet already had the bones of a real account system before this pass. None of it changed shape; this document is the first place it is described end to end.

| Piece | Where | How it works |
|---|---|---|
| **Identity** | `_auth.mjs` | An *artist* (`artistId`, a slug, a name) owns a page. A *venue* (`venueId`) owns a venue page. Both live in one registry document each (`artists`, `venues`) keyed three ways: by id, by slug, by email. |
| **Sign-in** | `auth.mjs`, `venueauth.mjs` | Passwordless. You type an email, we send a six-digit code (Resend), you type it back. A signed token (HMAC, `signToken`) is stored in the browser. No passwords exist anywhere. |
| **Session revocation** | `_auth.mjs` (`revOf`) | Every token carries the account's *revision*. Removing an email, or any change that must sign everyone out, bumps the revision and every old token dies at once. There is no session list to clean up because there is nothing to list — the revision is the list. |
| **Members** | `auth.mjs` `list/add/remove` | An artist page can have up to 5 sign-in addresses on Pro (1 otherwise). Owner vs member roles; members cannot touch money, plans or deletion. |
| **The founder's recovery key** | `_lib.mjs` `ownerOf` | `ADMIN_CODE` is checked first so a lock-out can never shut Perry out of his own platform. It never lives *only* in an env var (INVARIANT — see `HARDENING.md`). |
| **Per-page Studio code** | `show.codeHash` | The older door: a code per page, hashed, with lock-out after repeated failures (`codeLocked`, `noteCodeFailure`). Still works for the founder's own page. |
| **Plans** | `_plan.mjs`, `_venues.mjs` | Free / Plus ($10) / Pro ($20) for artists; Free / Pro ($20) for venues. `planForArtist` reads the registry row; a plan with a `planUntil` in the past falls back to free. Comps (`billing:'comp'`) were the only way to be on a paid plan. |
| **Referrals and promo codes** | `_plan.mjs` | A referral rewards the referrer when the referred pays; a promo code sets a `discountPct` on the row. |
| **Verification** | `_verify.mjs` | ID check queue for the tick; auto-verify from a Stripe Connect identity for artists. |
| **Getting paid (artists)** | `_connect.mjs` | Stripe Connect Express, direct charges on the artist's account, MySet's fee as `application_fee_amount`. |

What was missing, and is what this pass built: **paying for a plan**, **leaving a plan**, **venues getting paid**, **taking your data with you**, and **deleting yourself**.

---

## 2. Design choices (why it is built this way)

The reference class was "small SaaS with a free tier and one or two paid tiers": Linktree, Bandcamp's artist side, Substack, Carrd. Three things they all do, and MySet now does:

1. **Stripe holds the card, we hold a pointer.** MySet never stores card data, never computes a renewal date itself, and never decides whether an invoice was paid. Stripe Billing is the source of truth; we mirror the *plan* onto the registry row so every existing `planForArtist` call keeps working unchanged. One `billing_<owner>` document per owner holds `{customerId, subId, priceKey, status, currentPeriodEnd, cancelAtPeriodEnd, retention, lastSyncAt}` — pointers, not money.

2. **Two ways to learn the truth, and neither is trusted alone.** Stripe tells us about a subscription by **webhook** (`customer.subscription.updated/deleted`, `invoice.payment_failed`, `checkout.session.completed`). Webhooks can be late or dropped, so there is a **belt**: coming back from Checkout calls `planFinish` (which reads the session from Stripe by id, never trusting the URL), and `maybeSync` re-reads the subscription from Stripe at most every 6 hours whenever the plan is read. A dropped webhook costs a user at most six hours, never a plan.

3. **Downgrades are gentle and honest.** Leaving a paid plan sets `cancel_at_period_end` — the month that was paid for stays paid for. Moving between paid plans updates the price on the live subscription with proration. The retention offer (50% off one month, coupon `myset_stay_50`) is applied **on the live subscription in Stripe**, so Stripe bills it — we never "remember to charge less" ourselves. It is offered once per account, ever (`billing.retention.usedAt`), and the offer itself is recorded (`offeredAt`) so the numbers are honest later.

4. **Prices by lookup key, created on first use.** `myset_plus_monthly`, `myset_pro_monthly`, `myset_venue_pro_monthly`. If Perry changes a price in the Stripe dashboard the lookup key moves with it; the code never hard-codes a `price_…` id. The dollar amounts in `PLANS` / `VENUE_PLANS` are used only to *create* the price the first time.

5. **One owner type, two kinds.** Every billing and Connect function takes an `owner` string: an artist id, or `v_<venueId>` for a venue. `isVenueOwner()` is the only place that distinction is made. This is why venue Connect was a small change and not a fork.

6. **Export before delete.** A user who can delete themselves must first be able to take everything with them. Export is a single JSON file with everything MySet holds about the account — and *never* a fan's device id (fans are counted, never named: INVARIANT 0bu).

7. **Delete is enumerated, not searched.** Blobs `list()` is banned (INVARIANT 1). `keysFor(aid)` is the one list of every key the app writes for an artist — show, meta, profile, requests, events, lists, learn, push, connect, feedback, lock, pitches, songstats, posts, likes, billing, the 12 fan shards, every archived show, lyrics and chart per song, and every image slot (cover, avatar, p0–p2, idcheck, each merch item, each post photo). **Adding a new per-artist key means adding it there** — the header of `_account.mjs` says so, and a test asserts the list covers what a fixture artist writes.

---

## 3. What was built (2026-09-04)

### Plans and billing — `_billing.mjs`
- `startCheckout({owner, plan, email, name, origin, back})` — Stripe Checkout in `subscription` mode, customer created once per owner, promo `discountPct` becomes a coupon `myset_promo_<pct>`. Refuses if already subscribed (change the plan instead).
- `finishCheckout(owner, csId)` — on return; checks the session's `metadata.owner` matches; rewards the referrer.
- `syncSubscription(owner, subId)` — active / trialing / past_due → paid plan with `planUntil = period end + 3 days` grace; anything else → free (unless comped).
- `changePlan(owner, plan)` — free → `cancel_at_period_end`; paid ↔ paid → price swap with `create_prorations`.
- `applyRetention(owner)` — the one-time 50% month; `noteRetentionOffered(owner)`.
- `portalLink(owner, origin, back)` — Stripe Customer Portal for card / invoices / receipts.
- `cancelForDeletion(owner)` — cancels immediately, used only by delete.
- `billingStatus(owner)` — what the Studio shows: `{subscribed, status, plan, renewsAt, cancelAtPeriodEnd, retentionUsed, portal}`.
- `handleBillingEvent(event)` — the webhook side.

### The Studios
- **Top right:** `Upgrade ↗` (orange outline) on free; a green tag with the plan's name and the same `↗` when paid. Both open the plan sheet.
- **The plan sheet:** every tier in an orange-bordered box, name and price bold white on an orange banner, a *numbered* list of everything in that tier (never "everything in Plus"), the transaction fee in orange and called exactly that, a testimonials carousel at the bottom (placeholders until real ones are submitted — the array is the architecture; empty it and the section disappears).
- **Settings → Your plan:** one big green button — "Upgrade your plan" on free/Plus, "Pro membership" on Pro — plus a small "Card, invoices and receipts ↗" link to the portal when there is a subscription.
- **Leaving Pro:** "Are you sure you want to lose your Pro membership benefits?" (No in orange, Yes greyed) → "We're sad to see you go… keep your plan for 50% off for 1 more month?" → `planRetain` or `planChange`.
- **Back from Stripe:** `?sub=done&cs=…` → `planFinish` → toast; `?sub=cancelled` → "No change made". `?connect=done` → re-read Connect status.
- **Your account:** sign-in address and how many sign-ins the page has; **Download my data**; **Delete my account** (type DELETE).

### Venues getting paid — `_connect.mjs`, `venueadmin.mjs`, `pay.mjs`
- Same Stripe Connect Express flow as artists, keyed `v_<venueId>`; the Venue Studio's Merch tab has the "Getting paid" card (country, start/finish with Stripe, dashboard link) and an Orders list once payments are on.
- Merch checkout on a venue page is a **direct charge on the venue's account**; the buyer lands back on the venue's community page.
- An item needs a link only while card payments are *not* on.

### The fee split (Perry's rule, 2026-09-04)
MySet's transaction fee comes off the top as `application_fee_amount`. Stripe's own card fee (about 2.9% + 30¢) is charged to the connected account on a direct charge — i.e. to the venue. Perry wants that fee **shared evenly**, so for any plan row with `splitFee: true` (both venue plans) the application fee is reduced by half of Stripe's estimated fee:

```
fee = max(0, floor(amount × cut) − round((amount × 0.029 + 30) / 2))
```

| Example | Plan | Cut | Stripe est. | MySet keeps |
|---|---|---|---|---|
| $50 merch, venue on Free | 10% | 500¢ | 175¢ | **412¢** |
| $50 merch, venue on Pro | 2% | 100¢ | 175¢ | **12¢** |
| $12 cap, venue on Pro | 2% | 24¢ | 65¢ | **0¢** (floored) |
| $50 vote pack, artist on Plus | 2% | 100¢ | — | **100¢** (artists are not split) |

Two honest limits, both written into the Studio copy:
- It is an **estimate at checkout**. Stripe's real fee depends on card type and country. An *exact* split would need a post-charge `transfers.create` from the platform back to the venue after `charge.succeeded` reports the real `balance_transaction.fee`. That is the next step if the estimate ever matters at scale; today the amounts are cents.
- On small items at 2% the half-fee exceeds the cut and MySet's fee floors at **zero** — MySet then absorbs nothing beyond forgoing its cut, because a negative application fee is not a thing. That is the deal Perry chose; it is documented, not hidden.

---

## 4. Security properties

- **No card data, ever.** Checkout and the portal are Stripe-hosted pages.
- **Never trust the return URL.** `planFinish` reads the session from Stripe by id and checks `metadata.owner`; `?sub=done` alone changes nothing.
- **Webhook signature** is verified (`STRIPE_WEBHOOK_SECRET`); events for an unknown owner are ignored, not guessed at.
- **Members cannot bill or delete.** `accountDelete`, `planCheckout`, `planChange`, `planRetain`, `planPortal` refuse non-owners (403).
- **Delete needs the word.** `confirm: 'DELETE'` in the body; the Studio makes you type it. The founder cannot be deleted from the app.
- **Retention is once, ever**, enforced server-side — the client can ask twice, the server answers once.
- **Fan privacy survives export.** Device ids are stripped from tips and orders before they leave.
- **Sessions die with the account.** Registry rows (byId, bySlug, byEmail) are removed last, after the data, so a token presented mid-delete finds nothing to act on.

---

## 5. What Perry has to do in Stripe (once)

1. **Webhook events** — on the existing endpoint add: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `checkout.session.completed` (already present for payments; it now also handles subscription mode).
2. **Customer Portal** — Settings → Billing → Customer portal → save the default configuration **in live mode** (the API refuses to open a portal session until a configuration exists).
3. Nothing else: prices, coupons and products are created by the app on first use.

---

## 6. What is next (not built, in order of value)

1. **Change my email** — a second code sent to the *new* address, then a swap in `byEmail`; today the workaround is add-then-remove on Pro (members), or ask Perry.
2. **Exact fee split** via post-charge transfer (see §3).
3. **Invoices in the Studio** — the portal shows them today; an in-app list is a `invoices.list` call away.
4. **Two-factor** — passwordless codes to email are already a factor; a second (passkey) is the natural next one and Stripe-style *recovery codes* should come with it.
5. **Session list / "sign out everywhere"** — a button that bumps the revision; the mechanism exists (`revOf`), only the button is missing.
6. **Venue members** — venues have one sign-in today.
7. **Dunning copy** — on `past_due` the plan stays for the 3-day grace; a Studio banner ("your card didn't go through") would be kind.
