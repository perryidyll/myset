---
id: 0044
title: Artists are paid out daily, on purpose
date: 2026-09-12
status: decided
decided_by: perry
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/connect.mjs]
files: [netlify/functions/_connect.mjs]
---

## The question

`_connect.mjs` asks Stripe for a **daily** payout schedule on every Connect Express account it creates. Stripe bills the platform — MySet — per payout, on top of a monthly fee per account that receives one, so a gigging artist on daily payouts costs MySet noticeably more than one on weekly (the 2026-09-05 money-model notes worked the figure and said *"consider weekly"*; the Payments review of 2026-09-11 recommended weekly outright). Nobody but the founder has a Connect account yet, so the schedule could still be changed with one word and no migration. It had to be decided before the first stranger connects, because the schedule is set at account creation.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: daily, kept** | Money from a night is on its way to the artist's bank the next business day | Stripe's per-payout fee on every day an artist earned something, plus the monthly active-account fee (both MySet's; rates in `docs/sessions/2026-09-05-money-model.md`) | None — it is what the code does today | A busy artist on a thin plan costs MySet more than that artist pays it; the fee ladder (decision 0026) was set knowing this |
| B — weekly | One payout a week | Roughly a fifth of the payout fees | A one-word change in `_connect.mjs`, a decision record | The reward arrives days after the gig; the app's promise of *"the room paid you"* lands on a bank statement a week later |
| C — manual | The artist presses *Pay out* in their Stripe Express dashboard | Least for MySet | Nothing in code; a habit to teach | Money sits unclaimed; support questions |
| D — do nothing | Same as A, undecided | — | — | The next reviewer recommends weekly again |

## What was chosen, and why

**A.** The founder's words on 2026-09-12: *"I want the artists to get a near-instant reward loop and validation for using the app."* The payout is the moment MySet's promise becomes real — a musician who ran a room on Saturday and sees the money on Monday tells the next musician. That loop is worth more than the fee difference at any scale MySet will see for a long while, and the plan ladder already prices it in (the platform-fee rates in overview §2.1 were set with Connect's costs on the table — decision 0026).

## What this makes harder

The Connect line of the money model stays the thin one: on the plan with the lowest platform fee, an artist who barely takes tips can cost MySet more in Stripe's account and payout fees than the fee earns. That is a known trade, not a surprise, and it is why the lowest rate sits on the plan with a subscription under it.

## What would reverse it

Stripe raising its per-payout price; a monthly Connect bill that exceeds the platform fees collected from the artists on it (the books in `ACCOUNTING.md` and the monthly close would show it); or artists themselves asking for fewer, larger payouts. Reversal is one word in `_connect.mjs` for new accounts and a Stripe API call per existing account.

## How it was verified

Nothing changed in code. `_connect.mjs` line reading `settings: { payouts: { schedule: { interval: 'daily' } } }` confirmed on 2026-09-12; `test/connect.mjs` pins the account-creation call. The cost figures are Stripe's published Connect pricing as read on 2026-09-11 by the Payments review — **not re-checked today**.
