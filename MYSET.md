# MySet — the complete handover

**Everything MySet is, does, charges for and depends on.** Written 2026-09-03 and
re-verified against the live code on **2026-09-04 (the community/merch/auto-show
batch)** — every number
below was read out of the source or measured by running it, not remembered. If this
document and the code ever disagree, the code is right and this file is stale.

Companion documents, all in this folder:

| File | What it is for |
|---|---|
| `INVARIANTS.md` | **Read before changing anything.** 162 properties that must survive every change. Most were discovered by being broken. |
| `HANDOFF-MySet.md` | The running session log — what happened when, and why. |
| `GIG-NIGHT.md` | The one-page cheat sheet for running a show. |
| `REVIEW-2026-09-02-REMAINING.md` | Known open issues, in priority order. |
| `AUDIT-2026-09-01.md`, `AUDIT-2026-09-02.md` | The two deep audits and their findings. |
| `PLAN-vote-finality.md` | How vote finality was built, and what it broke on the way. |
| `STRIPE-CONNECT.md` | The payments design, written before it was built. |
| `VERIFYING-A-VENUE.md` | How a venue earns its tick. |
| `README.md` | Short orientation for a developer arriving cold. |

---

# PART ONE — THE MACRO VIEW

## 1.1 What MySet is

A live audience, in a bar, votes from their phones on which song the musician plays
next. The musician sees the running tally on stage and plays the winner.

That is the whole product in one sentence, and everything else exists to make that
sentence true in a real room: with bad wifi, with people who will not install an app,
with a performer who has one hand free between songs.

Around that core it is also:

* an **artist page** — profile, photos, links, gig calendar, embedded music
* a **venue page** — what's on, hours, menu, offers, photos, directions
* a **city gig finder** — what live music is on near you, tonight and this week
* an **artist↔venue marketplace** — artists pitch for slots, venues post them

## 1.2 Who it is for

**The audience.** Never signs in. Never installs anything. Scans a QR code or types
`myset.vip`, and votes. This is the single most important design constraint in the
product: anonymity is why it works in a bar (INVARIANT 9g).

**The artist.** A working musician. Runs the show from their own phone on stage, in
low light, between songs, often one-handed. Every Studio decision is measured against
that.

**The venue.** A bar or restaurant that books live music. Wants to be found, wants
its nights listed, wants to look legitimate.

## 1.3 The ambition

MySet is intended as a **$10/month product for thousands of musicians** — recurring
income that does not depend on Perry playing gigs. Every design decision should be
weighed against *"does this hold at a thousand artists, or only at one?"*

That question has already killed several ideas and reshaped others: it is why the free
tier is capped by **gigs played** rather than features, why the audience never signs
in, and why blob reads on the audience poll are counted by a test.

## 1.4 The one real data point

**One real gig: 8 voters, 21 votes, one $3 purchase.** The Ugly Duckling, Koh Phangan,
2026-08-30.

That is the entire body of real-world evidence. A "40 phones" figure circulated in
planning documents for a while and was a **synthetic security probe with fabricated
fan ids**, not a real room — it misled one audit's capacity numbers by 3–5×. Treat
every projection in any document as a projection (INVARIANT 9d11).

**And nothing went wrong that night.** The $3 purchase was delivered, used, and the
songs were played; Perry ran the show from his own phone. Earlier versions of this
and several other documents described two failures at that gig. They were wrong —
corrected by Perry on 2026-09-04 — and the payment-delivery and passcode machinery
they were credited with is hardening, not incident response.

## 1.6 Where everything lives

| | |
|---|---|
| **Live site** | https://myset.vip |
| **Code (Mac, source of truth)** | `~/Docs/MySet` |
| **Mirror** | `/Volumes/IDYLL SSD 1/Docs/MySet` (docs only, no git) |
| **GitHub** | `github.com/perryidyll/myset` (private) |
| **Host** | Netlify, project `mysetvip`, id `8f5c9f01-e1f1-47e3-add1-8dde39efd1d3` |
| **Deploy** | `git push` to `main` **is** the production deploy |

---

# PART TWO — EVERY SURFACE, EVERY FEATURE

## 2.1 The public routes

Defined in `netlify.toml`. Real files always win, so `/vote.html` and `/studio.html`
keep working; the pretty URLs only catch paths that are not files.

| URL | Serves | What it is |
|---|---|---|
| `/` | `index.html` | City gig finder — the front door |
| `/<slug>` | `artist.html` | An artist's public page |
| `/<slug>/vote` | `vote.html` | The voting page — what the room uses |
| `/studio` | `studio.html` | The Artist Studio |
| `/signup` | `studio.html` | Same page, sign-up state |
| `/about` | `about.html` | The landing / sales page |
| `/venues` | `venue-studio.html` | The Venue Studio |
| `/financialmodel` | function `financialmodel.mjs` | The money model (finance/model.html, outside the published folder), behind a passcode — see §5.1 |
| `/v/<slug>` | `venue.html` | A venue's public page |
| `/api/*` | Netlify Functions | The whole API |
| `/stage.html` | `stage.html` | Legacy stage control, `noindex` |

`v` and any slug starting with it are reserved, so venue and artist namespaces can
never shadow each other.

## 2.2 The voting page — what the audience sees

The only surface most people will ever touch. No sign-in, ever.

**The top:** the artist's name (links to their page), whether the show is live, and a
credits pill showing votes remaining — or ∞ when the artist has switched on unlimited.

**Playing now:** a large gradient card with the current song, its artist, animated
bars, and a **Lyrics** button. When the show has ended this card says "Tonight —
that's all, see you next time" rather than claiming a song is playing.

**Voting status strip:** "Voting open" or "Voting paused", and votes left.

**Up next:** the top three by votes, ranked, with the leader marked *"Winning — plays
next"*. Ties are broken by whoever voted first. A song the fan has voted for shows
*"Your 3 votes"* and stays tappable so they can add more.

**Voting itself.** Tapping a song opens a confirmation sheet:
* a **stepper** to choose how many votes to cast, capped at what they can afford
* the **rules in plain words**: how many votes they have, that free votes come back
  when the next song starts, that bought votes are theirs to keep, that votes are
  final once confirmed, and that if the artist drops a song the votes come back
* a **Confirm** button showing the total cost
* *"Are you sure? Votes can't be changed!"* beneath it
* a **Not yet** button, an **✕** in the corner, and a full-width drag handle

**Ask for something not on the list:** song requests and birthday shout-outs, each
costing votes (never money), each shown only if the artist has switched it on. A
declined request refunds the votes.

**More votes / Tip:** Stripe checkout. Both hidden entirely when the artist cannot
take card payments, so the room is never shown a button that leads to a shrug.

**Already played:** every played song stays votable at the higher replay cost.

