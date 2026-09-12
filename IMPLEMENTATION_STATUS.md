# Implementation status

Repo-owned ledger for execution state, evidence, blockers and decisions. **Chat history
is not durable project memory.**

This file answers *"what is happening right now?"*. It does not repeat what the other
documents own: `MYSET-MASTER-OVERVIEW.md` is what MySet is, `INVARIANTS.md` is what must
never break, `docs/decisions/` is why a design is the way it is, and `docs/sessions/` is
what happened on a given day.

**Last reviewed:** 2026-09-12 (evening — UX-009, the first Airbnb-dive batch, in the working tree)
**Current phase:** Phase 3 — scale preparation, on a product that is already live
**Current focus:** Two Phase 3 items landed on `main` the same evening. The **shared-board
split (P3-001)** is `c3d0a4d`: the audience poll is two calls, `/api/board` (shared, no fan
id, held at the edge for the polling interval) and `/api/me` (personal, one shard, never
cached); `/api/show` stays for open tabs. **Clip bytes on Cloudflare R2 (P3-003)** is the
commit after it: `/api/vid` answers a 302 to a presigned link on the private bucket; every
clip from before stays in Blobs and serves as before; every R2 failure falls back so the
room can still vote (decision `0033`, INVARIANT 0fd). Both were reviewed fresh-context and
their findings fixed. The open line (P3-002) was **measured** the same evening in its own session: a throwaway Durable Object on `workers.dev` held 4,000 sockets, hibernated between votes and woke in ~10 ms (decision `0035`). No production code yet.

