# MySet landing page — feature inventory & rebuild plan

**Built from:** a 7-agent sweep of the whole codebase (279 features catalogued: 230 SHIPPED, 21 GATED, 11 FLAG-ONLY, 17 NOT BUILT), cross-checked against `public/about.html` and resolved against the code wherever sweepers disagreed.
**Companion doc:** `MYSET-LANDING-PAGE-REVIEW-OF-ANALYSIS.md` (the Atlas review).
**Date:** 2026-09-01.

---

## The finding that should drive the rewrite

The current page sells **one mechanic** — the room votes — plus a money beat that does not work for anyone but Perry.

The code contains a **second, arguably stronger product the page has never once mentioned**:

> **MySet is the thing on your music stand.**
> Setlists per gig. Chord charts and keys. A to-learn list. Auto-tagged genres. Replay pricing. Pause. Undo. A calendar where a residency is one entry forever.

All of it shipped, all of it reachable today by a brand-new free account, none of it on the page. Meanwhile beat 4 ("Money happens without you asking") is the page's biggest integrity risk and is false for every artist except one.

**The swap:** beat 4 shrinks to an honest footnote; a "your set, your charts, your calendar" beat takes its place.

---

# Part 1 — Shipped features the page never mentions

Deduped (the raw sweep double-counts ~25 rows seen from both artist and audience sides). Ranked within each group.

## 1A. Setlists — the biggest omission ★★★

| Feature | What the artist can do | Evidence |
|---|---|---|
| **Named setlists** | Build up to **20** named sets ("Beach set", "Late set") out of one library | `_lists.mjs:29` `MAX_LISTS=20`, `admin.mjs:417-430` |
| **Activate one for tonight** | Tap **Use** → the whole room instantly sees only those songs; "All songs" reverts | `_lists.mjs:96-116`, `admin.mjs:502-505` |
| **Per-gig setlist, auto-loading** | Attach a set to a calendar gig; *Start the show* within **6 hours** of it switches automatically | `admin.mjs:838-850`, `studio.html:929-938` |
| Always-visible banner | "Beach set · 8 of your 40 songs are in play" | `studio.html:438-454` |
| Empty-set safety net | If a set resolves to nothing votable, the room silently gets the full library; artist sees a red strip | `_lib.mjs:570-580`, `stage.mjs:41` |
| Searchable song picker | Tick songs in/out of a set, save membership at once | `studio.html:515-553` |
| Deleted-set warning | A gig pointing at a deleted set leaves your pick alone and says why | `admin.mjs:844-848` |

## 1B. The music stand ★★★

| Feature | What the artist can do | Evidence |
|---|---|---|
| **Chord charts** | Paste up to **20,000 characters** of chords, capo notes and lyrics per song, fixed-width, private | `_chart.mjs:14` `MAX_CHART=20000`, `admin.mjs:323-330` |
| **Read your chart mid-song** | "☰ My chart" on the now-playing card opens it big on stage | `studio.html:1079`, `studio.html:1919` |
| **Song key** | Root chip (A–G, sharps/flats) + Major/Minor, or free text ("Capo 2", "Drop D"); private | `admin.mjs` `cleanKey` |
| **"Want to learn" list** | Up to **120** songs you don't play yet, with a note; unvotable; "Learned it" promotes them | `_lists.mjs:31` `MAX_LEARN=120`, `admin.mjs:495` |
| **2,000-song library on every plan** | Free included — the plan only caps how many are *live* at once (50) | `_plan.mjs:46` `MAX_LIBRARY=2000` |

## 1C. Genres ★★

| Feature | What it does | Evidence |
|---|---|---|
| **15 built-in genres** | Originals, Rock, Pop, Acoustic, Country, Folk, Indie, R&B/Soul, Blues, Reggae, Funk/Disco, Hip-hop, Jazz, Latin, Sing-along | `_lib.mjs:183-199` |
| **Auto-tag the whole library** | One tap fills genres for every untagged song; anything credited to you is tagged **Originals** automatically | `admin.mjs:340` `tagAuto`, `studio.html:670` |
| Up to 6 genres per song, 15 custom labels of your own | Invent your own alongside the built-ins; deleting cleans itself off every song | `admin.mjs:366-397` |
| **Genre filter for the room** | Audience taps a chip to narrow the voting list; only genres actually present are shown | audience voting page |
| Genre filter in your own Setlist tab | Same, with counts | `studio.html` |

## 1D. Running the night ★★

