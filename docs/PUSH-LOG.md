# Push log — what each push did, for every other session

Newest first. **Read the top of this file at the start of every session**, before
`git status`, before assuming anything about what is or is not live. One entry per
push, written by `tools/pushlog.sh` as the last step before `git push`; the
pre-push hook refuses a push whose commits do not touch this file. Keep entries to
three lines: what changed for a person, then what another session must know. The
long version of any entry lives in `docs/sessions/` and `docs/decisions/`.

Several sessions work this repo at once, in different worktrees, and none of them
can see the others' chat. This file is the one place they all speak.

### 2026-09-18 15:12 — 43c87b2 — wt-diaries@docs/diaries-merged (4 files since origin/main)
**tl;dr:** Docs only: DIA-001 done (live as a87ff85, PR #78); the diary sheet loaded into Puzzle (section 42869), changelog 1835 completed
**Other sessions:** No code. Next for the founder: the first real diary page on his own account. [skip ci]

### 2026-09-18 15:08 — 56a6641 — wt-diaries@docs/artist-diaries-phase1-scope (30 files since origin/main)
**tl;dr:** Artist Diaries: every artist gets a diary of stories behind their songs at /<slug>/diary (3/10/40 pages by plan), with a cover photo per page, lyrics beside a story, Studio → Menu → Diary, a Diary door on the artist page and a Diary card under the merch card on the community page (0085)
**Other sessions:** New document diary_<aid> (KEY.diary, casKeep); public read is /api/fan?what=diary; admin actions diaryList/Save/Remove/Move/Photo/PhotoClear (CAPABILITY profile); PLANS.*.diary + diaryCap; DIARY_SLOT d<id> in _img.mjs is a page's cover; community.mjs ships diary + diaryPeek and its read ceilings went up by one; diary/diaries are reserved slugs; /:slug/diary route sits above the catch-all; after editing studio.js run node tools/stamp.mjs

### 2026-09-18 11:18 — ecd0e44 — wt@studio/hours-minutes-boxes (15 files since origin/main)
**tl;dr:** Money tab: a show's time is two number-pad boxes per kind (hours | minutes) — no more hours logged as minutes; Set-up / break-down; Edit last show's numbers (0084)
**Other sessions:** Biz.parseHms(h,m) is the reader; the boxes are .bzmin with data-u=h|m and inputmode=numeric; parseHm stays for the report and old drafts; TIME_KINDS label changed in BOTH public/biz.js and netlify/functions/_biz.mjs (the overview reads the server one); tools/uicheck.mjs now expects the fold at five and Past shows.

### 2026-09-18 10:36 — b7ec8eb — wt@studio/money-tab-batch (20 files since origin/main)
**tl;dr:** Money tab: the burst on votes bought too (brief over a chart), $x from in-app tips under profit, a currency chip, pay open on every gig form, normal keyboard on hours, the editor's X clear + save lands at the top, the pinch-out zoom fixed (21 chart labels), Past shows, lists fold 5→+20, bugs card last, Delete show; plus swipe-to-reveal + hold on every list row (0082, 0083)
**Other sessions:** stage.mjs payload has paid{count,total,last}; history rows have tipped (in ROW_TOPS — the heal re-opens once per account); POST /api/history {action:'hide'} flags idx row hidden and history.mjs filters it; bizPrefs takes currency (3 letters, USD clears); Biz.money follows Biz.currency — call it before painting figures (report.html does). studio.js foot module owns swipe/hold — any .row/.songcard/.gigcard with button.act/.bizacts/.btn-text gets it free. tools/mock.mjs now answers bizGet/history/ledger/revenue with rows; after editing studio.js run node tools/stamp.mjs

### 2026-09-15 19:47 — 0e4c2f8 — landing-wt@qr-copy (2 files since origin/main)
**tl;dr:** About page: 'Requests cost votes', the tip-button line and the profile-page line are now orange; 'gig' -> 'show' in step 5's profile description
**Other sessions:** Copy-only, same PR as the QR-code line change (about.html:479-533)

### 2026-09-15 19:41 — 35f8806 — landing-wt@qr-copy (1 files since origin/main)
**tl;dr:** How-it-works step 1: 'One QR code' and a clearer print/place line (pack on tables and bars per venue)
**Other sessions:** Copy-only at about.html:479-480

### 2026-09-15 19:27 — 3597a3f — landing-wt@plates (1 files since origin/main)
**tl;dr:** About page: the pain line now says everyone's staring at their plates (was phones)
**Other sessions:** Copy-only change at about.html:423; the picture alt already said plates, so nothing else to touch

### 2026-09-15 19:03 — 2774e35 — wt-risk@docs/r2-risk-closed (2 files since origin/main)
**tl;dr:** Ledger's Open risks: 'The R2 API token cannot write' is CLOSED (written since 2026-09-15 ~04:30Z; a fresh clip plays back from R2); _mirror.mjs comment dated the same way [skip ci]
**Other sessions:** Nothing in the code changed. If any record you hold says the token is read-only or the R2 clip is unmeasured, it is stale — P3-003 is done, UX-052 and this entry are the current word. The last place that said otherwise was the risks table; it is fixed here.

### 2026-09-15 18:51 — 5c42f26 — wt-diary@docs/gig-list-not-diary (13 files since origin/main)
**tl;dr:** The artist page's upcoming-gigs list is now called the gig list, not the diary — the word is reserved for the Artist Diaries feature; P3-003 done (a fresh clip plays back from R2 on the founder's phone, 2026-09-15); the Google Sheet is switched on (313 rows, 11/11 tabs)
**Other sessions:** Wording only — no key, identifier or URL changed (ev_<owner>, HORIZON_DAYS, /api/events untouched). Do not call the gig list 'the diary' in new comments or docs; when Diaries is built its keys are diary_*, nothing else's. Dated decisions/session notes keep the old word. R2 is proven end to end now — never call the token read-only again; the two pre-09-15 clips still serve from Blobs by design.

