---
tab: Engineering OS
section: Keeping the documents true
puzzle_section_id: 41991
sources:
  - MYSET-MASTER-OVERVIEW.md Part 0 (When this document and the code disagree), Part 7 (7.1 numbers, 7.2 decisions, 7.3 what it does not do)
  - tools/overview.mjs (--check, --json, --tests), tools/decide.sh, docs/decisions/TEMPLATE.md, docs/decisions/PENDING.md
  - AGENTS.md § Documentation authority, § Before ending a session
  - docs/processes/CONVENTIONS.md § Keeping it true (the founder's standing rule, 2026-09-12)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — step counts and connections match)
verified: sources read 2026-09-12
---

# Keeping the documents true

**Who:** the coding agent; the hooks for the numbers; the founder for the reasoning only they know. **Trigger:** any change that alters what is true. **Outcome:** two halves that fail differently, solved differently — the **numbers** regenerate themselves, and every **decision** gets a record with its reversal condition — plus the ledger, the session file and the Puzzle map, all in the same session.

**When a document and the code disagree, the code is right and the document is stale.** Fix the document; if the disagreement was in a generated number, fix the generator — a number that drifted once will drift again.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| k01 | Regenerate the numbers | task | AI Agent | Coding agent R | Claude Code | `node tools/overview.mjs` rewrites §2.1 of the overview and the decision index from the code; `--check` exits 1 if either is stale; `--json` gives every generated fact as data. The plan table is not a copy of `PLANS` — it *is* `PLANS`, rendered. Runs on every commit through the pre-commit hook. `src: overview §7.1; tools/overview.mjs` |
| k02 | Start a decision record | task | AI Agent | Coding agent R · Founder A | Github | `./tools/decide.sh "what is now true" [area] [status] [decided_by]` — picks the next four-digit id, fills the template, prints the path; commits nothing. Title = what is now **true**, not what was done. `src: tools/decide.sh` |
| k03 | Answer the six things | document | AI Agent | Coding agent R · Founder C | Github | The question and what forced it; **every** option in a table with cost, new moving parts and risk — *Do nothing* in the table every time; what was chosen and why (*"the founder said so"* is legitimate and tells a future reader not to argue); what this makes harder; **what would reverse it** (a decision with no reversal condition is one nobody can safely revisit); how it was verified — what was run and what it printed. `src: docs/decisions/TEMPLATE.md; overview §7.2` |
| k04 | Reversing? Supersede, never delete | task | AI Agent | Coding agent R | Github | A new record with `reverses:` the old id; the old one gets `superseded_by:` and status `superseded`. The index `docs/decisions/README.md` is generated from the front-matter — **edit the records, never the index.** `src: overview §7.2; TEMPLATE.md front-matter` |
| k05 | Clear `PENDING.md` | task | AI Agent | Coding agent R | Github | Rows the post-commit hook wrote: write the record for any that owe one and remove the row; a refactor, copy fix or test owes nothing and is simply removed. `src: tools/hooks/post-commit; overview §7.2` |
| k06 | Update the ledger, with evidence | document | AI Agent | Coding agent R | Github | `IMPLEMENTATION_STATUS.md` (the `status-ledger` skill): refresh the header, set statuses with paths, commands and SHAs, add decisions, record deviations, note new risks, add a verification-log row for anything run. Not after read-only questions or a review that found nothing. `src: AGENTS.md § Before ending a session; ~/.claude/rules/offer-the-right-skill.md` |
| k07 | Write the session file | document | AI Agent | Coding agent R | Github | `docs/sessions/YYYY-MM-DD-<slug>.md`: what was asked, what shipped, what broke, what was verified — and what was not. The running narrative a decision record does not carry. `src: AGENTS.md § Before ending a session` |
| k08 | Update the Puzzle map in tandem | task | AI Agent | Coding agent R · Founder A | Puzzle | **The founder's standing rule (2026-09-12):** anything that changes a process, a rule, a cited number, a decision or a surface updates its sheet under `docs/processes/<tab>/` **and** its Puzzle section (`update_workflow` / `create_process`) in the same session, and every new decision record gets a changelog entry the same day. *"Does Puzzle need updating?"* is a handoff question beside the ledger and the overview. Agents cannot sign in to the canvas; the browser check is the founder's. `src: docs/processes/CONVENTIONS.md § Keeping it true` |
| k09 | Prose is a human job | task | Person | Founder R · Coding agent R | Github | The generator checks numbers, not claims: the 2026-09-06 landing-page audit found 69 upheld contradictions between the sales page and the app and no generator would have caught one. When you read a sentence that is no longer true, fix it then — and never write a number into prose that the code could have supplied. `src: overview §7.3` |
| k10 | Keep what the repo cannot hold | task | AI Agent | Coding agent R | Claude Code | The agent's own memory directory: the founder's feedback and standing rules (with the *why*), project context not derivable from the code, pointers to outside resources. Never what the repo already records. The founder's name never goes into a project file. `src: the session's memory rules; ~/.claude/rules/address-as-perry.md` |

## Connections

k01; k02 → k03 → k04; k05 → k02; k06 → k07 → k08; k09 is the standing note; k10 at the end. *Committing and deploying* d07 → k06.
