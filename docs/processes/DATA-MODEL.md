---
canvas: Tools (entities and attributes)
puzzle_entity_ids: 4843–4890
sources:
  - MYSET-MASTER-OVERVIEW.md §5.2 Storage (the key families), §1.4 (the credit ledger)
  - netlify/functions/_lib.mjs (defaultShow, KEY, mutateFan, emptyMeta), _account.mjs (the one place a new per-artist key must be added), and the module that owns each family — named per entity below
  - INVARIANTS.md 1, 2, 5c, 5d, 0ae, 0bu, 0ci, 9d6
status: loaded
loaded: 2026-09-12 (create_data_model in six batches; link_to_steps type=attribute — the first attribute of every entity is linked to the steps that write or read it)
verified: code read 2026-09-12 for the shapes quoted; the canvas in a browser is the founder's
---

# The data model — one entity per storage family

**The rule this sheet follows:** one Puzzle entity per key family in overview §5.2, attached to the tool where the bytes live — Netlify (Blobs) for everything but the clip bytes (Cloudflare R2) and the three Stripe objects MySet reads. Attributes are the fields the owning function reads and writes; a slash-joined name (`used / freeUsed`) is one attribute in Puzzle standing for the fields it names, because a document is not a table and the model should not pretend otherwise. Numbers are never copied (overview §2.1 is the source); a cap is named by its constant.

**Six families the overview's §5.2 list does not mention** but `_account.mjs` enumerates for export and delete: `sess_`, `log_`, `rec_`, `pkeys_`, `ledidx_`, `feats_` — plus `bugs_` and `err_<hour>` from `_errlog.mjs`. They are here; §5.2 should gain them (the overview is in another session's tree today).

**Every step linked below is the first attribute's link** — open the entity in Puzzle and the steps that touch the document are listed on it.


## Netlify Blobs — the one store


### Show (show_) — entity 4843

`show_<aid>` · The artist's one live document: tonight's setlist, the vote tally, what is playing, the prices. Polled by every phone in the room, so nothing that is not needed on the poll lives here. Written by the Studio and the vote path; normalised on every read (normShow). `src: _lib.mjs defaultShow, KEY.show`

| attribute | type | what it holds |
| --- | --- | --- |
| `status` (46027) | Single-line text | pre | live | ended — 'pre' until the artist taps Start, so no page claims a gig is happening because an account exists |
| `songs` (46028) | Multi-line text | the whole library: id, title, artist, key, genres, votes tonight; the single source of truth for what a song IS |
| `nowPlaying / nowPlayingAt` (46029) | Single-line text | the song on stage and when it started; a song started in the last idle window defers an auto-end (INVARIANT 16) |
| `played` (46030) | Multi-line text | song ids played tonight, in order — a played song's votes leave the board and never come back (decision 0001) |
| `windowOpen` (46031) | Single checkbox | voting open or paused, the artist's switch |
| `freeCredits / replayCost / packs` (46032) | Number | the night's prices — the free allowance, the cost of a replay, the vote packs; numbers cited from overview §2.1, never copied |
| `requests / birthdays` (46033) | Single-line text | {on, cost} for each kind of ask; off by default — an artist who cannot play requests is never asked for them |
| `listId / listName / listSongs` (46034) | Multi-line text | which setlist is in play and a PROJECTION of its ids, kept here so the poll never reads a second document (_lists.mjs) |
| `gigCount / freeNight / discardWarnedAt` (46035) | Number | free-plan shows started, in total, for the gig cap (0120) — stored, because a show in progress is not in history yet; `freeNight` is what the current night used, `discardWarnedAt` when the one warning about discarding a real night was given (0122) |
| `showId / startedAt / log` (46036) | Single-line text | the night's identity; one log entry per song started; the auto-start stamps the gig occurrence key so a cron that rings twice cannot start it twice |

Linked steps: 369798, 369802, 369814, 369848, 369852

### Fan shard (f0…f11_) — entity 4844

`f0…f11_<aid>` · Fan records, sharded across twelve documents by device id so a burst of voters never contends on one key. Each record is one device's night: votes held, credits used, bought credits. Every write is compare-and-set and re-read (storage rule 4). Never exported, never named (0bu). `src: _lib.mjs mutateFan, readFans, shardKey; overview §1.4`

| attribute | type | what it holds |
| --- | --- | --- |
| `v` (46037) | Multi-line text | song ids this device has voted for tonight — a vote is spent the moment it is cast |
| `va` (46038) | Multi-line text | [cost, paidCredits] per held vote grouped by song, so paid counts and an exact decline refund are derivable |
| `used / freeUsed` (46039) | Number | credits spent tonight and how much came from the free allowance; paid spend = used − freeUsed; only ever rises, except an explicit artist decline |
| `extra` (46040) | Number | credits bought with money — a real balance that carries between shows if unspent (decision 0014) |
| `ts` (46041) | Multi-line text | the rate-limit token bucket and timestamps on the record (decision 0030) |
| `net` (46042) | Single-line text | a per-show network hash so the artist can see one network making many phones (INVARIANT 0ae) |