### 2026-09-15 17:28 — bac630b — wt5@studio/first-gig-and-money-routing (23 files since origin/main)
**tl;dr:** A tip sent after the show now counts for that night everywhere — the Money tab's Taken tile and profit are one figure (the founder's $2 reaches profit); the first run is four steps ending on Print my sign (/sign.html); a Your-first-gig card pinned on the Live tab until a night is filed; example rows on an empty first board; a full-screen first-tip burst; tonight's money sticky on the Live tab; one morning-after letter after the first night (decision 0081, INVARIANT 0ga)
**Other sessions:** _history.mjs: moneyWindowEnd(rows, showId) + refreshShowMoney(aid, showId, money) — use them for any re-pricing of a night; never price a night start→end again. stage.mjs carries signAt and nights (null on accounts older than the stamp). meta.signAt / meta.nights are account facts. The bell's index (gigsched) now has notes/noted; sweepNotes runs from autocron. admin action signPrinted (profile). public/sign.html is new; the mock serves /api/qr for real and takes ?first=1. After ANY edit to studio.js run node tools/stamp.mjs.

### 2026-09-15 17:07 — b800271 — wt2@docs/mirror-and-diverged-checkout (2 files since origin/main)
**tl;dr:** Docs only: SSD mirror rebuilt (Followthrough, all memories, MySet from origin/main); ~/Docs/MySet has DIVERGED from main and is an open risk [skip ci]
**Other sessions:** Do not build on ~/Docs/MySet — it is a 12 Sep base with 19 modified + 57 untracked files, 9 colliding with what shipped since. Worktrees off origin/main only. The colliding edits are in the SSD's MySet-uncommitted-local-edits.patch. node_modules is still a tracked self-symlink on main — drop it from the index in a small PR.

