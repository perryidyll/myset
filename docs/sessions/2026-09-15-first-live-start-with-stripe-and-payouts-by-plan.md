# 2026-09-15 — the first live *Start with Stripe*, and payouts by plan

Continuation of the payments session (`2026-09-12-payments-connect-subscriptions-costs.md`).

## What was asked

1. Why step 4 of the first run showed *"Please review the responsibilities of managing
   losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile."*
   — "we need to fix this asap".
2. The Connect onboarding page said *Idyll Mastery*; the founder wanted *Idyll Enterprises*.
3. "Is it possible to set up weekly payouts to the hobbyist artists and daily payouts to
   the paid members only?" — then "let's write and ship it", with the plan cards saying
   so, and **Monday** as the weekly day ("most gigs happen fri-sun … starting the week
   with money hitting your bank account always feels nice").
4. (Earlier, same session) put the payments session's remaining founder items on the
   run sheet; 2FA on the six logins — the agent cannot press those switches.

## What was found

- The message was Stripe's, not ours. `stripe.accounts.create` is refused for **every**
  artist until the platform acknowledges two things on its Connect profile: negative-
  balance liability and ongoing seller compliance. Nobody had pressed *Start with
  Stripe* on the live account before, so the gate had never shown. `ensureAccount`
  passed `e.message` straight through, so the artist read a Stripe sentence with a
  dashboard URL in it.
- The founder clicked both *Acknowledge* links; read back afterwards, both lines say
  *Completed September 14, 2026*. He then reported the button working.
- The onboarding page's name comes from Connect → *Onboarding interface* → Branding →
  *Business name*, not from the account name. Changed to *Idyll Enterprises* with the
  founder's go-ahead; the preview updated. Public business name was already right.
  **Statement descriptor is still `IDYLL MASTERY`** — flagged, not changed; `MYSET.VIP`
  suggested so a fan recognises the charge.
- A payout schedule is per connected account and can be updated any time. Stripe's $2
  per active account per month does not depend on the schedule; only the 25¢ per payout
  does, and a once-a-week Hobbyist already had one payout a week. The plan-card line is
  the real value.

## What shipped (this PR)

- **Decision `0080`** — payouts follow the plan. `_connect.mjs`: `payoutScheduleFor`
  (free → `weekly`/`monday`, else `daily`), `payoutTag`, `payoutLine`,
  `syncPayoutSchedule` (compares `c.payout` with the plan; one `accounts.update` when
  they differ); the schedule set at creation; `syncFromStripe` re-checks; `connectStatus`
  returns `payout` + `payoutLine`. `_billing.syncSubscription`, `_plan.redeemPromo` and
  `rewardReferrer` call it (dynamic import in `_plan.mjs` — `_connect` imports `_plan`).
- **The artist never sees Stripe's refusal.** `REFUSED` = *"Stripe could not set up
  payments just now — MySet has been told. Try again later."*; the real message goes to
  `logErr('connect.create' | 'connect.link', e, { aid })`.
- Studio: *Paid out weekly – tips and paid votes land in your bank every Monday* on the
  Hobbyist card; *Paid out daily – last night's money is in your bank the next day* on
  Bar Star; the Get-paid card appends `payoutLine`. `tools/stamp.mjs` run.
- Tests: `test/stripe-fake.mjs` gained `accounts.update` and `state.refuse`;
  `test/connect.mjs` +15 assertions (69 ✓).
- Docs: ledger (PAY-001, PER-013, PER-014, verification, decision and risk rows),
  `docs/processes/money/03` row p15, Puzzle step 372596 (Testing) + connection from
  369893 + changelog 1712, overview regenerated, the 12 Sep session note carried over
  from the conflicting PR #20 (closed in favour of this one).

## Verified / not checked

- Verified: `test/connect.mjs` 69 ✓; `sh test/run.sh` 49 files, no ✗; the platform
  profile and the branding preview read back in the browser.
- Not checked: a real account's schedule on Stripe (the fake stores settings); the plan
  cards on a phone; a lapsed plan is only corrected at the next Money-tab look.

## For the founder

- Run sheet item 8 (2FA, six logins now) is yours end to end; the agent will open each
  page and record the tick.
- Statement descriptor: say `MYSET.VIP` or `Idyll Enterprises`.
- First artist who connects: read their Payouts schedule in Stripe → Connected accounts.
