---
id: 0058
title: The Stripe webhook verifies against two signing secrets — one per event destination
date: 2026-09-12
status: decided
decided_by: perry-confirmed
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/twosecrets.mjs, test/connect.mjs, test/billing.mjs, test/request-payments.mjs]
files: [netlify/functions/webhook.mjs, test/twosecrets.mjs]
---

## The question

Stripe delivers a connected account's events — `account.updated` (the moment an
artist's card payments switch on), `charge.updated` (the exact fee for the venue
split) and a fan's `checkout.session.completed` on an artist's own account — only to
an event destination scoped to **Connected accounts**. The one destination MySet had
was scoped to **Your account**, fixed at creation. And every destination signs with
its own secret, while `webhook.mjs` knew exactly one. So the whole `event.account`
half of the webhook, written on 2026-09-04 and tested against a fake that ignores
the secret, could never have received a real event. Found 2026-09-12 by reading the
destination back in the dashboard (PER-008); no artist has connected yet, so nothing
was lost.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A second destination for connected accounts, same URL; the function tries each configured secret in turn | One env var (`STRIPE_CONNECT_WEBHOOK_SECRET`), two extra HMACs on a mismatch | none | A misconfigured second secret fails its own events with 400 — the state before this decision, now visible in the dashboard |
| B | A second URL (`/api/webhook-connect`) with its own function and secret | A second function and a second copy of the dispatch | one function | The two dispatchers drift |
| C — do nothing | Rely on the return trip, "Check again" and the reconcile sweep | Nothing | none | A fan on an artist's account who pays and closes the tab waits for the sweep; the venue fee split never settles; auto-verify waits for the artist to come looking |

## What was chosen, and why

A, because the dispatch is one function and should stay one function; the only
thing that differs between the two destinations is which secret signed the bytes.
Secrets are tried platform-first, and an event that matches neither is refused
exactly as before — never an unverified event. With only `STRIPE_WEBHOOK_SECRET`
set the behaviour is byte-for-byte the old behaviour, so a deploy ahead of the env
var cannot break the platform endpoint.

The user created the destination and pasted the secret into Netlify himself
(2026-09-12); the code does not see the value.

## What this makes harder

Nothing about the app. Operationally there are now two destinations to keep in step
when an event is added: a Connect-scoped event ticked on the wrong destination is
silently never delivered, and the dashboard does not warn.

## What would reverse it

Stripe's Accounts v2 routing, which sends a platform-owned account's events to the
*Your account* destination instead. MySet is on Accounts v1 Express; the day it
migrates, the second destination may be unnecessary and this record should be
revisited alongside the migration.

## How it was verified

`node test/twosecrets.mjs` (run without the fake, against the real `stripe`
library's signature code): 9/9 — a payload signed by either secret is accepted, one
signed by the connect secret is refused when only the platform secret is configured,
a forged header and a tampered body are refused by both, and no secrets at all
yields no event. The Connect, billing and request-payment suites still pass under
the fake. The dashboard side (destination scope, the four events, the secret in
Netlify) was done by the user; **its first real delivery has not happened** — the
next artist to onboard is the measurement, in Workbench → Webhooks → the connected
destination → Event deliveries.
