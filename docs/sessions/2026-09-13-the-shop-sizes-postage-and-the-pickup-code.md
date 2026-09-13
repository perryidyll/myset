# 2026-09-13 — The shop: its own page, sizes, postage and the pickup code

Branch `merch/shop-page`, worktree off `origin/main` `34215b8`; PR to be opened by the founder. Decision record [`0064`](../decisions/0064-postage-is-a-shipping-rate-off-the-cut-the-pickup.md). Built by parallel single-file builders (the shop page, the community page, the server, the two Studios) under one data contract, then an integrator's cross-file pass and a final gate; the documents in this note were written in tandem (the Puzzle rule). Nothing was committed, staged or pushed — the tree awaits the founder's push and a look at the deploy preview at phone width in both themes.

## What was asked

Merch moves off the community page's rail to its own page — `/<slug>/shop` for an artist, `/v/<slug>/shop` for a venue — with the community page keeping only a ringed, finder-sized card under the name and **above** the Support tip button (the founder's 2026-09-13 order, superseding 2026-09-07's "first thing under the name"), drawn only when there is something to sell. On an item: sizes or options (each sold-out-able on its own), a whole-item **sold out** that keeps the item on the page with its price and no Buy, a flat per-order postage figure on a posted item with MySet's fee on the price alone, the item's picture on Stripe's page. On every order: a short pickup code the merch table can match to a face without reading a Stripe receipt. In the Studio: the store as its own Menu entry with the orders showing the code first.

## What changed

**Routes and config**

- `netlify.toml` — `/v/:slug/shop` and `/:slug/shop` → `/shop.html`, each above its slug catch-all; two `[[headers]]` blocks giving the shop paths the community page's `max-age=60, stale-while-revalidate=600`. `shop` was already a reserved slug for both kinds of owner.

**The pages**

