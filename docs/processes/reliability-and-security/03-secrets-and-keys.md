---
tab: Reliability & security
section: Secrets and keys
puzzle_section_id: 41995
sources:
  - MYSET-MASTER-OVERVIEW.md §6.3 (the names, which are set in production and when that was read, the placeholder rule), §6.1
  - INVARIANTS.md 10, 11, 11b, 12, 15d
  - HARDENING.md §1 (restricted Stripe key), §3 (rotate anything ever pasted)
  - netlify/functions/_lib.mjs 25–45 (previews cannot charge), webhook.mjs 10–16, vapid-keys.sh
  - ACCOUNTS.md §5 (5), IMPLEMENTATION_STATUS.md PER-007, PER-008, verification log 2026-09-08
  - SECURITY.md Tier 1 (a secret-rotation runbook)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections and list_steps); 2026-09-28 (update_workflow on j01, step 370092 — `AUTH_FROM` is set, PER-004; the counts now cited from overview §6.3, not copied — and on the section's notes; read back through list_steps and list_sections)
verified: code read 2026-09-12 (_lib.mjs preview note; webhook.mjs secret check); the dashboard read-back of the MySet destination the same day
---

# Secrets and keys

**Who:** the founder — only the founder ever holds a value. **Trigger:** a secret is created, replaced, leaked or suspected. **Outcome:** every secret lives in Netlify's environment and nowhere else; an agent names the variable and never the value; a rotated key is verified live and the old one revoked. **The one thing this section does not have is a written answer to "the key leaked — what happens in the next ten minutes".**

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| j01 | Know where every secret lives | document | Person | Founder R · Coding agent I | Netlify | Every name is in overview §6.3, with which are set in production and when that was read — `AUTH_FROM` among them since 2026-09-10 (PER-004). Anything unset **degrades honestly** — push says it cannot send, the Sheet is off, Spotify answers 503, and sign-in refuses to claim success if `AUTH_FROM` stops naming a verified sender. Never in the repo (INVARIANT 11 — writing one into a doc broke the build, correctly), never in `public/` (12), never in a chat window, **including one an agent generated itself** (11b — the VAPID keypair printed to a terminal on 2026-09-02 is why `vapid-keys.sh` exists). `src: overview §6.3; INVARIANTS 11, 11b, 12; ledger PER-004` |
| j02 | Read a masked variable correctly | task | AI Agent | Coding agent R | Netlify | A Netlify variable marked secret returns a **placeholder** through the API and the CLI, not the value. That is correct behaviour and it has already caused one false diagnosis — a masked `ADMIN_CODE` sent to the admin door, refused, reported as *"the recovery key is broken"*. **Do not repeat that conclusion.** `src: overview §6.3; tools/prod.py header` |
| j03 | Keep previews unable to charge | task | Automation | MySet server R | Netlify | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are **unset for the deploy-preview and branch-deploy contexts**, so a preview reports `paymentsEnabled:false` and cannot charge a card (INVARIANT 9) — confirmed by curl on a draft while production stayed live. A preview still **reads and writes production data**; use one to look at pages, never to exercise a write path. `src: _lib.mjs 25–45; AGENTS.md § Safety` |
| j04 | Paste a new secret into Netlify | task | Person | Founder R | Netlify | Netlify → the site → *Project configuration* → *Environment variables* → *Add a variable* (or open the existing one → *Edit*): key exactly as the code reads it, value pasted once, **Contains secret values** ticked, scope *All* (functions need it), contexts *Production* only for anything that can charge a card (j03). A function only sees a new or changed variable on the **next deploy** — so the code that reads it goes up after the paste, and pushing is the deploy (INVARIANT 9d3). `src: HARDENING.md §1 step 5–6; overview §6.1` |
| j05 | Rotate a key | task | Person | Founder R · Coding agent C | Stripe | The order that makes a rotation real: create the new key → paste it (j04) → redeploy (`git commit --allow-empty -m "Redeploy: …" && git push`) → **verify live** (`POST /api/pay` returning a `cs_live_` session — how PER-007 was checked on 2026-09-08) → **revoke the old key**. *A rotated key that is still live is not rotated.* Anything ever pasted anywhere gets rotated: the Studio passcode can be changed from Settings inside the Studio (INVARIANT 15d), no terminal needed. `src: HARDENING.md §1, §3; ledger PER-007` |
| j06 | Hold a restricted Stripe key, not a full one | conditional | Person | Founder R | Stripe | MySet makes exactly three Stripe API calls and all three are Checkout Sessions (`create`, `retrieve`, `list`); signature verification is local maths. So the key needs **one** permission: everything *None*, Checkout Sessions *Write*. Type *"Powering an integration you built"*, never the agent key type. `STRIPE_SECRET_KEY` was replaced on 2026-09-08 (PER-007); **whether the replacement is restricted is not recorded** — read it off the Stripe API keys page (`rk_live_` vs `sk_live_`). `src: HARDENING.md §1` |
| j07 | Add the Connected-accounts webhook secret | task | Person | Founder R · Coding agent C | Stripe | **Draft — PER-008.** The MySet destination listens to *Your account* only; a second destination for *Connected accounts* has its own `whsec_`. Three parts in order: the destination (dashboard), `STRIPE_CONNECT_WEBHOOK_SECRET` pasted (j04), then `webhook.mjs` trying the second secret behind a decision record — the paste goes first so the deploy that carries the code already sees it. Until then a connected-account event 400s on signature and Stripe retries; there are no connected accounts today, so nothing arrives. → *Money → Stripe events arriving*. `src: ACCOUNTS.md §5 (5); ledger PER-008` |
| j08 | Mint the push keys yourself | task | Person | Founder R | Netlify | `./vapid-keys.sh` mints the pair; `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` go into Netlify (j04). **Done 2026-09-15**: generated and set in production by an agent, the private key never printed (ledger PER-004); the three names read back with `netlify env:list --context production` on 2026-09-28. Without them push alerts say honestly that they cannot send. `src: vapid-keys.sh; INVARIANT 11b; overview §5.8` |
| j09 | The ten-minutes-after-a-leak runbook | document | Person | Founder R · Coding agent C | — | **Draft — does not exist.** One page: which key, where it is revoked (Stripe API keys / Stripe destination signing secret / Netlify site settings for `ADMIN_CODE` / Resend API keys), the paste, the redeploy, the live check, who is told. Today the answer is assembled from j05 under pressure. SECURITY.md Tier 1. `src: SECURITY.md Tier 1 "A secret-rotation runbook"` |

## Connections

j01 → j02; j01 → j03; j05 —new value→ j04 → *push = deploy* (→ *Engineering OS → Committing and deploying* d01); j05 → j06; j07 → j04; j08 → j04; j05 —Draft→ j09.