**Search and genre filters:** filter the list by title, artist or genre. Only genres
that actually match a visible song are offered.

**Pull to refresh**, and an **"Enjoying MySet?"** prompt — five stars and an optional
note, shown after an hour of actual use, at most once a week, never over another sheet
or mid-vote.

**Install banner:** add MySet to the home screen, with per-platform instructions.

## 2.3 The Artist Studio — seven tabs

`/studio`. Dark-only by design — it is used on a stage.

### Live
The tab the artist watches during a gig.
* **the Voting box** at the very top — a thin orange ring, the word *Voting* large and
  orange, and an Open / Paused switch whose "on" half is orange. It lives here and
  nowhere else (it used to sit in the header and again in Settings). It is the
  voting window, not a show control (INVARIANT 0p)
* a line saying when the show started or ended by itself (see 4.9)
* three stat tiles: votes now, people in the room and networks, tips taken
* **Now playing** card, and **My chart** — the artist's private notes for that song
* **▶ Start top voted — <song> (n)** — the big button
* the ranked queue, every row with its own ▶ Start
* **Played** list with undo
* **■ End the show**
* song requests waiting, with accept / decline / done
* the free-plan gig-cap warning when two shows or fewer remain
* a link to see exactly what the audience sees

### Setlist
* the whole library with search, sort and genre chips
* add a song; **import** many at once by pasting a list, uploading a CSV, or peeking at
  a Spotify playlist
* edit title, artist, key and genres; hide a song; remove it
* the **song sheet**: musical key, private chart notes, genres, lyrics
* **setlists** — named subsets, one active at a time, with "use tonight"
* **songs to learn** — a wish list that is not in the library until learned
* automatic genre tagging, which only ever fills a song that has none

### Gigs
* a calendar of gigs: venue, city, country, date, time, duration, timezone, address,
  ticket link, notes
* **repeats** — weekly, fortnightly, monthly, yearly, with an end date
* cancel a single night, or hide it from the list
* each gig can name which setlist to play, applied when the show starts
* pitches sent to venues, and their replies

### Money
* **Getting paid** — Stripe Connect status, what MySet takes, and what Stripe takes
* tonight's numbers: songs played, votes, money taken
* past shows, each with the songs played and the votes they won, what the room wanted
  but never got, and the money split between vote packs and tips
* every payment, and a **reconcile** button that sweeps Stripe for anything undelivered
* **What the room said** — the audience star ratings and their notes

### Merch
* up to 12 items — name, a line, a price in USD, pickup or posted, on/off, a picture —
  shown on the community page; a **Plus** feature, greyed on free (3.1)
* **orders** — what fans bought, mark as done, and a Details sheet that fetches the
  buyer's name and address from Stripe at that moment and keeps nothing

### Profile
* **Your community page** — the posts fans left, with reply / pin / hide / delete
* name, bio, photos (cover, avatar, three more) with cropping
* links: streaming, social, merch, anything
* embedded music from YouTube, Spotify and Apple Music
* the public page address (slug), changeable

### Settings
* **Get verified** — the checklist and ID upload
* **Trying things out** — feature switches (owner only)
* **Alerts on your phone** — push notifications for song requests
* free votes per person, including ∞ unlimited
* replay cost, vote pack prices, request and birthday costs
* one device granted unlimited votes (the artist's own, for testing)
* **Signing in** — the plain truth that there is no password, the studio code, and
  eight one-time recovery codes
* **Starting by itself** — shows that start from the calendar, on or off
* QR codes for the home page and the voting page
* team members and their roles
* **Your account** — your sign-in address (and moving it), where you're signed in,
  download my data, invoices, sign out of this device, sign out everywhere, delete
  (two screens, then thirty days you can undo)
* plan, upgrade, promo codes, referral link
* **owner only:** the ID review queue, venue plans, promo code minting, venue
  verification, feature flags

## 2.4 The artist's public page

`/<slug>`. Cover photo, avatar, name — with the green **✓ Verified** chip when the
artist has earned the tick and is on a paid plan — "Live now — vote the setlist" when
a show is on, stats (Joined · Shows · **Fans** · Votes cast · Songs), a **Community**
button in the stats grid, upcoming gigs with dates and addresses, embedded music,
links, and a **Join live** button. A menu icon top-right opens two doors: Artist
Studio and Venue Studio (each goes to sign-up when this phone has no Studio yet).
"Fans" counts phones that were in the room across archived shows; there is no
follow. The page makes two requests, not three — the profile payload carries the
live status, so it no longer pays a 15-read audience poll per view.

## 2.5 The city gig finder

`/`. Pick a country and city, see what is on tonight and this week — artist gigs and
venue events together, with times in the venue's own local clock. Search, an install
banner, and links for artists and venues.

## 2.6 The Venue Studio — six tabs

`/venues`.

* **Page** — name, tagline, about, address, map link, phone, WhatsApp, links, photos,
  amenities (22 to choose from: house PA, sea view, pool table, dog friendly…)
* **What's on** — the venue's own events (quiz nights, DJs, football), same calendar
  engine as artist gigs
* **Numbers** — how many people were in the room on live-music nights
* **Menu & offers** — a menu link or items, plus happy-hour style offers
* **Merch** — items that sell through the venue's own link (a venue has no payout
  account, so nothing is bought through MySet); a **Pro** feature, greyed on free.
  The same tab moderates the venue's community page
* **Settings** — the verification checklist, the page address, team, sign out

## 2.7 The venue's public page

`/v/<slug>`. Photos, tagline, about, what's on, hours, offers, amenities, directions,
the verification badge if earned, a **Community** pill and the same top-right menu.

## 2.8 The two sides meeting

Artists can **pitch a venue** for a slot — only signed-in artists, so a stranger cannot
spam a bar. Venues see pitches in their Studio and reply. Gigs and venues are matched
by **name within a city**, never by a stored link, so neither side can break the other.

## 2.9 The community page

`/<slug>/community` and `/v/<slug>/community`. One page, one request, no sign-in.

