# Session record — 2026-09-04 — the product batch (new account, first day)

Written as the work happened, per Perry's rule: everything done, recorded in detail,
in the project. Companion to `HANDOFF-MySet.md` (the running log) and `MYSET.md`
(the handover). Commits: `a2b6088`, `67f1d36`, `0b8e180`, `be0865a` (docs), then the
checkpoint after this record was started.

## What Perry asked for (his words, condensed)

1. Deep analysis of the migrated project; verify `MYSET.md` against the code.
2. Back up the content engine to GitHub. Remove the "two failures" story
   everywhere (it never happened). Update the email sender to hello@myset.vip and
   explain how to connect Instagram. Remove the fuzzy icons. Mirror everything to
   the SSD, always.
3. The verification tick on the public artist page. A menu icon top-right on artist
   and venue pages (Artist Studio / Venue Studio, sign-up if none). A Community
   button beneath Fans, right of Songs; rename "audience" → "fans". A community page:
   500-char comments, 1–5 stars, pick the show, photos and videos, anything else
   cool. A merch carousel at its top, managed from a Merch tab in both Studios, a
   $10/mo Plus feature. Faster pages / a faster loading screen. Auto-start shows at
   gig time and auto-end 3 h after the scheduled end. Move the Open/Paused toggle
   to the top of the Live tab with an orange ring, big orange "Voting", orange on-side.
4. (Second round) Photos load slowly — optimise, and lay out every option for the
   whole app with a plan. The night picker only showed Ugly Duckling. White flash
   when opening the public page from the Studio. Align the tick with the name and
   the Community button with Fans. An Upgrade button / plan tag top-right of both
   Studios with a plan sheet, testimonials, downgrade flow with a 50%-off retention
   offer, "transaction fees" in orange. A proper account system. An auto-start
   on/off switch. Venue Stripe Connect like artists, with Stripe's fees split.
   Always record everything in detailed .md files in tidy sub-folders.

## What was found (the analysis)

* The app was healthy and live; 854 assertions passed at the start.
* `MYSET.md` was stale in nine numbers (tests 578→854, invariants 133→162, actions
  88→90, libraries 26→29, amenities 20→22, two storage keys, the env-var truth).
* The content engine had grown to 38 posts / 26 reels / 21 templates, all
  unapproved, with NO git remote and the SSD unmounted — single copy on the Mac.
* The last thing built by the previous account was a 15-variation hand-mark logo
  exploration (`brand/logo-hands/`), never shown to Perry.
* Two PWA icon files and a section of `MYSET.md` were deleted in the working tree.
  Perry confirmed both deletions were deliberate.
