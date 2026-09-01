# MySet — the whole thing, in one place

*Master reference, 2026-08-31. Live at **https://myset.vip**.*

This is the single organised document for MySet: what it is, what it does, how it
is built, what it costs to run, what has already gone wrong, and what is left.

Four companion documents go deeper on their own subjects, and this one points at
them rather than repeating them:

| Document | What it is for |
|---|---|
| **`INVARIANTS.md`** | 78 numbered rules, every one of them written *after* something broke. Read before touching storage, money or auth. |
| **`GIG-NIGHT.md`** | The run-the-show cheat sheet. What to tap, in order, on stage. |
| **`VERIFYING-A-VENUE.md`** | How a venue proves it is real, what is built, and the honest answer on Google My Business. |
| **`HANDOFF-MySet.md`** | The running session log — what changed when, and why. |

---

# 1 · What it is

**A live audience votes, from their own phones, on which song the musician plays
next.** No app to install, no account to make, no wifi required beyond whatever
data they already have. They scan a code on the table, they see the setlist, they
vote, the top song plays next.

Around that sits everything a working musician needs to turn one good night into
the next booking: a public page, a gig calendar, a city-wide what's-on feed, show
history with real numbers, and a way to reach venues with those numbers attached.

And around *that* sits a second kind of account for the **venues** themselves.

### The ambition, stated plainly

This is not a personal tool. The intent is a **$10/month product used by
thousands of musicians worldwide** as passive income. Every design decision is
weighed against that: does it hold up with a thousand artists, or only one?

Gross margin at that scale is roughly **95%** — the whole thing runs on static
files plus serverless functions plus a key-value store.

### The two nights that shaped it

**2026-08-30, The Ugly Duckling Irish Pub, Koh Phangan.** First real gig. 8
people voting, 21 votes, one $3 purchase. Two things broke — a paying customer got
nothing, and Perry could not log into his own studio — and both are now
invariants. The engagement in the room was the proof that this is worth building
properly.

---

# 2 · Where everything lives

| Thing | Where |
|---|---|
| Live site | `https://myset.vip` |
| Repo | `github.com/perryidyll/myset` (private) |
| Working copy | `~/Docs/MySet` |
| Host | Netlify site `mysetvip`, id `8f5c9f01-e1f1-47e3-add1-8dde39efd1d3` |
| Deploy | **`git push`** — Netlify builds `main` automatically. Never `--prod` from the CLI (INVARIANT 9d3). |
| Published | **`./public` only.** Docs, functions source and backups are never served. |

### Public URLs

| URL | Page | Who it is for |
|---|---|---|
| `/` | `index.html` | Anyone — pick a country and city, see what's on this week |
| `/<slug>` | `artist.html` | An artist's public page (`/perryidyll`) |
| `/<slug>/vote` | `vote.html` | The voting page — what the room scans |
| `/v/<slug>` | `venue.html` | A venue's public page |
| `/studio` · `/signup` | `studio.html` | Artist Studio (sign-in gated) |
| `/venues` | `venue-studio.html` | Venue Studio (sign-in gated) |
| `/about` | `about.html` | The landing page |

`/:slug` is a catch-all, so an unknown path renders `artist.html`'s honest "No page
here" state rather than a 404 from Netlify.

### Secrets — none of these are ever in the repo

Set by Perry in Netlify's env, per context. **Changing one requires a redeploy** —
running functions do not pick up env changes.

| Var | What it does | If unset |
|---|---|---|
| `ADMIN_CODE` | The recovery studio passcode | Studio auth fails closed |
| `STRIPE_SECRET_KEY` | Card payments | App degrades gracefully, no payments offered |
| `STRIPE_WEBHOOK_SECRET` | The webhook delivery path | Webhook returns 503, inert |
| `RESEND_API_KEY` | Sign-in code emails | Email sign-in refuses with a clear message |

The session-signing secret is **not** an env var — it is generated once into the
`authsecret` blob, so there is one less thing to configure by hand.

---

# 3 · The night, start to finish

1. **Before.** Artist opens the Studio → Settings → *Fetch lyrics for the whole
   setlist* (once, ~30s). Sets free votes per person, vote-pack prices, whether
   requests and birthdays are on.
2. **On arrival.** Live tab → **Start the show**. Nothing says "live" to the
   audience until this is tapped.
3. **The room.** People scan the QR on the table → the voting page. No install, no
   sign-up. They get their free votes (3 by default).
4. **They vote.** Up Next shows the top three by votes. Voting again on the same
   song un-votes it and refunds the credit.
5. **The artist plays.** *Start top voted* — or taps ▶ on any song. Starting a song
   **refreshes everyone's votes**, so each round is a fresh contest.
