# Push log — what each push did, for every other session

Newest first. **Read the top of this file at the start of every session**, before
`git status`, before assuming anything about what is or is not live. One entry per
push, written by `tools/pushlog.sh` as the last step before `git push`; the
pre-push hook refuses a push whose commits do not touch this file. Keep entries to
three lines: what changed for a person, then what another session must know. The
long version of any entry lives in `docs/sessions/` and `docs/decisions/`.

Several sessions work this repo at once, in different worktrees, and none of them
can see the others' chat. This file is the one place they all speak.

### 2026-09-12 23:02 — 9656e93 — wt@docs/payments-session-ledger (3 files since origin/main)
**tl;dr:** Docs only: ledger + session note for the payments session — PER-004 is done (AUTH_FROM was already set), PER-013 watches Connect payout fees, the connected-account risk is mitigated by 0058; the Founder Run Sheet artifact is refreshed [skip ci]
**Other sessions:** Nothing to redo. Puzzle steps 370264/370098/370266 are Live and 370273 Testing — the matching docs/processes sheets (admin-and-finance 02 s05 + 03 AUTH_FROM row, reliability j07, money/02) are the Puzzle-mapping session's uncommitted files and still say Draft: flip them when you push. HARDENING §1's 'Checkout Sessions only' restricted-key advice is stale — the functions call 25 Stripe endpoints (noted on PER-007).

### 2026-09-12 22:16 — 3c00963 — wt@money/connect-webhook-secret (8 files since origin/main)
**tl;dr:** The Stripe webhook now accepts events from the new Connected-accounts destination too (STRIPE_CONNECT_WEBHOOK_SECRET, decision 0058); Customer Portal saved in live mode so Manage billing works; no MySet product exists in Stripe yet, so the Bar Star / Rock Star names will be created on first checkout (PER-011 cancelled)
**Other sessions:** webhook.mjs exports webhookSecrets() and constructSigned(); test/twosecrets.mjs runs WITHOUT the fake (real stripe HMAC) and is in run.sh after connect. Both Stripe destinations point at /api/webhook — a Connect event ticked on the 'Your account' destination is silently never delivered. Overview §6.3 now lists eleven production env vars (AUTH_FROM IS set — PER-004 may be stale).

### 2026-09-12 22:00 — 6c22af4 — wt@ui/product-dev3-batch (21 files since origin/main)
**tl;dr:** Product Dev 3: RSVP sits at the right edge of every show row (pin under the date, count centred under the pill); a filed night can be renamed by a tap on the Money tab (0057); All songs is a real Use choice that turns the Live step green; the vote page's edge glow now matches the Studio's; photos on the artist page enlarge; orange Community button, new hero line, orange finder ring, folded-map icon
**Other sessions:** history.mjs takes {action:'rename', show, title} → _history.mjs renameShow; a detail doc with titleByHand:true keeps its title through archiveShow (INVARIANT 0fm) — read the flag before writing title. test/structure.mjs pins @keyframes edgeGlow byte-identical in studio.html and vote.html. studio.js restamped ?v=4d1ab49f (run node tools/stamp.mjs after any edit — AGENTS.md now says so). Rows: .rsvpcol on index/artist (not .go, app.css owns it). docs/processes engineering-os c02 sheet + step 370033 still want the Studio scripts line.

### 2026-09-12 20:30 — 4a50abe — wt@ui/product-dev2-batch (33 files since origin/main)
**tl;dr:** Studio tab bar face-lifted (black slab, sheen, raised orange-ringed tab, both Studios); plans now read Hobbyist / Bar Star / Rock Star (0055); anonymous RSVP with a public count under the date of every show card on the front door and artist page (0056); the artist strip drops the rating card, adds the room's songs and turns as a slow marquee; the pinned card wears orange with a red countdown ring; What the room said lives under Profile's merch; Select setlist with All songs as a real choice
**Other sessions:** New public write path POST /api/rsvp?a=|v= → rsvp_<ownerId> (never list(); erased in keysFor/keysForVenue); every /api/events row now carries rsvp:<n>. Plan IDS stay free/plus/pro — only labels changed; PLANS[k].label is the name to print. Stripe products still say MySet Plus/Pro until renamed by hand (PER-011). After ANY studio.js edit: node tools/stamp.mjs. Decisions 0055/0056 need their Puzzle changelog entries (tandem rule).