* Production env: `ADMIN_CODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `RESEND_API_KEY` only. Spotify import and push alerts are off; sign-in mail comes
  from resend.dev.

## What was built, file by file

### Housekeeping
* `MySet-Content` → `github.com/perryidyll/myset-content` (private), logo work
  committed, `.env.example` added.
* The false "two failures" story removed from `MYSET.md`, `INVARIANTS.md` (5c and
  the Connect note), the strategy doc, the workplan, both `HANDOFF-MySet.md` copies
  (and the buyer's email address that was recorded there), and memory. A feedback
  memory records why it matters (over-precaution).
* `public/icons/icon-192.png` and `apple-touch-icon.png` removed; three manifests,
  seven pages and `sw.js` repointed at the 512s.
* SSD mirror: MySet (with .git), MySet-Content (with .git), MySet Social Media,
  Project Handoffs, memory, skills.

### The tick, the menu, Fans, the Community button
* `profile.mjs`: `verified: !!who.verified && planOf(who) !== 'free'` (0bn read side),
  plus `live/venue/city/showId/merch` so the artist page drops its `/api/show` call.
* `artist.html`: `.vbadge` chip (now on its own line under the name), dark override,
  `<details class="menu">` with two doors decided from localStorage tokens,
  'Fans' label, `.ps.cta` Community cell, centred stats grid, Image-CDN cover and
  portrait with fallback.
* `venue.html`: same menu, dark override on the existing chip, Community pill.
* `about.html`, `manifest.webmanifest`, `_warehouse.mjs`, `studio.html`: every
  public "audience" → "fans"; `test/copy.mjs` pins it (the founder's quoted
  testimonial is left alone).
* `_auth.mjs`, `_venues.mjs`: `community, merch, shop, store, orders, c` reserved.

### The community page and merch
* `_community.mjs` (new): posts doc `posts_<owner>`, likes doc `likes_<owner>`,
  `addPost` (limits inside the CAS: 3/day/phone, 1/show/phone, 150/day/network),
  `likePost`, `reportPost`, `moderate` (hide/pin/reply/delete + photo cleanup),
  `parseVideo` (YouTube embed; Instagram/TikTok as links), public and owner shapes
  (never a device id).
* `community.mjs` (new): `GET ?a=|?v=&fan=` and `POST {action}`; `pickableNights`
  from the calendar (last 120 days, one per venue+date) merged with the archive.
* `_profile.mjs`: `MAX_MERCH=12`, `MERCH_ID`, `normMerch`, `merch: []` on the
  profile. `_venues.mjs`: `merch` on the venue record, `VENUE_PLANS` gains
  `merch` (Pro) and `reviews: true` on both rows; `VENUE_NOT_BUILT = ['tips',
  'speakerVotes']`; `shapeVenue` shows merch only while the plan has it.
* `_plan.mjs`: `merch: false/true/true`; `merchAllowed(aid, limits)` (founder
  included). `admin.mjs`: `shapeLimits` forwards `merch`; `handleShop` with
  merchList/Save/Remove/Photo/PhotoClear, postList/Hide/Pin/Reply/Delete,
  orderList/Done/Detail (buyer details fetched from Stripe, both shipping
  shapes, never stored). `venueadmin.mjs`: the same families; a venue item must
  carry a link.
* `_img.mjs`: `MERCH_SLOT`, `POST_SLOT`, `isSlot()`; `img.mjs` uses it and sets
  `netlify-cdn-cache-control: durable`.
* `pay.mjs`: `kind:'merch'` priced from the record, `shipping_address_collection`
  only for posted items, `success_url` → the community page. `_pay.mjs`: a merch
  session writes an order inside the claim (`meta.orders`), delivered on the spot.
  `revenue.mjs`: merch is ours; `totals.merch`. `_lib.mjs`: `orders` on meta.
* `community.html` (new): owner strip with tick and Share, merch rail (Buy / Get
  it ↗ / Ask at the show), composer (stars, text + counter, night picker, name,
  video link, photos shrunk on the phone), feed (hearts, report sheet, replies,
  pins, lightbox), checkout return with its own pending/redeem copy, black splash.
* `studio.html`: Merch tab (locked on free with the plan named), orders on Merch
  and Money, community moderation on Profile, plan card line, crop → merchPhoto.
* `venue-studio.html`: Merch tab (link-only, Pro), moderation, plan rows.
* `vote.html`: "Say something about tonight →" on the wrap-up screen with the
  night pre-selected. `show.mjs` carries `showId`.
* `netlify.toml`: `/:slug/community` and `/v/:slug/community` → `community.html`.

### Shows that start and end themselves
* `_lifecycle.mjs` (new): `startShow(aid,{fresh,by,occKey})` and `endShow(aid,{by})`
  extracted from admin.mjs's CAS switch — cap before, count inside the CAS, archive
  before wipe, calendar setlist, paid-vote carry, the already-live no-op that still
  applies the setlist (a test depends on it). `admin.mjs` delegates `newShow`,
  `status:'live'` and `status:'ended'`; `status:'pre'` stays in the switch.
* `_auto.mjs` (new): `currentOccurrence`, `nextWindow`, the `gigsched` global index
  (`reindexSched` on every calendar write), `autoTick` (start once per gig, never
  restart a night the artist ended, no start with no songs on, end at +3 h unless a
  song started in the last 45 min, venues never), `sweep` (bounded, defers), `heal`
  (daily registry walk with a cursor — without it gigs saved before the index
  existed would never start). `autocron.mjs` (new): `*/2 * * * *`, MIN_GAP,
  lock, logged marker, never throws.
* `_history.mjs`: a night with nothing in it is not archived.
* `stage.mjs`: `startedBy`, `endedBy`, `sched` (tonight's gig, +1 read), `autoStart`.
* `studio.html`: "Started by itself…" lines; Settings → Start shows from my calendar.
* Verified on production: the heal ran on the first ring and Perry's gig that
  evening started his show by itself (`startedBy: 'schedule'`); he was playing.

### The Voting box and boot speed
* Header and Settings toggles removed; `.votebox` at the top of Live.
* `planGet` beside `/stage`; owner lists off the path and quiet; `drawPush` not
  awaited; `@keyframes bb` defined (the boot bars had never animated);
  `--accent-ink` defined; `html{background:#000}` inline first; `lock.css` and
  `pull.js` after the boot markup.

### Tests
`test/autoshow.mjs` (63), `test/community.mjs` (113), `test/copy.mjs` (22) added;
`limits.mjs` lists moved on purpose; `cost.mjs` globals gained `gigsched`.
1,059 assertions across 22 suites at the checkpoint.

### Docs
`MYSET.md` re-verified and extended (2.9, 3.1/3.2, 4.x, 4.9, PART SEVEN);
`INVARIANTS.md`: 0o, 9d9, 17c, 5b rewritten; 0ck–0cq added (169 total);
`PERFORMANCE-PLAN.md` (every option, ranked, with the order); handoff logs;
memory (`project_myset_app`, `project_myset_content_engine`,
`feedback_myset_first_gig_was_fine`, `feedback_record_everything_in_md`).

## Decisions taken without Perry, and why
* Venue merch is link-only and Pro (no venue payout account; no $10 venue tier) —
  **superseded by his second-round ask for venue Connect; see the next record.**
* Videos are links, not uploads (6 MB function body).
* Buyer name/address never stored; fetched from Stripe when an order is opened.
* Merch takes the plan's cut like a tip; pickup asks for no address.
* "Fans" counts phones in the room; no follow exists (written into 0cq).
* No independent multi-agent review of the money path — skipped for usage at
  Perry's request; covered by 1,059 tests, headless renders, live content checks.

## Verified how
`npm test`; headless Chrome renders of artist, community, Studio Live/Merch/Profile
with the API stubbed (screenshots sent to Perry); content checks against
myset.vip after each deploy; `tools/prod.py get gigsched` and `show_perry-idyll`.

## Still open after this record
Second-round asks: upgrade button + plan sheet, billing and the account system,
venue Stripe Connect and the fee split, two-size photo uploads, head prefetch.
Perry: Resend domain → `AUTH_FROM`; Instagram Business + token → `.env`.

---

# Pass two — plans you can pay for, venues that get paid, accounts that can leave

*Same day, same session, after Perry's third message. Everything below was built,
tested (1,123 assertions / 22 suites), rendered in headless Chrome, and deployed.*

## What Perry asked for (third message) → what shipped

| Ask | Shipped |
|---|---|
| Profile photos load slowly; every speed option + a plan | Durable CDN cache on `/api/img`, Netlify Image CDN on the artist page, inline critical CSS + preloaded app.css (pass one); `PERFORMANCE-PLAN.md` |
| Community night picker only showed Ugly Duckling | `pickableNights()` walks the calendar, one entry per venue+date (pass one) |
| White flash tapping the name from the Studio | `html{background:#000}` first, splash markup before blocking scripts, both Studios and all public pages (pass one) |
| Verified tag left edge = name box; Community centred under Fans | Done (pass one) |
| **Upgrade button / green plan tag top right, with the arrow** | `.upg` (orange outline) on free, `.plantag` (green) with the plan name when paid, both `↗`, both Studios |
| **Plan sheet**: 3 tiers, orange boxes, orange banner, numbered full lists, testimonials carousel, "transaction fees" in orange | `openPlans()` in both Studios; `TIER_COPY` / `VTIER_COPY`; placeholder `TESTIMONIALS` arrays |
| Settings mini-table → one big green button | `.bigup`: "Upgrade your plan" (free/Plus) or "Pro membership" (Pro); portal link beneath when subscribed |
| Pro downgrade: confirm (No orange, Yes grey) → 50% off one month → track and bill | `confirmDowngrade` → `retentionOffer` → `planRetain` (Stripe coupon on the live subscription, once ever) or `planChange` |
| **A proper account system** | `_billing.mjs` (Stripe Billing), `_account.mjs` (export + delete), `ACCOUNTS.md` (the design, what exists, what's next) |
| Auto-start on/off in Settings | Done (pass one): "Starting by itself" On/Off |
| **Venues: Stripe Connect direct payments, fee to MySet, Stripe's fee split evenly** | `_connect.mjs` keyed by owner (`v_<vid>`), `feeCents(amount, plan, 'venue')` with `splitFee`, Venue Studio "Getting paid" card + orders, venue merch checkout in `pay.mjs` |

## Files touched in pass two
`netlify/functions/_billing.mjs` (new) · `_account.mjs` (new) · `_connect.mjs` ·
`_venues.mjs` · `admin.mjs` · `venueadmin.mjs` · `pay.mjs` · `confirm.mjs` ·
`webhook.mjs` · `public/studio.html` · `public/venue-studio.html` ·
`test/stripe-fake.mjs` (rewritten: customers, prices, coupons, subscriptions, portal,
subscription-mode checkout) · `test/billing.mjs` (new, 65) · `test/connect.mjs`
expectation kept (`myset_artist` stays in account metadata beside `myset_owner`) ·
`ACCOUNTS.md` (new) · `INVARIANTS.md` (0cr–0da) · `MYSET.md` · this record.

## Bugs I made and fixed before shipping
* `_account.mjs` called `KEY.req()` / `KEY.lyr()` which do not exist — literal keys
  `req_<aid>`, `lyr_<aid>_<song>` now; and the billing suite asserts that after a
  delete **no key in the store still carries the artist's id**, so the enumerated
  list cannot silently fall behind.
* Renaming Connect metadata `myset_artist` → `myset_owner` broke the existing
  Connect suite; artists now carry both.
* A $12 cap on venue Pro: 2% (24¢) minus half of Stripe's ~65¢ floors at **0¢**, so
  no `payment_intent_data` is sent at all; the test read a field that wasn't there.
  Behaviour is right and is now written down (ACCOUNTS.md §3, INVARIANT 0cx).
* Settings said "Free, forever" on a comped Pro with no end date → "Active".
* The account row was blank when signed in by Studio code → "Signed in with the
  Studio code".

## Verified how
* `npm test` — 22 suites, 1,123 assertions, green.
* Headless Chrome against `netlify dev --offline` with `ADMIN_CODE=devlocal`
  (the dev server rejects the owner code without it — that cost one blank run):
  Studio header on free and Pro, the full plan sheet (3 tiers, fees
  `10% / 2% / 0%` in orange, no "everything in…", no "cut"), downgrade confirm,
  retention offer, Settings plan button in both states, the account section, the
  delete sheet; Venue Studio sheet (2 tiers), header on free and Pro with the
  Verified pill beneath, Settings button, the Getting-paid card.
* Commit `6fae274` → `main` → live in ~20 s; checked by content: `/studio` carries `.upg`, `.plantag`, the sheet, the downgrade copy and the account section; `/venues` carries the two-tier sheet and the Getting-paid card; unauthenticated `planCheckout` and `payStatus` return 401 (the functions deployed and fail closed).

## Decisions taken without Perry, and why
* **Stripe Billing, not a home-made ledger.** Renewal dates, failed cards and
  invoices are Stripe's problem; the app mirrors the plan only. Two paths to the
  truth (webhook + return-trip/6-hour sync) so a dropped webhook never costs a plan.
* **The 50% month is a Stripe coupon on the live subscription**, once per account,
  server-enforced — that is what "track it and bill accordingly" has to mean if the
  bill is ever to be right.
* **The fee split is an estimate at checkout**, floored at zero, said plainly in the
  Studio. The exact version (post-charge transfer) is described, not built — the
  amounts today are cents.
* **Artists are not split**; Perry asked for the split for venues.
* **Members cannot bill or delete**; the founder cannot be deleted from the app.
* Testimonials are labelled placeholders; the array is the architecture.

## Perry still has to (Stripe dashboard, once)
1. Webhook events: `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed` (and `checkout.session.completed` already there).
2. Customer Portal: save the default configuration in **live** mode.
Everything else (products, prices, coupons) is created by the app on first use.