Linked steps: 369787, 369793, 369794, 369791

### Payments and tips (meta_) — entity 4845

`meta_<aid>` · What money moved tonight and who bought what: tips, paid packs by Checkout session, gifts, merch orders, the fee split. A cache of Stripe's truth (INVARIANT 5d), written by the three delivery paths. `src: _lib.mjs emptyMeta; _pay.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `tips` (46043) | Multi-line text | each tip: amount, at, the Checkout session — never the buyer's identity |
| `paid` (46044) | Multi-line text | Checkout session id → what was granted; the replay-safe record all three delivery paths check before granting (INVARIANT 5c/7). A delivered marker older than `PAID_KEEP_DAYS` moves to `paidarc_` (decision 0193) |
| `gifts` (46045) | Multi-line text | credits a fan chose to gift to the artist instead of carrying at show end |
| `orders` (46046) | Multi-line text | merch orders: item, quantity, pickup or shipped, the session |
| `fees` (46047) | Multi-line text | the exact fee split settled per charge (charge.updated), so the artist's statement and the platform's agree |

Linked steps: 369823, 369824, 369825, 369827, 369829

### Payment markers by year (paidarc_) — entity not yet in Puzzle

`paidarc_<aid>_<YYYY>` · The delivered payment markers that left `meta_<aid>.paid` after `PAID_KEEP_DAYS`, one document per UTC year of the marker's `at` (the session's creation). Real money history: mirrored off-site, exported with nothing, deleted with the account. Written by the bell's daily pass (`archiveDue` → `archivePaid`), merged and read back before the marker leaves meta (INVARIANT 0ih); read by every claim check for a session older than `PAID_ARC_MARGIN_MS`, by the Money tab, and by the lifetime readers (`readPaidAll`). Keys run from `PAID_FIRST_YEAR` to now — computed, never listed (INVARIANT 1). `src: _pay.mjs PAIDARC, archivePaid, archivedMarker, readPaidAll`

| attribute | type | what it holds |
| --- | --- | --- |
| `v` | Number | the shape's version, 1 |
| `paid` | Multi-line text | Checkout session id → the marker exactly as it stood in meta (kind, amount, granted, fan, at, song, show, delivered, deliveredAt) — only ever delivered ones |

Linked steps: none yet (the Puzzle pass is owed)

### Past show — the detail (hist_) — entity 4846

`hist_<aid>_<showId>` · One archived night in full: songs played with their votes, what the room wanted and never got, the money split, the room and network counts. Flat key (INVARIANT 2). Written once by the archive when a show ends; refreshed when the money settles. `src: _history.mjs archive`

| attribute | type | what it holds |
| --- | --- | --- |
| `showId / title / venue / city` (46048) | Single-line text | the night's identity — title auto-named from the calendar when the gig lines up (decision 0021, 0031) |
| `startedAt / endedAt` (46049) | Date picker | when the show ran; the archive keeps the earliest start and the latest end it has seen |
| `songs` (46050) | Multi-line text | every song with the votes it won, played or not — the unmet demand is the product's most honest number |
| `money` (46051) | Multi-line text | vote packs and tips for the night with the split, attached from Stripe after the fact (h02) |
| `room / nets / peakVoters` (46052) | Number | how many phones, how many networks, the peak — the network count is the only defence against one phone rotating its id (0ae) |
| `rating` (46053) | Single-line text | how the room rated MySet that night, if asked |

Linked steps: 369932, 369933, 369934

### Past shows — the index (histidx_) — entity 4847

`histidx_<aid>` · One row per archived night, compact, so the Money tab and the public profile read one document instead of N. Carries the top song of the night (decision 0043) and heals itself once when a row lacks a field. `src: _history.mjs readHistIndex, healHistory, ROW_TOPS`

| attribute | type | what it holds |
| --- | --- | --- |
| `rows[].showId / title / venue / city` (46054) | Single-line text | the identity of each night, in order |
| `rows[].startedAt / endedAt` (46055) | Date picker | the night's window |
| `rows[].songsPlayed / totalVotes / peakVoters / room / nets` (46056) | Number | the night's counts, the same ones the detail holds |
| `rows[].top / topPlayed / topPaid` (46057) | Single-line text | {title, votes|plays|paid} — the compact top song stamped by the archive, the bigger of old and new so a wiped tally cannot blank it |
| `rows[].money` (46058) | Multi-line text | the settled money for the night, refreshed when Stripe's word arrives |
| `healedAt` (46059) | Date picker | the self-retiring heal gate: set when every row carries every field; a new row field needs the same treatment |

Linked steps: 369932, 369936, 369854, 369935

### Archived show ids (histids_) — entity 4848