### 2026-09-12 20:12 — fa00999 — myset-s4@perf/stage-hops-venue-split (15 files since origin/main)
**tl;dr:** Every signed-in call is faster (auth secret read once per warm instance, registry read in parallel, slug joins the stage batch — 4 blob hops → 2); the Studio boot no longer waits on the plan; the Venue Studio's script is now /venue-studio.js kept a year (0054, 0053)
**Other sessions:** _auth.mjs: secret() is memoised — if the auth secret is ever rotated, redeploy. studio.js has(): PLAN===null is LOCKED, a failed plan read is allowed. venue-studio.js exists: after editing it OR studio.js run 'node tools/stamp.mjs'; test/_src.mjs src() reads both pairs. netlify.toml: /venues, /venue-studio.html, /venue-studio.js rules sit after /:slug.

### 2026-09-12 19:43 — be2b317 — myset-split@perf/studio-script-file (17 files since origin/main)
**tl;dr:** The Studio's 283 KB of script now lives in /studio.js, kept by the phone for a year; the page itself is 49 KB instead of 312 (decision 0053)
**Other sessions:** public/studio.js holds everything that was between studio.html's big <script> tags, line for line. After ANY edit to studio.js run 'node tools/stamp.mjs' (rewrites ?v= in studio.html; test/structure.mjs fails otherwise). Tests read the pair via test/_src.mjs src(). An in-flight edit to the old inline script ports to studio.js at the same code. netlify.toml: the /studio.js rule must stay after /:slug (which also matches it). venue-studio.html untouched.

### 2026-09-12 19:12 — ed14668 — myset-note@docs/studio-six-seconds (1 files since origin/main)
**tl;dr:** Docs only: the 5–7 s Studio open since 16:10 was render() throwing on drawFirstRun (shipped early in 5b4a531); #11 fixed it; the stopwatch now reads Opened in 1.8 s on the founder's session [skip ci]
**Other sessions:** Nothing to redo. PR #13 (a typeof guard) was closed unmerged — #11 carries the function. Keep the Settings stopwatch; it is the readout for any future 'the Studio is slow'.

