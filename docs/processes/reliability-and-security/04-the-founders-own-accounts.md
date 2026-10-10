---
tab: Reliability & security
section: The founder's own accounts
puzzle_section_id: 41996
sources:
  - SECURITY.md § The threat model (#1), Tier 1 (2FA, dependencies), § The short version
  - HARDENING.md §2 (GitHub), §3
  - IMPLEMENTATION_STATUS.md PER-003, the open-risk row on the founder's accounts being phished
  - package.json (two dependencies), AGENTS.md § Where you may work (no dependencies)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections and list_steps); 2026-10-03 (update_workflow on y02, step 370102; changelog 2702 for decision 0144); 2026-10-10 (update_workflow on y07, step 370107: GitHub Pro first, then private — decision 0047's addendum, PER-022)
verified: documents read 2026-09-12; y02 read back through `gh api repos/perryidyll/myset/rules/branches/main` the same day; the rest is done in a browser by the founder; y02 read back 2026-10-03 through `gh api repos/perryidyll/myset/rulesets/23031933` for decision 0144 — rules: deletion, non-fast-forward, pull request; no required status check yet
---

# The founder's own accounts

**Who:** the founder, alone — no agent can do any of this, and no line of MySet's code is involved. **Trigger:** now; then whenever a device, a token or a collaborator changes. **Outcome:** the ranked #1 threat closed: Google, GitHub, Netlify and Stripe between them can do everything an attacker could want, and the softest target in the system is the person holding all four. Twenty minutes, per `SECURITY.md`; still **not started** (PER-003).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| y01 | Turn on 2FA on the four accounts | task | Person | Founder R | — | Google, GitHub, Netlify, Stripe — hardware key or passkey, not SMS. *"A SOC 2 report on a system whose owner does not have 2FA is a document about nothing."* **Draft until done** — PER-003, ledger open risk **active, unmitigated**. `src: SECURITY.md § The threat model #1, Tier 1; ledger PER-003` |
| y02 | Protect `main` | task | AI Agent | Coding agent R · Founder A | GitHub | **Done 2026-09-12** (decision 0045, delegated by the founder): GitHub ruleset 23031933 on the default branch — pull request required with zero approvals, force-pushes and deletion blocked, no bypass for anyone. Work goes on a branch, gets a free deploy preview on the PR, and merging is the deploy (→ *Engineering OS → Committing and deploying* d04–d05). Not required: an approval (there is nobody to give one). **A status check now exists and is not yet required** (decision 0144): every pull request runs the suite as the check `suite` (→ *Engineering OS → Committing and deploying* d08), and the ruleset gains "require status check `suite`" as a second step, once the workflow has proved itself on real pull requests — so a fault in the workflow itself cannot lock `main`. The old objection, that a `[skip ci]` doc PR would never be mergeable, is answered by moving the marker to the merge subject (d05). Found on the way: the repository is **public**, not private as HARDENING.md believed — ledger open risk, the founder's call. `src: decisions 0045, 0144; HARDENING.md §2` |
| y03 | Turn on secret scanning and push protection | task | Person | Founder R | GitHub | Settings → Code security. Push protection blocks a commit containing a key **before** it reaches GitHub; Netlify's scanner has already caught one secret in this repo, this catches it a step earlier. `src: HARDENING.md §2` |
| y04 | Review who and what has access | task | Person | Founder R | GitHub | Settings → Applications, and Developer settings → Personal access tokens: revoke anything unrecognised. The same review on Netlify (team members, deploy keys) and Stripe (team, restricted keys — → *Secrets and keys* j06). `src: HARDENING.md §2` |
| y05 | Sign an IP assignment before anyone else writes a line | document | Person | Founder R | — | Without one a collaborator may legally own what they wrote — the most commonly skipped step and the most expensive to fix afterwards. Also what gives *trade secret* any legal meaning: you cannot claim you kept something secret if nothing kept it. `src: HARDENING.md §2` |
| y06 | Pin the two dependencies | task | AI Agent | Coding agent R · Founder A | GitHub | **Draft.** `@netlify/blobs` and `stripe` are on `^` ranges, so an update can arrive without a commit — the supply-chain path into the sign-in and money code. Exact versions, Dependabot opening the PR, `sh test/run.sh` as the gate. Threat #4; the rule that there are exactly two dependencies stays. `src: SECURITY.md § The threat model #4, Tier 1; AGENTS.md "Do not add dependencies"` |
| y07 | Own the name | task | Person | Founder R | — | (The repository is public on GitHub as of 2026-09-12 — decide whether that stays before leaning on "trade secret". 2026-10-10: the founder wants it private — GitHub Pro first, then private, or the ruleset in y02 stops being enforced: PER-022, decision 0047's addendum.) Trademark *MySet* — features are copyable and a name is not; Thailand-plus-international is not a DIY situation. A privacy policy and terms (legally required where MySet sells; neither exists) — a ToS that prohibits scraping is also a contract claim, faster than an IP suit. `fingerprint-check.sh` turns a copycat suspicion into something specific enough for a lawyer. `src: HARDENING.md §3; SECURITY.md Tier 1; fingerprint-check.sh` |

## Connections

y01 → y02 → y03 → y04; y04 → y05; y06 —Draft, agent work→ *Engineering OS → Making a change* c01; y07 stands alone.
