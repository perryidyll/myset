# Implementation status

Repo-owned ledger for execution state, evidence, blockers and decisions. **Chat history
is not durable project memory.**

This file answers *"what is happening right now?"*. It does not repeat what the other
documents own: `MYSET-MASTER-OVERVIEW.md` is what MySet is, `INVARIANTS.md` is what must
never break, `docs/decisions/` is why a design is the way it is, and `docs/sessions/` is
what happened on a given day.

**Last reviewed:** 2026-09-11 (evening)
**Current phase:** Phase 3 — scale preparation, on a product that is already live
**Current focus:** The **shared-board split (P3-001) is built, tested and reviewed, and sits
uncommitted in the working tree** alongside another session's uncommitted work of the
same day (burst 20, the live Maps header, the artists-page interactive map). Two other
sessions hold uncommitted work in worktrees: R2 (`claude/r2-clips`, which took decision
0033 and INVARIANT 0fd — this split is 0034 / 0fh–0fk) and the open line. The
audience poll is now two calls: `/api/board` (shared, no fan id, held at the edge for the
polling interval) and `/api/me` (personal, one shard, never cached); `/api/show` stays for
open tabs. 2,017 assertions, 0 failing. Nothing is deployed.

**Next work item (pick up here):** The user decides whether to commit and push. After the
deploy: watch `/api/board` live (`cache-status` must say `"Netlify Durable"; hit` on the
second request within three seconds, with an `age` header), then P3-013 (trim the cast
receipts that make a voter's record ~2 KB), then R2 (P3-003, blocked on the user's
Cloudflare click), then the open line (P3-002) **on the user's word — he said not to wait
for a 2,000-person booking**.

**Fresh-agent one-liner:** `Read AGENTS.md, then IMPLEMENTATION_STATUS.md; the split is built and not deployed — start from "Next work item".`

---

## Status vocabulary

`not_started` · `in_progress` · `blocked` · `done` · `deferred` · `cancelled`

---

## Phase gates

| ID | Gate | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| GATE-001 | A gig runs end to end with no intervention | done | The Ugly Duckling, 2026-08-30 — 8 voters, 21 votes, one $3 purchase, nothing went wrong | The only real-world data point there is |
| GATE-002 | A second artist can sign up, get paid and run a show without Perry | in_progress | Accounts, roles, billing and Connect all shipped; nobody but Perry has done it | The real test of the $10/month ambition |
| GATE-003 | A room of 2,000 works, not just costs an affordable amount | in_progress | P3-001 built 2026-09-11: `tools/loadsim.py --ceiling` puts the busiest-case read wall at ~2,500 **at today's measured record weight** (it was ~700–1,000 before the split at that weight; the old "~2,500" assumed 152-byte records). Live cache mechanism verified on `/api/img`; the 3 s TTL not yet watched live | Deploy, watch the edge live, then P3-013 and P3-005. **Still do not sell a bigger room** — nothing has been measured at a gig |
| GATE-004 | A bug reported by a fan can be traced without reproducing it | done | Hour-keyed durable server errors + fan report context + Studio report reader; 42/42 focused assertions | Reports retain the three server hours before the fan's note |

---

## Phase checklist

### Current requested batch

| ID | Work item | Status | Evidence | Blocker / next action |
| --- | --- | --- | --- | --- |
| UX-001 | Filtered thirty-day event map on Find artists | done | Decision `0025`; production `d1a6531`; restricted live PNG verified; 1,882/1,882 | — |
| UX-002 | Signed eligibility, Pro fee, light default and themed loading screens | done | Decisions `0024`, `0026`, `0027`; production `d1a6531`; 1,882/1,882 | — |
| UX-003 | Verified-only artist discovery, first-Settings notice and plans-testimonial cleanup | done | Decision `0028`; production `d1a6531`; served directory contains one qualifying profile; 1,882/1,882 | — |

### Phase 3 — scale preparation

