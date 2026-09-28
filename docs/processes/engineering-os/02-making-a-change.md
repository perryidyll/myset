---
tab: Engineering OS
section: Making a change
puzzle_section_id: 41988
sources:
  - AGENTS.md (The rules that rank every trade-off; Where you may work; Safety)
  - MYSET-MASTER-OVERVIEW.md Part 0 (the eight rules), §7.2 (what is owed a record)
  - INVARIANTS.md (the guard-rails; count in §2.1)
  - ~/.claude/skills/shipping-discipline (the four failure shapes; While working)
  - package.json (two dependencies)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — step counts and connections match)
verified: sources read 2026-09-12
---

# Making a change

**Who:** the coding agent, with the founder as approver on anything that touches the server. **Trigger:** a work item from the ledger or a request. **Outcome:** a change in the working tree that a reviewer can trust — ranked by the one rule, inside the area it was allowed in, with evidence for every claim, and a decision record planned where one is owed.

**The ranking function:** *nothing may break the gig.* Every failure must degrade to "the room can still vote". When two good things conflict, this one wins.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| c01 | Rank it: can this break the gig? | conditional | AI Agent | Coding agent R | — | The eight rules, in force before any design question: `main` is production · nothing may break the gig · the audience never signs in · never a button that leads to a shrug · never claim what you have not run · numbers from the code · another session may be here · money, sign-in and storage are not places to be clever. Most were learned by breaking something. `src: overview Part 0 § The eight rules; AGENTS.md § The rules that rank every trade-off` |
| c02 | Which area is it? | conditional | AI Agent | Coding agent R | Github | Pages `public/*.html` — hand-written, self-contained, no build step, what you see is what ships. `public/app.css` — careful, **neither Studio loads it**. `public/lock.css` — both Studios, nothing else. `public/sw.js` — **do not touch** (a mistake serves stale pages to everyone). `netlify/functions/**` — money, sign-in, sessions, roles, payouts, Stripe → c03. `netlify.toml`, `package.json` — only with a stated reason. `src: AGENTS.md § Where you may work` |
| c03 | Server change: invariants first, then plan the record | task | AI Agent | Coding agent R · Founder A | Github | Rule 8. Read the relevant section of `INVARIANTS.md` — every property there survived a change once by being broken — and decide now whether a decision record is owed: anything that changes what a person can do, is charged or is told; adds a moving part; closes off a future option; any number somebody could argue with; any reversal. Refactors, copy fixes and tests for existing rules owe nothing. → *Keeping the documents true* k02. `src: overview §7.2; INVARIANTS.md` |
| c04 | Do the page and the server agree? | conditional | AI Agent | Coding agent R | Github | Never show the room a button that leads to a shrug: if the server will refuse it, the page must not offer it, and if the page offers it, the server must allow it. The one known exception is Spotify import answering an honest 503 (overview Part 8). `src: AGENTS.md rule 3` |
| c05 | No dependencies, no tidy-up | conditional | AI Agent | Coding agent R | Github | Exactly two npm dependencies and it stays that way; no CDN scripts, fonts or analytics. Do not reformat, rename or tidy: **if the diff is bigger than the change you described, something went wrong.** `src: AGENTS.md § Where you may work; package.json` |
| c06 | Measure, don't infer | task | AI Agent | Coding agent R | Claude Code | "The code looks right" is not evidence. Read the actual headers, poison the actual key, quote the actual output. The four failure shapes each cost a real incident: a fix that creates a new bug (test the thing you changed **and the thing next to it**); a comment asserting a guarantee nobody implemented (name where the guarantee lives); a half-finished refactor (grep every instance of the old pattern); a manual step that silently goes stale (automate it or assert it). `src: shipping-discipline § The four failure shapes, § While working` |
| c07 | Need a number? | conditional | AI Agent | Coding agent R | Github | If it is not in overview §2.1, add it to `tools/overview.mjs` and let the generator write it. Never type into a document a number that could be read out of the source. `src: AGENTS.md § Documentation authority; overview §7.1` |
| c08 | The safety list | conditional | AI Agent | Coding agent R | Netlify | Never commit a secret or print one into a chat window — all secrets live in Netlify's environment, and one marked secret returns a **placeholder** through the API (correct; it has already caused one false diagnosis). Only `public/` is published. **Never invent gig data** — a listed gig sends a real person to a real bar. A deploy preview shares production data: look, never write. The story about "two nights that shaped the product" is false; the first gig had no failures. `src: AGENTS.md § Safety; overview §6.3` |
| c09 | A fresh-context review before "done" | task | AI Agent | Reviewing agent R · Coding agent I | Claude Code | An independent pass by an agent that did not write the change, before anyone says done — both Phase 3 items were reviewed this way and their findings fixed before deploy. `/code-review ultra` is the founder's to launch (billed). `src: shipping-discipline § Before saying done; IMPLEMENTATION_STATUS.md § Current focus` |

## Connections

c01 → c02; c02 —server→ c03 → c04; c02 —pages, styles, config→ c04; c04 → c05 → c06 → c07 → c08 → c09 → *Testing and looking*; c02 —`sw.js`→ *stop*.
