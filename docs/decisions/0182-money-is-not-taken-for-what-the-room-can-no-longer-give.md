---
id: 0182
title: Money is not taken for what the room can no longer give
date: 2026-10-03
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: [0ad, 0ib]
commits: [b2dbfec]
tests: [test/request-payments.mjs]
files: [netlify/functions/_pay.mjs, netlify/functions/pay.mjs]
---

## The question

The scale audit (PAY-13) found two buttons that could take money for nothing:

- **Song votes.** `pay.mjs` checks that a replay is open when Checkout starts, but the
  grant after payment checked nothing. A card form can take minutes. If the show
  ended, a new one started, or that very song began playing meanwhile, the paid
  ballot entries landed on a dead or spent board.
- **Paid requests.** `pay.mjs` did not check the 30-request queue cap. The refusal
  came after the card was authorized; the hold was cancelled, but the fan had been
  shown a button that led nowhere (INVARIANT 0ad).

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Song votes that can no longer count become wallet votes (the pack-shaped grant), and the reply says `asCredits`. The request queue is checked before Checkout opens. | One show read per song-vote grant | `asCredits` on the reply | A fan who wanted that replay specifically gets votes instead of their money back |
| B | Refund the song votes automatically | A refund path, Stripe calls in the grant | Refunds | No refund code exists for fan purchases yet; the refunds decision waits on the founder (desk card `refunds`) |
| C — do nothing | — | — | — | Dollars on a dead board |

## What was chosen, and why

A. Wallet votes are already how MySet keeps a fan's unspent paid votes, and they
carry to the fan's next show (`carryFans`). The receipt is the same session id on
either path, so a retry cannot grant both. The rule for "can no longer give": the
show is not live, it is a different show from the one tagged on the session, the song
is now playing, or it is no longer in the played list. A closed voting window is not
on the list: the window opens and closes during a set, and the votes still count when
it reopens.

## What this makes harder

- The vote page's return toast does not yet say "added to your votes instead" when
  `asCredits` is set; the votes appear in the wallet either way.

## What would reverse it

- A refund path for fan purchases, if the founder prefers money back to votes.

## How it was verified

`test/request-payments.mjs`: a $3 replay bought while alpha was up, then alpha starts
playing before the return: the reply says `asCredits`, the wallet holds three, alpha
gets no paid votes, and a second return grants nothing. A full queue answers 429 with
the queue message and opens no Checkout. The whole suite: `sh test/run.sh`, exit 0.