`histids_<aid>` · Every showId ever archived, append-only — the one list that lets an export or a delete find every hist_ document without list() (INVARIANT 1). `src: _history.mjs IDS; _account.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `ids` (46060) | Multi-line text | showIds in archive order; never trimmed |

Linked steps: 369932, 369976, 369977

### Nights awaiting a name (histpend_) — entity 4849

`histpend_<aid>` · Archived nights that could not yet be matched to a calendar gig — held until 'Name these from my calendar' or 'Look for missing shows' places them (decision 0031). `src: _history.mjs readPending, placeShows`

| attribute | type | what it holds |
| --- | --- | --- |
| `list` (46061) | Multi-line text | pending showIds with the times the matcher needs |

Linked steps: 369935, 369936

### Gigs (ev_) — entity 4850

`ev_<aid>` · The artist's calendar as RULES, not instances: a weekly residency is one record. Every read expands the rule over the window it needs. Writing it re-indexes the city feed and the auto-start schedule. `src: _events.mjs emptyEvents, MAX_EVENTS`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].id` (46062) | ID | the gig rule's id |
| `list[].venue / city / country / address / maps` (46063) | Single-line text | where — venue text, city, country, address, and the saved map coordinates or link (decisions 0040, 0041) |
| `list[].date / time / duration / tz` (46064) | Date picker | when — the first occurrence, its local time, its length and timezone |
| `list[].repeat / until / skips` (46065) | Single-line text | weekly / fortnightly / monthly / yearly, an end date, and single nights cancelled or hidden |
| `list[].listId` (46066) | Single-line text | which setlist to play that night |
| `list[].notes / tickets / venueId` (46067) | Single-line text | free text, a ticket link, and the MySet venue it is at, if any |

Linked steps: 369847, 369848, 369919, 370014

### Setlists (lists_) — entity 4851

`lists_<aid>` · Named subsets of the one library, holding song IDS only, like a playlist — so renaming a song changes it everywhere. The active list's ids are also projected onto the show record; applyList() is the only writer that can add to that projection. `src: _lists.mjs emptyLists, applyList`

| attribute | type | what it holds |
| --- | --- | --- |
| `lists[].id / name` (46068) | Single-line text | a setlist |
| `lists[].songs` (46069) | Multi-line text | song ids from the library, in order |
| `active` (46070) | Single-line text | which list is in play, mirrored to show.listId |

Linked steps: 369800

### Songs to learn (learn_) — entity 4852

`learn_<aid>` · Songs the artist wants to learn — NOT in the library, so the room can never vote for something that is not playable yet. `src: _lists.mjs emptyLearn`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].title / artist / note` (46071) | Single-line text | a song and why |

Linked steps: 369800

### Requests and shout-outs (req_) — entity 4853

`req_<aid>` · What the room asked for that was not on the list: a song, a birthday, a mood vote. Each costs votes and may carry a card authorisation captured only after the song is finished (decision 0018). Oldest resolved rows are trimmed at MAX_KEPT. `src: _requests.mjs emptyRequests, MAX_KEPT, MAX_PENDING`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].id / kind` (46072) | Single-line text | song | birthday | vibe |
| `list[].text / name` (46073) | Single-line text | the title asked for, or the birthday name |
| `list[].status` (46074) | Single-line text | pending | accepted | declined | done |
| `list[].votes / fan` (46075) | Number | the votes charged, and the device that asked (never leaves the server) |
| `list[].pi / offer` (46076) | Single-line text | the Stripe PaymentIntent held for a card offer, captured on finish, cancelled on decline |
| `list[].at / resolvedAt` (46077) | Date picker | when asked and when answered |

Linked steps: 369837, 369838, 369839, 369840, 369842

### Artist profile (profile_) — entity 4854

`profile_<aid>` · The public page's words and pictures, plus the merch on it (so the community page reads nothing extra). Photos are slots, not a list (Community & media i04). `src: _profile.mjs MAX_PHOTOS, MAX_MERCH; _account.mjs export`

| attribute | type | what it holds |
| --- | --- | --- |
| `name / tagline / bio` (46078) | Multi-line text | the words; every pasted link goes through safeLink (9b) |
| `links / media` (46079) | Multi-line text | social links and embeds — YouTube, Spotify, Apple Music only, exact-host parsed |
| `photo / avatar / photos` (46080) | Single-line text | slot names (p0…), served by /api/img with a version stamp; a slot is an address, not a list |
| `merch[]` (46081) | Multi-line text | up to MAX_MERCH items: title, price in cents (never above the tip ceiling), link, ship (whether Stripe asks for an address), picture slot = item id |

Linked steps: 369987, 369994, 370014

### Image slot (img_) — entity 4855

`img_<owner>_<slot>` · One picture per named slot, per artist or venue — profile photo, avatar, gallery p0…p11, a merch item, a post's photos, the ID-check upload. Served for a year immutable, keyed by the ?v= stamp that changes on every upload. `src: _img.mjs SLOTS, POST_SLOT, MAX_BYTES; img.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `bytes` (46082) | File | the image bytes as uploaded after the phone's crop — no server re-encode |
| `v` (46083) | Number | the upload stamp that keys the year-long cache |
| `slot` (46084) | Single-line text | which named slot; the ID-check slot is excluded from the public serve |

