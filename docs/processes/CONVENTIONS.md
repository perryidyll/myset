# Process sheets and the Puzzle projection — conventions

Read `PUZZLE-MAPPING-PLAN.md` first. This file is the rulebook for every sheet in this folder and for everything loaded into the Puzzle workspace (`puzzleapp.io`, workspace 13099). It follows Puzzle's own published guidance (help.puzzleapp.io — *Steps*, *Sections*, *Tabs*, *Changelog*, *Entities & Attributes*, *MCP prompt library*) where MySet has no stronger rule of its own.

## The source-of-truth rule

The repository is the truth. Puzzle is a projection. A sheet in this folder is the canonical text of a process; Puzzle holds a copy loaded from it. When they disagree, the sheet is right, and the fix is a reload.

**Nothing in Puzzle carries a number that `tools/overview.mjs` generates.** A step says *"the free-vote allowance (overview §2.1)"*, never *"3 votes"*. Prices, caps, counts, fees, timeouts and room sizes are cited, not copied.

## One sheet per Puzzle section

`docs/processes/<tab>/<section>.md`, front matter first:

```
---
tab: The gig
section: The fan's night
puzzle_section_id: 41600        # blank until loaded
sources:
  - MYSET-MASTER-OVERVIEW.md §1.5, §3.2
  - INVARIANTS.md § Show behaviour
  - docs/decisions/0001, 0002, 0014
status: draft | loaded | verified
loaded: 2026-09-12
verified: 2026-09-12 (read back through list_steps; browser check of the tab)
---
```

Then the steps, in a table the loader can be read from directly:

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |

Then the connections (`from → to`, with a label on every branch out of a conditional).

## Steps

Puzzle's guidance, adopted as written:

- **Name = verb + noun, two to four words.** "Scan the code", "Cast a vote", "Refuse the cast". No sentence-long names; the sentence goes in the notes.
- **Every step has a type.** `conditional` wherever the path forks; `payment` where money moves; `notification` where a person is told something; `database` where a document is written; `delay` for a wait; `go_to` for a jump to another section; `alias` when the same action already exists elsewhere (never duplicate a step).
- **Every step has an executor.** `Person` (fan, artist, venue, founder), `Automation` (a Netlify function, a scheduled job, a Stripe webhook, a git hook), `AI Agent` (a Claude Code session).
- **Every step has a role** with RACI involvement, and a tool where one applies.
- **Every step has notes**, and the notes are where the "microscopic detail" lives — what happens, the exact words the person sees where they matter, every failure branch and what it degrades to, and the rule that guards it. Notes end with a source line:

  `src: MYSET-MASTER-OVERVIEW.md §1.5 · INVARIANT 15h · decision 0034`

- **Status means what it says.** `Live` = built and running on myset.vip, confirmed in the code or the ledger's evidence column. `Draft` = intended, not built (P4-001 onboarding, the payments health check, a restore drill). `Testing` = in the working tree, not pushed. `Archived` = superseded, kept because a decision record refers to it. Never mark `Live` from a document alone — open the function or page.

## Sections and tabs

- A section is **one journey with one trigger and one outcome**, roughly 8–20 steps. Longer journeys split at a natural hand-off and connect with a `go_to`.
- Section **description** = one sentence: who, trigger, outcome. Section **notes** = the sources, and anything true of the whole journey (e.g. *"every failure on this path degrades to: the room can still vote"*).
- Tabs are the ten domains in the plan. **The same tab names are used on every canvas** (Puzzle's cross-canvas rule).
- Connection labels on every conditional branch, in the words the code uses (`allowed` / `refused`, `charges enabled` / `incomplete`).

## Roles

Four teams: **Founder**, **Agents**, **Automations**, **The room (external)**. External actors — Fan, Artist, Artist team member, Venue manager — are real roles so RACI on a step is honest; their notes say *external* so nobody assigns them work.

## Changelog = decision records

One Puzzle changelog entry per `docs/decisions/NNNN-*.md`, title identical to the record's, body = the options weighed, what each would have cost, what would reverse it, status `completed` with the record's date, owner = the founder, linked to every step it governs. A superseded decision stays; its body opens with **Superseded by NNNN**. (The MCP rejects `archived` on changelog entries as of 2026-09-12, so superseded entries stay `completed` and the header carries the fact.) New records get an entry the day `tools/decide.sh` runs.

## Entities = storage families

One entity per key family in overview §5.2 (`show_`, fan shard `f0…f11_`, `meta_`, …), attached to the Netlify tool (Blobs) — or to Stripe / Cloudflare R2 where the data lives there. Attributes are the fields the owning function reads and writes, with the field's purpose in the description. Entities are linked to the steps that read or write them.

## Loading and verifying

1. Write or update the sheet.
2. `create_process` (or `update_workflow`) from the sheet; note the ids in the front matter.
3. `list_steps` with `notes` and `connections`; compare with the sheet.
4. Once per tab, look at the canvas in a browser — a section that reads right through the API can still lay out badly. **The founder does this**: an agent cannot sign in to Puzzle (credentials are never typed by an agent).
5. Only then set `status: verified` in the sheet and `Live` in Puzzle.

## Keeping it true

- A session that changes a process changes its sheet and reloads the section (this is on the session-end checklist in `AGENTS.md` once Phase 10 lands).
- A new decision record gets a changelog entry the same day.
- Quarterly: read every section back and diff against its sheet.