- **Replay pricing** — played songs stay votable at a higher price you set (default 5 votes; 2/3/5/8/10 or custom)
- **Pause voting** — one Open/Paused toggle in the header freezes everything; the room sees "Voting paused"
- **Resume vs. new show** — after ending, two explicit buttons: fresh night, or resume the one you just ended
- **Undo a played song** — puts it back in the pool at normal price
- **Start any song out of order** — ▶ next to any row; votes still refresh
- **Unlimited-votes mode** — whole room, no credits, no purchase prompts, for a night
- **Round-by-round vote log** — top 8 and their counts recorded at every song start, before the board wipes
- **Double-start protection** — on bad wifi, a lost response + second tap can't burn two songs (8s window)
- **"Tonight so far"** — running numbers before you end
- **See what the audience sees** — one tap opens your live page as the room has it

## 1E. Audience side ★★

- **Search** by song or artist · **sort** Top voted / Song A–Z / Artist A–Z (remembered per phone) · **genre chips**
- **Play it again** — vote for something already played tonight, at the replay price, shown as a pill
- **Payment that cannot get lost** — if the phone dies, the tab closes, or wifi drops on the way back from Stripe, the purchase is still redeemable *(this exists because it failed once, on 2026-08-30)*
- **Optimistic feedback with haptics** — count moves and the button flips before the network answers
- **Live-now pill + Join live** on an artist's public page

## 1F. Public page, calendar, account ★★

- **Live-now banner** while on stage; **live countdown** to the next gig when not ("Live in 2d 4h 11m")
- **Cancel one night of a residency** without touching the run — stays visible, marked cancelled, restorable
- **Venues you've asked, and what they said** — Waiting / They're keen / Not this time
- **Editable address** `myset.vip/yourname` — re-choosable, clash-checked, reserved words refused
- **Referral link with attribution** — `myset.vip/signup?ref=<slug>`, permanently recorded, pays the referrer a free month
- Crop-and-zoom your photo in the real frame before upload · 700-char bio · every pasted media link verified via oEmbed before it goes live · paste a Google/Apple/OSM maps link · Tonight card with directions
- **Month-long sessions**, multiple devices at once, sign-out-all
- **Venue side:** 22 amenities (House PA/backline, step-free, sea view…), staff logins up to 5, artist vouching, and **money is never in the venue's analytics** — a venue sees its room, never an artist's earnings
- **Installable PWA** with a separate icon per surface (artist / venue / fan)

---

# Part 2 — What the page currently says that is not true

**Nothing below is a style note. Each one is a factual claim the code contradicts.**

### P0 — must change before any traffic

1. **The four proof numbers** (34 / 314 / 12 / 100%) under *"actual numbers… that you didn't type in yourself."* One gig ever: 8 voters, 21 votes. The page's own FAQ says so. `numbers.png` is a deleted throwaway account (`HANDOFF-MySet.md:938-940`).
2. **Four of six Pro bullets are FLAG-ONLY** — earnings by venue/night/song, press kit, branding, multi-city. Only readers in the whole tree are `admin.mjs:137` and a display string. *(Band logins **are** real — `auth.mjs:98-105`.)*
3. **The 10% cut does not exist**, so Free's only stated cost is fictional and Plus's headline benefit ("No cut") is worth $0. `MYSET.md:760`.
4. **No billing exists** — Plus and Pro are presented at $10 and $20/mo with no way to buy either.
5. **"Switched on artist by artist… ask and you'll be next in the queue"** — there is no switch and no queue. `_pay.mjs:26-27` is `aid === 'perry-idyll'`, and INVARIANT 0r forbids changing it before Connect. Beat 4 in full is false for everyone else.
6. **`qr.png` is the Settings tab, not a QR code.** **`feed.jpg` is an empty search form, not a Koh Phangan feed.** Both alts describe images that don't exist.
7. **"Tip Perry" is hardcoded for every artist** (`vote.html:518,534,536`), and **every artist's voting page is titled "Perry Idyll"** (`vote.html:22`, `document.title` never assigned). Fix before promising "a page with your name at the top."

### P1 — inaccurate, lower blast radius

8. **"Any song can be switched off — permanently, or just for tonight"** — there is no per-song "just for tonight". Hiding is always permanent. The per-night mechanism is a **setlist**, which the page never mentions. *This is the single clearest case where the fix and the new feature are the same edit.*
9. **"Show history and your real numbers" / "what they paid"** — the money column is permanently $0.00 for everyone but the owner.
10. **Venue QR:** the Studio offers *two* codes and the printed caption is "Connect with our performers", not "tonight's music, your menu and your offers".
11. **"Say keen or pass"** implies a loop; Keen is a dead end (`MYSET.md`: "no thread, no calendar hold").
12. **"A weekly residency appears for the whole run"** is literally true but is the known cosmetic roll-up problem, not a benefit.
13. **"They don't install anything" / "No app"** — true and good for the *audience*, but the artist and venue surfaces **are** installable apps, which the page never says.