6. **They want more.** Buy more votes ($3/3, $7/9, $11/18 by default, artist-set)
   or tip. Straight into Stripe Checkout, straight back.
7. **They ask.** *Request a song* that isn't on the list, or a *birthday shout-out*
   with a name — paid in votes, never money. The artist adds it to the setlist,
   marks it done, or declines (which refunds automatically).
8. **They sing.** *Lyrics* under Now Playing, for the current song only.
9. **After.** End the show. Everything is archived — songs played with the votes
   they won, what the room wanted and never got, how many people were there, and
   the money, pulled from Stripe.

---

# 4 · Everything it does

## 4.1 · For the audience — all free, forever

Anything the **room** experiences is free on every plan. An audience that gets a
sing-along at one artist's gig and not the next learns that MySet is unreliable,
which costs more than a subscription is worth (INVARIANT 0w).

| Feature | Detail |
|---|---|
| **Vote on the next song** | Free credits per person, refreshed every time a song starts. Toggle to un-vote. |
| **Up Next** | Top three by votes, with the winner marked. Same ranking rule the Studio uses, so the two can never disagree. |
| **Search & sort** | Search title or artist; Top voted / Song A–Z / Artist A–Z. |
| **Play it again** | Already-played songs stay votable at a higher cost (5 votes by default). |
| **Buy more votes** | Three packs, prices set by the artist, never trusted from the browser. |
| **Tip** | Preset or custom amount, with a note the artist sees on stage. |
| **Lyrics** | Current song only. Labelled *Unofficial lyrics* with the songwriter credit. |
| **Request a song** | Something not on the list. Costs votes. Off until the artist turns it on. |
| **Birthday shout-out** | With a name field. Costs votes. Off until turned on. |
| **Leftover paid votes** | If the show ends with votes they paid for, they choose: keep for next time, or let the artist keep it as a tip. |
| **No account, ever** | The audience never signs in. That is the whole reason it works in a bar. |

## 4.2 · The city feed — `/`

An animated opener, then two comboboxes: **country** and **city**, with live gig
counts. Then what's on over the next seven days, grouped by night —
*"Tonight – 31 August"* — with a **Directions** pin on each row.

It carries two kinds of thing: **gigs** an artist listed, and **events** a venue
listed (quiz night, a DJ, the football), tagged so a reader can tell them apart.

A 10pm set that runs to 2am is still "on" at 1am, and belongs to the night it
started — the thing most listings get wrong.

## 4.3 · For artists — the Studio, six tabs

### Live
Votes now · phones in the room · tips. Now Playing. **Start the show** / End it.
**Start top voted** with the winner named. The queue with ▶ on every row. Played
list with Undo. Recent tips. And the **requests panel** — song requests and
birthday shout-outs with *+ Add* / *Did it* / *✕ refunds them*.

### Setlist
One **library** of songs, and **setlists** are named subsets of it — a beach set, a
late set, the one for the Irish pub. The row at the top of the tab always says what
the room can currently see. A setlist holds song IDS only, so renaming a song
changes it everywhere at once.

Search and the same three orders the audience has, plus a **genre filter** built
from the same tags the room filters by. Add a song through a sheet: title, artist,
the **key you play it in**, genres, and your own **chord chart** — the key and the
chart never reach the audience. **Auto-tag songs** fills the genres from a curated
map of how streaming services classify them, and only ever fills a song that has
none, so it can't undo a choice you made by hand.

Per-song **Edit**, **Hide** (permanent across shows until un-hidden), **✕ remove**.
A row says whether it is in the pool, played, hidden, or **not in this set**. A
starter pack of ~60 well-known covers, opt-in. Plans limit how many songs are
**featured** (live to the audience), never how many you can keep.

**Want to learn** sits at the bottom: songs you don't play yet. They are not in the
library, so nobody can vote for them. *Learned it* moves one across in one action.

**Which set plays tonight** can be set per gig, in three states that are not
interchangeable: *leave whatever I've picked* (`''`), *All songs* (`'all'`), or a
named set. Tapping **Start the show** — or **↺ New show** — applies it. A gig
pointing at a set you have since deleted leaves your pick alone and tells you.

### Gigs
A flippable month calendar with dots on the nights you play. Add a gig once for a
whole residency — **weekly / every 2 weeks / monthly / yearly**, with an optional
stop date. Cancel a single night without touching the run. Address and/or a pasted
Google or Apple Maps link. And **"Venues you've asked"** — the enquiries you have
out, and what they said.

### Money
Tonight's numbers, then every past show: songs played with the votes each won,
what the room wanted and never got (summed across every round), money split
between vote sales and tips, and every Stripe payment. **Stripe is the source of
truth** — there is a *Re-check the money in Stripe* button that re-pulls it.

