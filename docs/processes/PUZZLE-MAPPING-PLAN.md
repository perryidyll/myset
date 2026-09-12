# Mapping every MySet process into Puzzle — the plan

**Status:** proposed, 2026-09-12. Nothing in Puzzle has been changed by this plan yet. **Goal:** every process in the product, the engineering practice and the business, down to the rule-and-exception level, laid out in puzzleapp.io as one connected network — and kept true as the code moves.

---

## 0. The one design rule

**The repository stays the source of truth. Puzzle is a projection of it.**

Puzzle cannot hold a number that is generated from the code, cannot be diffed, cannot be tested, and cannot be read by an agent working in the repo. So every process is written **first as a process sheet in `docs/processes/`** (git-tracked, reviewable, diffable) and **then loaded into Puzzle** through the MCP tools. When the two disagree the sheet is right, exactly as `IMPLEMENTATION_STATUS.md` beats `IMPLEMENTATION_PLAN.md`.

This gives four things the direct route would not:

1. **"Never claim what you have not run"** survives — a sheet cites the file, invariant or decision each step comes from, and the load-back can be verified.
2. **Numbers come from the code** — a step says *"the free-vote allowance (§2.1)"*, never *"3 votes"*. Puzzle never drifts on a price, a cap or a count.
3. **Any agent can rebuild Puzzle from scratch** if a workspace is lost or restructured.
4. **A change to a process is a diff in git**, and the session-end checklist can catch it.

---

## 1. What the audit found (the starting position)

### The repo

`project-audit` scored MySet **96 / 100 — Full tier**. Engineering process is unusually well documented: a ledger with evidence columns, 37 decision records with an index and a backlog hook, 35 session files, ~215 numbered invariants, a generated numbers block, a startup checklist and a handoff protocol. **That side of the map can be built almost entirely by extraction.**

The gaps that matter *for this mapping*:

| Gap | Why it matters here |
| --- | --- |
| `README.md` still says "no multi-artist accounts or auth" and "a single static file" | Anyone extracting from it maps a product that no longer exists. Fix before extraction |
| ~30 root-level documents, several superseded (`AUDIT-2026-09-0x`, `WORKPLAN-2026-09-02`, `REVIEW-…`, four `MYSET-LANDING-PAGE-*`, the Idyll copy prompt) with no live/historical marking | The extraction needs a triage table first, or dead processes get mapped as live |
| **Business processes exist as strategy, not as procedure.** The marketing document is a 1,348-line doctrine; accounting is a design note; onboarding a stranger (P4-001) is *not started*; admin (Netlify billing, DNS, Resend, 2FA) lives only in `HARDENING.md`, `SECURITY.md` and the ledger's "own list" | These cannot be extracted — they have to be **written as procedures for the first time**, with the founder in the room. This is the slow half of the job |
| The `shipping-discipline` skill lives in the home config, not the repo | It is a real process (pre-flight, evidence, review, deploy guard, post-flight) that only Claude sees |

### The Puzzle workspace (read 2026-09-12)

- **Five Workflow tabs** and **five Team tabs** from the generic template (Product & Engineering, Marketing, Customer Success, Finance & Operations, R&D).
- **16 template sections with 2–4 placeholder steps each** — and the placeholders are *wrong for MySet* ("Open pull request", "CI pipeline runs test suite on PR", "tasks in Notion or GitHub Issues"). MySet has no PRs, no CI gate and no issue tracker; a push to `main` is the deploy. These must go before anything real sits next to them.
- **One real section:** *Stripe Connect Onboarding & Payments*, 16 steps, all `Live`, with one changelog entry. Good density — the target for everything else.
- **Tools:** Claude Code, GitHub, Netlify, Stripe, Notion, Instagram, TikTok, Facebook, Meta Ads, Meta Business Suite, a WordPress pixel. **Missing:** Cloudflare R2, Resend, Google Maps, Google Sheets, Puzzle itself. **No entities, no attributes** (the data model is empty).
- **Teams/roles:** the template's 13 roles; **one person**, assigned to all five teams.
- **Changelog:** one entry.

---

## 2. What "every microscopic detail" means, concretely

Three levels of depth, and every process gets all three:

