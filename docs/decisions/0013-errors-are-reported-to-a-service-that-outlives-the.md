---
id: 0013
title: Errors are reported to a service that outlives the night
date: 2026-09-08
status: proposed
decided_by: claude
area: ops
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: [docs/reports/open-line.html]
---

## The question

Chris asked: *"if a user tells me about an issue but i can't reproduce it myself, are you
keeping error logs?"*

No. **Netlify keeps function logs for 24 hours** (seven days on higher plans) and Log
Drains, which forward them somewhere permanent, are an Enterprise feature. So a fan who
messages Perry the morning after a gig is describing something for which the evidence is
already gone. There is also no alert when something starts failing — a broken path runs
until a person notices.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
| --- | --- | --- | --- | --- |
| **A — chosen. Sentry free tier, reported by hand over HTTPS** | 5,000 errors/month, 30-day retention, grouped so one bug across a hundred phones is one entry | $0, and ~40 lines | one env var; no new package | A reporting call that throws, or a secret in an envelope |
| B — Sentry with its official SDK | Same, less code | $0 | **a third dependency, in the path that handles money and sign-ins** | A supply-chain takeover in the sign-in path |
| C — Netlify Log Drains to somewhere | Keeps everything, not just errors | **Enterprise plan** | a vendor | Out of proportion and out of reach |
| D — write errors into Netlify Blobs | No vendor at all | Storage reads on the hot path, and a store that can itself be the thing failing | a document per day | The logger fails exactly when the thing it logs fails |
| E — do nothing | | Bugs stay unprovable. The shared-board split is the first change big enough to want this before shipping it | | A silent regression at a real gig |

## What was chosen, and why

A. Sentry's free tier fits MySet exactly — one user is precisely the number of people who
would ever look at it, and grouping means a single bug hitting a hundred phones is one
entry rather than a hundred.

**Reported by hand rather than with the SDK**, because MySet has exactly two dependencies
and that is deliberate. Sending an error is one HTTPS POST of a small JSON envelope. The
same choice was made twice already in this codebase — WebAuthn and the QR encoder were
both written from their specifications rather than pulled in — for the same reason: *a
dependency in a critical path is a dependency that can be taken over.*

Three rules, all of which follow from existing invariants:

1. **It may never break a gig.** Fire-and-forget; a failure to report is swallowed. Error
   tracking that can throw is worse than none.
2. **No secrets, no fan device ids, no personal data** in the envelope. The message and
   the stack, not the payload (INVARIANT 9g).
3. **Off without its key, and off is a clean no-op** — the same shape as `STRIPE_SECRET_KEY`
   and the Google Sheet (INVARIANT 9).

## What this makes harder

- A fourth thing that can be misconfigured, and one more env var Perry has to set.
- Browser-side reporting would need `connect-src` widened in the CSP, which is currently
  `'self'` and is the reason an injected inline script cannot send anything out. **Start
  server-side only**; browser errors are a second decision, not part of this one.
- A free tier that fills up is itself a signal, but it is also a silent stop. Watch it.

## What would reverse it

The free allowance filling every month (then it is Team at $26, which would be worth it),
or Netlify shipping affordable log retention.

## How it was verified

**Not built.** Rates and retention checked against Sentry's pricing page and Netlify's
logging documentation on 2026-09-08. Full working in `docs/reports/open-line.html`.
