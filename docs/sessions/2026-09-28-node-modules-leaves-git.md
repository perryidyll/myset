# 2026-09-28 — node_modules leaves git

**Asked (the founder, through a task written while #133 merged):** stop tracking the `node_modules` link on `main`. First find out how worktrees get their link, and pick the simplest way to keep them working without a new dependency. Change `.gitignore` so a link is ignored too, and run the suite in a fresh worktree. Open a pull request with a stated reason, because merging deploys, and ask before merging. Tell the sessions with open branches. Do not reset the shared checkout.

**How:** in a worktree cut from origin/main `0075a30`, rebased onto `f1e1dbe` (#136, #138, #139, #142) before the push. Only the ledger's header and the overview's generated count overlapped: the header kept both lines, and the generator rewrote the count.

## What was found

- **Git made every link.** Each worktree's `node_modules` link was born in the same second as its worktree, and each worktree's commit tracks it (mode 120000). There is no `.worktreeinclude`, no `WorktreeCreate` hook and no repo `.claude/settings.json`. The one exception is compassionate-chatterjee, cut on 2026-09-11 before the link was ever tracked. It has a real folder of its own.
- **The history.** `7a62844` (2026-09-12) committed the link by accident, `f04f38a` (2026-09-14) removed it, and `abe9821` (2026-09-15) committed it again. Each time, a worktree held a link, and `.gitignore`'s `node_modules/` matches only a folder. The push log's entries from those days say the shared checkout's folder had become a link to itself. Fresh worktrees could not load `stripe` or `@netlify/blobs` until a new install on 2026-09-15. The folder in `~/Docs/MySet` today was born 2026-09-15 11:34, which matches. The 2026-09-15 risk row in the ledger already asked for the link to come out.
- **No worktree needs the link.** The Claude app makes worktrees under `~/Docs/MySet/.claude/worktrees/`. From there, Node's package lookup walks up the parent folders to `~/Docs/MySet/node_modules`. The test suite's module hook swaps both packages for fakes, but only for the files run through it. `test/copy.mjs` runs without it and is the first to need the real packages; `test/twosecrets.mjs` needs the real `stripe`.

## What changed

- `git rm --cached node_modules`. The link is no longer tracked.
- `.gitignore`: `node_modules` without the slash, with a comment saying why.
- AGENTS.md § Build and test, overview §6.4 and engineering-os/03 t01 each gained one line: there is no install step in a worktree, and a checkout anywhere else runs `npm ci` once.
- Decision 0116, with the options that lost: a setup step in AGENTS.md, `test/run.sh` making the link, and a `.worktreeinclude` copy.
- The ledger's 2026-09-15 shared-checkout risk row now says what 0116 closes and what it does not.

## Verified

- `sh test/run.sh` in this branch's worktree, with its link removed, on `0075a30`: exit 0, 4,825 ✓, 0 ✗.
- The same run in a new worktree made from the branch's commit, which never had a link, on each base the branch sat on: exit 0, 0 ✗, `main`'s own count every time. That was 4,825 ✓ on `0075a30` and `afeffa0`, and 4,849 ✓ on `539c2a4` after #136. #142, which came after, is docs only. No `node_modules` appeared in the worktree.
- On `main` before the change, in a worktree outside `~/Docs/MySet` with its link removed, the suite stopped at `test/copy.mjs` with `ERR_MODULE_NOT_FOUND` for `@netlify/blobs`. That is what a cloud session sees without `npm ci`.
- **A scratch repo.** The link pointed at its own path, and a real folder sat where it points.
  - With the link tracked, `git reset --hard` replaced the folder with the link.
  - Untracked, the reset from the old index printed `warning: unable to unlink 'node_modules': Operation not permitted` and kept the folder and its files.
  - `git merge --ff-only` refused to run.
  - `git clean -fd` without `-x` kept the folder.
  - `git restore .` against the old index still wrote the link.

- **Netlify's own install**, on a clone with no link: the deploy preview (deploy `6aba29c2`) built and bundled every function, and the founder's artist page, built by `artistpage.mjs` from the store, kept its `og:title`.

**Merged as `eb18ca1`** (PR #143) on the founder's word, 08:54 UTC. Netlify skipped the production build: the commit message said *not [skip ci]*, and Netlify reads the bracketed marker wherever it appears, negated or not. A build started by hand (`netlify api createSiteBuild`) made deploy `6aba2d19`, ready at 09:03 UTC; the artist page on myset.vip kept its `og:title`. #145 merged after it as `a0ab3dc` and also built with no link. A message for a change that must build never writes the marker, not even to deny it.

## For other sessions

- **Every branch loses its `node_modules` link** on its next rebase onto `main`, or merge of it. Inside `~/Docs/MySet/.claude/worktrees/` nothing breaks. If a checkout elsewhere says `Cannot find package '@netlify/blobs'`, run `npm ci` there. It is ignored now, so it can never be committed.
- **The shared install must follow `package-lock.json`.** Worktrees test against whatever `npm ci` last put in `~/Docs/MySet/node_modules`. Today that matches `main`: `@netlify/blobs` 10.7.13, `stripe` 17.7.0. If a dependency change merges, worktrees keep testing the old version until `npm ci` runs there, and that needs the reset below first. Dependabot, added by #136, opened two such pull requests today: #140 and #141, major bumps of both packages.
- **Resetting the shared checkout** is still the founder's call. After this merges, `git fetch` then `git reset --hard origin/main` keeps its `node_modules` folder, and git prints one warning that it cannot unlink it. Run nothing before the reset: a `git restore .` or `git checkout -- .` there still writes the link over the folder, because that checkout's index still holds it. A `git clean` still deletes the founder's never-committed files: `Marketing Foundations/`, two logo PNGs and the push-log kit. With `-x` it deletes `node_modules` too.
- **Puzzle:** step t01 (370041, section 41989) takes the sheet's new line, and decision 0116 gets its changelog entry linked to t01, with the merge commit `eb18ca1` (as 0114 and 0115 were done).
