---
tab: Engineering OS
section: Ending a session
puzzle_section_id: 41992
sources:
  - AGENTS.md § Before ending a session (the table), § Safety
  - ~/Docs/Project Handoffs/mirror-to-ssd.sh (two kinds of folder)
  - ~/.claude/skills/shipping-discipline § Post-flight
  - docs/processes/CONVENTIONS.md § Keeping it true
  - MYSET-MASTER-OVERVIEW.md Part 0 rule 5
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — step counts and connections match)
verified: sources read 2026-09-12
---

# Ending a session

**Who:** the coding agent. **Trigger:** the work is done, or the founder says stop. **Outcome:** the next agent can pick up from the ledger alone; nothing is committed that was not asked for; and the report says *verified* only for what was run.

This is the checklist the plan set as the bar for this tab: *an agent could follow the canvas alone and end a session correctly.*

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| e01 | Did anything change? | conditional | AI Agent | Coding agent R | — | Read-only questions, or a review that found nothing → skip the ledger and go to e07. Execution state, evidence, decisions, risks or the next action changed → e02. `src: AGENTS.md § Before ending a session` |
| e02 | The ledger | go_to | AI Agent | Coding agent R | Github | → *Keeping the documents true* k06. Header, statuses with evidence, decisions, deviations, risks, verification log. `src: AGENTS.md` |
| e03 | The decision records | go_to | AI Agent | Coding agent R · Founder A | Github | → k02–k05 for anything that could have gone another way; clear `PENDING.md`. `src: AGENTS.md` |
| e04 | The session file | go_to | AI Agent | Coding agent R | Github | → k07. One file per working session. `src: AGENTS.md` |
| e05 | Does Puzzle need updating? | conditional | AI Agent | Coding agent R · Founder A | Puzzle | The mandatory handoff question. Yes → k08: sheet and section in the same session, changelog entry for each new decision. `src: CONVENTIONS.md § Keeping it true` |
| e06 | The handoff documents and the SSD | task | AI Agent | Coding agent R | Claude Code | `~/Docs/Project Handoffs/HANDOFF-MySet.md` and `PORTFOLIO-MASTER-BRIEF.md`; then `~/Docs/Project Handoffs/mirror-to-ssd.sh` (`--dry-run` first): code and documents mirror with `--delete` because the Mac is the truth; asset folders only ever add, because the SSD may hold originals. Never mirrors `.git`, `node_modules`, `.netlify`. `src: AGENTS.md § Before ending a session; mirror-to-ssd.sh header` |
| e07 | Report honestly | task | AI Agent | Coding agent R · Founder I | Claude Code | Rule 5: *verified* only for what was executed and can be quoted; everything else *not checked*. What was left out and why — scaling the work down is the founder's call. Failures with their output. A tl;dr first. `src: overview Part 0 rule 5; AGENTS.md` |
| e08 | Stop, with the tree as it is | task | AI Agent | Coding agent R · Founder A | Github | Nothing committed, nothing pushed, unless asked — the tree holds the work and the ledger says where it is. If another session's files were in the tree at the start, say again which files are yours. `src: AGENTS.md § Read this before your first edit` |

## Connections

e01 —nothing changed→ e07; e01 —changed→ e02 → e03 → e04 → e05 → e06 → e07 → e08.
