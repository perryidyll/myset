---
tab: Engineering OS
section: Committing and deploying
puzzle_section_id: 41990
sources:
  - AGENTS.md (You never commit and you never push unless the user asks; Deploying — the PR flow since 2026-09-12; Before every push — the push log)
  - docs/decisions/0045 (main is protected); GitHub ruleset 23031933; docs/PUSH-LOG.md, tools/pushlog.sh
  - tools/hooks/pre-commit, tools/hooks/post-commit, tools/hooks/install.sh
  - netlify.toml (publish = public; functions; redirects)
  - MYSET-MASTER-OVERVIEW.md §6.1 (Deploying), §7.1 (the hook never blocks)
  - INVARIANTS.md 9d3 (never also `netlify deploy --prod`); IMPLEMENTATION_STATUS.md PER-002
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — step counts and connections match)
verified: sources read 2026-09-12
---

# Committing and deploying

**Who:** the coding agent, only when the founder asks; the git hooks; Netlify. **Trigger:** "commit" or "push" from the founder. **Outcome:** a commit whose overview numbers are already true and whose missing decision record is already listed; a push that **is** the deploy; and a verification from outside, by content.

**You never commit and you never push unless the founder asks.** Produce changes in the working tree and stop. If asked to push, run the tests first.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| d01 | Were you asked to commit? | conditional | AI Agent | Coding agent R · Founder A | Github | No → stop here; the tree holds the work. Yes → `git status` once more (someone else's files must not ride along), then commit with the attribution line the session was given. On the default branch, that is `main` — production. `src: AGENTS.md § Read this before your first edit` |
| d02 | Pre-commit: refresh the overview, warn about the missing record | task | Automation | Git hooks R · Coding agent I | Github | `tools/hooks/pre-commit`: runs `node tools/overview.mjs`, stages `MYSET-MASTER-OVERVIEW.md` and `docs/decisions/README.md` if they changed; if the commit touches `netlify/functions/` and carries no `docs/decisions/NNNN-` file, prints the yellow *"this commit changes the server and carries no decision record"* line. **It never blocks** — `main` is production and the repo gets edited between sets; a hook that refuses a commit at 11pm is one somebody disables with `--no-verify` and never re-enables. `src: tools/hooks/pre-commit; overview §7.1` |
| d03 | Post-commit: nothing gets lost | task | Automation | Git hooks R | Github | `tools/hooks/post-commit`: a commit that changed the server without a record is appended to `docs/decisions/PENDING.md` (hash, date, subject, files) — the first moment the hash exists. Leaves the file modified for the next commit to carry; never amends, never blocks, never fails. A row is a backlog, not an accusation. `src: tools/hooks/post-commit` |
| d04 | Were you asked to push? Tests first | conditional | AI Agent | Coding agent R · Founder A | Github | `sh test/run.sh` first, always. Then, since 2026-09-12 (decision 0045), the push is a **branch**, never `main`: `git switch -c <area>/<what-changed>`, `./tools/pushlog.sh "what changed" "note"` (the push log entry rides on the branch; the pre-push hook refuses a push without one), `git push -u origin HEAD`. A push to `main` is refused by GitHub's ruleset. `src: AGENTS.md § Deploying, § Before every push; decision 0045` |
| d05 | Open the PR, look at the preview, merge = deploy | task | AI Agent | Coding agent R · Founder A | Github | `gh pr create --fill` → Netlify posts a deploy preview on the PR (`netlify/mysetvip/deploy-preview`): the real-browser-at-phone-width check on the exact bytes that will ship; it cannot charge a card but it reads and writes production data. Zero approvals are required — the person shipping merges their own: `gh pr merge --squash --delete-branch`. Squash and merge only; a squash of one commit keeps its message, which is how doc-only work keeps `[skip ci]`. **Merging is the deploy** — `main` is production and reaches myset.vip in about a minute. `netlify.toml`: `publish = "public"` (only `public/` is served — publishing the root once exposed docs and backups), functions from `netlify/functions` bundled by esbuild, `/api/*` → functions, pretty URLs above the `/:slug` catch-all. **Never also run `netlify deploy --prod`**: it bills a second deploy for the same change and races over what is live (INVARIANT 9d3; PER-002 — the double deploy was hundreds of credits a month). `src: netlify.toml; overview §6.1; INVARIANTS.md 9d3` |
| d06 | Verify from outside, by content | task | AI Agent | Coding agent R | Netlify | The catch-all slug redirect answers 200 for files that do not exist, so a status code has already reported a deploy as landed mid-build. Fetch the page and grep for the thing you changed; for an API change, call it and quote the body. `src: AGENTS.md § Deploying; overview §6.1` |
| d07 | Write it down | go_to | AI Agent | Coding agent R | Github | The commit SHA goes into the ledger's evidence column and the session file; the decision record, if owed, is written now rather than later. → *Keeping the documents true*. `src: AGENTS.md § Before ending a session` |

## Connections

d01 —no→ *stop, leave the tree*; d01 —yes→ d02 → d03 → d04; d04 —not asked→ *stop*; d04 —asked→ d05 —merged→ d06 → d07.