Linked steps: 370157, 370158, 370159, 370161

### Chart (chart_) — entity 4856

`chart_<aid>_<songId>` · The artist's own chart for a song — words, chords, capo notes, whatever they paste. Its own document because a chart is kilobytes and show_ is on the hot poll path. `src: _lib.mjs KEY.chart; _chords.mjs MAX_CHART`

| attribute | type | what it holds |
| --- | --- | --- |
| `text` (46085) | Multi-line text | the chart, up to MAX_CHART |
| `updatedAt` (46086) | Date picker | last edit |

Linked steps: 370168, 370169

### Lyrics cache (lyr_) — entity 4857

`lyr_<aid>_<songId>` · Synced lyrics fetched once from LRCLIB and kept for ever; a miss is remembered for a month so the stage never asks twice (Community & media l03). `src: _lyrics.mjs MISS_TTL; _lib.mjs KEY.lyrics`

| attribute | type | what it holds |
| --- | --- | --- |
| `lines` (46087) | Multi-line text | timestamped lines, or plain lyrics |
| `miss` (46088) | Date picker | when LRCLIB had nothing — retried after MISS_TTL |
| `source` (46089) | Single-line text | where it came from, for attribution |

Linked steps: 370164, 370165

### Push subscriptions (push_) — entity 4858

`push_<aid>` · The phones on this page that asked to be told about a request, a message or an order while the Studio is closed. Each row carries the address and sign-in (`sid`) that switched it on; eight per address; a sign-out drops the rows of the sign-ins it ends (decision 0114). A venue's phones are `push_v_<vid>`, under the same owner id as its sign-ins, and hear new asks, artist replies and merch orders (decision 0124). Hand-written Web Push (RFC 8291/8188/8292) with two dependencies total. The keys are set in production (Admin d06). `src: _push.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `subs[].endpoint` (46090) | URL | the browser's push endpoint |
| `subs[].keys` (46091) | Single-line text | p256dh and auth from the browser, used to encrypt each message |
| `subs[].at / lastOk` (46092) | Date picker | when added and when a send last succeeded; a dead endpoint is dropped |

Linked steps: 370099, 369837

### Stripe Connect status (connect_) — entity 4859

`connect_<owner>` · The owner's Express account and whether it can take cards and be paid out — a MIRROR of account.updated, so the money button and the pay path never guess. Keyed by artist id or v_<vid> for a venue. `src: _connect.mjs emptyConnect, readConnect`

| attribute | type | what it holds |
| --- | --- | --- |
| `acct` (46093) | ID | the Stripe account id (acct_…) — the payout schedule is set daily at creation (decision 0044) |
| `chargesEnabled / payoutsEnabled / detailsSubmitted` (46094) | Single checkbox | Stripe's three flags, mirrored from the webhook; the pay path refuses unless charges are enabled (b01) |
| `country` (46095) | Single-line text | the account's country, from the PAYOUT_COUNTRIES set |
| `at` (46096) | Date picker | last mirror |

Linked steps: 369817, 369879, 369992

### What the room thought (fb_) — entity 4860

`fb_<aid>` · The audience's 'enjoying MySet?' ratings: count and sum are the truth, list is the most recent notes for the artist. One per device per week, nothing stored without a star count. Only avg and count ever reach the public page (decision 0043). `src: _feedback.mjs empty, MAX_NOTES, ONE_WEEK`

| attribute | type | what it holds |
| --- | --- | --- |
| `count / sum` (46097) | Number | the running total — the average survives trimming |
| `list[].stars / note / at` (46098) | Multi-line text | the most recent MAX_NOTES ratings with their optional note; never the device id |

Linked steps: 369777, 369934, 369932

### Sign-in lockout (lock_) — entity 4861

`lock_<owner>` · Failed sign-in attempts and the lockout until-time for one account — the guesses-then-wait rule of INVARIANT 9i, enforced server-side. `src: _lib.mjs lock_`

| attribute | type | what it holds |
| --- | --- | --- |
| `fails` (46099) | Multi-line text | recent failure timestamps |
| `until` (46100) | Date picker | locked until; cleared on success |

Linked steps: 369945, 369949, 370120

### Pitches (apitch_ / vpitch_) — entity 4862

`apitch_<aid> · vpitch_<vid>` · 'Want to perform here?' — the venue's inbox is the canonical copy (vpitch_), the artist's document holds pointers so they can find their own. Only a signed-in artist can send; nobody's email is exposed. `src: _pitch.mjs emptyPitches, MAX_PITCHES, STATUS`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].id / aid / slug / name` (46101) | Single-line text | who is asking, by MySet page — never an address |
| `list[].message` (46102) | Multi-line text | the pitch, with a link to the artist's real numbers |
| `list[].status` (46103) | Single-line text | new | keen | nope — the venue's answer, shown on the artist's Gigs tab |
| `list[].at` (46104) | Date picker | sent |
| `list[].tid / vunread` | Single-line text | the conversation this pitch opened in the artist's inbox (`msg_<aid>_<tid>`), and whether the artist has answered since the venue last read it (decision 0123) |

