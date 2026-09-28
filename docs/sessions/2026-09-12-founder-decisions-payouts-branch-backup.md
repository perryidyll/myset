# 2026-09-12 — Three founder decisions: daily payouts, a protected `main`, and the first backup

**Asked:** from the Founder Run Sheet — keep **daily payouts** (*"a near-instant reward loop and validation for using the app"*), and do **branch protection** and the **backup rhythm** *"using your best judgement."*

## What shipped

**Decision 0044 — artists are paid out daily, on purpose.** No code change; `_connect.mjs` already asks for daily. The record captures why weekly (recommended twice) was declined. Puzzle: Stripe section step *Pay artist* (367271) cites it; changelog 1620.

**Decision 0045 — `main` is protected.** GitHub ruleset **23031933** on the default branch, created with `gh api`: pull request required with zero approvals, force-pushes and deletion blocked, no bypass for anyone, squash and merge only. Not required: a status check (a `[skip ci]` doc PR would never be mergeable) or an approval (nobody to give one). The deploy procedure is rewritten in `AGENTS.md` (§ Read this before your first edit, § Deploying), overview §6.1, and Engineering OS d04/d05 (Puzzle 370053/370054). Changelog 1621. **Every session that started before this reads the old procedure**; the push log is where they find out — its own `git push` to `main` will be refused with GitHub's message.

**Decision 0046 — the datastore is copied.** New `tools/backup.py`: read-only copy of every key through the Netlify CLI (eight at a time), into `~/Docs/Project Handoffs/myset-backups/<UTC stamp>/` (owner-only; outside the repo; inside the SSD mirror), with a checksummed manifest; then verify (checksums, JSON parses, registry ↔ documents, `authsecret`); then prune (90 days; first-of-month kept a year). Rhythm: `--if-stale` at session start (`AGENTS.md` § At session start; Engineering OS new step s09, Puzzle 370125), and always before a gig (`GIG-NIGHT.md` § Before you leave the house). Overview §9.5 tools table gained a row. Reliability & security b02/b03/b06 → Live (370109/370110/370113); b04/b07 stay Draft. Changelog 1622.

## What the first backup printed

```
copied 206 of 206 keys, 287.1 MB → …/myset-backups/20260912T093330Z
  not JSON (stray keys, not app documents): cas/t, cas2, debug/probe
  registry: 1 artists, 1 slugs, 0 email rows
  206 keys, 191 JSON documents, 12 binary, 3 stray
  copy is whole
```

Four pre-R2 clips are ~270 MB of the 287. The first run took about twelve minutes with eight workers (the CLI spends most of each call starting up; a serial run was on course for ~35). The three stray keys are probe leftovers — harmless, and a `blobs:delete` candidate for whoever next writes to production on purpose.

## Findings

- **The repository is public on GitHub.** `HARDENING.md §2` says it is private; `gh repo view` says `visibility: public`. Every document in it is readable by anyone. Not changed — the founder's call (going private also moves rulesets behind GitHub Pro). Ledger open risk; on the run sheet.
- The other session committed and pushed at 16:31 local, minutes before the ruleset went on; its commit `6cc6c1a` rewrote `AGENTS.md` (the push-log convention) and clobbered this session's first edit of the same file, which was redone on top. Decision numbers 0042 and 0043 were taken by that session in the same window, so this session's records are 0044–0046.

## Verified / not checked

**Verified:** ruleset read back through `gh api repos/perryidyll/myset/rules/branches/main`; the backup run above and `--verify` / `--if-stale` afterwards; `node tools/overview.mjs` regenerated (decision count 43 → 46; nothing else in §2.1 moved). **Not checked:** a push to `main` actually being refused (none attempted); a restore; the Puzzle canvas in a browser.

Nothing committed or pushed. The other session's working-tree files (`_history.mjs`, `public/*.html`, `lock.css`, `app.css`, `test/community.mjs`, `test/structure.mjs`) are untouched.