| ID | Work item | Status | Evidence | Blocker / next action |
| --- | --- | --- | --- | --- |
| P3-001 | **Shared-board split** — one cached board, tiny per-fan endpoint | done | 2026-09-11, uncommitted: `_board.mjs`, `board.mjs`, `me.mjs`, `show.mjs` (composes from the same builders), `vote.mjs` (`at`), `_lib.mjs` (`getShow(aid,{withName:false})`, dial comment), `public/vote.html` (`load`, `mergeBoard`, `applyCast`, `SHOWN`/`CAST_AT`), `test/split.mjs` 80/80, `test/cost.mjs` board ≤15 / personal ≤3, `tools/loadsim.py --ceiling`, INVARIANTS 0fh–0fk, decision `0034`, fresh-context review with seven fixes taken; real-browser check of both halves failing in turn; live durable-cache probe on `/api/img` | Not deployed. After the deploy: watch `cache-status` and `age` on `/api/board`; read the personal call's billed duration off the function log (estimated ~50 ms, never measured) |
| P3-002 | Open line to the room (Cloudflare Durable Objects) | deferred | `docs/reports/open-line.html`, decision `0012` | After P3-001 and P3-003. **Trigger changed 2026-09-11 by the user: do not wait for a 2,000 booking — remind him the moment the split and R2 are done, and build it on his word** |
| P3-003 | Clip bytes onto Cloudflare R2 | in_progress | 2026-09-11: R2 enabled by the user; bucket **`myset-clips`** created (Standard class, automatic location, public access off). Account id `7a48fa04262dcda3055ebc7ba845985b`; S3 endpoint `https://7a48fa04262dcda3055ebc7ba845985b.r2.cloudflarestorage.com` | **Waiting on the user:** an R2 API token (Object Read & Write, scoped to `myset-clips`) put into Netlify as `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Then the code (~2 days). Open question for that session: how fans fetch clips — a custom domain needs the zone on Cloudflare; r2.dev is rate-limited and not for production; the alternative is a small signed-URL step |
| P3-004 | **Error tracking that outlives the night** | done | Durable capped hourly error documents, guarded handlers, fan report endpoint and Studio reader; 42/42 focused assertions | Retained in MySet's existing blob store; no third-party telemetry account required |
| P3-005 | Fan-shard write ceiling actually measured | not_started | Derived from a measured 40ms *read*, never from a write | **Now the next wall after reads.** Hammer one shard before selling a room over 2,000 |
| P3-013 | **A voter's record weighs ~2 KB after eight casts — trim the cast receipts** | not_started | Measured 2026-09-11 on the real write path: 101 bytes present-only, 412 after one cast, 864 after three, 2,010 after eight; `casts[]` (up to 20 receipts with outcomes) is most of it. At that weight the busiest-case read wall is ~2,500; at the report's 152-byte record it is past 10,000 | Keep the idempotency (INVARIANT 15h) and shrink the receipt: id + a compact outcome, fewer kept, or receipts aged out after a few minutes. Re-run `tools/loadsim.py --ceiling` after |
| P3-014 | Cache the slug→id registry read in `publicArtist` for a minute | not_started | A slug artist's personal poll is 3 reads (the registry, the show, one shard); the founding page is 2. Flags already cache this way (`_flags.mjs`, 60 s) | A separate decision: a deleted account would stay reachable for up to a minute. Low value until there are many slug artists in big rooms |
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
| Cost of a 3-hour gig, 20 people (after the split) | under 5¢ | **3.0¢** | 2026-09-11 | Up from 2.7¢: two requests a tick, and a cache hit is still a billed request. Every bigger room costs less than before (10,000: $3.76, was $4.29) |
| Honest room ceiling | 2,000 sold | **~2,500** busiest case at today's record weight (was ~700–1,000 before the split at that weight) | 2026-09-11 | `tools/loadsim.py --ceiling`. The earlier "~2,500" assumed 152-byte fan records; a voter's record is ~2 KB today (P3-013). At the lighter record the wall is past 10,000. Reads, not money, are the wall; the write wall (P3-005) is next |
| Test assertions | all passing | see §2.1 of the overview | 2026-09-08 | Stamped by `tools/overview.mjs --tests` |
| Real gigs run on MySet | — | **1** | 2026-08-30 | Treat every projection as a projection |

---

## Verification log

| Date | Check | Result |
| --- | --- | --- |
| 2026-09-11 | `sh test/run.sh` after the split and the review fixes | 2,017 assertions, 0 failures, every section green (`test/split.mjs` 80/80; `test/cost.mjs` board 14 reads, personal 2, legacy 14) |
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
| 2026-09-07 | The open line is not next | `0012` |
| 2026-09-06 | Clips go up as they are | `0011` |
| 2026-09-05 | A full room is never refused | `0006` |

---

## Open risks

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Google Maps key is absent or misrestricted | Event-map image cannot render | Button is hidden while absent; full show list/directions survive image failure; key is restricted to MySet production/previews and Static Maps only | Resolved 2026-09-11 |
| **Perry's own accounts are phished** | Total — Google, GitHub, Netlify, Stripe. No line of MySet's code is involved | 2FA on all four. PER-003 | **Active, unmitigated** |
| **Pre-attribution active votes cannot be split exactly by song** | A paid-vote pill or decline refund on a vote cast before this batch may not know its original source | New votes are exact; legacy decline uses a fan-favouring paid-first fallback | **Known transition risk** |
| Card payments down on a bad Stripe key | Nobody can buy votes or tip | Key replaced 2026-09-08; live checkout verified. The gap that let it go unnoticed is still open — P3-008 | Resolved 2026-09-08 |
| **Nothing detects a dead Stripe key** | `paymentsEnabled` checks the key EXISTS, never that it WORKS, so the room is shown a buy button that fails on tap | P3-008 | **Active, unmitigated** |
| **A bug cannot be diagnosed after the night** | A fan reports something, the logs are already gone | Durable hourly errors + fan reports with three-hour context | Resolved 2026-09-11 |
| Nobody has tested a restore | Data loss would be discovered during recovery | — | Active |
| Nobody is alerted when something breaks | A silent failure runs until somebody notices | Errors are now kept, but nobody is paged — that is the half Sentry would add | Active |
| A room over ~2,500 breaks on reads | A big booked show fails live | P3-001 built (not deployed): the busiest-case wall at today's record weight is ~2,500 — and was ~700–1,000 before it. P3-013 (lighter records) moves it past 10,000 in the simulator | Active, bounded by the soft caps; **the number is a simulation** |
| The edge does not hold the board for three seconds in production | Every phone pays the full render again — the pre-split bill, not an outage | Mechanism verified live on `/api/img`; the short TTL is unverified until the deploy. Watch `cache-status`/`age` on `/api/board` first thing | **Open until the deploy** |
| The personal call bills more than the ~50 ms estimated | The split saves fewer credits than the simulator says | Read the function log after the first gig on the new endpoints | Open |
| One clip watched a lot costs more than thirty gigs | Bandwidth is the only line item that can run away | The 75MB cap and the trim screen; R2 when it matters | Active, watched |

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