- `public/shop.html` (new, one file, no build step) — reads `/api/fan?what=community` with **no `fan=`**, head-started, never polled. Brandbar → compact head with the promise line → receipt strip → in-app-browser hint → a static two-column `.pgrid` (two tracks even at 320 px; `.one` for a single item) → **What the room said** (starred posts with text, drifting) → *How it works* → footer → the live `.fab` while the room votes. The product sheet: title → price → the fulfilment line → size chips (a sold-out size struck and disabled) → quantity 1 up to the per-order cap (overview §2.1) → a sticky Pay labelled with the total (*Pick a size* and still enabled when sizes exist and none is chosen — a tap points at the size row) → blurb → picture → **More from {First}** (every other item, sold-out ones dimmed, drifting the other way; a tap swaps the sheet in place). Both strips are the artist page's `drift()`/`ghost()` byte for byte — 28 px/s, finger-stoppable, one ⏸ remembered in `myset.shop.still`, static under reduced motion. A **Picks** strip (five newest) exists after the grid behind `?picks=1`, and only with six or more items, for the founder to compare. One history entry per item (`#m<id>`): Back closes, a cancelled Stripe trip reopens the same item with the same size and quantity. `buy()` posts `{fan, kind:'merch', item, qty, variant?, attempt, from:'shop'}`; the return trip redeems through `/api/confirm` (its own copy of the pending/retry logic — 5b), writes `myset.orders`, and draws the receipt: a drawn tick, `3 × Tour tee (M) · $75`, *Show this at the merch table*, the code at 34 px one glyph every 90 ms; a compact *Your last order · …* line on later visits. Section headings are ink with a 16×4 gradient bar, not `--accent-2` text.
- `public/community.html` — the merch rail, its buy sheet and every `data-buy` are gone. In their place `.shopcard`: the home page's finder chassis wearing the brand-gradient ring, `{First}'s merch`, the item count and how it sells, a fanned trio of item photos, the phone's last order code, *Browse the shop →*; drawn at `children[1]` only when `d.merch.length`; the tipbar follows it (the comment above the tipbar now records the founder's order). `redeem()`/`handleReturn()` stay for tips and for merch sessions minted before this deploy. Meta description no longer says "what's for sale".

**The server**

- `_profile.mjs` `normMerch` — `variants: [{label, out}]` (de-duplicated without regard to case), `out`, `post`; the caps exported once (`MAX_MERCH`, `MAX_VARIANTS`, `VARIANT_LEN`, `MAX_POST`, `MIN_CENTS`, `MAX_CENTS`; values in overview §2.1). `_venues.mjs` `shapeVenue` sends `merchMax`.
- `pay.mjs` (artist and venue branches) — a sold-out item is a 409 (`That one's sold out`), a missing size a 400 (`Pick a size`), a sold-out size a 409 (`That size is sold out`); the Stripe line names the size and carries the item's picture as `product_data.images` when it is one of ours; postage rides as a `shipping_options` fixed-amount rate named *Postage* with `shipping_address_collection`; the application fee is `feeCents(amountCents(line))` — the line alone. `payment_intent_data.metadata` carries `base`, `variant`, `post`. `from:'shop'` returns to a server-built `/<slug>/shop` or `/v/<slug>/shop`; anything else to the community page.
- `_pay.mjs` — `pickupCode(sid, orders)`: four characters of `sha256('pickup|'+sid)` over an alphabet without 0/O/1/I, a fifth on a clash with another OPEN order of the same owner (compared against what a code-less old row *shows*), minted inside `redeemSession`'s CAS. `pubOrder` (for the receipt) and `ownerOrder` (for the Studios) — neither carries the fan. `cleanOwnerId` keeps a venue's `v_` prefix; `confirm.mjs` and `webhook.mjs` both resolve the owner through it (a venue's orders were being filed under a bare artist id — found by the venue redeem test; do not swap back). `/api/confirm` returns `order` on the fresh and `already` paths.
- `_feesplit.mjs` — the half-of-Stripe's-fee correction estimates on `metadata.base`, so postage never shifts the split. `revenue.mjs` leaves `post` out of `cents`.
- `admin.mjs` / `venueadmin.mjs` — `merchList` returns the five caps beside the items; `merchPhotoClear`; `orderList`/`orderDetail` through `ownerOrder`; crew refused every shop and media write before the action is looked up.

**The Studios**

- `public/studio.js` — `merch` is a real tab again, its own Menu row *Merch store — Items, sizes, prices and orders* between Profile (*Manage your profile page*) and Settings. The screen: *See your shop ↗*, the items under the plan lock, the orders with the code first and big and the verb the artist does (*Handed over* / *Posted*). The editor: sizes as a comma line → `variants` with sold-out chips that save at once, a whole-item *Sold out*, postage per order; every helper names a bound only when the server sent it (`MERCHMAX`, `MERCHLIM`), and `merchTrimmed` says what the server trimmed. A failed `merchList` shows what happened and offers a retry. Merch photos export at 480 px, WebP first. The lapse banner and plan sheet say "shop page".
- `public/venue-studio.js` — the same inside the existing Merch tab: `V.merchMax`, sizes, *Sold out*, *How they get it* with Posted + postage, the code on orders and in the detail sheet, WebP photos; the plan sheet row reads *Merch on your shop page*.
- `public/studio.html`, `public/venue-studio.html` — the `?v=` stamps (`node tools/stamp.mjs`).

**Tests and tools**

- `test/community.mjs` (+103 lines: the code, the clash rule, `ownerOrder`, the venue owner, `from:'shop'`), `test/billing.mjs` (+69: fee on the line, `metadata.base`, the split with postage), `test/copy.mjs` (+49: the Menu rows, the real tab, the caps and price never typed, `merchPhotoClear`, WebP), `test/accounts.mjs`, `test/fandoor.mjs`, `test/structure.mjs` (`render: tab 'merch'`), `test/unit.mjs`, `test/stripe-fake.mjs` (shipping options).
- `tools/uicheck.mjs` — `ROOT` is the tool's own `public/` (a worktree checks itself); an `/api/img` stub; the community block asserts the shop card at `children[1]` and the tipbar at `children[2]`, and `children[1]` again with `merch:[]`; a shop block. `tools/sheetcheck.mjs` — the same `ROOT` fix and a shop product-sheet block under real touch events.
- `tools/overview.mjs` — imports the merch caps; a `### The shop` table in §2.1; the merch flag and the venue plan row say the shop page.
- `tools/mock.mjs` (new) — a fake API for looking at the whole batch on localhost: plain `node:http`, no dependencies, `netlify.toml`'s rewrites mirrored, every `/api/*` route the fan pages and both Studios call answered from in-memory fixtures, an index at `/` listing every inspectable state (the shop between shows, live, payments off, all sold out, one item, empty, the venue twin, the picks strip, the deep link, the three return trips, the Studios signed in with `?tab=merch` and `?plan=free`), one small SVG per kind of item for `/api/img`, and `/__mock/reset`. The states are switched server-side from the address (a cookie carries `?live=1` through the checkout round trip), so no page carries mock code; the only bytes it adds are the two Studios' pretend token. Touches nothing live; never a substitute for the suite. `AGENTS.md` lists it under *Build and test*.

**Documents (this session, in tandem)**

- `INVARIANTS.md` — 5b names three redeeming pages; 0f8 records the card above the tip; 0cm the sizes, the shipping rate, the code and `cleanOwnerId`; 0cn's stale "a venue has no payout account" replaced with "a link only while card payments are not on"; new **0fo** (the card exists only with an item; Buy only where the server would accept; `from:'shop'`; the `myset.orders` row shape).
- `MYSET-MASTER-OVERVIEW.md` — generated §2.1 (Public pages 11, invariants 256, decisions 63, the shop table); prose in §3.1 (routes), §3.3, §3.7 (*The shop*), §4.3, the plan tables.
- `docs/decisions/0064-…md` reconciled with the final code; `docs/decisions/README.md` regenerated. `docs/design-system.md` §0/§2/§3. `IMPLEMENTATION_STATUS.md` header, UX-044, decision log, risks. `docs/processes/money/04-merch-orders.md` (rewritten: who/trigger, the shop as the page, sizes and postage, the code, the return trip, the Studio's Menu row) and `the-gig/04-buying-votes-and-tipping.md` b05 (three redeeming pages) — and their Puzzle sections 41974 and 41967: `update_workflow` on steps 369901–369910 and the section's description and notes; a new step 370633 *Show the receipt and the code* (m07) with connection 414862 from *Write the order record*; step 369821 (b05) reworded; changelog entry **1648**, titled exactly as decision 0064, completed 2026-09-13, linked to all twelve steps; read back through `list_steps` (11 steps in 41974, both edges out of m06) and `list_changelog_entries`. The steps describing the working tree are `Testing`, not `Live` (CONVENTIONS: *Testing = in the working tree, not pushed*); flipping them to `Live` is the shipping session's, after the merge and the founder's browser look — nothing was set `verified`. Note: another worktree (`crm/artist-dashboard`) also holds a record numbered **0064** (*the paid plans get a business dashboard*, Puzzle changelog 1647); whichever PR merges second renumbers its record to 0064 (file name, the link in `MYSET-MASTER-OVERVIEW.md` §3.7, this note, the ledger, the Puzzle entry's body). `money/03` p08, `money/06` and `money/02` w09 mention merch only generically and stay as they are; `the-gig/03` has no merch step.

## Verified

Quoted from the integration report's final gate, run in the worktree on 2026-09-13 after every builder edit up to and including the Studio fixes and the shop trim (the *More from* strip in the sheet landed after it — see *Not checked*):

```
$ sh test/run.sh
… 43 per-suite "N passed, 0 failed" lines; the last one:
44 passed, 0 failed
EXIT 0
```
2,434 lines containing a tick, none beginning `✗`; `structure OK`, both `stamp matches` rows ✓ (`studio.js e77d3765`, `venue-studio.js b1bbca48`). One stderr line, `[t] unexpected`, is `test/errlog.mjs` throwing on purpose.

```
$ node tools/uicheck.mjs               ✓ 148   ✗ 0   PAGEERROR 0
$ node tools/sheetcheck.mjs            ✓ 30    ✗ 0   PAGEERROR 0        (12 lyrics-sheet + 18 shop-sheet)
$ node tools/overview.mjs --tests      stamped: 2434 assertions, 0 failing
$ node tools/overview.mjs --check      overview is current
```

Per suite, earlier the same day: `test/community.mjs` 213 / 0, `test/billing.mjs` 115 / 0, `test/accounts.mjs` 77 / 0, `test/copy.mjs` 53 / 0.

Sizes at that gate:

```
public/shop.html          raw  70538   gzip 23399
public/community.html     raw  80888   gzip 27324     (origin/main: 77826 / 26007)
public/studio.js          raw 300898   gzip 93780
public/venue-studio.js    raw 111263   gzip 35441
```
The blueprint's 60 KB raw cap for the shop is still exceeded (the rule-bearing comments were kept on purpose; on the wire it is a third of the raw figure). `brotli` is not installed here; the shop builder measured 20,424 B brotli on an earlier byte count.

Headless Chrome against a mock server serving the worktree (`scratchpad/devserver.mjs`, real routes, 390 wide): `/demo/shop?live=1` renders seven cards, five quotes and their ghosts, the fab; `openItem` → four chips with M struck; L + one more → `Pay $50` / `Total $50 for 2`; Buy → the stubbed `?paid=` → the receipt `Paid — thank you | 2 × Tour tee (M) · $50 | Show this at the merch table | K7PQ`, `paid=` stripped; `/demo/community?live=1` → `.shopcard` at `children[1]`, tipbar at `children[2]`, zero `[data-buy]`; `/v/demo/shop` → *Pay here, pick up at the bar.*; `?cancelled=1` → *No charge — your card wasn't touched.* Screenshots in `scratchpad/shots/`.

`node tools/overview.mjs --check` after the documents in this session → `overview is current`.

## The founder's look on the localhost, and five tweaks

`node tools/mock.mjs` (new, zero dependencies: a mock API and static server for every page and state of this batch, indexed at `/`) was built so the founder could inspect before the push. His verdict — "looks awesome" — came with five changes, all made in this session and recorded under decision 0064 ("The founder's look, the same day"):

1. **Make a request.** The shop's *What fans said — the community page* button is now *Make a request*: a sheet (one textarea, an optional name) posted as `action:'wish'` to `/api/community`, kept per owner by the new `netlify/functions/_wishes.mjs` (`wishes_<owner>`; three a day per phone, a per-network ceiling, the newest hundred; the owner cannot ask their own shop). `admin.mjs` and `venueadmin.mjs` gained `wishList`/`wishDone`; both Studios list them under the orders as **Requests from the shop** with Done/Undo. A request carries no way back to the fan — INVARIANT 0fp. The empty shop offers the same button.
2. **Community ↗** as a crumb beside the MySet mark, pointed at this page's community page.
3. The fan's earlier orders (*Your last order · K7PQ · Tour tee × 2*) moved to the foot, the date dropped; a tap re-opens the receipt above the grid and scrolls there.
4. The promise line: *Pick up at a show or shipped to your door — options vary per item.*
5. *What the room said* → *What fans are saying* (the average alone in the heading; the count no longer fits at 375).

The mock learned the same: `POST /api/community` `wish`, `wishList`/`wishDone` for both Studios, three fixture requests, two new index rows (`/demo/shop#ask`, the Studio row counting open requests). Puzzle: step 370744 *Make a request* in section 41974, connected to *See new orders*; changelog 1648 re-bodied.

### The gate on the final bytes

- `sh test/run.sh` → exit 0, 45 suites, **2,867 passed, 0 failed** on the tree rebased onto `15beca1` (the business dashboard, 0065; `node tools/overview.mjs --tests` stamped it); `test/community.mjs` +18 for the request path (the words folded, the 429 with the page's words, the owner's 403, the Studio's list without the device, done/undone, the venue's list); `test/copy.mjs` +6 pins (the button, the crumb, the foot, the strip title, the promise, both Studios' Done/Undo).
- `node tools/uicheck.mjs` → 228 ✓ (the dashboard's Money-tab pass included); `node tools/sheetcheck.mjs` → 39 ✓; `node tools/overview.mjs --check` → current (§2.1 The shop gained the request caps row).
- Headless Chrome on the mock at 375: the crumb resolves to `/demo/community` (`/none/community`, `/v/demo/community`); *Make a request* → type → *Send to Demo* → *Sent to Demo* with the words quoted, no console errors; `/studio?tab=merch` → *Requests from the shop · 3 new* with the fresh one on top → Done → *2 new*, the row dimmed under the open ones; `/venues?tab=merch` → the same section with the venue's rows; both themes.
- `wc -c public/shop.html` → 81,965 raw / 26,739 gzip.

## Not checked

- **The gate after the *More from {First}* strip.** `public/shop.html` was still being edited (the strip inside the sheet, `undrift()`) when this note was written; `sh test/run.sh`, `node tools/uicheck.mjs`, `node tools/sheetcheck.mjs` and `node tools/overview.mjs --tests` must run once more on the final bytes before the push, and the sizes above re-measured.
- Real Stripe: `shipping_options` + `shipping_address_collection` + `product_data.images` on a Connect direct charge (the secrets are unset outside production). The first real posted-with-postage sale is the check — watch the session in Stripe for the *Postage* line, the address, the picture, and that the application fee equals the plan's cut of the line alone.
- The fee-split correction against a real balance transaction with postage on it.
- Apple Pay and Google Pay inside Instagram's (and Facebook's, TikTok's) webview — the page shows a hint and falls back to card; whether the wallets appear is unmeasured.
- A real phone: iOS Safari, VoiceOver/TalkBack on the sheet and the code, a real touch drag on the size row, the `:focus-visible` ring on the programmatic title focus (the harness paints one; a real tap should not).
- The deploy preview at phone width in both themes — the founder's look, before the merge.
- `prefers-color-scheme: dark` via the OS (only `data-theme=dark` was exercised); the `lastSeen` paint with `app.css` evicted.
- Production image sizes: the 480 px WebP export was measured in the harness, not on a phone's camera roll.
- `tools/clipcheck.mjs` still hardcodes `ROOT='/Users/…/MySet/public'` (out of scope; the same one-line fix as uicheck/sheetcheck applies).

## Readings to confirm

Blueprint §8.4's list, for the founder or the next session on a real phone and the preview:

- `wc -c public/shop.html` and its brotli size on the final bytes.
- DevTools LCP on the shop at Fast 4G, cold and warm — the cold-function risk (the community read is the one call).
- The marquee speed as measured (`scrollLeft` delta per second) on the quotes strip and the *More from* strip — the harness read ≈ 28 px/s (+19 px over 700 ms).
- Apple Pay presence on Stripe's page in Safari and in Instagram.
- The tipbar's `children` index on the community page with and without merch (uicheck says 2 and 1).
- Whether the founder wants the Picks strip (`?picks=1`) on by default — the evidence is against it; the toggle is one line. (A shop under six items shows nothing under the flag — compare on the seven-item fixture.)
- The Pay button's contrast route (L10): 19/700 on the gradient passes as large text only; ink on the gradient or a darker orange end is a token afternoon.

## Not done

- The rest of `admin.mjs`'s `CAPABILITY` map is stale (`songSet`, `bulkSongs`, `setChart`, `setLyrics`, `listSave`, `listApply`, `eventUnskip` name no handler); left alone because gating library actions without checking which reads crew needs for the show risks the gig. Worth its own session.
- The Venue Studio has no failure row for a `merchList` that does not answer — its items ride on `get`, so only the caps go unstated (the server still trims and the toast still reports).
- `orderDetail` in `admin.mjs` still returns `order` with `fan` — pre-existing; nothing reads it.
- A shop link on `artist.html` so the Bar Star card's "in-app merch store" promise is literally true from the artist page (blueprint L11) — next PR.
- `.sect` headings on the artist and community pages still use `--accent-2` text; the shop's ink-plus-bar recipe is the one to unify on (blueprint S11).

## Shipped

Rebased onto `15beca1` (the business dashboard, 0065, had merged meanwhile — conflicts in `studio.js` (`setTab`, the reset line), `tools/overview.mjs`, `tools/uicheck.mjs`, `tools/sheetcheck.mjs` (`ROOT` = `MYSET_PUBLIC` || the tool's own `public/`), the ledger, and the generated files re-made). Renumbered on the way: UX-040 → **UX-044** (#28 took UX-040), INVARIANTS 0fn → **0fo**, 0fo → **0fp** (0065 took 0fn); Puzzle step notes re-pointed. Gate on the rebased tree: suite exit 0, 45 suites, 2,867 ✓; uicheck 228 ✓; sheetcheck 39 ✓; overview current. Pushed as `e85cae8` + push-log `d4d47ec`, PR #33, preview looked at 375 px (the founder's page lists no merch, so the empty shop with *Make a request* and a community page with no card and no Buy — nothing to Buy on a preview, and nothing was), merged as **`406f3f4`**, live by content 30 s later. Puzzle 41974: twelve steps `Live`.
