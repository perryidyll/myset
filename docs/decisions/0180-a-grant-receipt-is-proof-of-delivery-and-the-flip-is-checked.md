---
id: 0180
title: A grant receipt on the fan is proof of delivery, and the delivered flip is checked
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [5c, 7b, 0ia]
commits: []
tests: [test/delivery.mjs]
files: [netlify/functions/_pay.mjs, netlify/functions/_lib.mjs]
---

## The question

The 2026-10-02 scale audit (PAY-6) found a way for one pack to be granted twice.
`redeemSession` grants votes onto the fan record — writing the session id into the
fan's `gr` receipts in the same write — and then flips the payment marker to
`delivered`. That flip was written once with its error swallowed. If it was lost,
the marker said "undelivered" with nothing scheduled to look again. When the next
show started, `carryFans` deleted every fan record with nothing to carry, and the
receipts with it. The next delivery attempt (the artist's sweep) then found an
undelivered marker and no receipt, and granted the pack again. A second fault sat
beside it: the receipt list was capped at 20 on the pack path and 40 on the
song-vote path, and the 20 trim also dropped song-vote receipts.

The founder's word (2026-10-03): keep fixing the audit's findings without waiting
for him.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The flip is read back; if it still fails the session goes on the owed list (0138) and the bell makes it. Before `carryFans` deletes a record, every receipt it holds settles its marker as delivered. One receipt cap, 40. | One meta read at each show start that had receipts; one verify read per paid grant | `markDelivered`, `GR_KEEP` | A marker settled from a receipt whose grant was later reversed — there is no reversal path today |
| B | Keep a stub `{gr}` record for seven days instead of deleting it | Stub records in every shard | A stub shape every reader of fan records must skip | Head counts, board building and the phase-two `liveFans` all count records; a stub could be counted as a person |
| C | One file per payment with its own delivery state | A new key family, a migration | Many | The audit's structural step; too big for overnight |
| D — do nothing | — | — | — | A double grant whenever a flip is lost under load and a show ends before the sweep |

## What was chosen, and why

A. The receipt is written in the same write as the grant, so its presence on a fan
record is exact proof that the votes landed. `carryFans` is the one moment that proof
is about to be destroyed, so that is where it is copied into the marker
(`settledBy: 'carry'`). The flip itself is now verified and, failing that, handed to
the bell, so the window in which a marker can be wrong shrinks from "until someone
presses the sweep" to "until the next ring", minutes.

- The buyer is never shown an error for a lost flip: their votes are on their phone.
- `noteOwed` is called without a Stripe account, so `redeliverOwed` now finds the
  owner's account itself (`stripeFor`) when a row carries none.

## What this makes harder

- `carryFans` now reads and may write the payments document once per show start.
- A receipt is now trusted as delivery. Anything that ever removes votes for a refund
  must not leave the receipt behind as proof of something undone.

## What would reverse it

- One file per payment with its own delivery state (the audit's structural step).

## How it was verified

`node --import ./test/register.mjs test/delivery.mjs` — new cases: with every
payments-document write failing after the claim, the buyer is told it worked, the
votes land, the marker stays undelivered and the session is on the owed list; the
next ring flips it without a second grant and clears the row. A record with nothing
to carry is deleted at the next show start, its undelivered marker is settled from
the receipt first, and a later delivery attempt answers `already` and grants nothing.
The whole suite: `sh test/run.sh`, exit 0.

**Not checked:** against production data. No production marker was inspected.
