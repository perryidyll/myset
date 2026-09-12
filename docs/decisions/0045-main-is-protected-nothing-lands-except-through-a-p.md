---
id: 0045
title: main is protected — nothing lands on it except through a pull request
date: 2026-09-12
status: decided
decided_by: perry-confirmed
area: ops
reverses:
superseded_by:
invariants: [9d3]
commits: []
tests: []
files: [AGENTS.md, MYSET-MASTER-OVERVIEW.md, docs/processes/engineering-os/04-committing-and-deploying.md]
---

## The question

`main` **is** production: a push deployed to myset.vip in about a minute with no gate of any kind. `HARDENING.md §2` had asked for branch protection since 2026-09-01 — for two reasons: a pause before a live outage, and the legal point that a trade secret needs *measures* keeping it. The founder delegated the call on 2026-09-12: *"do the branch protection … using your best judgement."* The judgement had to weigh a solo founder's shipping speed, several agent sessions working the repo at once, and a Netlify credit budget that a careless setting could double.

Found while doing it: the repository is **public** on GitHub (`gh repo view` → `visibility: public`), which `HARDENING.md` believed was private. That is recorded in the ledger as its own open risk and was not changed here — it is the founder's call — but it is also why rulesets are available at no cost.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: a ruleset on `main` — pull request required (zero approvals), no force-push, no deletion, no bypass** | A direct push is refused; work goes on a branch, gets a free Netlify deploy preview on the PR, and merging is the deploy. The person shipping merges their own PR | A branch and two `gh` commands per deploy | One GitHub ruleset (id 23031933); the deploy procedure in `AGENTS.md` and overview §6.1 | A session that still runs `git push` on `main` is refused with a clear message — nothing is lost, it makes a branch |
| B — the same, plus the Netlify deploy-preview check required to pass | Production cannot take a commit whose build failed | Every PR must build, including doc-only ones that today carry `[skip ci]` — and a `[skip ci]` PR would then never be mergeable | A required status whose exact name must never drift | Every merge blocked by a check that did not run |
| C — the same, plus a required approval | A second pair of eyes | There is no second pair of eyes; the founder would approve their own PR through a second account, or be unable to ship | — | Ceremony |
| D — no-force-push and no-deletion only | Protects history, not production | Nothing | One ruleset | A bad commit still goes straight live |
| E — do nothing | — | — | — | `HARDENING.md`'s first GitHub item stays open |

## What was chosen, and why

**A.** It buys the two things that matter — a look at the exact bytes before they go live, on a preview that cannot charge a card, and a history nobody can rewrite — without inventing a reviewer who does not exist or a build gate that fights the credit budget. Zero approvals is honest: the PR is a pause, not a gate. No bypass for administrators is deliberate (HARDENING §2's wording): the whole point is that *nobody* pushes straight to production, including the person who could. The emergency path is still under a minute: branch, commit, `gh pr create --fill`, `gh pr merge --squash`.

Squash and merge are allowed; rebase is not — a squash of a single commit keeps that commit's message, which is how doc-only changes keep their `[skip ci]` and Netlify keeps not billing a production build for them.

## What this makes harder

Every session's deploy step changes shape, and any session started before this record read the old `AGENTS.md`. The push log (`docs/PUSH-LOG.md`, introduced the same afternoon by another session) is where they find out. A rebase-and-force-push workflow is gone. A hotfix during a live show costs one more command than it did.

## What would reverse it

A second person who can review — then approvals become worth requiring (option C). A CI that runs the suite on the PR — then the required check (option B) becomes safe, because it would always run. Or the founder deciding the pause is not worth the friction: the ruleset is one click to disable in Settings → Rules.

## How it was verified

`gh api -X POST repos/perryidyll/myset/rulesets` returned id 23031933, enforcement `active`, rules `deletion`, `non_fast_forward`, `pull_request`, bypass actors none. `gh api repos/perryidyll/myset/rules/branches/main` read back the same three rules with `required_approving_review_count: 0` and `allowed_merge_methods: ["squash","merge"]`. **Not checked:** a push actually being refused — no push was attempted; the next session's first deploy is the test.
