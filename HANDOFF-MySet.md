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

## SESSION LOG — 2026-08-31 (after the first real gig)

Perry played the first live gig with MySet on **2026-08-30, The Ugly Duckling
Irish Pub, Koh Phangan** — 8 people voting, 21 votes, one $3 purchase. Two
things broke, both now fixed and verified on the live site.

### 1. A paid customer got nothing
`cari.helena88@gmail.com` bought the $3 / 5-vote pack at 20:35 and was never
granted the votes. `/api/confirm` only runs if the buyer's browser returns to
the site; hers didn't, and the `meta` ledger blob did not even exist afterwards.

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

### 2. He could not log into his own Studio
The passcode lived only in the Netlify `ADMIN_CODE` env var — nowhere he could
read it — so he never started a single song from the dashboard. He can now set
his own code in **Settings → Your studio code** (stored hashed in
`show.codeHash`); `ADMIN_CODE` stays as the recovery key. `checkAdmin` is async
now and still fails closed.

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
