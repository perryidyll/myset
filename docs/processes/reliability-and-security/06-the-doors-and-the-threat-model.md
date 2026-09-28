---
tab: Reliability & security
section: The doors and the threat model
puzzle_section_id: 41998
sources:
  - netlify.toml [[headers]] (CSP, nosniff, HSTS, Permissions-Policy, COOP, security.txt)
  - SECURITY.md § You cannot hide the code, § What is already true, § The one honest weakness in the new CSP, § The threat model
  - netlify/functions/_lib.mjs (takeCastToken), _auth.mjs (codes: HMAC, expiry, guesses, constant-time), _session.mjs (CAN, rev), _verify.mjs (fetchPage), _lib.mjs (/api/img patterns)
  - test/tenancy.mjs, test/passkeys.mjs, test/errlog.mjs
  - INVARIANTS.md 0bu, 0bk, 9h, 9i, 15k, 0fa, 0ae, 1
  - docs/decisions/0030
  - IMPLEMENTATION_STATUS.md P3-012, P3-011 (cancelled), GATE-003
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections and list_steps)
verified: netlify.toml headers read 2026-09-12; the rate-limit and tenancy rows confirmed against the ledger's evidence column
---

# The doors and the threat model

**Who:** every stranger with a phone; the server. **Trigger:** any request at all. **Outcome:** the front end is assumed public and that is fine — every limit lives in the server inside the write that changes the data; the doors that could be oracles answer identically; a request can reach nothing but itself. Ranked by what would actually happen to MySet, not by what sounds frightening.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| h01 | Assume the front end is public | conditional | Automation | MySet server R | Netlify | Pages are HTML and JavaScript on a stranger's phone; minifying buys nothing. So: no key, token or private URL anywhere in `public/` (checked); every limit enforced server-side inside the same compare-and-set write (INVARIANT 15k — the suite has cases that defeat the page and confirm the server refuses); `netlify/functions/` is not published (INVARIANT 10). `src: SECURITY.md § You cannot hide the code` |
| h02 | Send the headers | task | Automation | MySet server R | Netlify | `netlify.toml`: CSP `default-src 'self'` with a short allow-list; `X-Content-Type-Options: nosniff` (a stored upload that sniffs as HTML must never come back as HTML); HSTS a year, subdomains, preload (bar Wi-Fi is exactly the network where it matters); `Permissions-Policy` denying camera, microphone, location, payment, USB; `Cross-Origin-Opener-Policy`; `X-Frame-Options: SAMEORIGIN`. Verified against all seven pages in a real browser on 2026-09-05: zero violations. `src: netlify.toml [[headers]]; SECURITY.md § What changed today` |
| h03 | Live with `'unsafe-inline'` honestly | task | Automation | MySet server R · Founder I | Netlify | `script-src` still allows inline, because every page is one file with its script inline and `onclick` wiring — a deliberate architecture (one request, no build step). Said plainly: **the policy does not stop an injected inline script.** What it stops is that script loading or sending anything — `connect-src 'self'` means a stolen token has nowhere to go. Per-script hashes are Tier 1, **Draft**. `src: SECURITY.md § The one honest weakness` |
| h04 | Publish security.txt | document | Automation | MySet server R | Netlify | `/.well-known/security.txt` (RFC 9116) — a published address for reporting a problem; the difference between a finder emailing and a finder posting. `src: netlify.toml; public/.well-known/security.txt` |
| h05 | Answer the doors identically | conditional | Automation | MySet server R · Artist I | Netlify | Sign-in codes: HMAC-stored, short-lived, burned on use, a capped number of guesses and sends, constant-time compare (the figures are INVARIANT 9i's); unknown page, locked page and wrong code answer the **same**, so none is an account-enumeration oracle (9h). Tokens are HMAC-signed with a session id, a per-account `rev` and a per-session kill list — *sign out everywhere* is real. Roles are default-deny (`CAN`; anything unnamed is owner-only). → *Artist lifecycle → Signing up and signing in*, *Sessions, roles and the team*. `src: _auth.mjs; _session.mjs; SECURITY.md § What is already true` |
| h06 | Refuse the script, not the room | conditional | Automation | MySet server R · Fan I | Netlify | The cast token bucket on the fan record: a burst in a row, then a steady number a minute (the figures are in §2.1), checked inside the write that already happens, a refused cast writes nothing, 429 in plain words. Chosen over per-IP (the whole bar shares one address; mobile data rotates) and over a per-show counter (the hot document INVARIANT 1 exists to avoid). **No edge rate limit exists** — a script can still make many *valid* requests and cost money; Netlify traffic rules are Tier 1, **Draft**. → *The gig → The room under load*. `src: _lib.mjs takeCastToken; decision 0030; INVARIANT 0fa; SECURITY.md threat #3` |
| h07 | Keep one artist out of another's data | conditional | Automation | MySet server R | Netlify | `test/tenancy.mjs` — assertions whose only job is to prove one artist cannot read, write or bill another, mutation-tested, on every run. Every Stripe call carries the connected account explicitly and the test double **fails** a call in the wrong scope. Prices come from the stored record, never the request. `src: test/tenancy.mjs; SECURITY.md § What is already true; INVARIANT 5d` |
| h08 | Hold nothing worth stealing | task | Automation | MySet server R · Fan I | Netlify | Fans are counted, never named — no fan database to breach (INVARIANT 0bu; a device id never leaves the server). ID-check photos are excluded from every pattern `/api/img` serves (0bk) — unservable by anyone, including us; **encrypting them at the application level is Tier 1, Draft**. Card details never touched — Stripe Checkout only. Recovery codes and Studio codes hashed; passkeys store the public half only. `src: SECURITY.md § What is worth encrypting; INVARIANTS 0bu, 0bk` |
| h09 | Fetch a stranger's URL safely | alias | Automation | MySet server R | Netlify | The one outbound request to a URL somebody typed — `fetchPage` in `_verify.mjs`: https only, resolved address refused if private/loopback/link-local/metadata, manual redirects each re-checked, timeout, size cap, `text/html` only; verified against thirteen targets including the cloud metadata address. → *Venue lifecycle → Getting verified* y04. `src: _verify.mjs fetchPage` |
| h10 | Rank the threats, and spend in that order | document | Person | Founder R · Coding agent C | — | 1 — the founder's own accounts phished (→ *The founder's own accounts*); 2 — a malicious or careless artist (tenancy, role gates, the owner can hide anything; **gap: no platform-wide moderation queue** — removal is by the founder's hand, Tier 2); 3 — somebody bored in a bar poking the API (h06); 4 — a compromised dependency (y06); 5 — everything else is theatre before the four above. Tier 2 when venues start asking: SOC 2 groundwork, an incident-response plan, a real staging site, one external pen test, structured logging, a DPA. `src: SECURITY.md § The threat model, § The gap in three tiers` |

## Connections

h01 → h02 → h03; h02 → h04; h01 → h05 → h07 → h08; h05 → h06; h09 aliases *Venue lifecycle → Getting verified* y04; h10 → *The founder's own accounts* y01.