| Level | Puzzle object | What goes in it | Source in the repo |
| --- | --- | --- | --- |
| **L1 — the journey** | Section | The actor, the trigger, the outcome; the sequence of L2 steps | Master overview Parts 1, 3, 4 |
| **L2 — the step** | Step (typed: task / conditional / payment / notification / database / …) with executor Person / Automation / AI Agent, roles (RACI), tools | What happens, who or what does it, what it touches | Overview, `ACCOUNTS.md`, `ACCOUNTING.md`, the function files |
| **L3 — the rule and the exception** | Step **notes** (markdown) | Every invariant that guards the step, every failure branch and what it degrades to, what the person is told word for word, and the decision record that explains why | `INVARIANTS.md` (numbered), `docs/decisions/`, overview §1.10 / §1.11 |

Plus two cross-cutting layers:

- **Why** — every decision record (`0001`–`0039`, and each new one) becomes a **Puzzle changelog entry** linked to the steps it changed. Superseded decisions stay, marked superseded, so the "twist and turn" is visible. The ledger's *Deviations from plan* table is loaded the same way.
- **What** — the data objects (show, fan record, board, artist, venue, session, ledger line, clip, post …) become **entities with attributes on the Tools canvas**, linked to the steps that read or write them. Source: overview §5.2 and the storage section of `INVARIANTS.md`.

Every step note ends with a **source line**: `src: MYSET-MASTER-OVERVIEW.md §1.5 · INVARIANT 15h · decision 0034`. That line is what makes the whole map checkable.

---

## 3. The target shape of the Puzzle workspace

### Workflow canvas — replace the five template tabs with MySet's real domains

| Tab | What lives there | Main sources |
| --- | --- | --- |
| **1 · The gig** | Everything that happens in the room, on the night: scan → vote → buy → tip → request → decline → last call → end → dark room; the Studio Live tab as the artist runs it; auto-start and auto-end; the polling dial; the rate limit | Overview Parts 1 & 3, `GIG-NIGHT.md`, decisions 0001 0002 0006 0009 0010 0014 0016 0019 0021 0030 0034 |
| **2 · Artist lifecycle** | Sign-up, passkeys, sessions, roles, recovery, moving the address, verification and the tick, plans and upgrade/downgrade, promo codes, export, 30-day delete | `ACCOUNTS.md`, overview §5.5 §5.6 §2.6 §2.7, decisions 0003 0004 0005 0023 0036 |
| **3 · Venue lifecycle** | Venue account, verification (three ways), pitches and replies, the venue fee split, venue plans | `VERIFYING-A-VENUE.md`, `ACCOUNTS.md` §3, overview §3.6 §4.4 |
| **4 · Money** | The existing Stripe Connect section, extended: vote packs, tips, requests (authorise-then-capture), merch orders, Featured shows, the three delivery paths, reconcile, the books, the monthly close, invoices and failed cards, the fee ladder | Overview Part 4, `ACCOUNTING.md`, `STRIPE-CONNECT.md`, `finance/`, decisions 0007 0017 0018 0026 0031 0032 |
| **5 · Community & media** | Posts, likes, moderation from the Profile tab, photos and cropping, clips (trim → upload → R2 → signed link → fallback), chords and lyrics licensing, "where a night happened" | Overview §3.7 §3.8, decisions 0011 0020 0022 0033 |
| **6 · Engineering operating system** | The session workflow end to end: `git status` → ledger → work → tests → draft preview → ledger update → decision record → session file → handoff docs → SSD mirror → push = deploy; the git hooks; overview regeneration; worktrees; the eight rules; the invariants as guard-rails; the `shipping-discipline` pre-/post-flight | `AGENTS.md`, overview Parts 5–7, `tools/`, `test/run.sh`, `~/.claude/skills/shipping-discipline` |
| **7 · Reliability & security** | Error log and fan bug reports, the Studio reader, `prod.py` health, `credit-burn.sh`, secret rotation, the dead-Stripe-key gap (P3-008, *not built* → Draft), restore (*never tested* → Draft), 2FA on the four accounts, the CSP, the threat model | `SECURITY.md`, `HARDENING.md`, decisions 0013 0029, ledger risks |
| **8 · Marketing & growth** | The content operating system as **procedures**: the weekly rhythm, the gig-to-content pipeline (pre-production → shot list → multiplier → batch → naming), the two-post loop, the review ritual, kill rules, the Founding 50 programme, the outbound motion, Scene Zero / Scene One | `MySet_Master_Marketing_Strategy_v3.md` §5–§12 |
| **9 · Admin & finance** | Netlify (billing, credits, deploys, env vars), Stripe dashboard duties (webhooks, `charge.updated`, restricted keys), domain and DNS, Resend sender, Google Maps key restriction, the money model and actuals, tax | `HARDENING.md`, `finance/README.md`, `GOOGLE-SHEET-SETUP.md`, ledger PER-rows |
| **10 · Onboarding** | Onboarding a stranger: sign-up → Connect → first gig, no help. **Not built end to end (P4-001)** — mapped as the *intended* process, every step `Draft`, so the gap is visible on the canvas | `IMPLEMENTATION_PLAN.md` Phase 4 |