Linked steps: 370006, 370007, 370008, 370009, 370010

### Song statistics (songstats_) — entity 4863

`songstats_<aid>` · Per-song counts across nights — plays, votes, requests — built by the warehouse walk for the Google Sheet's Songs tab; the seed of the Live Music Index. `src: _warehouse.mjs SONGSTATS`

| attribute | type | what it holds |
| --- | --- | --- |
| `bySong[].plays / votes / requests` (46105) | Number | lifetime counts per song id |
| `at` (46106) | Date picker | last walk |

Linked steps: 369938

### Community posts and likes (posts_ / likes_) — entity 4864

`posts_<owner> · likes_<owner>` · What fans said about a night on an artist's or venue's page: text, stars, which archived night, up to three photos, one clip, a link. Limits are enforced inside the compare-and-set (15k). Likes are counted per device in their own document. Hiding strips media on the way in. `src: _community.mjs empty, MAX_POSTS, MAX_TEXT, PER_DEVICE_PER_DAY, moderate`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].id / fan / name` (46107) | Single-line text | the post, the device that wrote it (never leaves the server), an optional display name |
| `list[].text / stars` (46108) | Multi-line text | up to MAX_TEXT characters and a star rating |
| `list[].show / showLabel` (46109) | Single-line text | which real archived night, picked from history — never guessed (17d) |
| `list[].photos / video / clip` (46110) | Single-line text | photo slots, an embed link, the clip id uploaded before the post |
| `list[].likes / reply / pinned / hidden / reports / rep` (46111) | Number | the owner's moderation state and the report count — a report is a count the owner sees, never a takedown |
| `recent / n` (46112) | Number | the per-device and per-network rate windows and the running count |

Linked steps: 370129, 370130, 370131, 370150, 370151, 370152

### Subscription (billing_) — entity 4865

`billing_<owner>` · Plus and Pro as Stripe subscriptions on the platform account: the Customer, the subscription, the price key, the period. The registry's plan/planUntil stay the only thing the app reads — billing writes them (Money → Plans and billing). `src: _billing.mjs emptyBilling`

| attribute | type | what it holds |
| --- | --- | --- |
| `customerId` (46113) | ID | the Stripe Customer, one per owner, so the portal and invoices attach to one person |
| `subId / priceKey / status` (46114) | Single-line text | the subscription, which tier by lookup key, and Stripe's status word |
| `currentPeriodEnd / cancelAtPeriodEnd` (46115) | Date picker | when the period ends and whether a downgrade to Free is queued for then |
| `retention / lastSyncAt` (46116) | Single-line text | the retention offer state and the last webhook sync |

Linked steps: 369887, 369891, 369893, 369895, 369897

### The books (ledger_) — entity 4866

`ledger_<owner> · ledidx_<owner> · ledger_platform` · Monthly statements bucketed from Stripe balance transactions, never recomputed (INVARIANT 5d): gross, fees, net, payouts by month for an artist or venue; ledger_platform is the COMPANY's, separated exactly from the founder's own gig money, and never deleted with an account. `src: _ledger.mjs, emptyCosts; ACCOUNTING.md`

| attribute | type | what it holds |
| --- | --- | --- |
| `months[].gross / stripeFee / net / payouts` (46117) | Number | the four numbers per month — net is already after Stripe's fee; subtracting it again is the one easy mistake (test/books.mjs) |
| `months[].closed` (46118) | Single checkbox | a finished month is closed once and never re-bucketed |
| `costs.by[]` (46119) | Multi-line text | the six hand-typed cost kinds (hosting, email, domain, software, people, other) with who typed it and when |
| `from` (46120) | Date picker | the month they joined — statements start there |

Linked steps: 369922, 369923, 369924, 369926, 369928, 369929

### Pending clip uploads (vidpend_) — entity 4867

`vidpend_<owner>` · Clips uploaded in chunks but not yet attached to a post — begin/chunk/end — swept if no post names them within PENDING_TTL. `src: _video.mjs PENDING_TTL, readPending`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].id / bytes / seconds` (46121) | Number | the clip's id, size (refused over MAX_VIDEO_BYTES, by bytes not trust) and length |
| `list[].poster` (46122) | Single-line text | the poster frame so the feed renders with preload=none |
| `list[].at` (46123) | Date picker | when begun — the sweep's clock |

Linked steps: 370136, 370137, 370138, 370145

### Sessions, activity log, recovery codes (sess_ / log_ / rec_) — entity 4868

`sess_<owner> · log_<owner> · rec_<owner>` · Where you are signed in (so one device can be signed out), what happened on the account (the activity log), and the hashed recovery codes — the three things a paid product owes an account (Artist lifecycle 02, 03). `src: _session.mjs SESS, LOG, REC`

