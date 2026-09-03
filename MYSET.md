# MySet — the complete handover

**Everything MySet is, does, charges for and depends on.** Written 2026-09-03 against
the live code at commit `e4f763f`. If this document and the code ever disagree, the
code is right and this file is stale — but it was accurate the day it was written, and
every number in it was read out of the source rather than remembered.

Companion documents, all in this folder:

| File | What it is for |
|---|---|
| `INVARIANTS.md` | **Read before changing anything.** 133 properties that must survive every change. Most were discovered by being broken. |
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

## 1.5 The two nights that shaped the product

**2026-08-30 — a paid customer got nothing.** A woman bought a $3 vote pack. Payment
delivery depended on her browser returning to the site; it never did, so she was
charged and received nothing. There are now **three independent delivery paths**, and
a claimed-but-undelivered payment is tracked as still owed rather than settled.

**The same night — Perry could not get into his own Studio.** The passcode existed
only in a server environment variable he had no copy of. Artists now set their own
code, and there is a recovery key.

Almost every defensive rule in `INVARIANTS.md` traces back to one of those two
failures, or to an audit finding that would have caused a third.

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

## 2.3 The Artist Studio — six tabs

`/studio`. Dark-only by design — it is used on a stage.

### Live
The tab the artist watches during a gig.
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

### Profile
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
* the Studio passcode
* QR codes for the home page and the voting page
* team members, sign out, sign out everywhere
* plan, upgrade, promo codes, referral link
* **owner only:** the ID review queue, venue plans, promo code minting, venue
  verification, feature flags

## 2.4 The artist's public page

`/<slug>`. Cover photo, avatar, name, "Live now — vote the setlist" when a show is on,
stats, upcoming gigs with dates and addresses, embedded music, links, and a **Join
live** button.

## 2.5 The city gig finder

`/`. Pick a country and city, see what is on tonight and this week — artist gigs and
venue events together, with times in the venue's own local clock. Search, an install
banner, and links for artists and venues.

## 2.6 The Venue Studio — five tabs

`/venues`.

* **Page** — name, tagline, about, address, map link, phone, WhatsApp, links, photos,
  amenities (20 to choose from: house PA, sea view, pool table, dog friendly…)
* **What's on** — the venue's own events (quiz nights, DJs, football), same calendar
  engine as artist gigs
* **Numbers** — how many people were in the room on live-music nights
* **Menu & offers** — a menu link or items, plus happy-hour style offers
* **Settings** — the verification checklist, the page address, team, sign out

## 2.7 The venue's public page

`/v/<slug>`. Photos, tagline, about, what's on, hours, offers, amenities, directions,
and the verification badge if earned.

## 2.8 The two sides meeting

Artists can **pitch a venue** for a slot — only signed-in artists, so a stranger cannot
spam a bar. Venues see pitches in their Studio and reply. Gigs and venues are matched
by **name within a city**, never by a stored link, so neither side can break the other.

---

# PART THREE — THE MONEY

## 3.1 Artist plans

| | **Free** | **Plus** | **Pro** |
|---|---|---|---|
| Price | $0 | **$10/month** | **$20/month** |
| **MySet's cut of money through the app** | **10%** | **2%** | **0%** |
| Shows per calendar month | **4** | unlimited | unlimited |
| Songs live to the audience at once | 50 | unlimited | unlimited |
| Team seats | 1 | 1 | 5 |
| Separate setlists | — | ✓ | ✓ |
| Set your own prices | — | ✓ | ✓ |
| Verification tick | — | ✓ | ✓ |
| Promote in other cities | — | — | ✓ |
| Earnings analytics | — | — | ✓ |
| Press kit | — | — | ✓ |
| Your own branding | — | — | ✓ |

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

## 3.2 Venue plans

| | **Free** | **Pro** |
|---|---|---|
| Price | $0 | **$20/month** |
| Photos | 3 | 12 |
| Google / Trustpilot reviews | — | ✓ |
| Verification tick | — | ✓ |
| Receive tips | — | ✓ |
| Voting on the venue's own speaker music | — | ✓ |

**Not self-serve yet.** There is no venue billing; Perry switches a venue to Pro by
hand. The Venue Studio says so plainly rather than pretending otherwise.

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

---

# PART FOUR — HOW IT IS BUILT

## 4.1 The shape

Static HTML pages plus **Netlify Functions** on **Netlify Blobs**. No framework, no
build step, no database. Every page is one self-contained file with its own styles and
script; `app.css` carries the shared design tokens.

* **Front end:** 8 pages in `public/`
* **Back end:** 21 endpoints and 26 shared libraries in `netlify/functions/`
* **Tests:** 578 assertions across 13 suites, run with `npm test`

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

**Artist session** — `POST /api/admin` (88 actions), `GET /api/stage`,
`POST /api/auth`, `GET|POST /api/revenue`, `GET|POST /api/history`

**Venue session** — `POST /api/venueadmin` (20 actions), `POST /api/venueauth`

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

**Owner only:** promoList · promoCreate · promoRevoke · venueList · venueVerify ·
venuePlan · idQueue · idApprove · idReject · flagList · flagSet

## 4.4 Storage

Netlify Blobs, one store, everything namespaced per artist or venue.

**Per artist:** `show_` · `f0…f11_` (fan records, sharded) · `meta_` (payments and
tips) · `hist_` and `histidx_` (past shows) · `ev_` (gigs) · `lists_` · `learn_` ·
`req_` (requests) · `profile_` · `img_` (photos) · `chart_` · `lyr_` · `push_` ·
`connect_` · `fb_` (feedback) · `lock_` (passcode lockout) · `apitch_`

**Per venue:** `v_` · `vprofile_` · `vouch_` · `vpitch_`

**Global — the only shared documents:** `artists` (the registry) · `venues` ·
`cityindex` · `acctindex` · `flags` · `idqueue` · `promos` · `authsecret` · `authc_`

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
`SPOTIFY_CLIENT_ID` · `SPOTIFY_CLIENT_SECRET`

Currently set in production: the Stripe pair and Resend. **The push keys are not set**,
so alerts cannot send yet.

## 5.4 Testing

```bash
npm test        # 578 assertions, 13 suites, no dev server, nothing touches production
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

* **The verification tick is not rendered on a public artist page.** An artist can earn
  it and nobody can see it. Next obvious piece of work.
* **Venue billing does not exist.** Venue Pro is switched on by hand.
* **Push alerts cannot send** — the keys are not set on the server.
* **Payout countries are a 22-country list**, not Stripe's full set. An artist outside
  it cannot start onboarding. Deliberate: the alternative was accepting any two letters
  and creating an account in the wrong country, permanently.
* **Pro extras — press kit, branding, city promotion — are promised in the plan copy
  and not built.**
* **Reviews from Google and Trustpilot** for venues: specified, not built.
* **Voting on a venue's own speaker music:** specified, not built. Phase one is a push
  to staff; Spotify's queue API is possible but needs Premium, OAuth, an active device,
  and a careful read of their terms on competing jukebox services.
* **A deploy preview shares production data.** The money half is closed — Stripe keys
  are unset for preview contexts — but a preview can still write real data. Use
  previews to look at pages, never to exercise a write path.

---

*Written 2026-09-03 against commit `e4f763f`. 578 assertions passing.*
