---
id: 0197
title: The test suite is a required check — a red `suite` cannot be merged to main
date: 2026-10-09
status: decided
decided_by: perry-confirmed
area: engineering-os
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: [AGENTS.md, .github/workflows/tests.yml]
---

## The question

Since decision 0144 (2 October 2026) every pull request runs the whole suite on GitHub as the `suite` check, and the record said it stays advisory: a red result was a warning, not a wall. The founder's desk card asked whether to make it required, with "yes" recommended; he answered on 2026-10-09 ("do all of this").

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `suite` is a required status check on the `main` ruleset (23031933): GitHub refuses the merge until it is green on the head being merged | About two minutes a merge, which every merge today already waits | One rule in the ruleset | A GitHub Actions outage blocks every merge, hotfixes included — see the valve below |
| B — leave it advisory (0144) | A red check can still be merged | Nothing | None | A broken change reaches myset.vip by a click |
| C — required and strict | As A, plus the branch must be up to date with `main` | A re-run after every other merge | None | Fifteen stacked merges in a day each wait a suite run after the one before |

## What was chosen, and why

A, not strict.

- **The check must exist and be green on the exact head.** `strict_required_status_checks_policy: false`: the branch need not contain the newest `main`, because every merge today is restacked and the generated files are the only difference; a required *and* strict rule would add a two-minute wait after every merge of a stacked chain without proving more (the restack is what proves the patch is the same).
- **Docs-only merges still pass.** `[skip ci]` goes only in the squash's subject (0144); the pull request's own commits never carry it, so the `suite` check still runs on the PR and goes green before the merge. A commit message on the branch that says `[skip ci]` would skip the check and make the PR unmergeable — which is the right outcome, since nothing proved it.
- **The valve.** The `main is production` ruleset has no bypass actors (0144) and keeps none. If GitHub Actions is down during a show that needs a hotfix, the founder removes the required check from the ruleset for that merge (Settings → Rules → main is production), as he would remove any rule — never a session on its own.
- **Integration id.** The check is bound to GitHub Actions (integration 15368), so a status named `suite` posted by anything else does not satisfy it.

## What this makes harder

- A merge waits for the check even when the person has already run the suite locally; today's ~2 minutes on GitHub is the cost.
- The one-rule valve above is the only way past a GitHub Actions outage.

## What would reverse it

- The suite growing past the point where a PR check is a reasonable wait (0145 made it run a crowded room; it is ~2 minutes today); then a split into a fast required set and a slow advisory set.

## How it was verified

- The ruleset read back from the API after the change lists `required_status_checks` with `suite` / 15368 and `strict_required_status_checks_policy: false`; `gh pr view` on an open PR with a green `suite` shows `mergeStateStatus: CLEAN`.
- **Not checked:** a merge attempted with a red check (nothing red was open to try it on).