| attribute | type | what it holds |
| --- | --- | --- |
| `sess.list[].id / device / at / lastAt` (46124) | Single-line text | each live session — a token id, a device label, when opened and last seen |
| `log.list[].what / who / at` (46125) | Multi-line text | one line per event: sign-in, role change, rename, export, delete |
| `rec.codes[]` (46126) | Single-line text | HMAC-stored recovery codes, each usable once; the 'dead' map on the registry is what every request checks, so this document is read only on recovery |

Linked steps: 369947, 369954, 369955, 369956, 369960, 369961, 369962, 369963

### Passkeys (pkeys_) — entity 4869

`pkeys_<owner>` · The owner's registered passkeys (Face ID / Touch ID / Windows Hello) and the outstanding challenge — WebAuthn verified in node:crypto, no dependency. `src: _passkey.mjs PK, empty`

| attribute | type | what it holds |
| --- | --- | --- |
| `keys[].id / pub / counter / label` (46127) | Single-line text | credential id, public key, the signature counter that detects a cloned authenticator, a label |
| `chal` (46128) | Single-line text | the challenge issued and awaiting an answer |

Linked steps: 369965, 369948

### Featured show holds (feats_) — entity 4870

`feats_<aid>` · The artist's own featured-show claims: a hold on a city's spot taken inside a compare-and-set before checkout, expiring by itself unless the payment lands; a tombstone when a hold is lost (Money → Featured shows). `src: _featured.mjs MINE, emptyMine`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].city / night / gigId` (46129) | Single-line text | which city's night, for which gig |
| `list[].status / until` (46130) | Single-line text | held | paid | lost, and when the hold expires |
| `list[].session` (46131) | ID | the Checkout session that settles it |

Linked steps: 369913, 369914, 369916, 369917, 369918

### Fan reports and the error log (bugs_ / err_) — entity 4871

`bugs_<aid> · err_<hour>` · 'Something wrong?' reports from the room, per artist, and the server's own errors in one document per hour with a computable key — kept in the blob store, not a vendor (decision 0029), read in the Studio (Reliability i06). `src: _errlog.mjs bugsKey, hourKey`

| attribute | type | what it holds |
| --- | --- | --- |
| `bugs.list[].text / page / at` (46132) | Multi-line text | what the fan said, where, when — no device id |
| `err.list[].where / msg / ctx / at` (46133) | Multi-line text | the function, the message, a little context, the time |

Linked steps: 370078, 370079, 370080, 369863, 369864

### Artist registry (artists) — entity 4872

`artists` · The one global document every authenticated request reads: artist id → page slug, name, plan, verification; slug → id; sign-in email → {artistId, role}; the normally-absent 'dead' map that revokes a session for free (INVARIANT 0ci). Also the signup's first-touch source and referral, recorded once. `src: _auth.mjs createArtist, cleanSource; _session.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `byId[aid].slug / name / createdAt` (46134) | Single-line text | the page and its owner |
| `byId[aid].plan / planUntil` (46135) | Single-line text | free | plus | pro and until when — the ONLY plan fields the app reads; billing and promo codes write them |
| `byId[aid].verified` (46136) | Single checkbox | the tick (Artist lifecycle 04) |
| `byId[aid].src / refSlug / referredBy` (46137) | Single-line text | first touch, recorded once and never edited: a short source label (never a URL) and the referring artist's slug — the marketing fact, not a browsing trail |
| `bySlug` (46138) | Multi-line text | slug → artist id; a renamed page's old names live in `oldSlug` (old name → {aid, at}) and answer for it for good — no other page can take one (decision 0106, INVARIANT 0di) |
| `byEmail[email].artistId / role / access` (46139) | Single-line text | who can sign in and as what: owner | member | crew; `access` holds only the Studio tabs the owner changed for that seat, each 0 hidden, 1 view or 2 edit, over the role's preset — normally absent (decision 0105, Artist lifecycle 02) |
| `dead` (46140) | Multi-line text | revoked session ids — checked on every request, normally absent |

Linked steps: 369946, 369952, 369953, 369959, 369894, 369976

### Venue registry (venues) — entity 4873

`venues` · A second kind of account in its own registry, deliberately — a bar never runs a show and must never reach an artist's money, setlist or history. byId, bySlug, byEmail, same shape as artists. `src: _venues.mjs emptyReg`

