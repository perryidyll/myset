---
id: 0190
title: A promo code gets five guesses an hour
date: 2026-10-03
status: decided
decided_by: claude
area: plans
reverses:
superseded_by:
invariants: [0ij]
commits: []
tests: [test/billing.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/admin.mjs, tools/backup.py]
---

## The question

A promo code at 100% comps a paid plan. The 2026-10-02 scale audit (SEC-12) found
that `promoRedeem` had no limit on attempts. Codes can be as short as four
characters. The answers also told a guesser which codes exist: "isn't recognised",
"has been turned off" and "has been used up" were three different messages.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Five tries an hour per account and per network, and one answer for unknown, off and used up | One small global document | `promolim`, `promoTryAllowed` | An artist who mistypes five times waits an hour |
| B | Only make new codes long and random | Nothing in code | None | Every existing short code stays guessable |
| C | Lock the account after N failures | A lock to undo | A lock state per account | A stranger can lock someone out |
| D — do nothing | — | — | None | A script finds a comp code |

## What was chosen, and why

A. Codes already handed out cannot be changed by this decision, so the door has to
be what slows a guesser.

- **Two buckets in one document.** `promoTryAllowed` keeps `a:<account>` and
  `n:<network>` in `promolim`, the same token-bucket shape as `payAllowed` (decision
  0111). Each holds `PROMO_TRIES` (5) and refills five an hour. The network hash is
  `roomHash('promo', clientIp(req))`, so it is the same for every account on that
  network. Every attempt with a code in it spends one from both. An empty box spends
  nothing.
- **A refused try writes nothing beyond the bucket.** It never reads or writes the
  codes or the account row. The admin branch answers it with 429.
- **It fails closed.** If the limiter cannot be written (five CAS tries, or a store
  error), the try is refused. Redeeming a code is never on the way to a gig, and an
  open door under contention is the door a script would aim for. The checkout
  limiter fails open because a sale is at stake. Here nothing is.
- **One answer.** A code that does not exist, is turned off or is used up gets
  "That code can't be used". "You've already used that code" stays: only someone who
  already redeemed the code can see it.
- **Codes from here on should be 10+ random characters.** That is a change to how
  the founder mints codes. It is a separate decision and was not made here. Existing
  codes and `promoCreate` are unchanged.

## What this makes harder

- An artist who mistypes five times in an hour waits for the bucket to refill (one
  try every twelve minutes).
- Artists sharing one network (a label office, a venue's wifi) share five tries an
  hour between them.
- `promolim` is a new global document. `tools/backup.py` skips it. It still has to
  be added to `SKIP` in `_mirror.mjs`; that file was being changed by another
  session and was not touched here. It is not read by any audience path, so
  `test/cost.mjs` does not need it.

## What would reverse it

Codes that are all long and random (the follow-up above), so that guessing is
hopeless anyway. Then the limit could be loosened, but there is no reason to remove
it.

## How it was verified

`node --import ./test/register.mjs test/billing.mjs`, section "A PROMO CODE CANNOT BE
GUESSED". Every case failed before the change:

- unknown, turned off and used up all get the same answer;
- the sixth try in an hour is 429 even with a real code, and the codes document and
  the account row are byte-for-byte unchanged;
- that account is refused from another network, and another account is refused on
  that network;
- an honest artist on a third network redeems on the first try and gets the discount.

The whole suite: `sh test/run.sh`, exit 0.

**Not checked:** on production.