* **Merch rail** at the top — only when there is something to sell. A card shows a
  picture, a name, a price and ONE of: **Buy** (Stripe, when the artist can take card
  payments), **Get it ↗** (the item's own link), or "Ask at the show".
* **Say something** — up to 500 characters, 1–5 stars, which night (a real archived
  show, from the artist's own history), an optional name, up to three photos (shrunk
  on the phone), and a video **link** — YouTube embeds, Instagram and TikTok show as
  links. Three posts a day per phone, one per show per phone.
* **The feed** — pinned first, newest first; a heart per phone; a report button; the
  artist's reply under a post. Hidden posts vanish for the public and stay for the
  owner. A device id is stored with a post and never shown to anyone.
* After a show ends, the voting page's wrap-up screen links here with the night
  pre-selected — "Say something about tonight".
* Paying for merch returns here, and the page redeems the session the way the voting
  page does (INVARIANT 5b names both pages).

---


### Clips (added 2026-09-05)

A post can carry **one thirty-second clip** as well as up to three photos and a
video link. The clip is re-encoded on the phone to 480p (~600kbps) before anything
leaves it, capped at **3MB** by the server, and uploaded on its own *before* the
post is written — a function body tops out around 6MB and three photos already spend
most of it. Every clip gets a poster frame, so the feed shows a still and the video
only downloads when somebody taps play. Clips are served by `/api/vid` with byte-range
support, which is what iOS Safari requires before it will play anything at all.

A clip uploaded and never posted is swept after two hours by the cron; the sweep
reads the feed first so a posted clip is never taken away. See INVARIANTS 0dq–0ds.


### Featured shows (added 2026-09-05)

An artist can pay **$10** to put one of their gigs at the top of that city's list
for that night — an orange border and its own **Featured shows** heading. **Three
spots per city per night, first come first served.** The button sits under the gig
list in the Studio's Gigs tab.

Behind the `featuredShows` flag. With it off there is no button, the endpoint
refuses (so nobody can be charged) and the section is not drawn — but anything
already bought keeps its record and reappears when it is switched back on.

The spot is **held** for twenty minutes before the checkout opens, so nobody is ever
charged for a spot they did not get, and an abandoned checkout frees it by itself. A
payment that lands after the hold died is honoured if there is room and refunded
automatically if there is not. If the gig is cancelled afterwards the spot is spent,
and the sheet says so before anybody pays. INVARIANT 0dx.

### Editing and deleting a post (added 2026-09-05)

A fan can change their own post for **24 hours** and delete it for ever. An artist
can **hide** any post on **any plan** — instantly and reversibly — and **delete for
good on Plus and above**. Every artist must be able to take something offensive off
their page the second they see it; what a paid plan buys is erasing it. INVARIANT 0dy.

# PART THREE — THE MONEY


## 3.0 The books (added 2026-09-05)

**Stripe holds the transactions; MySet produces the statements.** Every figure in
every statement comes from Stripe's *balance transactions* — the list Stripe itself
reconciles to the bank — and is only bucketed, never recomputed.

- **Artists** — Studio → Money → *Your earnings*. Twelve months, gross / fees / net,
  plus a CSV for their tax return.
- **Venues** — Venue Studio → Merch → *Your earnings*. The same, scoped to the
  venue's own Stripe account. Venues had nothing before this.
- **Perry only** — Studio → Money → *MySet's books*. A real P&L: revenue read from
  Stripe, costs typed in by hand, profit = net − spend.

A finished month is computed once and cached, so a year's statement costs one Stripe
page. Owner-only on the server, not merely hidden in the page. Full reasoning and the
two traps it avoids: `ACCOUNTING.md`. INVARIANTS 0dt–0du.

## 3.1 Artist plans

| | **Free** | **Plus** | **Pro** |
|---|---|---|---|
| Price | $0 | **$10/month** | **$20/month** |
| **MySet's cut of money through the app** | **10%** | **2%** | **0%** |
| Shows per calendar month | **4** | unlimited | unlimited |
| Songs live to the audience at once | 50 | unlimited | unlimited |
| Team seats | 1 | 1 | 5 |
| Separate setlists | — | ✓ | ✓ |
| Merch on your community page | — | ✓ | ✓ |
| Set your own prices | — | ✓ | ✓ |
| Verification tick | — | ✓ | ✓ |
| Promote in other cities | — | — | *designed, not built* |
| Earnings analytics | — | — | *designed, not built* |
| Press kit | — | — | *designed, not built* |

**Self-serve since 2026-09-04.** Plus and Pro are Stripe Billing subscriptions started
from the plan sheet in the Studio (top right: `Upgrade ↗`, or a green tag with the
plan's name once paid). Downgrades run to the end of the paid month; leaving Pro is
asked twice and offered one month at half price, once ever. The whole system is in
`ACCOUNTS.md`; the rules in INVARIANTS 0cr–0da. Comps and promo codes still work
exactly as before — a comp is simply a row with no subscription behind it.
| Your own branding | — | — | *designed, not built* |

**Four of those Pro rows are not implemented.** `promote`, `analytics`, `presskit` and
`branding` exist in the plan table and nowhere else in the code. They are named in
`NOT_BUILT` in `_plan.mjs`, which the Studio reads so it can grey them as **"Coming
soon" on every plan including Pro** — Perry is comped to Pro, and without that list he
would open the Studio, see four features presented as his, and find four dead ends.
So would the first artist who ever pays.

Deleting a name from `NOT_BUILT` is the *last* step of building the feature, and
`test/limits.mjs` asserts that anything not in the list is genuinely enforced
somewhere, so the list cannot rot in either direction.

Everyone can keep up to **2,000 songs** in their library regardless of plan — the cap
limits how many are *live to the audience*, and it never deletes anything.

**Why the free tier is capped by gigs and not features.** Every phone in the room polls
for the whole gig, so what MySet costs to run is driven by gigs played, not artists
signed up. Capping free on the real cost driver is what makes free survivable. Four
shows a month is a hobbyist; five is somebody earning from it.

Counted in **UTC calendar months**, resetting on the 1st, and stamped on the show
record — so what the Studio shows and what the server enforces are computed the same
way, and the count cannot be fudged from a phone. The number lives in one place in the
plan table; the tests read it rather than repeating it.

**Creating a setlist is a Plus feature.** Only *creating* one: an artist who made sets
on Plus and later drops to free keeps using, renaming, filling and deleting them,
because a cap never deletes anything.

**Anything the ROOM experiences stays free on every plan.** Lyrics were briefly behind
a paywall and were put back: an audience that gets a sing-along at one gig and not the
next learns that MySet is unreliable, which costs more than the subscription is worth.

### Locked features are SHOWN, greyed out — not hidden

Perry's call, 2026-09-03. An artist on free should be able to see what paying gets
them. It also fixed a real shrug: the Studio's pricing controls were fully tappable on
free and the server refused them with a 402 — exactly what INVARIANT 0ad exists to
prevent.

The styling is `public/lock.css`, linked by **both** Studios and by nothing else.
(It was first written into `app.css`, which looked right and did nothing whatsoever:
neither Studio loads `app.css`, and the Studios are the only two pages with a lock.
Caught by measuring computed styles in a browser.) Each Studio has a matching
`has()` / `needsPlan()` / `lock()` trio reading its own plan payload.

Two states, and the difference is honesty:

* **`.lock`** — built, and a higher plan turns it on. The veil is a button; tapping it
  scrolls to the plan cards. Reads *"Plus feature"* / *"Pro feature"*, naming the
  cheapest plan that actually has it.
* **`.lock.soon`** — designed and not built. Greyed on **every** plan, not tappable,
  reads *"Coming soon"*.

`pointer-events: none` on the greyed content is the lock; the opacity is only how it
looks. A lock that is only opacity is not a lock, and there is a test for it.

The reason line ("Everyone gets 5 free votes a song until then") sits *under* the lock
rather than inside the veil — a locked row of chips is 43px tall, so a caption inside
it was clipped to "Coming soo".

**A numeric limit is not a yes/no.** `photos` is 3 or 12 and `featured` is 50 or
unlimited, so the first `has()` — `limits[flag] === true` — was false for both, and a
Pro venue saw a dash beside twelve photo slots it fully had. "Has it" means "has as
much as the top plan gives"; unlimited arrives as `null`, because `shapeLimits` maps
`Infinity` to `null` so it survives JSON.

**Lock only what the server refuses, and only where it refuses.** An independent
review found three near-misses in the first pass, all now invariants (0bx0–0bx2):

* The **plan cards** — the page where somebody decides to spend $20 — were the last
  place still selling the four unbuilt Pro features as included.
* `unlimited` has **no plan gate at all** ("everyone votes as much as they like" is
  running your show, not pricing it), and one `lock('pricing')` around the whole
  free-votes block quietly took a working control off every free artist. Greying
  something that works is the same class of lie as showing something that doesn't.
* `has()` treats an **unknown plan as allowed**, so there is no grey flash — which
  meant the first render of Settings showed every locked control live and tappable.
  `planGet` is now fetched on every first load, not only on the Settings tab.

## 3.2 Venue plans

| | **Free** | **Pro** |
|---|---|---|
| Price | $0 | **$20/month** |
| Photos | 3 | 12 |
| Verification tick | — | ✓ |
| Community page (fans post about the night) | ✓ | ✓ |
| Merch on the community page (sold through MySet once Stripe Connect is on, or via the venue's own link) | — | ✓ |
| Receive tips | — | *designed, not built* |
| Voting on the venue's own speaker music | — | *designed, not built* |

**Self-serve since 2026-09-04.** Venue Pro is a Stripe Billing subscription
(`myset_venue_pro_monthly`), started from the same plan sheet as artists (two tiers).
Perry can still comp a venue by hand from the Studio's owner section.

**Venues get paid the way artists do.** Stripe Connect Express keyed `v_<venueId>`,
direct charges on the venue's own account; the Venue Studio's Merch tab carries the
"Getting paid" card and the orders list. The transaction fee is 10% on Free and 2%
on Pro, **reduced by half of Stripe's estimated card fee** — Perry's rule that
Stripe's fee is shared evenly (3.4).

Same rule as the artist ladder: `tips` and `speakerVotes` are named in
`VENUE_NOT_BUILT` in `_venues.mjs` and render as "Coming soon" on Pro too. `reviews`
left that list on 2026-09-04 — the community page IS reviews — and is free on both
rows, because what the room reads cannot be Pro-only. There is no $10 venue tier, so
venue merch sits on Pro.

**The photo cap was in the table and nowhere in the code until 2026-09-03.**
`VENUE_PLANS` had said 3 free / 12 Pro since venues shipped, the Studio only ever drew
three boxes, and `photoUpload` would happily have written `p11` for a free venue. It is
now checked against the plan in `venueadmin.mjs` and refused with a 402.

Widening the shared `SLOTS` set in `_img.mjs` from `p0..p2` to `p0..p11` to make room
for that **broke its neighbour twice over**, and the second half was only found by
review:

* An **artist** could suddenly store nine images `normProfile` trimmed away on every
  read — that set had been, by accident, the artist's cap too.
* A **venue on Pro** could upload photos 4–12, be told "Photo added", and have them
  discarded by `normVenue`'s `.slice(0, 3)` on the next read. Worse than a 402,
  because it looked like it worked.

There are **two** photo caps and they now live where the answer is known: how many a
record may HOLD (`MAX_PHOTOS`; the highest of `VENUE_PLANS`) and who may WRITE the
fourth (`admin.mjs`; the venue's plan in `venueadmin.mjs`). The slot set is a list of
valid names; it is not a limit on anybody.

**And photo slots are addresses.** Both normalisers ran `.filter(Boolean)`, which
compacted the array — so a venue with slots 1 and 3 filled had slot 3's picture drawn
in slot 2, and clearing one photo appeared to move another. Only trailing blanks are
dropped now.

## 3.3 What the audience pays

* **Vote packs**, artist-priced. Defaults: **5 votes for $5**, **15 votes for $10**.
  Clamped server-side to $1–$500 and 1–100 votes.
* **Tips** — any amount, straight to the artist.
* **Song requests and birthday shout-outs cost VOTES, never money.**

Bought votes are a **stock**: they do not refresh with the free ones, they carry into
the next show, and free credits are always spent first.

## 3.4 How the money actually moves

**Stripe Connect, direct charges.** The charge is created **on the artist's own Stripe
account**. The money is legally theirs, and MySet takes a platform fee off the top.

This encodes an identity: *MySet is not selling the night — the artist is, and MySet
provides the infrastructure.* The alternative (destination charges) would have made
MySet the merchant of record for every gig, holding the funds and answering the
chargeback for a night it did not play.

**The trade, stated plainly:** with direct charges Stripe's own processing fee
(~2.9% + 30¢) is charged to **the artist**, not to MySet. On a $5 vote pack a Plus
artist pays roughly 45¢ to Stripe and 10¢ to MySet. *"2% to MySet" is not "you keep
98%."* The Studio says this before an artist onboards.

**Onboarding** is Stripe-hosted Express, so MySet never sees a bank detail. The
country is asked for and validated — an Express account's country cannot be changed
afterwards, and getting it wrong means an artist can never be paid out properly.

**Nobody takes money until Stripe says so.** The gate is Stripe's own
`charges_enabled`, never a local "they clicked onboarding" flag. Started is not ready.

**Venues are the same flow with a different key** (`v_<venueId>`), with one
difference Perry asked for: Stripe's card fee is **shared evenly**. On any plan row
with `splitFee` (both venue rows) the application fee is
`max(0, floor(amount × cut) − round((amount × 0.029 + 30) / 2))`. A $50 item on
venue Free sends MySet 412¢ instead of 500¢; on venue Pro 12¢ instead of 100¢; a
$12 cap on Pro sends nothing at all, because the fee floors at zero. It is an
estimate at checkout and the Studio says so; an exact split would need a post-charge
transfer (`ACCOUNTS.md` §3). Artists are not split.

**Three delivery paths, because one was not enough:**
1. the buyer's browser returning to the voting page
2. a Stripe webhook, independent of the buyer's phone
3. a reconcile sweep the artist can run from the Studio

A payment is **claimed before it is granted** so a race cannot grant twice — but the
claim is marked *undelivered* until the votes actually land, so a failure leaves the
money owed rather than silently settled, and the sweep picks it up. The grant itself is
recorded per buyer per purchase, so a retry can never hand out the pack twice.

**Money is attributed by tag, never by timestamp.** Perry's Stripe account holds
unrelated charges; an early version reported $133 of somebody else's business as MySet
revenue.

## 3.5 Paying for a plan

**Stripe Billing holds the subscription; the registry holds a mirror.** `_billing.mjs`
keeps one `billing_<owner>` document of pointers (customer, subscription, price key,
period end, whether the retention month was used) and writes the *plan* onto the
registry row so every existing reader is unchanged. Prices are found by **lookup key**
and created on first use — never a hard-coded `price_…` id.

**Two ways to learn the truth.** Stripe's webhooks (`customer.subscription.updated` /
`.deleted`, `invoice.payment_failed`, `checkout.session.completed`) and a belt: the
return trip from Checkout (`planFinish`) reads the session from Stripe by id and checks
it belongs to the owner, and `maybeSync` re-reads the subscription at most every six
hours. A URL saying `?sub=done` changes nothing by itself.

**Leaving is gentle.** Paid → free is `cancel_at_period_end`; paid → paid is a price
swap with proration; the plan keeps three days' grace after the period end. The
**retention offer** — 50% off one more month — is a coupon on the live subscription
(Stripe bills it), recorded as offered and used, and refused server-side the second
time.

**The account can leave too.** `accountExport` returns everything MySet holds about an
artist as one JSON file (never a fan's device id); `accountDelete` (owner only, the
word `DELETE` typed) cancels the subscription, un-indexes the calendar and the
schedule, and deletes every key from the one enumerated list in `_account.mjs`. The
founder cannot be deleted from the app. `ACCOUNTS.md` is the full design.

---

# PART FOUR — HOW IT IS BUILT

## 4.1 The shape

Static HTML pages plus **Netlify Functions** on **Netlify Blobs**. No framework, no
build step, no database. Every page is one self-contained file with its own styles and
script; `app.css` carries the shared design tokens.

* **Front end:** 9 pages in `public/`
* **Back end:** 22 HTTP endpoints plus two scheduled jobs (24 files), and 32 shared
  libraries, in `netlify/functions/`
* **Tests:** 1,233 assertions across 23 suites, run with `npm test`

Two dependencies only: `@netlify/blobs` and `stripe`.

## 4.2 Every endpoint

**Public — no sign-in**

| Endpoint | Does |
|---|---|
| `GET /api/show` | The whole voting-page payload |
| `POST /api/vote` | Cast or take back votes |
| `POST /api/request` | A song request or birthday shout-out |
| `POST /api/pay` | Open a Stripe checkout |
| `GET /api/confirm` | Redeem a payment on the return trip |
| `POST /api/webhook` | Stripe-signed redemption and account updates |
| `POST /api/gift` | What happens to bought votes when the show ends |
| `POST /api/feedback` | The star rating and note |
| `GET /api/profile` | An artist's public page data |
| `GET /api/events` | The city picker, a city's week, or one artist's diary |
| `GET /api/lyrics` | Lyrics for the current song |
| `GET /api/venue` | A venue's page |
| `GET /api/img` | Photo bytes |
| `GET /api/qr` | An SVG QR code |
| `GET\|POST /api/community` | The community page — feed, merch, shows; post, like, report |

**Artist session** — `POST /api/admin` (111 actions), `GET /api/stage`,
`POST /api/auth`, `GET|POST /api/revenue`, `GET|POST /api/history`

**Venue session** — `POST /api/venueadmin` (39 actions), `POST /api/venueauth`

**Scheduled** — `sheetcron` (03:20 UTC) and `autocron` (every two minutes; 4.9)

## 4.3 Every Studio action

**The show:** play · playTop · window · status · newShow · resetVotes · venue · city ·
showTime · freeCredits · unlimited · unlimitedFan · replayCost · packs · setCode

**The library:** addSong · importSongs · editSong · removeSong · toggleSong · unplay ·
starterSetlist · clearSetlist · spotifyPeek

**The song sheet:** songGet · chartSet · chartFlags

**Genres:** tagList · tagAdd · tagRemove · tagAuto

**Setlists:** listAll · listNew · listRename · listDelete · listSongs · listToggle ·
listUse

**Songs to learn:** learnList · learnAdd · learnRemove · learnDone

**Requests:** askSet · askList · askAccept · askDone · askDecline

**Gigs:** eventList · eventSave · eventDelete · eventSkip · eventHide

**Lyrics:** lyricsGet · lyricsSet · lyricsFetch · lyricsWarm

**Profile:** profileSet · mediaAdd · mediaRemove · mediaMove · photoUpload · photoClear

**Getting paid:** payStatus · payStart · payDashboard

**Verification:** verifyStatus · idUpload (legal name + date of birth, auto-verifies on a Stripe match)

**Alerts:** pushKey · pushOn · pushOff

**Plan:** planGet · promoRedeem · shareStats

**Venues:** pitchStatus · pitchSend · pitchList · vouch

**The shop:** merchList · merchSave · merchRemove · merchPhoto · merchPhotoClear

**The community page:** postList · postHide · postPin · postReply · postDelete

**Orders:** orderList · orderDone · orderDetail

**Plans and billing (3.5):** planGet · planCheckout · planFinish · planChange ·
planRetainOffered · planRetain · planPortal — the same seven exist on
`/api/venueadmin`, beside payStatus · payStart · payDashboard · orderList ·
orderDone · orderDetail for a venue that takes money.

**The account:** accountExport · accountDelete (owner only; members get 403)

**Owner only:** promoList · promoCreate · promoRevoke · venueList · venueVerify ·
venuePlan · idQueue · idApprove · idReject · flagList · flagSet · sheetStatus ·
sheetSync

The two sheet actions are owner-only for a reason that is not about trust: the sheet
holds **every** artist's rows, so it is platform data, not an artist's own. An artist
wanting their own numbers gets them in the Studio.

## 4.4 Storage

Netlify Blobs, one store, everything namespaced per artist or venue.

**Per artist:** `show_` · `f0…f11_` (fan records, sharded) · `meta_` (payments and
tips) · `hist_` and `histidx_` (past shows) · `ev_` (gigs) · `lists_` · `learn_` ·
`req_` (requests) · `profile_` · `img_` (photos) · `chart_` · `lyr_` · `push_` ·
`connect_` · `fb_` (feedback) · `lock_` (passcode lockout) · `apitch_` ·
`songstats_` (the Sheet's per-show song accumulator — see 9b under the Google Sheet) ·
`posts_` and `likes_` (the community page). Merch lives ON `profile_`; orders ON `meta_`.

**Per venue:** `v_` · `vprofile_` (merch on it) · `vouch_` · `vpitch_` · `posts_v_` · `likes_v_`

**Global — the only shared documents:** `artists` (the registry) · `venues` ·
`cityindex` · `acctindex` · `flags` · `idqueue` · `promos` · `authsecret` · `authc_` ·
`sheetsync` (the Sheet's watermarks and its one-at-a-time lock) · `gigsched` (which
artists have a gig due — the schedule's one read)

### The hard-won storage rules

1. **Never use `list()` for live data.** It is eventually consistent and has been
   measured lagging by *minutes*. Vote counts read that way showed zero while the
   writes had already landed.
2. **Conditional writes need `@netlify/blobs` v10+.** Version 8 accepted them and
   silently ignored them, and votes were lost.
3. **Compare-and-swap alone is not enough.** Even on v10 a conditional write can report
   success without sticking. Every fan write is **re-read after writing** and retried.
4. **Fan records are sharded across 12 documents** so a burst of voters does not
   contend on one key. Load-tested: 80 simultaneous voters, zero lost votes.

## 4.5 What an endpoint costs

Counted by a test, because reads on the audience poll are the mistake this project
keeps making — the global registry got onto that path three separate times.

| | Ceiling |
|---|---|
| Audience poll | **15** reads, **1** global document |
| A vote | 5 reads, 2 writes |
| Studio poll | 22 reads |
| A setlist rename | 12 reads, and **no** fan-shard reads |

These are ceilings, not targets. Raising one is a decision somebody makes on purpose
and explains, not something discovered on a bill.

## 4.6 Polling

The audience page polls every **3 seconds**, backing off to **10** then **25** when
nothing is changing, and stops entirely when the phone is asleep or the tab is hidden —
so a pocketed phone costs nothing. The Studio's Live tab polls every **4 seconds**.

## 4.7 Sign-in

**The audience never signs in.** That is why the app works in a bar.

**Artists** sign in with **email and a 6-digit code** — not Google, because OAuth needs
a cloud project, a consent screen and a verification review, and Perry found Google
sign-in too hard on a previous product. Codes last ten minutes, are burned on use, and
allow five wrong guesses and five sends per hour.

Artists may also set a **Studio passcode**, used together with their page name — the
pair behaves like a username and password. At least 8 characters, with a deny-list, and
the door locks for 15 minutes after 10 failures. A locked door, a wrong code and an
unknown page name all give the same answer, so the lock cannot be used to discover
which codes or artists are real.

A recovery key exists in the server environment for the founding account only.

**Roles.** `owner` runs everything. `member` runs the page and the show and never
touches money or access. `crew` runs tonight and nothing else — the sound engineer
working the screen while the artist plays. An unknown role falls back to `crew`, so a
role string the table has never heard of can never be an escalation. Venues have the
same three, named owner / manager / crew.

**Sessions.** Every token carries a session id, so one phone can be signed out without
signing out the band. Revocation lives on the registry row the verifier is already
reading, and is normally absent, so it costs nothing on any request. Settings shows
where you are signed in, and sign-out now actually tells the server — before
2026-09-05 it cleared the browser and the token stayed live for the rest of its month.

**When the inbox is gone.** Eight one-time recovery codes, shown once. The door takes
the public page name and a code, and answers a wrong code, an unknown page and a
locked-out page identically.

**MySet has no password**, and Settings says so rather than leaving somebody hunting.
The studio code is the password-equivalent and can be changed there.

Everything an account can do to itself — pay, change plan, move address, recover,
leave (thirty days, undoable), export, delete — is in `ACCOUNTS.md`.

## 4.8 Verification

**A venue** needs five things: a **paid plan**, a website on its page, the sign-in
email on that website's domain, the website naming the venue, and **3 different artists
who have a gig listed there** confirming it. All five, shown as a checklist.

**An artist** needs a paid plan, card payments actually set up, and a photo of an ID
— submitted together with their **full legal name and date of birth**.

**Most artists are verified instantly, with no human involved.** Setting up card
payments means Stripe has already run a real identity check on the person. So the
upload compares the stated legal name and date of birth against the ones Stripe
verified, and if the name matches (same names, or the same plus a middle name) and the
birth date matches to the day, the tick is granted on the spot. Anything short of that
— a shared surname, a shared first name, a mismatched date, a business account with no
person on it, an identity check Stripe has not finished — goes to Perry with the
comparison written on the row, saying which of the five checks failed.

**It asks for the LEGAL name, not the page name.** Perry's page says Idyll; his
passport says Murdaugh. He estimates half of artists are in the same position, so
comparing display names would have failed for most real people and defeated the whole
automatic path. The form says plainly that a stage name is normal.

**The date of birth is compared once and thrown away.** Only the yes/no answer is
kept. It is asked for because a name alone is weak — two Bo Trans exist — and a birth
date is a second fact Stripe has already checked. A test asserts the stored row does
not contain the date.

**Nothing reads the photo.** No text is extracted from it, no face is compared. The
automatic path leans entirely on Stripe's own KYC — a real identity check by a
regulated company — and the photo stays a thing a person looks at when there is doubt.
This is stated wherever the feature appears, because a badge that claims more than it
checks is worse than no badge.

**The ID photo is never public and never kept.** It goes to a slot the image endpoint
refuses to serve, and is deleted the moment a decision is made either way.

**Paying opens the door to being checked — it never buys the tick.** A purchasable
trust signal is worth nothing, and a wrong tick on a real bar sends a real person to
the wrong place.

### Looking at production without a password

`python3 tools/prod.py` prints a plain-language health report of the LIVE site: who
has signed up, their plan, whether they have the tick, whether an ID is on file and
how it compared, whether Stripe is connected, and how much of each kind of thing is
stored. `tools/prod.py keys` lists every key; `tools/prod.py get <key>` prints one.

It needs no password because the Netlify CLI on Perry's machine is already signed in
as the site owner, and `netlify blobs:get` reads the production store directly. That
is owner-level READ access to everything.

**The recovery key cannot be read back, and that is correct.** Netlify marks
`ADMIN_CODE` as a secret, so the API returns a mask instead of the value. A session
once mistook that mask for the key, got a 401 from the admin door, and wrongly wrote
down that the recovery key was broken. It is not broken — it is unreadable by design.
Do not repeat that conclusion.

## 4.9 Everything else

**Lyrics** come from LRCLIB — free, no key, no AI — fetched by the server (never the
browser, which cannot set the header LRCLIB requires) and cached permanently. Labelled
"Unofficial lyrics", current song only, one-tap removal.

**Photos** are shrunk on the phone before upload and checked on the server.

**QR codes** are generated as SVG for the home page and the voting page.

**Embeds** accept YouTube, Spotify and Apple Music only. A pasted URL is a parse input,
never stored raw and never used directly as a frame source.

**Push alerts** tell the artist when someone requests a song, even with the screen off.
Written from the specification by hand with no new dependency, and checked against the
specification's own published test vector. Needs keys set on the server — **they are
not set yet**, and the Studio says so.

**Installable.** Three separate manifests (audience, Studio, venue) so each surface
opens where it should. The service worker **never caches anything under `/api`** — a
cached vote is a lost vote — and never precaches, so the newest version always wins.

**Feature flags** let a question with two real answers be tried both ways without a
deploy. `voteFinal` is the first, and it is **on**.

**Time** is handled without a library: a gig is a wall clock in a named place, stored
as a date, a time and an IANA timezone. A set running past midnight belongs to the
night it started.

**Pull to refresh.** `public/pull.js`, one implementation, all seven pages. Installed
to a home screen there is no address bar, no reload button and on iOS no swipe-down
gesture — so a page showing something stale had no way out except force-quitting.
`vote.html` had grown its own copy when the audience poll settled to 25s; that copy is
deleted, not left beside it. The gesture only arms within 2px of the top of the page,
every listener is passive, and the browser's own gesture is deliberately **not**
suppressed — `overscroll-behavior-y: contain` would stop Chrome double-firing and would
also mean no refresh gesture at all if the script failed to load.

It is JavaScript, so it cannot rescue a page whose JavaScript is broken. That is what
the two buttons under **Settings → If something looks wrong** are for: a plain reload,
and `hardReset()`, which drops every cache and sends `sw.js` the `myset-unregister`
message it has listened for since it shipped and never had a button for. Neither
touches songs, votes, money or the sign-in token.

### Shows that start and end themselves

Perry's rule, 2026-09-04. A gig on the calendar **starts its show at the gig's start
time** if the artist hasn't already, and **ends it three hours after the gig's
scheduled end** if the artist hasn't already. `_lifecycle.mjs` is the one
implementation of starting and ending — the Studio's buttons and the schedule call
the same two functions, so the gig cap, the archive, tonight's setlist and the
paid-vote carry happen identically whoever asked. `_auto.mjs` decides; `autocron.mjs`
rings every two minutes and reads ONE global document, `gigsched`, that every calendar
write keeps current — so a quiet ring costs one read, and the audience poll is never
touched.

What it will not do: start the same gig twice; restart a night the artist ended
themselves; start a show with no songs switched on; end a show while a song started
in the last 45 minutes; start a venue's own event; retry a cap refusal all night. The
Studio says "Started by itself for the gig on your calendar" and, after, "ended by
itself, three hours after your gig's scheduled end". A night where nothing happened
— no song, no vote, no phone — is not archived, so an empty scheduled start never
becomes "Shows: 1".

### The Google Sheet

An export of everything, for marketing and for working out which songs a room actually
wants. **The full setup walk-through is `GOOGLE-SHEET-SETUP.md`** — that is the file to
open, not this paragraph.

* `_sheets.mjs` is the client: a service-account JWT signed with `node:crypto`, a token
  cached per warm container, and the four Sheets API calls it needs.
* `_warehouse.mjs` decides what goes in. Nine tabs: **Guide** (written once, in plain
  words), **Artists / Songs / Gigs / Venues** (snapshots, rewritten each sync),
  **Shows / Requests / Ratings** (logs, appended only), **Growth** (one row per sync —
  the tab to chart).
* Owner-only actions `sheetStatus` and `sheetSync`; a nightly `sheetcron.mjs` at 03:20
  UTC that does nothing except call the same function.

The rules that make it safe:

1. **It is a copy, never the source.** Nothing in MySet reads it. Delete the
   spreadsheet and the app does not notice.
2. **Off until three env vars exist, and off is a clean no-op with a reason** — the
   same shape as `STRIPE_SECRET_KEY` (INVARIANT 9).
3. **`GSHEET_KEY` never appears in a repo file, a log, a response or a chat window**
   (INVARIANT 11/11b). `sheetStatus` reports whether it *parses*, never what it is.
4. **No `list()`.** Two registries name every artist and venue, and each artist's own
   history index names every show — so the whole store is walkable without the call
   INVARIANT 1 forbids.
5. **Nothing on a hot path.** A sync is a button and a nightly job. `archiveShow` was
   deliberately left untouched: ending a show is the most sacred path in the app
   (INVARIANT 16).
6. **No Stripe call.** Each night's money is read from the show's own archived record,
   so a sync cannot be slowed or broken by Stripe. Stripe stays the ledger (5d).
7. **No audience device id, ever.** Phones are counted, never named (9g).
8. **Watermarks move only after a successful write, and per tab.** A run that dies
   halfway re-sends only what *that* tab was carrying — a duplicate row is a nuisance,
   a missing one is a hole nobody notices.
9. **A cap defers; it never drops.** 400 artists and 40 new nights a sync, taken
   oldest-first, and the run stops adding artists rather than trimming rows at the end.
   The Growth row's last column reports when a cap bit.
9b. **The Songs tally is an accumulator keyed by SHOW**, in `songstats_<aid>`. It has
   to be: the tally a song won is destroyed when the next song starts (INVARIANT 17b),
   and keying it by timestamp double-counted a night that was ended twice.
9c. **One sync at a time**, so the nightly cron and the button cannot both append.
10. **Formula-shaped text is escaped.** A song called `=1+1` and an artist called
    `+Plus Band` are both real, and Sheets runs both. Anything starting `= + - @` gets
    a leading apostrophe.

One thing it also added: **where a signup came from**. `?src=`, `?utm_source=` or the
referring host is stashed on the first visit and read at the end of the email
round-trip, because signing up means leaving for an inbox and coming back with a clean
URL. It is a short label, never a full URL or a browsing trail. The same fix rescues
`?ref=`, which used to be silently lost the same way.

---

# PART FIVE — RUNNING IT

## 5.1 Deploying

```bash
cd ~/Docs/MySet && npm test && git push
```

`git push` to `main` **is** the production deploy. Never also run `netlify deploy
--prod` — that bills a second deploy for the same change and races over what is
actually live.

Only `public/` is published. Publishing the repo root once exposed docs and backups on
the live domain.

## 5.2 What it costs to run

**Production deploys are the expensive thing, not traffic.** A production deploy costs
15 credits; web requests cost 2 per 10,000. Measured over three weeks: **1,697 credits,
99% of it deploys, 17 credits of traffic.** Draft and branch deploys are free.

Perry is on Netlify Personal ($9, 1,000 credits/month) and buys non-expiring 500-credit
packs at $5. **Never drop to the Free plan — purchased packs are forfeited.** At zero
credits Netlify pauses every site on the account, so this is an uptime issue.

**Never re-derive cost from response times.** That has been got wrong three times.

## 5.3 Secrets

Never in the repo, never in a chat window. All set by Perry directly in Netlify:

`ADMIN_CODE` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `RESEND_API_KEY` ·
`VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` · `AUTH_FROM` ·
`SPOTIFY_CLIENT_ID` · `SPOTIFY_CLIENT_SECRET` · `GSHEET_ID` · `GSHEET_EMAIL` ·
`GSHEET_KEY`

**Measured 2026-09-04 with `netlify env:list --context production`.** Four are set in
production: `ADMIN_CODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`.
The deploy-preview and branch-deploy contexts carry only `ADMIN_CODE` and Resend — which
is the half of the preview-safety story that is closed (see PART SEVEN).

Everything else is unset, and each one degrades honestly rather than failing:

* **The push keys are not set**, so alerts cannot send yet, and the Studio says so.
* **The three `GSHEET_*` vars are not set**, so the Google Sheet is off — see
  `GOOGLE-SHEET-SETUP.md`.
* **`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` are not set**, so the "peek at a
  Spotify playlist" half of song import answers *"Spotify import isn't switched on yet
  — paste your songs as text instead"* with a 503. CSV and pasted-text import are
  unaffected. The Studio button is still offered, so this is the one place the room —
  well, the artist — is shown a control that leads to a message rather than a result.
* **`AUTH_FROM` is not set**, so every sign-in code goes out from Resend's shared
  `MySet <onboarding@resend.dev>` rather than a myset.vip address. It works today; it
  is a deliverability and trust liability the first time somebody who is not Perry
  signs up, and it is the cheapest of all of these to fix.

**Two things Perry does once in the Stripe dashboard** for billing to be whole: add
`customer.subscription.updated`, `customer.subscription.deleted` and
`invoice.payment_failed` to the webhook endpoint (`checkout.session.completed` is
already there and now also carries subscription checkouts), and save the **Customer
Portal**'s default configuration in live mode — the API refuses to open a portal
session until one exists. Products, prices and coupons are created by the app.

`GSHEET_ID` and `GSHEET_EMAIL` are not really secrets (the address has to be pasted
into Google's own share dialog, and `sheetStatus` shows it for exactly that reason);
`GSHEET_KEY` is, and should be marked **Contains secret value** in Netlify.

**A Netlify env var marked secret is unreadable through the API — it returns a
placeholder, not the value.** That is correct behaviour and it has already caused one
false diagnosis: a masked `ADMIN_CODE` was sent to the admin door, correctly refused,
and reported as "the recovery key is broken". Tells are a fixed length, very few
distinct characters, no letters, and byte-identical across all three contexts.

## 5.4 Testing

```bash
npm test        # 854 assertions, 19 suites, no dev server, nothing touches production
```

The suites run the **real handlers** against an in-memory store that implements the
same behaviour as the real one, injected by a module hook. Stripe is stubbed the same
way, and the stub records the options of every call — which is how a direct charge is
proved to be direct.

**`netlify dev` cannot run the write paths.** Its storage sandbox returns no version
tag, so every write after the first fails as busy. Use `npm test`, or the full sandbox
in `_tmp_audit/harness` which serves the real pages against the real functions on a
local port.

## 5.5 Before shipping anything

1. Read the invariants for whatever you are touching.
2. `npm test`.
3. Look at it in a real browser — the sandbox and the headless-Chrome tool in
   `_tmp_audit/` exist for exactly this. Several defects this month were invisible to
   the tests and obvious on screen.
4. Push, then **verify from outside** — check the live URLs, not the local files.

---

# PART SIX — THE RULES, IN ONE BREATH

The full list is `INVARIANTS.md`. These are the ones that matter most.

* **Nothing may break the gig.** Every failure degrades to "the room can still vote".
* **The audience never signs in.**
* **Never show the room a button that leads to a shrug.**
* **A payment must have more than one path to delivery**, and claimed is not delivered.
* **Never grant anything from a client claim** — the payment is verified server-side.
* **A fan can never spend more than they have**, enforced on the server.
* **A bought pack is a stock**, and free credits are spent first.
* **Votes are final**, but a song the artist removes gives its votes back.
* **A cast is idempotent by its own id**, not by state.
* **The artist id comes from the session, never from the request body.**
* **Nothing in the store is global except the registry.**
* **Never invent gig data** — a listed gig sends a real person to a real bar.
* **The tick is premium and still not for sale.**
* **An ID photo is never public and never kept.**
* **Archive before you wipe** — the vote tally is destroyed every time a song starts.
* **Only `public/` is published**, and no secret ever appears in a file or a chat.
* **Count the reads.** Ceilings are tests, not memory.

---

# PART SEVEN — WHAT IS NOT DONE

Full list with priorities: `REVIEW-2026-09-02-REMAINING.md`.

* **Venue merch cannot be bought through MySet** — venues have no payout account, so
  items sell through the venue's own link. Said in the Venue Studio.
* **Videos on community posts are links, not uploads** — a function body tops out
  near 6MB. Said in the composer.
* **No off-switch for scheduled starts.** A gig on the calendar starts its show;
  the artist can end it. A per-gig "don't start by itself" is the obvious next knob.
* **Venue billing does not exist.** Venue Pro is switched on by hand.
* **Push alerts cannot send** — the keys are not set on the server.
* **Payout countries are a 22-country list**, not Stripe's full set. An artist outside
  it cannot start onboarding. Deliberate: the alternative was accepting any two letters
  and creating an account in the wrong country, permanently.
* **Pro extras — press kit, branding, city promotion — are promised in the plan copy
  and not built.**
* **Spotify playlist import cannot run** — `SPOTIFY_CLIENT_ID` and
  `SPOTIFY_CLIENT_SECRET` are not set on the server. The button is in the Studio and
  answers with an honest 503. CSV and pasted text work.
* **Sign-in email still comes from `onboarding@resend.dev`** because `AUTH_FROM` is
  unset. Fine for Perry, wrong for the first stranger who signs up.
* **Reviews from Google and Trustpilot** for venues: specified, not built.
* **Voting on a venue's own speaker music:** specified, not built. Phase one is a push
  to staff; Spotify's queue API is possible but needs Premium, OAuth, an active device,
  and a careful read of their terms on competing jukebox services.
* **A deploy preview shares production data.** The money half is closed — Stripe keys
  are unset for preview contexts — but a preview can still write real data. Use
  previews to look at pages, never to exercise a write path.

---

*Written 2026-09-03. Extended 2026-09-04 with the community page, merch, scheduled
shows, the tick, the menu and the Voting box — test suite run rather than quoted:
1,059 assertions, 0 failures.*