### Profile
Cover photo, a croppable square portrait, three smaller photos. Name, one-liner,
bio. Streaming links (Spotify / Apple Music / YouTube Music / Instagram /
website). Embedded YouTube, Spotify and Apple Music, click-to-load so nothing
third-party is fetched until someone asks.

### Settings
Free votes per person (presets, any number, or unlimited) · replay cost · the
three vote-pack prices · **requests and birthdays** on/off with their own prices ·
tonight's venue · voting open/paused · unlimited votes for your own phone ·
fetch-all-lyrics · your plan and a promo code box · **what venues can see** ·
your public URL · **codes to print** (QR) · invite another musician · who can sign
in · your own studio passcode · new show / reset.

### The artist's public page — `/<slug>`
Cover, portrait with three photos arced over its corner, name and one-liner. A
**Join live** button that becomes a live countdown to the next calendar gig when
you are not playing. Five numbers: **Joined · Shows · Audience · Votes cast ·
Songs**. Tonight's gig with Directions. Bio. Upcoming shows. Links. Embedded
media.

## 4.4 · For venues — the Venue Studio, five tabs

A venue is a **separate kind of account**, not a role on an artist: its own
registry, its own session token, its own sign-in code realm. A bar has opening
hours and a menu and never runs a show, and it must never be able to reach an
artist's setlist, votes, history or money. Separate registries make that
structural rather than a permission check somebody forgets to write.

### Page
Cover photo + three more. Name, one-liner, about. City, country, address, pasted
maps link. Phone, WhatsApp. **22 amenities** — including *House PA / backline*,
which is the first thing an artist looks for. Opening hours for all seven days
(closing after midnight is fine). Website / Instagram / Facebook / Google links.
And at the top, the **verification checklist**.

### What's on
Three things:
1. **Live music** — pulled from artists' own calendars, automatically. Nothing to
   type.
2. **Your own events** — quiz night, a DJ, the football, a full moon party. Enter a
   weekly one once; it repeats itself, shows on your page, and goes into the local
   what's-on feed like a gig does.
3. **Who wants to play here** — enquiries from artists, each with their real
   numbers.

### Numbers
People in the room · votes cast · nights · acts. Busiest night. **By act**, with
*average people per night* as the headline — the number that answers "who fills my
room". **By night**. All of it built from show history that already exists: no new
tracking, no extra writes.

**Money is not in that payload at all**, not even as a total. And it is the
artist's data, so every artist has a switch (default on).

### Menu & offers
A link to the full menu, a one-liner about the food, and up to **24 highlights**
with sections and prices. Up to **6 offers** — happy hour, two-for-one, a free
shot for anyone who votes — each with a title, detail and when it runs.

