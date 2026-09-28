# 2026-09-12 — Puzzle mapping, Phase 5: Reliability & security

**Asked:** load the Reliability & security tab (39040) — every ledger risk as a step, the unbuilt and untested items as `Draft` — and, separately, tell the founder exactly how to create the Connected-accounts Stripe destination and where its secret goes in Netlify (answered in chat; the procedure is also step j04/j07 on the tab and `ACCOUNTS.md §5 (5)`).

## What shipped

Six sheets under `docs/processes/reliability-and-security/`, loaded with `create_process`, RACI linked with `link_to_steps`, read back through `list_sections`:

| Sheet | Section | Steps | Draft |
| --- | --- | --- | --- |
| 01 | When something breaks on the night | 41993 (i01–i09) | i09 *Page somebody* |
| 02 | Watching production | 41994 (u01–u08) | u07 *Check payments actually work* (P3-008) |
| 03 | Secrets and keys | 41995 (j01–j09) | j06 restricted key (unrecorded), j07 Connect secret (PER-008), j08 push keys (P4-004), j09 the leak runbook |
| 04 | The founder's own accounts | 41996 (y01–y07) | all seven — nothing on this section can be verified from the repo |
| 05 | Backup and restore | 41997 (b01–b07) | b03–b07 — nothing is built |
| 06 | The doors and the threat model | 41998 (h01–h10) | none (the Draft items inside — script hashes, edge rate limit, photo encryption — are named in the notes of Live steps) |

50 steps (370075–370124), 76 role links (326389–326464), 39 connections, two of them cross-section (i06 → u01 *the morning after*; h10 → y01). Tools: Netlify on most, Stripe on the key steps, GitHub on the hardening steps, Claude Code on the ledger step.

Changelog: existing entries 1596 (0029), 1599 (0013), 1597 (0030), 1586 (0008) linked to the steps they govern; new entry **1618** for the 2026-09-05 security pass (headers, passkeys, security.txt), which had no decision record — `SECURITY.md` is its record — backdated and linked to h01–h04, y01, b04, i09, j09.

Ledger: DOC-008 done, DOC-009 (Community & media) added; verification-log row; the *restore* and *alerting* open-risk rows now name their `Draft` steps.

## Findings

- **There is no backup.** The repo has no store export, no snapshot script, nothing — `prod.py keys` lists keys as a report and per-account `exportArtist` is the only backup-shaped thing. `SECURITY.md` said "nobody has tested a restore"; it is more than that. Whole section `Draft`.
- **Whether `STRIPE_SECRET_KEY` is a restricted key is not recorded.** PER-007 says it was replaced on 2026-09-08 after the outage; `HARDENING.md §1` says the replacement should be `rk_live_` with Checkout Sessions only. Nothing says which it is. Read it off the Stripe API-keys page (j06).
- The threat model's #1 item (2FA on four accounts, PER-003) is still not started; every step in *The founder's own accounts* is a browser task only the founder can do.

## Verified / not checked

**Verified:** `list_sections` on 39040 returns six sections with 9/8/9/7/7/10 steps and the connections as loaded; `list_steps` shows h10 → 370101; code read for every `Live` step (`_errlog.mjs`, `bug.mjs`, `admin.mjs bugList`, `studio.html` "If something looks wrong", `netlify.toml` headers, `_lib.mjs` preview note, `webhook.mjs` secret check, `tools/prod.py`, `credit-burn.sh`, `metrics.sh`). **Not checked:** the canvas in a browser (the founder's); nothing on the founder's-accounts section.

Nothing committed or pushed. The other session's files are untouched.
