---
id: 0138
title: A payment whose grant failed answers Stripe with an error and is retried by the bell
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: money
reverses:
superseded_by:
invariants: [5c, 7b, 0hm]
commits: [0387145]
tests: [test/delivery.mjs]
files: [netlify/functions/webhook.mjs, netlify/functions/_pay.mjs, netlify/functions/autocron.mjs]
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

The 2026-10-02 scale audit read the Stripe webhook and found that it told Stripe
"received" for a payment whose votes had not landed. `redeemSession` can throw
`busy` when the artist's payments file or the fan's file is contended — which is
exactly an encore, when the most people pay at once. The webhook caught the throw
under a comment that said "Stripe will retry" and then answered 200, so Stripe never
did. The fan had paid and had no votes unless their phone made it back to the page,
or the artist pressed the sweep in the Money tab. The same swallow sat on the
subscription events.

The founder's word (2026-10-02): fix everything in the audit's first week, permanently.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A failed grant answers 500, so Stripe redelivers. The session is also written to one small global document, `payowed`, and the bell (every two minutes) reads the session back from Stripe and retries it. | One extra read a ring; one write on a failure | `payowed`, `noteOwed`, `redeliverOwed` | A row retried after delivery — a no-op, because the claim and the per-fan receipt already make a grant idempotent |
| B | Answer 500 and leave the rest to Stripe | Nothing | None | Stripe's retries back off over hours. A fan at a gig has minutes |
| C | Have the bell list every artist's recent Stripe sessions and sweep them | A Stripe list call per artist per ring | A cursor | Cost grows with artists, not with failures; Stripe's rate limit |
| D — do nothing | The buyer's return trip and the artist's sweep stay the only roads | Nothing | None | Money taken, nothing given, nobody told |

## What was chosen, and why

A. The 500 is the part that makes the failure visible to Stripe, and it costs
nothing. The owed row is the part that makes the fix fast enough to matter in a
room: it is written only when a grant fails, so its cost tracks failures, and the
bell already rings every two minutes.

- The row is a pointer — session id, owner, Stripe account — never a payment. The
  session is read from Stripe on every try, so the queue cannot grant what Stripe
  does not say was paid.
- Stripe's redelivery and the bell can race each other and the buyer's return trip.
  `redeemSession` claims the session before it grants and records the grant on the
  fan, so whichever arrives second is told `already` (INVARIANT 5c, 7b).
- Bounded: 500 rows, three days each, ten tries a ring, least-recently-tried first.
  Three days is how long Stripe keeps trying. After that the Money tab still shows
  the payment as not delivered and the sweep still recovers it.
- The subscription branch now lets a throw reach `guard()` as well. Its handler only
  re-reads the subscription from Stripe, so a redelivery is safe.
- The fee-split, account and request branches are unchanged: they do not throw.

## What this makes harder

- A handler bug that throws on every delivery of one event now makes Stripe retry
  that event for three days, and shows as failures on Stripe's dashboard. That is
  the point, but it is noise that did not exist before.
- `payowed` is a new global document. The off-site mirror's list of globals must
  carry it (the phase-two session holds `_mirror.mjs` and was told).

## What would reverse it

- One file per payment (the audit's later step) with its own delivery state would
  make the queue redundant: the bell would walk undelivered payments directly.
- Stripe endpoints being disabled for repeated failures. They are not disabled while
  other events on the same endpoint succeed.

## How it was verified

`node --import ./test/register.mjs test/delivery.mjs` — 45 passed, 0 failed. New cases,
run through the real webhook handler with fan-file writes failing:

- a grant that lands answers 200 and leaves nothing owed;
- a grant that fails answers 500 and writes the owed row for the right artist;
- the bell delivers nothing while the store still fails, and counts the try;
- once the store is healthy the next ring delivers exactly the seven votes, flips
  the marker, and clears the row;
- Stripe's redelivery after that answers 200 and grants nothing more;
- a stale owed row is cleared without a second grant;
- a row older than three days is dropped without asking Stripe.

The whole suite: `sh test/run.sh`, exit 0.

**Not checked:** a real Stripe redelivery against production. Stripe's dashboard shows
each delivery attempt and its answer; the first real failure will show there.