### Not on the page — keep it that way
Big-screen/stage display doesn't exist (`stage.html` is a 9-line redirect). Studio passcode is broken for non-owners (`admin.mjs:1060-1065` writes per-artist; `_lib.mjs:745-750` only ever checks the owner's) — a second artist can set one, get a success toast, and never sign in with it. No data export, no account deletion.

---

# Part 3 — Proposed page structure

Keeping the voice, the demo, the no-install promise, and the scene — all of which are the page's real assets.

| # | Section | Change |
|---|---|---|
| 1 | Nav | Add "How it works" anchor. Demote "For venues" |
| 2 | Hero | Add eyebrow naming the reader. Add the artist-control line — it is currently at 96% page depth inside a collapsed `<details>` |
| 3 | Scene ("Forty people, forty screens") | **Keep as is.** Best prose on the site. Don't cut it |
| 4 | Live demo | **Keep.** Add: song-specific button labels, `aria-live`, a `.vb:disabled` style, `scroll-margin-top`, and a CTA underneath |
| 5 | Beat 1 — They scan, they're in | Keep. **Replace `qr.png` with an actual QR screenshot** |
| 6 | Beat 2 — You stop guessing | Keep |
| 7 | **NEW Beat 3 — Your set, your charts, your calendar** | **The whole of Part 1A/1B/1C.** This is the new heart of the page |
| 8 | Beat 4 — Requests, properly | Keep; add the fan-side status feed |
| 9 | ~~Beat 5 — Money~~ | **Demote to an honest one-paragraph footnote** |
| 10 | Beat 6 — Afterwards they can find you | Keep; add live-now/countdown |
| 11 | Ease / Excitement / Freedom | Keep the frame; "Freedom" now has real evidence behind it |
| 12 | Proof block | **Rebuild around 8 people / 21 votes / one night, told honestly** |
| 13 | Venue section | Trim to a bridge + link. It is 23% of the mobile page |
| 14 | Pricing | Rebuild honestly. Free = 2,000-song library, 50 live. Plus = unlimited live. Pro = band seats. Mark the four unshipped bullets. Replace fake CTAs with an ask-for-a-code path (`redeemPromo` works today) |
| 15 | Honest note | Rewrite: no "queue", plus the missing billing disclosure |
| 16 | FAQ | Add: do I have to play the winner · what data you collect · are payments available to me · what's a setlist |
| 17 | Close | One artist CTA; venue as a text link |
| 18 | Footer | Privacy, terms, contact. Install button |

---

# Part 4 — Segmented work packets

Ordered so nothing depends on something later. Each is independently shippable and independently verifiable.

**Packet 1 — Integrity (do first, alone).**
P0 items 1–5 and 7. Copy and pricing only, no new sections. Outcome: nothing on the page is false.

**Packet 2 — The two wrong screenshots.**
Re-shoot `qr.png` (a real printable QR) and `feed.jpg` (a populated city feed). Fix both alts. Needs Perry at a device with real data.

**Packet 3 — The new setlist/charts/genres beat.**
Write and build section 7. The largest single piece of new copy. Fixes P1 item 8 as a side effect.

**Packet 4 — Pricing rebuild.**
Section 14 + the honest note. Decide what Plus is actually *for* first — with a 2,000-song library on Free and no cut, the only real Plus benefit today is unlimited *featured* songs above 50.

**Packet 5 — Proof rebuild.**
Section 12, around the true numbers. Ideally with a photo or clip from the next real gig.

**Packet 6 — Demo + accessibility.**
Song-specific labels, `aria-live`, focus preservation across the `innerHTML` rebuild, `.vb:disabled`, 44px targets, `scroll-margin-top` on `#try`, `@media print`, static stat fallback, move `.anim` removal into its own leading `<script>`.

**Packet 7 — Venue split.**
Trim section 13 to a bridge; give venues their own page with the material from Part 1F.

**Packet 8 — Plumbing.**
Privacy/terms/contact, canonical, landscape `og:image`, real `robots.txt` and `sitemap.xml` outside the catch-all, point the referral `invite` link at `/about?ref=`, add `/about` to the Studio and Venue Studio navs.

**Suggested first prompt:** Packets 1 + 2 together — they are the honesty pass, and everything else reads better once the page is true.

---

## Already done this session
`/about` linked from the homepage footer and both empty-state CTA blocks; a persistent "Add to home screen" button added to the homepage footer (the install sheet already existed but was dismissible-forever). Verified at 320/390/1280 in both themes. Branch `fixes/audit-2026-09-01` — **not deployed**; Netlify builds `main`.
