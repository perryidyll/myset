# Security — where MySet actually stands, and the road to a grown-up posture

Written 2026-09-05, answering Perry's question: *"i'd really really like to make sure
the code of this app is as secure as possible. what elements can we hide or encrypt?
what's the gap between us and a full blown $100m saas company app, and how can we
bridge it?"*

Nothing in here is aspirational unless it says so. Everything under "what is already
true" was checked against the code or the live site on the day this was written.

---

## First, the uncomfortable part: you cannot hide the code

MySet's pages are HTML and JavaScript delivered to a stranger's phone. Anyone can
read them — View Source, or the browser's own dev tools. Minifying or obfuscating
buys **nothing**: it makes the file smaller and slightly less pleasant to read, and
anyone who cares runs it through a formatter and carries on. Treating that as a
security control is how real secrets end up in front-end code, because it feels
protected when it is not.

So the rule is the opposite of hiding: **assume every line of the front end is
public, and make sure that is fine.** It is:

- Checked today — no key, token, webhook secret or private URL anywhere in
  `public/`. Every secret lives in a Netlify environment variable and is only ever
  read inside a function.
- Every limit that matters is enforced on the **server**, inside the same
  compare-and-set write that changes the data — not in the page. A person editing
  the JavaScript in their own browser can change what their screen looks like and
  nothing else. That is `INVARIANT 15k`, and the test suite has cases that defeat
  the page and confirm the server still refuses.
- The genuinely private half of the system — `netlify/functions/` — is **not
  published**. `netlify.toml` publishes `public/` only, so the docs, the backups,
  the design handoff and the function source are never served.

What *should* be hidden is a much shorter list than people expect, and it is
already hidden.

---

## What is already true (and would surprise a security reviewer)

| | |
|---|---|
| **Tenant isolation** | `test/tenancy.mjs` — 46 assertions whose only job is to prove one artist cannot read, write or bill another. It runs on every `npm test`. Most startups do not have this. |
| **Money is never re-derived** | Stripe is the source of truth (`INVARIANT 5d`). Prices come from the stored record, never the request — a hand-made checkout cannot set its own price. |
| **Direct charges are scoped** | Every Stripe call carries the connected account explicitly, and the test double *fails* a call made in the wrong scope. That is the bug class that leaks one artist's money into another's dashboard. |
| **Tokens are revocable** | HMAC-signed, 30 days, carrying a session id. A per-account `rev` counter and a per-session kill list mean "sign out everywhere" is real, and costs no extra read. |
| **Roles are default-deny** | `CAN` in `_session.mjs`, and both admin surfaces gate on an allow-list — anything not named is owner-only, so a new action is locked until somebody decides it should not be. |
| **Fans are counted, never named** | `INVARIANT 0bu`. The audience never signs in, a device id never leaves the server, and no export or payload contains one. There is no fan database to breach. |
| **ID photos are unservable** | The `idcheck` slot is deliberately excluded from every pattern `/api/img` will serve (`0bk`), so a verification photo cannot be fetched by anyone, including us, through the web. |
| **Recovery codes are hashed** | HMAC with the app secret, single-use, shown exactly once. |
| **Rate limits on the doors** | Sign-in codes lock out after repeated failures; unknown pages, locked pages and wrong codes all answer *identically*, so none of them is an account-enumeration oracle (`INVARIANT 9h`). |
| **No `list()`** | Blobs are never enumerated (`INVARIANT 1`). A side effect is that a compromised read cannot walk the whole store. |

---

## What changed today

1. **A real Content Security Policy.** It was `frame-src` and `object-src` only —
   which meant an injected `<script src="//somewhere-else">` would have run. It is
   now `default-src 'self'` with a short, deliberate allow-list. Verified against
   all seven pages in a real browser: zero violations.
2. **`X-Content-Type-Options: nosniff`.** Without it, a stored upload that happens
   to sniff as HTML can be served back from our own origin as HTML. That is
   cross-site scripting no amount of escaping in the pages can close.
3. **HSTS with `includeSubDomains; preload`.** A phone that has never visited
   myset.vip now still refuses to talk to it over plain HTTP. Bar wifi is exactly
   the network where that matters.
4. **`Permissions-Policy`** denying camera, microphone, location, payment and USB —
   nothing here needs them, so nothing here may ask.
5. **`Cross-Origin-Opener-Policy`**, so a page we open cannot reach back through
   `window.opener`.
6. **Zero dependency vulnerabilities**, from one moderate (`qs`, via Stripe).
7. **Passkeys**, verified end to end by a test that acts as a real authenticator —
   including the five checks that make WebAuthn worth having, each defeated on
   purpose to prove the check fires.
8. **`/.well-known/security.txt`** — a published address for reporting a problem.
   The cheapest security control that exists: it is the difference between a
   finder emailing you and a finder posting it.

### The one honest weakness in the new CSP

`script-src` still allows `'unsafe-inline'`, because every page is a single file
with its script inline and its buttons wired with `onclick`. That is a deliberate
architecture (one request, no build step) and not something to undo for a header.

Say plainly what it costs: **the policy does not stop an injected inline script.**
What it does stop is that script *loading* anything or *sending* anything anywhere
— `connect-src 'self'` means a stolen token has nowhere to go, which removes most
of the value of the injection. Moving to per-script hashes is Tier 1 below.

---

## The threat model, honestly

Ranked by what would actually happen to MySet, not by what sounds frightening.

**1. Perry's own accounts get phished.** By a wide margin the most likely breach.
Google, GitHub, Netlify and Stripe between them can do everything an attacker could
want, and none of it involves a single line of MySet's code. **Defence:** hardware
or passkey 2FA on all four, today. This is the highest-value item in this whole
document and it takes twenty minutes.

