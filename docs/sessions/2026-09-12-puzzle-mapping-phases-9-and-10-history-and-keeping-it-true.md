# 2026-09-12 — Puzzle mapping, Phases 9 and 10: the remaining history, and keeping it true

**Asked:** *"please wrap up with phase 9"* — the decision records without a changelog entry, and (because it is one line and the plan's last phase) the session-end rule in `AGENTS.md`.

## What shipped

**Changelog.** Eight entries, each linked to the steps it governs:

| Entry | Decision | Linked steps |
| --- | --- | --- |
| 1628 | 0015 one live profile CTA, no duplicate Settings controls | Open the voting page, Read the Live tab, Read the first-Settings notice |
| 1629 | 0025 static event map — body opens **Superseded by 0036** | Render the featured row, Restrict the Maps browser key |
| 1630 | 0027 light is the first-visit default | Open the voting page, Sign in to the Studio |
| 1631 | 0036 the event map is interactive (reverses 0025) | Render the featured row, Restrict the Maps key, Confirm Maps billing |
| 1632 | 0042 public reads shared at the edge; last-seen paint | Serve one shared board, Read the board, Serve the public page (venue), Open the community page |
| 1633 | 0043 the profile's proof strip | Archive the night, Look for missing shows, Rate the night |
| 1634 | 0048 pages and static files at the edge; Stripe SDK loads lazily — **the other session's, live via PR #4** | Open the voting page, Serve one shared board, Serve the public page |
| 1635 | 0049 one warm door for every fan read — **the other session's, live via PR #6** | Is a show running?, Serve one shared board, Serve the personal call, Ring (the cron), Open the community page |

Read back with `list_changelog_entries`: 49 decision-titled entries for the 49 records in `docs/decisions/` — nothing missing. 0048 and 0049 were found in the tree at the start of the phase (committed by the other session through pull requests — the first three merges under decision 0045, which is its own small verification that the flow works).

**The tandem rule, applied to 0049.** The one warm door changed how the fan's night reads the board and the personal call, so the three steps that describe it were updated in the sheet and in Puzzle in the same pass: *Is a show running?* (f03, 369763), *Serve one shared board* (l03, 369858), *Serve the personal call* (l04, 369859) — `/api/fan?what=board` and `?what=me`, old addresses still answering, the board's cache key changed once.

**Phase 10.** `AGENTS.md` § Before ending a session has a new row: *Does Puzzle need updating?* — sheet and section in the same session, a changelog entry for every new decision record the same day. The ledger's handoff checklist has the same line as step 5. `tools/decide.sh` now prints the reminder after creating a record. `CONVENTIONS.md`'s "once Phase 10 lands" note is closed. Engineering OS sheet 06 already carried e05 from Phase 4.

Ledger: DOC-012 done, verification-log row (changelog coverage). Plan: a status paragraph under the phase table.

## Findings

- **The MCP takes the title from the first Markdown heading.** A body that begins `# ` followed by a newline creates an *Untitled* entry (six of them, fixed with `update_changelog_entries`). The earlier entries read back with `# \n` because the server strips the heading it used. Write `# NNNN — title` on one line.
- **Plan phase 8 (data model) is not done.** The ledger's phase numbers drifted from the plan's: the plan's "7 · Business" covered both tabs 8 and 9, and the ledger counted them as Phases 7 and 8, so the plan's *8 · Data model* — one entity per storage family in overview §5.2, attributes linked to the steps that read and write them — has no ledger row and no work behind it. Recorded in the plan's status paragraph; it is the one remaining piece of the original scope.
- **Sheets are `loaded`, not `verified`.** Every one of the nine tabs still awaits the founder's browser pass — an agent cannot sign in to Puzzle. That is the gate on `verified` for all 45 sheets.

## Verified / not checked

- **Verified:** `list_changelog_entries` full listing (51 entries; 49 decision-titled); each `add_steps` answered with a join id; `sh -n tools/decide.sh`; the AGENTS.md table renders with the new row (read back with `sed`).
- **Not checked:** the canvas or the changelog page in a browser; whether Puzzle's changelog view orders by `completed_at` (entries were backdated to each record's date).

## Does Puzzle need updating?

Done — this was the update, including the one the other session's decisions owed.

## Next

The founder's browser pass over the nine tabs (then `verified` on the sheets). Plan phase 8, the data model, when wanted. From here the tandem rule carries the map: no more phases.

Nothing committed, nothing pushed. The other session's working-tree files were not touched (the two sheet edits are in `docs/processes/the-gig/`, which this session owns).
