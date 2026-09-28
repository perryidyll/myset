---
tab: Engineering OS
section: Starting a session
puzzle_section_id: 41987
sources:
  - AGENTS.md (Read this before your first edit; Startup checklist; Session workflow § Default working mode)
  - MYSET-MASTER-OVERVIEW.md Part 0 (the eight rules; Read in this order)
  - tools/hooks/install.sh (--check)
  - ~/.claude/skills/shipping-discipline (pre-flight), ~/.claude/rules/offer-the-right-skill.md
  - tools/backup.py; docs/decisions/0046
  - IMPLEMENTATION_STATUS.md deviation 2026-09-11 (the worktree)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — step counts and connections match)
verified: sources read 2026-09-12
---

# Starting a session

**Who:** a coding agent (Claude Code, Codex, Cursor — anything that reads `AGENTS.md`), or a new hire. **Trigger:** a request from the founder, or a scheduled task. **Outcome:** the agent knows what is live, what is being worked on, whether anyone else is in the tree, and which rules rank every trade-off — before touching a file.

**`main` is production.** A push deploys to myset.vip in about a minute; there is no staging site and no review gate. Everything in this tab exists because a bad commit is a live outage during somebody's show.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| s01 | Confirm the folder and the branch | task | AI Agent | Coding agent R | Github | `~/Docs/MySet`, branch `main`. The shipping-discipline pre-flight: resolve the folder by content, never from memory (projects have moved and been renamed; a stale duplicate of a site once lived inside another); confirm version control so the starting state is recoverable. `src: ~/.claude/skills/shipping-discipline § Pre-flight` |
| s02 | `git status` — is anyone else here? | conditional | AI Agent | Coding agent R · Founder I | Github | Rule 7: another session may be editing this repo. Changes you did not make → **stop and say so**; never build on them. If the work must go on anyway, a worktree off `main` keeps the two apart (`.claude/worktrees/`; the R2 clip store was built in `claude/r2-clips` on 2026-09-11 while the main checkout held another session's files). `src: AGENTS.md § Read this before your first edit; overview Part 0 rule 7; IMPLEMENTATION_STATUS.md § Deviations 2026-09-11` |
| s03 | Read the ledger | document | AI Agent | Coding agent R | Github | `IMPLEMENTATION_STATUS.md` first: the header, current focus, **next work item (pick up here)**, blockers, deviations, open risks. Do not redo `done` rows unless their evidence is invalid. `src: AGENTS.md § Startup checklist, § At session start` |
| s04 | Read in this order | document | AI Agent | Coding agent R | Github | `AGENTS.md` → the ledger → overview Parts 1–2 (the rules of voting, free vs paid) → `INVARIANTS.md` (**the relevant section before any change to money, storage or access**) → `docs/decisions/` (before arguing with a design) → overview Parts 3–6 → `docs/sessions/` → `ACCOUNTS.md`, `ACCOUNTING.md`, `SECURITY.md`. Any number: §2.1 of the overview, generated from the code. `src: overview Part 0 § Read in this order; AGENTS.md § Documentation authority` |
| s05 | Are the hooks installed? | conditional | AI Agent | Coding agent R | Github | `./tools/hooks/install.sh --check` — `missing` or `outdated` → `./tools/hooks/install.sh`. Git hooks are not versioned; `tools/hooks/` is the source and `.git/hooks/` the installed copy. Without them the overview only updates when somebody runs it. `src: tools/hooks/install.sh` |
| s06 | Arriving fresh? Audit the repo | task | AI Agent | Coding agent R | Claude Code | The `project-audit` skill on an unfamiliar repository — say what it scored rather than guessing at maturity (96/100, *Full*, on 2026-09-12). `src: ~/.claude/rules/offer-the-right-skill.md; PUZZLE-MAPPING-PLAN.md §1` |
| s07 | Choose the working mode | conditional | AI Agent | Coding agent R · Founder A | Claude Code | **Efficient Mode** by default for an ordinary batch: sequential targeted inspection, surgical edits, focused checks, **one** full gate, **one** preview. A deep investigation only when the founder asks or the risk demands it. (*Efficient Mode* is defined nowhere but this one paragraph of `AGENTS.md` — a doc gap.) For a build longer than an afternoon or an ambiguous ask, **offer** `interview` or `reverse-brief` in one line, then do what was asked. `src: AGENTS.md § Default working mode; ~/.claude/rules/offer-the-right-skill.md` |
| s08 | Notice what is already running | task | AI Agent | Coding agent R | Claude Code | A preview server, a background task, an open session in another window. Renaming or deleting a directory a running process stands in breaks it — it has happened. `src: shipping-discipline § Pre-flight 4` |
| s09 | Copy the datastore if the last copy is stale | task | AI Agent | Coding agent R · Founder I | Netlify | `python3 tools/backup.py --if-stale` — a read-only copy of every key in the live store into `~/Docs/Project Handoffs/myset-backups/<stamp>/`, checksummed and verified on the spot (every JSON document parses; the registry agrees with the documents; `authsecret` present), only when the newest copy is over a week old. Touches nothing on the site. It is the only backup MySet has (decision 0046). → *Reliability & security → Backup and restore*. `src: tools/backup.py; AGENTS.md § At session start; decision 0046` |

## Connections

s01 → s02; s02 —clean, or only your own changes→ s03 → s09 → s04 → s05 → s07 → *Making a change*; s02 —someone else's changes→ *stop and say so* (or a worktree) → s03; s04 —first time here→ s06 → s07; s07 → s08.