The template tab *R&D* is dropped; *Customer Success* folds into tabs 2, 3 and 10 (there is no support function yet, and the canvas should not pretend there is).

### Team canvas — real actors, not a template org chart

MySet is one person plus coding agents, and three kinds of outside actor. Proposed:

| Team | Roles |
| --- | --- |
| **Founder** | Founder / operator (product, engineering direction, marketing, admin, money) |
| **Agents** | Coding agent (Claude Code session) · Reviewing agent (fresh-context review) — executor *AI Agent* |
| **Automations** | Netlify scheduled functions (`autocron`, `sheetcron`) · Stripe webhooks · git hooks — executor *Automation* |
| **The room** *(external)* | Fan · Artist · Artist team member (roles from `ACCOUNTS.md` §6.3) · Venue manager |

The template's 13 roles are removed. External actors carry an *(external)* marker in their notes so RACI never implies the founder can assign them work.

### Tools canvas — the stack, then the data model

Add **Cloudflare R2, Resend, Google Maps Platform, Google Sheets, Puzzle**. Remove the WordPress pixel unless it is real. Then the entities, one per storage family from overview §5.2 (`show_`, fan shard `f0…f11_`, `meta_`, `hist_*`, `ev_`, `lists_`, `req_`, `profile_`, `posts_`/`likes_`, `billing_`, `ledger_`, `connect_`, `vidpend_`; venue `v_`, `vprofile_`, `vouch_`, `vpitch_`; the global registries `artists`, `venues`, `cityindex`, `acctindex`, `flags`, `idqueue`, `promos`, `gigsched`, `vidqueue`), each with its fields read from the function that owns it, and linked to the steps that read or write it.

### Changelog — the reasons

One entry per decision record, title = the record's title, body = the options weighed, the cost of each, and what would reverse it, linked to the affected steps. Then one entry per *Deviations from plan* row. New decisions are added on the day `tools/decide.sh` runs.

---

## 4. The process for each section (the unit of work)

Every section goes through the same seven steps. **A section is not `Live` in Puzzle until step 7 is quoted in the sheet.**

1. **Extract** — read the sources named in the tab table; list every step, branch, message and rule.
2. **Draft the sheet** — `docs/processes/<tab>/<section>.md` with front matter (tab, section name, sources, Puzzle ids once known) and the steps at all three levels. For a business process with no source, this is an **interview with the founder**, not an extraction, and the sheet says so.
3. **Review the sheet** against the code, not the docs — open the function or page and confirm each branch exists. Anything unconfirmed is marked `not checked` in the sheet and `Draft` in Puzzle.
4. **Load** — `create_process` for the section, `create_changelog_entries` for its decisions, `link_to_steps` for tools, entities and changelog.
5. **Read back** — `list_steps` with notes and connections; diff against the sheet.
6. **Fix and record** — write the Puzzle ids into the sheet's front matter.
7. **Verify in the browser** once per tab — a section that reads correctly through the API can still lay out as spaghetti.

Two or three sections per working session is the honest pace at this density.

---

## 5. The order of work

Ranked by MySet's own rule: *nothing may break the gig*, so the gig is mapped first, and the least-documented half (business) is deliberately not last, because it is the half that cannot be regenerated from code if it is never written down.

