---
id: 0001
title: A vote never comes back
date: 2026-09-07
status: decided
decided_by: perry
area: voting
reverses: 
superseded_by: 
invariants: [14, 14b, 15, 15h, 0f6]
commits: [5b2f516]
tests: [test/votesstay.mjs, test/credits.mjs, test/finality.mjs, test/voting-sheet.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/vote.mjs, netlify/functions/admin.mjs, public/vote.html, public/about.html]
---

## The question

MySet was built with a board that reset every time a song started. `clearAllFanVotes`
wiped every fan's votes on every song, and free credits appeared to refresh because
spend was counted out of the votes a fan was still holding. Perry, 2026-09-07:

> *"the votes do NOT go back to the audience members whose song(s) were not chosen!
> they stay attached to the song(s) you voted for and that song stays in the queue
> until it is played or the show is over. if they paid for votes and their song
> doesn't get played, they lose the money and the votes… that's the whole game. but
> they don't really lose because they're tipping the artist and that's the whole
> point."*

He added: **"no push back on this please."**

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. A vote is spent at the cast** | Starting a song takes only THAT song's votes off the board. Every other vote stands until its own song plays or the night ends | Spend can no longer be derived from `fan.v`; two stored fields are needed | `used` and `freeUsed` on the fan record | A fan is charged twice, or a mid-show price change re-prices votes already cast |
| B — keep the round reset | No work | The product Perry describes does not exist: nothing accumulates across an evening | none | The rule everybody was told is not the rule that runs |
| C — votes stand, but refund the unplayed ones at the end | Softer | Contradicts the sentence that makes tipping the point; and there is no honest moment to do it — the show can end by accident | a settle pass on every shard at close | Money moves after the room has gone home |
| D — do nothing | | Perry's rule stays unimplemented after he said not to argue | | |

## What was chosen, and why

A. It was Perry's call, stated as final, and it is also the only version in which the
board means anything: with a reset, a vote cast at 9pm and one cast at midnight were
in different contests and never met.

**Spend had to stop being derived.** It was counted out of `fan.v`, which is only
correct while `v` holds every vote a fan still has. A played song now removes its
votes — so a derived count would hand credits back at the exact instant the rule
forbids it. Two stored monotonic fields replaced it: `used` (every credit spent
tonight) and `freeUsed` (how much came out of the free allowance). Paid is
`used − freeUsed`.

`freeUsed` is stamped **as it is spent**, not worked out at the end, because the
artist can change the free-credit number mid-show; computing it afterwards would
re-price votes already cast. That was a real bug on the old path.

Charging moved to the moment of the cast. It used to happen at the round reset,
deliberately, because un-voting would otherwise burn a paid vote. With no un-vote and
no round, the cast is the only honest moment left.

## What this makes harder

- **A fan can lose money and get nothing playable for it.** That is the design, and
  it is only fair if nobody finds out afterwards — which is why the wording on the
  vote sheet is part of this decision, not decoration.
- **An artist can delete a song their room paid to hear and keep the money.** Nothing
  in the code stops them. This used to be prevented on purpose. Recorded in
  INVARIANT 15 rather than left to be discovered.
- **No un-vote means no self-correcting retry.** A dropped response on bar wifi used
  to fix itself, because voting toggled. It cannot now, so every cast carries an id
  minted at Confirm and the outcome is remembered on the fan record (INVARIANT 15h).

## What would reverse it

Only Perry. This is a product rule, not an engineering one, and the engineering under
it is now shaped around it: reversing it means restoring a round concept the ledger no
longer has.

## How it was verified

`sh test/run.sh` green. `test/votesstay.mjs` (new, 23 assertions) states the rule as
behaviour: a vote survives four songs; three people's votes meet on one song across an
evening; nothing — winning, hiding, deleting, ending — gives a credit back.
`test/credits.mjs`, `test/finality.mjs`, `test/voting-sheet.mjs`, `test/e2e.mjs`,
`test/cost.mjs` and `test/audit-0902.mjs` were rewritten where they asserted the old
rule, with the old assertion left in the comment so the change is legible. The vote
sheet was rendered at a 390px viewport and read back word for word.

**Deleted:** `clearAllFanVotes`, `releaseUnvotable`, `releaseNote`, the `voteFinal`
flag, the un-vote branch in `vote.mjs`, `openUnvote`/`VMODE` in the page, and the
twelve-shard sweep that ran whenever an artist narrowed the setlist. `test/cost.mjs`
used to assert narrowing read all twelve fan shards; it now asserts it reads none.