### Settings
Your public URL · verification state · **codes to print** ("Tonight's music &
menu") · who can sign in · sign out.

### The venue's public page — `/v/<slug>`
Cover (or a lettered gradient if there isn't one). Name with a **✓ Verified** or
**Unverified listing** chip, and *"Confirmed by N artists who play here"* when it
applies. Directions · Call · WhatsApp · Menu. On now / Next up. About. **What's
on**, grouped by night, music and venue events together. Offers. Menu. Amenities.
Opening hours with today highlighted. Photos. Links. Who plays here. And the
**"Want to perform here?"** card.

## 4.5 · The two sides meeting

### "Want to perform here?"
An artist asks a venue for a spot from the venue's public page. **Only a signed-in
artist can send one** — an open contact form is a spam funnel, and it throws away
the only thing that makes this better than an email: the venue gets a link to a
real page with real numbers on it instead of a bio and a promise.

The venue marks it **Keen** or passes. **No email address is exchanged in either
direction.** Keen shows up in the artist's own Studio and they take it from there
through the links on each other's pages. One enquiry per artist per venue; asking
again updates the message.

### Matching gigs to venues — the good bit
**Nothing is stored linking a gig to a venue. The NAME does it, inside the venue's
own city.** Artists type venue names by hand and type them differently every time
("The Ugly Duckling", "Ugly Duckling Irish Pub ☘️🍻"), so `sameVenue()` compares
normalised words and accepts a containment match only when the shorter name is
*distinctive* — two words, or eight characters. Without that rule a venue could
register itself as "Beach" and claim every Beach Bar in town.

The payoff: **a venue signing up today already has its whole diary.** No backfill,
no job to run, nothing for an artist to re-enter. Proven live — a venue named "The
Ugly Duckling Irish Pub" picked up all nine of Perry's residency nights with zero
data entry.

### Verification
Three routes, any one of which earns the green tick. Full detail in
`VERIFYING-A-VENUE.md`.

1. **The website.** Two checks, *both* required: the sign-in email is on the
   website's own domain (free-mail domains refused), **and** the fetched page
   actually names the venue. Either alone is not proof — anyone can buy a domain,
   and the website is just a URL somebody typed in.
2. **Ten artists** who each have a gig at the venue in their own calendar confirm
   it. An artist with no gig there cannot vouch. This is the route that works for a
   bar with no website.
3. **Perry's own switch**, owner-only, in his Studio's Settings.

Unverified pages work completely. The chip is the whole difference.

## 4.6 · QR codes

Hand-written encoder (`_qr.mjs`) — Reed–Solomon over GF(256), byte mode, level M,
versions 1–10, proper mask-penalty scoring. Tap a code in either Studio and it
comes up **full screen on white paper with a serif caption**, ready to screenshot
or print.

| Code | Caption |
|---|---|
| Vote the setlist | *Scan to choose the next song!* |
| Your page | *Hear more on MySet!* |
| MySet | *Find live music near you* |
| Venue page | *Tonight's music & menu* |

`/api/qr` takes a **kind**, never arbitrary text — a general "encode this string"
endpoint would make the site a free generator of QR codes pointing anywhere, which
is exactly the shape of a phishing tool.

Every code is verified by **decoding** it with an independent decoder, never by
looking at it. Two bugs were found only that way: format bits written in reverse
(scanned as nothing while looking perfectly plausible), and a wrong mask penalty
that chose unreadable masks.

## 4.7 · Addresses and directions

There is **no single link that opens in whichever map app a phone actually uses**.
`geo:` is the closest thing on paper and iOS Safari ignores it. So the server
builds **both** an Apple and a Google URL and the page picks by platform.

Coordinates are pulled out of a pasted Google / Apple / OpenStreetMap link when
they are in it. A `maps.app.goo.gl` short link hides them behind a redirect, and we
do not fetch third parties on the artist's behalf — so it keeps the link and falls
back to the address.

**A bare venue name is not a location.** "The Ugly Duckling" on its own could send
somebody to Amsterdam, so there is no Directions button unless there are
coordinates, an address, or a name *with* a city. No button beats a wrong one.

---

# 5 · How it is built

## 5.1 · The shape

```
public/            static pages — the only thing published
netlify/functions/ one file per endpoint, plus _-prefixed libraries
Netlify Blobs      the whole database
Stripe             money, and the source of truth for it
Resend             sign-in code emails
LRCLIB             lyrics
```

No build step, no framework, no bundler config beyond esbuild for the functions.
Every page is one HTML file with its own styles and script; `app.css` carries the
shared design tokens.

## 5.2 · Storage — the hard-won part

Netlify Blobs is a key-value store, and three things about it are load-bearing:

* **`list()` is eventually consistent and can lag MINUTES.** Never use it for live
  data. Every read is `getWithMetadata(key, {consistency:'strong'})` against a key
  we already know. `list({prefix})` also returns nothing when the prefix cuts
  inside a nested `a/b/` path, which is why every key is flat.
* **Conditional writes (`onlyIfMatch`) need @netlify/blobs v10+** — v8 silently
  ignores them — and *even then* can report success without sticking under
  concurrency. So every write is a compare-and-swap loop **verified by read-back
  and retried**.
* **Contention is the enemy.** Fan records are **sharded across 12 documents** so a
  burst of voters spreads out instead of fighting over one. Load-tested at 80
  simultaneous voters: zero lost votes.

### The keys

Everything that belongs to an owner is namespaced by their id. Only five documents
are global.

| Key | Holds |
|---|---|
| `show_<aid>` | An artist's show config and setlist. Written rarely. |
| `f0…f11_<aid>` | Sharded fan records: votes, paid extras, spend, presence stamp |
| `meta_<aid>` | Tips and payment markers. Written only on payment. |
| `profile_<aid>` | Public page content |
| `ev_<aid>` | Gig calendar — **rules, not instances** |
| `histidx_<aid>` · `hist_<aid>_<showId>` | Show history index and per-show archives |
| `lyr_<aid>_<songId>` | Cached lyrics |
| `req_<aid>` | Song and birthday requests |
| `lists_<aid>` | The artist's named setlists — song IDS only, never song data |
| `learn_<aid>` | Songs they want to learn. **Deliberately NOT in the library**, so the room can't vote for something unplayable |
| `chart_<aid>_<songId>` | The artist's own chord chart. Never in a public payload, and never on the `/api/show` read path |
| `apitch_<aid>` | Which venues this artist has asked |
| `vprofile_<vid>` | Venue page content |
| `ev_v_<vid>` | A venue's own events — same engine, owner id `v_<vid>` |
| `vpitch_<vid>` | A venue's enquiry inbox |
| `vouch_<vid>` | Which artists have confirmed this venue |
| `img_<owner>_<slot>` | Photo bytes |
| **`artists`** | *global* — the artist registry: `byId` / `bySlug` / `byEmail` |
| **`venues`** | *global* — the venue registry |
| **`cityindex`** | *global* — country → city → owner ids, so the public feed reads one known key |
| **`promos`** | *global* — discount codes |
| **`authsecret`** | *global* — the session signing key |

Artist ids and slugs are stripped to `[a-z0-9-]`, so **an underscore can only ever
mean a venue**. That is what makes `v_<vid>` unforgeable in both directions and
lets the city index and the image store hold both kinds with no migration.

## 5.3 · Multi-tenancy

The artist id comes from `requireArtist(req)` (session or the legacy studio code)
or `publicArtist(req)` (`?a=<slug>`). **Never from a request body.** That single
rule is why an artist can only ever reach their own records.

A venue session is tagged differently — the artist token body is
`email|exp|rev`, the venue's is `v|email|exp|rev` — and each side rejects anything
that is not its own shape. Verified: a venue token gets 401 from `/api/admin`, and
the studio code gets 401 from `/api/venueadmin`.

## 5.4 · The gig calendar

Gigs are stored as **rules, expanded on read**. A weekly residency is one record,
not 52. Editing "every Thursday at the Ugly Duckling" is one edit, a residency with
no end date needs no maintenance, and there is no job to run.

Wall-clock time in an IANA zone is resolved to an instant on read, with no library
(`_time.mjs`, an `Intl.DateTimeFormat` offset trick iterated twice to settle DST).
Verified: London 28 March 20:00 → 20:00Z, and 29 March → 19:00Z.

Monthly recurrence is always measured from the **original** date. Stepping from the
previous occurrence made "the 31st" clamp to the 28th in February and then stay
there — the gig quietly walked backwards through the year.

## 5.5 · The head-count

The honest count of people at a gig is not "devices that voted" — plenty of people
join, watch the queue move and never tap. So a device stamps itself **once per
device per show**, and only from the voting page (`in=1`), because `/api/show` is
polled by every phone in the room and must not write on the poll.

**It counts phones, not IP addresses.** Counting distinct networks was the first
attempt and it is wrong in exactly the room this app is for: forty people at a
beach bar on the venue's wifi come out as **1**. A phone is much closer to a
person; the worst it does is count someone twice if they clear their storage
mid-gig. The network hash is kept alongside it as the only defence against one
phone rotating its id.

The address itself is never stored — only `sha256('myset-room|<artistId>|<ip>')`
truncated to 16 hex, so the stored value is useless anywhere else and a table built
for one artist tells you nothing about another's.

## 5.6 · Polling, and why it is cheap

Every phone in the room hitting `/api/show` every 3 seconds is 24,000 function
calls for a two-hour gig. So the voting page backs off adaptively: **3s while
anything is moving, easing to 12s when the room goes quiet, and instantly back to
3s on any change or any tap.** Nobody can perceive the difference; the bill can.

Measured: a whole gig's traffic cost about **5 credits**. Sixteen production
deploys in one afternoon cost **240**.

## 5.7 · Perceived speed

Every Studio write takes a `WRITING` lock and raises a blocking overlay after
140ms, **and** `/api/admin` returns the fresh state with the write so a tap is one
round trip, not two. Before this, taps felt slow enough that Perry tapped "Add it"
four times and got four gigs.

## 5.8 · Installable, and the service worker

`public/sw.js` plus a manifest per surface — `manifest.webmanifest` (the city
feed), `manifest-studio.webmanifest`, `manifest-venue.webmanifest` — because
`start_url` is the whole point of installing: an artist who puts the Studio on
their home screen wants the Studio, not the city feed. Icons in `public/icons/`.

The worker is deliberately the most conservative thing that still helps:

* **Nothing under `/api` is ever cached.** A cached vote is a lost vote and a
  cached payment is a support ticket. Verified in a real browser, not assumed:
  after loading the app and calling the API, the only thing in the cache was
  `/app.css`.
* **Navigations are network-first**, with a cached fallback and an inline offline
  page. The newest version of a page always wins, so a bad deploy is fixed by the
  next deploy — not by asking somebody in a bar to clear their browser.
* **Nothing is precached**, so there is no install-time cache to go stale.
* Statics are stale-while-revalidate. Old caches are deleted on activate, and a
  page can post `myset-unregister` to make the worker stand down entirely.

The homepage also carries an **add-to-home-screen** banner and sheet, with iPhone
and Android tabs (iPhone first, because Safari has no install prompt of its own).

---

# 6 · Every endpoint

## Public — no auth

| Endpoint | Does |
|---|---|
| `GET /api/show?fan=&a=&in=` | The whole voting-page payload. `in=1` marks a phone as in the room. |
| `POST /api/vote?a=` | Cast or un-cast one vote. Read-back verified. |
| `POST /api/request?a=` | A song request or a birthday shout-out. |
| `POST /api/pay?a=` | Open a Stripe Checkout session for votes or a tip. |
| `GET /api/confirm?session_id=&fan=&a=` | Redeem a payment on the return trip. |
| `POST /api/webhook` | Stripe-signed redemption, independent of the buyer's browser. |
| `POST /api/gift?a=` | What happens to votes they paid for when the show ended first. |
| `GET /api/profile?a=` | An artist's public page data. |
| `GET /api/events?places=1` | The country/city picker with live counts. |
| `GET /api/events?country=&city=` | What's on there this week — gigs and venue events. |
| `GET /api/events?a=&days=` | One artist's diary. |
| `GET /api/lyrics?song=&a=` | Lyrics for the current song. |
| `GET /api/venue?v=` | A venue's page, its what's-on, and its vouch count. |
| `GET /api/img?a=&s=&v=` | Photo bytes. Cached a year, `?v=` busts it. |
| `GET /api/qr?k=&a=&s=` | An SVG QR code for a known kind of URL. |

## Artist session — `Authorization: Bearer` or `x-admin-code`

`POST /api/auth` — `start` · `verify` · `claim` · `me` · `list` · `add` · `remove` ·
`revokeAll` · `setSlug`

`GET /api/stage` — the Studio payload.

`POST /api/admin` — one endpoint, many actions:

* **show** `play` `playTop` `window` `status` `venue` `city` `showTime`
  `freeCredits` `unlimited` `unlimitedFan` `replayCost` `packs` `resetVotes`
  `newShow` `setCode`
* **setlist** `addSong` `editSong` `removeSong` `toggleSong` `unplay`
  `starterSetlist` `clearSetlist`
* **the song sheet** `songGet` `chartSet` `chartFlags`
* **genres** `tagList` `tagAdd` `tagRemove` `tagAuto`
* **setlists** `listAll` `listNew` `listRename` `listDelete` `listSongs`
  `listToggle` `listUse`
* **want to learn** `learnList` `learnAdd` `learnRemove` `learnDone`
* **requests** `askSet` `askList` `askAccept` `askDone` `askDecline`
* **gigs** `eventList` `eventSave` `eventDelete` `eventSkip` `eventHide`
* **lyrics** `lyricsGet` `lyricsSet` `lyricsFetch` `lyricsWarm`
* **profile** `profileSet` `mediaAdd` `mediaRemove` `mediaMove` `photoUpload`
  `photoClear`
* **plan** `planGet` `promoRedeem` `shareStats`
* **venues** `pitchStatus` `pitchSend` `pitchList` `vouch`
* **owner only** `promoList` `promoCreate` `promoRevoke` `venueList` `venueVerify`

`GET /api/revenue` · `POST /api/revenue` (the reconcile sweep) ·
`GET|POST /api/history`

## Venue session — `Authorization: Bearer` (venue-tagged)

`POST /api/venueauth` — `start` · `verify` · `claim` · `me` · `list` · `add` ·
`remove` · `revokeAll` · `setSlug` · `checkDomain`

`POST /api/venueadmin` — `get` · `set` · `amenity` · `hours` · `menuSet` ·
`menuAdd` · `menuRemove` · `offerSave` · `offerRemove` · `photoUpload` ·
`photoClear` · `eventList` · `eventSave` · `eventDelete` · `eventSkip` ·
`pitchList` · `pitchSet` · `stats` · `verifyCheck` · `verifyPreview`

---

# 7 · Money

## Three delivery paths, one function

On 2026-08-30 a customer paid $3 and got nothing. `/api/confirm` only runs if the
buyer's browser returns to the site; hers didn't. **A payment must never depend on
one delivery path.** There are now three, all funnelling through
`redeemSession()` in `_pay.mjs` so they cannot drift:

1. **The return page** — `/vote.html?paid=…`
2. **The Stripe webhook** — `/api/webhook`, signed, fires regardless of the
   browser
3. **The reconcile sweep** — `POST /api/revenue`, a button in the Studio's Money
   tab

The buyer's phone also stores the pending session id and retries on the next load.
All paths are replay-safe: proven against the real payment with three sweeps plus a
confirm replay, which left the granted total at 5, not 20.

## Stripe is the source of truth

Not the app's own ledger. `/api/revenue` reads Stripe directly, paginates properly
(`sessions.list()` does **not** paginate on its own, and a busy month would
silently truncate), and filters to `metadata.kind ∈ {votes, tip}` — Perry's Stripe
account holds unrelated charges, and the first version reported $133 of somebody
else's business as MySet income.

Money is attributed by `metadata.show`, never by timestamp. Untagged payments are
reported as `unattributed` rather than guessed into a total.

## ⚠️ The open gap — Stripe Connect

**Every artist's audience currently pays into the single `STRIPE_SECRET_KEY` —
which is Perry's own account.**

Stripe Connect is **mandatory before a second artist takes money**: each artist
connects their own Stripe account, and charges carry `application_fee_amount` so
the platform share is taken automatically. Until that exists:

* a second artist's money lands in Perry's account
* the 10% free-plan cut does not exist

This is INVARIANT 0r and it is the single biggest thing left.

---

# 8 · Plans

| | **Free** | **Plus — $10/mo** | **Pro — $20/mo** |
|---|---|---|---|
| Everything the audience sees | ✓ | ✓ | ✓ |
| Songs you can keep | 2,000 | 2,000 | 2,000 |
| Songs **featured** at once | 50 | ∞ | ∞ |
| Cut on money through the app | 10% | none | none |
| Sign-ins | 1 | 1 | 5 |
| Earnings by venue / night / song | — | — | ✓ |
| One-page press kit that writes itself | — | — | ✓ |
| Your colours and logo on the audience pages | — | — | ✓ |
| Promote shows in cities you don't normally play | — | — | ✓ |

Caps are enforced **on add only** and never delete anything. Over the featured
limit, a song still saves — it just arrives switched off, and the API returns a
note the Studio shows.

Data is **viewable in a properly formatted way but not exportable as a
spreadsheet**, deliberately: a spreadsheet can be faked, and the whole value of
showing a venue your numbers is that they came from us.

**Promo codes** are owner-only. `MYSETFREE` (100% off Pro, 12 months) and
`MYSETHALF` (50%) exist. **Referrals**: one free month per referral who goes paid,
recorded at signup from `?ref=<slug>` and immutable afterwards.

---

# 9 · Running it

## Deploy

**Pushing to `main` IS the deploy.** The site is connected to
`github.com/perryidyll/myset` and builds every push automatically.

```bash
cd ~/Docs/MySet && npm test && git push
```

**Never run `netlify deploy --prod`.** For weeks that ran *alongside* the GitHub
build the same push triggered, so every change bought two production deploys —
~555 credits of duplication in one billing period (INVARIANT 9d3). Push code and
docs in one go, too: two pushes is two builds.

**Iterate on draft deploys.** `netlify deploy` (no `--prod`) gives a draft URL and
costs **zero credits**. A production deploy costs **15**.

**An env-var change needs a rebuild** to take effect:

```bash
git commit --allow-empty -m "Redeploy: env change" && git push
```

## The credit model — measured, not guessed

| | Cost |
|---|---|
| Production deploy | **15 credits** |
| Draft / branch deploy | **0** |
| Web requests | 2 per 10,000 |
| Bandwidth | 20 per GB |
| Compute | 10 per GB-hour |

Perry is on **Personal ($9 / 1,000 credits per month)** and buys **non-expiring
500-credit packs at $5**. Break-even against **Pro ($20 / 3,000, no rollover below
the 5,000 tier)** is about **2,100 credits/month**.

`./credit-burn.sh` reports the current period's deploy burn across all four sites
and says which side of that line he is on.

**Two traps:** dropping to the Free plan **forfeits purchased packs**, and
upgrading **wipes unused monthly credits immediately** — so any Personal→Pro move
belongs at the *end* of a billing cycle. And at zero credits Netlify **pauses every
site on the account**, so this is an uptime issue, not just a billing one.

## Before shipping anything

1. **`npm test`.** Four stages, 131 assertions, no dev server and nothing that
   touches production:
   * **syntax** — every page's inline script through `node --check`, every
     function `import()`ed.
   * **structure** — `studio.html` and `venue-studio.html` are one big `render()`
     of `if(TAB===…)` blocks, and a bad edit once deleted two of them while leaving
     valid JavaScript behind, so `node --check` passed and two tabs rendered blank.
     Every tab block and top-level function must appear exactly once. It also
     asserts that each flag the server produces has a CONSUMER — a producer with
     none is how the Studio's queue drifted from `playTop`.
   * **unit** — the predicates: `playable`, `votable`, the `playTop` pool, the
     Studio's own filters, `shapeLists`.
   * **end to end** — whole request flows through the real handlers against an
     in-memory blob store. One case per bug that has actually happened, so a fix
     cannot be quietly undone.
2. Deploy a **draft**, exercise it against the real API.
3. Deploy `--prod`, then **verify from outside** — the live URLs and the live API,
   not the local files.

> `netlify dev --offline` cannot run the write paths: its Blobs sandbox returns no
> etag, so `casDoc` falls back to `onlyIfNew`, every write after the first fails,
> and the second call in any test returns "busy". That is why the suite injects its
> own store rather than using the CLI. To eyeball the UI locally you can still run
> `netlify dev` and seed `.netlify/blobs-serve/entries/<siteId>/site:myset/` by
> hand — reads work fine.

---

# 10 · The rules, in one breath

`INVARIANTS.md` has all 98. These are the ones that will bite hardest if
forgotten:

1. **Never `list()` for live data.** Strong reads on known keys only.
2. **Every write is CAS + read-back verified.** Fan records are sharded 12 ways.
3. **`clearAllFanVotes()` destroys the tally on every song start.** The number a
   song won with lives for about a millisecond, so `admin.mjs` snapshots the whole
   round into `show.log` in the same handler. Archive before any wipe.
4. **A payment must never depend on one delivery path.** Three, all replay-safe.
5. **Stripe is the source of truth for money.** Filter by `metadata.kind`.
6. **The artist id comes from the session, never the request body.**
7. **A venue is a different account, not a role.** Separate registry, separate
   token tag, separate code realm.
8. **The audience never signs in.** That is why it works in a bar.
9. **Anything the room experiences stays free.** Gate the back office, never the
   night.
10. **Never charge money for a request.** Requests cost votes.
11. **`status` defaults to `'pre'`, never `'live'`.** A show is live when the artist
    taps Start.
12. **Never invent gig data.** A listed gig sends a real person to a real bar.
13. **A JS parse check is not a structure check.**
14. **QR codes are verified by decoding, never by eye.**
15. **`_verify.mjs`'s fetch is the only place we request a stranger's URL** — and it
    is guarded like it. Never relax a guard to make one venue's check pass.
16. **A bare venue name is not a location.**
17. **Never pre-fill a "new record" form from the previous record.**
18. **`.go` belongs to app.css.** It has been reached for by accident twice.
19. **Nothing costs the artist their own data.** Money is never in a venue's
    payload, and the artist has the switch.

---

# 11 · What is left

| | |
|---|---|
| **Stripe Connect** | The blocker. Until it exists, a second artist's money lands in Perry's account and the 10% cut does not exist. |
| **Self-serve subscriptions** | Plans exist and are enforced; there is no billing to charge them. Needs Connect first. |
| `MIN_VOUCHES = 10` | Probably too high for an island where a bar hosts four or five acts. One constant. |
| Booking follow-through | An enquiry marked *Keen* stops there. No thread, no calendar hold. |
| Venue analytics for artists | The venue sees which acts fill their room; the artist can't see which venues fill theirs. |
| Press kit | Promised on Pro, not built. |
| Branding | Promised on Pro, not built. |
| Promote in other cities | Promised on Pro, not built. |
| Community feed | Scoped in an early session, never built. |
| Venue cover crop | Centre-cropped on upload, not interactively croppable like the artist portrait. |
| Residency roll-up | A weekly resident act renders one day-heading per night on the venue page. |
| Artist attributions | `Wagon Wheel → Darius Rucker` (vs Old Crow) and `Hallelujah → Jeff Buckley` (vs Cohen) are still unconfirmed. |
| SSD mirror | Not mounted for several sessions. Nothing mirrored. |

---

# 12 · How it got here

46 commits, all on 2026-08-31 except the earlier prototype work.

| | |
|---|---|
| **2026-07-22** | Started as a single-file HTML prototype. Named *Encore*, renamed **MySet** the same day. |
| **2026-08-06** | Live page redesigned around a now-playing hero and a pool-first queue. |
| **2026-08-17** | Full redesign to the "Modernist" system, then **shipped as a real product** — static pages + Netlify Functions + Blobs + Stripe. |
| **2026-08-30** | **First real gig.** 8 voters, 21 votes, one $3 purchase. Two failures. |
| **2026-08-31** | Everything else. Payment delivery fixed three ways. Lyrics. Magic-link sign-in. Multi-tenancy. Gig calendar and the city feed. Photos, plans, promo codes, referrals, QR codes. Requests and birthday shout-outs. Addresses and directions. The whole **venue studio** — profiles, events, bookings, room numbers, verification. |

---

*Everything in this document was verified against the live site, not remembered.*
