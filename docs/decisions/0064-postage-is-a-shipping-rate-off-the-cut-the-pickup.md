---
id: 0064
title: Merch has its own page at /<slug>/shop, entered from a ringed card above the tip button; postage is a shipping rate off the cut, the pickup code is a lookup key, sold out is not off, and the owner id is kept whole
date: 2026-09-13
status: decided
decided_by: the founder
area: money
reverses:
superseded_by:
invariants: [5b, 0f8, 0cn, 0fo, 0cm]
commits: []
tests: [test/community.mjs, test/billing.mjs, test/accounts.mjs, test/copy.mjs, test/fandoor.mjs, test/structure.mjs, test/unit.mjs, test/stripe-fake.mjs, tools/uicheck.mjs, tools/sheetcheck.mjs]
files: [public/shop.html, public/community.html, public/studio.js, public/studio.html, public/venue-studio.js, public/venue-studio.html, netlify.toml, netlify/functions/pay.mjs, netlify/functions/_pay.mjs, netlify/functions/_profile.mjs, netlify/functions/_venues.mjs, netlify/functions/_feesplit.mjs, netlify/functions/confirm.mjs, netlify/functions/webhook.mjs, netlify/functions/admin.mjs, netlify/functions/venueadmin.mjs, netlify/functions/revenue.mjs, tools/overview.mjs, INVARIANTS.md, MYSET-MASTER-OVERVIEW.md]
---

## The question

Until 2026-09-13 merch was a rail of cards near the top of the community page: one
price, one Buy, no sizes, no way to say "sold out" without switching the item off, no
postage figure, and a receipt that was a Stripe email. The founder asked for a shop —
merch on its own page — and, with it, the four things a real merch table needs: sizes
or options on an item, a sold-out state that keeps the item visible, a flat postage
figure on a posted item, and a short code the person at the table can match to an
order without reading a Stripe receipt in a loud bar.

