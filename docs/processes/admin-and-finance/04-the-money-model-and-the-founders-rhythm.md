---
tab: Admin & finance
section: The money model and the founder's rhythm
puzzle_section_id: 42014
sources:
  - finance/README.md (the model, where the numbers come from, keeping it honest), finance/model-test.mjs, tools/actuals.py, tools/actuals-test.py
  - INVARIANTS.md 0ec (the model is served by a function and never leaves the server without the code)
  - ACCOUNTING.md § The monthly close; § Costs; § The recommendation, plainly
  - AGENTS.md § At session start (push log, ledger, backup --if-stale), § Before ending a session
  - GIG-NIGHT.md § Before you leave the house
  - IMPLEMENTATION_STATUS.md § the founder's own list (PER rows), § Open risks
  - docs/processes/money/06 (k04, k06, k08, k09, k11), money/07 (h08, h09), reliability-and-security/02 (u01, u04, u08), 05 (b03, b06)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — names, statuses, connections match)
verified: not yet — the founder's browser check of the tab is outstanding; code read 2026-09-12 for mapconfig.mjs, moneymodel.mjs, _connect.mjs, _billing.mjs
---

# The money model and the founder's rhythm

**Who:** the founder. **Trigger:** a projection question (*what does this cost at a thousand phones?*), a real gig that should replace a guess, the monthly close, or the start of a session. **Outcome:** the money model stays honest — every dial that was a guess becomes a measurement as real nights arrive — and the admin work that nobody else can do happens on a rhythm instead of when something breaks. This section is the calendar for the whole tab: most of its steps are aliases of things that already have a home.

`Live` where the tool exists and the rhythm is written into the checklists that run; `Draft` where the rhythm is proposed here for the first time.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| z01 | Open the money model | task | Person | Founder R | Netlify | `myset.vip/moneymodel`, served by `moneymodel.mjs` from the bundled `finance/model.html` behind the passcode (INVARIANT 0ec; the passcode is *Mail, maps and the name* d09). One self-contained page: dials, KPI tiles, five charts, the formula line by line, and a **Real shows** panel. Every number comes out of one engine block that simulates the voting page's real polling ladder and prices the units on the selected host. `src: finance/README.md; INVARIANTS.md 0ec` |
| z02 | Know which numbers are which | task | Person | Founder R | — | Four kinds, and the page says which: **measured** (bytes per poll, reads per call, ms per read — through the real code); **published** (host and Stripe rates, links in the footer); **simulated** (the reference gig); **guessed** (the dials — artists, plan mix, gigs, room size, spend, featured share, fixed costs). A guessed dial is replaced the moment a real number exists, never argued with. `src: finance/README.md § Where the numbers come from` |
| z03 | Mark bandwidth before and after a gig | alias | Person | Founder R | Netlify | → *Money → Past shows and the money model* h09: `tools/actuals.py --mark` the evening before and the morning after (with `--studio-min` and `--clip-views` on the AFTER mark — one clip view is tens of thousands of polls' worth); two marks an hour apart on a quiet day measure what the other sites add. Marks either side of the billing-period reset cannot be compared (*The Netlify account* e05). `src: finance/README.md; sheet h09` |
| z04 | Pull the real nights | alias | Person | Founder R | Netlify | → h08: `tools/actuals.py --write` keeps only nights that line up with a published gig, prints what it refused and why, and writes `finance/actuals.json`; paste it into the Real shows panel and switch *Use real shows* on. The founder's own nights land in the per-head figure because the founder's plan is comped. `src: finance/README.md § Keeping it honest; sheet h08` |
| z05 | Run the model's tests | task | Person | Founder R · Coding agent R | — | `node finance/model-test.mjs` (the engine) and `python3 tools/actuals-test.py` (the night rules against the 2026-09-11 fixtures, the bandwidth solver on synthetic marks). Run after any change to the engine block or the rules, and before a report is written from the model. `src: finance/README.md` |
| z06 | Write the report, plainly | document | Person | Founder R · Coding agent C | — | `finance/reports/` holds the plain-language reports (the first gig week). A report states which of z02's four kinds each number is and never lets a simulated crowd read as a real one — the same evidence rule the marketing tab holds (→ *Marketing → Measuring* x11). `src: finance/README.md; finance/reports/` |
| z07 | Close the month | go_to | Person | Founder R | Stripe | → *Money → The books and the monthly close* k04 (close finished months once), k06 (the founder's gigs separate from the company), k08 (type in the six cost kinds — hosting from *The Netlify account* e02, email and domain from *Mail, maps and the name*), k09 (download the statement). Four numbers a month is proportionate to a business with one employee. `src: ACCOUNTING.md § The monthly close; sheets k04–k09` |
| z08 | Move to a real package when it is worth it | alias | Person | Founder R | — | → k11. At revenue worth reconciling, or the first year that needs a filed return: Xero or QuickBooks with the Stripe connector as the book of record. MySet's statements stay because they are what artists and venues download. **Never** the blob store as the book of record. `src: ACCOUNTING.md § The recommendation, plainly` |
| z09 | Every session start | sequence | Person | Founder R · Coding agent R | Claude Code | Already written into AGENTS.md and run by every agent: the top of the push log, then the ledger, then `python3 tools/backup.py --if-stale` (→ *Backup and restore* b06). → *Engineering OS → Starting a session*. `src: AGENTS.md § At session start` |
| z10 | Before every gig | sequence | Person | Founder R | — | `python3 tools/backup.py` (GIG-NIGHT.md), a bandwidth mark (z03), the two links checked. → *The gig → The artist's night*. `src: GIG-NIGHT.md § Before you leave the house; finance/README.md` |
| z11 | Once a week — the admin pass | sequence | Person | Founder R | — | **Draft — proposed here.** Fifteen minutes: `./credit-burn.sh` (→ *Watching production* u04), `python3 tools/prod.py` (u01), the open-risk table (u08), and the founder's own list in the ledger (z12). Pairs with the marketing weekly review (→ *Marketing → Measuring* x05) on the same day. `src: sheets u01, u04, u08` |
| z12 | Keep the founder's own list true | database | Person | Founder R · Coding agent C | — | The ledger's *own list* (PER rows) is the source of truth for everything only the founder's hands can do — Stripe destinations, secrets, 2FA, `AUTH_FROM`, the passkey on stage, the restore rehearsal. An agent adds a row when it finds one and marks it `done` only with evidence the founder gave; the run-sheet artifact is a *view* of this list, not a second list — when they disagree, the ledger is right. `src: IMPLEMENTATION_STATUS.md § the founder's own list` |
| z13 | Once a month — the founder's close | sequence | Person | Founder R | — | **Draft — proposed here.** The monthly close (z07), the Netlify bill against the model's server line (e02 → z01), the Resend and Maps quotas (*Mail, maps and the name* d03, d05), the backup retention run (`tools/backup.py --prune`, b06), the marketing monthly review (x06). One evening. `src: sheets k04, e02, d03, b06, x06` |

## Connections

z01 → z02; z03 → z04 → z01; z04 → z05 → z06; z07 → z08; z09, z10, z11, z13 are the rhythm — z11 → z12; z13 → z07; z10 → z03.
