# MySet — Project Handoff

> **Purpose:** Seamless-pickup handover so a fresh Claude account (or a new collaborator) can continue the **MySet** project with zero context loss.
> **Prepared:** 2026-08-12 · verified against on-disk state at `~/Docs/MySet/`
> **One-liner:** MySet is a web app where a live audience votes — in real time, from the floor — on which songs a musician plays next, plus a full artist promo/community/revenue hub.

---

## Table of Contents

1. [Overview & Concept](#1-overview--concept)
2. [Current Build (tech + structure)](#2-current-build)
3. [Feature Inventory](#3-feature-inventory)
4. [How to Run / Preview](#4-how-to-run--preview)
5. [Design / UX Notes](#5-design--ux-notes)
6. [Next Steps / TODOs / Ideas](#6-next-steps--todos--ideas)
7. [File-Path Index](#7-file-path-index)
8. [Discrepancies (disk vs. memory)](#8-discrepancies-disk-vs-memory)

---

## 1. Overview & Concept

**MySet** is a two-sided live-music product:

- **Audience side (Fan):** During a live show, the crowd votes — from their phones, in real time — on *which song the artist plays next* and *in what order*. Votes reorder a ranked queue live. It's gamified: vote credits/coins, timed voting windows between songs, a crowned leader, "every Nth song is a crowd pick," and a guaranteed-encore mode. Fans can also spend to **boost** a song up the queue, **tip the band**, drop **emoji reactions** and **comments** on songs, and **rate** each song after it's played.
- **Artist side (Artist):** A promo + operations hub. An **Artist Studio** to manage the setlist pool and configure voting rules + see insights, plus a rich **artist profile** (streaming/social links, music-purchase links, merch, tour dates + ticketing, community feed, shareable EPK with booking requests). The pitch: *"turn every set into a two-way night."*

**Two-sided value:**
- Fans get agency, connection, and a memorable participatory show.
- Artists get engagement data, in-the-moment revenue (boosts/tips/merch), a fanbase hub, and set intelligence — all in one place.

**Vision / positioning:** Minimal, premium, Apple-esque consumer product; brand feel is "Skool × Instagram × Airbnb." Tagline: **"the crowd builds your set."** Hero headline: **"Where the crowd decides what plays next."**

**Name history:**
- Originally named **"Encore"** (started 2026-07-22).
- Renamed to **"MySet"** on **2026-07-22** (same day). The name "Encore" survives only as a *feature* name — **"Encore mode"** = the guaranteed-encore rule — which is intentionally kept because it's a natural music term.
- **Note:** the localStorage state key and internal code comments still literally say `encore.*` (see §2). This is intentional/harmless legacy naming, not a bug.

**Project relocation:** MySet was explicitly **moved out of the iOhm folder** to become its **own top-level project**, mirrored on Mac + SSD (mirror convention shared with the user's other projects). Do **not** file it back under iOhm.

---

## 2. Current Build

**Type:** Single-file, self-contained front-end **prototype**. No build step, no dependencies, no framework. Vanilla HTML + CSS + JavaScript in one `index.html`. PWA-ready (Apple/mobile web-app meta tags, inline SVG favicon + apple-touch-icon, safe-area insets). Deployable to any static host; easy to later wrap as a native app.

**Primary file:** `~/Docs/MySet/index.html` — ~81 KB, ~1,345 lines.

**Tech details (verified in code):**
- **Rendering:** A tiny hand-rolled SPA. Global mutable state object `S`; a single `render()` function acts as the router — it reads `S.role` (`fan`/`artist`) and `S.route` and swaps `#root.innerHTML` from string-template view functions (`viewHome`, `viewLive`, `viewProfile`, `viewFeed`, `viewDash`). Navigation via `go(route, artistId)`, `setRole(r)`.
- **State persistence:** All live-show state persists to `localStorage` under key **`encore.state.v3`** (constant `KEY` at top of script; bumped from v2 → v3). `loadState()` seeds a default state object on first run; `saveState()`/`persist()` write it back.
- **Cross-tab sync:** A `window.addEventListener('storage', …)` listener re-loads state and re-renders whenever another tab writes the key. **Open two tabs** to demo crowd ↔ stage live voting sync.
- **Mock data:** `SEED` object holds 5 artists, 8 songs (each with `type`/`vibe`/`year` for filtering), and a 2-post feed. Images are remote Unsplash URLs in the `IMG` map (so an internet connection is needed for imagery).
- **UI primitives:** `toast()`, `openSheet()`/`closeSheet()` (bottom-sheet modal), `confetti()`.
- **Single design system** in one `<style>` block (CSS custom properties for theming; see §5).

**Structure inside `index.html` (rough map):**
- Lines ~16–498: `<style>` — full design system (tokens, components, venue dark scope, dark theme, responsive/phone tuning).
- Lines ~506–620: state + mock data (`IMG`, `SEED`, `KEY`, `loadState`, cross-tab listener, `toast`/`sheet`/`confetti`).
- Lines ~622–677: router `render()`, `topbar()`, `botnav()`.
- Lines ~679–739: Fan Discover/Home (`viewHome`, `artistCard`).
- Lines ~741–1079: **Live show** (the core) — `viewLive`, `voteCard`, `creditStrip`, `playedRow`, `react`, `castVote`, `showBoost`/`applyBoost`, `showTip`/`sendTip`, `showComments`/`addComment`, `simulateVotes`, `lockWinner`, `bindWindowTimer`, plus filter helpers. **Also contains dead code:** `camPlayer`, `CAMS`, `setCam`, `toggleStream`, `setStreamUrl` (multi-cam + livestream — defined but no longer called; see §8).
- Lines ~1081–1219: Artist profile (`viewProfile`, `profilePanel`, `postCard`, `openBooking`).
- Lines ~1221–1238: Community feed (`viewFeed`).
- Lines ~1240–1338: Artist Studio (`viewDash`, `dashPanel`, `ruleCard`, `toggleReady`, `openUpload`).
- Line ~1341: `render()` boot call.

**Version control:**
- Git repo lives in the **Mac copy only** (`~/Docs/MySet/.git`). Working tree currently **clean**, on branch `main`, up to date with `origin/main`.
- **GitHub:** private repo `github.com/perryidyll/myset` (remote `origin`). Authed as `perryidyll`.
- `gh` CLI path (per memory): `~/.local/tools/gh_2.93.0_macOS_arm64/bin/gh`.
- Commit identity is set **repo-local** to perryidyll (global git identity is `wellmee26` — override per-repo when committing here).
- **Commit history (most recent first):**
  - `4b369bf` — Live page redesign (Concept B): pool-first, Now-Playing hero, no video *(current HEAD / origin/main)*
  - `f2aa385` — Snapshot: cache live-page design v1 before redesign
  - `c6b34d9` — Hero: add breathing room between tag and headline
  - `2406035` — Optimize mobile: fix topbar overflow, declutter vote cards, PWA polish
  - `3ed3030` — Initial commit — MySet prototype

**Repo also contains:** `README.md`, `.gitignore`, `netlify.toml` (static, `publish="."`, no build), `backups/`, and `wireframes.html` (gitignored).

---

## 3. Feature Inventory

Every feature currently built (verified in `index.html`):

### Fan side

**Discover / Home (`viewHome`)**
- Gradient hero with the "Where the crowd decides what plays next" headline + two CTAs ("Join a live show", "Explore an artist").
- "Live right now" horizontal-scroll rail of artist cards (live artists first).
- "Rising near you" 3-up grid of artist cards.
- "For artists" promo band → opens Artist Studio.

**Live show / voting (`viewLive`) — the core experience**
- **Now-Playing hero card** (`.np-hero`): big gradient card with cover art, title, duration, animated progress bar, pulsing "Now playing" label, and an animated equalizer. This is the redesigned (Concept B, 2026-08-06) top-of-page.
- **Credit / window strip** (`creditStrip`): "Your votes" meter showing **N/10 left** as a fraction + meter; plus a **voting-window countdown ring** (conic-gradient timer, "closes soon — vote now") when vote windows are enabled.
- **Vote pool** (`voteCard` list) — the main body ("Up next — you decide"): each song row shows rank (👑 for the leader, else `#n`), art, title, meta, live vote count, and an animated **fill bar** proportional to votes. Rows reorder by vote count. A **▲ vote button** casts/undoes a vote; disabled when out of credits or window closed.
- **Per-song ⚡ Boost** button (desktop pill on the card; on mobile it moves into the reactions row).
- **Per-song emoji reactions** (`react`): 🔥 / 😍 / 💜 with live counts; one active reaction per song (toggle/switch logic).
- **Per-song comments** (`showComments`/`addComment`): opens a bottom sheet with the comment list + an input to post; comment counts shown on each card.
- **Big "power actions"** below the pool: **⚡ Boost a song** (`showBoost` → tiered pricing sheet, "skip the line / extra votes / spotlight on the big screen") and **💸 Tip the band** (`showTip` → preset + custom amount + message; running "$X so far" total). Both fire confetti; **demo only, no payment taken.**
- **"Played tonight"** list (`playedRow`): songs already played, each with a **1–3 tier thumbs rating** — 👍🏼 (1) / 🙌🏼🙌🏼 (2) / 🤘🏼🤘🏼🤘🏼 (3).
- **Filter chips** (`filterChips`/`matchFilter`) on the pool: All / Originals / Covers / vibe tags (Upbeat, Anthemic, Chill, Acoustic) / decades (2020s, 2010s).
- **Vote-window countdown timer** (`bindWindowTimer`): live per-second countdown; closes the window at 0.
- **Artist-side controls** (when viewed as Artist): "↺ Simulate crowd" (`simulateVotes` — adds random votes to demo movement) and "Lock winner →" (`lockWinner` — moves current song to "played", promotes the top-voted song to Now Playing, reseeds counts, fires confetti).

**Community feed (`viewFeed`)**
- Composer box, artist posts (`postCard` with like/comment/share), and a **🏆 Superfan leaderboard** card with streak/achievement chips ("4-show streak", "Called the encore", "Top booster").

**Artist profile (`viewProfile`)**
- Cover image with a live "Live now — vote the setlist" pill (when live) and a Follow button.
- **XL 172px avatar** with a **3-thumbnail overlapping cluster**; big name + verified check below (Instagram-style).
- Stats row (Fans / Shows / Set rating 4.9★) with a big red **Join live** button (or "Get alerts" when offline).
- Bio, then **tabbed panels** (`profilePanel`):
  - **Links** — split into *Listen & follow* (Spotify/Apple/YouTube/Instagram/TikTok), *Buy the music* (Bandcamp, iTunes Store, Amazon Music), *Stay in the loop* (mailing list).
  - **Music** — filterable ready-song list with preview buttons.
  - **Merch** — product grid with add-to-cart.
  - **Tour** — dated tour rows with ticket / "Vote live" CTAs.
  - **Community** — "Inner Circle" members-only join card ($5/mo) + feed posts.
  - **EPK** — electronic press kit: stat tiles, press-kit/stage-plot download buttons, and a **booking request** sheet (`openBooking`).

### Artist side

**Artist Studio / dashboard (`viewDash`)**
- Greeting header + "View public profile" / "◉ Go live" actions.
- KPI stat tiles (Fans, Votes cast 30d, Boost + merch revenue).
- Segmented tabs (`dashPanel`):
  - **Setlist pool** — filterable song list with per-song **toggle** to include/hide from tonight's vote pool (`toggleReady`); "＋ Add song" upload sheet (`openUpload`).
  - **Voting rules** — toggle cards (`ruleCard`): **Vote windows** (5/10/15/20s), **Crowd-pick cadence** (every 2nd/3rd/5th), **Showtime only**, **Encore mode**; plus a "More ways to gamify" ideas card.
  - **Insights** — "Most requested," "Where your crowd is," and a "Set intelligence" narrative card.

### Cross-cutting

- **Fan/Artist role toggle** in the top bar (`setRole`).
- **Light ⇄ dark theme toggle** (🌙/☀️ button; `S.theme`, `body.theme-dark`). The live "venue" screen stays dark regardless.
- **Cross-tab live sync** via the `storage` event (see §2).
- **Bottom nav** (mobile) that swaps per role; **top bar** with brand, search (fan only), theme + role toggle, avatar.
- **Toasts, bottom-sheet modals, confetti** throughout.

### Present-but-dormant (dead code)

- **Multi-cam placeholder player** (`camPlayer`, `CAMS`, `setCam`) and **YouTube/Twitch livestream embed** (`toggleStream`, `setStreamUrl`, `stream-wrap` CSS). These were **removed from the live page in the Concept B redesign (2026-08-06)** for MVP focus. The functions/CSS remain in the file but are **no longer called** — harmless, but note if cleaning up. State still carries `streamUrl`/`showStream`/`cam`. (The README still lists these as highlights — stale; see §8.)

---

## 4. How to Run / Preview

It's a single static file — open it directly or serve the folder.

**Locations (Mac ↔ SSD mirror):**
- **Mac (source of truth + git):** `/Users/perryidyll/Docs/MySet/index.html`
- **SSD (working-files mirror, no `.git`):** `/Volumes/IDYLL SSD 1/Docs/MySet/index.html`
  - ✅ **Verified in sync 2026-08-12** (SSD remounted): `index.html` = 81,070 bytes, dated Aug 6 11:06, matching the Mac copy; `backups/`, `README.md`, `netlify.toml`, `wireframes.html`, `.gitignore` all present. Keep both copies in sync per the user's mirror convention after future edits.

**Serve locally (from memory / README):**
```bash
python3 -m http.server 8940 -d "/Users/perryidyll/Docs/MySet"
# then open http://localhost:8940
```
- README example uses port **8940**; memory notes it "was last served on :8940" (earlier sessions used :8940/older :8940-ish). Any port is fine. No `launch.json` is wired — start the server manually.
- **To demo cross-tab sync:** open the URL in **two browser tabs** (or one Fan + one Artist), go to the Live page in both, and cast votes / lock winner in one to watch the other update live.

**Deploy:**
- Single static `index.html` — any static host works.
- **Netlify:** drag-drop the folder (or just `index.html`) onto https://app.netlify.com/drop, **or** connect the `perryidyll/myset` repo. No build command; publish dir `/` (see `netlify.toml`).
- **Currently NOT deployed anywhere** (no live URL). Do **not** push MySet to iohm.io — that CLI/site is a separate project.

---

## 5. Design / UX Notes

**Aesthetic:** Apple-esque, minimal, premium; "Skool × Instagram × Airbnb." Light throughout **except** the live "venue" screen, which is dark.

**Brand:**
- Wordmark **"MySet"** + a white **equalizer-bars** logo mark (3 rounded vertical bars of varying height) inside an indigo-violet gradient rounded square. Matching inline-SVG favicon + apple-touch-icon. Brand shows a small "beta" tag in the top bar.
- Tagline: **"the crowd builds your set."**

**Color tokens (CSS custom properties in `:root`):**
- Accent `#5b4be1` (signature indigo-violet); accent-2 `#8b5cf6`.
- Primary gradient `--grad`: `linear-gradient(120deg,#6d5ef6 0%,#a855f7 45%,#ff5fa2 100%)`.
- Live/red `#ff3b5c`, amber `#ff9f0a`, good/green `#2fbf71`.
- Radii 14/22/30px; layered soft shadows; system font stack (SF Pro / -apple-system).

**The "venue" live screen (dark mode):**
- Scoped via `.venue` + `body.venue-scope` — overrides the CSS vars to a dark palette. **Gotcha (from memory, still relevant):** `--bg-elev` MUST be overridden inside `.venue` or vote rows render white; `body.venue-scope` bg must be dark to avoid a white scroll gap.
- Background is **abstract neon ambience** — layered radial gradients (indigo/pink/violet/cyan) with `background-attachment:fixed` — not pure black.

**Theming:**
- `body.theme-dark` provides a full fan-side dark theme (separate from the always-dark venue).

**Rating tiers:** 👍🏼 (1) / 🙌🏼🙌🏼 (2) / 🤘🏼🤘🏼🤘🏼 (3).

**Responsive:** mobile-first; bottom nav on phones, hidden ≥821px; extensive `@media(max-width:560px)` phone tuning (top-bar de-crowding, vote-card compaction, boost moved into reactions row, safe-area insets for notched phones).

**Personas / demo content:** Seed artist **Nova Vega** (Austin indie/dream-pop, "live now") is the default profile/live subject; supporting artists The Echo Method, Juna Sol, Moss & Marrow, PAPER KITE. Fan identity is "YOU." 8 seed songs (Golden Hour, Paper Moon, Static & Signal, Ceremony, Undertow, Bloom (acoustic), Cassette Dreams, Vega).

**Live-page design history:** On **2026-08-06** the user chose **Concept B — "Now-Playing hero + up-next pool" (pool-first)** from 3 wireframes (in `wireframes.html`). The prior "v1" live design is snapshotted at `backups/index_live-v1_2026-08-06_c6b34d9.html` (git commit `c6b34d9`) — restore by copying it over `index.html`.

---

## 6. Next Steps / TODOs / Ideas

**Status:** Front-end prototype only — **mock data, no backend, no auth, no real payments, no real audio.**

**Productization / backend (the big lift to make it real):**
- Real-time backend for live voting (WebSocket / Firebase / Supabase realtime) to replace the localStorage cross-tab hack — so an actual crowd on separate devices syncs.
- Auth + accounts (fan + artist roles).
- Payments for boosts / tips / merch / tickets / memberships (Stripe or similar) — currently all "demo only, no payment taken."
- Real audio / streaming track integration for the setlist pool and previews.
- Real artist onboarding: song upload, profile setup, go-live flow.
- Ticketing + tour-date integration; EPK generation/sharing; booking-request routing.

**In-app gamification ideas already noted (Studio "More ways to gamify" card):**
- Vote credits tiering — free fans get a few per night, members get more.
- Paid boosts & dedications that revenue-share with the artist.
- Genre / era / tempo "battles" (e.g. "acoustic vs. electric").
- Surprise "wildcard" slot the crowd can't see coming.

**Housekeeping / cleanup:**
- **Remove dead multi-cam + livestream code** (`camPlayer`, `CAMS`, `setCam`, `toggleStream`, `setStreamUrl` + their CSS + state keys `cam`/`streamUrl`/`showStream`) if the video features are staying out of MVP — currently unused but present.
- **Update `README.md`** — its "Highlights" still advertise the multi-cam + livestream features that were cut in Concept B (stale).
- **SSD mirror verified in sync (2026-08-12)** — no action needed; just keep it synced after future edits.
- Consider renaming the internal `encore.*` state key / comments to `myset.*` for clarity (optional — a rename would orphan existing localStorage; bump the version key if so).

**Deploy when ready:** connect `perryidyll/myset` to Netlify (or drag-drop) — zero-config static deploy. Not yet live anywhere.

---

## 7. File-Path Index

| Item | Absolute path |
|---|---|
| **Project root (Mac, source of truth)** | `/Users/perryidyll/Docs/MySet/` |
| **Main prototype** | `/Users/perryidyll/Docs/MySet/index.html` |
| Live-page v1 backup (pre-Concept-B) | `/Users/perryidyll/Docs/MySet/backups/index_live-v1_2026-08-06_c6b34d9.html` |
| Live-redesign wireframes (gitignored) | `/Users/perryidyll/Docs/MySet/wireframes.html` |
| README | `/Users/perryidyll/Docs/MySet/README.md` |
| Netlify config | `/Users/perryidyll/Docs/MySet/netlify.toml` |
| .gitignore | `/Users/perryidyll/Docs/MySet/.gitignore` |
| Git repo | `/Users/perryidyll/Docs/MySet/.git` (branch `main`, clean, = origin/main) |
| **SSD mirror (working files, no git)** | `/Volumes/IDYLL SSD 1/Docs/MySet/index.html` ✅ *verified in sync 2026-08-12* |
| GitHub remote | `https://github.com/perryidyll/myset` (private, origin) |
| `gh` CLI (per memory) | `/Users/perryidyll/.local/tools/gh_2.93.0_macOS_arm64/bin/gh` |
| Project memory file | `/Users/perryidyll/.claude/projects/-Users-perryidyll-Docs-iOhm--Self-Singing-Bowl-Product-Design-Renderings/memory/project_myset_app.md` |
| localStorage key | `encore.state.v3` (legacy `encore.*` naming, intentional) |

---

## 8. Discrepancies (disk vs. memory)

1. **SSD mirror — RESOLVED.** The SSD ("IDYLL SSD 1") was remounted 2026-08-12 and the MySet mirror was **verified in sync** (`index.html` 81,070 bytes, Aug 6 11:06, matching the Mac copy; all sibling files present). No action needed beyond keeping them synced after future edits.

2. **README is stale on multi-cam + livestream.** `README.md` still lists "Multi-cam + livestream" as a headline feature and describes the in-app multi-camera player + embedded YouTube/Twitch stream. Per the memory note and confirmed in code, these were **removed from the live page in the Concept B redesign (2026-08-06)** — the functions/CSS remain as dead code but aren't rendered. Memory is correct; README needs updating.

3. **Port note.** README's run example uses `:8940`; memory says it "was last served on :8940." Consistent. No `launch.json` is wired; server is started manually. (No real discrepancy — just confirming any port works.)

4. **Naming:** Product is "MySet" everywhere user-facing, but the code's design-system comments still say "ENCORE" and the state key is `encore.state.v3`. This is the intentional legacy naming the memory flags — not a bug.

Everything else in the memory file matches the on-disk code (feature set, state shape, credits=10, rating tiers, filter categories, Concept-B live layout, git history, brand/aesthetic).

---

# 2026-08-17 — LIVE PRODUCT (MVP 2.1). Read this section first.

MySet stopped being a prototype today. It is **live at https://myset.vip**, taking
real money, and was built for Perry's gig at The Ugly Duckling Irish Pub,
Koh Phangan, 8:00 PM.

**Read `INVARIANTS.md` at the project root before changing anything.** It documents
storage traps that cost hours to find and will silently lose votes if reintroduced.

## Shape

| | |
|---|---|
| Host | Netlify project **mysetvip** (`8f5c9f01-e1f1-47e3-add1-8dde39efd1d3`), repo `perryidyll/myset` |
| Published | **only `./public`** — everything else stays private |
| Pages | `index.html` (artist home) · `vote.html` (audience voting) · `studio.html` (artist control) · `stage.html` → redirects to studio |
| API | `/api/show` `/api/vote` `/api/pay` `/api/confirm` `/api/stage` `/api/admin` |
| Storage | Netlify Blobs: `show` (config) · `f0..f11` (sharded fan records) · `meta` (tips + payment markers) |
| Deploy | `cd ~/Docs/MySet && netlify deploy --build --prod` |

## Secrets (never in the repo)
- `ADMIN_CODE` — the Studio passcode, Netlify env only.
- `STRIPE_SECRET_KEY` — Perry set it himself; Claude never handles it.

## Show model
3 free votes per fan per round; starting a song refreshes everyone's votes.
Already-played songs stay votable as **replay requests at `replayCost` (default 5)**.
"Up next" shows only songs with votes, ordered by votes desc then **earliest vote first**.

## Setlist
67 songs, each with an artist (best-guess artists — Perry edits them in
Studio → Setlist → Edit). Includes four Perry Idyll originals.

## Design
Rewritten 2026-08-17 from the flat "Modernist" look to a soft-depth Apple-style
system in `public/app.css` — rounded corners, layered shadows, gradient accent
(#FF375F→#FF6B45), spring easing, SF-family type. `studio.html` carries its own
self-contained dark stylesheet and deliberately does not load `app.css`.

## Regression before shipping
Fire N simultaneous votes from N distinct fans; the tally must equal N exactly.
Last run: **40/40 and 80/80, zero loss.**

## Known gaps / next up
- Stripe money flow not yet confirmed end-to-end by a real purchase (Perry to test).
- Artist attributions are guesses; a few are low-confidence (`I Found You`).
- Songs are alphabetical within the pool; no manual reordering.
- Single-artist product — no multi-artist accounts or auth yet.

---

---

## SESSION LOG — 2026-09-02 (the landing-page honesty pass)

**What this session was:** review ChatGPT/Atlas's two analyses of `myset.vip/about`,
then act on the P0 findings. Commit `565bb21` on `main`, **committed but NOT pushed**.

### Docs produced (all in `~/Docs/MySet/`)
- `MYSET-LANDING-PAGE-REVIEW-OF-ANALYSIS.md` — 137 Atlas claims adjudicated
  (122 CONFIRMED / 8 OVERSTATED / 5 WRONG), with what it missed.
- `MYSET-LANDING-PAGE-REBUILD-PLAN.md` — 279-feature inventory (230 SHIPPED,
  21 GATED, 11 FLAG-ONLY, 17 NOT BUILT) + 8 segmented work packets.

### Landed
- **`public/index.html`** — `/about` was an orphan (nothing in the product linked
  to it). Added a footer "How MySet works" link, a "Not sure yet? See how MySet
  works →" link under both empty-state CTA blocks, and a persistent "Add to home
  screen" footer button (the install sheet already existed but was
  dismissible-forever). **These went live inside commit `0b357b5`**, which another
  session swept up along with its own work.
- **`public/about.html`** — the honesty pass. Real proof numbers (8/21/1) replacing
  the fabricated 34/314/12; Free corrected to "4 shows a month"; unlimited shows
  moved to Plus where it is true; Plus given the vote-rule controls it actually
  gates; four unshipped Pro extras marked `Soon` **in the markup**; honest note
  rewritten (no fake "artist by artist queue", and the no-checkout fact disclosed);
  the per-song "just for tonight" claim corrected to point at setlists.
- **`public/vote.html`** — multi-tenancy fix. Ten user-visible strings said
  "Perry" to every audience, including `<title>` and "100% goes to Perry" in the
  tip sheet. Added `artistName`/`artistFirst`.
- **Deleted 4 screenshots** (`qr.png` = the Settings tab not a QR; `feed.jpg` = an
  empty search form; `numbers.png` = the fabricated 314/3-nights data;
  `buy.png` = "Tip Perry" over Sam Cole's page).

### Verified
- Real headless Chrome at 320/390/800/1280, light + dark: no overflow, all reveals
  resolve, 5 images all load, stats correct **with JS disabled**, no console errors.
- `npm test` → **212 passed, 0 failed** across all 4 stages (was 131 assertions;
  the suite has grown).
- Every inline `<script>` in the three touched files parses.

### Still open (highest value first)
1. **Re-shoot the four deleted screenshots** against real data — a genuine printable
   QR, a populated city feed, real venue numbers, and a tip sheet post-fix (it will
   now correctly say "Tip <artist>"). Then re-place them.
2. **`_plan.mjs:6-9`** still comments *"unlimited shows … six nights a week forever"*
   eighteen lines above `gigs: 4`. That comment is what the old landing copy was
   written from; it will cause the same drift again. Left alone only because
   another session was active in that file.
3. **`artist.html:293`** hardcodes `'perryidyll'` as a fetch fallback — same class
   of leak as the vote.html one, and it disagrees with `DEFAULT_ARTIST`
   (`'perry-idyll'`). One rename from breaking the legacy `/artist.html` gig list.
4. Packets 3–8 of `MYSET-LANDING-PAGE-REBUILD-PLAN.md`: the new
   setlists/charts/genres beat, proof rebuild, demo a11y, venue split, plumbing
   (privacy/terms/contact, canonical, landscape `og:image`, real
   `robots.txt`/`sitemap.xml`, point the referral `invite` link at `/about?ref=`).
5. `/about` still has no link from `studio.html` or `venue-studio.html`.

### Traps confirmed this session
- **`main` is production.** `git push` deploys (INVARIANT 9d3). The branch flipped
  from `fixes/audit-2026-09-01` to `main` mid-session without me noticing, and I
  told Perry the wrong thing before catching it. Re-check `git rev-parse
  --abbrev-ref HEAD` before every commit.
- **Another session edits this repo concurrently.** `_plan.mjs` gained `gigs: 4`
  and `pricing` under me, `vote.html` changed on disk, and my `index.html` edits
  were committed by that session. Re-read files before editing.
- A 1300ms wait after scrolling an 18,900px page is not enough for the 700ms
  reveal transitions to settle — it produced a false "1 element still hidden".
  Suspect the measurement first.

## SESSION LOG — 2026-08-31 (after the first real gig)

Perry played the first live gig with MySet on **2026-08-30, The Ugly Duckling
Irish Pub, Koh Phangan** — 8 people voting, 21 votes, one $3 purchase.

> **CORRECTION — 2026-09-04, from Perry.** This session's log originally described
> two failures at that gig: a paid customer who never received her votes, and Perry
> being unable to sign in to his own Studio. **Neither happened.** The buyer got her
> votes, used them, and he played the songs; he ran the show from his phone. The
> session had misread what he told it. The two pieces of work below were built and
> are good hardening — but they were not fixes for anything that broke, and every
> document that said otherwise has been corrected. The buyer's email address, which
> was recorded here, has been removed.

### 1. Payment delivery no longer depends on the buyer's browser
`/api/confirm` only runs if the buyer's browser returns to the site after Stripe.
In a bar that is not guaranteed — the phone gets locked and pocketed — so this
session made delivery independent of it.

Three independent delivery paths now exist, all funnelling through
`redeemSession()` in `_pay.mjs` so they cannot drift:
  1. the return page (`/vote.html?paid=…`)
  2. **`/api/webhook`** — Stripe-signed, fires regardless of the buyer's browser.
     Needs `STRIPE_WEBHOOK_SECRET` in Netlify; **still unset as of this writing**,
     so the webhook returns 503 and is inert. Set it and redeploy.
  3. **`/api/revenue` POST** — the reconcile sweep, exposed as a button in the
     Studio's Money tab.
The buyer's phone also stores the pending session id and retries on next load.
All paths proven replay-safe against the real payment (3 sweeps + a confirm
replay left `extra` at 5, not 20).

### 2. Artists set their own Studio passcode
The passcode had lived only in the Netlify `ADMIN_CODE` env var. An artist can now
set their own in **Settings → Your studio code** (stored hashed in
`show.codeHash`); `ADMIN_CODE` stays as the recovery key. `checkAdmin` is async
now and still fails closed. (Perry was never locked out — see the correction above.)

### New in this session
- **`/api/revenue`** (GET list / POST reconcile) — reads Stripe directly and
  filters to sessions this app created (`metadata.kind` ∈ votes|tip).
- **`/api/history`** + `_history.mjs` — per-show archive in flat `hist_<showId>`
  docs plus a `hist_index` summary. Money is bounded to the show's window and
  **auto-paged** (`sessions.list` does not paginate).
- **`show.log`** — the load-bearing piece. `clearAllFanVotes()` destroys the
  tally on every song start, so `admin.mjs` snapshots the whole round (winner +
  everyone else + voter count) inside the same handler.
- **Vote-pack pricing** is artist-set (`show.packs`), server-side, clamped.
- Sort control on the voting page (Top voted / Song A–Z / Artist A–Z).
- Removed `I Found You` — it was a mis-transcription of `Until I Found You`,
  which was already present. **66 songs** now.

### Live state at the end of this session
- Show `2026-08-30-1731`, clean: 0 votes, 0 played, 66 songs, 3 free credits,
  replay cost 5, packs $3/5 and $7/15, Stripe ON.
- History holds exactly one real show: `hist_2026-08-30-1210` (his first gig).
- **Cari's 5 purchased votes were delivered and then wiped** by a `newShow`
  during testing. `newShow` clears purchased votes by design (the confirm dialog
  says so). The honest resolution for her is a refund from the Stripe dashboard.
- An unpaid $2 Checkout Session exists in Stripe from a pricing test. It expires
  on its own and never appears in revenue (which filters on `payment_status`).

### Open decisions for Perry
- Should purchased votes survive a "New show" reset? Today they do not.
- Artist attributions still unconfirmed, notably `Wagon Wheel → Darius Rucker`
  (vs Old Crow Medicine Show) and `Hallelujah → Jeff Buckley` (vs Cohen).

### Next phases (researched, not built)
Full plan with storage shapes and traps is in the session scratchpad
(`plan.md` + five research reports). Order: **artist profile** → **events +
country/city homepage** → **community feed** → **lyrics**. Lyrics decision:
**LRCLIB**, fetched once via a Netlify Function and cached permanently in Blobs
(~300 KB for the whole setlist, zero API cost, no AI in the loop); originals
typed in by hand; current-song-only and `noindex` for the licensing posture.

### ⛔ BLOCKER at end of session — Netlify account usage
`netlify deploy` returns **403 Forbidden** and Git-triggered builds fail with
**"Skipped due to account credit usage exceeded"** on the `perryidyll` Personal
account (no card on file). This blocks all four of his sites — `mysetvip`,
`iohm`, `breathe-with-bastian`, `stunning-dolphin-d6f659` — though every one of
them is still **serving fine** from its last good deploy.

**myset.vip is live and healthy** on the deploy from 2026-08-30T17:34Z, which
includes everything through show history. Two commits are pushed but NOT live:
  - `cb7fa8a` artist profile page + leftover-vote choice
  - `bc530c6` embed facade fixes + adaptive polling

The likely cause is worth recording: `vote.html` polled `/api/show` every 3
seconds per phone. Twenty people over a two-hour gig is ~24,000 function
invocations; a handful of gigs exhausts the free tier. `bc530c6` eases the poll
to 6s and then 12s when nothing changes. Load-testing during development
(80 + 40 + 30 concurrent votes) and ~10 builds in one afternoon also contributed.

**To resume:** Perry resolves the Netlify billing/credits, then
`netlify deploy --prod` from `~/Docs/MySet` (or just push, the site auto-builds
from GitHub). Verify `/artist.html` returns 200 and `/api/profile` returns JSON.

### SESSION 2 — 2026-08-31 (lyrics, packs, unlimited votes, song editor)

**Everything below is committed, pushed, and running on a free draft deploy at
https://6a947437c6d91ace2d37a610--mysetvip.netlify.app — but NOT on myset.vip**, because the Netlify account credit limit is still
blocking production deploys.

- **Lyrics.** LRCLIB -> Blobs cache -> sheet under Playing Now. Must be fetched
  server-side (browsers cannot set `User-Agent`; LRCLIB's documented workaround
  is the `Lrclib-Client` header). Labelled **"Unofficial lyrics"**, current song
  only, `user-select:none`, one-tap removal per song. Studio Settings has a
  "Fetch lyrics for the whole setlist" warm button.
- **Song editor** (Setlist -> Edit): title, artist, lyrics in one sheet, with
  "Find online" and "Remove lyrics". `owned` distinguishes the artist's own words
  (credited to him) from LRCLIB's (credited to LRCLIB, never claimed as his).
- **Three vote packs**, defaults $3/3, $7/9, $11/18, artist-editable.
- **Unlimited voting**: `show.unlimited` for the room, `show.unlimitedFans[]` for
  one device (Settings -> This device -> Unlimited votes for me). The Studio and
  the voting page share the `myset.fan` localStorage key, which is how the toggle
  knows which device to grant.
- **Free votes**: preset chips + any number 0-999 + Unlimited.
- **Hiding a song was already permanent** across shows — confirmed, not changed.

**Webhook: CONFIRMED WORKING.** `STRIPE_WEBHOOK_SECRET` is set and live;
`/api/webhook` returns 400 "no signature" rather than 503, which proves the
secret reaches the function.

**Env var contexts matter.** `ADMIN_CODE` was production-only, so preview deploys
could not unlock the Studio. Now also set for `deploy-preview` and
`branch-deploy`. Note `STRIPE_SECRET_KEY` is the LIVE key and is available to
preview contexts — a draft URL can take real payments.

**Netlify credit reality (researched 2026-08-31):** production deploy = 15
credits, web requests = 2 per 10k, bandwidth = 20/GB, compute = 10/GB-hour.
Draft/branch deploys = **0 credits**. Deploy cost dominates everything else for
this project. Iterate on draft URLs; deploy to production once, at the end.

### Artist sign-in (added 2026-08-31)

Email + 6-digit code. `_auth.mjs` + `auth.mjs`; `checkAdmin` in `_lib.mjs` also
accepts `Authorization: Bearer <token>`. The studio code still works alongside it.

- Only allowlisted emails can sign in (`artists` blob). Managing the list needs
  an existing session, so bootstrap with the studio code, then add your email in
  **Settings -> Who can sign in**.
- Session token = HMAC over `email|exp|rev`, signed with a secret generated once
  into the `authsecret` blob. Bump `artists.rev` (Settings -> Sign all devices
  out) to invalidate everything.
- Codes: `authc_<hash>` blobs, 10 min, burned on use, 5 guesses, 5 sends/hour.
- **Delivery needs `RESEND_API_KEY`** (and optionally `AUTH_FROM`). Until it is
  set, `/api/auth` action `request` returns 503 for EVERY address — deliberately,
  because answering differently for listed vs unlisted addresses is an
  account-enumeration oracle (INVARIANT 9h; this shipped broken and was caught in
  the same session).
- **Untested end to end: the actual email send.** Everything either side of it is
  verified.

### Netlify credit reality, measured
Perry is on **Personal ($9 / 1,000 credits)**, not Free. In the Aug 8 - Sep 8
cycle he had 3.2 credits left. Production deploys in that window across his four
sites totalled **1,260 credits** (mysetvip 47, iohm 24, others 13). Traffic was a
rounding error. Draft deploys cost 0 — use them for everything except the final
push. `netlify deploy` (draft) vs `netlify deploy --prod`.

### SESSION 3 — 2026-08-31 (multi-tenancy, signup, gig calendar, city feed)

**All four foundation steps are LIVE on myset.vip.**

**1. Multi-tenancy.** Storage is namespaced per artist via `KEY.*` in `_lib.mjs`
(`show_<aid>`, `f0..f11_<aid>`, `meta_<aid>`, `profile_<aid>`, `ev_<aid>`,
`hist_<aid>_<showId>`, `histidx_<aid>`, `lyr_<aid>_<songId>`). The only global
docs are `artists` (the registry), `cityindex`, `authsecret` and `authc_*`.
Live data was migrated by COPYING (21 keys) before any deploy. The artist id
comes from `requireArtist(req)` (session) or `publicArtist(req)` (`?a=<slug>`) —
never from a request body.

**2. Routing.** `/perryidyll`, `/perryidyll/vote`, `/studio`, `/signup`. Real
files still win, so `/vote.html` etc. keep working and fall back to the founding
artist. NOTE: `/:slug` is a catch-all, so any unknown path renders `artist.html`,
which detects `unknown artist` and shows a proper "No page here".

**3. Self-serve signup.** One `start` action sends a code whether or not the
address has an account; the account is created when the code comes back, using
the name captured with the request. Still needs `RESEND_API_KEY`.

**4. Gig calendar + city feed.** `_time.mjs` (wall clock in an IANA zone, no
library), `_events.mjs` (rules expanded on read), `events.mjs` (public feed).
Studio has a Gigs tab: month calendar, coming-up list, one sheet for one-offs and
weekly/fortnightly/monthly/yearly runs, per-night cancellation. `myset.vip` is
now a country/city finder; Perry's old landing page moved to `/perryidyll` and is
backed up at `backups/index_perry-landing_2026-08-31.html`.

**Placeholder gigs were loaded to test the feed and then DELETED.** Perry must
enter his real schedule — see INVARIANT 0j.

**Bugs found by testing, not reasoning:** a new artist inherited Perry's name,
venue and 66 songs (`defaultShow()` was still his); monthly recurrence from the
31st clamped to the 28th and stayed there; the city index split "Koh Phangan" on
a space into a city called "Koh"; a literal NUL byte in `_events.mjs`; `.go`
collided with app.css's checkout button and rendered the feed chevron as a
full-width gradient bar.

**Premium tier proposals** (three, not yet chosen) are in the session scratchpad
as `tier-reach.md`, `tier-money.md`, `tier-craft.md`.

### SESSION 4 — 2026-08-31 (Studio responsiveness + polish)

- **Duplicate gigs fixed at the root.** `act()`/gig writes take a `WRITING` lock,
  `api()` shows a blocking busy overlay after 140ms, and `/api/admin` now returns
  `stagePayload` so a tap is ONE round trip, not two. Perry's four duplicate
  records were reset to the single weekly residency.
- Gig **end times** (`endTime` in, `durationMin` stored; an end before the start
  means past midnight). Sheet fields are visible against the sheet. The grab
  handle drags to close. Selected tab pill gets the accent ring.
- A cancelled night can be **hidden for good** (`eventHide`); the skip stays on
  the rule so it cannot return, and restoring un-hides. Hiding a ONE-OFF deletes
  it outright.
- Replay cost takes any number. Tagline placeholder is "Make my set your set".
- Homepage country/city are **comboboxes** (type to filter or tap to browse, gig
  count on every option), replacing the selects.
- **artist.html restored to the first build's layout**: cover + live pill, XL
  portrait with up to 3 clustered photos (`profile.avatar`, `profile.photos[]`),
  big name below, stats row with the red Join live button. Stats are real
  (shows / people / songs) — no invented follower count.
- Pricing tiers published as an Artifact:
  https://claude.ai/code/artifact/13157da5-d358-4506-90cf-7612a4fe3645

**Note:** tonight (2026-08-31) is marked CANCELLED on his residency — he tapped
the ✕ while testing. Restore it from Studio → Gigs if that was accidental.

### SESSION 5 — 2026-08-31 (photos, live state, polish)

- **Photo upload.** `_img.mjs` + `/api/img`. The browser crops/shrinks (cover
  1400px, squares 640px, quality stepped down until under ~850KB) then posts a
  data URL; the server checks the real file signature (HTML-as-JPEG refused,
  SVG not accepted at all) and stores bytes in Blobs. URLs carry `?v=` so they
  cache for a year and still update. Slots: cover, avatar, p0, p1, p2.
- **Live state fixed.** `defaultShow().status` is now `'pre'`, not `'live'` —
  the old default made every page claim a gig was on. Red "Live now"/"Join live"
  only for `status==='live'`; otherwise an outlined ticking countdown to the next
  calendar gig. **Start the show / End the show** live on the Studio's Live tab;
  the header toggle is relabelled **Voting: Open / Paused**.
- The next-up card comes from the calendar, not the legacy `show.showTime`
  placeholder (which said 8:00 PM against a real 8:30 gig).
- Live-tab poll uses `api(p,{quiet:true})` so it no longer flashes the overlay.
- "See what the audience sees" is a button and goes to `/<slug>/vote`.
- Artist page: 3 shows + "See more"; name sits on the page not the photo; cover
  fades into the background; location line removed; tagline 120 / bio 700 with
  live counters.
- Combobox chevron anchored to the input.

### SESSION 6 — 2026-08-31 (crop, plans, promo codes, referrals)

- **RESEND_API_KEY is live.** Note: **env var changes need a redeploy** — the
  running functions do NOT pick them up at runtime.
- **Crop before upload.** `openCrop`/`confirmCrop` in studio.html: square (or
  16:10) viewport, drag to pan, pinch/slider to zoom, drawn to canvas at 640px
  (1400 for cover). Verified: committed file is exactly 640x640.
- **Plans** in `_plan.mjs`: free (50 songs, 10% cut), plus $10 (unlimited, no
  cut), pro $20 (+ promote, analytics, presskit, branding, 5 seats). Song cap and
  seat limit enforced server-side. **A cap never deletes** — 66 existing songs
  survive the free 50 ceiling.
- **Promo codes**, owner-only (`isPlatformOwner` = founding artist).
  **MYSETFREE** = 100% off Pro 12 months (comps outright).
  **MYSETHALF** = 50% (recorded as `discountPct` for future billing).
- **Referrals**: `artists.byId[aid].referredBy` set at signup from `?ref=<slug>`,
  never editable after. Studio shows the invite link and who they brought.
  vote.html carries a "Play live yourself?" line — the highest-volume channel and
  it costs nothing.

### ⚠️ THE 10% CUT IS NOT IMPLEMENTED — INVARIANT 0r
`PLANS.free.cut = 0.10` is defined and displayed but **no fee is taken**. Every
artist's audience currently pays into the single `STRIPE_SECRET_KEY`, which is
**Perry's own account**. Fine while he is the only artist; wrong the moment
anyone else takes money. **Stripe Connect is required before onboarding a second
paying artist**: each artist connects their own account, charges are created with
`stripe_account` + `application_fee_amount`, and the platform fee falls out of
that. Perry must enable Connect on his Stripe account first.

Also fixed: `start` returned `needName` only for unknown addresses — an
enumeration oracle. Now byte-identical for all, with a signed 15-minute ticket
issued by `verify` for brand-new accounts.

### SESSION 7 — 2026-08-31 (QR, featured cap, referrals)

- **`_qr.mjs`** — own QR encoder (byte mode, level M, v1-10). **Verified by
  DECODING**, not by eye. Two real bugs found that way: the 15 format bits were
  written in reverse (scanned as nothing while looking plausible), and the mask
  penalty was wrong (rules 3 and 4) and picked unreadable masks. Now 206/214 on a
  fuzz set vs a reference's 205/214 on the same pipeline; every URL the app
  generates decodes at 4-20 px per module. **Re-run
  `scratchpad/qr-*.mjs` + opencv before touching this file.**
- **`/api/qr?k=home|profile|vote|invite&a=<slug>&s=<scale>`** → SVG. It builds the
  URL; the caller only picks a kind, so the site can never be used as a
  general phishing-QR generator.
- **Featured cap**: plans limit how many songs are LIVE (50 on free), not how many
  you keep (`MAX_LIBRARY` 2000). Over the cap a song saves but arrives switched
  off with a `note` the Studio toasts. Verified by flipping his account to free
  and back.
- **Lyrics are Plus-and-up.** `/api/show` exposes `features.lyrics`; vote.html
  hides the button; `/api/lyrics` returns `found:false` rather than a paywall.
- **Referral reward**: `rewardReferrer(aid)` in `_plan.mjs` gives the referrer one
  free month each time a referral goes paid, once per referral. Called from
  `redeemPromo` now, and must also be called from billing when that exists.
- Homepage sign-in is a bordered button; the three small profile photos are a
  column to the LEFT of the portrait.

### NOT BUILT: venue studio
Perry asked for venue accounts (profile, upcoming shows, menu, offers, amenities).
Scoped but not started — it needs a second account type and a venue registry, and
gigs currently store `venue` as free text, so matching gigs to venues needs a
venue id on the event. See the response in that session for the plan.

### SESSION 8 — 2026-08-31 (lyrics free again)

**Lyrics are NOT a paid feature.** Gated to Plus earlier the same day and
reverted at Perry's call, with the reasoning recorded as INVARIANT 0w: an
audience that gets a sing-along at one artist's gig and not the next learns that
MySet is unreliable, which costs more than a subscription is worth. **Anything
the ROOM experiences stays free — gate the artist's back office, never the
audience's night.**

Removed rather than left as an always-true flag: gone from `PLANS`, from the plan
payload (`shapeLimits`), from `/api/lyrics`, and from `/api/show` (which no longer
looks up a plan on the hot path at all). Verified by flipping the account between
free and pro — lyrics resolve identically and no `features` flag is advertised.

Free is now: 50 featured songs, 10% cut, 1 sign-in. Everything the audience sees
is identical on every plan.

Profile photos: the three small ones step inwards (15px / 6px / 0) so they arc
round the portrait's top-left corner.

---

### SESSION 9 — 2026-08-31 (venue studio, audience requests, studio polish)

Shipped to production and verified from outside. Commits `d6ca102`, `08c8ae2`,
`2049f9a`.

#### VENUES — a second kind of account

A bar is not an artist, so it is not a role on one. Own registry (`venues` blob),
own token tag (`v|email|exp|rev`), own one-time-code realm (`authc_v_…`).
**Verified: a venue token gets 401 from `/api/admin`, and the studio code gets 401
from `/api/venueadmin`.** INVARIANT 0x.

| Thing | Where |
|---|---|
| Venue studio | `myset.vip/venues` → `public/venue-studio.html` (4 tabs: Page · What's on · Menu & offers · Settings) |
| Public page | `myset.vip/v/<slug>` → `public/venue.html` |
| Sign-in | `netlify/functions/venueauth.mjs` |
| Writes | `netlify/functions/venueadmin.mjs` |
| Public read | `netlify/functions/venue.mjs` |
| Model | `netlify/functions/_venues.mjs` |

Profile holds: cover + 3 photos, name, one-liner, about, city/country, address,
pasted maps link, phone, WhatsApp, 22 amenities, 7 days of opening hours, a menu
(link + note + up to 24 highlights with sections and prices), up to 6 offers, and
website / Instagram / Facebook / Google links.

**Nothing links a gig to a venue — the NAME does, inside the venue's own city.**
`sameVenue()` normalises to words and accepts containment only when the shorter
name is *distinctive* (two words, or eight characters), so nobody can register as
"Beach" and claim every Beach Bar in town. An exact match always counts.
Consequence worth keeping: **a venue signing up today already has its whole
diary** — no backfill, no job, nothing for an artist to re-enter. Verified live:
a venue named "The Ugly Duckling Irish Pub" in Koh Phangan picked up all 9 of
Perry's residency nights with zero data entry. INVARIANT 0y.

Venue photos live under owner key `v_<venueId>` — artist ids are stripped to
`[a-z0-9-]`, so the underscore is unforgeable in either direction, and
`/api/img` branches on that pattern first. INVARIANT 0aa.

**Verification** — see `VERIFYING-A-VENUE.md`. Built: instant on an email at the
venue's own website domain (free-mail domains rejected), plus an owner-only
Verify switch in Perry's Settings → Venues. Everything else shows a grey
`Unverified listing` chip and loses nothing else. Next and best: **artist
vouching** (N artists with gigs listed there confirm it) — uses the network MySet
already has, ~a day's work, no third party. Google Business Profile is the right
long-term answer and the wrong near-term one (OAuth review + access-gated API).

#### REQUESTS — the room can ask for something that isn't on the list

`request.mjs` (public) + `_requests.mjs` (model) + `askSet` / `askAccept` /
`askDone` / `askDecline` on `/api/admin`.

* Two kinds: a **song** the artist hasn't got listed, and a **happy birthday
  shout-out** with the name of whoever it's for.
* Paid in **VOTES, never money** (INVARIANT 0ab — cash-to-be-played-next is a
  different product and it breaks 0w).
* Both default **OFF**, each with its own price the artist sets (Settings →
  Requests from the audience). Currently ON at 3 votes each on Perry's account.
* Votes are taken **before** the row is written and refunded if the write fails.
  Declining refunds exactly once and clamps at zero. Verified: a second decline
  returns 409 and the balance does not move. INVARIANT 0ac.
* One pending request per kind per fan; 30 pending per show; 80 rows kept.
* Studio Live tab shows them: **+ Add** puts the song in the setlist so the whole
  room can vote for it, **Did it** clears a birthday, **✕** refunds.
* The fan sees their own status on the voting page: waiting → on the list →
  played, or "Not tonight — votes refunded".
* `creditsUsed` now includes `fan.spent`, which resets with the free credits
  (i.e. every time a song starts).

#### THE HEAD-COUNT — phones, not IP addresses

Perry asked for distinct IPs. **Built and then changed, deliberately:** forty
people at a beach bar on the venue's wifi come out as **1**. A phone is much
closer to a person; the worst it does is count someone twice if they clear their
storage mid-gig. The network hash is kept alongside it (`nets`, stored per show)
as the defence against one phone rotating its id. INVARIANT 0ae.

Presence is stamped **once per device per show, only from the voting page** —
`/api/show` is polled by every phone in the room, so it must not write on the
poll. The stamp needs `in=1`, which only `vote.html` sends; a profile view would
otherwise inflate the count with people who were never there. The IP is never
stored, only `sha256('myset-room|<artistId>|<ip>')` truncated to 16 hex.
INVARIANT 0af.

#### ADDRESSES

`_maps.mjs`. **There is no one link that opens in whichever map app a phone
uses** — `geo:` is closest on paper and iOS Safari ignores it. So the server
builds BOTH an Apple and a Google URL and the page picks by platform. Coordinates
are extracted from a pasted Google/Apple/OSM link when they're in it; a
`maps.app.goo.gl` short link keeps the link and falls back to the address (we do
not fetch third parties on the artist's behalf). INVARIANT 0ag.

**A bare venue name is not a location** — "The Ugly Duckling" could send somebody
to Amsterdam. `mapLinks()` returns null unless there are coordinates, an address,
or a name WITH a city, and the city/country always go into the query. Emoji and
pipes are stripped from the query. INVARIANT 0ah.

Gigs gained `address` + `mapUrl`; the gig sheet has both fields. Directions show
on the artist page (pin icon in rows, full button on the "tonight" card), the
homepage feed (pin icon) and the venue page (full button).

#### STUDIO / PROFILE

* **Tap a QR code** → it comes up in the middle of the screen, big, on white
  paper, captioned in a serif. Vote code says **"Vote your favorite song!"**.
  Every kind decoded with an independent decoder at 4/6/10/20 px per module —
  all five URLs exact. New `venue` kind.
* **Real bug found doing it:** `animation:rise` left an identity transform on the
  overlay, and a transformed element with `backdrop-filter` stops sampling the
  layer underneath — the white card vanished and the page showed through. Fixed
  by animating the inner card and dropping the backdrop-filter. Add this to the
  CSS-gotchas list alongside the mix-blend one.
* **Profile metrics** are now Joined (Aug 2026) / Shows / Audience / Votes cast /
  Songs, in a 3-across grid with the live button on its own row above. History
  rows from before the head-count fall back to `peakVoters`, which under-states
  rather than inflates.
* **The three small profile photos** are back in a plain column; only the top one
  moves, `translateX(28px)` + `z-index:3`, so it sits over the portrait's
  top-left corner (measured: 19px across, 16px down) and nothing else shifts.
* **Homepage:** "For artists" + "For venues" buttons; day headings carry the date
  ("Tonight – 31/8"); both empty states offer both doors.
* **Owner-only confirmed by test, not by reading:** a *second artist on the Pro
  plan* gets 401 from `promoList` / `promoCreate` / `promoRevoke` / `venueList` /
  `venueVerify`, and their Settings tab contains no "Codes you hand out", no
  "Make a code", no venue list — while still showing their own QR codes, their
  own requests settings, "Got a code?" and their invite link.
* Fixed: the plan box read `PLAN.limits.songs`, which does not exist, and printed
  "undefined songs". It's `featured`.
* Fixed: venue opening-hours inputs clipped to "05:0" — a native time input needs
  ~100px, so the times get their own line.
* Fixed: QR cards rendered broken images before the slug had loaded.

#### Still open

* **Stripe Connect** — unchanged and still the blocker. Until it exists a second
  artist's money lands in Perry's account and the 10% free-plan cut does not
  exist. INVARIANT 0r.
* Artist vouching for venue verification (see `VERIFYING-A-VENUE.md`).
* A venue with one resident act renders one day-heading per night — 9 near
  identical cards for a weekly residency. Cosmetic; a "every Monday" roll-up
  would read better.
* Venue cover photos are centre-cropped on upload, not interactively croppable
  like the artist avatar.
* SSD has not been mounted for several sessions — nothing mirrored there.

---

### SESSION 10 — 2026-08-31 (venue bookings, room numbers, venue events, real verification)

Shipped to production and verified from outside. Commits `bdae1f2`, `b16226b`,
`f70dbe1`.

#### Shipped mid-session, because Perry was blocked on it

**"Add a gig" opens EMPTY.** It used to copy venue, city, country, address and map
link from the most recent gig. Meant as a convenience; in practice half-right
details attached themselves to the wrong gig while he was entering a night's
worth. Deployed on its own so he could carry on.

#### VENUES — "Want to perform here?"

`_pitch.mjs`, `pitchSend`/`pitchStatus`/`pitchList` on `/api/admin` (artist side),
`pitchList`/`pitchSet` on `/api/venueadmin` (venue side), the card in `venue.html`.

* **Only a signed-in artist can send one.** An open contact form is a spam funnel
  and it throws away the point: the venue gets a link to a real MySet page with
  real numbers on it, not a bio. A visitor with no session gets "Get your MySet
  page — it's free".
* The venue's What's-on tab lists each enquiry with the artist's **nights played,
  people in the room, votes cast, songs**, their message, and Keen / ✕.
* **No email is exchanged either way.** Keen shows in the artist's own studio (Gigs
  tab → "Venues you've asked") and they take it from there. Verified: no `@`
  anywhere in the payload. INVARIANT 0ai.
* Idempotent per (artist, venue): asking twice updates the message; identical text
  reports no change.

#### VENUES — what happened in the room

`_vstats.mjs`, action `stats`, the new **Numbers** tab.

* People, votes, nights, acts; busiest night; **by act** (with average people per
  night — the number that says who fills the room); **by night**.
* Built entirely from show history that already exists. No new tracking, no extra
  writes, nothing to backfill.
* **MONEY IS NOT IN THE PAYLOAD**, not even as a total. INVARIANT 0aj.
* It is still the artist's data: Artist Studio → Settings → **"Show venues my
  numbers"**, default ON. Verified: off ⇒ the venue's view drops to zero nights and
  reports one hidden act.

#### VENUES — their own events

Quiz night, a DJ, the football, a full moon party. Reuses `_events.mjs` under owner
id `v_<venueId>`, so a weekly event is one record forever.

* Lands on the venue page AND in the local country/city feed beside the music,
  tagged `kind:'event'` so the page can tell them apart. `isVenueOwner()` /
  `venueIdOf()` let the city index hold both kinds with no migration.
* `normEvent` gained `title` — only venue events have one; for a gig the artist IS
  the title.
* The place comes from the profile, never the request. Changing the venue's city
  **rewrites its events**, or they keep pointing at the old town and disappear from
  both feeds. INVARIANT 0am.

#### VENUES — verification that actually verifies

`_verify.mjs`. Full write-up in **`VERIFYING-A-VENUE.md`**.

* **Way 1 needs BOTH**: the sign-in email on the website's domain, AND the fetched
  page naming the venue. Either alone is not proof — anyone can buy a domain, and
  the website is just a URL somebody typed in. Free-mail domains refused outright.
  INVARIANT 0ak.
* **The fetch is the only place MySet requests a stranger's URL, and is guarded
  like it**: https only; hostname resolved and refused if ANY address is loopback /
  private / link-local (169.254, the metadata endpoint) / CGNAT / reserved;
  `.local`/`.internal` by name; redirects manual, 3 hops, each re-checked; 8s
  timeout; 512KB cap; html only. Literal private IPs also refused at storage time.
  Verified against 13 targets. INVARIANT 0al.
* **Way 2: ten artists** who have a gig there in their own calendar. An artist with
  no gig listed cannot vouch (`artistPlaysAt()` checks server-side); nobody vouches
  twice. `MIN_VOUCHES = 10` — worth lowering for a small island, it's one constant.
* The studio shows a **checklist**, not a yes/no, with what's missing on each line.
  Saving a website runs the check by itself.
* Proven end-to-end on production: a venue named "Example Domain" with website
  `example.com` and email `probe-venue@example.com` verified; the same email with a
  site that does NOT name the venue correctly did **not**.

#### ARTISTS

* **Setlist tab has the audience's search and the same three orders** (Top voted /
  Song A–Z / Artist A–Z). Focus and caret survive the re-render. Verified: 8 John
  Mayer matches, both sorts correct, empty-state message.
* **Starter pack / Clear setlist / See what the audience sees moved to the top** of
  the Setlist tab, the audience one first. The global footer copy of that button is
  suppressed on the Setlist tab so it isn't duplicated.
* **QR captions**: "Scan to choose the next song!" and "Hear more on MySet!".
* **Dates next to a weekday spell the month out** — "Tonight – 31 August".
* **Profile head relaid out** to Perry's spec, measured: top small photo's centre
  on the bottom two's right edge (both at x=60); bottom two overlapping the
  portrait by 13px = 0.33 of their width; name and one-liner flush with the cover's
  right edge (delta 0); 22px of air under the cover.

#### Bugs found by verifying, not by reading

* **`.go` collided with app.css's checkout button again** — second time in this
  project — turning the tonight card's Directions pill into a full-width gradient
  slab. Renamed to `.dirsrow`, and every page audited for other shared-class
  collisions (the rest are deliberate). INVARIANT 0an.
* **`.note b{display:block}`** hit every `<b>` in the note body, so "you only need
  **one**." rendered on three lines. Scoped to `.note>b`. INVARIANT 0ao.
* **The vouch count read 0** until somebody happened to run the website check; it
  now travels with every venueadmin response.
* **`venueauth` answered "ok" to any typo'd action** by falling through past every
  handler.
* **A private-IP URL could be stored as a venue website** and rendered as a link.
* **A scratch harness rode along in a commit twice.** `_tmp_*` is now gitignored.

#### Still open

* **Stripe Connect** — unchanged, still the blocker. INVARIANT 0r.
* `MIN_VOUCHES = 10` is probably too high for Koh Phangan.
* A venue with one resident act still renders one day-heading per night.
* Venue cover photos are centre-cropped on upload, not interactively croppable.
* SSD not mounted for several sessions — nothing mirrored there.

---

### SESSION 11 — 2026-08-31 (MYSET.md and the landing page)

Commit `d03c033`. Live at **myset.vip/about**.

**`MYSET.md`** — the master reference, 710 lines, twelve sections. What it is and
the ambition; where everything lives; the night start to finish; every feature by
audience (audience / city feed / artist / venue / the two sides meeting / QR /
addresses); how it is built (storage, multi-tenancy, the calendar, the head-count,
polling, perceived speed); every endpoint; money and the Connect gap; plans; how to
run and deploy it; the 19 rules that matter most; what is left; and how it got
here. It points at `INVARIANTS.md`, `GIG-NIGHT.md` and `VERIFYING-A-VENUE.md`
rather than repeating them.

**`/about`** — `public/about.html` + `public/about/*` (nine screenshots, 672 KB,
all lazy below the fold). Route added to `netlify.toml`; `about` was already in
`RESERVED`.

Spine: promise → recognition → **try it** → the five beats → the transformation →
proof you can hand a venue → venues → price → objections → one action.

* The centrepiece is a **real working vote demo on the page** — tap a song, the
  count moves, the queue reorders with a spring. Somebody who has done it once
  already understands the product, which is why it sits above every screenshot.
* Written to the **feelings**, each anchored to the mechanism that produces it:
  ease / excitement / freedom for musicians, ease / confidence / pull for venues.
* **Honest about what isn't finished** — card payments and the Pro extras are named
  as in progress in the pricing block. Naming that is what buys belief in the rest.

#### How the screenshots were taken (reusable)

Headless Chrome over **DevTools Protocol**, driven from a small Node script using
Node 24's built-in `WebSocket` — no puppeteer, nothing installed. It seeds
`localStorage` on the origin, reloads, runs an after-script, and captures. Against
a **throwaway artist and venue**, both deleted afterwards; Perry's own account was
never touched because he was 40 minutes from going on stage.

**Three traps worth keeping:**

1. **`Runtime.evaluate` has no top-level `await`.** An expression starting with
   `await` is a syntax error that fails *silently* — every scroll and every
   sheet-open quietly did nothing until they were wrapped in
   `(async () => { … })()` with `awaitPromise: true`.
2. **Headless Chrome reports `prefers-color-scheme: dark` by default.** Two shots
   came out light and seven dark before `Emulation.setEmulatedMedia` was set
   explicitly. Check the actual pixels — sampling mean luminance is quicker than
   opening nine files.
3. **The Browser pane's screenshots are not proof.** Backgrounds and
   opacity-transitioned content composite oddly, so a page looked ghosted and
   photos looked missing when the DOM said `opacity: 1` and the images were 200s.
   Verify layout by measuring (`getBoundingClientRect`, `scrollWidth`), and render
   with headless Chrome when you need to *look*.

#### Two judgement calls

* **The lyrics screenshot was not published.** It was the best-looking shot of the
  set — and it is fourteen lines of a copyrighted song on a public marketing page.
  Beat 5 became "and afterwards, they can find you" instead.
* **Nothing on the page depends on JavaScript to be VISIBLE.** The reveal animation
  is scoped to a class an inline script adds, so if the script never runs the page
  is simply visible; the demo has static fallback rows; and there is a no-IO
  branch. A landing page that hides its own copy behind an observer is one bug
  away from being blank.

Verified: no horizontal overflow at 320 / 375 / 390 / 430 / 768 / 1024 / 1440, in
light and dark, no broken images, no invisible content.

---

### SESSION 12 — 2026-08-31 (song sheet, navigation, verification tightened)

Commit `fa6e1d2`. Live and verified on production at 20:22 local, eight minutes
before Perry went on stage — he gave the go-ahead mid-session.

#### THE SONG SHEET

One sheet for adding and for editing, the same shape as the gig sheet. Replaces
the two inline inputs on the Setlist tab and the old `editSong` sheet, both of
which are gone.

| Field | Detail |
|---|---|
| Title · Artist | as before |
| **The key you play it in** | twelve root chips + a Major/Minor toggle, plus a free field for what you'd actually write ("Capo 2", "Drop D"). `song.key`, ≤14 chars. |
| **Genres** | 15 built-in + up to 15 of your own at 20 chars. Max 6 per song. |
| **Your chart** | words, chords, capo notes — fixed-width so chords stay over the right word. Its own blob, `chart_<aid>_<songId>`, ≤20 KB. |
| Words for the room | the audience's lyrics, with Find online / Remove |

* **The chart and the key are never in a public payload.** Verified against
  `/api/show`: no `chart`, no `key`, no chart text.
* The chart is one tap from the **Live tab's now-playing card** — which is where
  you need it — with the key shown under the title.
* `_chart.mjs` keeps charts out of the `show` document on purpose: a full chart is
  kilobytes and `show` is the hot path every phone in the room polls.

#### GENRES

Built-in (code, not data): Originals · Rock · Pop · Acoustic · Country · Folk ·
Indie · R&B/Soul · Blues · Reggae · Funk/Disco · Hip-hop · Jazz · Latin ·
Sing-along. `singalong` is in there deliberately — for this product it is more
useful than half the real genres.

Their own live on `show.tags` as `{id,label}` with a `c-` prefix, so a custom id
can never collide with a built-in. **A custom tag can never duplicate a built-in
however it is spelled** ("Rock", "rock", "R&B / Soul" are all refused) — otherwise
the filter row gets two identical chips that mean different things. Deleting one
strips it off every song on the next write.

**Both setlists filter by genre** — the audience's voting page and the artist's
Setlist tab, same chips. Only genres actually ON a song are offered; a row of
fifteen where twelve match nothing is worse than no row. The audience's genre
choice is deliberately **not** remembered between visits: a filter you forgot you
set, on a setlist you have never seen, makes it look like the artist knows four
songs.

#### NAVIGATION

* **Sheets.** Dismissing one meant hitting a 20px strip. Now the whole top of the
  sheet drags; you can also drag from the body while it is scrolled to the top and
  not on a control; a short **flick** closes it as well as a long pull (velocity,
  not just distance); and there is a visible **✕**, because a gesture must never be
  the only way out of anything. Same code in both Studios.
* **The MySet logo is top-left of both Studios** and goes to the homepage.
* **Tapping your own name** opens your public page in a new tab.

#### VERIFICATION — all four, not any one

`MIN_VOUCHES` 10 → **5**, and it is an AND now, not an OR. The automatic tick needs
*all* of: a website on the page · the page claimed by an email on that domain ·
the site naming the venue · five artists confirmed.

**Proven on production:** a venue whose email and website both check out — which
verified on its own this morning — now returns `passed: false` with
`artists: 0 of 5`. INVARIANT 0ak updated.

Also: the website check now runs against the address that **claimed** the page
(`ownerEmail()`), not whoever is signed in, so a barman added later cannot verify a
venue with a personal address on some other domain. The studio says so when the
two differ. Perry's manual switch stays, as an explicit override.

#### QR CODES — three in the whole app

| Code | Goes to | Caption |
|---|---|---|
| Artist | `myset.vip/<slug>` | *Choose the next song* |
| Venue | `myset.vip/v/<slug>` | *Connect with our performers* |
| MySet | `myset.vip` | *Find live music near you & choose which songs are played* |

`vote` and `invite` still **resolve**, because codes printed earlier may be on
somebody's table, but neither Studio offers them.

**Worth knowing:** the artist code now points at the profile page rather than
straight at voting, so during a gig the room taps *Join live* once more than
before. Perry asked for "their page", so that is what it does — one line to change
if the extra tap turns out to matter in a busy bar.

#### Every published page now carries an ownership notice

Not security — see the note in `MYSET.md` — but it removes the "no notice" excuse
and costs nothing. Audited at the same time: **nothing secret in any published
byte** (Stripe keys, webhook secrets, Resend keys, Netlify PATs, the studio
passcode, private keys, bearer tokens, real email addresses — all absent), and no
secret hard-coded in any function. The five env vars are the only source.

---

# SESSION LOG — 2026-09-01 (setlists, PWA, and the review that caught what they broke)

**Two commits, both on `main` and deployed to production** (`myset.vip`, verified
from outside):

* `29e87fd` — custom setlists, songs-to-learn, genre auto-tagging, the PWA, and the
  sheet/navigation polish Perry asked for.
* `6515dcf` — the 13 confirmed findings from the independent review of `29e87fd`,
  plus MySet's first test suite.

## What was built

**Setlists.** One library of songs; a setlist is a named subset of it, holding song
IDS only, like a Spotify playlist — so renaming a song changes it everywhere. Two
new documents, `lists_<aid>` and `learn_<aid>`. The Setlist tab's top row always
says what the room can currently see. Per-gig selection, with the three states
below.

**Songs to learn.** `learn_<aid>`, deliberately NOT in the library, so the room can
never vote for something that isn't playable yet. *Learned it* moves a row across
in one action.

**Genre auto-tagging.** `_genremap.mjs` — a 62-song curated map plus 76 artist-level
fallbacks, built by an 11-agent adversarially-verified workflow. `tagAuto` only ever
fills a song with NO genres, so running it twice is a no-op and hand-tagging always
wins. `originals` is applied when a song's artist matches the artist's own name.

**PWA.** `sw.js` plus a manifest per surface. Nothing under `/api` is ever cached —
verified in a real browser, not assumed. Navigations are network-first, nothing is
precached, so a bad deploy is fixed by the next deploy. Add-to-home-screen banner on
the homepage with iPhone/Android tabs.

**Polish.** Sheet ✕ moved down to 10px. ↗ on the Studio's MySet mark and on the
artist name on the audience page. Collapsible gig list. White hairline round the
six-tab pill with equal 18px word gaps (measured at 320/375/390/430).

## What the review found — all 13, all fixed, all with a test

The review pass on `29e87fd` was a 39-agent workflow with five fresh-context lenses
and an adversarial refute stage: **34 raised, 13 confirmed, 21 refuted.** Every
confirmed finding was one shape — *a setlist narrows what the room can vote for, and
something else did not get the memo.*

**The two that would have cost real money on stage:**

1. **`askAccept` accepted a paid request into invisibility.** It added the song to
   the LIBRARY only. With a setlist active, `playable()` excluded it, `/api/show`
   never listed it, and `vote.mjs` answered *"that one isn't on tonight's list"* —
   while the fan who had just paid three credits was told *"On the list — go vote
   for it."* It now joins tonight's set. And if the plan's featured cap would land
   it switched off instead, the accept is **refused**: the request stays pending, so
   the credits are still attached to something the artist can honour or decline for
   a refund.
2. **`playTop` moved to `playable()` and stopped seeing replay votes**, so the
   room's top-voted *play it again* could not win. Meanwhile the Studio kept the old
   whole-library predicate, so *"Start top voted — X"* could name a song `playTop`
   would not start. The `inSet` flag added for exactly this had **zero consumers**.

**The fix for the family, not the instances.** Three places each computed "can the
room vote for this". There is now one — `votable()` in `_lib.mjs`: in tonight's set,
or already played. `vote.mjs` enforces it, `playTop` picks out of it, `show.mjs`
filters the public payload through it, and `stage.mjs` hands the Studio the same
flag so the client cannot drift. Callers may narrow it; none may widen or recompute
it. **INVARIANT 0bc.**

**The rest:**

* **Un-voting is no longer gated by membership.** The guard sat ahead of the toggle,
  so narrowing the set mid-round left a fan's credit spent on a song they could not
  un-vote. INVARIANT 15 claimed otherwise; now it is true.
* **A gig's `listId` has three states and they are not interchangeable:** `''` =
  leave my pick alone · `'all'` = play the whole library · `<id>` = that set. A
  truthiness test collapsed the first two, so "All songs" on a gig silently did
  nothing — and `eventSave`'s unknown-id sanitiser *blanked* `'all'`, because it is
  not a list id. (That second one my own test found; the review had not.) It now
  also applies on **↺ New show**, and a gig pointing at a set the artist has since
  deleted leaves their pick alone and says so.
* **`refreshActive` ran off a hard-coded allow-list of actions**, with a comment
  asking the next person to remember to add to it — and two handlers added in the
  same change did not. `admin.mjs` now **compares the set of song ids across the
  mutation**. A fact cannot be forgotten; a promise can. Its failure is also
  surfaced as a note rather than swallowed.
* **Everything in `/api/show` is now votable**, so tapping anything in it works. A
  hidden-but-played song used to sit there answering "not on tonight's list".
* **`shapeLists` returns two different numbers on purpose** — library membership
  (the picker's ticks, so a hidden song keeps its tick instead of being dropped on
  save) and in-play count (the same test `playable()` applies). They were the same
  number, so "8 of your 40 songs are in play" counted songs the room could not see.
* **`tagAuto`'s counters moved inside the CAS callback** — `casDoc` re-runs it on a
  write conflict, and they reported double.
* Setlist rows say **"Not in this set"**; gig rows name their set (including *all
  songs* and *a deleted set*); the want-to-learn copy no longer claims a learned
  song lands in the active setlist.

**Found while verifying, not in the review:** `.tabs` stuck at a hard-coded
`top:66px` under a header that is really **88px** tall, so the blurred sticky header
sat over the top quarter of the app's main navigation on every scroll — in **both**
studios. `fitTabs()` measures it into `--headh` now, because the header's height is
content-driven and grows with the phone's text-size setting. **INVARIANT 0bb.**

## MySet has a test suite now — `npm test`

Four stages, **131 assertions**, no dev server, nothing that touches production:

| Stage | What it proves |
|---|---|
| `test/syntax.mjs` | every page's inline script through `node --check`, every function `import()`ed |
| `test/structure.mjs` | every `if(TAB===…)` block and top-level function exists exactly once — **and every flag the server produces has a consumer**, which is precisely how the Studio's queue drifted from `playTop` |
| `test/unit.mjs` | the predicates: `playable`, `votable`, the `playTop` pool, the Studio's own filters, `shapeLists` |
| `test/e2e.mjs` | whole request flows through the real handlers — one case per bug that has actually happened |

**Why it does not use `netlify dev`:** its Blobs sandbox returns **no etag**, so
`casDoc` falls back to `onlyIfNew`, every write after the first fails, and the second
API call in any test returns `busy`. `test/blobs-fake.mjs` is an in-memory store that
implements etags, injected by a module-resolution hook (`test/register.mjs`). Reads
*do* work under `netlify dev`, so to eyeball the UI locally you can still run it and
seed `.netlify/blobs-serve/entries/<siteId>/site:myset/` by hand — that is how the
Studio screenshots in this session were taken.

## Verified, and how

* `npm test` — 131/131.
* **In a real browser against a seeded local store:** the Live tab's queue holds
  only votable songs and "Start top voted — Bravo" matches what `playTop` starts;
  the Setlist tab labels the out-of-set song "Not in this set"; the gig sheet's
  dropdown has all three states with every box empty; ✕ is 10px from the sheet top;
  18px word gaps and 11px symmetric insets at 320/390/430 with zero body overflow;
  header/tab overlap 0px when scrolled (was 22px); no console errors.
* **Draft deploy, read-only against the real API** (a draft shares production
  Blobs, so nothing was written): every route 200, every changed line present,
  `/api/show` sane, service worker registers and caches no `/api`.
* **Production from outside:** every route 200, all six changed markers present in
  the live `studio.html`, `/api/show` 200, the audience page renders with no console
  errors.

## Still open

* **Stripe Connect** — unchanged and still the platform blocker. Until it exists, a
  second artist's money lands in Perry's Stripe account and the 10% platform cut does
  not exist. Perry is doing this himself.
* **A residual credit case, stated honestly:** if the artist narrows the set
  mid-round, the API will always let a fan toggle their vote off, but the song
  disappears from `/api/show`, so the *UI* has no button for it. Practical harm is
  bounded — votes are wiped when the next song starts, which returns the credit
  anyway — so it was left rather than adding a fan-wide write to sweep votes on
  every `applyList`. Worth revisiting if a real gig hits it.
* `MIN_VOUCHES` is 5, which may still be high for a small island.
* The artist QR points at the profile page, so the room taps *Join live* once more
  than before. One line to change if it matters in a busy bar.
* Pro extras (press kit, branding, city promotion) are promised in the plan copy and
  not built.

---

## 2026-09-01 — Cross-ref: umbrella brand doc created

An **Idyll Enterprises** umbrella landing page now exists (holding brand above this
project). See `HANDOFF-Idyll-Enterprises.md`. Source:
`~/Docs/Idyll Enterprises/website/index.html` (commit 9858251, built + verified,
not deployed). It quotes this project's live positioning verbatim — if the
positioning here changes, update the umbrella page too.


---

## SESSION 15 — 2026-09-02 (the deep audit, parked deliberately, and four fixes shipped)

**What was asked:** another full, deep audit — code organisation, every pixel, every feature however small,
and the cascades a live show sets off — with the work delegated carefully so agents do not overload
themselves; then push everything live.

**What happened, honestly.** Three attempts. The first two commissioned 34 auditors in two waves of
sixteen; both exhausted the account's five-hour usage window in about ten minutes (2.05M and 2.24M subagent
tokens) and returned nothing. The third run was restructured to fifteen auditors in three sequential waves
of five, each required to reproduce its own findings. It hit the same wall part-way, and this time the run
was **parked on purpose**: agents stopped, sandboxes shut down, every completed result salvaged from the run
journal. **Three of fifteen auditors finished** — and they were the three hardest slices.

**The lesson, now measured rather than guessed:** `_tmp_audit/budget.py` meters the five-hour window from
the on-disk transcripts. Calibrated against the two runs that died, the ceiling is **~25M cost-weighted
units** (out×5 + cache_write×1.25 + cache_read×0.1 + in). Stop launching agents past ~20M. Sixteen-way
parallelism is the thing that kills a window, because every agent writes its own long prompt to cache.

### Fixed, tested, shipped

1. **"∞ Unlimited" was comprehensively broken — two independent bugs in one feature.**
   * It *destroyed every pack the room had bought*: `paidUsed()` had no notion of unlimited, so
     `clearAllFanVotes` debited `extra` at the round's end for votes the server had given away free.
     Measured: a 12-credit pack gone in one round. `paidUsed`/`unspentPaid` now take the fan id and return
     0 for an unlimited device. **INVARIANT 13c.**
   * It *disabled every Vote button in the room*: the server sends `remaining: null`, and `null < 1` is
     `true` in JS, so every row rendered `disabled` under a pill showing ∞. **INVARIANT 13d.**
   * Verified in a real browser after the fix: 58 buttons, 0 disabled, and a tap moved the tally 10 → 11.

2. **A song titled in Thai could never be voted for.** `slug()` returned `''` for any title with no Latin
   letters or digits, so the song got id `''` — invisible and unvotable. `importSongs` also de-duplicated on
   that key, collapsing a CSV of Thai songs to one row. Now one `songId()` and one `songSig()` in `_lib.mjs`
   used by all four mint sites; Latin titles unchanged. **INVARIANT 0aw0.**

3. **A comment that argued for rungs the code does not have** — the poll ladder is 3/10/25s, not 3/6s.

`npm test` is now **262 assertions** (was 237), with `test/audit-0902.mjs` covering each fix.

### Confirmed, reproduced, NOT fixed — the next session's list

* **A non-founding artist's Studio passcode is stored but never checked.** `requireArtist` only reads
  `getShow(DEFAULT_ARTIST)`, so every artist except Perry gets a success toast for a code that cannot work.
  This is the 2026-08-30 stage lockout (INVARIANT 15d) reintroduced for everyone else. Needs a
  `sha(code) → aid` index; it is an auth change and deserves its own pass.
* **No fetch has a timeout** in studio.html or vote.html — a stalled request wedges the Studio behind an
  overlay nothing dismisses.
* **The room can never see a paid play-it-again in Up next**, even when it is what playTop will start.
* **Free credits are minted per client-chosen fan id** — a private tab is a fresh allocation, and there is
  still no rate limit on `/api/vote`.
* **The city feed does not survive success** — 1,241 sequential blob reads at 1,500 artists (~33s vs a 10s
  timeout); 601 reads and 73MB egress for one 300-artist city.
* **Every audience poll costs 14–15 strong blob reads**, twelve of them all fan shards, read even before a
  show is live.

Full detail, all 25 findings and 12 verdicts on yesterday's unverified claims: **`AUDIT-2026-09-02.md`**.

### Resuming the other twelve auditors

`Workflow({scriptPath: "<session>/scratchpad/audit2.js", resumeFromRunId: "wf_253c2b51-35f"})` — completed
agents replay from cache. The sandbox and headless-Chrome instrument are at **`_tmp_audit/`** (gitignored,
and deliberately inside the repo: an earlier copy under `/private/tmp` was erased mid-run by tmp cleanup).
`_tmp_audit/harness/README.md` is the auditor briefing.

---

## SESSION 16 — 2026-09-02 (evening): finality, Connect, the tick, and feedback — ALL LIVE

Merge `39eeba3` is live on myset.vip. **496 assertions**, zero failures. Everything
below was built on `feat/voting-sheet-and-verification`, reviewed by five
independent agents, fixed, then merged.

### Live now

* **The vote sheet.** Tapping a song opens a sheet that asks HOW MANY votes to cast
  and states the rules, then Confirm. `fan.v` holds one entry PER VOTE.
* **Votes are FINAL** (`voteFinal` defaults ON in `_flags.mjs` — in CODE, so what
  production does is visible in the diff; `flagSet` still turns it off globally or
  per artist). Every cast carries a **cast id**, because the un-vote toggle WAS the
  idempotency mechanism (INVARIANT 15h). Narrowing the set or hiding a song now
  **releases the votes automatically** (`releaseUnvotable`, INVARIANT 15j) — the
  toggle used to be the escape hatch for that stranded credit.
* **"Enjoying MySet?"** — audience feedback, 5 stars + optional note, after an hour
  of VISIBLE use, at most weekly, never over a sheet or mid-vote, enforced
  server-side too. Artist reads it in the Studio Money tab (INVARIANT 15k).
* **Stripe Connect, DIRECT charges**, 10% free / 2% Plus / 0% Pro
  (`PLANS[*].cut`, INVARIANT 0r0). Onboarding is Stripe-hosted Express. Perry's own
  account still charges on the platform account and is unaffected.
* **The verification tick is premium and not for sale.** Venues: Pro + domain + site
  names venue + **3** artist vouches (was 5), shown as 5 visible steps. Artists:
  paid plan + Connect ready + photo ID + Perry's approval, ID stored where
  `img.mjs` refuses to serve it and **deleted on decision** (INVARIANT 0bk).
* **A studio passcode that opens the right Studio** (slug + code, with a lockout).

### ⚠️ READ THIS BEFORE THE NEXT GIG

`REVIEW-2026-09-02-REMAINING.md` has 22 open findings, ordered. The ones that matter:

1. **The ARTIST verification tick has NO UI.** Endpoints and tests exist; nothing in
   `public/` calls `verifyStatus` / `idUpload` / `idQueue` / `idApprove`. An artist
   cannot ask for it and Perry cannot review one. Same for a `voteFinal` switch —
   flag changes need hand-made HTTP.
2. **`redeemSession` claims before it delivers.** No marker separates "claimed" from
   "delivered", so a lost grant write means money taken, nothing delivered, and all
   three recovery paths answering `already: true`. This is the old C004 and it is
   still real — the last live piece of the 2026-08-30 failure.
3. **At 320px the vote sheet pushes Confirm below the fold.** Make the action block a
   sticky footer inside the sheet.
4. **`payStart` sends no country**, so a connected account is created in the
   platform's country — and that is immutable. Ask for it before an artist outside
   the US onboards.

### Tooling

* `_tmp_audit/harness/` — full-stack sandbox (real functions, in-memory store,
  seeded). `./start.sh PORT --seed`. `_tmp_audit/chrome/shot.mjs` drives real pages.
* `test/stripe-fake.mjs` — stubs `stripe` via the same hook that stubs Blobs, and
  records the OPTIONS of every call, which is how a direct charge is proved direct.
* `_tmp_audit/budget.py` — meters the 5-hour window. **My weighted formula
  overestimates**: Perry's own usage panel read 62% when it said 26M. Trust the panel.

### SESSION 16b — the review's open list (live in `da9b10c`, 561 assertions)

All four priorities done, plus 15 of the 22. **INVARIANTS 7b, 7c, 0bm, 0bn.**

* **7b — claimed is not delivered.** `redeemSession` claims with `delivered:false`,
  the sweep treats an undelivered marker as outstanding, and the grant is idempotent
  per (fan, session) via `me.gr` — without which the retry that fixes losing votes
  would mint them. `test/delivery.mjs` reproduces the lost write with a store that
  acks and drops (`__failWrites` in `blobs-fake.mjs` — reusable).
* **7c — the Connect country is asked for**, validated against `PAYOUT_COUNTRIES`,
  because an Express account's country is immutable and slicing a NAME to two
  letters makes Germany "GE".
* **The 320px sheet fold** — actions are a sticky footer; measured both on screen.
* **The artist tick has UI** — checklist + ID upload in Settings, owner review
  queue, and a real `voteFinal` switch.

**Still open:** nothing renders the tick on a public artist page; the venue Pro plan
has no self-serve route (owner sets it by hand); `PAYOUT_COUNTRIES` is 22 countries,
not Stripe's full set. See `REVIEW-2026-09-02-REMAINING.md` § "Still open".

---

## Addendum — 2026-09-03 · Content engine + Instagram launch

**New sibling project: `~/Docs/MySet-Content/`** (own git repo, 1 commit).

Deliberately **outside** `~/Docs/MySet` — that repo is production, `main` is
live, and another session edits it concurrently. Content work must not be able
to reach it.

### What it is
A design-to-publish pipeline for MySet's Instagram, plus its first payload:
**28 posts** covering four weeks (2026-09-08 → 2026-10-05), all static images
and carousels. 45 images rendered. **None approved, none published.**

```
plan/calendar.mjs → plan/posts/*.json → out/media/*.jpg → review gate → Instagram
npm run plan / render / review / publish -- --dry-run
```

### Key decisions
- **Design tokens are lifted from the live app** (`public/app.css` design system
  v2) into `brand/tokens.json`, injected as CSS custom properties at render
  time. Templates cannot declare their own colours. The app stays upstream.
- The `--ms-k` provenance fingerprint was **deliberately not copied** — it is
  registered in `FINGERPRINTS.md` for the app, and duplicating it elsewhere
  would weaken it as evidence.
- Posts are **pure designed graphics** (Perry's call). This satisfies Strategy
  v3 §7.4's "never a bare graphic" rule because §7.4 explicitly lists *the
  MySet tally* as a qualifying live-performance signal — so the tally is the
  hero visual, not decoration.
- Funnel mix follows **Stage A weighting** (§7.3): 11 Attract, 9 Journey,
  4 Expert, 4 Nurture, 0 hard Convert.

### The evidence rule is enforced in code
Every post carries `evidence: verified | opinion | confirm`. The publisher
**refuses** to publish anything still marked `confirm`. This exists because the
landing page previously shipped fabricated proof stats. The only hard numbers
MySet owns: **one gig 2026-08-30, 8 voters, 21 votes, one $3 purchase.**

### Instagram API facts (verified 2026-09-03, not from memory)
- *Instagram API with Instagram Login* means **no Facebook Page is required** —
  a Business/Creator account authenticates directly.
- **JPEG only.** PNG is rejected outright.
- Feed ratio must be between 4:5 and 1.91:1 → we render 1080×1350.
- **Carousels cap at 10 slides via API** (20 is app-only).
- 100 API posts / 24h; a carousel counts as 1. Free.
- Images must be at a **public URL** — Instagram fetches server-side.
- No reliable alt-text field on publish; alt is stored in JSON but must be
  added by hand in-app.

### Blocked on Perry (cannot be done for him)
1. **Create the Instagram account** — does not exist yet. Handle shortlist,
   bio and a rendered avatar (`out/avatar.jpg`) are in `docs/SETUP-INSTAGRAM.md`.
2. Switch it to a Business/Creator account.
3. Create the Meta app, grant `instagram_business_basic` +
   `instagram_business_content_publish`, generate a long-lived token.
4. Deploy `out/media/` to its own Netlify site for `MEDIA_BASE_URL`.
5. **Approve posts** in the review sheet (`npm run review`, localhost:8799).

### Open question flagged to Perry
Strategy v3 §10.1 argues the correct order is Artists → Gigs → Footage →
Content, and warns against launching a calendar first. A brand-foundation
fortnight is compatible with that (it is the §10.5 "ten assets in the bank"
preflight), but the 28 posts do **not** substitute for the outbound
recruitment sprint in §10.2. Both need to run.

> SSD mirror **not updated** — `/Volumes/IDYLL SSD 1` was not mounted on
> 2026-09-03. Mirror `~/Docs/MySet-Content/` when it is next connected.

### Addendum 2 — 2026-09-03 (later) · Reels pipeline + REEL 01

**Reels are now first-class in `~/Docs/MySet-Content`** (commit `4fcb512`).

- **No ffmpeg, no Homebrew on this Mac.** Solved natively: `reels/encode.swift`
  is an AVFoundation frame-sequence → H.264 MP4 encoder, compiled once with
  Xcode's `swiftc` to `reels/bin/encode`. Nothing downloaded.
- **Animation is a pure function of time.** Each reel template exposes
  `window.__seek(seconds)`; `reels/render.mjs` steps it at 30fps, screenshots
  every frame at 2×, the encoder downsamples to 1080×1920. Deterministic, no
  CSS animation, nothing ever caught mid-transition. `REEL_DEBUG_T=1.45`
  dumps one still for inspection. ~15s per 6s reel.
- **REEL 01 — The Lead Change** (`lead-change.mjs`): 6s. Votes tick in, #2
  ties then overtakes #1 with an ease-out-back row swap, leader glow
  transfers, headline "The room changed its mind." rises. Stable sort keeps an
  incumbent on top during a tie. Scheduled 2026-09-13 as post 29 (draft).
- Publisher handles `format:'reel'` via `media_type=REELS` + `cover_url`,
  polling the container up to ~150s. Review sheet shows reels with a player.
- Output lands in `out/media/reels/` so one Netlify deploy of `out/media`
  covers images and video.

**Seven reel concepts brainstormed, one built.** Remaining six, in priority
order: The Room Lights Up (3s loop, crowd-as-dots), Scan → Vote → Move (12s
mechanism), Stage & Room (10s, geometric performer + crowd figures), Save The
Gig — Live (12s franchise), The Second Setlist (3s loop), The 9:40 Dip (10s
energy curve). Each is one new file in `reels/templates/`.

**Traps hit this pass, all real:** the identical `.row>*` specificity bug from
the static tally (name children explicitly); a backtick inside a CSS comment
inside a JS template literal; Chrome refusing `file://` media from an
`about:blank` page (navigate to the MP4 URL itself); the +1 chip clipped by
the row's `overflow:hidden` (clip bars in their own layer).

**Open:** no audio track. IG has accepted silent video via API historically;
if a REELS container ever errors on it, add a silent AAC track in the Swift
encoder. Not blocking.

### Addendum 3 — 2026-09-03 (evening) · Three more reel templates, nine reel posts

**Built in `~/Docs/MySet-Content` (this session):** the three lowest-effort
reels from `docs/REELS-PLAN.md`, plus the shared infrastructure the plan asked
for before any second reel.

- **Calendar is now reel-aware.** A post with `format:'reel'` names a template
  in `reels/templates/` and the reel renderer reads `plan/posts/*.json` like
  the static one does. Templates read the post's own slide, so copy is
  authored once. Media names derive from the post id
  (`<id>.mp4`, `<id>-cover.jpg`). The calendar **throws** if two posts share
  a date — the 09-13 collision from the plan's §0 can't recur.
- **§0 fixes applied:** REEL 01 moved to 2026-09-20; the duplicate static
  `queue-lead-change` deleted. 28 posts again: 19 static (36 images) + 9 reels.
- **`reels/lib/motion.mjs`** (clamp/lerp/seg/outCubic/inOutCubic/outBack/
  outExpo/stagger/periodic/hash/mix — real exports + a serialised `MOTION_JS`
  for the page) and **`reels/lib/chrome.mjs`** (9:16 shell, kicker, foot,
  glow variants, `.grad` ground, `ambient(t, period)`).
- **Loop verifier:** `meta.loop = true` → renderer screenshots t=0 and
  t=duration, compares pixels in-page (canvas, no image lib), prints
  mean/max diff, exits 2 on a seam. All eight loops: 0.000.
- **`kinetic`** (4s, ×4 gradient statements): lines land with outBack(1.15)
  at 0.15s stagger, white hairline wipes under the last line then retracts,
  lines lift away; ground gradient drifts on a sine with period = duration.
- **`one-has-to-go`** (6s, ×3 polls): pink scan band 0.35–1.55s locks cards
  with STAYS/GOES chips; the `reel.data.gone` card blurs 16px, drifts 48px,
  fades, and sheds 30 hashed particles; survivors re-centre with
  outBack(1.25); rewind 5.0–5.75 via a `keep` factor so frame 0 = frame N.
  Gone picks (one-number edits): Wonderwall / the 70s / Getting paid late.
- **`second-setlist`** (6s, ×1): everything derives from a master phase u(t)
  that runs 0→1 (1.2–2.7s) and back (5.15–5.85s). Played rows animate
  height/font/opacity 124→70px; wanted rows rise staggered, bars cap at 76%
  of row width so the leading edge never cuts through a vote number.
- **`--stills 0.6,2.3`** flag renders stills only (fast QA, no video).
- **Trap:** after `verify()` navigates a page to a `file://` MP4,
  `setContent()` on that page never fires `load` → 30s timeout. One fresh
  page per reel fixes it.
- **Trap:** the review server started via the Browser pane keeps the
  post list and routes from launch; restart it after changing `serve.mjs`
  or it 404s new media while looking alive.

**Next reels per plan §4:** 08 Save The Gig (franchise, 4 posts) → 05
Prediction vs Room ★ → 07 The 9:40 Dip → 12 → 02 → 09 → 03 → 11.
`lead-change.mjs` still carries its own chrome; fold it into
`reels/lib/chrome.mjs` when next touched.

> SSD mirror still **not updated** — `/Volumes/IDYLL SSD 1` not mounted.

**Independent review pass (3 reviewer agents, one per template, ~10 min):**
no blockers; every "should-fix" applied and re-rendered — kinetic underline
now anchored to the type baseline (constant gap with or without descenders),
gradient-ground kicker/handle raised to .95/.9 alpha (was 2.3:1 contrast; the
same fix went into `brand/brand.css` so static grad cards match), kinetic
duration now follows line count (`durationFor(post)`, 4.0–4.2s); second
setlist's two kickers no longer dissolve on top of each other (sequential
with a dead gap + 14px slide), the phase-1 label sits with its list, the
"Example" note is 30px `--muted` and fades in with the pink rows; One Has To
Go's doomed card is now identical to the others at rest (badge/border only
turn pink as it locks), fade and blur move together, the scan band has soft
masked ends and a shorter run-out, particles sit beneath the cards and drift
down when the last card is the one that goes. Deferred nits: templates still
hold a few rgba literals (add `--accent-rgb` to tokens when convenient).

---

### SESSION 17 — 2026-09-03: the Google Sheet, greyed-out premium, pull-to-refresh

Three things Perry asked for in one message, plus two real bugs found on the way.
**766 assertions across 17 suites, 0 failures.** Read `INVARIANTS.md` 0bp–0cg
before touching any of it — every one of those was discovered by being broken.

**1 · The Google Sheet** (`GOOGLE-SHEET-SETUP.md` is the file to open)

New: `netlify/functions/_sheets.mjs` (service-account JWT + Sheets API v4),
`_warehouse.mjs` (what goes in the nine tabs), `sheetcron.mjs` (03:20 UTC nightly),
owner-only `sheetStatus` / `sheetSync`, a Studio card in Settings, `test/sheets.mjs`.

Nine tabs. **Snapshots** rewritten each sync: Artists, Songs, Gigs, Venues.
**Logs** appended only: Shows, Requests, Ratings. **Growth**: one row per sync, the
tab to chart. **Guide**: written once, in plain words, for Perry.

* It is a copy — nothing in MySet reads it (0bp). Off until three env vars exist,
  and off is a clean no-op with a reason (0bq).
* **Watermarks move only after a successful write** (0bs). A test kills Google
  mid-sync and asserts the row it was carrying survives.
* No Stripe call, no `list()`, no audience device id, nothing on a hot path.
  `archiveShow` deliberately untouched (0bt, 0bu).
* Formula-shaped text is escaped — `=1+1` is a real song title (0bv).
* **UNVERIFIED:** the cron has never fired. Verified: the manual button, end to
  end, against a stubbed Google with a real RS256-signed JWT. If the schedule turns
  out not to work, the button still does everything.
* Also added: first-touch signup source (`?src=`/`?utm_source=`/referring host),
  stashed on the first visit and read after the email round-trip. The same fix
  rescues `?ref=`, which used to be silently lost when the URL came back clean.

**2 · Premium features shown greyed out, not hidden**

`public/lock.css` (linked by both Studios, and by nothing else) plus a matching
`has()` / `needsPlan()` / `lock()` trio in each. Two states: **"Plus/Pro feature"**
(built, tappable, scrolls to the plans) and **"Coming soon"** (designed and not
built — greyed on every plan including Pro, not tappable).

Locked in the Artist Studio: free-vote count, replay cost, pack prices, request
cost, new setlist. Previewed as coming: analytics (Money), promote (Gigs), press
kit + branding (Profile). Venue Studio: photo slots 4–12, a plan box, and reviews /
tips / speaker-votes previews.

Three traps this walked into, all now invariants:

* **`app.css` was the wrong file.** Neither Studio loads it, and the Studios are
  the only pages with a lock — so the first version shipped rules that reached
  nothing. Caught by measuring computed styles in a browser (0cb).
* **A numeric limit is not a yes/no** — `photos` is 3 or 12, so `=== true` was
  false and Pro showed a dash beside twelve slots it had (0ca).
* **The Studios are unconditionally dark**, so a `prefers-color-scheme` veil
  washed out a black page (0cc).

Server side: the venue photo cap (3/12) is now actually enforced — it had lived in
`VENUE_PLANS` and nowhere in the code since venues shipped.

**3 · Pull to refresh** — `public/pull.js`, one implementation, seven pages

`vote.html`'s own copy is deleted, not left beside it. Only arms within 2px of the
top, all listeners passive, browser's own gesture deliberately not suppressed, and
loaded **blocking not deferred** (0cd–0cf). Plus, in Settings → "If something looks
wrong": a plain reload, and `hardReset()`, which finally sends `sw.js` the
`myset-unregister` message it has listened for since it shipped.

**Two bugs found on the way, both fixed:**

* **VAPID keys.** `getPrivateKey()` strips leading zeroes, so ~1 key in 256 was 31
  bytes — an invalid JWK scalar (RFC 7518 6.2.2.1). The assertion had passed a
  hundred times and failed once. `pad32` on both sides; the test now makes 600 keys
  so the flake is deterministic (0cg).
* **Widening `SLOTS` broke its neighbour.** `p0..p2` had been doubling as the
  artist's photo cap, so making room for venue Pro let an artist store nine images
  no page renders. Artist cap is now `MAX_PHOTOS` in `_profile.mjs` (0bz).

**The independent review earned its keep.** A fresh-context agent reviewed the
diff and found **six real bugs the 138 tests had passed straight over**, because
those tests asserted row *counts* and never row *values*. All six are fixed, all
six now have a regression test, and every one is written up in `INVARIANTS.md`:

* **The Songs tab zeroed itself every night.** Snapshot tab, counts built only
  from shows that were new since last time — so the morning after a gig it read
  "played 1, votes 12" and the next sync rewrote it as "played 0, votes 0", under
  a column headed "Votes all time". Now an accumulator keyed by SHOW (0bs2), which
  also fixes ending a show twice counting the night twice.
* **Nights past the 40-per-artist cap were lost, not deferred.** The index is
  newest-first, so taking the first forty took the NEWEST forty and moved the
  watermark past everything older. Reproduced with 45 nights: five gone for good,
  while three separate comments promised "the rest come next sync". Oldest-first
  now (0bw).
* **The 5,000-row trim dropped rows behind the watermark, silently.** The run now
  stops taking artists instead of trimming at the end.
* **A failure on the last tab duplicated the first tab's rows.** Marks commit per
  tab now, right after that tab's own append (0bs).
* **A venue on Pro could upload photos 4–12 and have them thrown away** by
  `normVenue`'s `.slice(0, 3)` — the mirror image of the artist bug I had just
  fixed, and worse, because it looked like it worked (0bz).
* **The plan cards still sold the four unbuilt Pro features as included** — the
  one page where somebody decides to spend $20 (0bx0).

Plus: `unlimited` has no plan gate, so greying it took a working control off free
artists; `has()` treated an unknown plan as allowed, so the first render of
Settings was fully live; photo slots were being compacted so clearing one moved
another; `cleanSource` mangled a pasted URL instead of rejecting it; the
`test/cost.mjs` globals guard didn't know about `sheetsync`; and `syncSheet` had
no lock, so the cron and the button could both append. **854 assertions, 0
failures.**

**Still open** (unchanged from Session 16b, plus): the pitch deck was never built;
nothing renders the tick on a public artist page; venue Pro has no self-serve
billing; `PAYOUT_COUNTRIES` is 22 countries. And the four artist / three venue
"coming soon" features are exactly that — designed, not built.

## SESSION LOG — 2026-09-04 (new account: the product batch)

Perry's list, all shipped in one push (his decisions inline):

* **The tick on the public artist page** — `profile.mjs` exposes `verified` AND-gated
  on a paid plan (0bn's artist half, read side); `artist.html` renders the venue's
  green chip, with a dark override both pages now share.
* **Menu icon** top-right on artist and venue pages → Artist Studio / Venue Studio;
  whether you have one is read from this phone's token, never asked of the server.
* **"Audience" → "Fans"** everywhere a stranger reads (`test/copy.mjs` pins it).
  The Community button sits in the artist page's stats grid, sixth cell.
* **The community page** (`community.html`, `/api/community`, `_community.mjs`):
  500-char posts, stars, the night from history, three photos, video links, hearts,
  reports, owner reply/pin/hide/delete. Free on every plan. Limits inside the CAS.
* **Merch** on the profile record: a Plus feature for artists (Stripe direct charge,
  pickup or posted, orders in the Money and Merch tabs, buyer details fetched from
  Stripe and never stored); Pro for venues, link-only (no venue Connect). `reviews`
  left VENUE_NOT_BUILT and is free on both venue rows.
* **Shows start and end themselves** — `_lifecycle.mjs` (start/end extracted out of
  admin.mjs's switch, one implementation), `_auto.mjs` (decides), `autocron.mjs`
  (every two minutes, one read when idle, `gigsched` index). Empty nights are no
  longer archived. INVARIANT 0o rewritten at Perry's direction.
* **The Voting box** at the top of the Live tab only, orange ring, big orange word,
  orange "on" half; header and Settings copies removed.
* **Boot**: planGet runs beside /stage; the owner's two lists are off the critical
  path and quiet; drawPush is not awaited; `@keyframes bb` finally defined so the
  boot bars animate; `--accent-ink` defined.
* **Housekeeping**: the false "two failures" story removed from every doc and memory
  (see 2026-09-04 correction above); fuzzy icons removed at Perry's request and every
  reference repointed at the 512s; content engine pushed to a private GitHub repo.

1,059 assertions across 22 suites. Not built, said in the UI: venue checkout, video
uploads, a per-gig opt-out of scheduled starts. Perry to set `AUTH_FROM` once the
myset.vip domain is verified in Resend.

## SESSION LOG — 2026-09-04, pass two (plans, billing, accounts, venue Connect)

Same session as the product batch above. Commit `6fae274`, pushed to `main` 23:44 and verified live by content 20 s later (both Studios carry the new sheet; unauthenticated `planCheckout` / `payStatus` answer 401, not 500). Record of the work:
`docs/sessions/2026-09-04-product-batch.md` (pass two section); design: `ACCOUNTS.md`;
rules: INVARIANTS 0cr–0da.

* **Top right of both Studios:** `Upgrade ↗` (orange outline) on free; a green tag
  with the plan's name and the same arrow when paid. Both open the plan sheet.
* **The plan sheet:** every tier in an orange-bordered box, name + price bold white
  on an orange banner, a numbered list of *everything* in the tier (never "everything
  in Plus"), "Transaction fee: N%" in orange, a placeholder testimonials carousel
  (the array is the architecture). Three tiers for artists, two for venues.
* **Settings → Your plan:** one big green button ("Upgrade your plan" / "Pro
  membership") and a "Card, invoices and receipts ↗" portal link when subscribed.
* **Leaving Pro:** "Are you sure you want to lose your Pro membership benefits?" (No
  in orange, Yes greyed) → "We're sad to see you go… 50% off for 1 more month?" →
  a Stripe coupon on the live subscription, once ever, server-enforced.
* **Billing** (`_billing.mjs`): Stripe Billing subscriptions on the platform
  account, prices by lookup key created on first use, customer per owner, Checkout
  in subscription mode, Customer Portal, webhooks + return-trip + 6-hour sync.
  `planUntil` = period end + 3 days' grace.
* **Accounts** (`_account.mjs`): export everything (never a fan's device id);
  delete everything from ONE enumerated key list (`keysFor`), owner-only, typed
  `DELETE`, founder refused. The billing suite asserts no key still carries a
  deleted artist's id.
* **Venues get paid:** Stripe Connect keyed `v_<vid>`; "Getting paid" card + orders
  on the Venue Studio's Merch tab; venue merch checkout is a direct charge on the
  venue's account; `?connect=done` / `?sub=done` handled on `/venues`.
* **The fee split** (Perry's rule): for plan rows with `splitFee` (both venue rows)
  the application fee is the cut minus half of Stripe's estimated card fee, floored
  at zero. Artists are not split. Written into the Studio copy and INVARIANT 0cx.
* **Perry, once, in Stripe:** add `customer.subscription.updated/deleted` and
  `invoice.payment_failed` to the webhook; save the Customer Portal's default
  configuration in live mode.

1,123 assertions across 22 suites. Headless-Chrome renders of every new sheet and
both headers in both states against `netlify dev --offline` (needs
`ADMIN_CODE=devlocal` or the owner code is refused). Not built, written down in
`ACCOUNTS.md` §6: change-my-email, exact fee split by post-charge transfer, in-app
invoices, passkeys, "sign out everywhere", venue members, dunning banner.

---

## SESSION LOG — 2026-09-05, pass three: an account somebody can own

Commit **`931d18d`**, live at myset.vip and verified by content ~45s after the push.
Full narrative in `docs/sessions/2026-09-05-account-system.md`; the design is
`ACCOUNTS.md` §6–§9; the rules are INVARIANTS **0db–0dp**.

### The two holes this closed, and they were holes, not gaps

* **A member could take the account.** `add` / `remove` / `revokeAll` / `setSlug` in
  `auth.mjs` checked "are you signed in" and nothing else, though `verifyToken` has
  always returned the role. A member on a five-seat Pro page could delete the
  OWNER's sign-in address, or rename the public page that every printed QR code
  points at. One POST each. `venueauth.mjs` / `venueadmin.mjs` were identical, and
  wrote a `staff` role that nothing anywhere read.
* **Sign out did not sign you out.** It cleared `localStorage`. The token is an HMAC
  with a thirty-day life, so a copy off a borrowed phone kept working for a month.

### Built

* **Sessions.** `email|exp|rev|sid`, parsed from the END so nothing inside an address
  can shift the fields (`normEmail` strips `|` too). Revocation is a normally-ABSENT
  `dead` map on the registry row the verifier already holds — zero extra reads and
  zero extra writes on every request, and no growth for an account that never
  revokes. Past 12 entries it bumps `rev`, which signs everything out: fails closed.
* **The list** (`sess_<owner>`) is cold, read only when the sessions screen opens.
  Device CLASS, never a raw User-Agent, never an IP. "Last opened Settings", written
  at most hourly from actions the Studio already calls — labelled honestly.
* **Roles** `owner` / `member` / `crew`, one table (`can()` in `_session.mjs`), one
  gate per endpoint. Unknown role → `crew`. Own-property lookup, because
  `CAN['toString']` is a truthy inherited Function with no `.has`.
* **Recovery codes.** Eight, one-time, Crockford-ish alphabet, hashed with the site
  secret, shown once. The door takes the PUBLIC page name plus a code and answers a
  wrong code, an unknown page and a lockout identically (9h). Using one bumps `rev`,
  mints a fresh session for that device, and emails everyone on the account.
* **Change my email.** Codes to BOTH inboxes; a notice to the old address at REQUEST
  time; the swap and the session kill in one `mutateArtists`; only the moved
  address's devices die; one change a day.
* **Activity log** `log_<owner>`, 100 entries, best-effort — logging must never be
  why a musician cannot start a show.
* **Soft delete, thirty days, NOT ONE DOCUMENT MOVES.** Two screens plus the typed
  word. Day one: page dark (`publicArtist` / `venueBySlug` refuse a marked row →
  every public endpoint 404s at once), billing cancelled, calendar un-indexed.
  Sessions are NOT killed — soft delete locks the account DOWN, never the owner OUT.
  Everything but undo/export/plan/portal answers **423**. The slug is HELD (it is
  printed on bar tables) with a deliberate "free it now" link. Purge is one account
  per cron ring on an hourly watermark, `delqueue` entry removed LAST so it is
  re-runnable. `deleteArtist` is unchanged — it stopped being the button and became
  the calendar.
* **Venues** get all of it, keyed `v_<vid>`, on a new `keysForVenue()` in
  `_venueaccount.mjs` — until now a venue could sign up, take money and pay for Pro
  and had no way to take its data or leave.
* **A renamed page keeps answering at its old address** (`oldSlug`), because the QR
  code on the table outlives the rename.

### Perry's missing shows — and it was NOT the legacy keys

The stranded `hist_2026-08-30-1855` is a 151-second night with nothing in it, which
today's archive would refuse anyway. The real cause is in the data: `2026-08-30-1928`
started 30 Aug and ended **4 Sept**, and Perry has six weekly recurring gigs. Two
lines did it — `autoTick`'s start branch answered a flat `already live`, and `sweep`
re-pointed a deferred end at the NEXT gig, so tonight was never due again. Five
nights at five venues were appended to one show. **Nothing was lost by the archive;
the nights were never separate, and no code can separate them now.**

Nine more loss paths closed: `moneyForShow`'s Stripe setup sat OUTSIDE its own try
(a payments hiccup threw past `archiveShow` into an empty catch and the gig vanished
silently); the index row was rebuilt from the NEW snapshot even when the detail kept
the richer one (13 songs on the page, 5 in the row); `.catch(() => {})` on both
writes; the `status === 'pre'` guard; the 100-row cap that hid nights from export
AND delete (now 400 plus append-only `histids_`); `history.mjs` hiding the row unless
status was exactly `ended`; an unbounded Stripe window when `startedAt` was null;
`unattributed` missing from the row; and a browser `HIST` cache nothing ever cleared.
`healHistory` + a "Look for missing shows" button rebuild from every id that can be
NAMED, and obey the same "nothing happened is not a night" rule the archive does.

### Also

Plan sheet 2–3px up with `[bold thing, plain description]`; the Settings plan button
in the same soft green as the tag above it with the date beneath and a line that is
never blank (a comped account has no Stripe customer, which is exactly why Perry
could not find the receipts link); invoices; a three-state card-failed banner
(suppressed on stage, INVARIANT 16); `unpaid` added to the already-subscribed
refusal — without it a failing card could create TWO live subscriptions; `?billing=back`
so a fixed card is not still reported as failed for six hours; the exact fee split
(`_feesplit.mjs`, `charge.updated`, fee refund not transfer, honest that it floors to
zero under ~$29); the venue sheet that stuck because `closeSheet` never cleared its
own drag transform and `attachDrag` re-bound listeners on every open; pull-to-refresh
standing down behind a sheet; and no white page anywhere while something loads.

**Passkeys are designed and NOT built** (`ACCOUNTS.md` §9): the win is speed rather
than security, and they cannot be verified without a device in hand.

### Perry, once, in Stripe

1. `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
2. Customer Portal → save the default configuration **in live mode**
3. **New:** `charge.updated` — turns on the exact fee split. Without it the estimate
   stands and nothing breaks.

**1,233 assertions across 23 suites.** New suite `test/accounts.mjs`. Every new screen
rendered in headless Chrome at phone size and read back; the venue sheet bug was
reproduced and then proved fixed. Production read with `tools/prod.py` before
anything was changed.

---

# SESSION LOG — 2026-09-05 (clips, the books, passkeys, the cost audit, a security pass)

Round four of Perry's list. Full detail in
`docs/sessions/2026-09-05-clips-books-passkeys-cost-audit.md`.

## What shipped

**1. Clips on community posts.** Thirty seconds, re-encoded on the phone to 480p,
capped at 3MB by the server. `_video.mjs` + `vid.mjs` (**with HTTP Range support** —
iOS Safari refuses a 200 for a video), `action:'clip'` uploads before the post
because a 6MB function body minus three photos leaves four watchable seconds. Poster
frame + `preload="none"` so the feed costs nothing until somebody taps. Orphans
swept by the cron from a `vidqueue` global, and the sweep reads the feed first so a
posted clip is never taken away. 44 assertions.

**2. The books (`_ledger.mjs`, `ACCOUNTING.md`).** Perry meant *accounting*, not
*accounts*. Stripe holds the transactions; MySet produces the statements. Every
figure comes from Stripe's **balance transactions** and is only bucketed, never
recomputed. Artists and venues get a twelve-month statement + CSV for tax; Perry
gets a real P&L with hand-entered costs. Monthly close: a finished month is computed
once and cached. Two traps pinned — Stripe's fee comes from `fee_details` not
`bt.fee`, and a payout is not an expense. 43 assertions.

**3. Passkeys (`_passkey.mjs`), no npm dependency.** Face ID instead of a code from
email. `test/passkeys.mjs` *acts as a real authenticator* — real P-256 keys, real
CBOR, real signatures — and defeats each of the five WebAuthn checks on purpose,
which is how this got verified without a physical device. ACCOUNTS.md §9 carries the
full "what would a real account system take" rundown Perry asked for, including why
passwords are strictly worse and why an identity provider is $2,000–5,000/mo at
scale. 30 assertions.

**4. The server-cost audit.** `tools/loadsim.py` runs the real polling ladder.
Report: https://claude.ai/code/artifact/11ac87fe-57f6-439f-9459-99836b76e7f5
(also `docs/reports/2026-09-05-server-cost-audit.html`).

**5. Security (`SECURITY.md`).** A real CSP (`default-src 'self'` — it was
`frame-src` only, so an injected external script would have run), nosniff, HSTS
preload, Permissions-Policy, COOP, zero npm vulnerabilities, and a published
`security.txt`.

## The three numbers that matter

| | |
|---|---|
| **One 3-hour gig, 20 people** | **2.8¢**, and 5.6% of revenue at every scale |
| **Deploys vs gigs** | 104 deploys of mysetvip = 1,560 credits; every gig Perry played = 84 — **19×**. Across all five sites deploys were 2,475, **29×**. About 570 credits of that is the same change shipped twice |
| **Moving to Cloudflare** | would be **1.7× worse** — KV bills per read and MySet does 90,450 reads a gig. The platform is not the cost driver; **15 reads per poll** is |

## Perry's to-do

1. **Stripe:** add `charge.updated` to the webhook (carried over from 2026-09-04).
2. **Netlify:** stop the double deploy (CLI + the GitHub build the same push
   triggers), then move to Pro — $20/3,000 credits beats $9 + top-ups at the
   current 2,475/month.
3. **2FA** on Google, GitHub, Netlify and Stripe. Twenty minutes, and the
   highest-value item in SECURITY.md by a wide margin.
4. **Try the passkey** and say whether it is actually faster on stage.

## State

- **28 suites, 1,350 assertions, 0 failed.**
- New docs: `SECURITY.md`, `ACCOUNTING.md`, `docs/reports/`, `tools/loadsim.py`.
- INVARIANTS 0dq–0dw.

---

## 2026-09-04 — Batch 3 · 2nd Drafts: Perry's review and the Atlas critique applied

Repo: `~/Docs/MySet-Content` (the content engine, deliberately separate from the
product repo). Ten performer shorts, 10-06 → 10-15, rebuilt from two documents and
re-rendered from scratch. Commits **8498145** (the work) and **b851836** (recording that
hash in `plan/versions.json`, which is how a past round can be rebuilt). Nothing is
approved and nothing is published — the review gate is untouched.

### What Perry's review said

He watched the ten first drafts and gave five notes that apply to every reel. They are
now **rules 25–28** in `docs/RULES.md`.

1. **No pixel without a purpose.** *"There should never be a single pixel on the page
   that does not serve some kind of purpose in driving the overall message home."* The
   little eyebrow tags at the top of every frame — *Playing to a room*, *Read the room*,
   *Getting paid* — were our own internal filing labels shown to the viewer. They are
   gone from all ten reels, and from seven of the ten companion still cards (the other
   three are listed under unrequested changes below). That slot is now
   a **secondary headline**: an open question, a stake, or the line that kills the
   objection (*No app. No account.*). Six words at most, at most one per beat, and not
   on every beat — silence is a choice too.
2. **Emphasise the decisive words.** Key words are now italic and in the accent colour.
   His own picks were used exactly and nowhere else. His note in capitals matters as
   much as the picks: *"I did not choose too many words — everything is emphasised,
   nothing is emphasised."* One phrase in most lines; several lines carry none.
3. **One MySet character.** *"Get rid of this stick figure with a strange bar attached
   to its waist and a 3rd leg like a tripod… create a simple yet unique, cute,
   recognisable character."* He is built once, called **Bo**: a round head with the
   three bars growing out of his crown as his hair, so the logo and the character teach
   each other. He replaces every person in every reel that draws one.
4. **Money looks like money, and example numbers are allowed.** A tip jar with TIPS
   written on it, one sad coin crying inside it when it is empty, coins and bills with
   happy faces when it fills, dollar signs floating inside a fill and vanishing as it
   drains. And: *"please greatly reduce your strictness on only using real numbers —
   I'll tell you if anything is out of line."* Realistic example figures (270 votes ·
   45 people · $90 earned) may now sit on screen, as long as nothing frames them as
   MySet's own result or ties them to the one real gig.
5. **Leave everything else alone.** He praised most of the pictures. The only visuals
   changed are the ones a truth rule or a labelling rule forced.

He also gave per-reel notes, all applied: **reel 7** — a real tip jar instead of what
looked like an empty whiskey glass, dollar signs inside the fee bar, the same jar in
three scenes, happy money in the final fill; **reel 8** — more space under the second
half of the opening line, dollar signs in the two pay meters, scene 2 redrawn as the
literal situation (the room going wild, the flat fee not moving) because *"I don't
understand the animation in scene 2"*, dollar signs in the delivered part of the graph,
the same character on both stages; **reel 9** — the word *request* on every flying
interruption, the character losing balance with each hit and back on his feet rocking
out when MySet rebuilds the path, a clock reading 7pm · 8pm · 9pm · 10pm instead of a
stopwatch; **reel 10** — the three form boxes moved up under the headline and sliding
down as the numbers appear, with 270 votes · 45 people · $90 earned on screen.

### What the outside critique added

`docs/critiques/2026-09-04-03-atlas-on-the-eleven-scripts.txt`. Its verdict: *"a good
creative director's treatment contaminated by some very bad marketing claims."* It gave
four corrections and four commands, and both are now doctrine (**rules 19–24**).

- **It still mistakes metaphor for clarity.** Question marks drifting like smoke,
  snapping threads, wallpaper waveforms, closed-loop circuits, a coupling pipe. *"Clever
  visualisation creates the same cognitive-load problem as clever copy."*
- **The whole document was DJ-coded** — decks, BPM, cue, tracks, "the floor". *"Claude
  accidentally narrowed your market through its art direction."* The customer is a
  singer or guitarist with a mic, a stage, a phone and a crowd.
- **"One scene per beat, no exceptions" was wrong.** PEACE is the reasoning under the
  video, not the edit. Every beat must be communicated; no beat is owed its own scene.
- **No product-truth audit had been done.** Six of the eleven source chains carried
  claims the product cannot back, and the scripts had simply made them prettier.

Its four commands are now run **before a single visual is revised**: product truth,
avatar, clarity, causality. And the instruction that governs all four: *"preserve the
best visual ideas; rewrite the claims, not the aesthetics."* So the praised pictures
stayed and the claims came out — the floor-occupancy graph, the interruption counter,
the energy-to-earnings coupling, "the next song is already chosen", "one vote each",
"every single night", "requests ranked by the room itself", "who showed up for you".

### The ten reels, one line each

| Reel | What changed |
|---|---|
| **10-06 guess-vs-vote** (22.5s) | Eyebrow tag gone, three secondary headlines added, his four emphasis picks applied; the artist's choice is now drawn as a real tap on their own Start button. No person is drawn — flagged for him. |
| **10-07 watching-to-playing** (26.3s) | Tag gone from the reel *and* the still; the Answer beat now shows a literal vote landing — twenty people raise a phone instead of all 120, and three named people's votes ride their own threads into the queue. |
| **10-08 one-vote-each** (26.0s) | The casting beat that drew "one vote each" and "the whole room votes" is gone (both are false); the list is labelled the app's own way; the loud song visibly lands fourth. |
| **10-09 paper-to-live** (26.6s) | The queue's starting order is now real data, so votes actually cause the re-rank; the app's own Start button proves "without losing control"; phones in the crowd give "No app. No account." something to point at. |
| **10-10 wallpaper-forward** (25.0s) | Bo replaces the stick figure and grows clearer as the room turns; the card is labelled with the app's real "Up next" and "Winning — plays next"; the fake countdown and dead-air flip are cut for a real overtake. |
| **10-11 already-chosen** (26.4s) | The two pictures that were claims — a floor graph and a five-nights montage — and the locked "already chosen" card are gone; the artist picks, and the payoff is the room enjoying the song, not more votes. |
| **10-12 tip-jar** (27.7s) | The Answer now says what MySet *is* before what else it can do; a real checkout step sits between the tap and the money; the jar, the coins and the bills come from the shared money kit and carry faces. |
| **10-13 flat-fee** (28.8s) | Scene 2 redrawn as the literal night; one constant now governs both money pictures so the reel cannot state two ratios; the strike no longer crosses the band labelled "Your fee". One word of Perry's own last line changed — see below. |
| **10-14 unbroken-ribbon** (27.6s) | The interruptions counter is cut (a counter asserts a count); twelve hits instead of four so the picture agrees with "every 4 minutes"; requests rise from phones instead of being caught mid-air. |
| **10-15 book-on-numbers** (26.8s) | "Prove" became "show a venue" (Past shows is a record, not a proof); the three field labels now say what MySet actually keeps; the forward calendar fill is one new night, not a run of bookings. |

### Unrequested changes — Perry's to veto

These were **not** asked for. Each was made for truth, clarity or a rule, and each is
cheap to undo. This is the list to read first.

**Across the batch.** Two lines Perry saw whole are now split in two (reel 2, at *when*
and at *not just*) — the words are untouched. Several captions were extended to carry an
honesty clause the screen dropped. The eyebrow tag was also taken off **seven of the ten
companion still cards** — gone entirely on 10-06, 10-07 and 10-12, replaced by the reel's
own secondary headline on 10-09, 10-10, 10-14 and 10-15 — which goes beyond the reels he
pointed at. Three stills still carry the old series label (10-08 and 10-11 *"Read the
room"*, 10-13 *"Getting paid"*), so the batch is currently inconsistent on that point and
needs one decision made once for all stills.

**10-06** — one phrase tightened in the alt text; the caption softened where the screen
keeps his line ("the crowd helps shape the set"); no person is drawn, and the natural
place for Bo would be beat 4 — his call.
**10-07** — the two splits above; runtime grew 23.4s → 26.3s; the Answer beat runs 5.2s,
over the 3.5–5s window; two new data fields (which three people vote first, and how many
raise a phone); at the flood every dot lights and at the end every dot carries a thread —
kept, because light means access and a thread means reach, not a vote.
**10-08** — the jagged mark now sits behind the song title rather than over it; neither
split lands on a true turn (both are his own words, flagged not changed); timings nudged
0.4s so the split gap fits the grammar; the caption carries a required honesty clause
about free votes.
**10-09** — the song list is now written in its pre-vote order (otherwise nothing ever
re-ranked); the app's Start button added; phones added to the crowd; "the club" became
"the hotel bar"; the Empathy and Change lines split; "in real time" became "while you're
playing"; the hook lost its emphasis mark; the still's kicker "Read the room" became
the reel's own "Written yesterday. Played tonight." 
**10-10** — line 2 reworded; the Change beat is *not* split (the earlier draft split a
three-item list at no turn); the "Playing next" label corrected to the app's real words;
a two-row panel instead of one; the countdown, dead air and flip cut; motion trails cut;
the crowd's totality capped so only about half ever lift a phone.
**10-11** — the Change line now ends on a full stop and the End Result opens capitalised;
the Empathy halves reversed and the whole script pulled 0.4s earlier; a third late vote
added; the played row physically travels into Now playing.
**10-12** — the Answer names voting before tipping; "lands in your own account" became
"tip you from the same screen"; "No app. No cash." became "No app. No account."; four
emphasis marks removed; the queue came back inside the phone; a checkout frame added;
the jar and character positions restated against the template's real boxes.
**10-13** — **one word of Perry's own closing line changed**: "a room on fire *means*
your pay is on fire too" → "*can pay like one*", because "means" asserts exactly the
energy-to-pay coupling the product cannot make. His imperative shape and the carry-on
survive. Also: one constant now drives both money pictures; SHOWED UP and its strike
moved off the fee band; the Empathy split moved to 2.5s; the Empathy secondary headline
and emphasis both moved; a real wallet replaces a character reading a chart; eight event
chips at the app's real prices summing to a labelled "+$80".
**10-14** — the interruptions counter cut outright; four hits became twelve; the crowd
dims once instead of stepping darker per hit; "As a performer," cut from line 1; the
Change line's absolute removed; the closing line rewritten (MySet cannot stop anyone
shouting, but it can let the room ask without stopping the song); the request songs
changed; a third request left unhandled at the end.
**10-15** — line 1 rewritten to his own soundbite wording; "prove" → "show a venue"; the
Answer reworded to what Past shows actually does; "We help you become" → "You will
become"; the closing line rewritten to carry on from the line above; all three field
labels changed; British spelling on screen ("favours"); beat 1 shortened 3.8s → 2.8s;
the End Result's calendar fill reduced to one new night.

### The doctrine that went in with it

- **`docs/LENS.md`** — what the seven strategy documents say when read together for this
  product: the hero and the one-liner, the problem stack, the guide's honest authority,
  the plan and the ask, PEACE as reasoning, the three buckets × four missions, the hook
  and the dopamine ladder, the four audits, why truth is structural, and how conflicts
  resolve (truth beats everything; Perry's rules beat the frameworks; the reading that
  lowers cognitive load wins; frameworks stay invisible).
- **`docs/CLAIMS.md`** — the product-truth ledger. What MySet can honestly say today,
  the table of things it may never say and what to say instead, and the app's real
  controls word for word so nothing on screen is invented.
- **Rules 19–28** in `docs/RULES.md` — product truth before a frame; the avatar is a
  working live musician; literal beats metaphor on screen too; causality; PEACE is the
  reasoning not the edit; the queue only where ranking is the mechanism; no pixel
  without a purpose; italic accent emphasis; one MySet character; money looks like money
  and demonstrative numbers are allowed.
- **The copy lint** (`reels/lib/copylint.mjs`) gained three checks that stop a render:
  **claims** (phrases the product cannot back — no allowance, they are false rather than
  rhetorical), **absolutes** (outcome guarantees, allowed per post only with the reason
  written beside them), and **avatar** (DJ words, unless a piece is deliberately for
  DJs). The **numbers** check no longer fails anything — it lists every figure on screen
  so the review sheet sees them, which is Perry's relaxation written into code.
- The strategy sources are filed in `docs/strategy/` and the three critiques in
  `docs/critiques/`.

### New shared code

- **`reels/lib/character.mjs`** — Bo. Fifteen flat shapes on six groups; every pose is a
  number rather than a drawing; three tones keep him legible; three orange pieces and no
  more; his crest is measured exactly like the logo (38 : 64 : 28) and doubles as his
  energy meter, so the logo does the emotional work. He is judged at 80px and as a 52px
  silhouette in `brand/character/review.jpg` (`node brand/character/build-review.mjs`).
- **`reels/lib/money.mjs`** — jars with TIPS on them, coins and bills with faces, and
  dollar signs that float inside a fill and vanish with it.
- **`reels/lib/script.mjs`** — extended with `sub` (the secondary headline, one per beat
  at most; a second one throws at build time) and `*word*` emphasis in italic accent ink.
- Review sheets kept on purpose: `reels/lib/_character-candidates/` (the round and bars
  explorations) and `reels/lib/_money-test.*`.

### Where the drafts are

`~/Docs/MySet Social Media/Videos/Batch 3/2nd Drafts/` — ten MP4s, a `Covers/` folder
and `ABOUT THIS DRAFT.txt` (which names commit 8498145). **Batch 3 · 1st Drafts is
untouched** — verified byte-for-byte before and after the export — as is every other
batch: the exporter writes exactly one folder and its delete is scoped to it. The same
folders are on the SSD, and the repo is mirrored to
`/Volumes/IDYLL SSD 1/Docs/MySet-Content/`.

### What to check first

1. The **flat-fee closing line** — one word of Perry's own writing changed, for a reason
   he should get to overrule.
2. The **unrequested list above**, reel by reel.
3. **Whether Bo should appear in the six reels that draw no person** (10-06, 10-07,
   10-08, 10-09, 10-11, 10-15). He is in the four that previously had the stick figure —
   10-10, 10-12, 10-13, 10-14. Adding him elsewhere is a composition change, not a data
   change: three of those six are seen from above or from the stage, where a figure has
   nowhere to stand, and in 10-07 the people are 18px crowd dots by design.
4. **Bo's crest at small sizes** on the wallpaper-forward sheet — at about 175px it is
   close to reading as a small crown rather than the three bars.
5. Two beats that run long against the shared timing grammar: watching-to-playing's
   Answer (5.2s) and guess-vs-vote's Change (about 3s).

### Still open

- **Nothing is approved.** None of the 38 posts carries an approval, and the publisher
  refuses anything that is not approved. Perry has to sit with `npm run review`.
- **A product honesty fix, not a content one:** the live tip sheet in
  `~/Docs/MySet/public/vote.html` (`openTip()`) says *"100% goes to <artist>"*. That
  contradicts the real split — MySet takes 10% on Free, 2% on Plus, 0% on Pro, and
  Stripe takes its own fee. The reel deliberately omits the sentence; the app may need
  the same fix.
- **One batch-2 reel fails the new avatar check**: `2026-09-14 · wedding-last-song` says
  "The floor's still full". The check did not exist when that reel was built and its MP4
  has already shipped, so it was left alone rather than silently reworded. The fix is one
  word ("The room's still full") plus a re-render.
- **Two rows crossing in the shared tally** briefly hide the row being overtaken (about
  0.15s). It affects every reel with a queue and needs one fix in `reels/lib/tally.mjs`.
- **The remote is behind.** `origin` is `github.com/perryidyll/myset-content.git` and it
  is several commits behind local `main`; nothing leaves this Mac until someone pushes or
  runs `npm run mirror`.
- **The stills are half-converted.** Rule 25 was written about the reels' eyebrow slot;
  seven of the ten companion still cards followed it anyway and three did not. Perry
  should say once whether the rule covers stills, and then all ten should match.
- **Housekeeping:** `reels/templates/the-dip.mjs` is no longer used by any post and
  belongs in `reels/parked/`; a few empty frame folders from interrupted runs are sitting
  in `out/media/reels/` (that folder is gitignored, so they are only clutter).

---

# SESSION LOG — 2026-09-05 (round five: featured shows, comment editing, the clip audio)

Full detail in `docs/sessions/2026-09-05-featured-shows-and-round-five.md`.

## Shipped

1. **Statements start at the join month** — `lastMonths` takes a floor from
   `createdAt`. A page six weeks old no longer shows eleven rows of zero.
2. **The founder's own gig earnings, split out of MySet's revenue.** It turned out
   to be separable: a payment MySet sold on his behalf carries `kind` + `artist`.
   `platformSplit()` buckets one pull of platform balance transactions into his half
   and the company's. From now on every charge labels itself, via
   `payment_intent_data.metadata`.
3. **"See what fans see" → the public page** everywhere except the Live tab, where
   it still means the voting screen.
4. **The clip audio bug, fixed.** The re-encoder took audio from a MUTED element, so
   every clip had a perfectly good silent audio track. Now a Web Audio graph taps
   the sound before the speakers. If a browser refuses unmuted playback the clip is
   silent AND the person is told.
5. **Fans can edit their own post for 24h and delete it for ever.** Ownership is
   checked inside the write against the stored device id.
6. **Artists: hide on any plan, delete for good on Plus.** Added to the plan cards
   in the Studio and on /about.
7. **Featured shows.** $10, three spots per city per night, first come first served,
   behind the `featuredShows` flag. A twenty-minute HOLD before the charge, keyed by
   an id carried through Stripe's metadata — so the spot is never unclaimed while
   somebody is paying for it, and nobody is charged for a spot they did not get.

## Three bugs caught by re-reading, not by a user

- The first version released the hold and re-claimed it under Stripe's session id,
  opening a window in which the spot being paid for was free for anyone to take.
- "One spot per artist per night" blocked on the artist's OWN abandoned hold, so
  backing out of checkout locked them out of retrying for twenty minutes.
- **The garbage collector pruned on the CALLING artist's local date** inside a
  shared city table — so an artist in Bangkok could have deleted a London artist's
  PAID row for a night London had not reached. The delete floor is now two days
  behind UTC.
- **A hidden post kept serving its photos and clip** — and once deleting became a
  paid feature that left a free artist unable to take anything down at all. Hiding
  now deletes the media; the words stay and can be un-hidden.

## State

- **28 suites, 1,456 assertions, 0 failed.** New: `test/featured.mjs`.
- INVARIANTS 0dx–0eb.
- Perry's to-do unchanged: `charge.updated` on the webhook, stop the double deploy
  and move to Netlify Pro, 2FA everywhere, try the passkey.


---

# SESSION LOG — 2026-09-05 (the Money Model: interactive projections dashboard)

Full detail in `docs/sessions/2026-09-05-money-model.md`. Perry asked for a dedicated
session on the business model with "an insanely high level of care".

## Built
- **`finance/model.html`** — one self-contained file. Every variable is a typed cell
  AND a slider: artists, plan mix (% Plus / % Pro, free = rest) and prices, gigs per
  artist (free cap 4 applied), people / hours / screen-on share / actions per person
  / other pages / installed share (no cost effect, explained) / Studio Live-tab
  share, room money per gig by tier and MySet’s cut (10 / 2 / 0), featured shows (%
  of gigs, price, refunds), Stripe (US preset — the account IS US — plus a Thai
  preset; Billing 0.7%, international 1.5%, Express $2/account + 0.25% + 25¢/payout,
  disputes, refunds, bad debt), 9 host cost models with every rate editable, fixed
  costs list, support time, tax on profit, growth timeline, the four show sizes, a
  Real-shows panel. Outputs: 8 KPI tiles; line (36 months), area (cumulative),
  100%-stacked bar (where each dollar goes at 10 → 10,000 artists), two donuts
  (revenue mix, cost mix), bar (server bill as a share of what the room spends, per
  show size); the formula line by line; the four shows on every host with a
  holds / at-the-edge / breaks verdict; same-month-every-host; scale ladder;
  month-by-month. Scenarios: save with a label, 6-bullet auto summary (revenue,
  costs, profit, margin, artists, gigs, server share, break-even, host), up to 20,
  first 4 shown + "Show N more", drag the grip to reorder, Compare-all table,
  Export/Import JSON.
- **Published artifact (private, shared storage across Perry’s devices):**
  https://claude.ai/code/artifact/6f41159d-b117-4847-81ee-a76289b96398 — scenarios
  live in its db (`scenarios/<id>`), real numbers in `actuals/current` (seeded).
- **`tools/actuals.py`** — pulls every archived night out of production (read-only),
  keeps nights that actually happened (≥ 30 min, ≤ 12 h, somebody there), prints the
  JSON the dashboard’s Real-shows panel understands + this period’s deploy rate.
  `--write` saves `finance/actuals.json`. Today: 2 real nights (30 Aug: 8 voters,
  2.2 h, $3; 4 Sep: 1 phone), 116 deploys/month.
- **`finance/model-test.mjs`** — the engine (extracted from the HTML) vs
  `tools/loadsim.py` at 8 room sizes (worst 2.9%), an independent re-computation of
  the month, the 10k-artist audit figure, KV/DO ordering, free cap, break-even,
  sizes, the big-room brake, the 3-second cache, calibration. All pass.
- `finance/README.md`.

## What the 20-agent research panel corrected (5 lenses × 3 skeptics)
- **At 10,000 phones today’s code does not get expensive — it stops working.**
  Every poll reads all 12 fan shards (poll cost O(fans²)), the ladder never backs
  off in a big room, and votes stampede into "busy". 300 phones is fine. The
  dashboard models the per-person poll weight and shows holds / edge / breaks.
- **Perry’s Stripe account is in the US** (USD) — earlier notes saying Thailand
  were wrong. **Express account + payout fees are MySet’s**, and `_connect.mjs` pays
  artists **daily** (~25¢ a night per busy artist) — consider weekly.
- **155 ms/poll was a probe before a fix**; the bill implies 70–110 (default 120).
- **Durable Objects are ~1.3× cheaper, not 13×** — the audit omitted the
  duration charge. Cloudflare KV is still worse than Netlify.
- **Netlify auto-recharge is already ON** (500 credits/$5); no spending cap exists.
- **Installing as a web app changes nothing the server is charged for.** Nudge
  installs after a show (iPhone storage partition), never attach money to it.
- **Ranked tidal-wave defenses** (in the dashboard): watchdog on recharge → booked,
  prepaid Arena/Festival tier → terms → server-driven poll floor → kill switch
  that stops reads → 3-second edge cache (arena ≈ $9, festival ≈ $530) →
  big-room mode + phone cap → edge rate limits → queued votes → in-memory show
  object. Do the first three this week (no code).

## Perry’s to-do from this session
1. After next week’s shows: `python3 tools/actuals.py --write`, paste the JSON into
   the dashboard’s Real-shows panel, switch on "Use real shows". Read one night’s
   function count from the Netlify dashboard to calibrate the screen-on dial.
2. Decide the Arena/Festival booking policy and put it in the terms.
3. Ask Stripe whether cross-border direct charges onto Thai Express accounts are OK
   from the US platform; consider a weekly payout schedule.
4. Consider Pro at the end of the billing cycle (8 Sep).

## State
- Verification: engine tests pass; page loads clean in light/dark/mobile; a
  four-lens headless-Chrome review ran at the end of the session — results and any
  fixes are in the session doc §6.
- Nothing pushed. New files only (finance/, tools/actuals.py, docs/sessions/…);
  the other session’s uncommitted edits were left untouched.
