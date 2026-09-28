# 2026-09-28 — Cross-session review: eight sessions, one main

**Asked (the founder):** review everything the most recent MySet sessions did — many of them were worktree sessions started from task chips — make sure none of them overlap or confuse each other, write one log of it all, and decide what to push and merge.

**How:** one read-only agent per session read its whole transcript, its worktree and its branch against `origin/main`, and marked each claim VERIFIED (against git, GitHub, Puzzle or the live site) or CLAIMED. A further agent audited the shared checkout, and another the unmerged cloud branch. The sessions board and the push log were read throughout. `origin/main` moved four times during the review (`20bd95e` → `52047cb` → `c13060e` → `496e9a4`); every finding below was re-checked against the newest.

## What landed on main (2026-09-27 17:00 → 2026-09-28 07:00 UTC)

| PR | Merged (UTC) | Commit | Session | What changed for a person |
| --- | --- | --- | --- | --- |
| #114, #115 | 09-27 17:05 | `2243aed` | Stop auto-start (e3b04f) | A deleted account stays off the schedule, never starts a show, gets no first-night letter (0098) |
| #116 | 04:41 | `588f03c` | 39 process sheets (c4da60) | The 39 untracked process sheets are in git |
| #117, #119 | 04:54 | `04e78db` | Studio admin role gaps (79b8fc) | A band mate or crew seat on the founding page cannot use the founder's tools (0099) |
| #120, #121 | 05:00 | `1385b2b` | Stop auto-start (e3b04f) | A deleted account's link preview goes dark; the founder's sheet says when it is deleted (0098) |
| #118, #122 | 05:03 | `7a84cb7` | Founding-page gaps (a698b5) | Media Dash boosts and the founder's Studio cards need the owner seat (0100) |
| #123, #124 | 05:13 | `ad9fc28` | Stop auto-start (e3b04f) | An invite list drops someone who deleted their account (0098) |
| #126, #127 | 05:31 | `c940a6e` | Auto-generated profiles (4b462c) | Sample pages, the factory, tip decks, table cards; a renamed page keeps its old address (0101–0103, 0106, 0107) |
| #128, #129 | 06:41 | `52047cb` | Seat sign-out (3d368c) | A seat signs out only its own devices; the owner sets each seat's tabs to Hidden, View or Edit (0104, 0105) |
| #125 | 06:59 | `496e9a4` | Passwords and sender (6b338f) | Docs: the sheets and Puzzle say passwords exist and the sign-in sender is set |

Production serves `main`'s code: `studio.js?v=b22f121b` on myset.vip hashes to `52047cb`'s file (checked 06:44 UTC). The docs PRs were `[skip ci]` and build nothing.

## Where sessions overlapped, and where each one stands

