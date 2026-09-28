---
tab: Admin & finance
section: Mail, maps and the name
puzzle_section_id: 42013
sources:
  - IMPLEMENTATION_STATUS.md PER-004 (`AUTH_FROM`, done — set 2026-09-10), open risks (Google Maps key — resolved 2026-09-12)
  - MYSET-MASTER-OVERVIEW.md §6.3 (what is set in production), §8 known gaps (push alerts cannot send; sign-in mail comes from `hello@myset.vip`)
  - netlify/functions/mapconfig.mjs (the browser key is public by design; must be restricted to the Static API and the site's referrer; the button hides until it is set)
  - HARDENING.md §3 (trademark; privacy policy and terms)
  - docs/sessions/2026-09-05-money-model.md (Resend's free tier and the domain cost as cost lines), 2026-09-10-live-lyrics-links-and-speed.md (DKIM present; its "`AUTH_FROM` absent" was the CLI's `env:list` hiccup, not the variable — PER-004)
  - docs/processes/reliability-and-security/03-secrets-and-keys.md j08 (push keys), 04-the-founders-own-accounts.md y07 (own the name)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections — names, statuses, connections match); 2026-09-28 (update_workflow on d01 — step 370272, now `Live` — on d02 — step 370273, this sheet brought up to Puzzle's `Live` — and on the section's notes; read back through list_steps and list_sections)
verified: not yet — the founder's browser check of the tab is outstanding; code read 2026-09-12 for mapconfig.mjs, moneymodel.mjs, _connect.mjs, _billing.mjs; d01/d02 2026-09-28 against the ledger's PER-004 row and `dig @8.8.8.8` (Resend's DKIM at resend._domainkey.myset.vip; SPF and MX on send.myset.vip)
---

# Mail, maps and the name

**Who:** the founder, holding the third-party accounts that are not Netlify or Stripe — Resend, Google Cloud, the registrar, and one day a trademark office. **Trigger:** a stranger cannot sign in because no mail can be sent; a map button is missing; a key needs restricting; the name needs protecting. **Outcome:** every outside service MySet leans on is configured by the one person who can, and the product's honest gaps (overview §8) close one by one.

`Live` where the configuration is done and read back; `Draft` where it is still on the founder's list.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| d01 | Verify the domain in Resend | task | Person | Founder R | Resend | **Live.** `RESEND_API_KEY` is in Netlify, and the zone carries Resend's records (→ *The Netlify account* e08): DKIM at `resend._domainkey.myset.vip`, SPF and MX on `send.myset.vip` — read 2026-09-28 through a public resolver. Resend sends only from a verified domain, and a real sign-in code from `hello@myset.vip` reached the founder on 2026-09-15 (d02). Should Resend ever show the domain unverified, the records it lists go into Netlify DNS. Nothing in code changes. `src: PER-004; docs/sessions/2026-09-10-live-lyrics-links-and-speed.md` |
| d02 | Set `AUTH_FROM` | task | Person | Founder R · Artist I | Netlify | **Live — PER-004.** `AUTH_FROM` is `MySet <hello@myset.vip>` in Netlify's production context (set 2026-09-10) and `myset.vip` carries the Resend DKIM and SPF records. Confirmed by the founder 2026-09-15: a real sign-in code arrived from that address on the founder's phone. `src: PER-004; overview §6.3, §8; docs/processes/onboarding/01` |
| d03 | Watch the mail quota | task | Person | Founder R | Resend | Resend's free tier has a daily and a monthly ceiling before the paid plan (the figures are in the money-model session, a cost line, not overview §2.1). Sign-in codes, gig-day reminders (→ *Marketing → Founding 50* f06, unbuilt) and a mailing list (n10, unbuilt) would all draw on it. When the ceiling is near, the plan changes in Resend and the cost goes into the books (→ *Money → The books* k08, kind *email*). `src: docs/sessions/2026-09-05-money-model.md` |
| d04 | Restrict the Maps browser key | task | Person | Founder R | — | The key in `GOOGLE_MAPS_BROWSER_KEY` is **public by design** — a browser key is a credential for quota, not a secret — so it must be restricted in Google Cloud to Maps Static API requests referred by `https://myset.vip/*` (plus the deploy-preview pattern while testing). `mapconfig.mjs` keeps it out of the HTML so the map button disappears honestly until the variable is set. Restricted 2026-09-12 (ledger open risk resolved). `src: netlify/functions/mapconfig.mjs; ledger open risks` |
| d05 | Confirm Maps billing is attached | conditional | Person | Founder R | — | **Draft — unchecked.** Google serves a key only when its project has a billing account with a card on file; Maps is free well past MySet's volume, but without billing the key answers errors. Console → the MySet project → Billing. *linked* → nothing. *not linked* → link one; the button on artist pages starts working at once. `src: run sheet item 14; Payments session cost table` |
| d06 | Mint the push keys | alias | Person | Founder R | Netlify | → *Secrets and keys* j08. `VAPID_*` are unset, so push alerts cannot send (overview §8) — a pair the founder mints locally and pastes, never an agent. `src: sheet j08; overview §8` |
| d07 | Own the name | alias | Person | Founder R | — | → *The founder's own accounts* y07. Trademark "MySet": features are copyable and a name is not; Thailand-plus-international is not a DIY situation — someone who does it for a living. `src: HARDENING.md §3; sheet y07` |
| d08 | Publish a privacy policy and terms | document | Person | Founder R · Fan I · Artist I | — | **Draft — none exists.** MySet takes money and stores device identifiers; a policy is owed. Terms that prohibit scraping also give a contract claim, faster and cheaper than an IP suit. What the policy can truthfully say is already in SECURITY.md (no fan account, no card data, a device id the fan can clear, ID-check photos held for verification). `src: HARDENING.md §3; SECURITY.md § What is worth encrypting` |
| d09 | Set the money model's passcode | task | Person | Founder R | Netlify | **Draft.** `myset.vip/moneymodel` is behind a four-digit courtesy lock (INVARIANT 0ec); `FINMODEL_CODE` overrides a default that sits in the code — and the repository is **public** (decision 0047), so the default is public too. Set `FINMODEL_CODE` in Netlify (→ j04) so the lock is a lock. Two minutes. `src: netlify/functions/moneymodel.mjs; INVARIANTS.md 0ec; decision 0047` |

## Connections

d01 → d02 → d03; d04 → d05; d06, d07, d08, d09 are standing items on the founder's list; d02 → *Onboarding a stranger* (go_to; the gate, open since PER-004).
