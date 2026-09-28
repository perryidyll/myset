# 2026-09-12 — Puzzle mapping, Phase 4: Engineering OS

**Asked:** after the Stripe endpoint and the two findings from Phase 3, "go ahead with Engineering OS" — the tab where a new agent or hire learns how this repo is worked (plan §5, Phase 4; bar: *an agent could follow the canvas alone and end a session correctly*).

## What shipped

Six sheets under `docs/processes/engineering-os/`, loaded as six sections on tab 39039, **51 steps**, every step with RACI (Coding agent, Reviewing agent, Founder, Git hooks) and a tool (GitHub, Claude Code, Netlify, Puzzle):

| Section | id | Steps | What it carries |
| --- | --- | --- | --- |
| Starting a session | 41987 | 8 | folder and branch, `git status` and the worktree escape, the ledger, the reading order, hooks `--check`, `project-audit` on arrival, Efficient Mode, what is already running |
| Making a change | 41988 | 9 | the eight rules as the ranking function, the area table (`sw.js` do not touch), invariants-then-record for the server, the shrug rule, two dependencies and no tidy-up, measure don't infer (the four failure shapes), numbers from the code, the safety list, a fresh-context review |
| Testing and looking | 41989 | 9 | `sh test/run.sh` and why the fake store exists, `netlify dev` cannot write, a double no kinder than production, `--tests`, the three browser tools, a real phone, a draft preview that only looks, `prod.py`, `loadsim.py` |
| Committing and deploying | 41990 | 7 | only when asked, the pre-commit and post-commit hooks and why they never block, tests-then-push, push = deploy (`netlify.toml`, never `--prod`), verify by content, write it down |
| Keeping the documents true | 41991 | 10 | `overview.mjs`, `decide.sh` and the six answers, supersede never delete, `PENDING.md`, the ledger with evidence, the session file, **the Puzzle map in tandem**, prose is a human job, the agent's memory |
| Ending a session | 41992 | 8 | did anything change → ledger → decisions → session file → *Does Puzzle need updating?* → handoffs and the SSD mirror → report honestly → stop with the tree as it is |

Cross-section arrows: working mode → rank it; review → run the suite; phone / draft → were you asked to commit; write it down → the ledger; each *Ending* step → its *Keeping true* step.

Three changelog entries: **1615** the Part 7 system (2026-09-08, backdated; no numbered record exists for it — the design lives in overview Part 7) linked to the two hooks, `overview.mjs`, `decide.sh`, the six answers and `PENDING.md`; **1616** the founder's tandem rule (2026-09-12) linked to k08 and e05; **1617** decision 0040 (the other session's, written today — the rule says same day).

## Found on the way

- **Efficient Mode** — `AGENTS.md § Default working mode` names it as "the repository's Efficient Mode workflow" and defines it nowhere but that paragraph. The sheet quotes the paragraph; a one-line definition somewhere findable is owed.
- The remaining unloaded decision records (0011, 0015, 0020, 0022, 0025, 0027, 0033, 0036) are media and UI, none Engineering OS; they wait for Phase 9.

## Verified / not

`list_sections` on tab 39039 with step counts and connections: 8/9/9/7/10/8, every labelled branch present; the three cross-section arrows created by id. Every claim in the sheets traced to `AGENTS.md`, overview Parts 0, 6, 7, `tools/hooks/*`, `tools/decide.sh`, `test/run.sh`, `netlify.toml`, `tools/prod.py`, `mirror-to-ssd.sh` and the `shipping-discipline` skill. **Not checked:** the canvas in a browser (agents cannot sign in).

## Tree

Another session's files were in the tree throughout (`_maps.mjs`, `artists.mjs`, five pages, `test/unit.mjs`, `tools/uicheck.mjs`, `INVARIANTS.md`) and were not touched. Nothing committed or pushed. Mine: `docs/processes/**`, `docs/sessions/2026-09-12-puzzle-mapping-*`, `IMPLEMENTATION_STATUS.md` (DOC/PER rows, risks, verification log), `ACCOUNTS.md` (§5 items 3 and 5, §6.4 procedure, §10 item 6), `VERIFYING-A-VENUE.md` (vouch count).
