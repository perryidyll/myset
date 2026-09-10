# Implementation status

Repo-owned ledger for execution state, evidence, blockers and decisions. **Chat history
is not durable project memory.**

This file answers *"what is happening right now?"*. It does not repeat what the other
documents own: `MYSET-MASTER-OVERVIEW.md` is what MySet is, `INVARIANTS.md` is what must
never break, `docs/decisions/` is why a design is the way it is, and `docs/sessions/` is
what happened on a given day.

**Last reviewed:** 2026-09-10
**Current phase:** Phase 3 — scale preparation, on a product that is already live
**Current focus:** Upcoming gigs now expose their fixed-price Featured-show action
directly, and the promotion sheet explains it in prominent orange bullets. Artist and
venue signup email now requires a verified sender and reports provider rejection instead
of falsely claiming a code was sent. The production Resend key exists, but `AUTH_FROM`
is not configured, so public email signup is honestly unavailable until that final
operator step is completed. All 1,863 assertions and rendered mobile checks pass. The
complete batch is live in production at `33d7429`; deploy `6aa2bf1185cb7d000874ed54`
was verified by served content.

**Next work item (pick up here):** The **shared-board split** — one cacheable board
payload with no `fan=` in the URL, plus a tiny per-fan endpoint. ~5 days, no new vendor.
It is the gate on raising the plans' room sizes. See `docs/reports/open-line.html` §
"What to build first".

**Fresh-agent one-liner:** `Read AGENTS.md, then continue Phase 3 per IMPLEMENTATION_STATUS.md — the next item is the shared-board split, not the open line.`

---

## Status vocabulary

`not_started` · `in_progress` · `blocked` · `done` · `deferred` · `cancelled`

---

## Phase gates

| ID | Gate | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| GATE-001 | A gig runs end to end with no intervention | done | The Ugly Duckling, 2026-08-30 — 8 voters, 21 votes, one $3 purchase, nothing went wrong | The only real-world data point there is |
| GATE-002 | A second artist can sign up, get paid and run a show without Perry | in_progress | Accounts, roles, billing and Connect all shipped; nobody but Perry has done it | The real test of the $10/month ambition |
| GATE-003 | A room of 2,000 works, not just costs an affordable amount | blocked | `tools/loadsim.py`; honest ceiling ~2,500 after the signature split | **Blocked on P3-001.** Do not sell a bigger room first |
| GATE-004 | A bug reported by a fan can be traced without reproducing it | not_started | — | Netlify keeps function logs for **24 hours**. See P3-004 |

---

## Phase checklist

### Phase 3 — scale preparation

| ID | Work item | Status | Evidence | Blocker / next action |
| --- | --- | --- | --- | --- |
| P3-001 | **Shared-board split** — one cached board, tiny per-fan endpoint | not_started | — | The next thing to build. Gates GATE-003 and the plan room sizes |
| P3-002 | Open line to the room (Cloudflare Durable Objects) | deferred | `docs/reports/open-line.html`, decision `0012` | Deliberately after P3-001. Trigger: a booked show over 2,000 with a date and a deposit |
| P3-003 | Clip bytes onto Cloudflare R2 | deferred | Session doc 2026-09-06 | Trigger: ~100GB of clip traffic a month (~$13). Needs Perry's own Cloudflare account |
| P3-004 | **Error tracking that outlives the night** | not_started | — | Netlify's function logs are gone in 24h. Sentry's free tier is 5,000 errors/month, 30-day retention. Nothing can be diagnosed after the fact today |
| P3-005 | Fan-shard write ceiling actually measured | not_started | Derived from a measured 40ms *read*, never from a write | Hammer one shard before selling a room over 2,000 |
| P3-008 | **A payments health check that runs off the hot path** | not_started | — | The 2026-09-08 outage was invisible until a fan tapped. A key can be valid-looking and dead |
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
| Blob reads on the audience poll | ≤ 15 | 15 | continuous | `test/cost.mjs` fails the build above it |
| Honest room ceiling | 2,000 sold | ~2,500 | 2026-09-05 | Reads, not money, are the wall |
| Test assertions | all passing | see §2.1 of the overview | 2026-09-08 | Stamped by `tools/overview.mjs --tests` |
| Real gigs run on MySet | — | **1** | 2026-08-30 | Treat every projection as a projection |

---

## Verification log

| Date | Check | Result |
| --- | --- | --- |
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
| 2026-09-09 | An artist-declined unplayed song returns its votes | `0016` |
| 2026-09-08 | Three free votes; default packs are 3 for $5 and 15 for $20 | `0014` |
| 2026-09-07 | A vote never comes back | `0001` |
| 2026-09-07 | The countdown is a nudge, not a lock | `0010` |
| 2026-09-07 | The open line is not next | `0012` |
| 2026-09-06 | Clips go up as they are | `0011` |
| 2026-09-05 | A full room is never refused | `0006` |

---

## Open risks

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| **Perry's own accounts are phished** | Total — Google, GitHub, Netlify, Stripe. No line of MySet's code is involved | 2FA on all four. PER-003 | **Active, unmitigated** |
| **Pre-attribution active votes cannot be split exactly by song** | A paid-vote pill or decline refund on a vote cast before this batch may not know its original source | New votes are exact; legacy decline uses a fan-favouring paid-first fallback | **Known transition risk** |
| Card payments down on a bad Stripe key | Nobody can buy votes or tip | Key replaced 2026-09-08; live checkout verified. The gap that let it go unnoticed is still open — P3-008 | Resolved 2026-09-08 |
| **Nothing detects a dead Stripe key** | `paymentsEnabled` checks the key EXISTS, never that it WORKS, so the room is shown a buy button that fails on tap | P3-008 | **Active, unmitigated** |
| **A bug cannot be diagnosed after the night** | A fan reports something, the logs are already gone | P3-004 | **Active, unmitigated** |
| Nobody has tested a restore | Data loss would be discovered during recovery | — | Active |
| Nobody is alerted when something breaks | A silent failure runs until somebody notices | P3-004 covers half of it | Active |
| A room over ~2,500 breaks on reads | A big booked show fails live | P3-001 | Active, bounded by the soft caps |
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
