# Landing page plan — the shop, the business dashboard, and the profile as the Linktree replacement

Written 2026-09-14 against `origin/main` at `9a25049`. Companion to `docs/landing/OFF-PAGE.md`.
Nothing here is built yet; this is the audit and the plan for `public/about.html`.

## 1. What shipped this week that the page does not mention

| Feature | Shipped | Decision | What a person can now do |
|---|---|---|---|
| Merch shop on its own page `/<slug>/shop` | `406f3f4` 09-13 | 0064 | Sizes/options per item; "sold out" stays visible; flat postage on a posted item (MySet's fee never touches the stamp); photo on the Stripe checkout page; a 4–5 character **pickup code** on the receipt the artist matches at the table; **Make a request** for something not listed; ringed shop card above the tip button on the community page |
| Business dashboard (Money tab, paid plans) | `81a48f3` 09-13, second pass `7691945` | 0065 | Per night: venue pay, band splits (5 / 10 people), cash tips, merch sold + quantity, costs (5 / 10), four kinds of time (stage, breaks, travel, set-up/pack-down), gear. Computed: profit, **stage-time rate vs full-evening rate**, "Total or My cut", before/after MySet's fee, revenue-mix ring. Residency rule entered once, applied to every night. A branded **report page** for any date range or hand-picked shows (Profit · Where it came from · Shows · Splits · Costs · Merch) |
| Daily payouts | 09-12 | 0044 | App money is in the bank the next business day |
| Artist page: Book + Merch doors, inbox | `a69154f` 09-14 | 0074 | A booker writes from the page (name + email), the artist answers from **Studio → Messages** (Requests / General / Business / Casual / Spam, read filters, Report, Block). Nobody's email is shown |
| Artist page: calendar + tour poster | `a69154f` 09-14 | 0075 | **View calendar** month popup with dots; **View tour dates** opens an uploaded PDF/PNG/JPEG with Download and **Grab your tickets** → booking link |
| Artist page: link strip | `466a907` 09-13 | — | Spotify, Apple Music, YouTube Music, Instagram, Bandcamp, GoFundMe, website — drifting pills under *Listen, follow, & support* |
| Artist page: hero video + strip | `34215b8` 09-13 | 0062 | The ticked video is the hero; the rest drift under *Watch more from <First>*; band names everywhere |
| Artist page: proof strip | `d980ec4` 09-12 | 0043 | Rating, what fans said, most voted / played / paid songs |
| Hero stats | 09-14 | 0075 | Joined · Shows · Fans · Votes cast, `10.1k`-style |

Everything in the table is live. Nothing on the current page contradicts it; the page simply stops at "your music, links, gigs".

## 2. The one conflict to decide first

The landing page rule (the founder, 09-06) is **no pricing, plans, tiers, fees or gating**. The dashboard is gated on `reports` (Bar Star + Rock Star). Two honest ways to write the section:

- **(a) Describe it without naming the gate** — "Artists on MySet track…" — and let the plan cards in the Studio do the selling. Keeps the rule. Risk: a free artist opens the Money tab and does not find it. Mitigation: the Studio already shows the plan line in place of the tile.
- **(b) One neutral clause** — "on the paid plans" — no price, no tier name. Breaks the letter of the rule, keeps its spirit (no pricing).

Recommendation: **(a)**, with the FAQ answer "Is the dashboard free?" → "It comes with the paid plans; the free plan has the Money tab with every dollar fans sent you." That puts the gate where questions already live, not in the pitch.

## 3. New sections — copy direction and placement

Current order: Five things happen · Boring parts done · Not about the votes · Stop telling venues · Upcoming events · FAQ · CTA.

Proposed order (three new sections, one moved):

1. Five things happen *(unchanged)*
2. The boring parts are already done *(unchanged)*
3. It's not really about the votes *(unchanged)*
4. **NEW — "Your page. Not a list of links."** (the Linktree replacement, §4 below)
5. **NEW — "Sell the shirt. Match the code."** (the shop)
6. **NEW — "Know what the night actually paid."** (the dashboard)
7. Stop telling venues you draw a crowd *(now stronger — the proof strip + Book button feed it)*
8. Upcoming events *(unchanged; add "and a map", "or the next few weeks")*
9. FAQ *(add three answers)*
10. CTA

Why this order: 4→5→6 is the money story in the order it happens to an artist — people find you, they buy something, you see what it added up to. Section 7 then closes on bookings, which is where the dashboard's report and the Book button both point.

### 3a. "Sell the shirt. Match the code." — the shop

Claims that are true today, in the page's voice:

- Your merch has its own page — `myset.vip/you/shop` — one tap from your profile and from the voting page.
- Sizes and options on anything. Mark a size sold out and it stays on the page instead of vanishing.
- Postage is a flat figure you set. It goes to you whole. *(0064 — the fee sits on the item line alone.)*
- Every order comes with a short pickup code. Read the code at the table, hand over the shirt. No email, no receipt-hunting in a loud bar.
- "Make a request" — a fan asks for the thing you didn't list; it lands in your Studio.
- Paid through Stripe, straight to your account, in your bank the next business day. *(0044 — say "through Stripe", never "100%".)*

Screenshot: the shop grid on a phone + the pickup-code receipt. Alt text must say what is visible.

Do NOT say: quantities caps ("five per order"), price floors, the fee percentage, anything about the picks strip (`?picks=1`, founder-only).

### 3b. "Know what the night actually paid." — the dashboard

The founder's own line is the headline material: *"people think 'oh you get $x just to play music for 2 hours' but in reality it takes like 4 hours or so of my evening."* That is the section: the **full-evening rate**.

Claims that are true today:

- Log a night in a minute: what the venue paid, who in the band got what, cash tips, merch sold, what it cost you, and the hours — on stage, breaks, travel, set-up and pack-down.
- MySet already knows the rest: votes and tips fans sent through the app, and merch bought through the shop, land on the night by themselves.
- Two rates, side by side: what you made per hour on stage, and per hour of the evening you actually gave up. *(The honest number. Show both tiles.)*
- Play a residency? Enter the deal once; every night of the run inherits it. Correct any one night by itself.
- Total, or just your cut. Before or after MySet's fee. Your choice, remembered.
- A report for any date range — or any nights you pick — with your name on it. Tax time, a manager, a venue that wants numbers: one link. *(`/report`, branded, 0065.)*

Illustration: three tiles — Profit · Stage-time rate · Full-evening rate — with the founder's demonstrative numbers (his call, as with 45/270/$108). One screenshot of the report page.

Do NOT say: "CRM" on the page (the founder's word for the brief, not for artists); "coming soon" (it exists now — the Rock Star card was fixed by 0065); analytics by venue/by song (still `NOT_BUILT`).

### 3c. Off-page consequence

`docs/landing/OFF-PAGE.md`: free plan shows 4 → 10 (0037); add a row for `reports` = dashboard + report page; note Bar Star library 200 (0061).

## 4. The profile as the Linktree replacement — strategy

### What the artist page already has that a link page does not

| Linktree gives | `myset.vip/you` gives |
|---|---|
| A stack of links | The same links, drifting under *Listen, follow, & support* — Spotify, Apple Music, YouTube Music, Instagram, Bandcamp, GoFundMe, your site |
| A profile photo | Your top video playing at full size; the rest in a strip |
| — | **Proof**: the room's rating, what fans said, your most-voted song |
| — | **Book** — a booker writes to you from the page; you answer from the Studio, their email never shows |
| — | **Merch** — a real shop, one tap away |
| — | Upcoming shows, a month calendar, your tour poster, "Grab your tickets" |
| — | A tip button that goes straight to your account through Stripe |
| — | Joined · Shows · Fans · Votes cast — numbers that grow every gig |
| A link in bio | A link in bio **that changes every night you play** |

That last row is the pitch. A Linktree is the same on Tuesday as on Saturday. This page moved because 45 people voted last night.

### Section copy direction — "Your page. Not a list of links."

Headline options (pick one, the founder's voice):
- *One link. Everything you are.*
- *Put this in your bio instead.*
- *Your page. Not a list of links.*

Body, four beats:
1. **The link is the same.** `myset.vip/you`. Put it in your Instagram bio, your YouTube description, your business card. *(No mention of Linktree by name on the page — a competitor's trademark in a headline is a fight; "the link page" is enough. Say Linktree in ads and posts, not on the site.)*
2. **But it isn't a list.** Your video plays. Your best-voted song is named. What the room said is there in their words.
3. **It does things a list can't.** Book. Buy. Tip. See the next show. Get a ticket.
4. **And it's different tomorrow.** Every gig adds to it — fans, votes, comments, the poster for the next run.

Then a **side-by-side visual**: a greyed generic link stack on the left, the MySet page on the right, same links, scrolling. This is the one place a new graphic is worth making rather than a screenshot. Keep the left side a wireframe (no brand, no logo) — it is "a link page", not a named product.

### The segue into the shop and the dashboard

The section ends on the Merch door and the Book door — both visible on the page screenshot. The next section opens on what happens when someone taps Merch (§3a), and the one after on what the night added up to (§3b). Sections 4→5→6 are literally the artist page read top to bottom, then the Money tab. The reader never leaves the artist's own screen.

Micro-copy that stitches them: end §4 with *"Someone taps Merch."* (one line, orange) and open §5 with the shop. End §5 with *"And the night ends."* Open §6 with the dashboard. Same device as the existing *"Five things happen."*

### Where it lives, beyond the page

- **The sign-up CTA** should say the link out loud: *"Claim myset.vip/yourname"* — the slug is the product. Check the slug is reserved at sign-up already (it is: `shop`, `v`, `studio` are reserved words per 0064).
- **Instagram/TikTok posts**: "Replace your link in bio" is the campaign; the page is where it lands. Out of scope here, noted for OFF-PAGE.
- **The community page and vote page** already link back to the profile — no change.

## 5. Implementation plan

Order of work, each a PR (main is protected, 0045):

1. **Copy PR** — three new sections + FAQ answers + venue-section tweaks + alt text fixes from the 09-14 audit. Text only; placeholder `<figure>` blocks where images go. Tests: `test/copy.mjs`, `tools/uicheck.mjs`. Half a day.
2. **Images PR** — the founder's screenshots: shop grid, receipt with code, Money tab tiles, report page, artist page (hero video + proof + Book/Merch), calendar popup. Convert to `.webp` at the existing widths; alt text written from what is visible. One hour after the images arrive.
3. **Link-page comparison graphic** — the one new illustration (§4). SVG in the page, theme-aware, no third-party marks. Two hours.
4. **OFF-PAGE.md** — the §3c rows. Ten minutes, same PR as 1.
5. **Sheet/CTA** — "Claim myset.vip/yourname" on the CTA if the founder agrees. In PR 1.

Decisions needed from the founder before PR 1:
- §2 (a) or (b) on the gate.
- Headline for §4.
- Demonstrative numbers for the three dashboard tiles.
- Whether "Linktree" is ever written on the site (recommendation: no; ads only).