### 2026-09-12 19:03 — docs — MySet@docs/airbnb-batch-two-live (3 files since origin/main)
**tl;dr:** Ledger and session note for Airbnb batch two now say it is live (`d980ec4`, PR #11) with the content checks that proved it; next work item names the two follow-ups it left (`logPlay` `paidVotes`; the history heal back-fill on the next Money-tab load). [skip ci]
**Other sessions:** docs only. The ledger's UX-015–UX-021 rows are the record of what shipped in #11 — read them before touching the tab bars, the artist pill or the proof strip.

### 2026-09-12 18:56 — fe86186 — MySet@ux/airbnb-batch-two (30 files since origin/main)
**tl;dr:** Airbnb batch two: four button tiers + one chip recipe (app.css/lock.css, docs/design-system.md, 0051); artist page pinned pill + auto-scrolling proof carousel (rating · comments · top voted/played/paid, /api/profile 0043); vote dock state line, review sheet, FLIP re-rank, Share; community composer in a dock sheet; venue listing + pitch card; both Studios on a bottom tab bar with Today, a first run, earnings charts; front door "View next week's events" (events.mjs days=, 0052). Also finishes the half of this that 5b4a531 pushed early (unstyled .fab/.chip, Studio's undefined drawFirstRun).
**Other sessions:** compose buttons from .btn-pri / .btn-ink / .btn-grey / .btn-text and chips from .chip — see docs/design-system.md before inventing a page-local recipe; lock.css carries the same tiers for the Studios. /api/profile now has rating/comments/topVoted/topPlayed/topPaid/setlist (topPaid stays null until admin.mjs logPlay writes paidVotes — one line, wants an owner). The city feed takes days=7..28 and echoes window. Decisions 0044–0047 are now committed; docs/processes and the Puzzle session notes are NOT — still yours to push.

### 2026-09-12 18:33 — eb84daa — myset-stopwatch@perf/studio-stopwatch (6 files since origin/main)
**tl;dr:** Studio Settings tab now shows a stopwatch line (Opened in X s · page · stage · plan) so the founder's phone can say where a slow open goes; /studio edge copy lives 10 min instead of 60 s
**Other sessions:** studio.html: window.__boot in the head, BOOT/bootStat() by bootDone(); the 6 s timer now calls bootDone(true). netlify.toml: /studio and /studio.html rules after /:slug. NOTE: origin/main's suite is red before this branch — structure wants fitTabs/--headh in studio.html and copy.mjs fails two Studio checks; another session's in-flight work, not touched here.

### 2026-09-12 18:30 — ed3bc3e — MySet@main (1 file since origin/main)
**tl;dr:** Removed the explanatory OFF/Remove sentence above the Artist Studio Setlist song list
**Other sessions:** This is copy-only: one paragraph was removed from public/studio.html; no Setlist behavior changed.

### 2026-09-12 18:13 — 1c58489 — MySet@perf/studio-head-start (8 files since origin/main)
**tl;dr:** Studio opens faster: its stage + plan reads start from the <head> before the page body lands, and /api/stage + /api/admin are pinged awake every 4 min with the fan door (decision 0050)
**Other sessions:** studio.html: api() consumes window.__early once for '/stage' and planGet — keep the head script's headers identical to api()'s. Pings are now 3 per 4 min (~32k calls/month). venue-studio.html NOT given the head start yet.

### 2026-09-12 17:26 — 4ba232b — MySet@perf/one-warm-door (12 files since origin/main)
**tl;dr:** One warm door: the four fan pages now read /api/fan?what=… (one function for profile/events/board/me/community/venue), pinged awake every 4 min by autocron. Decision 0049.
**Other sessions:** Old addresses (/api/profile etc.) still work — index.html and artists.html were NOT switched (another session has them open); switch them to /api/fan?what=events when convenient. A new public read must be added to DOORS in fan.mjs or it sleeps alone. Photos stay on /api/img: already immutable+durable per ?v=.

### 2026-09-12 17:03 — f06857d — MySet@main (10 files since origin/main)
**tl;dr:** Speed pass two (decision 0048): pages and static files now stay at the edge (no more 0.6–0.9s revalidation per tap); the Stripe SDK no longer loads on every cold start of profile/community/board/me; profile and venue reads batched
**Other sessions:** json() now sends netlify-cdn-cache-control: no-store — keep it on any new raw Response that is personal. Never put a top-level import of 'stripe' in a module a public read imports. New rewritten HTML routes need their own [[headers]] block in netlify.toml. CORRECTION: 5b4a531 (16:10) accidentally carried profile.mjs with the other session's uncommitted decision-0043 work (topSongsOf, readFeedback/readPosts) — it is live and answering 200; that session need not push it again. Its uncommitted _history.mjs topOf() hunks were NOT committed.

### 2026-09-12 16:31 — 1d56afd — MySet@main (3 files since origin/main)
**tl;dr:** Every push now leaves three lines in docs/PUSH-LOG.md for the other sessions; the pre-push hook refuses a push without them
**Other sessions:** Read the top of docs/PUSH-LOG.md first at session start. Last step before git push: ./tools/pushlog.sh "tl;dr" "note". Hook lives in .git/hooks/pre-push (shared by all worktrees).

### 2026-09-12 16:10 — 5b4a531 — MySet@main (15 files)
**tl;dr:** Artist, venue and community pages paint the copy the phone last saw (or a placeholder frame) before the network answers; `/api/profile` (15s), `/api/events` (30s/60s) and `/api/venue` (30s) are edge-cached like the board; events takes `n=` (44KB → ~13KB). Decision 0042.
**Other sessions:** `jsonCached(body, ttl)` in `_lib.mjs` — use it for any public read that does NOT vary by caller; never for one that reads a token or fan id (INVARIANT 9d6, URL is the key). `window.lastSeen.get/set` in `leave.js`. A reader that must see its own write adds `?t=`. Pass two (parallel storage reads; one-warm-door merge) waits on the founder's phone check.

### 2026-09-12 14:34 — 425fb0a — MySet@main
**tl;dr:** Front door finds gigs near the phone; vote page counts down between shows; Merch folds into Profile; sign-in is email + code. Also carried: free plan = ten shows a month (0037), community composer folded behind the five stars + "Somewhere else" (0036), `leave.js` splash on every tap + head-started first API call + static cache headers (0038).
**Other sessions:** pages include `<script src="/leave.js">` after theme.js and use `window.goTo(url,label)` for any redirect; the Studios keep their own `goTo`.

### 2026-09-12 (night) — fbcdc6f, 0fca98c, 7f4874c — the open line and the money model
**tl;dr:** The open line to the room is measured and shipped (a Durable Object holds 4,000 phones, sleeps between votes); the money model has a light/dark toggle and prices the split and the open line.
**Other sessions:** do not plan or "start" the open line again — it is done. Its records: `docs/sessions/` for 2026-09-12 and the decision it names.

### 2026-09-11 — c3d0a4d, a4e3657 — the board split and clips on R2
**tl;dr:** `/api/board` (edge-cached, shared) split from `/api/me` (personal, never cached), decision 0034; clips live on R2 with `/api/vid` a 302 to a signed link.
**Other sessions:** never remove the `R2_*` env vars; the durable cache ignores lifetimes under 10s.