**2. A malicious or careless artist.** Somebody signs up, uploads something illegal
to a community page, or tries to reach another artist's data. Covered by
`tenancy.mjs`, the role gates, and the fact that a report is a count and the owner
can hide anything. Gap: there is no platform-wide moderation queue — if an artist
posts something MySet must remove, the only lever is Perry deleting it by hand.

**3. Somebody bored in a bar poking the API.** They have the same access the page
has, which is why every limit is server-side. Gap: there is no edge rate limit, so
a script can make a lot of *valid* requests and cost money. See Tier 1.

**4. A compromised dependency.** Two runtime dependencies (`@netlify/blobs`,
`stripe`). Small surface, but `^` ranges mean an update can arrive without a commit.
See Tier 1.

**5. Everything else** — nation states, targeted zero-days, insider threat. Not the
risk profile of a setlist app. Spending here before the four above is theatre.

---

## The gap to a $100M SaaS, in three tiers

The gap is **not** the code. It is process, evidence and operations — the things a
company buys with headcount. Almost everything below is paperwork and habits.

### Tier 1 — weeks, cheap, do these before the beta

| | Why |
|---|---|
| **Hardware/passkey 2FA on Google, GitHub, Netlify, Stripe** | The single most likely breach, closed in twenty minutes. |
| **Stripe restricted keys** | The live key can do everything. Cron and read-only paths should hold keys that can only do what they need. |
| **A secret-rotation runbook** | Right now there is no written answer to "the key leaked, what do I do in the next ten minutes". One page. |
| **Pin dependencies + Dependabot** | Exact versions, a bot that opens the PR, `npm test` as the gate. |
| **Edge rate limiting** | Netlify has traffic rules. A per-IP ceiling on `/api/*` bounds both abuse and the bill. |
| **A backup you have actually restored** | Blobs are the only datastore. Nobody has ever tested a restore. An untested backup is a rumour. |
| **Error and alert monitoring** | Today a failure is a line in a log nobody reads. Sentry's free tier, or Netlify's own alerts, plus one alert on a spike in 5xx. |
| **CSP script hashes** | Removes `'unsafe-inline'`. A build step that hashes each inline block, or moving the scripts to files. |
| **Application-level encryption of ID photos** | Blobs are encrypted at rest by Netlify, but the ID photos are the most sensitive bytes in the system. Encrypting them with a key only the verification path holds means a storage compromise does not hand over passports. |
| **A privacy policy and a data-retention rule** | You collect email addresses and sell things. Both are legally required in most of the markets you would sell into, and neither exists. |

### Tier 2 — months, matters when venues start asking

| | Why |
|---|---|
| **SOC 2 Type I groundwork** | The first bar-chain or festival with a procurement process will ask. Vanta/Drata-style tooling plus a few written policies gets most of the way. |
| **A written incident-response plan** | Who is told, in what order, within what time. Half a day to write, and it is what turns an incident into a story with an ending. |
| **A real staging environment** | `main` is production. Preview deploys exist but nothing runs against a production-shaped dataset. |
| **One external penetration test** | A few thousand dollars. Finds the things you cannot find by reading your own code. |
| **Structured logging with retention** | Today's audit log is 100 entries per account. A real one is append-only, off-platform, and survives a deleted account. |
| **A moderation queue** | A platform-level view of reported posts, so removal is not "Perry, by hand". |
| **A DPA and sub-processor list** | Netlify, Stripe, Resend, Google. Enterprise customers ask for this by name. |

### Tier 3 — only with money and scale, and honestly not soon

SOC 2 Type II with a real auditor · a bug-bounty programme · 24/7 on-call ·
a dedicated security engineer · SAML/SSO for venue groups · HSM-backed key
management · formal threat modelling per release.

**Do not do any of Tier 3 before Tier 1.** A SOC 2 report on a system whose owner
does not have 2FA is a document about nothing.

---

## What is worth encrypting, specifically

| Data | Today | Verdict |
|---|---|---|
| Everything in Blobs | Encrypted at rest by Netlify; in transit over TLS | Fine. |
| Session tokens | HMAC-signed, revocable, 30 days | Fine. Shortening to 7 days with silent renewal is a small win. |
| Recovery codes | HMAC-hashed, single use | Fine — this is how it should be done. |
| Studio codes | Hashed | Fine. |
| Passkeys | Only the public half is ever stored | Fine by construction. |
| **ID verification photos** | Plain bytes in Blobs, unservable over the web | **Encrypt these.** Tier 1. The most sensitive bytes in the system. |
| Sign-in email addresses | Plain, in the registry | Leave. They are the lookup key; encrypting them means either a searchable index (which defeats it) or no sign-in. |
| Card details | **Never touched.** Stripe Checkout only | Fine — and the reason PCI scope is nearly zero. |

---

## The short version for Perry

The code is in better shape than most funded startups', because the invariants
have been enforced by tests from early on and because the app deliberately holds
almost no personal data. Fans are counted and never named, so **there is no user
database to leak** — which is the thing that actually ends companies.

The gap to a $100M SaaS is not code quality. It is: *nobody has tested a restore,
nobody is alerted when something breaks, there is no written plan for a bad day,
and the founder's own accounts are the softest target in the system.*

Fix those four and MySet is, genuinely, in the top decile for its stage.

---

*Related: `INVARIANTS.md` (the rules the tests enforce) · `ACCOUNTS.md` §9
(passkeys, and why the code sign-in stays) · `HARDENING.md` (the 2026-09-01 pass).*