Each of those had an obvious first answer that turned out to be the wrong one, and
each wrong answer looks like a correction to whoever reads the code next. This record
exists so that nobody "fixes" them. It also records where the shop's front door sits
on the community page (the founder's 2026-09-13 order supersedes 2026-09-07's "the tip
button is the first thing under the name"), what moves on the shop and what does not,
where the Studio keeps the store, and a fifth choice — about the owner id — that the
shop's venue redeem test forced.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A page of its own at `/<slug>/shop` and `/v/<slug>/shop` (one file, `public/shop.html`, reading `/api/fan?what=community` with no `fan=`); the community page keeps only a ringed, finder-sized card under the name and **above** the tip button, drawn only when there is at least one item; the rail retired; a static two-column grid with two drifting strips (the room's starred posts on the page, *More from {First}* inside the product sheet), the artist page's `drift()` verbatim; a product-picks strip after the grid behind `?picks=1` (drawn only with six or more items) for the founder to compare; sizes as `variants[{label,out}]`, `out` separate from `on`, postage as a Stripe `shipping_options` fixed rate with MySet's fee on the line alone, the item photo on Stripe's page; `/api/confirm` returns the order with a 4–5 character pickup code; `pay.mjs` takes `from:'shop'` and builds the return path itself; the Studio's Merch store is its own Menu row; `cleanOwnerId` keeps the `v_` prefix | Two new routes and two cache headers; a third page that redeems (5b); a shipping rate every earnings read has to leave out; a code that proves nothing; two invariants amended (5b, 0f8), one added (0fo), two rewritten (0cm, 0cn) | `shop.html`; `shippingRate()`, `pickupCode()`, `cleanOwnerId()`; `variants`/`out`/`post` on the item; `merchList` sending five caps; the `merch` tab back in the Studio | A fee split later computed on the whole charge (guarded by `metadata.base`); a buyer who reads the code as proof of payment (the Studio's Done button is the fulfilment, and the copy says so) |
| B — keep the rail, add the fields to it | Sizes and postage on the community page's cards | A community page that is half a shop; a Buy surface on a page whose job is what the room said; the sheet, the receipt and the code all crowd the page the tip lives on | none new | The page that carries the proof and the ask becomes the page that sells, and nobody finds the tip |
| C — the shop as a view of `community.html` (`?shop=1`) | No new file; the community page draws the grid instead of the feed | One file doing two jobs, two return trips through one `handleReturn`, the 60 s edge cache keyed on a query that is also state | none new | A change to the feed breaks the shop, or the reverse — the very coupling 5b's "copied on purpose" exists to prevent |
| D — card **below** the tip button (2026-09-07's order kept) | The tip stays the first thing under the name | The shop's front door under the one button most visitors came for; on a night with merch on the table the card is below the fold | none | Merch sells less than it should for the artist who bothered to list it |
| E — products in a drifting strip (the reference stores' carousel) | The merch itself moves | 0 of 6 rendered reference stores auto-move products; Baymard and NN/g both find auto-forwarding carousels lose the item a person was looking at; a moving Buy is a moving target | none | A fan taps the wrong item, or none |
| F — fee on the whole total | `feeCents(line + post)` | MySet takes a cut of a stamp the artist merely passes through | none | Artists who post a lot are over-charged on every order |
| G — code from the fan id | `sha(fan)` prefix as the pickup code | Puts a derivative of the audience device id on a receipt and in the Studio (0bu) | none | Two orders from one phone say the same code; the id leaks |
| H — sold out as `on:false` | Reuse the switch that exists | The item disappears from the page; a fan who saw it last week thinks it was pulled | none | Nothing sells because nothing is shown |
| I — the store stays inside Profile | Leave the 2026-09-12 fold alone | Items, sizes, postage and orders as a section of a form about the name and the links; the orders list three scrolls down | none | The artist at the table cannot find the code list |
| J — `cleanArtistId` as-is | Leave the owner resolution alone | The `v_` prefix is stripped, venue orders land in an artist-shaped document nobody reads | none | The Venue Studio never sees a sale — on the return trip AND on the webhook |
| K — do nothing | Keep the community rail as it was | Shirts sell as one size, postage comes out of the artist's price, the table matches faces by email, the artist's plan card promises an "in-app merch store" the page does not have | none | The shop is not a shop |

## What was chosen, and why

- **A page of its own.** `/<slug>/shop` and `/v/<slug>/shop` both serve `public/shop.html`
  (two `[[redirects]]` above the `/:slug` and `/v/:slug` catch-alls in `netlify.toml`,
  with the same `max-age=60, stale-while-revalidate=600` header the community page has).
  `shop` was already a reserved slug for artists and venues, so the path can never be
  somebody's profile. The page reads `/api/fan?what=community` — the one warm door
  (0049) — with **no `fan=`**, because the shop needs no likes and the fan id belongs
  only on `/api/pay` and `/api/confirm`. It never polls: one read at open, a pull, a
  re-read after five minutes away. The community payload carries `canBuy` and the
  items, not the caps: the shop page holds the price floor and the per-order quantity
  clamp as literals mirrored from `pay.mjs` (the Studio is the one that reads every cap
  from `merchList`, below). The numbers are in overview §2.1.
- **The community page opens the door and sells nothing.** A ringed card — the home
  page's finder chassis (`--surface`, `--r-lg`, `--sh-2`, `18px 18px 20px`) wearing the
  brand-gradient ring (0059) — sits under the name and **above the Support tip
  button**, with a fanned trio of item photos, `{First}'s merch`, the item count, and
  the phone's last order code when it has one. The founder's order on 2026-09-13 (door,
  tip, proof, feed) supersedes 2026-09-07's "the tip button is the first thing under the
  name"; INVARIANT 0f8 is amended to say so. The card exists **only when the community
  read returns at least one item**, so on most artists' pages the tip is still first,
  and no card ever leads to an empty shop (rule 3). The merch rail, its buy sheet and
  every `data-buy` are gone from `community.html`; what stays is the tip sheet and
  `redeem()`/`handleReturn()`, because a tip started there returns there and a merch
  session created before this deploy still carries a success URL to that page (5b, 5c).
- **Products stand still; two strips move.** The grid is a static two-column grid at
  every width down to 320 px, square pictures, one `<button>` per card into the sheet.
  The evidence against moving products is uniform — 0 of 6 rendered reference stores
  auto-move them, Baymard and NN/g both find auto-forwarding product carousels lose the
  item a person was looking at, and Shopify's own Dawn and Horizon themes ship a grid.
  What drifts is proof and discovery, not the merchandise: **What the room said** (the
  starred posts with text, pinned first then newest, eight at most, each a way to the
  community page) on the page, and **More from {First}** (every other item on the table,
  sold-out ones dimmed) inside the product sheet, under the photo where Shopify puts it.
  Both run the artist page's `drift()` and `ghost()` byte for byte — 28 px/s, the set
  drawn twice so the loop has no seam, a finger stops it, one ⏸ that is remembered in
  `myset.shop.still`, static and drawn once under `prefers-reduced-motion`. A third
  strip, **Picks** (the five newest items), exists after the grid behind `?picks=1`, and
  only when the shop holds six or more items (`PICKS&&merch.length>=6` in `shop.html`),
  so the founder can compare it on the preview; it is off by default because the evidence
  above is against a product strip, and it sits after the grid so the grid's second row
  of prices stays above the fold either way.
- **The product sheet, and Pay never disabled.** A bottom sheet (0f0–0f2, the community
  page's mechanics plus: the page behind is `inert`, focus lands on the title and
  returns to the card), one history entry per item (`#m<id>`, so Back closes it and a
  cancelled Stripe trip reopens the same item with the same size and quantity). Title →
  price → the fulfilment line → sizes as radio chips (a sold-out size struck and
  disabled, ", sold out" for a reader) → quantity, from one up to the per-order clamp
  `pay.mjs` applies (a literal there and in `shop.html`, not yet a row in §2.1) → the
  commit, sticky, labelled
  with the total → the blurb → the picture → *More from*. With sizes and none chosen the
  button reads *Pick a size* and stays enabled: a tap scrolls the size row into view and
  nudges it, which is the blueprint's rule (§3.3/§3.8) — a disabled button is a button
  that leads to a shrug. A state that cannot pay gets a different control with a
  different verb (*Get it on {host} ↗*, *Ask at the show*, *Close*), never a greyed Pay.
- **The three states are the server's answers, never a local flag (0fo).** Buy only
  when `canBuy` and the price is at or above the floor in §2.1 (`MIN_CENTS`) — the same
  `merchAllowed`/`canTakeMoney` answers the checkout gives — else the item's link, else
  *Ask at the show* (a venue: *the bar*).
  Sold out (`out`, or every size out) keeps the price and offers nothing. The sheet's
  total is the line plus the record's `post`, exactly what Stripe's page will ask, so
  the number on the button is never a surprise on the next page.
- **Postage is a Stripe shipping rate, never part of the line.** The fee is
  `feeCents(amountCents(line))` next to a `shipping_options` entry with
  `shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: item.post }, display_name: 'Postage' }`.
  Postage is a cost passed through, not revenue anybody sold, and the total on Stripe's
  page must equal the total the sheet promised. A pickup item never gets a rate,
  whatever `post` says on the record. The payment intent carries `metadata.base` (the
  line amount) so the later half-of-Stripe's-fee correction (`_feesplit.mjs`) estimates
  on the same base and does not short the venue by half the fee on the postage. The
  item's picture rides on the Stripe page as `product_data.images` when it has one; the
  line names the size.
- **The pickup code is a lookup key.** Four characters from `sha256('pickup|' + sid)`
  over `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I, so it can be said across a
  room), a fifth character only when it clashes with another OPEN order of the same
  owner, minted inside `redeemSession`'s CAS so two orders landing together cannot both
  take the short form, and back-filled from the session id for rows written before
  codes existed (the clash rule compares against what an old row *shows*, not what it
  stored). Never derived from the fan id, never a secret, never proof of payment —
  `orderDone` is the only fulfilment. `/api/confirm` returns the order (`pubOrder`:
  item, title, qty, variant, ship, cents, post, code, at — never the fan) so the shop
  can draw the receipt: a drawn tick, `3 × Tour tee (M) · $75`, *Show this at the merch
  table* and the code at 34 px, one glyph every 90 ms, `aria-label` carrying it whole
  from the first frame; on later visits a compact *Your last order · K7PQ · …* line.
  Both pages write one `myset.orders` row shape (0fo names it) so the community card
  can show the code too.
- **`out` is separate from `on`.** A sold-out item stays on the page with its price and
  no Buy; a size can be sold out on its own (`variants[].out`). A thing that will be
  back is not a thing the artist stopped selling.
- **`from:'shop'` picks a path the server builds.** `pay.mjs` maps `from` to
  `/<slug>/shop` or `/v/<slug>/shop` from the owner's own slug, as `from:'community'`
  always has; anything else lands on the community page. `from` is an enum, never a URL
  (0f8), and INVARIANT 5b now names three redeeming pages, each with its own copy of the
  pending/retry logic — copied on purpose. The shop shares `myset.pending.merch` with the
  community page deliberately: both `redeem()`s are replay-safe (7), so whichever page
  opens next finishes a lost return.
- **The Studio's Merch store is its own Menu row.** *Merch store — Items, sizes, prices
  and orders*, between *Profile — Manage your profile page* and *Settings*; `merch` is a
  real tab again (it was folded into Profile on 2026-09-12; a phone that saved `merch`
  before then simply lands on the store). The screen: *See your shop ↗*, the items under
  the plan lock (0bx), then the orders with the **code first and big** and the verb the
  artist actually does — *Handed over* or *Posted*. The editor takes sizes as one comma
  line that becomes `variants` (chips under the field mark a size sold out and save at
  once), a whole-item *Sold out*, and postage per order, and it reads every cap and the
  plan's price from what the server sent (`merchList` returns `max`, `maxVariants`,
  `variantLen`, `maxPost`, `minCents`, `maxCents`; `planGet` the price) — never typed
  in the page; `test/copy.mjs` pins that neither Studio holds a `/12` or a `$10 a
  month`. Whatever the server trimmed on save is said out loud (`merchTrimmed`), never
  quietly re-drawn. A merch photo exports at 480 px, WebP first and JPEG where the
  browser cannot write WebP — a two-up grid needs no more, and the bytes matter more
  than the pixels. The Venue Studio mirrors all of it inside its existing Merch tab
  (`V.merchMax` from `shapeVenue`; the code on its orders; *How they get it* with Posted
  + postage — the venue pay branch already supported it).
- **`cleanOwnerId` in `_pay.mjs`.** `cleanArtistId` dropped the `v_` prefix, so a
  venue's paid session was filed in a document nobody reads. Found 2026-09-13 by the
  shop's venue redeem test. `confirm.mjs` and `webhook.mjs` both resolve the owner
  through `cleanOwnerId` now, so the two paths cannot disagree about which document an
  order lives in. It is not redundant with `cleanArtistId`.
- **Tax is the artist's.** MySet computes none, collects none, and the page says nothing
  about it. The copy never says sign in, account, install, email, tax, returns, refund,
  "in your currency", "people viewing" or "hurry".

## The founder's look, the same day

Five changes from the localhost inspection (`node tools/mock.mjs`), all in this record
because none reopens the question above:

- **Make a request.** The button under "how it works" was a second door to the
  community page (*What fans said — the community page*); it is now *Make a request*:
  a sheet with one textarea and an optional name, posted as `action:'wish'` to the
  community door and stored per owner in `_wishes.mjs` (`wishes_<owner>`). Both Studios
  list them under the orders as *Requests from the shop* with Done/Undo. What was
  decided here, and could have gone another way: a request carries **no way back to
  the fan** — no email, no handle. The audience never signs in (9g) and MySet keeps
  nothing about a fan that could reach them (0bu); a request is a demand signal in the
  fan's own words, not a thread. If artists ask for a reply path it is a new decision.
  Limits inside the CAS: three a day per phone, a per-network ceiling, the newest
  hundred kept (INVARIANT 0fp). The empty shop offers the same button.
- **Community ↗ at the very top.** The way back is a crumb beside the MySet mark in the
  bar, the mark's own arrow, pointed at this page's community page (`COMMHREF`).
- **Earlier orders at the foot, no date.** The compact *Your last order · K7PQ · Tour tee × 2*
  lines moved from above the grid to just above the footer, the date dropped — the code
  and the item are what the merch table wants; a tap re-opens the full receipt above the
  grid and scrolls there. The fresh receipt (and the "Checking on your…" line) still
  paints above the grid.
- **The promise line** for a mixed table: *Pick up at a show or shipped to your door —
  options vary per item.* (a venue: *the bar*).
- **The strip is *What fans are saying*** — with the average alone in the heading; the
  post count no longer fits beside the longer title at 375.

## What this makes harder

Three pages now redeem a Stripe return, each with its own copy of the pending/retry
logic; a fix to that logic is made three times or it is not made (5b's "copied on
purpose" is the trade). The community page can no longer sell — a fan who lands there
from an old link taps a card and travels one more page. Postage never counts toward
revenue or any report: the earnings statement, the ledger and the Studio's order rows
all carry it as a separate figure (`post`) and leave it out of `cents`; anyone adding a
new money read has to remember the charge amount is line plus stamp. The pickup code
being a lookup key means the Studio cannot use it to prove a fan paid — only the order
row's existence does that. Two things on the shop drift, so every future strip on the
page has to justify itself against the same ⏸ and the same reduced-motion rule; and
the `.sect` heading recipe (ink text with a 16×4 gradient bar, because `--accent-2`
text at 13 px is 3.0–3.13:1 in light) is now on one page while the artist and community
pages still use `--accent-2` text — a follow-up to unify, not a page-local hack to copy
around. The Pay button is a 19/700 label on the gradient, which passes only as large
text; a brand-level contrast route (ink on the gradient, or a darker orange end) is a
token afternoon still owed. The shop's HTML is over the blueprint's 60 KB raw budget
(the rule-bearing comments were kept on purpose; the wire size is a third of that).

## What would reverse it

Delete the two `[[redirects]]` and two `[[headers]]` in `netlify.toml`, delete
`public/shop.html`, and restore the community page's rail and buy sheet from
`origin/main` at `34215b8` — `from:'shop'` can stay in `pay.mjs` harmlessly. Moving the
card below the tip button is one line in `community.html`'s `render()` and the reverse
amendment to 0f8. Making the picks strip permanent is deleting the `PICKS` check;
making products drift is the choice the evidence is against, and would need its own
record. If the founder wants MySet's cut taken on shipping as well (Stripe allows a fee
on the whole charge), option F is a one-line change in `pay.mjs` and a rewrite of the
`_feesplit.mjs` base. If four-character codes clash in practice more than the fifth
character absorbs — more than a few open orders per owner colliding — the code would
need to grow to five by default. Folding the store back into Profile is the 2026-09-12
alias line (`if(TAB==='merch')TAB='profile'`) and the Menu row removed. If a venue's
orders are ever seen filed under a bare artist id again, `cleanOwnerId` has a second
caller that was missed.

## How it was verified

Run in the worktree on 2026-09-13 (the integration report's final gate, before the
*More from* strip landed in the sheet — that edit is to be re-gated before the push):

- `sh test/run.sh` → the last line `44 passed, 0 failed`, exit 0; 2,434 tick lines,
  none beginning `✗`; `structure OK`, both `stamp matches` rows ✓.
- `node --import ./test/register.mjs test/community.mjs` → `213 passed, 0 failed`
  (pickup code alphabet, determinism, clash → five characters, an OPEN code-less old
  row clashes on its back-filled four, a DONE one does not; `ownerOrder` never carries
  the fan; the venue redeem lands on the venue owner; `from:'shop'` returns to the
  server-built shop path).
- `node --import ./test/register.mjs test/billing.mjs` → `115 passed, 0 failed`
  (the venue fee is the plan's cut of the LINE, not of line plus postage; the payment
  intent carries `metadata.base`; the fee split with postage gives back eight cents,
  the same as without).
- `node --import ./test/register.mjs test/accounts.mjs` → `77 passed, 0 failed`
  (crew is refused every shop and media write).
- `node --import ./test/register.mjs test/copy.mjs` → `53 passed, 0 failed`
  (the Menu offers Profile and, second, *Merch store*; `merch` is a real tab; the caps
  and the plan price are the server's; both Studios have `merchPhotoClear` and
  `toDataURL('image/webp'`).
- `node tools/uicheck.mjs` → `✓ 148 ✗ 0 PAGEERROR 0`: the community page's shop card at
  `children[1]` with the gradient `::after`, three fanned pictures, the tipbar at
  `children[2]`, and back to `children[1]` with `merch:[]`; the shop fits 390 and 320,
  two grid tracks, the seven card states, `Tonight` only on live pickup cards, `.fab`
  only while live, the quotes strip with its ghosts and ⏸, nothing moving under
  reduced motion.
- `node tools/sheetcheck.mjs` → `✓ 30 ✗ 0 PAGEERROR 0` (12 lyrics-sheet + 18
  shop-sheet under real touch events: the page frozen and `inert`, focus on the title,
  a drag from inside the size row scrolls and never closes, a pull closes through
  `history.back()`, focus back on the card).
- `node tools/overview.mjs --tests` → `stamped: 2434 assertions, 0 failing`;
  `node tools/overview.mjs --check` → `overview is current`.
- `wc -c public/shop.html` → 70,538 raw / 23,399 gzip at that gate.

Not checked: a real Stripe checkout with `shipping_options` + `shipping_address_collection`
+ `product_data.images` on a Connect direct charge (the secrets are unset outside
production — the first real posted sale is the check); the fee-split correction against
a real balance transaction; Apple Pay inside Instagram's webview; a real phone.