**Next work item (pick up here):** The board was watched from outside the same evening,
and the edge taught one rule: **Netlify's durable cache ignores a lifetime under 10
seconds** (3–9 bypassed in every spelling, 10 and 60 hit; measured on two draft deploys
and on production), so the polling dial's middle rung is now 10 s (rooms of 201–3,000)
and pubs keep 3 s with a per-node copy — decision `0034`, INVARIANT 0fi. Still to do
from outside: upload one clip on a community page and `curl -sI` its `/api/vid`
— a **302** with `location:` on `r2.cloudflarestorage.com` and `max-age=3600` — then play it
on a real iPhone; try a large (~75MB) clip once, because the PUT's fit inside the function
budget is unmeasured (session `2026-09-11-clips-to-r2.md` § "The order to deploy in").
Then P3-013 (trim the cast receipts that make a voter's record ~2 KB). The open line
(P3-002) runs **on the user's word — he said not to wait for a 2,000-person booking**; the
numbers to design from are in decision `0035`, and the first design question is the
hostname (cross-origin `workers.dev` now, `line.myset.vip` delegated later).

**Fresh-agent one-liner:** `Read AGENTS.md, then IMPLEMENTATION_STATUS.md; the split and R2 are on main — start from "Next work item".`

---

## Status vocabulary

`not_started` · `in_progress` · `blocked` · `done` · `deferred` · `cancelled`

---

## Phase gates

| ID | Gate | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| GATE-001 | A gig runs end to end with no intervention | done | The Ugly Duckling, 2026-08-30 — 8 voters, 21 votes, one $3 purchase, nothing went wrong | The only real-world data point there is |
| GATE-002 | A second artist can sign up, get paid and run a show without Perry | in_progress | Accounts, roles, billing and Connect all shipped; nobody but Perry has done it | The real test of the $10/month ambition |
| GATE-003 | A room of 2,000 works, not just costs an affordable amount | in_progress | P3-001 live 2026-09-11: `tools/loadsim.py --ceiling` puts the busiest-case read wall at ~2,500 **at today's measured record weight** (it was ~700–1,000 before the split at that weight; the old "~2,500" assumed 152-byte records). The shared copy is measured to hold from 201 phones (10 s, durable); under that it is per edge node | P3-013, then P3-005. **Still do not sell a bigger room** — nothing has been measured at a real big gig |
| GATE-004 | A bug reported by a fan can be traced without reproducing it | done | Hour-keyed durable server errors + fan report context + Studio report reader; 42/42 focused assertions | Reports retain the three server hours before the fan's note |

---

## Phase checklist

### Current requested batch

| ID | Work item | Status | Evidence | Blocker / next action |
| --- | --- | --- | --- | --- |
| UX-001 | Filtered thirty-day event map on Find artists | done | Decision `0025`; production `d1a6531`; restricted live PNG verified; 1,882/1,882 | — |
| UX-002 | Signed eligibility, Pro fee, light default and themed loading screens | done | Decisions `0024`, `0026`, `0027`; production `d1a6531`; 1,882/1,882 | — |
| UX-003 | Verified-only artist discovery, first-Settings notice and plans-testimonial cleanup | done | Decision `0028`; production `d1a6531`; served directory contains one qualifying profile; 1,882/1,882 | — |
| UX-004 | Interactive event map: pan, zoom, tappable details, Google Maps links and current-location dot | done | Decision `0036`; production `8c41e13`; Chrome verified the live map, five venue pins, event list and location retry; full suite 2,095/2,095 | Physical blue-dot placement still needs a real device location fix; denial/retry fallback is live |
| UX-005 | Free plan: ten shows a calendar month (was four) | done | Decision `0037`; `test/limits.mjs` 84/84, `test/tenancy.mjs` 80/80; overview table regenerated; the past-due banner's "undefined shows a month" fixed alongside | Working tree only — awaits the user's push |
| UX-006 | Community composer: folded to the five stars until one is tapped; "Where did you see them?" gains "Somewhere else — I'll type it" (free text, ≤60, stored as the post's label) | done | `community.html` composer + `community.mjs` `body.where`; `test/community.mjs` 116/116 | Working tree only. Not seen in a browser — checked by tests and syntax |
| UX-007 | Faster page switching: `leave.js` splash on every tap, first API call started from `<head>`, static files cached 10 min + stale-while-revalidate, Chrome prefetch on touch, smaller default cover | done | Decision `0038`; `test/copy.mjs` 37/37; `node --check leave.js` | Working tree only. Verify on a phone after the push: tap artist → vote → community and watch for any white frame |
| UX-008 | Setlist control cleanup, live-only refund actions, ended-show payload masking, centered verification notice, and starter-pack retirement | done | Production `d9b2f2f`; full suite green; rendered checks confirm the modal is centered and Setlist has no vote/refund controls; live content verified | — |
| UX-009 | Airbnb-dive batch 1: front door shows gigs near the phone (geolocation seeds the city), feed search field restyled, artist countdown says "(view setlist)", vote page counts down to the next gig between shows (wrap-up card kept three hours, Up next only while live), Merch folded into the Studio's Profile tab (six tabs fit 375px), sign-in = email + code box (Studio code behind a link), theme choice survives the back button | done | Working tree only. Decision `0039`; session `2026-09-12-airbnb-batch-front-door-vote-studio-signin.md`; `sh test/run.sh` 2,110/2,110; scratch puppeteer run at 375px (three vote states, near-you seed, 0px tab overflow, section order Videos → Merch → Save); `tools/uicheck.mjs` 104 ✓ + 1 ✗ in the other session's map | Not committed. Not seen on the live site. Rules "a vote never comes back" and "the room is always free" demoted to current behaviour in AGENTS / VISION / INVARIANTS / overview at the user's word |

### Phase 3 — scale preparation

| ID | Work item | Status | Evidence | Blocker / next action |
| --- | --- | --- | --- | --- |
| P3-001 | **Shared-board split** — one cached board, tiny per-fan endpoint | done | Live 2026-09-11, `c3d0a4d` + the rung correction: `_board.mjs`, `board.mjs`, `me.mjs`, `show.mjs` (composes from the same builders), `vote.mjs` (`at`), `_lib.mjs` (`getShow(aid,{withName:false})`, `pollFloorFor` middle rung 10 s), `public/vote.html` (`load`, `mergeBoard`, `applyCast`, `SHOWN`/`CAST_AT`), `test/split.mjs` 80/80, `test/cost.mjs` board ≤15 / personal ≤3, `tools/loadsim.py --ceiling`, INVARIANTS 0fh–0fk, decision `0034`, fresh-context review with seven fixes taken; real-browser check of both halves failing in turn; the durable minimum and the per-node 3 s copy measured on drafts and production | Read the personal call's billed duration off the function log after the first busy room (estimated ~50 ms, never measured) |
| P3-002 | Open line to the room (Cloudflare Durable Objects) | in_progress | 2026-09-11: **measured, not modelled** — throwaway `cloudflare/probe/` deployed to `workers.dev` (own `package.json`; the repo root still has two dependencies). One object held 4,000 sockets and every broadcast reached the last phone in ≤ 552 ms; hibernates within 15–20 s even with 1,000 sockets attached; wake ≈ 10 ms empty, 40–70 ms with 1,000 attached; 3,000 opened at once, 0 failures; decision-`0030` bucket verified over the socket. DO analytics: 24,473 billed requests for 12,202 connections (**two per connection**, open + close), 13.65 s billable duration all afternoon, 35,839 free outbound messages, $0 on Workers Free; the "errors" column counts disconnects, not faults. Session `2026-09-11-open-line-probe.md`, decision `0035` | **Trigger withdrawn by the user 2026-09-11** (reverses `0012`'s trigger). Next: design the production Worker on top of `/api/board` (`c3d0a4d`). DNS is at Netlify, not Cloudflare, so the line is cross-origin on `workers.dev` and `netlify.toml` `connect-src` gains one `wss://` host. Still unmeasured: the 1,000/s ceiling (needs more than one machine), iOS background Safari (9d12). The probe Worker is still deployed and public; `npm run delete` removes it |
| P3-003 | **Clip bytes onto Cloudflare R2** | done | `netlify/functions/_r2.mjs` (SigV4 by hand), `_video.mjs`, `vid.mjs` (302 to a presigned link); `test/r2-fake.mjs`; `test/clips.mjs` 163/163, full suite 2,004/2,004 (stamped); independent fresh-context review, findings fixed; decision `0033`; INVARIANT 0fd; session `2026-09-11-clips-to-r2.md` | Rebased onto the split (`c3d0a4d`) and pushed to `main` 2026-09-11. Pre-R2 clips stay in Blobs and serve as before. Not run against the real bucket yet — the first deploy is the measurement (75MB PUT inside the function budget; playback through the 302 on a real iPhone) |
| P3-004 | **Error tracking that outlives the night** | done | Durable capped hourly error documents, guarded handlers, fan report endpoint and Studio reader; 42/42 focused assertions | Retained in MySet's existing blob store; no third-party telemetry account required |
| P3-005 | Fan-shard write ceiling actually measured | not_started | Derived from a measured 40ms *read*, never from a write | **Now the next wall after reads.** Hammer one shard before selling a room over 2,000 |
| P3-013 | **A voter's record weighs ~2 KB after eight casts — trim the cast receipts** | not_started | Measured 2026-09-11 on the real write path: 101 bytes present-only, 412 after one cast, 864 after three, 2,010 after eight; `casts[]` (up to 20 receipts with outcomes) is most of it. At that weight the busiest-case read wall is ~2,500; at the report's 152-byte record it is past 10,000 | Keep the idempotency (INVARIANT 15h) and shrink the receipt: id + a compact outcome, fewer kept, or receipts aged out after a few minutes. Re-run `tools/loadsim.py --ceiling` after |
| P3-014 | Cache the slug→id registry read in `publicArtist` for a minute | not_started | A slug artist's personal poll is 3 reads (the registry, the show, one shard); the founding page is 2. Flags already cache this way (`_flags.mjs`, 60 s) | A separate decision: a deleted account would stay reachable for up to a minute. Low value until there are many slug artists in big rooms |
| P3-015 | The front door's "near you" seed reads `/api/artists` (every listed artist's profile + calendar) once per first visit | not_started | Added 2026-09-12 with UX-009; one artist today | Put a coordinate per city into the city index (`?places=1`, already fetched) and pick the nearest city from that instead — one read, no directory scan |
| P3-008 | **A payments health check that runs off the hot path** | not_started | — | The 2026-09-08 outage was invisible until a fan tapped. A key can be valid-looking and dead |
| P3-012 | **Rate limit on casting** — token bucket on the fan record | done | 2026-09-11: `takeCastToken` in `_lib.mjs`, checked inside the vote mutation; 429 in plain words; `test/errlog.mjs` | 20 in a row, then 30 a minute (the user lowered the burst from 30 on 2026-09-11). Decision `0030`, INVARIANT 0fa |
| P3-011 | Same person, two browsers, not recognised as one | cancelled | — | Not fixable honestly — the fan id lives in the browser and browsers do not share it. IP matching is worse (the whole bar shares one). INVARIANT 0ae already stamps a per-show network hash so the artist can see one network making many phones. See master overview §1.12 |
| P3-009 | `/api/pay` throws when a caller sends no `attempt` | not_started | Reproduced live 2026-09-08: 502 `Stripe: Unknown arguments` | `opts` is `{}` for a platform-owner charge with no `attempt`, and stripe-node rejects an empty options object. **No fan is affected** — `vote.html` and `community.html` always send `attempt`. One-line fix: pass `opts` only when non-empty |
| P3-010 | Featured-show bidding | deferred | Fixed-price Featured shows are live; user chose to file bidding for later on 2026-09-10 | Revisit only after real demand shows the fixed-price, first-come inventory is regularly full |
| P3-006 | `AGENTS.md` + this ledger on every project, not just MySet | in_progress | MySet done 2026-09-08 | iOhm landing, Idyll Mastery, Idyll Enterprises, Clients |

### Perry's own list (not code — these need his hands)

| ID | Work item | Status | Blocker / next action |
| --- | --- | --- | --- |
| PER-001 | Add `charge.updated` to the Stripe webhook | not_started | Without it the fee estimate stands; with it MySet's share is exact to the cent |
| PER-002 | Stop the double deploy; move Netlify to Pro | not_started | ~570 credits a month are the same change shipped twice |
| PER-003 | **2FA on Google, GitHub, Netlify and Stripe** | not_started | Twenty minutes, and the highest-value item in `SECURITY.md` — the ranked #1 threat is these accounts being phished, not the code |
| PER-004 | Set `AUTH_FROM` to a verified MySet sender | not_started | `RESEND_API_KEY` exists and the domain has a public DKIM record, but `AUTH_FROM` is absent. Confirm the domain is Verified in Resend, then add a sender such as `MySet <sign-in@myset.vip>` in Netlify and rebuild |
| PER-005 | Press **"Name these from my calendar"** in Money → Past shows | not_started | Five filed nights are still named after one venue |
| PER-006 | Try the passkey on stage | not_started | Is Face ID actually faster mid-set? |
| PER-007 | Replace `STRIPE_SECRET_KEY` in Netlify | done | Done by the user 2026-09-08. Verified live: `POST /api/pay` (kind `votes`, pack `small`, with `attempt`) returned 200 and a `cs_live_` checkout url |

---

## Metrics snapshot

| Metric | Target | Current | Last measured | Notes |
| --- | --- | --- | --- | --- |
| Cost of a 3-hour gig, 20 people | under 5¢ | **2.7¢** | 2026-09-05 | `tools/loadsim.py` |
| Cost of a 3-hour gig, 10,000 people | — | **$4.29** | 2026-09-05 | Was $36.40 before the signature split |
| Server cost as a share of revenue | under 10% | **5.6%** | 2026-09-05 | Does not move with scale — both sides scale together |
| Blob reads on the audience poll | board ≤ 15 per interval, personal ≤ 3 per phone | 14 / 2 | 2026-09-11 | `test/cost.mjs` fails the build above it. The board's reads happen once per interval for the whole room; the personal call reads one shard |
| Cost of a 3-hour gig, 20 people (after the split) | under 5¢ | **3.0–4.0¢** | 2026-09-11 | Up from 2.7¢: two requests a tick, and a cache hit is still a billed request. A range because under 10 s the copy is per edge node (3.0¢ if one node, 4.0¢ if none shared). Every bigger room costs less than before: 1,000 phones $0.56 (was $0.98), 10,000 $3.76 (was $4.29) |
| Honest room ceiling | 2,000 sold | **~2,500** busiest case at today's record weight (was ~700–1,000 before the split at that weight) | 2026-09-11 | `tools/loadsim.py --ceiling`. The earlier "~2,500" assumed 152-byte fan records; a voter's record is ~2 KB today (P3-013). At the lighter record the wall is past 10,000. Reads, not money, are the wall; the write wall (P3-005) is next |
| Test assertions | all passing | see §2.1 of the overview | 2026-09-08 | Stamped by `tools/overview.mjs --tests` |
| Real gigs run on MySet | — | **1** | 2026-08-30 | Treat every projection as a projection |
| Netlify egress per clip view, once on `main` | 0 for clips on R2 | — | 2026-09-11 | A 302 per view; a HEAD per clip per hour at the edge if the CDN caches the 302 (not verified), else per view; pre-R2 clips still bill until they leave (`0033`) |

---

## Verification log

| Date | Check | Result |
| --- | --- | --- |
| 2026-09-11 | R2 clip store, worktree `claude/r2-clips`: `node tools/overview.mjs --tests`; `test/clips.mjs`; the signer against Amazon's published SigV4 example; a fresh-context review that re-derived SigV4 from undici's wire bytes | Full suite 2,004/2,004; clips 163/163 (77 new); header signature `f0e8bdb8…`, canonical hash `7344ae5b…`, presigned `aeeed9bb…`, PUT payload hash `44ce7dd6…` all match; wire re-derivation matched for PUT/HEAD/DELETE. Not run against the real bucket |
| 2026-09-11 | Production `c3d0a4d`, then two draft deploys (`6aa3e51586…`, `6aa3e61262…`) with a header switch, then production again | New page and both endpoints live and correct within 40 s; the durable cache bypasses every lifetime under 10 s in every spelling and hits at 10 and 60; a 3 s copy is an edge hit on the same connection (`ttl=2`) and a miss from the next node — on the draft and on production |
| 2026-09-11 | `sh test/run.sh` on a clean checkout of `c3d0a4d` before the push | 2,017 assertions, 0 failures, every section green (`test/split.mjs` 80/80; `test/cost.mjs` board 14 reads, personal 2, legacy 14) |
| 2026-09-12 | Ten-shows, composer fold, page-switch work: `test/syntax.mjs`, `test/structure.mjs`, `test/copy.mjs`, `test/limits.mjs`, `test/community.mjs`, `test/tenancy.mjs` | 37 + 84 + 116 + 80 passed, 0 failed; syntax and structure OK. Full suite not run; no browser check |
| 2026-09-11 | Parity of the old `show.mjs` (`git show HEAD:…`) against the new one, same in-memory store, 15 scenarios | 0 differ, ignoring key order and the additive `at`/`freeCredits` (the reviewer's script, re-run by hand) |
| 2026-09-11 | Real browser (390px) against the real handlers over HTTP: vote through the sheet; `/api/me` returning 500; a fresh phone casting with `/api/me` down; `/api/board` returning 500 | Tally and "Your vote" stable across polls; board still updates with others' votes while the personal call is down; a cast with the personal call down is shown as mine with the server's `remaining`; the page keeps its board while the board call is down; no page errors |
| 2026-09-11 | Live, read-only: `/api/img` on myset.vip three times (same `durable` directive, same `/api/*` rewrite as the new board) | 2nd and 3rd: `cache-status: "Netlify Durable"; hit`, `age` present — the mechanism the board relies on works in production. The 3 s TTL itself is unverified until the deploy |
| 2026-09-11 | `tools/loadsim.py --ceiling` | Reproduces the room-ceiling report's column to the decimal at 152 B/fan; at today's 2 KB record the busiest-case wall is ~700–1,000 before the split and ~2,500 after |
| 2026-09-11 | `node tools/uicheck.mjs` | 104 rendered checks pass; the one failure (the artists-page static-map pin) is the other session's in-progress interactive-map work, not this change |
| 2026-09-11 | Production commit `e74292b`, deploy and live map/copy checks | Home actions and 2% Pro card are live; map config is enabled and a production-referrer request returns a real PNG; full suite 1,926/1,926 |
| 2026-09-11 | Draft `6aa3c42c072c9b9fc5bea38a`, focused copy/render checks and full suite | View-on-map is left of artist search at 320px; deep-link and consistent 2% Pro copy are served; 1,882 assertions, zero failures; production unchanged |
| 2026-09-11 | Production commit `d1a6531` and live HTTP/config checks | Combined discovery/miscellaneous batch deployed successfully at `myset.vip`; map remains correctly hidden while provider config reports disabled |
| 2026-09-11 | Draft `6aa3bcce9fd9709b3a45eb9c`, verified-only directory tests, rendered first-Settings notice and full gate | Served Studio has 2% Pro copy, verified-only explanation and no placeholder testimonials; directory endpoint returns only the qualifying profile; notice colors/persistence and mobile fit pass; 1,882 assertions, zero failures; production unchanged |
| 2026-09-11 | Draft `6aa3b8e8eedd9a5d7e4e5391`, focused directory/fee/theme checks, rendered UI, `sh test/run.sh`, and overview stamp | Signed requires both label fields; Pro is 2%; first visit and loading screens are light while saved dark remains dark; map remains safely hidden without its key; 1,876 assertions, zero failures; production unchanged |
| 2026-09-11 | Draft `6aa3ab8413b61425b33b9fcb`, focused map/copy checks, `node tools/uicheck.mjs`, `sh test/run.sh`, and overview stamp | Map popup, exact pin, existing directions link, filters, failure fallback and 320px fit pass; 1,872 assertions, zero failures; served config is honestly disabled without a key; production unchanged |
| 2026-09-11 | Production commit `02169fa` | Artist directory card/filter batch is live; served HTML and real computed directory data verified |
| 2026-09-11 | Draft `6aa3a5cdaf109164f02e0a0d`, focused directory/community/copy checks, `node tools/uicheck.mjs`, and `sh test/run.sh` | New directory tags, filters, calculated ratings/show counts, separate name/one-liner spacing and 320px fit all pass; full suite has zero failures; production unchanged |
| 2026-09-10 | Production commit `33d7429`, Netlify deploy `6aa2bf1185cb7d000874ed54` | Deploy ready; live Studio serves gig-level Feature and orange promotion bullets, and live directory/theme assets match the approved batch |
| 2026-09-10 | `sh test/run.sh` + `node tools/overview.mjs --tests` | 1,863 assertions, 0 failures, including verified-sender readiness, provider rejection, both signup doors and Featured-show settlement |
| 2026-09-10 | `node tools/uicheck.mjs` | Gig-level Feature/Edit/cancel order, 320px fit, scoped three-bullet orange promotion sheet and all existing rendered checks pass |
| 2026-09-10 | Netlify draft `6aa2af9b3a81cc0488b757c9` | Updated Studio, auth function, global theme and directory assets served; no preview write path exercised; production unchanged |
| 2026-09-10 | `sh test/run.sh` + `node tools/overview.mjs --tests` | 1,852 assertions, 0 failures, including Featured shows settlement and public artist-directory privacy/filter behavior |
| 2026-09-10 | `node tools/uicheck.mjs` | Global Studio/public theme palettes, red Live label source, directory filters and 320px layout all green |
| 2026-09-10 | Netlify draft `6aa2a605960074ede64f0f3a` | Home, `/artists`, both Studios, voting page, theme asset and no-cache directory API all served successfully; production unchanged |
| 2026-09-09 | `node tools/overview.mjs --tests` + rendered UI/touch checks | 1,808 assertions, 0 failures; paid replay votes, conditional request authorization/capture, three-vote birthdays, mobile layout and sheet behavior all green |
| 2026-09-09 | `sh test/run.sh` | Every suite section passed with the new show controls, positive-vote guard and fee ladder |
| 2026-09-09 | `node tools/uicheck.mjs` | Phone-width unified replay list, five-vote minimum, tip copy, live controls, inactive Live state and no overflow all passed |
| 2026-09-09 | Netlify draft deploy `6aa0db9c42570c274fbd5c1e` | Requested audience and Studio content served from the preview; read-only `/api/show` succeeded; no preview write path exercised |
| 2026-09-09 | `sh test/run.sh` + `node tools/overview.mjs --tests` | Full suite green; overview stamped 1,762 assertions, 0 failures |
| 2026-09-09 | `node tools/uicheck.mjs` | Phone-width orange borders/copy, played-song state, repeat voting, paid-vote pills and decline action all rendered without horizontal overflow |
| 2026-09-09 | `node --import ./test/register.mjs test/decline.mjs` | Exact free/paid refunds, unrelated-song isolation, hidden-song lockout and retry idempotency all passed |
| 2026-09-09 | Netlify draft deploy `6aa04e5930bf024ac5cfb479` | One live profile CTA; retired voting-sheet sentence and duplicate Settings controls absent; existing room still returns 3/3, 3/$5 and 15/$20 |
| 2026-09-09 | `node tools/uicheck.mjs` | Phone-width vote, live profile and Settings layouts all passed, including exact section order and no duplicate CTA |
| 2026-09-09 | `sh test/run.sh` + `node tools/overview.mjs --tests` | 1,737 assertions, 0 failures |
| 2026-09-09 | Netlify draft deploy `6aa041448e6b1e3af49326be` | Existing stored room now returns 3/3 free votes, 3/$5 and 15/$20; Settings still allows paid customization |
| 2026-09-09 | `sh test/run.sh` | 1,735 assertions, 0 failures, including raw legacy-document migration and paid customization |
| 2026-09-08 | Netlify draft deploy `6aa03c5c4e14a64f2722db68` | Internal preview live; served content contains the new counter, empty-wallet purchase action and pack defaults |
| 2026-09-08 | `sh test/run.sh` | 1,721 assertions, 0 failures |
| 2026-09-08 | `node tools/uicheck.mjs` | Phone-width `3/3 votes` counter and empty-wallet “Buy more votes” sheet rendered; all checks passed |
| 2026-09-08 | `node tools/overview.mjs --check` | Current; voting defaults generated from source |
| 2026-09-08 | Live `POST /api/pay` after the key swap | 200, `cs_live_` session created — payments restored |
| 2026-09-08 | Git hooks fire on a throwaway branch | pre-commit refreshed and staged; post-commit wrote `PENDING.md` |
| 2026-09-07 | 40 QR lengths × {with mark, without}, decoded | 80/80 |
| 2026-09-07 | Production content check after deploy | new copy live, old copy absent |

---

## Deviations from plan

| Date | Planned | Actual | Reason | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-09-05 | A hard cap on room size | A soft cap: the room slows and shortens, nobody is refused | The research said a mid-song lockout costs the artist relationship, which is the whole business | Decision `0006` |
| 2026-09-06 | Shrink clips on the phone | Upload them untouched, with a trimmer | Three rounds of silent-audio bugs, all caused by the size constraint | Decision `0011` |
| 2026-09-07 | Votes return between songs | A vote never comes back | Perry's rule, stated as final | Decision `0001` |
| 2026-09-09 | No setlist vote ever returns | An artist may explicitly decline an unplayed song and return its votes | The queue needs a fair correction when a song cannot be played | Decision `0016` |
| 2026-09-10 | Refresh the external SSD mirror | Mirror script stopped without writing because the SSD is not mounted | Preserve the local handoffs and rerun when the drive is connected | `~/Docs/Project Handoffs/mirror-to-ssd.sh` |
| 2026-09-11 | R2 after the shared-board split, on a ~100GB/month trigger | R2 built now, in a worktree, while the split is mid-edit in the main checkout | The user withdrew the trigger, opened the Cloudflare account and put the keys in Netlify; the main checkout held another session's uncommitted files, so a worktree off `main` kept the two apart | Merge `claude/r2-clips` when told; the two touch no common code, only `IMPLEMENTATION_STATUS.md` |
| 2026-09-11 | A custom domain in front of the bucket | A 302 from `/api/vid` to a presigned GET on the bucket's S3 endpoint | `myset.vip`'s DNS is on Netlify (NS1), not Cloudflare; `r2.dev` is rate-limited | Decision `0033`; revisit if the zone ever moves |

---

## Decision log

**The full log is `docs/decisions/`** — one file per decision, with every option that was
on the table, what it costs, what it makes harder and what would reverse it. Do not
duplicate it here. Index: `docs/decisions/README.md`.

| Date | Decision | Record |
| --- | --- | --- |
| 2026-09-11 | Find artists lists only effectively verified artist profiles | `0028` |
| 2026-09-11 | Light is the first-visit default and loading screens follow the active theme | `0027` |
| 2026-09-11 | The $20 artist plan takes a 2% transaction fee | `0026` |
| 2026-09-11 | Filtered event maps use a static image and existing exact directions links | `0025` |
| 2026-09-11 | Artist directory discovery facts derive from their existing source records; style alone is new profile data | `0024` |
| 2026-09-09 | An artist-declined unplayed song returns its votes | `0016` |
| 2026-09-08 | Three free votes; default packs are 3 for $5 and 15 for $20 | `0014` |
| 2026-09-07 | A vote never comes back | `0001` |
| 2026-09-07 | The countdown is a nudge, not a lock | `0010` |
| 2026-09-11 | Errors and bug reports live in the blob store, not a vendor | `0029` |
| 2026-09-11 | Casting is rate-limited by a token bucket on the fan record | `0030` |
| 2026-09-11 | The audience poll is split into a shared, edge-cached board and a tiny personal call | `0034` |
| 2026-09-11 | A clip's bytes live on Cloudflare R2 and the phone is sent there by a signed link | `0033` |
| 2026-09-07 | The open line is not next | `0012` |
| 2026-09-06 | Clips go up as they are | `0011` |
| 2026-09-05 | A full room is never refused | `0006` |

---

## Open risks

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Google Maps key is absent or misrestricted | Event map cannot render | Button is hidden while absent; full show list/directions survive map failure; key is restricted to MySet production and the current QA preview, and to Static Maps, Maps JavaScript and Geocoding only | Resolved 2026-09-12 |
| **Perry's own accounts are phished** | Total — Google, GitHub, Netlify, Stripe. No line of MySet's code is involved | 2FA on all four. PER-003 | **Active, unmitigated** |
| **Pre-attribution active votes cannot be split exactly by song** | A paid-vote pill or decline refund on a vote cast before this batch may not know its original source | New votes are exact; legacy decline uses a fan-favouring paid-first fallback | **Known transition risk** |
| Card payments down on a bad Stripe key | Nobody can buy votes or tip | Key replaced 2026-09-08; live checkout verified. The gap that let it go unnoticed is still open — P3-008 | Resolved 2026-09-08 |
| **Nothing detects a dead Stripe key** | `paymentsEnabled` checks the key EXISTS, never that it WORKS, so the room is shown a buy button that fails on tap | P3-008 | **Active, unmitigated** |
| **A bug cannot be diagnosed after the night** | A fan reports something, the logs are already gone | Durable hourly errors + fan reports with three-hour context | Resolved 2026-09-11 |
| Nobody has tested a restore | Data loss would be discovered during recovery | — | Active |
| Nobody is alerted when something breaks | A silent failure runs until somebody notices | Errors are now kept, but nobody is paged — that is the half Sentry would add | Active |
| A room over ~2,500 breaks on reads | A big booked show fails live | P3-001 built (not deployed): the busiest-case wall at today's record weight is ~2,500 — and was ~700–1,000 before it. P3-013 (lighter records) moves it past 10,000 in the simulator | Active, bounded by the soft caps; **the number is a simulation** |
| The edge does not hold the board in production | Every phone pays the full render again — the pre-split bill, not an outage | Measured 2026-09-11: the durable cache needs ≥10 s, so the middle rung became 10 s; pubs (≤200) keep a per-node 3 s copy, which costs cents either way | Resolved 2026-09-11 |
| The personal call bills more than the ~50 ms estimated | The split saves fewer credits than the simulator says | Read the function log after the first gig on the new endpoints | Open |
| One clip watched a lot costs more than thirty gigs | Bandwidth is the only line item that can run away | The 75MB cap and the trim screen; clip bytes on R2 (no egress charge) once `claude/r2-clips` is on `main` — pre-R2 clips still bill Netlify egress until they leave | Mitigated in worktree 2026-09-11, pending deploy |
| **A 75MB clip may not reach R2 inside the function's budget** | The upload falls back to Blobs (or fails with "try again"); the room is unaffected | PUT gives up at 8s; the first real large upload after deploy measures it; S3 multipart from the piece path is the fallback design | **Unmeasured** |
| **Clip playback through the 302 on a real iPhone** | A clip on R2 does not play on the phones in a bar; voting unaffected | Verified in the suite that the Range survives to the far side of the link; not on a device | **Unmeasured** |

---

## Handoff checklist

Before ending a session:

1. Refresh **Last reviewed**, **Current focus**, **Next work item** above
2. Set checklist rows with **evidence** — paths, command output, commit SHAs
3. Write a record in `docs/decisions/` for anything that could have gone another way
4. Write the session file in `docs/sessions/`
5. Update `HANDOFF-MySet.md` and `PORTFOLIO-MASTER-BRIEF.md`
6. Run `~/Docs/Project\ Handoffs/mirror-to-ssd.sh`
7. Push
