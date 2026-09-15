---
id: 0080
title: payouts follow the plan — Hobbyist every Monday, paid plans daily
date: 2026-09-15
status: decided
decided_by: perry
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/connect.mjs]
files: [netlify/functions/_connect.mjs, netlify/functions/_billing.mjs, netlify/functions/_plan.mjs, public/studio.js]
---

## The question

Decision 0044 set every connected account to daily payouts, for the reward loop: the
money from a night is in the bank the next day. Stripe bills the platform for that —
$2 per connected account in any month it is paid out, plus 0.25% + 25¢ on every
payout. On 2026-09-15, the day after the platform profile was acknowledged and the
first live *Start with Stripe* went through, the founder asked whether the free plan
could be paid out weekly and only the paid plans daily.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: the schedule follows the plan** | Hobbyist: weekly, on Monday. Bar Star / Rock Star: daily. Set on the account at creation; re-checked whenever the plan changes or the account is looked at. | A dozen lines and one Stripe call per change. | `c.payout` on the connect record; `syncPayoutSchedule()` called from four places. | A schedule lags behind a plan change until the next look at the Money tab — a day late, never wrong money. |
| B — everyone weekly | Simplest, fewest payouts. | Takes "paid the next day" away from the paid plans and from 0044's reward loop. | None. | Artists on the paid plan lose the thing they most feel. |
| C — do nothing (everyone daily, 0044) | Keeps the reward loop for all. | Up to 30 × 25¢ per busy free account per month; no plan line to sell. | None. | The fee is small; the missed plan perk is the real cost. |

## What was chosen, and why

A. The founder's reasons, in order: it is a real reason to upgrade — *paid out
daily* now sits on the Bar Star card and *paid out weekly* on the Hobbyist card — and
it trims the per-payout fee on the plan that pays MySet nothing. **Monday** because
most gigs are Friday to Sunday: the weekend's money lands to start the week, and
"starting the week with money hitting your bank account always feels nice".

What it does *not* change: Stripe's $2 per active account per month is charged in any
month with any payout, so it is the same on either schedule. The 0.25% is on the
amount and is the same in total. Only the 25¢ per payout shrinks, and a Hobbyist who
plays once a week already had one payout a week. The number is small; the card line
is the point.

Venues follow the same rule by plan id — a free venue is paid on Monday, a paid one
daily — because the rule is "a paid plan is paid daily", not "artists are".

## What this makes harder

- The schedule is state on Stripe's side that must track state on ours. It is
  re-checked at every plan write (subscription sync, promo comp, referral reward)
  and at every read of the account (`syncFromStripe`, which the Money tab's refresh
  and the `account.updated` webhook both call). A plan that *lapses* has no write, so
  it is caught at the next read — a lapsed artist can be paid daily for a few days
  longer. Accepted.
- Anyone changing a plan in a new place must call `syncPayoutSchedule` or accept the
  lag.
- An artist cannot change their own schedule in the Express dashboard: it is the
  platform's setting. The Studio's Get-paid card says which one they are on so nobody
  has to ask.

## What would reverse it

- Stripe changes the fee shape so that a payout, not an active account, is what
  costs money — then weekly-for-everyone (B) is worth a second look.
- Free artists say Monday is too long to wait for Friday's tips in numbers that show
  up as churn or complaints.
- PER-013's review on 2026-10-24 (the standing "decide again once real artists are
  being paid") finds the $2 fee is the whole cost, in which case this decision saves
  nothing and only the card line remains as a reason.

## How it was verified

`node --import ./test/register.mjs test/connect.mjs` — 69 ✓, 0 ✗, including nine new
assertions under **WHEN THE MONEY LANDS FOLLOWS THE PLAN**: the account is created
with `{interval:'weekly', weekly_anchor:'monday'}`; the Studio's `payStatus` carries
`payout` and `payoutLine`; a refresh with no plan change makes no `accounts.update`
call; an upgrade to Bar Star makes exactly one, to `{interval:'daily'}`, and a second
call is a no-op; a lapsed `planUntil` followed by a Money-tab refresh puts the account
back to Monday. `sh test/run.sh` — 49 files, no ✗.

**Not checked:** a real Stripe account being updated (the fake implements
`accounts.update` by storing the settings). The first live check is the founder
opening Stripe → Connected accounts → the artist → Payouts and reading the schedule.
