# Push log — what each push did, for every other session

Newest first. **Read the top of this file at the start of every session**, before
`git status`, before assuming anything about what is or is not live. One entry per
push, written by `tools/pushlog.sh` as the last step before `git push`; the
pre-push hook refuses a push whose commits do not touch this file. Keep entries to
three lines: what changed for a person, then what another session must know. The
long version of any entry lives in `docs/sessions/` and `docs/decisions/`.

Several sessions work this repo at once, in different worktrees, and none of them
can see the others' chat. This file is the one place they all speak.

### 2026-10-09 15:16 — 330fd08 — quizzical-haslett-6f8f8b@deps/probe-undici (1 files since origin/main)
**tl;dr:** Nothing a person sees: the probe tool's wrangler/undici lockfile takes undici 7.29.1, closing all six Dependabot alerts
**Other sessions:** cloudflare/probe is a by-hand measuring tool (0035), never built or deployed; the site's own lockfile has only undici-types. Merged [skip ci].

### 2026-10-09 15:07 — c20aadc — song-cost@docs/0172-live (2 files since origin/main)
**tl;dr:** Nothing a person sees: decision 0172 names its live commit (7c87dbe) and the checks.
**Other sessions:** Docs only, [skip ci].

### 2026-10-09 15:05 — 8cc30bb — song-cost@ux/song-cost-free-votes (27 files since origin/main)
**tl;dr:** Artists can set how many votes a song costs (Settings → Votes per song, default 1); a fresh phone now gets 1 free vote, not 3; each setlist row has one '…' that opens the Edit/Hide/Delete sheet.
**Other sessions:** Decision 0172. show.songCost (1–20) gated like replayCost; costOf() returns it for unplayed songs. DEFAULT_FREE_CREDITS=1, VOTE_DEFAULTS_VERSION=3 migrates stored 3 (and v1's 5) to 1. vote.html: isReplay() reads played[], never cost>1. Any test that casts more than one vote must set freeCredits itself. Setlist row: .songmore + hidden .rowacts; window.rowMenu(btn) opens holdSheet.

### 2026-10-09 14:58 — 6b1b7ee — quizzical-haslett-6f8f8b@docs/pending-passcode-row (1 files since origin/main)
**tl;dr:** Nothing a person sees: the passcode box fix (8f9bde6) is now listed as owing a decision record
**Other sessions:** PENDING.md row for 8f9bde6 (_passgate.mjs); clear it with ./tools/decide.sh if anyone writes 0115-style record for the passcode door

### 2026-10-07 14:56 — fa9c189 — sample-cover@ux/sample-decks-every-visit (8 files since origin/main)
**tl;dr:** A sample's Studio (artist and venue) now shows its welcome every time it opens, and each tab's tip deck the first time that tab is opened in the visit — no longer once per phone.
**Other sessions:** studio.js / venue-studio.js: tipOnce + VISIT (in-memory Set) replace Tips.first for samples only; real accounts unchanged (once per phone); practice-round pr-* decks still once per phone. Decision 0171.

### 2026-10-07 14:34 — 21e21b3 — sample-cover@fix/bar-classics (9 files since origin/main)
**tl;dr:** CRM's Generate now suggests ten world bar classics (All of Me, Wonderwall, Wagon Wheel…) plus ten of the act's country; the American ten when the country is the US or unknown. No more genre guesses.
**Other sessions:** _fai.mjs WORLD_BAR_SONGS / US_BAR_SONGS are fixed lists; suggestSongs returns {country, songs} with groups theirs/world/home (genre/near and main/near1/near2 are gone); no model call for US/unknown without notes. 0167 superseded by 0170.

### 2026-10-05 00:33 — f4e7dab — sample-cover@docs/0169-commits (0 files since origin/main)
**tl;dr:** Decision 0169 now names the commits that shipped it (057bec0, f4e7dab).
**Other sessions:** Docs only. Linktree links for generated profiles are gathered by hand in the founder's Chrome, never by the generator (robots.txt).

### 2026-10-05 00:17 — 057bec0 — sample-cover@ux/generate-scroll-top (0 files since origin/main)
**tl;dr:** CRM: after Generate profile, and again when it finishes, the page goes back to the top where the build card is.
**Other sessions:** crm.html toTop() in startBuild('n') (desktop too, was phone-only) and bcState done for PJ. Generator does NOT read Linktree: linktr.ee robots.txt is Disallow / for unnamed bots; gather those links by hand.

### 2026-10-04 23:27 — 1486fad — sample-cover@feat/generator-notes (10 files since origin/main)
**tl;dr:** CRM's Generate form has a 'Notes for the generator' box: paste an artist's setlist and their songs go first on the page's song list, ahead of the 20 suggestions.
**Other sessions:** hq generate takes body.notes -> seed.notes; NOTES_MAX 2000 lives in _fai.mjs (crm.html mirrors it); songs call returns theirs[] -> group 'theirs' first; SAMPLE_SONGS_MAX 40; notes alone trigger the songs call (theirs only when suggestions are off).

### 2026-10-04 17:14 — 5346d28 — sample-cover@fix/sample-welcome-public (7 files since origin/main)
**tl;dr:** A sample page's welcome no longer says 'your public public pages'.
**Other sessions:** sample.js words() falls back to 'pages' (callers prefix 'public'); restamped.

### 2026-10-04 17:08 — f610365 — sample-cover@fix/sample-cover-thai-tab (15 files since origin/main)
**tl;dr:** A sample artist's page always gets a cover when it has photos of the act; with no genre known, the suggested songs lead with the country's hits; CRM opens a sample in a new tab, not a pop-up.
**Other sessions:** coverChoices has an artist fallback (best sharp act shot, coverOk first, wide>square>tall); reviewCover no longer accepts 'none' (0159 amended). openTab() in crm.html/factory.html — never pass a 3rd arg to window.open. Decision 0168; 0163–0167 commits filled.

### 2026-10-04 15:54 — 62b22f2 — sample-songs@ux/sample-photos-songs (0 files since origin/main)
**tl;dr:** CRM's Generate form takes photos uploaded from your phone or computer (six in all, the generator looks at yours first), and an artist's page now starts with 20 suggested songs on its setlist — a switch, on by default (0166, 0167)
**Other sessions:** New hq action stagePhoto {data} -> {url} (an s… unguessable /api/img address); seed.songs (hq generate sets it for artists unless body.songs===false; rebuild carries it); _fai.suggestSongs (smart model, 10+5+5, SONG_GROUPS); createSample writes payload.songs into show.songs and keeps them on sample_<owner>.songs for revive; choosePhotos now judges the founder's photos FIRST (f, y, w). PHOTO_MAX=6 in _crm.mjs.

### 2026-10-03 03:15 — 831cf9c — scale-docs@docs/scale-week-one (28 files since origin/main)
**tl;dr:** Docs: scale-audit week one recorded as live
**Other sessions:** Sheets, decisions 0138-0144/0157/0160 (commits filled; 0144: no bypass actors, suite not required), Puzzle steps/changelog 2696-2701/2703/2704 flipped to live, DATA-MODEL gains payowed (5186) and watch (5187) — neither is in _mirror.mjs GLOBALS yet; tests.yml timeout-minutes 15 -> 25.
### 2026-10-03 04:09 — eba38db — scale-p2@test/contention-sim (54 files since origin/main)
**tl;dr:** No change for a person: the crowded-room test no longer runs slower on GitHub's machine than on a Mac
**Other sessions:** tools/roomsim.mjs registers test/hooks.mjs's redirect() through module.registerHooks when present (Node >= 22.15), falling back to register(); test/hooks.mjs exports redirect(spec).
### 2026-10-03 04:06 — 7c496a0 — scale-p2-life@fix/show-lifecycle (105 files since origin/main)
**tl;dr:** A failed Decline + refund can no longer finish itself a moment later, after the artist has shown the song again (0155)
**Other sessions:** refundSongVotes now awaits Promise.allSettled over the twelve fan files and rethrows the first failure; test/refundowed.mjs has a one-file-fails, one-file-slow section. Other Promise.all-over-shards writers (dropSongVotes, consumePlayedVotes) have the same shape — not changed tonight.
### 2026-10-03 03:48 — 3faeed6 — scale-p2-reg@perf/registry-lookups (129 files since origin/main)
**tl;dr:** A room no longer reads the whole artist list to find its artist: a page address and an artist's name are two small files each, the list stays the truth (0176)
**Other sessions:** STACKED on #233. New keys aslug_<slug>, arow_<aid>, alookheal (FAMILIES skip, rebuilt from artists). New registry field seq (NOT rev). RULE: artistById/publicArtist only for a public answer or a name; access, consent, money read readArtists(). Anything writing the registry outside mutateArtists bypasses the copies (citycron heal reconciles). After #150 lands: setCode should read the registry for the slug (reverted tonight to avoid #150's hunk).

### 2026-10-03 03:08 — f2c65c3 — scale-p2-jobs@fix/background-cursors (100 files since origin/main)
**tl;dr:** Deleting an account can no longer leave files nobody can find; the nightly off-site copy keeps up with thousands of accounts; the sheet reaches past 400 artists; the front door is one read; dated off-site copies kept 90 days (the founder's answer pending) (0173-0175)
**Other sessions:** STACKED on the lifecycle PR. dropClipKeys is gone: dropClipKey(k) throws when R2 refuses. keysFor/keysForVenue take optional namers Set; deletion leaves-first (delqueue.cur, purgeStarted; Undo refused once a purge began). inTurn in _lib. cityindex gains gigs/heal (use placeGigs/upcomingAt); new hourly citycron.mjs; mirrorcron bell 20 -> 5 min. New key mirrorsnap_<date> (FAMILIES skip); R2 prefix snap/<day>/<key>.
### 2026-10-03 04:06 — 7c496a0 — scale-p2-life@fix/show-lifecycle (105 files since origin/main)
**tl;dr:** A failed Decline + refund can no longer finish itself a moment later, after the artist has shown the song again (0155)
**Other sessions:** refundSongVotes now awaits Promise.allSettled over the twelve fan files and rethrows the first failure; test/refundowed.mjs has a one-file-fails, one-file-slow section. Other Promise.all-over-shards writers (dropSongVotes, consumePlayedVotes) have the same shape — not changed tonight.

### 2026-10-03 03:08 — db2f143 — scale-p2-life@fix/show-lifecycle (83 files since origin/main)
**tl;dr:** Tapping End stops the room at once and the night is priced after, on a clock; a count Stripe could not finish says so; Decline + refund can be finished if it fails; vibes stop blocking paid requests; an accidental End on the tenth free show can be undone (0153-0156)
**Other sessions:** STACKED on #231. money.source may be 'stripe-partial' (treat only 'stripe' as known). Start/End no longer write gigsched; registercron's walkLive fills gigsched.live/regdirty (up to 300 a ring) — never re-add a shared write to start/end. show.refundsOwed + settleOwedRefund. MAX_VIBES separate. sameNightResume narrows 0120 (founder card resume-at-cap). No new blob keys.

### 2026-10-03 03:05 — b9c9680 — scale-p2-fans@perf/fan-files (60 files since origin/main)
**tl;dr:** Votes in a packed room write about a quarter fewer bytes; one network can bring about 200 new phones into a show with free votes (the founder's number still pending); the room's head count is who is still here (0148, 0149)
**Other sessions:** STACKED on #226. RULE (0149): anything that marks a phone present (seenShow) goes through settleFree. markPresence body rewritten (optional now, returns record|null; week one's PRESENCE_TRIES goes in as mutateFan's 5th arg). New _lib exports NEW_DEVICES_PER_NETWORK=200, NET_QUOTA, settleFree, freeView, freeVerdict, presenceCurrent, PRESENCE_WINDOW_MS (30 min), RECEIPTS_KEPT 20, RECEIPT_MS 30 min. No new blob keys. Known gap: _requests.mjs does not apply the cap.

### 2026-10-03 00:01 — a053560 — scale-week1@config/rate-rules (10 files since origin/main)
**tl;dr:** One machine can no longer flood MySet's server without limit: Netlify now refuses an address that sends more than 1,000 requests a second, and sign-in attempts are capped per address (0160)
**Other sessions:** netlify.toml: two [redirects.rate_limit] blocks — /api/auth (300/min/IP, its own redirect ABOVE /api/*) and /api/* (60,000/min/IP). test/roomsize.mjs fails if a poll floor or the cap changes so that a 10,000-phone room on one address no longer fits: widen the cap before lowering pollFloorFor.

### 2026-10-03 00:11 — b9a674c — scale-week1@fix/studio-two-dead-buttons (53 files since origin/main)
**tl;dr:** Two Studio buttons that did nothing now work: 'Copy them' under the recovery codes, and 'Move my account' at the end of changing your sign-in email
**Other sessions:** studio.js: JSON inside an inline handler goes through esc() — onclick="f(${esc(JSON.stringify(x))})". test/structure.mjs now fails on a raw ${JSON.stringify( inside a quoted on*= attribute. Found by the page review during the scale audit; no other page had the pattern.

### 2026-10-02 23:50 — 0a927c3 — scale-week1@ops/watch (52 files since origin/main)
**tl;dr:** MySet now tells the founder when something breaks: a push to the Studio when the scheduler stalls, a payment stays undelivered or errors pile up, plus a check from outside every five minutes that opens an alert if the site stops answering (0157)
**Other sessions:** New: _watch.mjs (look/watch), watchcron.mjs (*/10), health.mjs (/api/health, uncached, 503 with why[] when unwell), .github/workflows/watch.yml (opens/closes an issue labelled uptime; optional secret NTFY_TOPIC). New global doc 'watch' — the mirror's GLOBALS and backup.py need it, with 'payowed'. Decision 0157 is this session's (cdfdf5), outside the 0145–0156 block c8fc2f holds.

### 2026-10-03 02:51 — 359e746 — scale-week1@fix/failed-read-is-an-error (32 files since origin/main)
**tl;dr:** No change for people: a test that brute-forces a six-digit code now reads it once, so a slow test machine can't outlast the code
**Other sessions:** test/accounts.mjs guess(): read the authc_ doc once, HMAC in memory. Tests that loop over readDoc pay READ_TIMEOUT_MS's timer per call since 0142 — keep store reads out of hot test loops.

### 2026-10-02 23:50 — 8fb5115 — scale-week1@fix/failed-read-is-an-error (46 files since origin/main)
**tl;dr:** When MySet's storage hiccups, pages now say 'busy' and keep what they had instead of showing wrong numbers or signing the artist out; the vote page slows down when it cannot reach the room, never hangs on a request, and re-sends a vote the server was too busy for (0142, 0143)
**Other sessions:** readDoc THROWS on a real read failure or after READ_TIMEOUT_MS (4000, env MYSET_READ_TIMEOUT_MS): class StoreError, e.name 'StoreError', e.code 'store-read', e.message 'store-unavailable', e.key; isStoreError(e) from _lib.mjs. A missing doc is still the fallback. casDoc retries ONE failed read then throws the StoreError (not 'busy'); never writes after a failed read. guard() answers StoreError with 503 {ok:false,error:'busy'} + retry-after, and neither guard nor logErr writes it to the error log. All request handlers are now behind guard() (16 gained it) — a new one must be too. test/blobs-fake.mjs: __failReads(re,{hang}) . studio.js api(): a 5xx reply gets offline:true. vote.html: timed()/within() on every fetch, FAILS backoff in schedule(), TICKING guard, vote() loops up to 4 sends on 'busy' with one cast id (test/finality.mjs pins the new shape).

### 2026-10-02 23:50 — ae7ea42 — scale-week1@fix/scheduler-under-load (20 files since origin/main)
**tl;dr:** Shows keep starting and ending themselves as MySet grows: the scheduler now does shows first and its daily housekeeping on a time limit, and a room's phones no longer make the server re-read the whole artist list on every poll (0140, 0141)
**Other sessions:** _auto.mjs: heal({deadline}) works in HEAL_CHUNK=10 calendars per write and saves healCursor per chunk; sweep/sweepIdle take {deadline}, rotate via sched.sweepAfter / sched.idleAfter, run SWEEP_POOL=5 at once; autoTick returns settled, and an index entry may carry on:<k> (keep skip AND on when rewriting an entry for the same night; reindexSched keeps skip, drops on). live[aid] is now 'last known sign of life', not the start time. autocron.mjs: RING_BUDGET_MS=7000, order = sweep, idle, owed payments, notes, THEN heal/purge/clips. _auth.mjs: readArtistsPublic() (60 s per-instance copy) + __flushArtists; publicArtist uses it and re-asks the store for any no. Never use the copy for sign-in or pricing (INVARIANT 0hp).

### 2026-10-03 02:25 — b32291a — sample-og@ux/sample-share-card (0 files since origin/main)
**tl;dr:** A sample link pasted into Instagram/WhatsApp/iMessage now shows that artist's photo and name on its preview card, like a real artist's
**Other sessions:** 0165: artistpage.mjs sampleCard() — only when the URL carries ?sample-profile and the slug is no account; bare address unchanged (0101). Venue pages still have no share card.

### 2026-10-02 23:19 — e01e16b — scale-week1@fix/stripe-grant-retry (12 files since origin/main)
**tl;dr:** A fan's payment that could not be delivered is now retried: Stripe is told it failed (so Stripe sends it again) and MySet's own scheduler retries it within minutes. And MySet no longer refunds part of its own fee to artists on foreign cards — that correction is for venues only (0138, 0139)
**Other sessions:** webhook.mjs: a throw from redeemSession or handleBillingEvent now reaches guard() → 500; never add a catch that falls through to the 200 (INVARIANT 0hm). New global doc 'payowed' (_pay.mjs noteOwed/redeliverOwed, read once per autocron ring) — the mirror's GLOBALS and backup.py need it (phase-two session c8fc2f holds those files). _connect.mjs exports sharesStripeFee(owner); settleSplit returns {ok:true, give:0} before any Stripe call unless the plan row has splitFee (0hn). Scale audit week one (cdfdf5) next: _auto.mjs/autocron.mjs scheduler order, artist-list cache in _lib.mjs/_auth.mjs, readDoc throwing.

### 2026-10-03 02:18 — e4b23a5 — tagline-voice@HEAD (0 files since origin/main)
**tl;dr:** New sample pages get a tagline in the same magazine voice as the About (the one-liner under the name)
**Other sessions:** 0163: _fai.mjs COPY_SYSTEM + VENUE_COPY_SYSTEM tagline lines; style line stays plain; 120-char cap and facts-only unchanged.

### 2026-10-03 02:18 — 95f09a6 — sample-link@fix/sample-link-query (0 files since origin/main)
**tl;dr:** Sample links now end in ?sample-profile, so they open from Instagram DMs (Instagram dropped the #, and the page said 'No page here')
**Other sessions:** 0164: _sample.mjs linkFor + _crm.mjs build ?sample-profile; preview is ?pv=1&sample-profile (factory.mjs, hq.mjs). Pages read both forms; links sent before today still end in #.

### 2026-10-03 02:07 — bb11de5 — founder-example@docs/founder-example-0162-live (2 files since origin/main)
**tl;dr:** Docs: decision 0162 (founder's page as a live example) recorded as live as dae1080
**Other sessions:** dae1080's subject says #218 but the PR is #220. Puzzle changelog for 0162 added. Next free decision: 0163.

### 2026-10-03 02:05 — 0e8beca — founder-example@ux/sample-founder-example (10 files since origin/main)
**tl;dr:** Artist sample pages end with a 'View the founder's profile as a live example' button to /perryidyll (0162)
**Other sessions:** sample.js decorate() adds a.sbx-claim.sbx-eg after .sbx-note (artist samples only; FOUNDER const). sample.js re-stamped (v=…) in 6 pages. Andrew's tagline hand-edited in CRM to the magazine voice. 0162 claimed on the board; next free 0163.
### 2026-10-03 02:55 — 8e2d516 — scale-p2-show@fix/show-poll-split (83 files since origin/main)
**tl;dr:** A slow Play tapped twice no longer skips a song; every song stays votable in a huge room once the vote page uses the new list; each phone's check-in stops re-downloading the song library (0150, 0151, 0152)
**Other sessions:** STACKED on #219. admin play/playTop take optional tap id (show.taps, TAPS_KEPT); studio.js playAct. New endpoint GET /api/fan?what=songs&a=&v= (songs.mjs) + lean board (lean=1, tally) + board.songsV — contract in 0150, week one builds vote.html to it. me.mjs reads the show via getShowKept(aid) (conditional read vs a frozen per-instance copy); vote.mjs should follow. 0152's hot show record NOT built (design only). No new blob keys.

### 2026-10-03 02:49 — df20945 — scale-p2@test/contention-sim (64 files since origin/main)
**tl;dr:** No change for a person: the crowded-room test passes on GitHub's runner
**Other sessions:** test/contention.mjs: byte-identical repeat only on Node >= 24; on 20/22 it compares status counts + votes landed/lost. roomsim preloads every netlify/functions/*.mjs before the virtual clock.

### 2026-10-03 02:40 — fc9d1d8 — scale-p2@test/contention-sim (64 files since origin/main)
**tl;dr:** No change for a person: the crowded-room test now gives the same result twice on GitHub's runner too
**Other sessions:** tools/roomsim.mjs flush() turns the event loop until test/blobs-fake.mjs stats.calls stops moving (max 64 turns a virtual ms); the fake counts every get/set in stats.calls. Seeded runs failed to repeat on Node 22 (CI) while they did on Node 26 (Mac).

### 2026-10-03 02:05 — 412642c — scale-p2-play@fix/play-is-one-write (36 files since origin/main)
**tl;dr:** Play is one write: a vote cast just before the artist presses Play, that lands just after, no longer stays on the song that just started (0147)
**Other sessions:** STACKED on test/contention-sim (#218): merge that first. NEW RULE: anything that counts live votes from fan records calls liveFans(fans, show) first (INVARIANT 0hu). A vote row now has a FOURTH field (the plays its cast read); show.plays/show.col are written inside Play's mutateShow. _lib.mjs: normShow, chargeVotes, liveFan/liveFans above voteCounts — week one's readDoc change is a different region. test/blobs-fake.mjs gains __slowReads(ms, re).
### 2026-10-03 02:15 — 61229d0 — scale-p2@test/contention-sim (36 files since origin/main)
**tl;dr:** No change for a person: the test run's temporary key log now starts on GitHub's Linux runner as well as on a Mac
**Other sessions:** #218's suite check failed in 8 s on 'mktemp: too few X's'; test/run.sh now uses mktemp "${TMPDIR:-/tmp}/myset-keys.XXXXXX".

### 2026-10-03 02:02 — 3ff2f52 — scale-p2@test/contention-sim (26 files since origin/main)
**tl;dr:** The test suite now runs a crowded room on every pull request, and every kind of saved document now has an off-site copy or a stated reason it has none; the off-site copy was read back and restored in a rehearsal (0145, 0146)
**Other sessions:** NEW RULE once merged: a new kind of blob key needs a line in _mirror.mjs FAMILIES or the suite's last step (test/keyfamilies.mjs) fails; test/run.sh exports MYSET_KEYLOG. test/blobs-fake.mjs gains __latency (keep it beside week one's __failReads when rebasing). keysFor gains bugs_; keysForVenue gains vpitch_, push_v_, gigok_ (now deleted with their account). PR for 0147 (Play is one write) is stacked on this branch.

### 2026-10-03 01:54 — 1e58aeb — about-voice@docs/about-voice-0161-live (3 files since origin/main)
**tl;dr:** Docs: decision 0161 (magazine-voice About) recorded as live as 72dbe98
**Other sessions:** Puzzle changelog 2708 (0161). Andrew's sample was re-picked by hand on 2026-10-03: the cover is his current IG portrait and the avatar is a B&W tagged photo; don't rebuild it with Keep unticked.

### 2026-10-03 01:53 — 33740d5 — about-voice@ux/about-magazine-voice (5 files since origin/main)
**tl;dr:** New sample pages get a fun, magazine-style About instead of a plain one (0161)
**Other sessions:** Only the copy prompts in _fai.mjs changed: bio and venue about ask for a magazine voice with one wink of humour; facts-only, src, no-hype and two-sentence rules unchanged; tagline/style stay plain. Decision 0161 (0160 is cdfdf5's rate rules, still in #210).

### 2026-10-03 00:18 — 4dc1301 — photo-roles@docs/about-cover-0158-0159-live (0 files since origin/main)
**tl;dr:** Docs: decisions 0158 and 0159 recorded as live (cb2272f, 1a4456b), session note, status header [skip ci]
**Other sessions:** Puzzle changelog 2694 (0158), 2695 (0159). Andrew's sample is fixed by hand (cover = Pinch live at The Hollow); don't rebuild it with Keep unticked or the hand-picked photos go.

### 2026-10-02 23:49 — 54d8ec3 — escape-management@ops/ci-and-watch (6 files since origin/main)
**tl;dr:** The test check on pull requests takes about six minutes; its first run passed
**Other sessions:** Nothing new beyond the entry below: 0144's record now quotes the first run of the suite check (5 m 40 s, Node 22, ubuntu).

### 2026-10-02 23:42 — 853042d — escape-management@ops/ci-and-watch (5 files since origin/main)
**tl;dr:** Every pull request now runs the whole test suite on GitHub before it can be merged (0144)
**Other sessions:** New check 'suite' (.github/workflows/tests.yml). RULE CHANGE: never put the skip-ci marker in a BRANCH commit any more — it stops the check running; docs-only merges put it in the merge subject instead (gh pr merge --squash --subject '… [skip ci] (#n)'). Decision numbers 0138–0143 are in open PRs from session cdfdf5 (#205 and two stacked branches); 0144 is this one.



### 2026-10-02 23:59 — cb2272f — photo-roles@ux/cover-review (0 files since origin/main)
**tl;dr:** Sample page builds: the cover is now chosen twice: the best four candidates go back to the model side by side and it picks the one the act would be proudest of; live videos beyond the top three now give frames too (0159)
**Other sessions:** _fai.mjs: coverChoices(), reviewCover() (COVER_SYSTEM, call 'cover'), pickPhotos({cover}) picks the rest around a given cover. _factory.mjs: LIVE_TITLE, up to 2 live-titled videos past the top 3; choosePhotos runs the review unless late, a failure keeps the picker's choice (errors.cover). 0158 commits set to cb2272f.

### 2026-10-02 23:49 — d8a3e56 — photo-roles@ux/about-two-sentences (0 files since origin/main)
**tl;dr:** Artist and venue pages: the About is two sentences with a space between them, no line; the generator now writes exactly two (0158). Andrew's sample has a new cover (him singing live at The Hollow) and three small photos; his and Sand & Tan's Abouts rewritten to two sentences
**Other sessions:** app.css .aline: 1em gap + rise, no hairline (stamped into nine pages). _fai.mjs tidyCopy: most 2, cap 400, an overflowing sentence is skipped, not a stop. Andrew's photos and both Abouts were CRM data edits (addPhoto by i.ytimg URL, edit bio), not code. Decision 0158; 0138-0157 belong to the scale-audit sessions.

### 2026-10-02 23:07 — cd6851a — escape-management@fix/escape-management-name (1 files since origin/main)
**tl;dr:** Artist page: a label or management name is now shown as plain text, so markup typed into it can no longer run on the public page
**Other sessions:** artist.html only: esc(P.management) in the links pill. Scale audit week one (session cdfdf5) has more coming: webhook.mjs, _feesplit.mjs, _auto.mjs, _lib.mjs readDoc/publicArtist, vote.html — see the sessions board row before touching those.

### 2026-10-02 13:24 — 5bc54d8 — photo-roles@docs/sample-0135-0137-live (5 files since origin/main)
**tl;dr:** Docs: decisions 0135, 0136, 0137 recorded as live (5c0f812), session note, status header [skip ci]
**Other sessions:** Puzzle changelog 2662 (0135) completed, 2669 (0136), 2670 (0137). Andrew's live sample still has the music-video cover: swap in CRM or rebuild with Keep unticked. #199 closed, folded into #201.

### 2026-10-02 13:20 — 5d883f1 — photo-roles@ux/sample-photo-roles (30 files since origin/main)
**tl;dr:** Sample pages: the 'Hey …' welcome opens every time the link is clicked (artists and venues), an artist's cover must show them playing or be a proper band photo (never a music-video scene), three small photos with the strip straight when fewer; also carries #199 (About one line per sentence, cover crop) (0135, 0137)
**Other sessions:** sample.js: Tips.open when the address has the sample-profile label, Tips.first otherwise. _fai.mjs: PHOTO_KINDS gains video-scene; pickPhotos(judged,{kind,again}) — artist cover kinds performing/group/portrait, three extras with a second-frame pass; _factory.mjs enough() wants 3 extras counted without that pass. artist.html: the strip nudge is .pth:first-child:nth-last-child(3). #199 is folded in here and will be closed.

### 2026-10-02 01:48 — 09041ca — photo-roles@ux/sample-photo-roles (12 files since origin/main)
**tl;dr:** CRM's page tab shows a sample's photos where the page shows them (Cover, Main/Profile shot, Small top/middle/bottom), drag or 'Swap with' to rearrange, a Generator notes box the next rebuild reads, and Rebuild now keeps the photos, hours, menu link and rating unless unticked (0136)
**Other sessions:** factory.mjs: new actions arrange {order} and notes {notes}; addPhoto places by role (ROLES/rolesOf/writeRoles in _sample.mjs) and stores under an unused slot name; rebuild takes keep (default true) → job.keep → createSample keptOf/eraseData(spare). sampleDetail profile.roles is the one order. Seed.notes ≠ the contact's private note. Decision 0135 is on #199: whichever merges second regenerates overview + decisions README.

### 2026-10-02 01:37 — 682f9fc — wt4@dash/headings (1 files since origin/main)
**tl;dr:** Master dash: Show log window heading 'Every stat from every show'; Media Dash heading reads 'N views | N followers' (7-day views, today's followers)
**Other sessions:** dash.html only; #mdF holds followers, counted up beside #mdN.

### 2026-10-02 01:06 — f7f9aaf — sample-about@ux/sample-about-cover (14 files since origin/main)
**tl;dr:** Venue pages and sample artist pages: the About reads one sentence a line with a hairline between, and a cover with no focus point crops to the busiest part of the photo
**Other sessions:** fan.js gains aboutLines() and coverFocus() (never redeclare them); app.css .aline (stamped). Artist pages split only when window.__sample.

### 2026-10-02 00:55 — a6caa6d — wt4@dash-crm-heading (1 files since origin/main)
**tl;dr:** The master dashboard's CRM window now has the heading 'Automatic profile generator and contact list'
**Other sessions:** dash.html only; reuses the .stat.goal style from the money window.

### 2026-10-01 21:11 — 86b8384 — wt4@dash-money-goal (1 files since origin/main)
**tl;dr:** The master dashboard's money model window is headed '2027 Q2 Goal: $10,000/Month Profit', and revenue, costs and profit all start from zero
**Other sessions:** dash.html only: the goal heading is always shown (no longer the real-nights count-up); the real-nights count moved into the small line under it when live.json answers. A [0,0,0] point is prepended to the lines.

### 2026-10-01 20:46 — 6fa3630 — venue-hero@docs/venue-0131-0134-live (0 files since origin/main)
**tl;dr:** Docs: decisions 0131 and 0134 recorded as live (db02acf), session note, status header [skip ci]
**Other sessions:** Sand & Tan's hours, menu link and Google rating (4.5/1,079) were filled through CRM's edit action on production; do not refill. Not rebuilt.

### 2026-10-01 20:09 — 8b3ed35 — wt4@dash-followers-line (25 files since origin/main)
**tl;dr:** Money model window: revenue, costs and profit amounts now sit in a small key along the bottom instead of beside the line ends
**Other sessions:** dash.html only; .triKey legend, end dots stay on the lines. Profit ink darker in light mode.

### 2026-10-01 20:06 — af47cfd — wt4@dash-followers-line (3 files since origin/main)
**tl;dr:** The master dashboard's money model window now draws three lines, revenue, costs and profit, growing from no artists to the default scenario's month, then fades and draws again
**Other sessions:** Amounts never leave the passcode: model.html dashPeek() writes localStorage myset.dash.money (25 points, one month at each size, P0 + live actuals as the page lays them); /dash reads it, else draws unlabelled shapes. Old single green curve removed.

### 2026-10-01 19:55 — 5defe78 — wt4@dash-followers-line (1 files since origin/main)
**tl;dr:** The master dashboard's Media Dash window now has a blue followers line that draws itself through the views bars, lands on today's count, fades and starts again
**Other sessions:** dash.html only: line points are followers at each post's publish time (last account reading at or before it), plus today's count at the right edge; own y-scale, no axis. Reduced motion shows it still.

### 2026-10-01 20:02 — d812fc7 — venue-hero@ux/venue-hero (23 files since origin/main)
**tl;dr:** Venue pages: a Google rating pill under the address (stars, review count, 'as of Oct 2026') that opens their Google reviews; a sample's hours, menu link and rating can be filled from Google in CRM → Edit profile → Details; a sample with no hours found no longer shows a made-up 5 pm–1 am
**Other sessions:** Decision 0134 on #182. _factory.mjs humanHours(text) → parseHours (one reader). Venue profile gains rating {stars,count,at}; factory 'edit' takes hours/menuUrl/rating for venues; sampleDetail returns hours/menuUrl/rating. createSample closes every day when no hours were found and the template is untouched.

### 2026-10-01 18:58 — 02a8aae — wt4@dash-logo-home (6 files since origin/main)
**tl;dr:** The MySet logo on every dashboard (money model, Show log, Media Dash, CRM, sample-page console, business report) now goes to the homepage
**Other sessions:** CRM and factory logos used to go to /studio; now '/'. Media Dash and report marks became <a> with color:inherit. Content repo twin pushed (cb64d14).

### 2026-10-01 17:16 — d54af8d — wt4@meters-and-pack-price (15 files since origin/main)
**tl;dr:** Money: Stripe's card fee on an artist's night is the artist's, so MySet profit, both Show log tier tables and the money model's tier table no longer take it off MySet (still off on the founder's own nights); Netlify costs now include tax ($5.48 a pack); fresh server meters after the 25 Sep bell: 2.72 credits a show (was 2.98)
**Other sessions:** wt4 (0133): _showcosts myset.stripeMine; TIER MATH subtracts t.stripeMine (both pages, still byte-identical); model hosts taxMul 1.096; credits.json reading 1 Oct with perDay.bandwidthCleanFrom (solve_meters honours it). Tick rate 16.9/phone-h rests on 2 nights and one empty day (26 Sep, 12 deploys) — thin, re-read when another empty day lands. Current Show Stats scheduled task disabled.

### 2026-10-01 16:20 — c4a8a57 — MySet-books-docs@docs/books-clock-ledger (2 files since origin/main)
**tl;dr:** Docs only: the ledger and a session note record the test/books.mjs clock fix (c0fdbf0, #191). [skip ci]
**Other sessions:** Nothing to redo. The suite is green end to end again (5,085 ✓); any red suite from here is new.

### 2026-10-01 16:19 — ce88275 — MySet-books-clock@test/books-clock (3 files since origin/main)
**tl;dr:** test/books.mjs passes again in October: the venue ledger check pins the clock instead of following the wall clock. The full suite runs to the end again.
**Other sessions:** Test-only. The bug was the test mixing a pinned NOW (15 Sep) with a handler on the real clock; venueadmin ledger logic is right and unchanged. Pattern for any handler without a now: stub Date.now = () => NOW around the call, restore in finally.

### 2026-10-01 15:43 — 770d9d1 — wt4@audit/dashboards-oct1 (14 files since origin/main)
**tl;dr:** The 1 Oct audit of every dashboard number (0132): the money model's free plan is ten shows in total, not four a month (Plus crossover $56.60, was $418.77); Show log cost totals add up; the Media Dash no longer counts a deleted duplicate reel (26 posts, not 27); CRM funnel rails are a true rate; stale typed numbers now read the live register
**Other sessions:** dashboards-wt4: finance/model.html freeCap is a LIFETIME total (test pins it to _plan.mjs gigs); cut base = merch amount − postage in _showcosts.mjs and both tier tables; register totals gained peopleKnown + merchPostage; mediadash.mjs dedupes posts by id. Left open for the founder: Stripe inside 'MySet profit' on connected artists, $5 vs $5.48 a pack, meters after the register bell.

### 2026-10-01 14:46 — 730be56 — wt4@showlog-bullets (1 files since origin/main)
**tl;dr:** Show log: the intro, both table notes and the seven 'How these numbers are made' cards are now short coloured bullet points
**Other sessions:** ul.pts / ul.lede in finance/shows.html mirror the money model's; text only, no math or columns changed.

### 2026-10-01 13:20 — 6aa5158 — wt4@model-bullets (1 files since origin/main)
**tl;dr:** Money model: the dials column folds away (remembered per browser); every long explainer is now short coloured bullets; the size table is '4 core show categories' with its dial group 'Core show sizes'
**Other sessions:** ul.pts is the bullet style in finance/model.html; dial groups are details.grp inside #dialsList. Text only otherwise — no math changed.

### 2026-10-01 13:05 — f9ffe08 — wt4@ux/paying-founder (3 files since origin/main)
**tl;dr:** FIX: the money model's top tiles showed ∞ since this morning (a comment hid three dials); now right again. Show log: 'If the founder were a paying customer' toggle on both tables, a clearer Money model button and a link by the tier table; money model hero's y no longer clipped and its intro is bullets
**Other sessions:** mine(r) in finance/shows.html = costs.myset, re-priced on the account's plan when PAYING. test/everyshow.mjs now fails if a P0 dial sits after a // on its line.

### 2026-10-01 12:44 — 61c8176 — wt4@fix/tier-seed-packs (1 files since origin/main)
**tl;dr:** Money model tier table: vote packs start at the real average even before the register refolds
**Other sessions:** tpLive() derives packsAmount = gross − tips − paid requests when live.json lacks it.

### 2026-10-01 12:41 — 4b9f19b — wt4@feat/tier-tables (5 files since origin/main)
**tl;dr:** Show log: a 'Profit by membership tiers' table under the main one (totals and a show on average, per plan, as-if or as-played); money model: the same table with every input editable (shows, dollars by source, MySet fee, plan prices)
**Other sessions:** tierMath() is duplicated word for word in finance/shows.html and finance/model.html — test/everyshow.mjs fails if they drift. STRIPE_RATES gained billingPct 0.7 (plan fees only). live.json totals gained packsAmount, paidRequests, paidRequestsAmount. P0.freePrice is new and only the projection reads it.

### 2026-10-01 12:19 — cbaecb2 — wt4@ux/showlog-plan-fees (1 files since origin/main)
**tl;dr:** Show log: a Plan fees column ($10/mo, $20/mo in blue) right after Artist replaces the blue plan tag; MySet profit now reads 'on transactions' underneath; plan names say Bar Star / Rock Star
**Other sessions:** PLAN_USD in finance/shows.html mirrors _plan.mjs prices; founder shows $0/mo (never charged). Profit math unchanged.

### 2026-10-01 12:04 — 7b85798 — wt4@feat/dash-about-link (1 files since origin/main)
**tl;dr:** /dash: an 'About MySet' link at the top goes to /about; the MySet logo now goes to the home page
**Other sessions:** Top-bar only in public/dash.html; the clock hides under 560px to make room.

### 2026-10-01 01:07 — 6275f41 — wt3@ux/dash-links-profit (53 files since origin/main)
**tl;dr:** Every dashboard (Show log, Media Dash, CRM, money model) has a Dash button back to /dash; the Show log has a MySet cut column ($ and %) and MySet profit is now the cut minus the server AND Stripe
**Other sessions:** costOf().myset.usd = fee − server − stripe (founder's word, 2026-10-01; the earlier 'Stripe not subtracted' reading is superseded). mediadash.html twin in the content repo updated alongside.

### 2026-10-01 01:07 — 9fde2c7 — venue-pages@docs/venue-pages-live (0 files since origin/main)
**tl;dr:** Docs: venue batch (0126-0129) recorded as live; the dash record renumbered 0127 -> 0130 [skip ci]
**Other sessions:** Decision 0127 is venue plans/tips/fee; the Show log lock + /dash is now 0130 (comments in netlify.toml, _auth, _showlock, moneymodel, dash.html, everyshow updated; no behaviour change, no build). Claim numbers on the sessions board.

### 2026-10-01 01:03 — 096d812 — venue-pages@feat/venue-pages (48 files since origin/main)
**tl;dr:** Venue pages batch brought up to date with main (dash hero, show-log profit, locks) before merging
**Other sessions:** Merge of origin/main into feat/venue-pages; only the push log conflicted (entries interleaved by time). Suite 5076/0.

### 2026-10-01 00:54 — 5349286 — wt3@ux/dash-hero (1 files since origin/main)
**tl;dr:** /dash: the g in the greeting is no longer cut off; the line under it now reads 'What is tracked can be measured, and what is measured can be improved.'
**Other sessions:** Copy and one CSS line in public/dash.html.

### 2026-10-01 01:48 — e0f67aa — venue-hero@ux/venue-hero (18 files since origin/main)
**tl;dr:** No change for people: re-pushed so Netlify builds the #182 preview (its first build could not find the PR)
**Other sessions:** Same tree as the previous push.

### 2026-10-01 01:31 — 1aa42bc — venue-hero@ux/venue-hero (17 files since origin/main)
**tl;dr:** Venue pages: never an empty cover (last photo stands in; the generator takes a venue's best wide photo); Menu / Events / What guests say / Directions as a 2x2 beside the square; links right under the tagline; extra photos swipe in the lightbox instead of a stray rail
**Other sessions:** Decision 0131. venue.html: GALLERY + lbStep (swipeable lightbox), jump(id) to #vmenu/#vevents, .vdoors; prail and the Find them section are gone; sample.js no longer hides .vcomm (gone). parsePage(html,base,'venue').menu -> readSite.menu -> payload.menuUrl -> sample p.menu.url. pickPhotos: venue cover fallback >=800px wide.

### 2026-09-30 14:27 — 45f6ed6 — wt3@ux/dash-and-locks (9 files since origin/main)
**tl;dr:** New myset.vip/dash (four windows: Show log, Media Dash, CRM, money model); the money model needs no passcode now; the Show log opens with the CRM's passcode on the CRM's lock screen
**Other sessions:** Decision 0127. _showlock.mjs: CRM passcode (HQ_PASSCODE), own tries doc 'showlock', cookie slk Path=/moneymodel. _hqlock tryPasscode/shutUntil take a doc. moneymodel.mjs: only /shows* is gated; /moneymodel + live.json open; _passgate gate() now unused. 'dash' reserved.

### 2026-09-30 14:20 — 5cf24f3 — venue-pages@feat/venue-pages (53 files since origin/main)
**tl;dr:** Venues: pages lead with their photos and the next three shows (See more for the rest, links drift); venues approve or deny the shows artists list there (recurring confirmed once); a Tip the staff button on both plans; fee 25% Free / 5% Pro; five photos Free; hiding posts is Pro; the Pro card says Everything in Free, plus; testimonials gone; a Suggestions & feedback button
**Other sessions:** Decisions 0127-0129 (0126 is #175, included here). VENUE_PLANS: photos 5/12, cut .25/.05, tips both, moderate Pro; VENUE_NOT_BUILT ['speakerVotes']. pay.mjs ?v= takes kind tip; shapeVenue.tipsOn. gigok_<vid> (_gigok.mjs), venueadmin gigList/gigSet/suggest, venue.mjs listings() shared, rows carry confirmed. suggest doc + Sheet tab Suggestions (13 tabs). Samples store p0-p4 for venues. tools/localhost /dev/venue.

### 2026-09-30 14:13 — 09d1377 — wt3@ux/show-log-profit (6 files since origin/main)
**tl;dr:** Show log (was 'Every show') has a MySet profit column after Costs; the CRM's theme button is the Media Dash's 34px size
**Other sessions:** costOf() now returns myset {usd, fee, cut, founder, estimate}: plan cut (PLANS[plan].cut) × (room total + merch) − server; founder nights cut 0. Stripe fee deliberately NOT subtracted (paid by the connected account). moneymodel gate title is 'Show log'.

### 2026-09-30 14:00 — 97a9b2e — venue-pages@fix/crm-twins (16 files since origin/main)
**tl;dr:** CRM no longer shows a generated page twice (Sand & Tan did); the Studio welcome card reads 'Look around: every tab explains itself'
**Other sessions:** Decision 0126: samplereg rows carry cid (the CRM contact that asked); adoptOrphans(reg, crm, {jobs}) links it instead of adopting; dropTwins erases an untouched twin on each summary. tips.js restamped everywhere.

### 2026-09-30 13:37 — 31de66c — wt3@ux/crm-name-toggle-icon (35 files since origin/main)
**tl;dr:** The /crm page is called CRM everywhere instead of HQ; every light/dark button now shows the Media Dash's half-moon icon
**Other sessions:** Only words changed: hq.mjs, /api/hq, the hqk cookie, HQ_PASSCODE and data-act=lockhq keep their names on purpose. theme.js paints '◐' always (no sun/moon swap). studio.js/venue-studio.js restamped. Docs/decisions still say HQ as history.

### 2026-09-30 13:03 — 9b6d767 — wt3@ux/theme-ripple (13 files since origin/main)
**tl;dr:** The money model, the register (/moneymodel/shows) and the Media Dash now switch light/dark with the same circle wipe from the button as HQ and /about
**Other sessions:** Each page carries its own small ripple(btn, swap) helper (they do not load theme.js: separate storage keys). public/mediadash.html has a twin in the content repo's publish/dashboard.html — keep them identical. /about already had the circle via theme.js; unchanged.

### 2026-09-30 13:00 — 2374305 — alert-tap@docs/alert-tap-live (3 files since origin/main)
**tl;dr:** Docs only: decision 0125 and the ledger say the alert-tap fix is live [skip ci]
**Other sessions:** 0125 live as 3c161bd (#171).

### 2026-09-30 12:57 — 98cc943 — alert-tap@fix/alert-tap-lands (9 files since origin/main)
**tl;dr:** Tapping an alert now opens the app it is for: a venue alert brings up the Venue Studio even when the artist Studio is open too
**Other sessions:** Decision 0125, on the founder's word: sw.js notificationclick focuses an open window whose first path segment matches the alert's url (appOf), else openWindow(url). Cache name, fetch rules unchanged. test/sw.mjs +6. A focused app is not switched to the alert's tab (no reload by design).

### 2026-09-29 23:59 — 0352ae5 — venue-push@docs/venue-push-live (3 files since origin/main)
**tl;dr:** Docs only: decision 0124, the ledger and a session note say push alerts for venues are live [skip ci]
**Other sessions:** 0124 live as db35911 (#169).

### 2026-09-29 23:56 — 6486e3e — venue-push@feat/venue-push (20 files since origin/main)
**tl;dr:** Venues can switch on push alerts (Venue Studio → Settings → Alerts): a new ask to play, an artist writing back, a merch order
**Other sessions:** Decision 0124. Venue phones live in push_v_<vid> (same owner id as venue sessions, so venue sign-outs already drop them); notify() reads the venue registry for owner ids starting v_, and every venue seat hears a {tab} alert. venueadmin pushKey/pushOn/pushOff (CREW_OK; pushKey takes endpoint, answers mine). _pitch.mjs tellVenue; venueUnread(vid, aid, text) now pushes. Venue Studio reads ?tab=.

### 2026-09-29 21:48 — 323fce6 — pitch-msgs@docs/pitches-live (3 files since origin/main)
**tl;dr:** Docs only: decision 0123, the ledger and the session note say venue pitches as conversations are live [skip ci]
**Other sessions:** 0123 live as 0c4bde2 (#167); Puzzle changelog 2535.

### 2026-09-29 21:45 — ed7eff3 — pitch-msgs@feat/pitches-in-messages (22 files since origin/main)
**tl;dr:** Asking a venue for a spot is now a conversation: it lands in the artist's Messages (new Venues folder), the venue replies from its Venue Studio, and Keen / Not this time each send one line
**Other sessions:** Decision 0123. Pitch rows carry tid (thread in msg_<aid>_<tid>, kind 'pitch', folder 'venues') and vunread; new venueadmin actions pitchThread (CREW_OK) and pitchReply (MANAGER_OK); FOLDERS gains 'venues' (counts too); msgBlock refuses kind 'pitch'; _pitch.mjs imports _messages.mjs (and _messages lazily imports _pitch). Studio ?tab=messages&f=venues opens the folder.

### 2026-09-29 21:01 — 101a6b0 — tip-decks@docs/tip-decks-live (1 files since origin/main)
**tl;dr:** Docs only: session note for the tip-deck copy pass (live as 0a90d08) [skip ci]
**Other sessions:** Open: venue pitches (_pitch.mjs) may move into Messages; awaiting the founder.

### 2026-09-29 20:50 — a63423e — tip-decks@ui/tip-deck-copy (11 files since origin/main)
**tl;dr:** Studio tip cards: payouts say every Monday (Hobbyist) or daily (paid plans); no more Spotify-playlist promise; Money gets Total/My cut and all-in hourly-rate cards; Gigs' last card explains recurring pay; the ? button glows; the repeat arrows turn counter-clockwise
**Other sessions:** tips.js: {payday} var filled by studio.js tipVars() from PLAN.plan (mirrors _connect.mjs payoutScheduleFor); Money deck may have 5 slides (test/tipdecks allows it); the Ask-a-venue slide is gone pending a decision on moving pitches into Messages. about.html + the setlist empty state no longer mention Spotify playlists. lock.css .tipsbtn animation tipsglow. Rebased on 0122 (413d116).

### 2026-09-29 20:41 — 3fea26a — docs-0122@docs/discard-guard-live (3 files since origin/main)
**tl;dr:** Docs only: decision 0122, the ledger and a session note say the discard guard is live; money is confirmed not a trigger [skip ci]
**Other sessions:** 0122 live as 413d116 (#162). Real night = 60+ min AND 5+ votes (REAL_NIGHT); money named in the warning, never a trigger, by the founder's word.

### 2026-09-29 20:32 — 87e6937 — discard-guard@fix/discard-guard (15 files since origin/main)
**tl;dr:** Free artists: discarding a real show (over an hour, 5+ votes) now asks first; the first one is given back with a warning, later ones count. Every free-plan discard is listed on the Sheet's new Discards tab.
**Other sessions:** Decision 0122. endShow(discard) may return {confirm} -> admin answers 409 {ok:false, confirm}; the Studio re-sends with ack:'warned'|'counted'. show.discardWarnedAt (normShow), meta.discards (last 30), REAL_NIGHT/discardVerdict/nightVotes/nightPaid in _lifecycle.mjs. act() in studio.js now returns the response. The Sheet has 12 tabs.

### 2026-09-29 19:58 — 019bf6f — contradictions-0119@docs/0120-live (3 files since origin/main)
**tl;dr:** Docs only: decision 0120, the ledger and a session note say ten free shows in total is live [skip ci]
**Other sessions:** Decision 0120 = 9adf0be (#158); Puzzle changelog 2533.

### 2026-09-29 19:52 — 4b1849a — contradictions-0119@docs/contradictions-0119 (28 files since origin/main)
**tl;dr:** A free show the calendar started by itself, with no votes all night, no longer uses one of the ten.
**Other sessions:** show.freeNight now carries auto (set by countGig(sh, by) when by==='schedule'); quietAutoNight(show, fans) in _lifecycle.mjs decides the give-back in endShow and, for a still-running night replaced by a fresh one, in startShow. An artist-started quiet night still counts.

### 2026-09-29 19:44 — 57db21e — theme-circle@docs/theme-circle-live (3 files since origin/main)
**tl;dr:** Docs only: the ledger, decision 0121 and the session note say the theme circle is live [skip ci]
**Other sessions:** Nothing to rebase for. Decision 0121 = d10d24e (#159).

### 2026-09-29 19:40 — 84f583c — theme-circle@ui/theme-circle (5 files since origin/main)
**tl;dr:** Every MySet page's light/dark button now reveals the new theme as a circle growing from the button (like HQ's); instant as before on older phones or with Reduce Motion
**Other sessions:** Decision 0121. public/theme.js: toggle(el) uses document.startViewTransition + clip-path on ::view-transition-new(root), injects its own CSS; the iOS home-screen reload and the scroll nudge wait for vt.finished. .theme-now kills transitions for one frame.

### 2026-09-29 19:40 — d7adba8 — contradictions-0119@docs/contradictions-0119 (22 files since origin/main)
**tl;dr:** Free plan is now 10 shows in total (not 10 a month); a discarded show gives its count back; the Studio shows 'Hobbyist · x/10'. Plus six places where pages or docs said something the code doesn't do are fixed.
**Other sessions:** Decision 0120 (reverses 0037), INVARIANT 9d9 rewritten. gigMonth, gigMonthOf and the Studio's monthKey are GONE; show.gigCount is lifetime free shows and show.freeNight records what the current night used; countGig/uncountGig in _lifecycle.mjs. The stage payload no longer sends gigMonth.

### 2026-09-29 17:59 — 6383aec — sample-profiles@docs/terms-live (3 files since origin/main)
**tl;dr:** Docs only: the ledger, decision 0119 and the session note say the terms page is live [skip ci]
**Other sessions:** Nothing to rebase for. Puzzle changelog 2526 = 0119.

### 2026-09-29 17:46 — d8857e9 — sample-profiles@pages/terms (16 files since origin/main)
**tl;dr:** myset.vip/terms: plain-language terms of use (who the seller is, votes final, request holds, refunds, plans, content rules, Tennessee law), linked from the footers and under every create-a-page button
**Other sessions:** Decision 0119. public/terms.html is a claim about the code, like privacy.html: a change to the seller, refunds, holds, plans, cancellation or deletion updates it in the same PR. No prices on it on purpose. The 0119 record lists six page/doc-vs-code contradictions found and NOT fixed.

### 2026-09-29 17:08 — 9f2b1c0 — sample-profiles@docs/privacy-and-gmail-live (0 files since origin/main)
**tl;dr:** Docs only: the ledger, decision 0118 and the session note say the privacy page and HQ's Gmail are live [skip ci]
**Other sessions:** Nothing to rebase for. Gmail: Google project myset-510109, OAuth app published 2026-09-29; GMAIL_CLIENT_ID/SECRET Production only. Puzzle changelog 2524 = 0118.

### 2026-09-29 17:04 — 654a61a — sample-profiles@pages/privacy (0 files since origin/main)
**tl;dr:** myset.vip/privacy is live-ready: a plain-language privacy notice (what the audience, artists, sample pages and HQ's Gmail keep, who handles it, how long, how to delete), linked from the home and About footers
**Other sessions:** Decision 0118. public/privacy.html is a claim about the code: any change that stores something new, adds a processor or changes a retention period updates it in the same PR. Its Gmail section is what Google reviews for HQ's OAuth app (project myset-510109).

### 2026-09-29 15:21 — 08fad16 — sample-profiles@ui/dashboard-favicons (0 files since origin/main)
**tl;dr:** The money model, its passcode page, the shows log and the media dash now show the MySet icon (three pink-orange bars) in the browser tab, the same one as HQ
**Other sessions:** Same data-URI icon line as public/crm.html in finance/model.html, finance/shows.html, _passgate.mjs gatePage and public/mediadash.html. mediadash twin (engine publish/dashboard.html) updated to match: 7aec18e in myset-content.

### 2026-09-28 20:28 — a063a8e — sample-profiles@docs/hq-message-presets-live (3 files since origin/main)
**tl;dr:** Docs only: the ledger, decision 0117 and the session note say HQ's message library is live as 84dda56 [skip ci]
**Other sessions:** Nothing to rebase for: docs only. Puzzle changelog 2487 = 0117.

### 2026-09-28 20:25 — f7eee61 — sample-profiles@ui/hq-message-presets (10 files since origin/main)
**tl;dr:** HQ (myset.vip/crm) has a message library: the eight outreach openers are in every conversation's template picker, [Name] fills itself in, and Message library (the book icon, Settings or ⌘K) edits them and shows which ones get replies
**Other sessions:** Decision 0117, UX-064. New store doc crmlib (C.readLib/saveLib, action savelib, summary carries lib); addMessage keeps pre/soft on outgoing non-note messages; rowOf and deriveRows carry pre {k,t,s} = the FIRST opener sent. No new INVARIANT. localhost's /dev/hq demo messages now carry openers.

### 2026-09-28 16:15 — 693768c — quizzical-haslett-6f8f8b@fix/passcode-door-any-characters (1 files since origin/main)
**tl;dr:** The money model's passcode box now takes letters and long passcodes, hides what you type, and has Show/Hide
**Other sessions:** Only _passgate.mjs gatePage changed (type=password, maxlength 200, no digit pattern); the server check was already any string. FINMODEL_CODE is set (secret, three contexts) since 09:02 UTC.

### 2026-09-28 09:05 — a80e3ff — myset@claude/myset-encryption-security-460mph (31 files since origin/main)
**tl;dr:** Slice B of the security pass: sign-in codes, checkout, RSVPs, ratings and bug reports now count the network as well as the phone, so a script inventing device ids is stopped; every limit is sized so a packed bar on one wifi never meets it
**Other sessions:** Decision 0111, INVARIANT 0gx. New helpers: codeSendAllowed (_auth.mjs), payAllowed (_pay.mjs); new keys authnet_<hash> and paylim_<owner> (never mirrored or backed up; paylim_ is on both delete lists). saveBug/saveFeedback/toggleRsvp take the caller's ip as a last argument. Slice A is live as 539c2a4. Slice C (0112/0113) waits on MYSET_SECRET and FINMODEL_CODE.

### 2026-09-28 16:13 — 785a02a — untrack-node-modules@config/dependabot-security-only (2 files since origin/main)
**tl;dr:** Nothing on the site changes: Dependabot now opens a pull request only for a security fix in stripe or @netlify/blobs, no more routine major upgrades
**Other sessions:** Dependabot alerts + security updates switched ON in the GitHub repo settings (2026-09-28); .github/dependabot.yml limit 0 stops version bumps. #140/#141 (stripe 22, blobs 11) closed unmerged. A security-fix PR from Dependabot changes package-lock.json: after it merges, npm ci in ~/Docs/MySet (after its reset) or worktrees keep testing the old version.

### 2026-09-28 16:11 — 14a3ebc — untrack-node-modules@docs/0116-merged (4 files since origin/main)
**tl;dr:** Nothing on the site changes: decision 0116 (node_modules out of git) is live as eb18ca1, and the ledger says so
**Other sessions:** Netlify skips a build whenever a commit message contains the bracketed skip-ci marker ANYWHERE, even inside a denial: #143's production build had to be started by hand (netlify api createSiteBuild). A change that must build never writes the marker, not even to deny it. Branches lose the node_modules link on rebase; inside ~/Docs/MySet/.claude/worktrees/ nothing breaks, elsewhere run npm ci.

### 2026-09-28 16:10 — d76d245 — sample-profiles@docs/hq-light-theme-live (3 files since origin/main)
**tl;dr:** Docs only: the ledger, decision 0108 and the session note say HQ's light theme is live as a0ab3dc [skip ci]
**Other sessions:** Nothing to rebase for: docs only. The session's board row goes back to DONE.

### 2026-09-28 16:07 — a8c1376 — sample-profiles@ui/hq-light-theme (5 files since origin/main)
**tl;dr:** HQ (myset.vip/crm) has a light theme now: tap the sun in the top bar, or ⌘K → Light mode. It still opens dark, and the choice is remembered in that browser
**Other sessions:** public/crm.html only (plus test/hq.mjs, 0108's page paragraph, UX-062, the session note). The light theme is tokens: every wash is rgba(var(--hi),a) (white on dark, black on light), text colours have light shades, test/hq.mjs 'THE PAGE’S TWO THEMES' fails on a new rgba(255,255,255,…) wash in the shared rules or a text colour under 4.5:1. localStorage key myset.hq.theme; the head applies it before the first paint. No new numbers.

### 2026-09-28 15:47 — 92e59db — untrack-node-modules@config/untrack-node-modules (9 files since origin/main)
**tl;dr:** Nothing on the site changes: git stops tracking the node_modules link, so resetting the shared checkout can no longer delete the packages every worktree uses, and a worktree needs no install step
**Other sessions:** Decision 0116 (session 6b338f). node_modules is untracked and .gitignore says node_modules with no slash, so a link is ignored too. Every branch loses its link on its next rebase: harmless under ~/Docs/MySet/.claude/worktrees/, where Node finds ~/Docs/MySet/node_modules by looking in parent folders; a checkout anywhere else (the cloud) runs npm ci. Never delete ~/Docs/MySet/node_modules; after a dependency change merges, worktrees test the old version until npm ci runs there. Resetting the shared checkout stays the founder's call: after this merges, git fetch + git reset --hard origin/main keeps node_modules (one 'unable to unlink' warning); never git restore . or checkout -- . before it, never git clean. Puzzle t01 (370041) and the 0116 changelog entry follow the merge.

### 2026-09-28 15:44 — df0bd1f — quizzical-haslett-6f8f8b@docs/0115-hq-is-crm (1 files since origin/main)
**tl;dr:** Docs only: decision 0115 now says HQ lives at /crm (it said /hq, which is nobody's since afeffa0)
**Other sessions:** No code change. Nothing else on main pointed HQ at /hq.

### 2026-09-28 08:43 — e69a1bf — myset@claude/myset-encryption-security-460mph (49 files since origin/main)
**tl;dr:** Slice A merged with main a fourth time (#139, docs only); structure test green, the full suite ran green on the tree one docs commit behind
**Other sessions:** Merging #136 now.

### 2026-09-28 08:42 — 560f150 — myset@claude/myset-encryption-security-460mph (49 files since origin/main)
**tl;dr:** Slice A merged with main a third time (#138); suite green on the merged tree
**Other sessions:** Merging #136 right after this push.

### 2026-09-28 08:32 — 6bba525 — myset@claude/myset-encryption-security-460mph (49 files since origin/main)
**tl;dr:** Slice A merged with main again after the HQ build (0108/0109): RESERVED keeps both crm and constructor; suite 4,849 ✓
**Other sessions:** Nothing else changed. Merging #136 next; slice B follows on the same branch.

### 2026-09-28 08:27 — 39373d7 — myset@claude/myset-encryption-security-460mph (49 files since origin/main)
**tl;dr:** Slice A merged with main after 0114/0115 (askList gone: the pledge test reads the Studio poll); suite 4,540 ✓ on the merged tree
**Other sessions:** The earlier stamper failure was 0115 removing askList, not a flake. INVARIANTS main now holds 0ha and 0hl; this branch keeps 0gt–0gw for slice A, takes 0gx for B and 0gy/0gz/0hb for C. pushOn gate already dropped from this branch (0114 owns alerts).

### 2026-09-28 08:11 — 9ecfd9a — myset@claude/myset-encryption-security-460mph (48 files since origin/main)
**tl;dr:** Slice A of the security pass (decision 0110), rebuilt on today's main: a fan's own 'pledge' no longer mints paid votes; __proto__ and constructor are refused as names; an event id is never markup and a picture is an address; moving your sign-in address no longer says whether the new one has an account; the mirror and the backup skip the ID photo and the signing key; every function reply carries the full HSTS; mail and lyrics have deadlines. Still on the branch, NOT live until its PR merges
**Other sessions:** The 72-file branch is now three slices (cross-session review): A = this (0110, INVARIANTS 0gt–0gw), B = the network limits (0111, next), C = MYSET_SECRET + sealing at rest (0112/0113, after the founder sets the variables). Dropped what #128/0099/0100 already do. New: own(o,k) in _lib.mjs (an own-property read; every registry lookup by slug or id uses it), cleanFanId refuses __proto__/constructor/prototype, HSTS const on json/jsonCached, MAIL_MS and LRCLIB_TIMEOUT_MS exported and in the overview's facts, backup.py SKIP_KEYS/SKIP_PREFIX/SKIP_SUFFIX. venue/city/showTime stay in no CAPABILITY row on purpose (the Live tab's name-the-night). Suite 4,511 ✓ on three of four full runs; one run inside overview --tests exited non-zero without a failing assertion in the captured stderr — watch for a flaky section.

### 2026-09-28 15:37 — 4bdbb9c — sample-profiles@docs/hq-puzzle-ids (1 files since origin/main)
**tl;dr:** Docs only: HQ's process sheet is loaded into Puzzle, so the outreach desk shows on the Marketing & growth tab [skip ci]
**Other sessions:** Puzzle section 44408 (h01–h14 = 389724–389737; h09/h12 Draft until Gmail is switched on), connections 435824–435843 (435842 h03→s02, 435843 h08→s18), changelog 2444 = 0108, 2445 = 0109. Section 44328 now says the keys are Production only and names HQ as a second door; changelog 2412 (0101) no longer states the undo window's number.

### 2026-09-28 15:28 — 0ec92fb — sample-profiles@fix/crm-page-name (8 files since origin/main)
**tl;dr:** HQ answers only at myset.vip/crm now (its page file was named hq.html, so /hq opened it too); the docs say HQ is live as 0075a30
**Other sessions:** public/hq.html → public/crm.html; netlify.toml /crm → /crm.html. Netlify serves /<name> from <name>.html by itself, so a founder page's file name IS an address: name it after its route and reserve that slug. Ledger GRO-003/UX-062 live; decisions 0108/0109 commits [0075a30]; sheet 09 live (its Puzzle section is being loaded).

### 2026-09-28 15:20 — 5e88323 — sample-profiles@feat/hq-crm (28 files since origin/main)
**tl;dr:** MySet HQ is at myset.vip/crm: the founder's outreach desk. It has a form that builds a sample page, one table of every artist and venue with tags, and every conversation in one place, with email two-way through the founder's own Gmail. It is locked behind the founder's sign-in and a passcode
**Other sessions:** Decisions 0108, 0109; INVARIANTS 0gr, 0gs, 0hk; ledger GRO-003, UX-062. New: _crm.mjs (contacts crm_<cid> + index crm, stage derived never stored), hq.mjs (/api/hq, unlock/lock), _hqlock.mjs (the passcode's scrypt hash ONLY in Netlify HQ_PASSCODE, production, secret; tools/hqpass.mjs sets it; unset = shut, so previews cannot open HQ), _gmail.mjs + hqcron.mjs (waits on GMAIL_CLIENT_ID/SECRET). Any new door that removes or moves a sample must call _sample.mjs tellCrm. factory.mjs exports queueJobs/markSent/sampleDetail; edit takes links/media/city. RESERVED += crm. Both HQ notify calls pass { owner: true }. The drafts' postal address lives in the live factorycfg, not in the repo.

### 2026-09-28 15:15 — 6cbac17 — sheets-passwords-sender@docs/port-shared-checkout (27 files since origin/main)
**tl;dr:** Docs only: edits that sat in the shared checkout since 2026-09-12 are on main now — the lost-everything procedure in ACCOUNTS, back up before a gig, the repo is public and protected, the vouch count read from the code, PER-008 done in the money sheets, the gig sheets' warm door and three-hour wrap-up, and thirteen old session notes [skip ci]
**Other sessions:** Ported by hand from ~/Docs/MySet (cb22f3f), rebased onto 99b0693; nothing there was committed, reset or cleaned, and resetting it is the founder's call. Never run a plain git reset --hard there: main tracks a node_modules LINK, so the reset deletes the real node_modules folder every worktree links to — move it aside first. Ledger PER-021 = agent keys (the checkout's 'PER-011'); PER-009 updated. Left out as stale: money/04 and the-gig/03's Merch-in-Profile lines, ACCOUNTS §5 item 5, finance/marks.json, the untracked tools/backup.py. Puzzle 369874, 369763, section 41972 updated. Slice C (5bcf8f) told: sealing the artists registry must update ACCOUNTS §6.4.

### 2026-09-28 15:07 — abfb548 — quizzical-haslett-6f8f8b@docs/no-action-without-sender-live (4 files since origin/main)
**tl;dr:** Docs only: the genre ✕ and the dead-action sweep (decision 0115) are live as e043010 — the ledger, the record, the session note and o04 say so [skip ci]
**Other sessions:** Puzzle: step o04 370015 and f03 370183 reloaded, section 42003's sources no longer list lyricsGet; changelog 2441 = 0115.

### 2026-09-28 15:03 — 2882a95 — quizzical-haslett-6f8f8b@chore/dead-admin-actions (30 files since origin/main)
**tl;dr:** Your own genres in the Studio's song sheet now have a ✕ that deletes the genre from every song; ten server actions no page ever sent are gone (nothing else visible changes)
**Other sessions:** Decision 0115, INVARIANT 0hl, ledger UX-063. test/structure.mjs now FAILS when admin.mjs (+_messages, _diary) or venueadmin.mjs branches on an action name that no public/ page quotes outside a Set literal — build both halves of a feature together. Removed: showTime (field gone from stage/_board/_history/_lib), city action (show.city stays), askList/listAll/learnList (read the stage poll), lyricsGet (songGet), chartFlags action, verifyPreview, spotifyPeek (no SPOTIFY_* needed), venuePlan (venues pay via their own checkout). Branches adding actions (HQ, security) must add the sender too.

### 2026-09-28 14:41 — 3a66c20 — quizzical-haslett-6f8f8b@docs/push-per-seat-live (4 files since origin/main)
**tl;dr:** Docs only: push alerts per seat (decision 0114) are live as 811c9a7 — the ledger, the decision record, the session note and the sheet say so [skip ci]
**Other sessions:** Puzzle: new step t13 = 389598 in section 41979 (arrows 435707–435710 from t11/t04/t05/t07); o10 370021, d06 370277, j08 370099 now Live (VAPID set), f06 370186 reloaded; changelog 2438 = 0114. HQ (4b462c) must pass {owner:true} to its hq.mjs notify; the security branch (5bcf8f) must drop its pushOn gate and rebase on 811c9a7.

### 2026-09-28 14:37 — e83d823 — quizzical-haslett-6f8f8b@feat/push-per-seat (26 files since origin/main)
**tl;dr:** A crew seat's phone no longer gets merch orders or messages: each phone hears only what its seat can see (requests still reach every seat), each seat has its own 8-phone cap so nobody pushes the owner's phone off, and signing a phone out ends its alerts
**Other sessions:** Decision 0114, INVARIANT 0ha, ledger ACC-008. notify(aid, msg, to) MUST name an audience — {tab:'merch'|'messages'|…}, {owner:true}, {all:true} or {endpoint}; no third arg reaches nobody and test/pushseats.mjs fails the suite (HQ's hq.mjs:63 needs {owner:true}; 4b462c told). killSessions/killEverything call dropDevices; push_<aid> rows carry email+sid. The security branch (5bcf8f) must drop its pushOn/pushOff 'community' gate and its 0ha (told). VAPID_* is set in production (names read); no real push checked yet.

### 2026-09-28 14:04 — bd92f8e — sheets-passwords-sender@docs/agents-md-rules (5 files since origin/main)
**tl;dr:** Docs only: AGENTS.md on main now has the pull-request deploy flow, the sessions board, the backup-at-start line and the 'Does Puzzle need updating?' hand-off; the day's cross-session review is written up [skip ci]
**Other sessions:** Worktree sessions read main's AGENTS.md, which still said a push to main deploys. New rules: stage by name (never -A); after gh pr merge, delete the branch yourself (git push origin --delete) — --delete-branch fails from a worktree; keep (#N) in --subject. 74 merged remote branches were deleted and #27 closed as superseded. The security branch (5bcf8f) ships in three slices: A code-only (0110), B limits (0111), C secrets (0112/0113); numbers reserved on the board. Log: docs/sessions/2026-09-28-cross-session-review.md.

### 2026-09-28 13:52 — 0118f1c — sheets-passwords-sender@docs/sheets-passwords-and-sender (10 files since origin/main)
**tl;dr:** Docs only: the process sheets and Puzzle say passwords exist (0070, 0073) and the sign-in sender is set (PER-004); new Puzzle steps for signing in with a password and setting one [skip ci]
**Other sessions:** Puzzle: new steps 389481 (g10, section 41978; arrows 435531/435532) and 389482 (v08, 41980); d01 370272 Live; changelog 1661 (0070) → 9 steps, 1664 (0073) → v08 + h07; 41980 notes say only the owner's seat sees Face ID, the Studio code and recovery codes (0105). Rebased on c13060e (#127–#129) keeping both sides. The read-back's drift list (not fixed) is in docs/sessions/2026-09-28-the-sheets-say-passwords-exist-and-the-sender-is-set.md. Owed by 4b462c after this lands: artist-lifecycle/01's 'Claim a sample page' row (step 389231).

### 2026-09-28 13:47 — 020b1bf — quizzical-haslett-6f8f8b@docs/seat-access-live (5 files since origin/main)
**tl;dr:** Docs only: each seat's tabs and own-device sign-out (decisions 0104, 0105) are live as 52047cb — the ledger, the sheet and the decision records say so [skip ci]
**Other sessions:** Puzzle section 41979 reloaded: t01/t03/t04/t05/t07 updated; NEW t11 = 389538, t12 = 389539; arrows 435592–435595; changelog 2434 = 0104, 2435 = 0105; attribute 46139 is now 'byEmail[email].artistId / role / access'. Notion rows ticked. Security branch 5bcf8f told to rebase on 52047cb and drop its sign-out/revenue/history/settings/pushOn gates; push alerts per seat is 3d368c's next batch and the only place alerts get gated.

### 2026-09-28 13:40 — cbb5839 — quizzical-haslett-6f8f8b@fix/seat-signout-scope (28 files since origin/main)
**tl;dr:** A band mate or crew seat can no longer sign the owner's phone out: 'sign out my other devices' reaches only its own. The owner now picks, seat by seat, which Studio tabs each band mate or crew member can see or change (Settings → Who can sign in → Access). Crew no longer sees money or changes the room's prices unless the owner allows it
**Other sessions:** Decisions 0104, 0105; INVARIANTS 0gp, 0gq; ledger ACC-006. _session.mjs: AREAS, PRESET, levelOf/accessOf/reachOf, can(role, '<tab>_view|_edit', access); CAN is now only member:audit (show/requests/export were read by nothing). Every admin.mjs CAPABILITY row is '<tab>_view|_edit'; a new row must name one. byEmail[email].access = overrides only; accessSet owner-only; verifyToken/requireArtist carry access; stagePayload(aid, seat) strips money. Studio: data-ed/data-see/data-area + seatPass(); a new edit control needs data-ed or test/seatstudio.mjs fails; ownerSeat() for owner-only UI. The security branch (claude/myset-encryption-security-460mph) rebases on this and drops its own sign-out/revenue/history/settings gates.

### 2026-09-28 12:52 — 15123e4 — sample-profiles@docs/sample-profiles-live (12 files since origin/main)
**tl;dr:** Docs only: the sample pages, table cards and old-address fix are live as c940a6e — the sheets, the ledger and the decision records say so [skip ci]
**Other sessions:** Puzzle reloaded and Live: section 44328 (24 steps, 30 connections, new 435549 s20→s21), 44329 (13), 389231, a02 369797, t08 369959, NEW venue step n12 = 389502 (connections 435550/435551); changelog 2432 = decision 0106, 2433 = 0107; attributes 46138/46144 mention oldSlug. Owed: the artist-lifecycle/01 'Claim a sample page' row (step 389231) after PR #125 lands; tools 51452/51453 stay Considering until the founder pastes the keys into Netlify (then a redeploy — this docs push is [skip ci]).

### 2026-09-28 12:28 — dc519f7 — sample-profiles@feat/sample-profiles (63 files since origin/main)
**tl;dr:** Sample pages: MySet builds a page for an act or a venue that has never heard of it, sent as myset.vip/<name>#sample-profile and claimed in a minute onto Hobbyist (the founder's console is /factory); every Studio tab explains itself once and the Live tab has a practice round; the pre-show checklist asks for a big sign plus 25–50 table cards and the sign page prints both; Your page link sits at the top of Settings; a renamed venue keeps its old address and nobody can take another page's old address
**Other sessions:** Decisions 0101–0103, 0106, 0107; INVARIANTS 0gm–0go, 0di amended; ledger GRO-001/002, UX-060/061, ACC-007. Samples live in samplereg (never artists/venues until claimed), keys sample_/samplearc_/samplesup/samplestat/factoryq/factorycfg; requireArtist/requireVenue {sample:true} + SAMPLE_OK (admin.mjs, venueadmin.mjs), role 'sample' = empty CAN. The '#sample-profile' label is NOT a secret (address alone opens/claims; guard = founder push + 14-day undo); the sample door has no remove. setSlug (auth.mjs, venueauth.mjs) now refuses another page's oldSlug; venues keep oldSlug (venueBySlug reads it). New stamped scripts: public/tips.js, public/sample.js. The factory builds nothing until ANTHROPIC_API_KEY + YOUTUBE_API_KEY are set. Merged main at f364e51.

### 2026-09-28 12:14 — c33ebc9 — nifty-jones-b27e63@docs/invite-list-live (3 files since origin/main)
**tl;dr:** Docs only: hiding leaving accounts from the invite list (decision 0098) is live as ad9fc28 [skip ci]
**Other sessions:** Ledger ACC-003 and the session note updated. No process sheet or Puzzle step describes the invite list.

### 2026-09-28 12:12 — 4a45734 — nifty-jones-b27e63@fix/invited-names-leaving (4 files since origin/main)
**tl;dr:** An artist's Settings no longer lists somebody they invited who has since deleted their account, by name or in the count
**Other sessions:** Decision 0098 amended, INVARIANT 0dh: auth.mjs list action filters referredBy rows with !x.del. Sessions rebasing auth.mjs/test/accounts.mjs (3d368c, 4b462c): the change is one filter line and a new section after LEAVING.

### 2026-09-28 12:08 — cde47da — inspiring-feynman-75227a@docs/founder-tools-live (6 files since origin/main)
**tl;dr:** Docs only: the founder's tools needing the founding page's owner seat (decision 0100) is live as 7a84cb7, verified on Netlify's production deploy [skip ci]
**Other sessions:** Puzzle changelog 2431 = decision 0100, linked to steps 369974 (e06), 370002 (y07) and 370080 (i06), each reloaded from its sheet. Ledger ACC-005; ACC-004's next action no longer lists the two gaps 0100 closed. Still open, not fixed: owner-only Studio controls drawn for member seats on any page (Your earnings, Got a code?, the sign-in Add field).

### 2026-09-28 12:04 — 8d18d34 — nifty-jones-b27e63@docs/deleted-account-walks-live (18 files since origin/main)
**tl;dr:** Docs only: the share card and sheet fix for deleted accounts (decision 0098's amendment) is live as 1385b2b, verified on Netlify's production deploy [skip ci]
**Other sessions:** Puzzle changelog 2408 amended and linked to step 369978 (q03, Lock the account down), reloaded from artist-lifecycle/05. Ledger ACC-003.

### 2026-09-28 12:03 — a6e96cd — inspiring-feynman-75227a@fix/founder-tools-owner-seat (13 files since origin/main)
**tl;dr:** A band mate or the sound engineer signed in to the founding page can no longer change the public Media Dash boost log, and their Studio stops showing the founder's cards; other artists lose an 'If something broke' card that never worked for them
**Other sessions:** Decision 0100, INVARIANT 0gk (after 0099's 0gj); ledger ACC-005 and the session note ride the live-docs PR. studio.js founder() = PLAN.owner AND the owner role: gate any founder tool on it, never on PLAN.owner, which stays the founding page's plan-lock bypass (has(), canHide()). test/founderseat.mjs is the first /api/mediadash test; its tripwire names any founder action the Studio sends from a function outside its list. tools/mock.mjs: ?founder=1, ?seat=member|crew.

### 2026-09-28 11:59 — 226bae6 — nifty-jones-b27e63@fix/deleted-account-walks (6 files since origin/main)
**tl;dr:** A pasted link to a deleted account's page no longer shows its name and portrait, and the founder's Google Sheet now says when a leaving account is deleted
**Other sessions:** Decision 0098 amended (every other registry walk checked), INVARIANT 0dh. artistpage.mjs card() resolves the slug through publicArtist. _warehouse.mjs: a new LAST column 'Being deleted on' on Artists, Gigs and Venues (deletedOn(row) = day(row.del.purgeAt)); an unreadable artist's reason moved to the second-to-last column. /api/img and /api/vid stay open for a marked account on purpose. Still open, cosmetic: auth.mjs Settings lists a leaving referral by name until the purge.

### 2026-09-28 11:57 — 70c0599 — gifted-clarke-2a74ea@docs/role-gates-live (7 files since origin/main)
**tl;dr:** Docs only: the founder-tools and role-table fix (decision 0099) is live as 04e78db, verified on Netlify's production deploy [skip ci]
**Other sessions:** Puzzle changelog 2430 = decision 0099, linked to steps 369952 (t01), 369974 (e06), 370002 (y07), 370080 (i06), each reloaded from its sheet. i06 used to claim every artist reads their own bug reports; bugList was always behind the founder gate. Ledger ACC-004.

### 2026-09-28 11:54 — 3ec4721 — gifted-clarke-2a74ea@fix/admin-role-gates (9 files since origin/main)
**tl;dr:** A band mate or the sound engineer signed in to the founder's page can no longer use the founder's platform tools, and crew can no longer rewrite setlists, charts, lyrics or genres or empty the library
**Other sessions:** Decision 0099, INVARIANT 0gj (0t amended), ledger ACC-004. admin.mjs's platform block now needs isPlatformOwner(aid) AND me.role==='owner'. CAPABILITY is a deny-list: an unlisted action needs only a sign-in, so test/structure.mjs now refuses a CAPABILITY/OWNER_ONLY name no handler takes. 0100 (fix/founder-tools-owner-seat) rebases on this: INVARIANTS 0gk goes after 0gj, ACC-005 above ACC-004. Still open, not in this change: auth.mjs signOutOthers/sessionRevoke let crew sign the owner out (fix/seat-signout-scope).

### 2026-09-28 11:22 — f3993c9 — nostalgic-swanson-d7e46f@docs/process-sheets-tracked (39 files since origin/main)
**tl;dr:** Docs only: the 39 process sheets that lived only as untracked files in the shared checkout are in git now, and the signing-in sheet and its Puzzle notes say a password exists (0070) [skip ci]
**Other sessions:** Edit docs/processes sheets in a worktree, never the shared checkout's untracked copies: those match git byte for byte and will block a pull there until removed. marketing-and-growth/08 and onboarding/02 still ride on feat/sample-profiles. Puzzle section 41978's notes reloaded from the sheet. Still stale, left alone: 'no password' in artist-lifecycle/03 and the-gig/03 a01; 41978 has no password step and g01 shows the pre-0070 screen; AUTH_FROM 'absent' in admin-and-finance/03 d02 and onboarding/01 o02; changelog 1661 (0070) links no steps.

### 2026-09-28 00:08 — d547f38 — nifty-jones-b27e63@docs/deleted-account-live (5 files since origin/main)
**tl;dr:** Docs only: a deleted account staying off the schedule (decision 0098) is live as 2243aed, verified on Netlify's production deploy [skip ci]
**Other sessions:** Puzzle changelog 2408 = decision 0098, linked to steps 369848 (s05), 369854 (s11) and 369816 (a21), each reloaded from its sheet. Ledger ACC-003.

### 2026-09-28 00:04 — 5a44b02 — nifty-jones-b27e63@fix/deleted-account-autoshow (7 files since origin/main)
**tl;dr:** An account somebody has deleted no longer starts its calendar's gigs by itself or gets the morning-after letter during its thirty days
**Other sessions:** Decision 0098; INVARIANT 0dh amended. heal() skips reg.byId[aid].del rows; autoTick checks deletionOf right before startShow and returns drop:true, which sweep uses to take the gigsched entry out (beside keep). sweepNotes drops a marked account's note. A new walk over reg.byId must decide what .del means for it.

### 2026-09-27 11:53 — c808196 — wt@docs/merch-orders-sheet-0097 (1 files since origin/main)
**tl;dr:** Docs only: the merch-orders process sheet and Puzzle now say an order alerts its owner (0097) [skip ci]
**Other sessions:** Puzzle changelog 2398 = decision 0097, linked to step 369907 (m08).

### 2026-09-27 11:52 — 525155f — wt@docs/orders-share-live (2 files since origin/main)
**tl;dr:** Docs only: order alerts, the Studio reminder and the artist share card are live as a84da01 [skip ci]
**Other sessions:** Nothing to redo.

### 2026-09-27 11:51 — c95dba2 — wt@feat/orders-reminders-og-photo (16 files since origin/main)
**tl;dr:** A new merch order now sends the artist a push and an email; the Studio opens with a card for pending orders and unread messages (each with a door and a 24-hour quiet box); a pasted artist link shows the artist's portrait and name
**Other sessions:** Decision 0097 (0096 is the tax one). /:slug now rewrites to /.netlify/functions/artistpage?a=:slug — netlify.toml [[headers]] do NOT reach it, so a site-wide header change must be made in artistpage.mjs SITE_HEADERS too (test/sharecard.mjs refuses a drift). tellOrder runs only on redeemSession's fresh claim. New admin action orderCount (profile). studio.js ?tab=merch accepted; restamped.

### 2026-09-27 11:49 — 90fe669 — taxwt@money/tax-tn-nexus-wording (0 files since origin/main)
**tl;dr:** Tennessee is not owed yet: no MySet money has come from Tennessee [skip ci]
**Other sessions:** Correcting 0096 and PER-016 — TN sales tax is owed on sales SOURCED to Tennessee, and Stripe's location list has no TN row (Germany, Spain, California, Thailand). Registering early is a choice, not a duty, and it starts a filing obligation. TNTAP's form asks a sole proprietor for an SSN, so an agent cannot finish it. [skip ci]

### 2026-09-27 11:44 — 133d579 — taxwt@money/tax-follows-the-seller (0 files since origin/main)
**tl;dr:** The plan checkout now asks for a tax number (optional); tips and votes never do
**Other sessions:** Decision 0096: tax follows the SELLER. _billing.startCheckout carries tax_id_collection + customer_update; an EU business that gives a VAT number is reverse-charged. Never add this to pay.mjs — a fan's payment is the artist's sale. Stripe: product tax category is now txcd_10103001 (SaaS) on the account and on Bar Star; Connect liability stays 'platform's own sales only'; NO tax registration exists anywhere, so Stripe still adds nothing.

### 2026-09-26 18:01 — d461f80 — wt2@ux/media-dash-name (0 files since origin/main)
**tl;dr:** The Instagram dashboard at myset.vip/mediadash is now called Media Dash (tab title and top-left mark), not Signal
**Other sessions:** Name only, public/mediadash.html; the content engine's twin publish/dashboard.html carries the same rename. The Sheets tab 'Signals' is unrelated and unchanged. Older decision/session notes quoting 'MySet Signal' are history, left as written.

### 2026-09-26 17:12 — cab2c0b — wt2@docs/stripe-rates-live (1 files since origin/main)
**tl;dr:** Docs only: the measured Stripe rate is live as 03e2b28 [skip ci]
**Other sessions:** Nothing to redo.

### 2026-09-26 17:10 — 9c49d72 — wt2@model/stripe-measured (5 files since origin/main)
**tl;dr:** The money model now prices Stripe from the real fees: 75% of dollars on cards from abroad (was a 13% guess); margin at the default scenario 78.1% → 77.6% (EVS-006)
**Other sessions:** P0.stripe.intlShare = 75 and _showcosts STRIPE_RATES.intlShare = 75 — keep them equal (test/everyshow.mjs). Measured from 12 exact-fee payments; revisit as nights accrue.

### 2026-09-26 15:53 — 0cde6a4 — wt2@docs/exact-fees-live (2 files since origin/main)
**tl;dr:** Docs only: exact Stripe fees are live and backfilling (20 Sep: $2.67 real vs $2.28 estimated) [skip ci]
**Other sessions:** The model's P0.stripe reads ~17% low vs the first exact night; not changed yet.

### 2026-09-26 14:04 — 8790214 — wt2@feat/exact-stripe-fees (10 files since origin/main)
**tl;dr:** The shows table's Stripe column is now Stripe's own fee for each night (older nights fill in on their own, two every ten minutes); ≈ remains only where a fee is not on file yet (EVS-005)
**Other sessions:** moneyForShow now expands data.payment_intent.latest_charge.balance_transaction and files money.fees {usd,charges,missing}; index rows carry stripeFees (in rowSig — every artist's first walk after deploy re-reads all details once). New refreshShowFees(): writes the fee ONLY, only when takings match. recheckSome(rows, work, now, deadline); work.feesAsked. test/stripefees.mjs in run.sh.

### 2026-09-26 13:42 — 96f2639 — wt2@docs/show-costs-live (2 files since origin/main)
**tl;dr:** Docs only: the show costs are live as 315f525, verified on production [skip ci]
**Other sessions:** Nothing to redo.

### 2026-09-26 13:40 — 1d59f3e — wt2@feat/show-costs (9 files since origin/main)
**tl;dr:** The shows table now has a Costs group after Merch — Server, Stripe, Total per night, in the totals row, a Costs tile and the night's drawer (EVS-004)
**Other sessions:** New _showcosts.mjs; shows.json rows carry costs{server,stripe,total}. finance/actuals.json + credits.json are now in the moneymodel function's included_files — a new meter reading reaches the page on the next deploy. STRIPE_RATES must equal model.html P0.stripe (test holds it). Register untouched, still meter-free.

### 2026-09-26 13:22 — 0b454fe — wt@docs/gigs-tab-live (2 files since origin/main)
**tl;dr:** Docs only: the Studio tab-opens-at-top fix (UX-058) is live as beed75b [skip ci]
**Other sessions:** Nothing to redo.

### 2026-09-26 13:21 — c2f8b53 — wt@ux/gigs-tab-opens-at-top (7 files since origin/main)
**tl;dr:** A Studio tab now opens at its top: the first tap on Gigs used to land at the bottom of the page once it loaded (both Studios)
**Other sessions:** setTab in studio.js and venue-studio.js calls window.scrollTo(0,0) when the tab changes — render()'s scroll keeping is for same-tab re-renders only; don't route a tab switch around setTab. Stamps restamped (studio.js, venue-studio.js). test/copy.mjs guards both.

### 2026-09-26 13:19 — a204495 — wt2@docs/model-look-live (2 files since origin/main)
**tl;dr:** Docs only: the money model's new look is live as 16137f3, verified by content [skip ci]
**Other sessions:** Nothing to redo. Ledger EVS-003 row is the record.

### 2026-09-26 13:16 — 6cac9a2 — wt2@ux/model-stark (6 files since origin/main)
**tl;dr:** The money model now wears the shows page's look; both pages: bold ink headings, totals shaded light orange, a hero with a lit divider, rules/notes in a dark band; the shows breakdowns turn two tables at a time, stacked full width (EVS-003)
**Other sessions:** model.html: style + markup only — ENGINE block, summarize/applyActuals/mergeLive/pickAct/withDefaults untouched (model-test reads them). No Google Fonts link on it any more; localised()'s FONT_LINK swap now matches nothing there (harmless). tr.hi is blue now so it never reads as a total; tr.sum is the orange. shows.html carousel: car is a PAGE index, PER = 2.

### 2026-09-26 12:48 — 9aaee4a — wt2@ux/shows-stark (6 files since origin/main)
**tl;dr:** The every-show dashboard now wears the /mediadash look: votes/tips/merch each get a $ column in shaded groups, a totals row pinned at the top, money above zero in green, no table over 15 rows, both axes named on every chart, the nine breakdowns in a two-up carousel with arrows; the night opens in a side drawer
**Other sessions:** finance/shows.html only (EVS-002, amends 0095) — no endpoint or rule changed. It loads no web font now (system SF type), so test/everyshow.mjs asks for no external stylesheet instead of /vendor/model-fonts.css. frame() caps every table window at 15 rows and pins header rows; re-run it after any table render. EVS-001 is live as a8cd3c9: production's register folds by itself (26 Sep 02:30 UTC: 36 rows, 16 counted).

### 2026-09-25 14:39 — 9b2638e — wt@feat/shows-ledger (81 files since origin/main)
**tl;dr:** Every show on the platform: the founder's register — one row per night any artist has filed, folded on the server every ten minutes, on a new dashboard at myset.vip/moneymodel/shows (myset.vip/shows lands there) behind the model's passcode; the money model now reads its real-show numbers LIVE off it (decision 0095, INVARIANT 0gi)
**Other sessions:** One writer: never fold in endShow or the scheduler ring — markLive/unmarkLive and history.mjs rename/hide/reconcile leave regdirty marks on gigsched; registercron.mjs folds. Which nights count is ONE rule in _nightrule.mjs (register, _metrics, _warehouse; tools/actuals.py pinned on finance/fixtures/2026-09-25). New globals register/register_<YYYY-MM>/register_work/registersync (mirrored; cost.mjs regex). moneymodel.mjs serves /moneymodel/* (shows, shows.json, shows.csv, shows/night.json, shows/refresh, live.json) through _passgate.mjs; the fm cookie stays scoped to /moneymodel. The archive files country/tz/plan/startedBy/endedBy/requests/rsvps; hidden survives a re-archive; _pay.mjs tags tips/paid with the show; moneyForShow cuts only untagged money at the next night. RESERVED gains every routed name (+ mediadash) and test/structure.mjs checks the toml. finance/model.html: METER_KEYS + pickAct (live > newer paste > seed). 0093/0094/0gg/0gh were taken while this was built — this is 0095/0gi.

### 2026-09-25 14:27 — 0c0477b — wt@docs/three-levers-live (5 files since origin/main)
**tl;dr:** Docs only: the three levers (0091 the worker, 0094 app.css inline, 0093 the community split) are live as ebdce9e (PR #94); ledger rows PERF-003/004/005 done with the AFTER measured on production [skip ci]
**Other sessions:** No code. Read PERF-003/004/005 before touching sw.js, app.css (run node tools/stamp.mjs after any edit — nine pages), or community.mjs's GET (the shared read carries nothing personal). Numbering: app.css inline is 0094 / INVARIANT 0gh — 0092 and 0gf were taken while the branch was built; check origin/main's decisions right before writing a record.

### 2026-09-25 14:18 — bf6fd7a — wt@perf/sw-navigations (60 files since origin/main)
**tl;dr:** Three speed levers: the service worker shows a page opened in the last six hours from the phone's copy and refreshes it behind (0091 — a pull or reload still gets the newest; the money model is never stored); app.css rides inline in all nine fan pages (0094); the community page reads one shared, edge-kept copy and wears its own marks from a tiny personal call (0093)
**Other sessions:** sw.js changed on the founder's word — test/sw.mjs runs the real worker, every rule mutation-checked. After ANY edit to public/app.css run node tools/stamp.mjs (the block is <style id="app-css">, never id=app: that is every page's content container); the vote page's 0088 tokens block is gone. Community GET with no fan = the shared read (nothing personal may ever be added to it — the test refuses a mark), &fan=<id>&me=1 = the personal call, the old ?fan= reply stays. tools/mock.mjs pages say no-cache so the worker can be checked there. INVARIANTS 0ax rewritten, 0gh and 0gg new.

### 2026-09-25 13:56 — 74ac9d3 — wt@docs/mediadash-live (3 files since origin/main)
**tl;dr:** Docs only: MKT-001 / decision 0092 live as 4f95289 with the four content checks; the squash-inherits-[skip ci] lesson [skip ci]
**Other sessions:** gh pr merge --squash without --body folds branch commit messages into the squash — a [skip ci] in any of them skips the production build; trigger with netlify api createSiteBuild (not deploy --prod) if that happens.

### 2026-09-25 13:45 — 1ad5f70 — wt@content/mediadash (9 files since origin/main)
**tl;dr:** Docs only on the mediadash branch: preview 92's checks so far; rebuilt so the preview carries MEDIADASH_KEY (set 2026-09-25 06:44 UTC with netlify env:set — per-scope/secret flags need a paid plan, so it is an ordinary variable)
**Other sessions:** Nothing to redo. If a push to /api/mediadash answers 401, the deploy predates the variable — redeploy.

### 2026-09-25 13:39 — 7adba0a — wt@content/mediadash (8 files since origin/main)
**tl;dr:** myset.vip/mediadash: the Instagram dashboard (every post, every metric, every pull as a curve, boosts) — fed by the content engine's pushes, never pulling Instagram itself (decision 0092)
**Other sessions:** New function netlify/functions/mediadash.mjs (blob keys mediadash/data, mediadash/boosts, mediadash/thumb/<id>; POST needs x-mediadash-key = Netlify env MEDIADASH_KEY, or the founder's admin code for a boost). public/mediadash.html must stay byte-identical to publish/dashboard.html in the myset-content repo — edit it there. netlify.toml: /mediadash sits with the pretty URLs above /:slug.

### 2026-09-25 13:25 — 77c7d98 — wt@docs/loaders-lyrics-live (4 files since origin/main)
**tl;dr:** Docs only: the loading-screen and lyrics batch (decision 0090) is live as ee39bb1 (PR #90), verified by content on production; the ledger, decision and session note say so [skip ci]
**Other sessions:** No code. UX-057 is a done row now — read it before touching any splash or the lyrics sheets. f02 in the fan's-night sheet cites 0038 (the splash), not 0037; Puzzle step 369762 matches. Puzzle changelog 2318 = 0090.

### 2026-09-25 13:16 — 9537121 — wt@ux/loader-and-lyrics (22 files since origin/main)
**tl;dr:** The loading screen's bars now move from the very first frame instead of sitting as three still dots on every page change (every splash moves by transform, decision 0090); both lyrics pop-ups read in the MySet font, one block per verse, alternating white and light grey; the Studio's lyrics no longer drag the sheet closed when scrolled
**Other sessions:** Every page-change/boot/busy splash is <i><b></b></i>: window i, pill b (translateY), gradient b::before (scaleY), negative delays — never a height keyframe (INVARIANT 0gf, test/copy.mjs refuses it). A new splash copies an existing #intro block. Lyrics: .lyr-st verse blocks via textContent in studio.js verses() and vote.html openLyrics; .chartview stays monospace for chord charts; studio attachDrag skips .chartview. Decision 0090 (0087-0089 were taken). After editing studio.js run node tools/stamp.mjs.

### 2026-09-25 13:10 — 6a9e270 — wt@docs/mark-launcher (3 files since origin/main)
**tl;dr:** Docs only: the founder takes bandwidth marks with ~/myset-mark.sh before|start|after "venue" [Studio minutes] — a launcher for ~/Docs/Project Handoffs/myset-mark.sh (his ~/Docs/MySet checkout is an old base and has no tools/mark.sh) [skip ci]
**Other sessions:** Nothing in the code changed; tools/mark.sh, the handoffs copy and the launcher are the same script. Do not tell the founder to run ~/Docs/MySet/tools/mark.sh — that file is not on his checkout.

### 2026-09-25 13:07 — 98b2f31 — wt@marks/founder-script (8 files since origin/main)
**tl;dr:** The founder can take the three bandwidth marks himself with one command and no git: tools/mark.sh before|start|after "venue" [Studio minutes] (copy in ~/Docs/Project Handoffs/myset-mark.sh); and the money model now says every measured night is a Thai night — $1.04 a head is a floor for a tipping market, not a ceiling
**Other sessions:** tools/actuals.py read_marks() now merges finance/marks.json with ~/.myset-marks.json (MARKS_OWN / MYSET_MARKS_FILE); --write folds the founder's marks into the repo file — commit finance/marks.json after a --write. mark.sh fetches origin/main's tracker fresh each run, so it works from the diverged ~/Docs/MySet checkout. No engine change; SEED unchanged.

### 2026-09-25 11:05 — 64ea6d6 — wt@audit/sep-25-numbers (17 files since origin/main)
**tl;dr:** The money model carries fifteen real nights and a MEASURED screen-on dial: Netlify's own per-day meters say a night costs ~3 credits (2.3–3.8, nearly flat from 3 to 11 phones) and the room's phones tick 42×/phone-hour (screen-on 9.4%, was a 22% guess); $1.04 a head over 11 money-known nights (three nights carry 85%); this period deploys 1,785 credits vs 117 of traffic, and the $9 plan's credits ran out 15 Sep (decision 0089, INVARIANT 0ge)
**Other sessions:** tools/actuals.py: solve_meters reads finance/credits.json readings[-1].perDay.days[] (copy each day's requests/compute/bandwidth off Usage & billing; cleanFrom) → pollsPerPhoneHour + pollsSource + creditsPerShow (traffic only) in actuals.json; the bandwidth solver is FENCED — a quiet pair counts only within 48 h of a bracket, only if under 6 h, brackets over 24 h withheld, one-phone nights and empty slots are busy — so three marks per gig night (2 h before, just before, after) with nothing else running. boardBytes = BYTES.board = loadsim BOARD_BYTES = 3040 (calibration targets re-pinned). tools/actuals-test.py was RED on main since the split — fixed. Numbering: 0087/0088/0gc/0gd are the fan-script session's; this PR is 0089 / 0ge.

### 2026-09-25 10:54 — 9458031 — wt@docs/first-open-live (5 files since origin/main)
**tl;dr:** Docs only: 0087 (the fan pages' shared script) and 0088 (the first-open speed pass) are live as 68efdb4 (PR #85); the ledger, session notes and decisions carry the AFTER measured on production [skip ci]
**Other sessions:** No code. PERF-001/PERF-002 are done rows now — read them before touching fan.js, the vote page's head, or the fan door's DOORS. The AFTER table is in docs/sessions/2026-09-25-the-first-open-speed-pass.md.

### 2026-09-25 10:48 — ce92ad2 — wt@perf/fan-script (38 files since origin/main)
**tl;dr:** The nine fan pages share one script (public/fan.js, decision 0087) and a fan's first open paints first (0088): one picture per slot on the artist page (~400 KB of originals gone), no blocking script in any head, the vote page's logo screen at HTML arrival with app.css's tokens inline and app.css preloaded, the directory and the map key through the warm door and edge-shared
**Other sessions:** fan.js is a global namespace — never declare $, esc, toast, openSheet/closeSheet/attachDrag, drift, lift, hideIntro, MON/DOW, SHEETY, FROZEN… on a fan page (test/structure.mjs refuses); after ANY edit to fan.js run node tools/stamp.mjs (nine pages). vote.html's <style id=tokens> must equal app.css's :root blocks byte for byte — a token edit is a two-file edit. Never a layered background-image url(a),url(b) on a fan page (0gd). fan.mjs DOORS += artists, mapconfig (jsonCached 60/300 s); index/artists ask /api/fan?what=…, old addresses still up. uicheck/sheetcheck/clipcheck run again (tools/_puppeteer.mjs finds puppeteer-core by content). The ~/Docs/MySet checkout is 67+ commits behind origin/main — work from a worktree of origin/main.

### 2026-09-24 00:28 — 3e701b9 — landing-wt2@hero-subtext (2 files since origin/main)
**tl;dr:** Hero subtext now ends 'And you get more tips.' with that phrase and 'from your setlist' both in orange
**Other sessions:** public/about.html line ~397 only; no code/behavior change

### 2026-09-24 00:25 — e59468b — landing-wt2@hero-subtext (1 files since origin/main)
**tl;dr:** Hero subtext now says fans vote from the artist's own setlist, with that phrase in orange
**Other sessions:** public/about.html line ~397 only; no code/behavior change

### 2026-09-20 22:46 — 2f6a095 — wt@docs/total-profit-live (0 files since origin/main)
**tl;dr:** Docs only: 0086's amendment live as 2f6a095 (PR #82); the founder's book rewritten — rounded pay, hours by venue, tips share incl. votes bought, 11 test nights hidden
**Other sessions:** No code. The founder's records now carry min for every show and tipsCut on every band night; uicheck's two profit figures (lines 564/614) are stale until recomputed. [skip ci]

### 2026-09-20 22:44 — 2b83c14 — wt@money/total-profit (0 files since origin/main)
**tl;dr:** Money: Total profit is the act's whole night (revenue − costs, before the band is paid); My cut = profit − splits − the band's share of tips; votes bought count as tips for the share; the report's hero follows Total / My cut (0086 amended)
**Other sessions:** Biz.calc profit no longer subtracts bandTotal — anything that read profit as 'what is left' now wants cut; the 5th calc argument is the night's whole app money (s.app), not tipped; test/bizmath.mjs sum() expectations recomputed; tools/uicheck.mjs lines 564/614 still expect the old profit figures and could not be run here (puppeteer install gone)

### 2026-09-20 22:26 — 84f0b6b — wt@docs/tips-cut-live (0 files since origin/main)
**tl;dr:** Docs only: 0086 live as 84f0b6b (PR #80); the founder's book back-filled — 64 shows from his calendar, runs moved back to their first night, 18 skips, two one-offs
**Other sessions:** No code. His six runs now start in April/May/Aug, so any session reading his calendar sees ~70 past occurrences; do not re-run the backfill (docs/sessions/2026-09-20-tips-shared-and-show-history.md addendum has every id). [skip ci]

### 2026-09-20 22:17 — 6ab7fa0 — wt@studio/tips-cut (0 files since origin/main)
**tl;dr:** Money: In-app tips and My cut of tips on the show sheet, Total / My cut on the profit block (0086); the Live tab's Tonight figure is tips + votes bought
**Other sessions:** gig.tipsCut (cents, nullable) in both normGig and Biz.norm; Biz.calc(gig, app, prefs, feePct, tipsAppCents) now returns tipsAll/tipsMine and cut = (typed cut ?? profit - tipsAll) + tipsMine — pass the night's tipsApp everywhere calc is called; earned() in studio.js; run node tools/stamp.mjs after editing any of the four scripts

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
