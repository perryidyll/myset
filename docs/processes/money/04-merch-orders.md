---
tab: Money
section: Merch orders
puzzle_section_id: 41974
sources:
  - netlify/functions/pay.mjs (kind merch; venue merch branch), _pay.mjs (the order record), admin.mjs (merchList/merchSave/merchRemove/merchPhoto, orderList/orderDone/orderDetail), _plan.mjs merchAllowed
  - MYSET-MASTER-OVERVIEW.md §2.2 (merch gate), §3.3 Merch, §3.7
  - ACCOUNTS.md §3 (Venues getting paid)
  - INVARIANTS.md 0bu (no fan data kept), 7
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (pay.mjs merch branches; _pay.mjs order write; admin.mjs orderDetail)
---

# Merch orders

**Who:** a fan on a community page; the artist (or venue) fulfilling by hand. **Trigger:** *Buy* on a merch item. **Outcome:** a direct charge on the seller's account, an order row the seller works through in Studio → Merch → Orders, and **nothing about the buyer stored in MySet**.

Merch is a paid-plan feature for artists (the ladder in overview §2.1) and a venue-Pro feature; `merchAllowed()` is checked by the Studio, the checkout **and** the page — one answer, three readers, so a lapsed plan removes the item from the page and makes it unbuyable at once.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| m01 | Manage the items | form | Person | Artist R | Netlify | Studio → Merch: up to the plan's item count (§2.1) — name, one line, price, pickup or posted, on/off, a picture (`merchPhoto`). Items live on the profile document. An item needs an outside link only while card payments are *not* on. `src: admin.mjs merchSave; overview §3.3 Merch` |
| m02 | Is merch allowed right now? | conditional | Automation | MySet server R · Fan I | Netlify | `merchAllowed(aid, limits)` — plan gate, AND-on-read. Not allowed → **404 "Merch isn't on this page right now"** and the page does not draw the shop. `src: pay.mjs; _plan.mjs` |
| m03 | Is the item for sale? | conditional | Automation | MySet server R · Fan I | Netlify | **The item is the seller's record, never the request** — price, name and whether it ships come from the profile. Off or unknown → **404 "That item isn't for sale right now"**. Under a dollar → **400 "That one isn't sold through MySet — ask at the merch table"**. Quantity clamped 1–5. `src: pay.mjs merch branch` |
| m04 | Create the direct charge | payment | Automation | MySet server R | Stripe | `mode: 'payment'` on the seller's connected account; `application_fee_amount` from the ladder (venue rows split — → *How a payment divides*); `payment_intent_data.metadata = {kind: 'merch', artist}`; `shipping_address_collection` only for posted items. Per-tap `attempt` idempotency. Success URL: the artist's or venue's **community page** with `?paid=…`. `src: pay.mjs` |
| m05 | Pay on Stripe's page | payment | Person | Fan R | Stripe | Name, card, and — for posted items — the shipping address are collected by Stripe and stay there. `src: overview §4.2` |
| m06 | Write the order record | database | Automation | MySet server R · Artist I | Netlify | Inside `redeemSession`'s claim: `meta.orders.push({sid, item, title, qty, amount, fan, at, ship, status: 'new'})`. **The order record IS the delivery**, written inside the same claim so a session can never be claimed without it. Delivered by any of the three paths (→ *The gig → Buying votes and tipping*). `src: _pay.mjs 93–103; INVARIANT 7` |
| m07 | See new orders | notification | Automation | MySet server R · Artist I | Netlify | Studio → Merch → Orders (`orderList`, newest first): item, quantity, amount, pickup/posted, status. `src: admin.mjs orderList` |
| m08 | Open the order's details | task | Person | Artist R | Stripe | `orderDetail`: the buyer's name, email and shipping address are **fetched from Stripe at that moment, shown, and forgotten** — never kept in Blobs (INVARIANT 0bu's posture). Both shipping shapes are read because which one Stripe returns depends on the account's API version. Stripe unreachable → 502 *"Couldn't reach Stripe just now"*. `src: admin.mjs orderDetail` |
| m09 | Fulfil and mark done | task | Person | Artist R | Netlify | Hand it over at the show or post it; `orderDone` flips `status` to `done` (and back to `new` if tapped by mistake). No shipping integration, no tracking — the seller does it. `src: admin.mjs orderDone` |
| m10 | Venue merch | alias | Person | Venue manager R | Stripe | Same flow keyed `v_<venueId>`: the Venue Studio's Merch tab has the *Getting paid* card and an Orders list once payments are on; a venue-page purchase is a direct charge on the **venue's** account with the fee split applied; the buyer lands back on the venue's community page. `src: pay.mjs venue branch; ACCOUNTS.md §3` |

## Connections

m01 → m02 —allowed→ m03 —for sale→ m04 → m05 → m06 → m07 → m08 → m09; m10 is an alias of m02–m09 for venues.

## What is deliberately absent

No buyer data in MySet (fetched from Stripe when the seller looks, never stored). No refunds through the app (Stripe's dashboard). No stock counts — the item is on or off.