### 2026-09-15 12:59 — 492d2f4 — wt2@docs/stripe-key-restricted (2 files since origin/main)
**tl;dr:** Docs only: PER-007 closed — STRIPE_SECRET_KEY is now a restricted key (13 permissions, proven by the founder's $1 tip); statement descriptor IDYLL.MYSET; UX-050 recorded [skip ci]
**Other sessions:** If an artist's Start with Stripe or a fan purchase on an artist page fails after 15 Sep, read the error log first — a missing Connect permission on the restricted key names itself there. The full permission table is in PER-007.

### 2026-09-15 12:54 — 27bb0ae — wt2@ux/tip-custom-amount (3 files since origin/main)
**tl;dr:** Tip sheet: tapping 'Or another amount' lights that field orange, dims the $5/$10/$20 tiles, and the Continue button reads the typed amount (both the voting page and the community page; also the paid-replay custom field)
**Other sessions:** customAmt(inp,...) in vote.html and community.html; app.css .inp.on is the lit state. The amount logic in checkout()/sendTip() is unchanged: a typed value wins, else the tile. No new copy strings beyond ' · $N' on the button.

### 2026-09-15 12:35 — 3710953 — landing-wt@venues-orange (1 files since origin/main)
**tl;dr:** For venues: the bold lead-ins on the venue checklist are now orange, like shop and money
**Other sessions:** Orange vrow rule is one line: #shop/#money/#venues .vrow b in about.html — add ids there, don't duplicate

### 2026-09-15 11:59 — b778cd7 — wt2@pay/connect-refusal-message (14 files since origin/main)
**tl;dr:** Hobbyists are paid out every Monday, paid plans daily (decision 0080) — the plan cards say so; and an artist whose Stripe account can't be made reads one MySet sentence instead of Stripe's text (the platform-profile gate that failed the first live Start with Stripe on 15 Sep is acknowledged by the founder)
**Other sessions:** _connect.mjs syncPayoutSchedule(aid): call it after ANY new code path that writes a plan, or the schedule lags until the next Money-tab look; connect_<owner>.payout is the memo. connectStatus now returns payout + payoutLine. stripe-fake has accounts.update and state.refuse. PR #20 (12 Sep docs) is superseded by this — its session note rides here. NOTE: node_modules is a tracked symlink pointing at ITSELF on main (since ffa6cfc) — a fresh worktree cannot resolve stripe/@netlify/blobs; nobody has fixed it yet.

### 2026-09-15 11:51 — 4e93890 — wt-per004@ops/per-004-live (2 files since origin/main)
**tl;dr:** Sign-in mail from hello@myset.vip is confirmed real (PER-004 done, Puzzle 370273 Live); the R2 token WRITES since 2026-09-15 ~04:30Z — the 04:40Z mirror ring copied 7 with no refusal (P3-003 in_progress until a clip is seen on R2); the three VAPID_* vars are set in production and this deploy switches them on
**Other sessions:** Ledger only, no code. The mirror pass in flight carries 129 old failures — 'failed: 0' first appears on the retry pass ~06:00-06:20Z; do not call the token read-only again. Every new clip upload now lands on R2 (the two existing clips stay in Blobs). VAPID keys generated by an agent, private key never printed — rotate by re-running vapid-keys.sh. ~/Docs/MySet/node_modules was a committed self-symlink (7a62844) and is now a real install on disk; the tracked symlink still wants removing from git.

### 2026-09-15 01:40 — 2134c37 — wt@fix/live-tab-tips (5 files since origin/main)
**tl;dr:** The Studio's Live tab now shows TONIGHT's tips (it summed the account's whole history — the founder saw $30 for $20 on 14 Sep). 14 Sep's tips were $20, not $30. The founder's charges already go straight to his own Stripe account, no Connect, no fee.
**Other sessions:** stage.mjs tips: { total, count, recent } are tonight's (since show.startedAt; 0 before a show starts); the account's are tips.allTime / tips.allTimeCount — do not sum meta.tips for anything labelled tonight. test/decline.mjs pins it. ~/Docs/MySet/node_modules is a symlink to ITSELF since 7a62844 — test/run.sh and tools/overview.mjs need a real install (the compassionate-chatterjee worktree has one).

### 2026-09-15 01:17 — c5f714b — wt4@studio/paid-votes-crowd-numbers (31 files since origin/main)
**tl;dr:** Song cards' green pill now reads 'Paid votes: N' and counts every vote from somebody who tipped tonight; Settings → What the room sees (Bar Star+) puts tonight's votes+voters and/or tips on every phone's vote page; setup step 3 no longer offers the plans — Next + an orange note; the Settings lock pill says '· Upgrade' (decision 0079, INVARIANT 0fz)
**Other sessions:** _lib.mjs paidVoteCounts(fans, tippers) + tippersTonight/tipsTonight; new plan flag crowdNumbers (free off) with crowdNumbersAllowed + admin crowdSet → show.crowd{votes,tips}; buildBoard takes meta and adds numbers (null unless live and on) — board.mjs/show.mjs read meta ONLY when show.crowd.tips. vote.html draws .strip.nums from d.numbers. frPlans is gone. uicheck: 'Paid votes: 2' and the Settings order Requests > What the room sees > Starting by itself. Next free invariant: 0ga; decision: 0080.

### 2026-09-15 01:12 — 75509fd — wt@night/ugly-duckling-14-sep (6 files since origin/main)
**tl;dr:** The Ugly Duckling night (14 Sep) is on the model: 13 phones, 10 voted, 22 votes, 13 songs, every vote played, $20 in card tips ($1.54 a head, the best night). Eight nights now: 9.9 phones, 2.8 h, $1.03 a head. The night cost ~3 credits of traffic by Netlify's own meters.
**Other sessions:** finance/marks.json: marks #3 (14 Sep 17:00) and #4 (15 Sep 00:40) bracket the night; the poll solve is WITHHELD — background ~8 MB/h since the warm-door pings/mirror (12 Sep was 200 MB with no gig). To make the bandwidth method usable again take two marks an hour apart on a quiet afternoon. finance/credits.json reading #2 = the dashboard 66 min after End. The night's event log (evt_perry-idyll_2026-09-14-1330-gap5) is the first real one — 35 events. Nobody touch marks.json from a stale main: it lost #3 once today.

### 2026-09-14 20:25 — 0f12226 — wt@model/credit-breakdown (9 files since origin/main)
**tl;dr:** Netlify's own per-category credit split is now on file (finance/credits.json, read 14 Sep): deploys 1,290 of 1,340 credits this period (96%); everything the rooms did 50 credits. The money model's 'Two bills' note quotes it.
**Other sessions:** finance/credits.json is append-only, read by hand from Usage & billing › Credit usage breakdown (the API cannot give it) — add a reading, never edit one. tools/actuals.py carries readings[-1] into actuals.json as shipping.dashboard / traffic.dashboard. A no-gig day is ~3 credits compute + ~1 requests of background (scheduler, warm-door pings, mirror); a gig adds 1–2.
### 2026-09-14 20:21 — 493d32b — wt3@fix/no-default-profile-images (13 files since origin/main)
**tl;dr:** A new artist page no longer opens with the founder's band photo as its cover and portrait — no photo means a pink-orange cover box and the band's initial (decision 0078, INVARIANT 0fy); the Studio's Save profile button is centred
**Other sessions:** _profile.mjs DEFAULTS photo is '' and normProfile never fills it; artist.html .pcover.blank / .pav.blank, community + shop .av.blank draw the initial; og:image on artist.html is the MySet icon. The founder's page stores /img/band.jpg by path and is unchanged — do not remove the two stock files. .big.mid centres a one-word big button. Next free invariant: 0fz; decision: 0079.

### 2026-09-14 19:39 — be66f52 — wt@model/two-bills (10 files since origin/main)
**tl;dr:** The money model keeps two server bills apart — TRAFFIC (what rooms cause) and SHIPPING (deploys × 15 credits) — and no per-gig, per-phone or per-show figure ever contains a deploy (INVARIANT 0fx, decision 0077). This period: 84 deploys = 1,260 credits vs 23 credits of bandwidth for everything the rooms did.
**Other sessions:** finance/model.html hostBill() → trafficUsd + deployUsd; month().costPerGig / serverPerGig are traffic-only. tools/actuals.py emits shipping{} and traffic{}; it now REFUSES to write when the registry reads as empty (a worktree that is not netlify-linked reads zero nights) — from a worktree run it as MYSET_SITE_DIR=~/Docs/MySet python3 tools/actuals.py --write. Never divide deploys by gigs/shows/phones anywhere; the suite greps for it. Next free invariant: 0fy; decision: 0078.

### 2026-09-14 19:18 — eac3dfd — landing-wt@landing/freedom-line (1 files since origin/main)
**tl;dr:** Freedom card: 'You don't just walk out with more money but more proof' is now the whole bold-orange line (the founder, after the polish pass)
**Other sessions:** Copy only. about.html card emphasis: <b class=o> = bold orange.

### 2026-09-14 19:11 — b1d1ed6 — landing-wt@landing/polish (1 files since origin/main)
**tl;dr:** Landing page polish from the founder's review: orange emphasis through the beats and cards, centred off-white chips, 64px gradient beat numbers, orange strip captions clear of the fade, beat 2 now sells buying more votes, beat 4 no longer mentions daily payouts (still in the shop section)
**Other sessions:** about.html emphasis convention in body copy: <b> = bold ink, <span class=o> = orange, <b class=o> = both; .pline keeps its own <b>/<em> = orange. Strip markup is .reel-wrap > .rcap + .reelbox > .reel (the fade is on .reelbox). Copy only, no code paths.

### 2026-09-14 18:34 — 81c9433 — landing-wt@landing/screenshots (39 files since origin/main)
**tl;dr:** The landing page now shows the founder's real screenshots: the Profit tab as the business hero, the shop + community pair, the real artist page in the link comparison, today's Setlist/Gigs/Settings, the front door + map for venues, and four drifting strips (room, Studio, page, dashboard+report) — 33 pictures
**Other sessions:** public/about/*.webp are 600px from MySet Social Media/Stills/MySet In-App Screenshots (PIL, q80). Old setlist/gigs/rules/page.webp and fills.png deleted. Add or swap a strip picture in the REELS object only. The one CRM shot left out shows a red 'payments never delivered' warning.

### 2026-09-14 18:08 — 803bd9d — landing-wt@landing/shop-dashboard-profile (5 files since origin/main)
**tl;dr:** The landing page has three new sections — Your link (the artist page as the link-page replacement), The shop, Your business — with drifting screenshot strips wired but empty until the founder's screenshots land; FAQ answers the plans gate; beat 4 says daily payouts
**Other sessions:** about.html: add pictures ONLY in the REELS object (one entry per file) and the two data-still slots; the strips hide themselves while empty. node_modules is no longer a tracked symlink (7a62844 committed a loop; tests importing _lib.mjs failed on fresh checkouts) — run npm install if a worktree lacks it. OFF-PAGE.md's plan table re-read from PLANS.

### 2026-09-14 17:28 — f37d5d6 — wt@model/split-and-open-line (9 files since origin/main)
**tl;dr:** The money model at /moneymodel prices the shared-board split and the open line (decision 0076): every tick is a shared board render + a personal call, big rooms cost ~8× less than the page said, the arena is 'at the edge' not 'breaks', and 'Netlify + the open line' costs a little MORE (every glance is a socket). Seven real nights on the page: 9.4 phones, 2.75 h, $0.68 a head (one $10 tip is most of it). Benchmark 1,000 artists: $5,520 / $3,821 / break-even 92
**Other sessions:** CORRECTION to the 12 Sep (night) entry: the model did NOT price the split until now. finance/model-test.mjs reads the page beside it (worktree-safe) and pins eleven rooms to tools/loadsim.py — change the ladder in vote.html or loadsim.py and the suite must be re-pinned. tools/actuals.py BYTES has board/me; a mark since 11 Sep 11:17 UTC solves at 2,605 bytes a tick, a bracket the split falls inside is refused. Mark #3 (14 Sep 17:00) is the BEFORE mark for the Ugly Duckling gig — the AFTER mark is the founder's. Open-line production code is still uncommitted in .claude/worktrees/compassionate-chatterjee-41ecbe (its 0036 collides; next free is 0077). New dials: songEveryMin, edgeSpread, meMs/meReads, lineShare/reconnects/nudgeMs.

### 2026-09-14 14:18 — 5364d56 — tagline-wt@HEAD (1 files since origin/main)
**tl;dr:** Google/link previews for myset.vip now read 'Live music: fans vote, artists play.' (title, description, og:title in index.html)
**Other sessions:** Copy only, no code. Google re-crawls on its own schedule; snippet may take days to change.

### 2026-09-14 13:56 — 6c74d05 — wt@docs/artist-doors-live (4 files since origin/main)
**tl;dr:** Ledger and session note: the artist page's doors are live as a69154f (UX-047/048/049, decisions 0074/0075, INVARIANT 0fw, PR #51) [skip ci]
**Other sessions:** Docs only. Numbers now taken: UX-047, UX-048, UX-049, decisions 0074/0075, INVARIANT 0fw. Puzzle 42087 (Booking messages) + fan's night f22/f23 are Live; new sheet docs/processes/artist-lifecycle/06-booking-messages.md (the folder's 01–05 are another session's uncommitted files — do not renumber on either side).

### 2026-09-14 13:51 — fe090e3 — wt@artist/book-merch-calendar-tour (27 files since origin/main)
**tl;dr:** The artist page's doors: Songs gone and Votes cast on the numbers' line (10k / 10.1k / 1m); Book · Merch · Community beneath; Book opens a sheet whose words land in the Studio's new Messages (Requests → General on reply, Business / Casual / Spam, read/unread, Report, Block; a bubble on the Menu row) and the booker reads at a link and by email when mail is on; View calendar with dots and a night's card; a tour poster (PNG/JPEG/PDF) from the Gigs tab with View tour dates → Download + Grab your tickets (decisions 0074, 0075; INVARIANT 0fw; UX-047–049)
**Other sessions:** NEW _messages.mjs (inbox_<aid> index + msg_<aid>_<tid>; every refusal inside the index CAS; letters budgeted; the token only in POST bodies) + public messages.mjs (POST only: send/get/reply; ?v= refused); admin.mjs MSG_ACTIONS → handleMessages, CAPABILITY 'community' for msg*, msgBlock/msgReport OWNER_ONLY; tourSet/tourClear (data | link) in PROFILE_ACTIONS, planGet.tour = byte caps; _img.mjs TOUR_SLOT + decodeTourFile (never in SLOTS); profile payload carries tour + msgMax; keysFor names img_<aid>_tour, inbox_, inboxarch_ (+parts) and every msg_ — via messageKeys. _auth.mjs sendMail (no security footer). studio.js: TAB 'messages', msgPeek (never on the poll, never a timer), tourCard; loadProf now sends &a=<slug> (it read the FOUNDING page for every other artist — a pre-existing bug; test/copy.mjs's pin widened by one token); Studio steps in Puzzle 42087 are Testing until this lands. After editing studio.js run node tools/stamp.mjs. Numbers taken: decisions 0074/0075, INVARIANT 0fw, UX-047/048/049.

### 2026-09-14 12:13 — 43a7826 — wt2@accounts/password-from-code (18 files since origin/main)
**tl;dr:** Settings → Password now works from a Studio-code sign-in (pick one of the account's addresses, get a code there, set it); the Google Sheet measures itself every night, emails the founder at 60% of Google's cell limit and starts a new spreadsheet by itself at 80% (decision 0073)
**Other sessions:** auth.mjs/venueauth.mjs passwordSet accepts {email, code} from a session with no address — the address must be an owner/manager row on the account. _sheets.mjs api() now writes to activeSheetId() (useSheet), not GSHEET_ID directly; SCOPE adds drive.file; the sheet in use lives in the 'gsheet' doc. _warehouse.mjs settleSheet runs before every sync's writes; MYSET_SHEET_ROLL_PCT / WARN_PCT / GSHEET_SHARE env. INVARIANT 0fv.

### 2026-09-14 11:39 — 59fa968 — wt12@sheet/marketing-tabs (9 files since origin/main)
**tl;dr:** The Google Sheet now carries the marketing read (Signals: source, segment, nights per week, rooms, votes per phone, pack conversion, days to first show…) and feature adoption (Features: a column per feature, a score of 24) per artist, tags every Shows row real or test with its published gig, and never appends a row a log tab already holds (decision 0072). The founder's two emails are owner rows on his account
**Other sessions:** _warehouse.mjs reads ~20 more documents per artist (lists, learn, charts, lyrics, push, posts, profile, sessions, log, recovery, biz, connect, wishes, feats, meta, passkeys, rsvp, cred) — none on a hot path; artistRows returns srow/frow/venueUse/venueGigs; TABS has signals+features (11 tabs — test asserts 11). _sheets.mjs: tabTitles() returns ids; existingKeys(tab, keyCols)/rowKey; styleTabs runs every sync. syncSheet({dry:true}) returns plan. GUIDE exported. The empty sheet in the founder's Drive is 1EhMbA96ZeX9ihG_356FiBfHn9yKZNVPg-LX1-rJ52ok (GSHEET_ID when he connects it). Registry: perryidyll@gmail.com + hello@myset.vip are owner rows on perry-idyll (written by CLI per ACCOUNTS §6.4, 2026-09-14).

### 2026-09-14 11:25 — a2a9782 — wt@studio/every-question-in-the-window (8 files since origin/main)
**tl;dr:** Every question in both Studio scripts (18 confirm() calls) now opens the Studio's own small window — the browser's confirm() is gone from studio.js and studio-money.js.
**Other sessions:** ask({title,lede,yes,no,go}) in studio.js also returns a promise (true on yes, false on no/dim) — use await ask(...) for new questions, never confirm(); test/darkroom.mjs fails on any confirm( in either Studio script.

### 2026-09-14 11:12 — ace9b49 — wt@studio/song-buttons (6 files since origin/main)
**tl;dr:** Setlist song cards: edit, hide and delete all wear the delete button's soft fill (no orange outline); tapping ✕ opens 'Delete this song?' (Yes, delete it / Keep it) in the Studio's own window
**Other sessions:** studio.js: ask({title,lede,yes,no,go}) is the small centred window (was startSong's alone); #askNo is the no button. Any new destructive tap goes through ask(), not confirm() — seventeen confirm()s remain elsewhere for another day.

### 2026-09-14 10:53 — 943a8d8 — wt@studio/small-things (70 files since origin/main)
**tl;dr:** Artist Studio: Log a show closes on a drag down; Settings has a gear icon; the tab bar is a little smaller (both Studios); setlist song cards are as tall as their words with edit/hide as outlined icons above the delete ✕; Up next shows ten songs before it scrolls
**Other sessions:** lock.css .tabbar icon 19px / label 11.5px (the Venue Studio shares it). .queue-window max-height is now set by studio.js render() at the eleventh row — do not put a pixel value back in the CSS. attachDrag: .bizro counts as a grab zone and the editor no longer refuses a body drag.
### 2026-09-14 10:46 — 6fceff3 — wt11@metrics/cli-stdout (1 files since origin/main)
**tl;dr:** tools/metrics.mjs read zero artists on its first live run — 'blobs:get -O -' writes a file named '-'; it now reads stdout and refuses an empty registry out loud
**Other sessions:** One-line tool fix, no page, no function. Rebuilt the Current Show Stats page from production after: 19 nights, 7 real.

### 2026-09-14 10:42 — 16a113c — wt10@metrics/snapshot (12 files since origin/main)
**tl;dr:** Current Show Stats: one JSON snapshot of the app's records (nights placed against the calendar, money, posts, RSVPs, sign-ups) fills a page with all-time and 24h/7/30/60/90-day/custom ranges — published daily as the artifact for now, myset.vip/metrics when the founder says so; the Google Sheet's header row and row titles are bold and colour-filled on every sync (decision 0071)
**Other sessions:** NEW _metrics.mjs (pure; buildSnapshot({registry, venues, parts})), tools/metrics.mjs (read-only Netlify CLI reads by name; MYSET_SITE_DIR from a worktree; --from <backup dir>; --html fills finance/metrics.html at __SNAPSHOT__), finance/metrics.html (NOT published; served by a future metrics.mjs with included_files like moneymodel). _sheets.mjs: tabTitles() now returns ids; styleTabs(TAB_LIST) runs in syncSheet after ensureTabs. No page in public/ changed.

### 2026-09-14 10:31 — ebac7b4 — wt@docs/size-counts-live (2 files since origin/main)
**tl;dr:** Ledger and session note: the count per size is live as c4df3f0 (UX-046, decision 0064, PR #42) [skip ci]
**Other sessions:** Docs only. Numbers now taken: UX-046.

### 2026-09-14 10:24 — c030535 — wt@merch/size-quantities (31 files since origin/main)
**tl;dr:** A count per size: optional number fields under each size chip in both Studios (blank = as many as you like while the size is in stock, live as the sizes are typed); the shop strikes a size at zero, says Only N left in L once picked and stops the stepper there (UX-046, decision 0064)
**Other sessions:** variants[] now carry stock (null = uncounted) — normVariants keeps it. pay.mjs pickVariant refuses stock 0 as 'That size is sold out' and variantShort gives 409 'Only N left in <label>'; stockRefusal uses merchSoldOut (every size gone = item sold out). takeStock(list,id,qty,variant) takes the size's count first, else the item's; redeemSession passes orderRow.variant. Studio: mcVarQtyRows/mcSyncSizes (vm* in the Venue Studio); the item-level count field hides while sizes exist. Stamped.
### 2026-09-14 10:21 — bb28f55 — wt9@auth/password-door (18 files since origin/main)
**tl;dr:** Artists and venues sign in with email + password on the screen the founder specified (Welcome back · Email · Password · Sign in; New here? Join the MySet family · Create account; the Studio code in a small window off the foot); once in by a code, Settings → Password → Create; Forgot your password? = a fresh six-digit code (ACC-001, decision 0070, INVARIANT 0fu, ACCOUNTS.md §11)
**Other sessions:** NEW netlify/functions/_cred.mjs (scrypt per email row, cred_<owner>_<hash>; per-address lockout lock_pw_*). auth.mjs + venueauth.mjs: passwordSignIn (public), passwordSet {password, current|code}, passwordClear; list carries pw per email + (venue) email/me. keysFor/keysForVenue name the cred records. studio.js gate() rewritten — modes start/join/forgot/code/name/recover; sendCode(from); openStudioCode() → #pop; PW_PROMPT opens the password sheet once after a code sign-in; venue-studio.js the same. After editing either script run node tools/stamp.mjs. The Studio code door is UNCHANGED on purpose (0fu says why). Founder's standing rule: 'orange' = the brand pink-orange --accent-2.

### 2026-09-14 10:05 — 2d676ab — wt@docs/shop-second-look-live (2 files since origin/main)
**tl;dr:** Ledger and session note: the shop's second look is live as ab0a05e (UX-045, decision 0064, PR #39) [skip ci]
**Other sessions:** Docs only. Numbers now taken: UX-045.

### 2026-09-14 10:02 — 57cc7b6 — wt@merch/shop-round-two (27 files since origin/main)
**tl;dr:** The shop's second look: up to five pictures per item, chosen on the first page of Add an item and swiped through under the price on the shop; a stock count that comes down as fans buy (Only N left, sold out at zero); items re-order with ↑ ↓ (the first is on top of the community card, now larger); shipping/shipped for postage/posted everywhere; the brand ring on Browse the shop, gradient step numerals, no ⏸ on the strips, Paid to <name> in pink-orange (UX-045, decision 0064)
**Other sessions:** Merch items carry imgs[] (slots <id>, <id>_1..4 — _img.mjs MERCH_SLOT; img is ALWAYS imgs[0]) and stock (null = not counting). New netlify/functions/_merchpix.mjs (add/drop pictures, both Studios). admin/venueadmin: merchPhoto APPENDS to the next free slot, merchPhotoClear takes {slot}, new merchMove {id,dir}; merchList sends maxImgs/maxStock. pay.mjs stockRefusal → 409 'Only N left' / 'sold out'; Stripe rate display_name is 'Shipping'. _pay.mjs takeStockFor runs once per fresh claim (best-effort). keysFor/keysForVenue now list the 4 extra img slots and wishes_. Stored field names post/ship are UNCHANGED — only the words a person reads. After editing studio.js or venue-studio.js run node tools/stamp.mjs.

### 2026-09-14 01:08 — 029666e — wt8@ops/mirror-says-why (6 files since origin/main)
**tl;dr:** The mirror's first real pass was 0 copied / 69 failed: R2 refuses every PUT — and has since 2026-09-11 (r2.put 403 in the error log; both live clips are served from Blobs, not R2). The token can read the bucket, not write it: a Cloudflare permission, the founder's to fix, no deploy needed after. The ring now names the first refusal and retries hourly
**Other sessions:** P3-003 (clips on R2) is NOT working in production and never was — status blocked in the ledger; every clip upload since 2026-09-11 took the Blobs fallback. Do not build anything that assumes bytes are on R2 until the founder fixes the token (Object Read & Write on R2_BUCKET). Read a ring with: netlify logs --source functions --function mirrorcron --since 30m; the state is: netlify blobs:get myset mirror -O -. _mirror.mjs: RETRY_GAP_MS 1h after a failed pass; result carries err.

### 2026-09-14 00:48 — 1ce731f — wt7@ops/mirror-deadline (5 files since origin/main)
**tl;dr:** mirrorcron's first ring in production timed out (12.9 s, Netlify's 10 s limit) pulling the 70 MB clips through the function — now it skips vid_ (clips are already on R2 under the same key), checks the deadline after every key, and resumes a partial owner at the key it reached; budget 5.5 s
**Other sessions:** _mirror.mjs: SKIP now includes vid_; mirrorOwner(owner, keys, now, deadline, start) returns {partial, next}; the state doc 'mirror' carries keyCursor. Read the ring with: netlify logs --source functions --function mirrorcron --since 30m (netlify logs:function is gone). A timed-out ring shows Duration > 10000 ms and no 'mirrorcron:' line.

### 2026-09-14 00:23 — e4a4b66 — wt6@data/foundations (30 files since origin/main)
**tl;dr:** Every night now has an event log (every vote with its cast time, every play, refund, drop, clear, the standing votes, the money, the end — read with /api/history?log=); the profile, setlists, calendar and library keep a version before every overwrite; the community feed and feedback list no longer lose their oldest past 200; every document is copied to R2 nightly; the laptop backup's restore was rehearsed for real: 209/209 keys back equal, 287 MB, 580 s (DAT-001, decisions 0066–0069, INVARIANTS 0fq–0ft)
**Other sessions:** NEW: _append.mjs (append-only chunked log: appendLog/readLog/logKeys — use it for anything that must never be trimmed), _evlog.mjs, _versions.mjs (casKeep: use it for any new hand-edited document), _mirror.mjs + mirrorcron.mjs (*/20; skips by etag; a new per-owner key is copied only if it is in keysFor/keysForVenue). A vote row is now [cost, paid, when]. dropSongVotes/refundSongVotes/wipeBoard RETURN what they removed — a new path that takes votes off the board must file them (0fq). test/blobs-fake.mjs has getMetadata. tools/backup.py is committed for the FIRST time (it was the puzzle session's untracked file) with --restore/--wipe (refuse the store named myset) and MYSET_SITE_DIR — that session's tree now shows it modified; its DATA-MODEL.md should gain evt_/ver_/vers_/postsarch_/fbarch_/mirror_. Rebased onto 7691945 (one ledger conflict, both rows kept). Open: a hard delete does not reach backup/<key> on R2; no restore-a-version button.

### 2026-09-13 23:47 — 08d8c7b — wt@crm/dashboard-pass-two (14 files since origin/main)
**tl;dr:** The business report gets Rate settings (which hours count, Total / My cut, before or after MySet's fee — the same choices as the Studio's $/hour tile, shared through the phone); a filed night now counts the votes bought and the paid requests accepted, and the editor sheet and the report say 'N votes · free · paid · paid requests'; the Money tab's Shows list shows three and folds the rest behind Show N more
**Other sessions:** _history.mjs moneyForShow now returns votes.paid (packs' votes summed) and requests {amount,count}; the index row carries paidVotes / paidRequests (null = not asked; NOT in ROW_TOPS on purpose — Re-check fills an older night). Biz.votesLine(show). The report reads/writes the Studio's localStorage myset.biz.view and POSTs bizPrefs. Nothing else on the wire changed. PR #35.

### 2026-09-13 23:35 — 9858ce8 — wt@docs/shop-live (3 files since origin/main)
**tl;dr:** Ledger and session note: the shop is live as 406f3f4 (UX-044, decision 0064, PR #33); the founder's page lists no merch yet, so the first real item is his to add [skip ci]
**Other sessions:** Docs only. Puzzle 41974's twelve steps are Live. Numbers now taken: UX-044, INVARIANTS 0fo/0fp, decision 0064.

### 2026-09-13 23:31 — e85cae8 — wt@merch/shop-page (42 files since origin/main)
**tl;dr:** Merch has its own page at /<slug>/shop (and /v/<slug>/shop), entered from a ringed card above the tip button on the community page: a two-column grid, a product sheet with sizes and quantity, postage as a Stripe shipping rate off MySet's cut, a pickup code on the receipt, Make a request (a fan's ask lands in the Studio), What fans are saying; the Studio's Merch store is its own Menu row with orders and requests; the Venue Studio mirrors it (UX-044, decision 0064)
**Other sessions:** New routes /:slug/shop and /v/:slug/shop → public/shop.html (netlify.toml, above the catch-alls, with their own [[headers]]). pay.mjs takes from:'shop' and variant; merch items carry variants[{label,out}], out, post (normMerch caps: MAX_VARIANTS 8, MAX_POST 10000, MIN/MAX_CENTS); /api/confirm returns order{code,…}. New netlify/functions/_wishes.mjs (wishes_<owner>) + community.mjs action 'wish' + admin/venueadmin wishList/wishDone. cleanOwnerId in _pay.mjs keeps the v_ prefix — venue orders were filed under meta_v<vid>; use it, not cleanArtistId, for owners. The community page's rail and buySheet are RETIRED — do not re-add. INVARIANTS: 5b names three pages, 0f8 amended, new 0fo (shop) and 0fp (a request has no way back to the fan). After editing studio.js or venue-studio.js run node tools/stamp.mjs. node tools/mock.mjs = zero-dep mock of every page for a browser look. uicheck/sheetcheck ROOT = MYSET_PUBLIC || the public/ beside the tool.

### 2026-09-13 23:15 — d7fe0b3 — wt@docs/dashboard-ledger (2 files since origin/main)
**tl;dr:** Ledger and session note for the business dashboard: live as 81a48f3 (UX-043 / PL-003, decision 0065, PR #31); the ledger's next work item is the founder's next requests as he uses it
**Other sessions:** Doc-only. The Puzzle Money section 42066 and changelog 1647 already say 0065 and the new wording. UX-040 was taken by #28 and 0063 by #30 — the dashboard is UX-043 / 0065 everywhere now.

### 2026-09-13 23:10 — e47e6ec — wt@crm/artist-dashboard (46 files since origin/main)
**tl;dr:** Bar Star and Rock Star get the business dashboard on the Money tab: log total pay from venue, splits and your own cut, cash tips, merch, costs, hours and gear per show (or once per run on the gig form); profit in green with MySet's fee named in dollars, revenue mix, hours, Stage time rate / Full evening rate with Total–My cut and pre/post-fee toggles; Generate report prints a branded /report for any dates or picked shows (UX-043 / PL-003, decision 0065)
**Other sessions:** New: netlify/functions/_biz.mjs (biz_<aid>, casDoc, 400 KB cap on growth), public/biz.js (all the maths, runs in node), public/studio-money.js (loaded on demand; studio.js reads it only through window.Money), public/report.html; tools/stamp.mjs now has ordered PAIRS; tools/localhost.mjs runs the real functions on the in-memory fakes (node --import ./test/register.mjs tools/localhost.mjs). Filed nights carry key + source; occKey lives in _events.mjs; ledger/ledgerCsv answer enabled:false for an owner with no Connect account (INVARIANT 0fn). PLANS has band/costs caps read as numbers (PLAN.limits.band, never has('band')). Renumbered from 0063 → 0065; UX-040 → UX-043.

### 2026-09-13 23:04 — b33e66c — wt5@ux/end-before-start (0 files since origin/main)
**tl;dr:** The Studio refuses to start a song while one is playing: ▶ opens a small End current song? window (red Yes, end it / pink-orange Keep playing); End current song is a light-red fill with red text (UX-042, decision 0063)
**Other sessions:** studio.js: every ▶ must go through startSong(action,extra) — test/darkroom.mjs fails on a raw act('play'…). No server change: Yes, end it sends the same play. Decision 0063 took the next number on origin/main — the unpushed business-dashboard (0063) and merch (0064) records on other branches must renumber before they land.

### 2026-09-13 22:21 — 67199bf — wt4@ui/save-top (0 files since origin/main)
**tl;dr:** A second Save profile button at the top of the Profile tab; the voting page now gets the band/first name (the founder's show record names the artist itself, so the registry sync alone never reached the board)
**Other sessions:** admin.mjs profileSet also mutateShow()s artist + artistFirst on change. If a show record carries its own artist, getShow never reads the registry — remember that for any future field that must reach the board. Investigation of tonight's vote in docs/sessions/2026-09-13-peaceful-easy-feeling.md: no bug, a play spends the vote.

### 2026-09-13 21:56 — 34215b8 — wt3@ui/fab-live-red (0 files since origin/main)
**tl;dr:** The artist page's floating bar is red and says ENTER NOW TO VOTE while a show is on; the countdown's 'view setlist' is pink-orange. Plus the ledger/session note for UX-039 (band names + hero video, live as 34215b8)
**Other sessions:** artist.html: .act.now on the live button; nextLabel() returns HTML (<i class=vs>), the tick writes innerHTML. uicheck/test/copy assert 'ENTER NOW TO VOTE'. UX-039's production build had to be triggered from Netlify (createSiteBuild) after GitHub's outage dropped the webhook — check listSiteDeploys if a merge does not appear.

### 2026-09-13 15:57 — 12b5e24 — wt@ui/hero-video-band-name (0 files since origin/main)
**tl;dr:** A band name works everywhere a first name did (First name or band name + optional Last name on the Profile tab); with more than three videos the ticked one is the hero and the rest drift under Watch more from <First> (decision 0062)
**Other sessions:** profileSet now writes the registry row's name + first when the save carries first (CAS, only on change) — byId[aid].name is no longer sign-up-only. getShow adds show.artistFirst; board/stage payloads carry artistFirst; profile/community payloads carry first. New admin action mediaHero; media items carry hero (one, first). artist.html: mediaCard/reelCard/playMedia/ghost are module-level; startProof drifts #proof, #links, #reel. studio.js restamped 42899db1.

### 2026-09-13 15:28 — 466a907 — wt2@docs/links-strip-ledger (0 files since origin/main)
**tl;dr:** Ledger + session note for the link strip (UX-038, PR #25) [skip ci]
**Other sessions:** Docs only. The unexplained first-save drop of a Bandcamp link is recorded in docs/sessions/2026-09-13-links-strip.md.

### 2026-09-13 15:26 — b966884 — wt@ui/links-strip (0 files since origin/main)
**tl;dr:** The artist page's link pills now drift left to right under the heading Listen, follow, & support — the mirror of the proof strip above them
**Other sessions:** artist.html: startProof() is now drift(id,dir) run for #proof (+1) and #links (-1), per-strip handles in DRIFT{}; .links is a nowrap overflow strip with ghost copies (aria-hidden) — query '.links a:not([aria-hidden])' for the real pills. Studio's Profile section label still says Listen & follow.

### 2026-09-13 14:53 — 67c6d78 — wt@ui/batch-seven (0 files since origin/main)
**tl;dr:** Batch seven: every song in the library is live to the room on every plan, Bar Star holds 200, Bandcamp + GoFundMe links, plan cards reworded, installed Studio reloads after a theme toggle (decision 0061)
**Other sessions:** free featured is Infinity and plus library 200 in _plan.mjs (cap machinery kept); _profile.mjs LINK_HOSTS has bandcamp/gofundme with a wildcard hostOk(); theme.js toggle() reloads when navigator.standalone; studio.js restamped 72f3dec6

### 2026-09-13 12:00 — 740d852 — wt@ui/batch-six (0 files since origin/main)
**tl;dr:** Batch six: the plan cards in the founder's words with four rules moved in the code (free room 50, free library 100, hiding a post + data reports on Bar Star, delete-for-good gone — 0060); every accent word and Directions pill pink-orange; Tonight ringed as one box; View on MAP; tip sheets 'Give <First> some love / Sent via Stripe Connect'; carousel resumes 1 s after a hand scroll; theme.js replaces the theme-color meta so iOS repaints the band under the clock
**Other sessions:** _plan.mjs: library (libraryCap), reports (reportsAllowed), audience 50/300; moderate now gates postHide and postDelete is NOT an admin action. history.mjs GET answers a free plan {locked:'plus',nights,shows:[]} and ?show= 402 — read HIST.nights when locked. --accent-ink is #FF5650 both themes; --grad-soft is the pill ground. INVARIANT 0dy rewritten. TIER_COPY is the founder's verbatim lines: change _plan.mjs and the card together.

### 2026-09-13 10:22 — 0000bc8 — wt@ui/pink-orange-pass (0 files since origin/main)
**tl;dr:** Every thin ring on the site now runs the brand gradient (pink-red left → orange right, the Search button's fill); the audience's orange words, the section headings, the edge glow and the page menu (now two bars) take the logo's pink-orange, --accent-2 = #FF5650 (decision 0059)
**Other sessions:** Two ring recipes in docs/design-system.md §2 — a masked ::after where the ring was an inset shadow, padding-box/border-box double background on a box with a real border or an input; copy one, do not reach for a flat colour. --accent-2 is #FF5650 in app.css, studio.html, venue-studio.html; edgeGlow/tab pill glow are rgba(255,86,80,…) and studio.html/vote.html keyframes must stay byte-identical. tools/uicheck.mjs and test/decline.mjs assert the gradient (backgroundImage), not a colour.

### 2026-09-12 23:21 — 567bdb6 — wt@ui/product-dev4-batch (12 files since origin/main)
**tl;dr:** Product Dev 4: every show row is one centred card (front door, artist page, venue page) with the thin Directions pill under the date and RSVP at the edge — RSVP now on the venue page too; the map sheet drags closed; orange rings on the two chips, a quiet search bar; both Studios' tab bar has a top line, sits lower, 13px labels, the Live icon unclipped; Gigs tab rows are cards
**Other sessions:** venue.mjs rows now carry eventId + rsvp (0056 extended — no new record; PENDING row cleared). venue.html has its own rsvpTap keyed v:<slug>|event|date / <artistSlug>|event|date like index.html. lock.css .tabbar is 56px now (bodies still reserve 72px + inset). studio.js restamped ?v=d6907d62. artist.html: .dirs.thin replaces .dirs.ico; the cover's onerror drops srcset before falling back. index.html #homeMapModal carries data-nopull and #homeMapHead the drag handlers.

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