| Phase | Sessions | Deliverable | Done when |
| --- | --- | --- | --- |
| **0 · Prepare** | 1 | Fix `README.md`; write the root-doc triage table (`live` / `historical` / `superseded by`) at the top of this file; restructure Puzzle tabs, teams, roles and tools; **remove the 16 template sections** (the founder's call — see §7); write `docs/processes/CONVENTIONS.md` (naming, source lines, status meanings, the no-numbers rule) | Puzzle shows ten empty tabs, the real teams, the full tool list, and the Stripe section untouched |
| **1 · The gig** | 4–5 | Tab 1 complete: the fan's night (~6 sections), the artist's night (~4), the automations (auto-start/end, polling, rate limit, dark room) (~2). Decisions 0001–0002, 0006, 0009–0010, 0014, 0016, 0019, 0021, 0030, 0034 in the changelog | Every L3 note cites an invariant or a decision; browser check done |
| **2 · Money** | 3–4 | Tab 4: extend the existing section; add packs, tips, requests, merch, Featured, delivery paths, reconcile, books, monthly close, invoices/failed cards, fee ladder. Entities `meta_`, `ledger_`, `billing_`, `connect_` | Every money step names the invariant in `INVARIANTS.md` § Money that guards it |
| **3 · Accounts & venues** | 3 | Tabs 2, 3 and 10. Onboarding mapped as intended, all `Draft` | The venue's three verification ways and the artist's leave path are on canvas |
| **4 · Engineering OS** | 2–3 | Tab 6: the session workflow, deploy, hooks, tests, overview regen, decision records, the eight rules. This tab is where a new agent or hire learns how the repo is worked | An agent could follow the canvas alone and end a session correctly |
| **5 · Reliability & security** | 2 | Tab 7, including the unbuilt and untested items as `Draft` | Every ledger risk row has a step or a `Draft` step |
| **6 · Community & media** | 2 | Tab 5, with the R2 path and its fallbacks; entities `posts_`, `vidpend_`, `vidqueue` | — |
| **7 · Business — written for the first time** | 5–8 | Tabs 8 and 9. Interviews with the founder turn strategy into procedure: what actually happens each week, each gig, each month-end, each time a key rotates or a bill arrives. Ten questions at a time (the `interview` skill), one domain per session | Each procedure has an owner role, a frequency and a duration filled in — Puzzle's own fields — not just a description |
| **8 · Data model** | 2 | Every remaining entity and attribute, linked to steps | `list_entities` returns every storage family in §5.2 |
| **9 · History** | 1–2 | Remaining decisions and deviations in the changelog; session files summarised where they explain a twist not covered by a decision record | 37+ changelog entries, each linked |
| **10 · Keep it true** | 1 | Add to `AGENTS.md` session-end checklist: *"if a process changed, update its sheet and reload the section"*; make `tools/decide.sh` print *"add a changelog entry in Puzzle"*; a quarterly read-back diff of Puzzle against the sheets | The drift rule is in `AGENTS.md` and the ledger's handoff checklist |

**Rough total: 25–35 working sessions**, producing roughly 70–90 sections, 900–1,400 steps, ~40 changelog entries and ~30 entities. The numbers are estimates from the one real section's density (16 steps for one flow); they are not measured.

---

## 6. Risks to this plan

| Risk | Mitigation |
| --- | --- |
| Puzzle becomes a second truth and drifts from the code | Sheets in git are canonical; Puzzle never holds a generated number; drift rule in the handoff checklist |
| The business half is mapped from the strategy document instead of from what the founder actually does | Phase 7 is interview-driven; a step with no observed occurrence is `Draft` |
| The template sections are deleted and something in them was wanted | List them in the Phase 0 session file before removal; they are generic and take minutes to recreate |
| The MCP `create_process` call has size or rate limits at this volume | Unknown until tried; load one big section (the fan's night) first and note the limit in `CONVENTIONS.md` |
| The map is built and never looked at | Tab 6 is the onboarding document for the next agent or hire; Phase 4 is scheduled early for that reason |
| Twenty-odd sessions of agent work on a repo that another session may be editing | Sheets live under `docs/processes/`, which no product session touches; Puzzle writes touch no repo file |

---

## 7. Decisions the founder has to make before Phase 0

1. **Delete or archive the 16 template sections?** Recommendation: delete; they are generic and factually wrong for MySet.
2. **External actors as roles on the Team canvas** (Fan, Artist, Venue manager), or keep the Team canvas internal-only and put actors in step notes? Recommendation: roles, marked external — RACI on a step is the whole point of the canvas.
3. **Numbers in Puzzle:** cite §2.1 (recommended) or copy the value with a source stamp and a refresh step?
4. **Is Puzzle a projection of the repo (recommended) or the canonical process document?** Everything in §0 depends on this answer.
5. **Who else will read it?** If the answer is "a future hire or a co-founder", Tab 6 and Tab 10 move up the order. If the answer is "only me", Tab 8 moves up.
