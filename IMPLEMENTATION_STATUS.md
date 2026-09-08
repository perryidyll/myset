# Implementation status

Repo-owned ledger for execution state, evidence, blockers and decisions. **Chat history
is not durable project memory.**

This file answers *"what is happening right now?"*. It does not repeat what the other
documents own: `MYSET-MASTER-OVERVIEW.md` is what MySet is, `INVARIANTS.md` is what must
never break, `docs/decisions/` is why a design is the way it is, and `docs/sessions/` is
what happened on a given day.

**Last reviewed:** 2026-09-08
**Current phase:** Phase 3 — scale preparation, on a product that is already live
**Current focus:** Answering the open-line question in depth, and putting Perry's projects and agent config on GitHub

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
| P3-006 | `AGENTS.md` + this ledger on every project, not just MySet | in_progress | MySet done 2026-09-08 | iOhm landing, Idyll Mastery, Idyll Enterprises, Clients |

### Perry's own list (not code — these need his hands)

| ID | Work item | Status | Blocker / next action |
| --- | --- | --- | --- |
| PER-001 | Add `charge.updated` to the Stripe webhook | not_started | Without it the fee estimate stands; with it MySet's share is exact to the cent |
| PER-002 | Stop the double deploy; move Netlify to Pro | not_started | ~570 credits a month are the same change shipped twice |
| PER-003 | **2FA on Google, GitHub, Netlify and Stripe** | not_started | Twenty minutes, and the highest-value item in `SECURITY.md` — the ranked #1 threat is these accounts being phished, not the code |
| PER-004 | Set `AUTH_FROM` and the Resend domain | not_started | Sign-in mail still comes from a shared address; fine for Perry, wrong for the first stranger |
| PER-005 | Press **"Name these from my calendar"** in Money → Past shows | not_started | Five filed nights are still named after one venue |
| PER-006 | Try the passkey on stage | not_started | Is Face ID actually faster mid-set? |

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
| 2026-09-08 | `sh test/run.sh` | 1,716 assertions, 0 failures |
| 2026-09-08 | `node tools/overview.mjs --check` | current |
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

---

## Decision log

**The full log is `docs/decisions/`** — one file per decision, with every option that was
on the table, what it costs, what it makes harder and what would reverse it. Do not
duplicate it here. Index: `docs/decisions/README.md`.

| Date | Decision | Record |
| --- | --- | --- |
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
