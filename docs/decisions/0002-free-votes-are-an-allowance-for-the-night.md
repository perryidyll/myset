---
id: 0002
title: Free votes are an allowance for the night, not for each song
date: 2026-09-07
status: decided
decided_by: claude
area: voting
reverses: 
superseded_by: 
invariants: [14b]
commits: [5b2f516]
tests: [test/credits.mjs, test/votesstay.mjs]
files: [netlify/functions/_lib.mjs]
---

## The question

Free credits used to refresh every time a song started. That was not a feature anybody
designed — it fell out of the board reset (decision 0001): spend was counted out of
votes that had just been wiped, so credits *appeared* to come back. With votes standing
there is no round to refresh with, so the number had to mean something new.

**Perry did not ask for this.** It is a consequence of his rule, and it is flagged as
such because it changes what a person in the room actually gets.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. One allowance for the night** | The default 5 means 5 for the whole gig | A room gets far fewer free votes than it used to | none | A gig feels stingy and nobody votes |
| B — refresh on a timer | 5 every 20 minutes, say | Mints credits from nothing; needs a clock the fan record does not have | a per-fan timer, and a new way to be wrong across a restart | Someone farms votes by waiting |
| C — refresh per song played | Keeps the old feel | Re-introduces the round the ledger just removed | the concept 0001 deleted | Contradicts 0001 |
| D — do nothing | Leave the number at 5 and say nothing | The meaning silently changed under Perry without anyone saying so | | He finds out at a gig |

## What was chosen, and why

A, and **the number is already a setting**. Settings → free votes per person. If 5 for
a night is too tight, it is one field in the Studio, not a deploy. That is what makes
this safe to ship as the default rather than agonised over: the dial exists, it is in
Perry's hands, and it can be turned mid-show.

## What this makes harder

A busy three-hour gig now hands out roughly a fifth of the free votes it used to, which
changes how much of a night's voting is paid. If free voting was carrying engagement,
this will show up as quieter boards before it shows up as revenue.

## What would reverse it

Perry raising the default, or a gig where the board visibly dies after the first hour.
Watch the first gig run under this rule.

## How it was verified

`test/credits.mjs` (44 assertions, rewritten) asserts the allowance is consumed once
across a whole night, and `test/votesstay.mjs` asserts nothing refreshes it.
