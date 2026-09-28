---
tab: Reliability & security
section: Watching production
puzzle_section_id: 41994
sources:
  - tools/prod.py (report, keys, get — read-only through the Netlify CLI), tools/loadsim.py (--ceiling), credit-burn.sh, metrics.sh
  - netlify/functions/_lib.mjs (paymentsEnabled), _errlog.mjs
  - IMPLEMENTATION_STATUS.md P3-008, P3-005, GATE-003, § Open risks, § Verification log
  - MYSET-MASTER-OVERVIEW.md §6.2 (what it costs), §1.12
  - AGENTS.md § Build and test ("Verify by CONTENT, never by status code")
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections and list_steps)
verified: tool headers read 2026-09-12; prod.py and blobs:get run read-only earlier the same day
---

# Watching production

**Who:** the founder, or an agent on the founder's machine. **Trigger:** a session starts; a gig just happened; the Netlify bill arrives; a fan said something. **Outcome:** the live site's state read without anyone's password, the cost of a night known before it is sold, and the ledger's open-risk table kept honest. **The gap on this section is the same as the last one's: everything here is pulled by a person; nothing pushes.**

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| u01 | Read the live store, read-only | task | AI Agent | Coding agent R · Founder I | Netlify | `python3 tools/prod.py` — who is on the platform (plan, tick, ID on file, getting paid, songs), what is stored by kind, the things worth knowing. The Netlify CLI on this machine is signed in as the site owner, so `netlify blobs:get` is full owner-level **read** access to production — and it is how the app is diagnosed, not the admin door. `prod.py keys` / `prod.py get <key>` for one document. A write against production is asked for out loud first. `src: tools/prod.py header` |
| u02 | Verify by content, never by status code | task | AI Agent | Coding agent R | Netlify | The catch-all slug redirect answers 200 for files that do not exist. Fetch the page and grep for the thing that changed; the same rule for the tick, the buy button, a deploy. `src: AGENTS.md § Deploying; INVARIANT 9d3` |
| u03 | Know what a night costs | research | AI Agent | Coding agent R · Founder I | Netlify | `python3 tools/loadsim.py` — the standard bar set, or `--ceiling` to walk room sizes until reads outrun the store. Since the shared-board split every tick is two requests: the board (edge-cached, rendered about once per interval for the whole room) and the personal call. The wall it reports is **a simulation** — the ledger says so in its own words. `src: tools/loadsim.py; ledger GATE-003, P3-001` |
| u04 | Read the credit burn | research | Person | Founder R | Netlify | `./credit-burn.sh` — what is eating the billing period, deploys split by trigger. Only production deploys cost credits; the first version billed previews too and mis-sized Personal-vs-Pro. The double deploy (CLI + GitHub build for the same push) is PER-002. `src: credit-burn.sh header; overview §6.2; INVARIANT 9d3` |
| u05 | Pull the metrics | task | Person | Founder R | Netlify | `MYSET_ADMIN_CODE='…' ./metrics.sh` — every GET the app answers about itself, into CSVs for the tracking workbook. The code is read from the environment and never stored (INVARIANT 11); only the founder holds it. `src: metrics.sh header` |
| u06 | Read the function log while it exists | task | AI Agent | Coding agent R | Netlify | Netlify keeps function logs for 24 hours; log drains are Enterprise. Anything older lives only in the hourly error documents (→ *When something breaks* i02). The ledger asks for the log to be read after the first gig on the new endpoints to check the personal call's real cost. `src: decision 0029; ledger open risk "The personal call bills more…"` |
| u07 | Check payments actually work | conditional | Automation | Scheduled jobs R · Founder I | Stripe | **Draft — P3-008, not built.** `paymentsEnabled` checks the key **exists**, never that it **works**. On 2026-09-08 a valid-looking dead key showed the room a buy button that failed on tap, and nobody knew until a fan tapped. The design: a scheduled check off the hot path that makes one cheap Stripe call and turns the buy button off honestly (INVARIANT 9) when it fails. Ledger open risk *"Nothing detects a dead Stripe key"* — **active, unmitigated**. `src: _lib.mjs paymentsEnabled; ledger P3-008` |
| u08 | Keep the open-risk table true | document | AI Agent | Coding agent R · Founder A | Claude Code | Every risk found on this tab has a row in `IMPLEMENTATION_STATUS.md § Open risks` with impact, mitigation and an honest status (*active, unmitigated* / *unmeasured* / *resolved <date>*), and — the founder's rule — a step on this canvas, `Draft` if unbuilt. → *Engineering OS → Keeping the documents true*. `src: PUZZLE-MAPPING-PLAN.md Phase 5 exit criterion; ledger § Open risks` |

## Connections

u01 → u02; u01 → u03 → u04; u05; u06 → u08; u07 —Draft→ u08; u08 → *Engineering OS → Keeping the documents true* k01.