- **INVARIANT `0gq` was handed out twice.** The coordinating session told the seat sign-out session it held "0gp onward" while the board said `0gq` was next free. The seat session used `0gq` (live in `52047cb`); the profiles session then claimed it for its new HQ build. The sessions caught it themselves at 06:48–06:49 UTC and HQ moved to `0gr`/`0gs` before writing anything. **Resolved.**
- **The cloud security branch reuses main's numbers.** `origin/claude/myset-encryption-security-460mph` (off `45a8d07`, pushed 02:24 UTC) defines decisions 0099/0100 and INVARIANTS 0gj–0gr; seven of those nine are now taken on `main`. **Open** — it must renumber into 0110+ / 0gt+ (reserved on the board).
- **The cloud branch and #128 fixed the same holes differently** (sign-out scope, revenue and history, crew reaching room settings). #128 merged first, on the founder's word. Against `main` the branch now conflicts in 15 files, and three more files would merge silently wrong (duplicate INVARIANT ids; two tests that contradict 0104 and 0105). **Open** — see *Decisions* below.
- **Two sessions edited the same sheet rows** (artist-lifecycle/04 e06, venue-lifecycle/02 y07, reliability-and-security/01 i06): the second appended its 0100 clause after the first's 0099 text. **Coherent on main.**
- **PR #125 rebased four times** as #126, #127, #128 and #129 landed; each time only the push log and front-matter lines conflicted, and #128's decision 0105 changed what a non-owner seat sees under *Signing in*, which #125 now says. **Merged.**
- **Rules split between the shared checkout and main.** The pull-request deploy flow (decision 0045), the backup-at-start line and the "Does Puzzle need updating?" hand-off existed only as uncommitted edits in `~/Docs/MySet`. Sessions started there read them; sessions in worktrees read `main`'s `AGENTS.md`, which still said a push to `main` deploys. **Fixed by this PR.**
- **Puzzle left behind by the repo.** Changelog 2408 (0098) lost its title when #121 re-bodied it; step 388961 (p16) and changelog 2397 still said Tennessee was owed after decision 0096's correction; step 372596 (p15) and changelog 1712 still said 0078 after the record became 0080. **Fixed in Puzzle and read back.**
- **Merged branches left on GitHub.** `gh pr merge --delete-branch` fails from a worktree while `main` is checked out in the shared checkout, so 74 merged branches stayed on origin. **Deleted** (each head equal to its merged PR's head, so GitHub can restore any of them from the PR page); `AGENTS.md` now says to delete the branch by hand.
- **Pace over pause.** #123 merged on the coordinating session's word rather than the founder's; #109, #120 and #123 merged seconds after opening, before a deploy preview existed; #128 merged while its preview checks ran. Each was verified live by content afterwards and nothing broke — but the preview look in `AGENTS.md` was skipped.
- **Board hygiene.** Nobody owned the board after 05:37 UTC; several rows carried times one to two hours fast, and "wt@" push-log labels came from more than one session.

## Decisions taken in this review

- **#125 merged** (`496e9a4`, docs only, `[skip ci]`), after a final rebase on `c13060e` and a full suite run (exit 0, 4,487 ✓, 0 ✗).
- **#27 closed as superseded** — its only commit outside main's history is patch-identical to `34215b8`. **#3** (a draft copy preview from 2026-09-08) is left for the founder.
- **74 merged remote branches deleted.** Left on origin: `main`, the unmerged security branch, `docs/payments-session-ledger` (#20, closed unmerged) and `preview/cta-copy` (#3).
- **The security branch ships in three slices, not as one merge** (sent to that session with the detail):
  - *A, code only, first* — the input-validation fixes that are still live on `main`, the ungated gig fields, the share-card `$'` bug, headers and deadlines; decision 0110, INVARIANTS 0gt+.
  - *B, rate limits* — only after the checkout limit is resized (as written, one bar's shared wifi would see *Too many tries* at the buy moment) and the retry caps go back up; decision 0111.
  - *C, signing key and sealing at rest* — only after `MYSET_SECRET` is set in every deploy context and `FINMODEL_CODE` is set, and after the key-rotation runbook stops breaking recovery codes and Studio codes; decisions 0112/0113.
  - Dropped: everything #128, 0099 and 0100 already do.
- **The HQ build (4b462c, `feat/hq-crm`) carries on** — current with `c13060e`, holding 0108/0109, 0gr/0gs, UX-062, GRO-003; it rebases once more before its PR.
- **This PR** puts the pull-request flow, the board, the backup line and the Puzzle hand-off into `AGENTS.md`, the standing rule into `CONVENTIONS.md`, and two reminders into `tools/decide.sh`.

## Left open (owner in brackets)

- The founder: whether a band mate should keep **Money: Edit** by default (0105's preset made it View, which #128 did not call out: *Deliver them now* and night edits now answer 403 for members); whether a seat with Money view should see every buyer's email in `/api/revenue`; the API keys set in every deploy context (Production only is safer: a preview reads and writes production data, so *Generate* on a preview spends real credit); the Stripe-disabled Supabase webhook (asked 2026-09-24, unanswered); PER-016 (the Tennessee form waits at a field only the founder can fill); archiving the finished sessions.
- The security session: slices A → B → C as above.
- The profiles session: the artist-lifecycle/01 row for step 389231 (owed since #126; unblocked by #125); GRO-002 and Notion still say the keys are unset.
- The seat session: 0105's record contradicts itself on where the mock's presets come from; `msgBlock` and `msgReport` keep dead `CAPABILITY` rows.
- The payments session: decision 0096's options table (row A) still says "register in Tennessee"; no 09-27 session note.
- Anyone: 26 more edits exist only in the shared checkout (mostly 2026-09-12 process and ledger notes — a port, not a copy: main has moved past several), then the checkout can be reset to `origin/main` and `npm install` re-run; the old open-line worktree (`compassionate-chatterjee-41ecbe`) holds unlanded production open-line work whose numbers collide with main (port as new numbers, or archive — the founder's call).

**Not checked:** a signed-in band mate or crew seat on production; the Netlify deploy records for #117/#118 (quoted from their sessions' output); whether the first `x-forwarded-for` hop is client-settable on Netlify; the cloud session has not confirmed it read the review.
