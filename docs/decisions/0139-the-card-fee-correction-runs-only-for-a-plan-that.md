---
id: 0139
title: The card-fee correction runs only for a plan that shares the fee
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: money
reverses:
superseded_by:
invariants: [0hn]
commits: []
tests: [test/billing.mjs]
files: [netlify/functions/_feesplit.mjs, netlify/functions/_connect.mjs]
---

<!--
  FRONT-MATTER FIELDS

  id           four digits, in order. ./tools/decide.sh picks the next one.
  title        what is now TRUE, not what was done. "A vote never comes back",
               not "changed the vote logic".
  status       proposed | decided | superseded | reversed
  decided_by   perry | claude | perry-confirmed   (who actually chose — this matters
               later, because a decision Perry made is not one to re-litigate)
  area         voting | plans | money | storage | auth | media | scale | ops | ui | docs
  reverses     the id of a decision this overturns, if any
  superseded_by  filled in later, by whatever replaces this
  invariants   the INVARIANTS.md ids this created or changed
  commits      short hashes
  tests        the suites that would fail if somebody undid this
  files        the files where this decision physically lives

  Delete this comment when you fill the template in.
-->

## The question

Stripe's own card fee on a venue's sale is shared evenly between MySet and the
venue (the founder, 2026-09-04). Checkout can only estimate that fee, so `feeCents`
takes half the estimate off MySet's cut, and `settleSplit` pays the venue the
difference once Stripe reports the real fee. `feeCents` does this only for a plan
row marked `splitFee`, and only venue plans carry the mark.

The 2026-10-02 scale audit found that the webhook called `settleSplit` for every
connected account. For an artist nothing was taken off at checkout, yet the
correction still computed "real half minus estimated half" and refunded it out of
MySet's fee. A foreign card's real fee always beats the estimate, so MySet was
handing back 15 to 25 cents of its own fee on a $20 pack.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `settleSplit` returns before touching Stripe unless the owner's plan row says `splitFee` | One plan lookup per `charge.updated` | `sharesStripeFee(owner)` in `_connect.mjs` | A venue plan added without the mark gets no correction — the same row decides both halves, so they cannot disagree |
| B | Stamp "the estimate was deducted" on the payment intent at checkout and read it back | A metadata field | One more field to keep in step | Older charges have no stamp |
| C — do nothing | Keep refunding artists | 15–25 cents per foreign-card pack, for ever | None | Grows with every artist who connects |

## What was chosen, and why

A. One table row already decides whether the estimate comes off at checkout; the
correction now asks the same row. The check sits inside `settleSplit`, not in the
webhook, so any future caller meets it too. It runs before the first Stripe call:
an artist's charge costs no API call and writes no fee row.

## What this makes harder

Sharing the card fee with artists later means adding `splitFee` to an artist plan
row. That one change turns on both the deduction and the correction.

## What would reverse it

The founder deciding artists share the card fee too — which is a plan-table change,
not a code change.

## How it was verified

`node --import ./test/register.mjs test/billing.mjs` — 134 passed, 0 failed. New case: an
artist's $20 charge with a 118-cent real fee is owed no correction, none of MySet's
fee is refunded, Stripe is not called, and no fee row is written. The venue cases
above it are unchanged and still pay.

**Not checked:** what was already refunded to artists on live charges before this.
Each is a row in that artist's `meta` `fees` with `state: 'done'` and a `give`; the
amounts are cents and were not clawed back.