| attribute | type | what it holds |
| --- | --- | --- |
| `byId[vid].slug / name / city / country / createdAt` (46141) | Single-line text | the venue page |
| `byId[vid].verified / verifiedVia / verifiedAt` (46142) | Single-line text | the tick and which of the three ways earned it (Venue lifecycle 02) |
| `byId[vid].plan` (46143) | Single-line text | the venue plan |
| `bySlug / byEmail` (46144) | Multi-line text | slug → id (a renamed page's old names in `oldSlug`, old name → {vid, at}, answering for it for good since decision 0106); email → {venueId, role} with CREW_OK / MANAGER_OK |

Linked steps: 369985, 369986, 370003, 369996

### City feed index (cityindex) — entity 4874

`cityindex` · Every listed gig by city for the front door and the artist directory, rewritten whenever an artist's calendar changes — so the feed reads one document and never walks every artist (INVARIANT 0i). `src: _events.mjs CITY_INDEX, reindexCities; _featured.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `byCity[].gigs[]` (46145) | Multi-line text | expanded upcoming occurrences with artist slug, venue, time, and the featured spots for the night |
| `at` (46146) | Date picker | last rebuild |

Linked steps: 369919, 369994

### Stripe account index (acctindex) — entity 4875

`acctindex` · acct_xxx → owner id, so a webhook for a connected account can find its way home without list(). `src: _connect.mjs ACCT_INDEX`

| attribute | type | what it holds |
| --- | --- | --- |
| `byAcct` (46147) | Multi-line text | Stripe account id → artist id or v_<vid> |

Linked steps: 369879, 369878

### Feature flags (flags) — entity 4876

`flags` · A question with two real answers, both of which work — never a half-finished feature. One small global document read on the hot poll and never written during a show; every flag has a removal plan in its description. `src: _flags.mjs FLAGS, flagValue`

| attribute | type | what it holds |
| --- | --- | --- |
| `global[name]` (46148) | Single checkbox | the default for every artist |
| `byArtist[aid][name]` (46149) | Single checkbox | a per-artist override |

Linked steps: 369763

### ID review queue (idqueue) — entity 4877

`idqueue` · Verification uploads that could not be granted on the spot against Stripe's KYC, waiting for the founder's review (Artist lifecycle 04 e05–e06). `src: _verify.mjs IDQ`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].aid / legalName / dob / slot / at` (46150) | Single-line text | who, what was typed, where the image slot is, when |

Linked steps: 369973, 369974

### Promo codes (promos) — entity 4878

`promos` · Codes that comp a plan for a period — minted or revoked only by the founding account; a comped plan looks identical to a paid one to every gate. `src: _plan.mjs emptyPromos`

| attribute | type | what it holds |
| --- | --- | --- |
| `codes[code].plan / days / uses / maxUses` (46151) | Single-line text | which plan, for how long, how often it can be redeemed |

Linked steps: 369890

### Sign-in secret (authsecret) — entity 4879

`authsecret` · The HMAC key every session token is signed with — minted once with a compare-and-set, never rotated silently; a restore without it signs everyone out (tools/backup.py verify). `src: _auth.mjs authsecret`

| attribute | type | what it holds |
| --- | --- | --- |
| `k` (46152) | Single-line text | the secret; never printed, never exported |

Linked steps: 369947, 370110, 370111

### Sign-in codes (authc_) — entity 4880

`authc_<hash>` · A pending six-digit code, HMAC-stored under a hash of the address and realm, ten-minute life, five guesses, constant-time compare (INVARIANT 9i). `src: _auth.mjs codeKey`

| attribute | type | what it holds |
| --- | --- | --- |
| `h / exp / tries` (46153) | Single-line text | the hashed code, its expiry, how many guesses so far |

Linked steps: 369944, 369945

### Sheet sync cursor (sheetsync) — entity 4881

`sheetsync` · Where the warehouse walk got to last time — which shows have been appended to the Google Sheet's log tabs, so rows are written once and never rewritten. `src: _warehouse.mjs SYNC`

| attribute | type | what it holds |
| --- | --- | --- |
| `done` (46154) | Multi-line text | showIds already appended |
| `at / lastOk` (46155) | Date picker | last run and last success; sheetsOffReason when the Sheet is off |

Linked steps: 369938

### Auto-start schedule (gigsched) — entity 4882

`gigsched` · One global index of the next gig due per artist, rewritten when a calendar changes, so the cron reads one document to learn who to start or end (decision 0021; The gig 06). `src: _auto.mjs emptySched, SCHED`

| attribute | type | what it holds |
| --- | --- | --- |
| `byArtist[aid].k / at / end / skip` (46156) | Single-line text | the next occurrence key, its start and end, and a refused start remembered so it is not retried |
| `live[aid]` (46157) | Single-line text | shows the cron started and must end |
| `lastRunAt / runningSince` (46158) | Date picker | the tick's lock — a ring that finds runningSince set and fresh does nothing |
| `healedAt / healCursor` (46159) | Number | the slow walk that re-reads calendars when the index is suspect |

Linked steps: 369844, 369845, 369846, 369847, 369850, 369854

### Clip sweep queue (vidqueue) — entity 4883

`vidqueue` · Orphaned clip ids awaiting deletion from the store and R2 — every delete path hits both stores while pre-R2 clips exist. `src: _video.mjs sweepQueue`

| attribute | type | what it holds |
| --- | --- | --- |
| `list[].owner / id / at` (46160) | Single-line text | which owner's clip, queued when |

Linked steps: 370145

### Venue-owned documents (v_ prefix) — entity 4884

`v_<vid> owner documents` · A venue reuses the artist machinery under the owner id v_<vid>: ev_v_, posts_v_, likes_v_, img_v_, connect_v_, billing_v_, ledger_v_, lock_v_, sess_v_, vidpend_v_. The underscore is what tells the code it is a venue (artist ids are [a-z0-9-] only). `src: _venueaccount.mjs, _connect.mjs isVenueOwner`

| attribute | type | what it holds |
| --- | --- | --- |
| `owner` (46161) | ID | v_<vid> — the one id that keys every venue document |
| `ev_v_ / posts_v_ / likes_v_` (46162) | Multi-line text | what's on, the community page, likes — the same shapes as the artist's |
| `connect_v_ / billing_v_ / ledger_v_` (46163) | Multi-line text | the venue's Express account, its Pro subscription, its statement |

Linked steps: 369987, 369988, 369992, 369993, 369995

### Venue page (vprofile_) — entity 4885

`vprofile_<vid>` · The venue's public page: description, hours, menu (up to VMAX_MENU), offers (up to VMAX_OFFERS), website, photos — the things a bar has and an artist does not. `src: _venues.mjs VMAX_OFFERS, VMAX_MENU`

| attribute | type | what it holds |
| --- | --- | --- |
| `about / website / address / hours` (46164) | Multi-line text | the words and the opening hours |
| `menu[] / offers[]` (46165) | Multi-line text | tonight's food and the offers, capped |
| `photos` (46166) | Single-line text | slots p0…p11 on the venue plan |

Linked steps: 369987, 369989, 369994

### Artist vouches (vouch_) — entity 4886

`vouch_<vid>` · Which artists say they play here — way 2 of the three-way verification; three distinct artists with a gig listed there, with the website checks, earn the tick. `src: _verify.mjs emptyVouch, VK`

| attribute | type | what it holds |
| --- | --- | --- |
| `by[aid].at` (46167) | Date picker | each vouching artist and when |

Linked steps: 370000, 370001, 370011

## Cloudflare R2


### Clip bytes (R2 object) — entity 4887

`myset-clips/<owner>/<id>` · A community clip's bytes on Cloudflare R2, private bucket; the phone is sent there by a presigned link that /api/vid answers as a 302 (decision 0033). Pre-R2 clips stay in Blobs under vid_. `src: _r2.mjs; vid.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `key` (46168) | ID | <owner>/<id> — computable, never listed |
| `bytes` (46169) | File | the clip as filmed, 480p from the phone, under MAX_VIDEO_BYTES |
| `signed link` (46170) | URL | SigV4 presigned GET from the top of the hour, outliving the cached redirect by a margin |

