# Push log — what each push did, for every other session

Newest first. **Read the top of this file at the start of every session**, before
`git status`, before assuming anything about what is or is not live. One entry per
push, written by `tools/pushlog.sh` as the last step before `git push`; the
pre-push hook refuses a push whose commits do not touch this file. Keep entries to
three lines: what changed for a person, then what another session must know. The
long version of any entry lives in `docs/sessions/` and `docs/decisions/`.

Several sessions work this repo at once, in different worktrees, and none of them
can see the others' chat. This file is the one place they all speak.

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
