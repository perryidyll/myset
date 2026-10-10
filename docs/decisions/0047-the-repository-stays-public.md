---
id: 0047
title: The repository stays public
date: 2026-09-12
status: decided
decided_by: perry
area: ops
reverses:
superseded_by:
invariants: [10, 11]
commits: []
tests: []
files: [HARDENING.md, SECURITY.md]
---

## The question

While setting up branch protection (decision 0045) an agent read the repository's visibility from GitHub: **public**. `HARDENING.md §2` had said *"the repo is private on a personal account"* and built its trade-secret argument on that; `SECURITY.md` says the function source is *not published* — true of the website, not of GitHub. Every document in the repository — the money model, the marketing strategy, the handoff, every session record, every decision — is readable by anyone. The founder was asked whether that should stay so.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: stay public** | Nothing changes | The documents are readable; "trade secret" is not an available claim for anything in the repo | None | Somebody copies the app — `fingerprint-check.sh` and the trademark (HARDENING §3) are the answer, not secrecy |
| B — make it private | One click in Settings → General | GitHub Pro (about $4 a month) to keep branch rulesets on a private repository; Netlify's GitHub app keeps working | A paid plan to keep alive | A false sense that the documents are secret — the same trap SECURITY.md warns about for minified front-end code |
| C — split: private docs, public code | Two repositories | The single-repo workflow every tool and hook assumes | A second repo, a second set of hooks | Drift between the two |

## What was chosen, and why

**A.** The founder's words on 2026-09-12: *"keep it public."* The reasoning already in `SECURITY.md` applies to the repository as it does to the front end: the code cannot be hidden and the invariants make that fine. No secret value has ever been allowed in the repository (INVARIANT 11) and only `public/` is served (INVARIANT 10), so going public changed nothing about what an attacker can do. What it changes is the writing rule, which was already the rule: **nothing goes into this repository that the founder would not publish.**

## What this makes harder

The legal "measures keeping it secret" line in `HARDENING.md §2` no longer applies to anything in the repository; protection against a copycat rests on the trademark, the terms, and provenance (`FINGERPRINTS.md`). Session records must keep to the existing rule of never naming the founder or a private individual in a project file, and never quoting a customer.

## What would reverse it

A partner, investor or venue chain asking for it; a document that genuinely must not be public and cannot live outside the repo (today such documents live in `~/Docs/Project Handoffs/`, which is not the repository).

## How it was verified

`gh api repos/perryidyll/myset -q .visibility` → `public` on 2026-09-12. `HARDENING.md §2` corrected the same day. Nothing else was run.

## Addendum 2026-10-10 — the founder asks for private: Pro first

The founder asked for the repository to go private *"if there's no need for it to be public"*, and whether a plan is needed. Read the same day:

- **The account is on GitHub Free.** `gh api repos/perryidyll/agent-config/rulesets` (the founder's one private repository this session can see) answers 403 *"Upgrade to GitHub Pro or make this repository public to enable this feature."* On Free, rulesets and branch protection are enforced on public repositories only.
- **So private first switches off the lock on `main`.** Ruleset 23031933 (`main is production`: pull request only, `suite` required, no force-push, no deletion — 0045, 0197) would stop being enforced the moment the repository turned private, and the next stray push would deploy unreviewed and untested. That is the *need* to stay public, for now.
- **Pro keeps it.** About $4 a month (third-party 2026 price lists; GitHub's own pricing page no longer shows Pro, only Free, Team at $4 a user a month, and Enterprise). Pro also raises Actions to 3,000 minutes a month on private repositories; Free private gets 2,000. Measured use: 628 billable minutes in the 12.4 days to 2026-10-10 (`tests` 163 runs, `watch` 42, Dependabot 4, each run rounded up to a minute), about 1,500 a month.
- **Also lost by going private:** GitHub's free secret scanning (public repositories only); the `curl … raw.githubusercontent.com …` one-liner in `tools/serversecret.mjs`'s header (run it from a checkout instead). Netlify's GitHub app keeps building a private repository; nothing on myset.vip reads from GitHub.
- **No free route keeps the lock.** A home-made gate in Netlify's build (refuse to build a commit that did not come through a merged pull request with `suite` green) would need a GitHub token in Netlify, would not stop a force-push, and would be weaker than the ruleset — more risk than $4 a month saves.

**Still A until Pro is on; then B, in this order:** (1) GitHub → Settings → Billing → Pro; (2) the repository → Settings → General → Change visibility → Private; (3) an agent reads back `gh api repos/perryidyll/myset/rulesets` (the ruleset, not *Upgrade…*) and `.visibility` (`private`). Ledger PER-022. When it happens, this record is superseded by one that says *the repository is private*, with that read-back as its verification.