Linked steps: 370140, 370142, 370143

## Stripe — what MySet reads, never re-derives


### Checkout Session (Stripe) — entity 4888

`Checkout Session` · Every payment starts as a Checkout Session created server-side with the price named by pack, never by amount; metadata carries kind, artist and the attempt id, so the three delivery paths and the books can always find it (INVARIANT 5c). `src: pay.mjs; _pay.mjs; ACCOUNTING.md`

| attribute | type | what it holds |
| --- | --- | --- |
| `id` (46171) | ID | cs_… — the replay-safe key meta_.paid is written under |
| `metadata.kind / artist / attempt` (46172) | Single-line text | votes | song_votes | request_hold | tip | merch | featured | plan; whose; the client's idempotency attempt |
| `payment_intent_data.metadata` (46173) | Single-line text | the same labels on the PaymentIntent so refunds and statements never join back through the session list |
| `application_fee_amount` (46174) | Number | MySet's fee off the top on a direct charge — never sent as 0 (Stripe treats zero differently from none) |

Linked steps: 369819, 369820, 369821, 369822, 369826

### Connected account (Stripe Express) — entity 4889

`Express account` · The artist's or venue's own Stripe account — the merchant of record for every charge (direct charges, decision 0007). Created with a daily payout schedule (decision 0044). Mirrored into connect_ by account.updated. `src: _connect.mjs; STRIPE-CONNECT.md`

| attribute | type | what it holds |
| --- | --- | --- |
| `id` (46175) | ID | acct_… — indexed in acctindex |
| `charges_enabled / payouts_enabled / details_submitted` (46176) | Single checkbox | the three flags the money button and the pay path read |
| `settings.payouts.schedule.interval` (46177) | Single-line text | daily — on purpose; the near-instant reward loop |
| `country` (46178) | Single-line text | from PAYOUT_COUNTRIES |

Linked steps: 369992, 369879, 370098

### Subscription (Stripe Billing) — entity 4890

`Subscription` · Plus or Pro on the platform account: one Product per tier found by lookup key and created on first use, one Customer per owner, upgrades prorated, a downgrade to Free at period end. The webhook keeps the registry's plan honest. `src: _billing.mjs; webhook.mjs`

| attribute | type | what it holds |
| --- | --- | --- |
| `id / customer` (46179) | ID | sub_… and cus_…, both remembered in billing_ |
| `items[].price.lookup_key` (46180) | Single-line text | which tier |
| `status / current_period_end / cancel_at_period_end` (46181) | Single-line text | Stripe's word, mirrored on every webhook |
| `metadata.owner` (46182) | Single-line text | the owner id, so a webhook can find its way home |

Linked steps: 369891, 369893, 369895, 369897
