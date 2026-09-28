# 2026-09-12 — Puzzle mapping, Phase 8: Admin & finance

**Asked:** *"please continue with phase 8"* — the Admin & finance tab (39042): Netlify, the Stripe dashboard, domain and DNS, Resend, the Maps key, the money model and actuals, tax (plan row 9). Tab was empty before the load.

## What shipped

Four sheets under `docs/processes/admin-and-finance/`, loaded onto tab 39042, RACI on every step, read back through `list_sections`:

| Sheet | Section | Steps | Draft |
| --- | --- | --- | --- |
| 01 | The Netlify account | 42011 (e01–e10) | e04 *Personal or Pro?* (PER-002), e09 *Renew the name* (not checked) |
| 02 | The Stripe dashboard | 42012 (s01–s10) | s03 Connect destination (PER-008), s04 restricted key unrecorded, s05 Customer Portal live mode, s08 refunds, s09 disputes, s10 tax |
| 03 | Mail, maps and the name | 42013 (d01–d09) | everything but d04 (the Maps key restriction, done 12 Sep) — `AUTH_FROM`, Resend verification and quota, Maps billing, push keys, trademark, privacy policy, the money model's passcode |
| 04 | The money model and the founder's rhythm | 42014 (z01–z13) | z08 a real package, z11 the weekly admin pass, z13 the monthly close (both proposed here for the first time) |

42 steps (370252–370293), 57 role links (326663–326719), 36 connections, six cross-section (bill → model, DNS → DKIM, Pro? → the server line, monthly close → mail and Maps quotas, variables → the passcode). Tools: Netlify, Stripe, Resend, Claude Code.

**The tab is deliberately thin.** The code side of every money item is on the Money tab and every secret on the Reliability tab; this tab is the *account-holder's* view — what only the person signed in to Netlify, Stripe, Resend, Google Cloud and the registrar can do — so it aliases and go_tos wherever a home already exists (k04–k11, h08–h09, j04–j08, u01–u08, b03–b06, y01, y07) and adds procedure only where none was written: the rhythm (session start, before a gig, weekly, monthly), refunds, disputes, tax, DNS, the registrar, the passcode.

Ledger: DOC-011 done, DOC-012 added (Phases 9–10), verification-log row, **PER-010** added.

## Findings

- **The money model's lock is not a lock while the repo is public.** `moneymodel.mjs` falls back to a default four-digit code that sits in the source; INVARIANTS 0ec calls it a courtesy lock, which was fine when the repository was private. Since decision 0047 it is public, so the default is public. Fix is two minutes: set `FINMODEL_CODE` in Netlify (PER-010, d09). Not a secret leak — no secret was ever in the code — but the founder should decide whether the model should be behind a real code now.
- **The registrar is a fifth account.** The threat model's ranked #1 risk is the founder's accounts being phished, and the 2FA item (PER-003, y01) lists four: Google, GitHub, Netlify, Stripe. The domain sits at Porkbun; whoever holds the registrar login holds the name and the nameservers. Noted on e09.
- **Refunds, disputes and tax have no procedure** and none has been needed. Written as `Draft` with what the code and ACCOUNTING.md already constrain (a refund never takes votes back; the four-month session window; the blob store is never the book of record) — and with an explicit *do not build a workflow for a thing that has not occurred*.
- **Whether the Stripe key is restricted is still unrecorded** (s04, PER-007 replaced it; HARDENING §1 asks for `rk_live_`, and step 7 — revoking the full key — is the step people skip).
- **The run-sheet artifact is a view, not a list.** z12 says so: the ledger's PER rows are the source of truth; the artifact lives in a session scratchpad and will not survive it.

## Verified / not checked

- **Verified:** `list_sections` on 39042 before (empty) and after (4 sections, 42 steps, statuses as in the sheets); code read for the claims that could be checked — `mapconfig.mjs` (the key is meant to be public and restricted), `moneymodel.mjs` (the default code and `FINMODEL_CODE`), `_connect.mjs` (`interval: 'daily'`), `_billing.mjs` (`portalLink`); no name in the new sheets.
- **Not checked:** the canvas in a browser (the founder's); the registrar's auto-renew and card; whether the Resend domain shows Verified; whether Maps billing is linked; Netlify's rollback behaviour on the deploys page (described from the product's general behaviour, not exercised).

## Does Puzzle need updating?

This session was the Puzzle update. No decision record was written (nothing here could have gone another way — it is a map of what is), so no changelog entry is due.

## Next

Phase 9: changelog entries for decisions 0015, 0025, 0027, 0036, 0042, 0043. Phase 10: the *"Does Puzzle need updating?"* line in `AGENTS.md` § Before ending a session and in Engineering OS sheet 06. Then the founder's browser pass over all nine tabs.

Nothing committed, nothing pushed. The other session's working-tree files were not touched.
