# 2026-09-12 — Puzzle mapping: Phase 0 and The gig

**Asked:** an in-depth audit of MySet and a plan for mapping every process — product, engineering practice, business — into puzzleapp.io; then begin implementing the core processes, following Puzzle's own best practices.

**Working tree at start:** 17 modified and 5 new files from another session (the ten-shows / composer / faster-pages batch), unpushed. None were touched. The ledger (`IMPLEMENTATION_STATUS.md`) is among them, so **this session did not edit the ledger** — the rows for this work are listed at the end of this file for whoever pushes next.

## What shipped (repo)

| Path | What |
| --- | --- |
| `docs/processes/PUZZLE-MAPPING-PLAN.md` | The audit (96/100, Full) and the ten-phase plan |
| `docs/processes/CONVENTIONS.md` | The rulebook: repo is truth, Puzzle is a projection; no generated numbers in Puzzle; step/section/changelog/entity conventions from help.puzzleapp.io |
| `docs/processes/the-gig/01…07-*.md` | Seven canonical process sheets, ~106 steps, every refusal and status code read from `vote.mjs`, `admin.mjs`, `_lifecycle.mjs`, `_auto.mjs`, `autocron.mjs`, `_requests.mjs`, `pay.mjs`, `_pay.mjs`, `_lib.mjs` |
| `README.md` | Three stale lines corrected (it described the pre-account product) — 4-line diff |

## What shipped (Puzzle workspace 13099)

- **Workflow tabs:** The gig · Artist lifecycle · Venue lifecycle · Money · Community & media · Engineering OS · Reliability & security · Marketing & growth · Admin & finance · Onboarding. The five template tabs and their 16 placeholder sections (63 steps) were deleted on the founder's say-so; the one real section (*Stripe Connect Onboarding & Payments*, 16 steps) moved to Money and had its roles/tools re-pointed at the real ones.
- **Team tab "MySet":** Founder (Founder / operator) · Agents (Coding agent, Reviewing agent) · Automations (MySet server, Scheduled jobs, Stripe webhooks, Git hooks) · The room (external) (Fan, Artist, Artist team member, Venue manager). Five template team tabs deleted.
- **Tools:** groups *Production stack* (Netlify, Stripe, Cloudflare R2, Resend, Google Maps, Google Sheets), *Engineering* (GitHub, Claude Code, Codex, Puzzle), *Marketing channels* (Instagram, TikTok, Facebook, Meta Business Suite, Meta Ads — considering).
- **The gig tab, seven sections, 106 steps**, every step typed, executor set, role(s) with RACI, tool, and notes ending in a source line: The fan's night (41964) · Casting a vote (41965) · The artist's night (41966) · Buying votes and tipping (41967) · Requests and shout-outs (41968) · Shows that start and end themselves (41969) · The room under load (41970).
- **Changelog:** 16 decision records loaded as entries with options, costs and reversal conditions — 0001, 0002, 0006, 0008, 0009, 0010, 0012, 0013, 0014, 0016, 0018, 0019, 0021, 0029, 0030, 0034 — linked to 44 steps and 4 tools.

## What broke, and what was learned

- **Puzzle's free plan caps a workspace at 100 objects.** The first write failed; a one-step probe confirmed steps count. The founder moved to the Optimizer plan the same hour. Anyone resuming on a different workspace should check the plan first.
- The MCP rejects `status: archived` on changelog entries (create and update). Superseded decisions stay `completed` with a *Superseded by* header. Recorded in CONVENTIONS.
- An agent cannot sign in to Puzzle (no credentials are ever typed), so the browser layout check per tab is the founder's step. Sheets are therefore `loaded`, not `verified`.

## Verified

- Every section read back through `list_steps` with roles, tools and connections; *Casting a vote* compared line by line against its sheet — 15/15 steps, 16 connections, all labels present.
- README diff inspected: 4 insertions, 4 deletions, nothing else.
- Not run: the test suite (no code changed). Not checked: the canvas in a browser.

## Ledger rows to add when the other session's batch is pushed

| ID | Work item | Status | Evidence |
| --- | --- | --- | --- |
| DOC-001 | Puzzle mapping plan, conventions and Phase 0 | done | `docs/processes/PUZZLE-MAPPING-PLAN.md`, `CONVENTIONS.md`; Puzzle tabs/teams/tools created 2026-09-12 |
| DOC-002 | The gig tab loaded (Phase 1) | done — awaiting the founder's browser check | seven sheets under `docs/processes/the-gig/`; Puzzle sections 41964–41970; 16 changelog entries |
| DOC-003 | Money tab (Phase 2) | done — awaiting the founder's browser check | seven sheets under `docs/processes/money/`; Puzzle sections 41971–41977 (77 steps) beside the pre-existing Stripe Connect section 41595; changelog entries 1600–1608 (0003, 0004, 0005, 0007, 0017, 0026, 0031, 0032, 0036) linked to steps |
| DOC-004 | Accounts & venues (Phase 3) | not_started | tabs Artist lifecycle, Venue lifecycle, Onboarding; sources ACCOUNTS.md, VERIFYING-A-VENUE.md, overview §5.5–5.6 |

## Phase 2 — Money (same day, later session)

Seven sheets written from `_feesplit.mjs`, `webhook.mjs`, `_billing.mjs`, `pay.mjs`/`_pay.mjs` (merch), `_featured.mjs`, `_ledger.mjs`/`admin.mjs` (books) and `_history.mjs`/`tools/actuals.py`; loaded as sections 41971–41977, 77 steps; nine more decision records as changelog entries, linked. Read-back of *Stripe events arriving* matched its sheet (11 steps, every branch labelled). Two steps are `Draft` on purpose: *Is charge.updated on the endpoint?* (PER-001, the founder's) and *Move to a real package when it is worth it* (ACCOUNTING.md's standing recommendation).

## Next

Phase 3 (Accounts & venues), then Engineering OS — per the plan's order. Two founder decisions are still open from the plan's §7: who else will read the map (changes the order), and whether Puzzle stays a projection (assumed yes throughout).
