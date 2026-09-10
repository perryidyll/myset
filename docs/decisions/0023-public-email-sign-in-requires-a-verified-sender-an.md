---
id: 0023
title: Public email sign-in requires a verified sender and confirmed delivery
date: 2026-09-10
status: decided
decided_by: claude
area: auth
reverses:
superseded_by:
invariants: []
commits: [33d7429]
tests: [test/email.mjs, test/accounts.mjs]
files: [netlify/functions/_auth.mjs, netlify/functions/auth.mjs, netlify/functions/venueauth.mjs]
---

## The question

Both account types returned “sent” after ignoring Resend's response. Production had a
Resend key but no `AUTH_FROM`, so it fell back to `onboarding@resend.dev`; Resend permits
that testing sender to mail only the address that owns the Resend account. The founder's
own sign-in therefore looked healthy while a new artist's or venue's inbox stayed empty.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Treat email as ready only with a key plus an explicit non-sandbox sender, and propagate provider rejection | One Netlify variable and verified domain are required | None | A configuration mistake is visible immediately instead of masquerading as delivery |
| B | Keep the sandbox fallback and inspect recipient addresses | Less configuration | Recipient exception logic | Production behavior differs by recipient and can expose account ownership |
| C — do nothing | Continue returning “sent” after every provider response | None | None | Every unfamiliar signup can fail silently |

## What was chosen, and why

The signup door must not make a success claim the mail provider has already disproved.
Artist and venue signup share one readiness rule and both return an honest temporary
failure when Resend rejects the message.

## What this makes harder

Email signup is deliberately unavailable until a verified sender is configured. That
is more visible than the old false success, but requires the site operator to finish
Resend domain setup before strangers can create accounts.

## What would reverse it

Replace the readiness check if Resend introduces a production-capable managed sender,
or if MySet moves email delivery to another provider with an equivalent verified-sender
contract. Never restore success-on-rejection.

## How it was verified

`test/email.mjs` checks missing configuration, the forbidden sandbox sender, configured
delivery, a Resend 403, and both public account doors. `test/accounts.mjs` checks the
two-inbox address-change flow with accepted delivery. A live email to a stranger was not
sent because that would mutate production and `AUTH_FROM` is not configured there.
