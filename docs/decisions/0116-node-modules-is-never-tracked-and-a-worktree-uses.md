---
id: 0116
title: node_modules is never tracked, and a worktree uses the shared checkout's
date: 2026-09-28
status: decided
decided_by: claude
area: ops
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: [.gitignore, AGENTS.md, MYSET-MASTER-OVERVIEW.md, docs/processes/engineering-os/03-testing-and-looking.md]
---

## The question

From 2026-09-15 (`abe9821`) `main` tracked `node_modules` as a link (mode 120000) to `~/Docs/MySet/node_modules`, the shared checkout's own install. `7a62844` had committed the same link on 2026-09-12, and `f04f38a` removed it on 2026-09-14. Neither commit meant to. A worktree held the link, and `.gitignore`'s `node_modules/` matches only a folder, so a `git add -A` swept the link in. From then on every worktree got the link from git when it was checked out.

In the shared checkout, where `node_modules` is the real folder, the same entry was a trap. A `git reset --hard`, `git checkout -- .` or `git restore .` there deletes the folder and writes a link that points at itself. That happened after `7a62844`: the push log's 2026-09-14 and 2026-09-15 entries say fresh worktrees could not load `stripe` or `@netlify/blobs` until a new install on 2026-09-15. The trap also blocked the founder's planned reset of that checkout, which is 118 commits behind `main`. The founder asked for the link to come out of git.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Untrack the link. `.gitignore` says `node_modules`, with no slash, so a link is ignored too. Nothing else: Node looks for a package in every parent folder, so a worktree under `~/Docs/MySet/.claude/worktrees/` finds the shared checkout's `node_modules` on its own | Two lines | None | A checkout outside `~/Docs/MySet` (a cloud session, a scratch folder) finds nothing and runs `npm ci` once |
| B | A, plus a setup step in AGENTS.md: `ln -s ~/Docs/MySet/node_modules node_modules` in each new worktree | A step every session must remember | A link in every worktree | None beyond A's, but the step does by hand what Node already does |
| C | A, plus `test/run.sh` making that link when a worktree has none | Five lines of shell | A side effect in the test runner | The same as B, hidden in a script |
| D | A `.worktreeinclude` naming `node_modules`, so the Claude app copies the folder into each new worktree | A full copy per worktree | A vendor-specific file | The copies drift from the shared install, and other agents ignore the file |
| E — do nothing | Keep the link tracked | — | — | The next reset of the shared checkout deletes every worktree's packages again, and the next link a `git add -A` sweeps in goes unnoticed |

## What was chosen, and why

A. The founder asked for three things: the link out of git, the simplest way to keep worktrees working, and no new dependency. The Claude app makes every worktree under `~/Docs/MySet/.claude/worktrees/`. From there, Node's package lookup walks up to `~/Docs/MySet/node_modules`, so the link was never needed. The suite passes in a new worktree with no link at all (below). A setup step (B, C) would do by hand what Node already does, and a copy (D) would drift.

## What this makes harder

- **Everything leans on one folder,** as every link did before. If `~/Docs/MySet/node_modules` goes, every worktree loses its packages at once; a `git clean -x` there would do it. `npm ci` in `~/Docs/MySet` puts it back.
- **A checkout anywhere else needs `npm ci`.** A cloud session or a scratch-folder worktree does not sit under `~/Docs/MySet`. Without an install, the suite stops at `test/copy.mjs`, the first file that loads a function outside the module hook, with `Cannot find package '@netlify/blobs'`.
- **Every open branch loses its link** on its next rebase onto `main`, or merge of it. Inside `.claude/worktrees/` nothing breaks, because the lookup finds the same folder.
- **The shared install must follow `package-lock.json`.** Worktrees test against whatever `npm ci` last put in `~/Docs/MySet/node_modules`. Today that matches `main`'s lockfile: `@netlify/blobs` 10.7.13 and `stripe` 17.7.0. When a dependency change lands on `main`, worktrees keep testing the old version until someone runs `npm ci` there. That needs the shared checkout reset first, because its own `package-lock.json` is `cb22f3f`'s. The links had the same blind spot.

## What would reverse it

The Claude app making worktrees outside `~/Docs/MySet`, where no parent folder holds the packages; then B or C is the simplest. Or dependency changes arriving often enough that one shared install keeps drifting from `package-lock.json`; then each worktree runs `npm ci` for itself.

## How it was verified

- **Where the links came from.** Each worktree's link was made in the same second as the worktree, and each worktree's commit tracks it. There is no `.worktreeinclude`, no `WorktreeCreate` hook and no `.claude/settings.json` in the repo. So git made the links.
- **The lookup.** From a path inside `.claude/worktrees/`, Node resolves `@netlify/blobs` and `stripe` to `~/Docs/MySet/node_modules`. From a scratch folder outside it, `MODULE_NOT_FOUND`.
- **The suite.** In a new worktree made from the branch's commit, which never had a link, `sh test/run.sh` exited 0 with 0 ✗ and `main`'s own count on each base the branch sat on. That was 4,825 ✓ on `0075a30` and `afeffa0`, and 4,849 ✓ on `539c2a4` after #136. On `main` before the change, in a worktree outside `~/Docs/MySet` with no link, it stopped at `test/copy.mjs` with `ERR_MODULE_NOT_FOUND`.
- **The reset, in a scratch repo.** The link pointed at its own path, and a real folder sat where it points.
  - With the link still tracked, `git reset --hard` replaced the folder with the link (today's trap).
  - Once the link was untracked, `git reset --hard` from the old index printed `warning: unable to unlink 'node_modules': Operation not permitted` and kept the folder and its files.
  - A fast-forward merge refused to run.
  - `git clean -fd` without `-x` left the folder.
  - `git restore .` against the old index still wrote the link. So in the shared checkout the reset must come first, never a restore.
- **Not checked here:** Netlify's own install, on a clone with no link. The deploy preview on this change's pull request is that check.
