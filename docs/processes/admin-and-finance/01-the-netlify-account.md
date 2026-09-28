---
tab: Admin & finance
section: The Netlify account
puzzle_section_id: 42011
sources:
  - MYSET-MASTER-OVERVIEW.md §6.2 (what it costs to run — credits, deploys are the cost), §6.1 (deploying), §9.5 (`credit-burn.sh`)
  - AGENTS.md § Deploying (never also `netlify deploy --prod`), § Safety (only `public/` is published)
  - INVARIANTS.md 9d3 (pushing is deploying)
  - IMPLEMENTATION_STATUS.md PER-002 (stop the double deploy; Personal vs Pro)
  - finance/README.md (the bandwidth counter resets on the billing-period start)
  - docs/sessions/2026-09-11-clips-to-r2.md, 2026-09-11-open-line-probe.md § DNS (nameservers at Netlify, registrar Porkbun)
  - docs/decisions/0045 (main is protected; merging is the deploy), 0046 (the datastore copy)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — names, statuses, connections match)
verified: not yet — the founder's browser check of the tab is outstanding; code read 2026-09-12 for mapconfig.mjs, moneymodel.mjs, _connect.mjs, _billing.mjs
---

# The Netlify account

**Who:** the founder, as the account holder — the site `mysetvip`, its bill, its variables, its DNS. **Trigger:** the monthly bill, a variable to change, a domain to renew, or a session that needs the CLI. **Outcome:** the one account that *is* MySet in production is understood as a bill, a set of doors and a name, and no credit is spent twice for the same change. Everything a session does against this account is read-only except a merge (which deploys) and a variable paste (which the founder does).

Mostly `Live` — these are the things the founder already does or the rules already in force; `Draft` where a decision is still owed.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| e01 | Know what the account holds | task | Person | Founder R | Netlify | One site, `mysetvip`, serving myset.vip: the pages under `public/` (**only** `public/` is published — publishing the repo root once exposed docs and backups on the live domain), the functions under `netlify/functions/`, the Blobs store `myset` (the only datastore — copied by decision 0046, → *Reliability & security → Backup and restore* b03), the environment variables (every secret MySet has, → *Secrets and keys* j01), and the DNS zone for the name. Other sites on the same account share the bandwidth counter. `src: AGENTS.md § Safety; overview §5.2; finance/README.md` |
| e02 | Read the bill in credits | research | Person | Founder R | Netlify | Netlify bills in credits — per web request, per GB of bandwidth, per GB-hour of compute, and **per production deploy** (the rates are overview §6.2). Measured over three weeks, deploys were almost the whole bill and traffic a rounding error: a gig costs cents. **Never re-derive cost from response times** — that has been got wrong three times. `./credit-burn.sh` shows what is eating the period, split by trigger (→ *Watching production* u04). `src: overview §6.2, §9.5` |
| e03 | Never pay twice for one change | task | Person | Founder R · Coding agent I | Netlify | Roughly half the credits burned were the same commit deployed twice — the GitHub build a push triggers *and* a CLI `netlify deploy --prod` for the same change. Since decision 0045, merging the PR **is** the deploy and nothing else is run (INVARIANT 9d3). Doc-only merges carry `[skip ci]` so no build is billed. `src: AGENTS.md § Deploying; PER-002; INVARIANT 9d3` |
| e04 | Personal or Pro? | conditional | Person | Founder R | Netlify | **Draft — PER-002, a decision owed.** Once the double deploy is gone, read a full billing period of honest credits and decide: stay on the current plan, or move to Pro if the honest monthly number needs it. The money model's server line (→ *The money model* z01) is what the number is compared against. *stays* → nothing to do; *Pro* → change the plan in the dashboard and record a decision. `src: PER-002; overview §6.2` |
| e05 | Read the counters inside one billing period | task | Person | Founder R | Netlify | The account-wide bandwidth counter resets on the billing-period start; a mark taken before and a mark after the reset cannot be compared and `tools/actuals.py` says so. When reading the bill or taking bandwidth marks, know where the period boundary is. `src: finance/README.md` |
| e06 | Change a variable | alias | Person | Founder R | Netlify | → *Reliability & security → Secrets and keys* j04 (paste a new secret), j02 (a masked variable returns a placeholder through the API — correct behaviour, has caused one false diagnosis), j05 (rotate). A changed variable takes effect on the next deploy, which after 0045 means a merge — an empty commit through a PR if nothing else is going out. `src: sheet j04; HARDENING.md §1 step 6` |
| e07 | Keep the CLI signed in and the folder linked | task | Person | Founder R · Coding agent I | Netlify | `tools/prod.py`, `tools/backup.py` and `tools/actuals.py` all read production through the signed-in Netlify CLI as the site owner — read-only, no secret typed. If a session reports *"is the Netlify CLI signed in and the folder linked?"*, the founder runs `netlify login` and `netlify link` once; an agent never does. `src: tools/backup.py keys(); finance/README.md` |
| e08 | Hold the DNS | task | Person | Founder R | Netlify | `myset.vip`'s nameservers are Netlify DNS (NS1); the registrar is Porkbun. Consequence already met once: a Cloudflare custom domain on the R2 bucket needs the zone on Cloudflare, so it is not available without moving a live site's DNS — the clips answer through a presigned link instead (decision 0033). Records that must stay: the site's A/ALIAS, the Resend DKIM record (→ *Mail, maps and the name* d01). Moving the zone is a decision with a record, never a quick change. `src: docs/sessions/2026-09-11-clips-to-r2.md; 2026-09-11-open-line-probe.md § DNS` |
| e09 | Renew the name | delay | Person | Founder R | — | **Draft — not checked this side.** The domain is on a yearly renewal at the registrar; the cost is one of the six hand-typed cost kinds in the books (→ *Money → The books* k08, kind *domain*). Auto-renew on, a card that will not expire first, the registrar login behind 2FA (→ *The founder's own accounts* y01 — the registrar is a fifth account the threat model does not list). `src: docs/sessions/2026-09-05-money-model.md (cost lines); ACCOUNTING.md § Costs` |
| e10 | Look at a deploy before trusting it | task | Person | Founder R · Coding agent R | Netlify | The deploys page lists every build with its trigger and commit; a PR gets a deploy preview at its own URL. **Verify by content, never by status code** — a catch-all slug redirect answers 200 for files that do not exist. A rollback is "publish" on an older deploy in the same list — rare, and the functions and the store are not versioned with the pages, so a rollback is a page-level fix, never a data one. `src: AGENTS.md § Deploying; overview §6.1` |

## Connections

e01 → e02 → e03 → e04; e02 → e05; e01 → e06; e01 → e07; e01 → e08 → e09; e03 → e10; e04 —Pro→ *decision record*.
