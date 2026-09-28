# 2026-09-12 — Puzzle mapping, Phase 7: Marketing & growth

**Asked:** *"please continue with phase 7"* — the marketing strategy (`MySet_Master_Marketing_Strategy_v3.md`, §5–§13) as procedures on the Marketing & growth tab (39041). This is the first of the plan's "slow half": business processes that existed only as strategy and had to be **written as procedures for the first time** (plan row 8). Tab 39041 was empty before the load.

## What shipped

Seven sheets under `docs/processes/marketing-and-growth/`, loaded onto tab 39041, RACI on every step, read back through `list_sections`:

| Sheet | Section | Steps | Live |
| --- | --- | --- | --- |
| 01 | The cold start — outbound and the scenes | 42004 (m01–m10) | — |
| 02 | Recruiting the Founding 50 | 42005 (f01–f12) | f03 *Import the repertoire* (paste / CSV work today), f05 *Send the QR cards* (Codes to print), f07 *The first gig runs* (go_to) |
| 03 | The gig-to-content pipeline | 42006 (p01–p11) | — |
| 04 | The weekly rhythm and the two-post loop | 42007 (r01–r13) | — |
| 05 | What a post must be — channels, hooks, franchises | 42008 (n01–n11) | — |
| 06 | The automation engine | 42009 (a01–a12) | — |
| 07 | Measuring, reviewing and killing | 42010 (x01–x12) | x11 *Check the claim against the ladder*, x12 *Template language is never evidence* (binding now — AGENTS.md § Safety) |

81 steps (370171–370251), 123 role links (326540–326662), 89 connections; three cross-section by id (r13 → a08, n06 → r01, x07 → m08 *scene expansion*: 414419–414421). Tools: Netlify on the product steps, Claude Code on the panel steps, Resend on the owned-list step.

**Status is honest, and therefore mostly `Draft` (76 of 81).** The convention says `Live` means built and running; the programme has not started (Appendix C "before day one" is unchecked). A step goes `Live` the week it is actually being done — the sheets say so in their intros.

Ledger: DOC-010 done, DOC-011 (Admin & finance) added, verification-log row. No new decision record — mapping is not a design decision — so no changelog entry was due.

## What the strategy assumes that the product does not have

Named in the notes as **Draft — nothing exists**, so nobody reads a procedure and expects a button:

- a practice / dry-run mode (f04 — the dry run is a real show with one voter, which is fine)
- a gig-day reminder by email or SMS (f06); push alerts cannot send either (VAPID unset)
- a Room Report share card (f08, a05) — the *data* is in Money → Past shows; the card is by hand until built, and *exploration-only* in content until then (evidence rule 2)
- a founding-artist badge (f10)
- Spotify playlist import (f03 — offered, answers 503; the founder pastes)
- all four attribution mechanisms in §12.4: franchise short links, UTM discipline, a free-text *"how did you find MySet?"* at signup, per-artist referral codes (x04). The last two are code changes with a decision record.
- email capture and a list (n10)

## Findings

- **Naming collision.** The strategy's "founding-artist badge" (§5.2) and the code's "founding artist" (`_plan.mjs` 157, `artist.html` 309 — the platform owner's own account, the one that predates Connect) are different things. When the badge is built it needs another name in the code; noted on f10.
- **No content-agent role in the workspace.** The creator-analyst panel (a02, a03, a08) is attributed to *Coding agent*. Either that role is renamed to *Agent session* or a second agent role is added; a five-minute change once the founder decides, not made here.
- **The evidence rules already bind the repo.** §13's rules and AGENTS.md § Safety say the same thing from two sides ("the two nights story is false"; the synthetic test "is not evidence"). x11 and x12 are the only `Live` steps that are not product features, because they are in force today.
- **The strategy's personal-account handle is not in the sheets.** §6.6 names it; the sheets say "the founder's existing personal wellness identity". Nothing in `docs/processes/` names a person.
- **Numbers.** The strategy's targets (fifty conversations, ten DMs a day, ten to fourteen assets a gig) are strategy numbers, not `tools/overview.mjs` numbers, and are quoted where they are the rule; the §13.1 evidence base (voters, votes, the purchase, the assertion count) is cited as *"as listed in §13.1"*, never copied.

## Verified / not checked

- **Verified:** `list_sections` on 39041 before (empty) and after (7 sections, 81 steps, statuses and types as in the sheets, labelled branches present); `create_connections` and `link_to_steps` answered with ids; a grep for the founder's name across the new sheets finds nothing.
- **Not checked:** the canvas in a browser (the founder's job — an agent never signs in to Puzzle); whether the Studio's CSV import accepts a photo-typed list without cleaning (assumed from overview §3.4, not exercised).

## Does Puzzle need updating?

Done in this session — this *was* the Puzzle update. Nothing else changed that has a sheet.

## Next

Phase 8, Admin & finance (tab 39042): `HARDENING.md`, `SECURITY.md` and the ledger's "own list" as procedures. Then the six decision records still without a changelog entry (0015, 0025, 0027, 0036, 0042, 0043), then the AGENTS.md session-end line (Phase 10).

Nothing committed, nothing pushed. The other session's working-tree files were not touched.
