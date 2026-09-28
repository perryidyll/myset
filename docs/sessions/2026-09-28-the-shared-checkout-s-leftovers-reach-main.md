# 2026-09-28 — The shared checkout's leftovers reach main

**Asked (the founder, through a task from the cross-session review):** port the edits that exist only in the shared checkout at `~/Docs/MySet` (on `cb22f3f`, 114 commits behind) to `main` by hand. Never copy a file over main's newer version. Add the 2026-09-12 and 2026-09-14 session notes, claim the agent-keys ledger row on the sessions board first, and keep it docs only.

**How:** each local file was diffed against its own base (`git diff HEAD` in the shared checkout, read-only, with `--no-optional-locks`). Each hunk was then checked against `origin/main` (`013c090`) and the code before it was written here. Before the merge the branch was rebased onto `99b0693` (#134, #135): they touched none of these files but the ledger's header, where both lines were kept, and `bumpFrom`, `casDoc`, `STORE_NAME`, `mutateArtists`, `emailChangeFinish`, `MIN_VOUCHES = 3` and `admin.mjs`'s owner-seat check were all found again there. Nothing in the shared checkout was committed, stashed, reset or cleaned.

## Ported

| Where | What | Checked against |
| --- | --- | --- |
| ACCOUNTS.md §5, item 3 | `charge.updated` marked done 2026-09-12, with `account.updated` | ledger PER-001 |
| ACCOUNTS.md §6.4 | *When everything is gone*, the founder's by-hand procedure. It now also lists "no password" (0070), and step 3 says to set a password. "No `byEmail` row today" is now dated 2026-09-12, and the note says the 2026-09-25 backup shows owner rows on that account | `bumpFrom` (`_session.mjs`), `casDoc` and `STORE_NAME` (`_lib.mjs`), `mutateArtists` (`_auth.mjs`), `emailChangeFinish` (`auth.mjs`); the registry's keys in the 2026-09-25 backup (owner rows counted, not read) |
| ACCOUNTS.md §10, item 6 | `ownerEmailSet`, placed in `admin.mjs`'s owner-seat block (decision 0099) | `admin.mjs`, the `isPlatformOwner` + owner-role line |
| GIG-NIGHT.md | *Before you leave the house*: `python3 tools/backup.py` (decision 0046). `tools/backup.py` and decision 0046 already pointed at this section | `tools/backup.py` usage |
| HARDENING.md §2 | The repo is public (0047) and `main` is protected by ruleset 23031933 (0045); the branch-protection step is marked done | `gh repo view` → PUBLIC; the ruleset reads *active* |
| VERIFYING-A-VENUE.md | The vouch count is `MIN_VOUCHES` in `_verify.mjs`, not ten: `190e2b4` lowered it from 5 to its present value. The mockup's "4 of 10" became "N of M" | `_verify.mjs`; `git show 190e2b4` |
| IMPLEMENTATION_STATUS.md | PER-021, the agent keys row: the shared checkout called it PER-011, but main's PER-011 is the Stripe products row. PER-009 now matches §6.4 | the board's claim (07:44 UTC); `NETLIFY_AUTH_TOKEN` is unset in an agent session, so the proxy is not in place |
| tools/actuals.py | `token()` reads `NETLIFY_AUTH_TOKEN` first | — |
| PUZZLE-MAPPING-PLAN.md | The 2026-09-12 status paragraph. The header no longer says nothing in Puzzle has changed. The Artist lifecycle row cites 0037, not 0036 | decision titles 0036 (event map) and 0037 (ten shows) |
| money/01 d08, money/02 | PER-001 done, and **PER-008 done** (decision 0058: the *Connected accounts* destination and its second secret). The local copy still said PER-008 was open | `webhook.mjs` secret list, `test/twosecrets.mjs`, ledger PER-008 |
| money/03 | The cap decision is 0037, not 0036; p08's type is task, as in Puzzle | Puzzle 369894 |
| the-gig/01 | Sources gain 0038, 0039 and 0049. f03: the warm door (0049). f14: finality demoted to today's behaviour. f18/f20: the three-hour wrap-up and the *Next show* card (0039). The notes line | `vote.html` (what=board and what=me, `at` − `endedAt` under three hours, *Up next* only while live, `loadGigs` once), `fan.mjs`, `autocron.mjs`, `_lifecycle.mjs` |
| the-gig/03 a04 | 0036 → 0037 | Puzzle 369799 |
| the-gig/07 | Sources gain 0035 and 0049. l03/l04: the warm door. l11: named as in Puzzle, in progress, measured (0035) | `fan.mjs`, `vote.html`, ledger P3-002 |
| docs/sessions/ | 12 notes from 2026-09-12 and `2026-09-14-agent-keys-runbook.md`, byte-identical | scanned for key-shaped strings, emails, personal names and money figures: none found |

## Left out, and why

- **`money/04` and the-gig/03's "six tabs" line.** The local copy folded Merch into Profile on 2026-09-12. Merch got its own screen (Menu → *Merch store*) on 2026-09-13, and main already says so.
- **ACCOUNTS.md §5, item 5** (the *Connected accounts* destination as an open task): PER-008 is done.
- **the-gig/03 a01:** main's text (#125) is newer.
- **`finance/marks.json`:** main already holds both 2026-09-14 marks.
- **`tools/backup.py`** (untracked, 234 lines): an old draft of main's 328-line tool.
- **`docs/landing/MERCH-MONEY-PROFILE-PLAN.md`:** identical to main's.
- **AGENTS.md, CONVENTIONS.md, tools/decide.sh:** ported in #130.
- **Not repo content:** `Marketing Foundations/` (11 files), two logo PNGs, the push-log kit readme and zip, a stray file named `-` (an R2 mirror cursor from 2026-09-15), and the deleted `node_modules` link.

## Puzzle

d08 (369874) and the Stripe-events section notes (41972) said PER-008 was open. Both now say it is done (decision 0058), and both were read back. f03 (369763) gained `fan.mjs; autocron.mjs; decisions 0034, 0049` in its source line. Every other ported row already matched Puzzle, which had been ahead of these sheets since 2026-09-12 (f14, f18, f20, l03, l04, l11, a04 and p08's type).

## For other sessions

If the security branch's sealing at rest (its slice C) seals the artists registry, §6.4's `blobs:get` / `blobs:set` steps need the unseal step it adds. That session has been told.

**Verified:** `sh test/run.sh` exit 0, 4,522 ✓, 0 ✗, on the ported tree; after the rebase onto `99b0693`, exit 0, 4,516 ✓, 0 ✗ — main's own count after #134, as it should be for a docs-only change.

**Not checked:**
- a browser look at the changed sheets;
- the write half of §6.4 (never run);
- PER-021's proxy path.

Resetting the shared checkout is the founder's call, after this lands. Two traps: a `git clean` there deletes the founder's files that were never in git (the marketing PDFs, two logos, the push-log kit), and a plain `git reset --hard` deletes its real `node_modules` folder, the one every worktree's `node_modules` link points at, because `main` tracks a `node_modules` link (a `.gitignore` of `node_modules/` does not match a link) and the reset puts that link, pointing at itself, in the folder's place. Move `node_modules` aside first and put it back after.
