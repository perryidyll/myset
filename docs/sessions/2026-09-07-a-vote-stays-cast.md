# A vote stays where it was cast
2026-09-07

> *"the votes do NOT go back to the audience members whose song(s) were not chosen!
> they stay attached to the song(s) you voted for and that song stays in the queue
> until it is played or the show is over. if they paid for votes and their song
> doesn't get played, they lose the money and the votes… that's the whole game. but
> they don't really lose because they're tipping the artist and that's the whole
> point."* — Perry

He called it "something still baked in from the earliest version", and he was right.
It was one function.

---

## What was actually there

`clearAllFanVotes` ran **every time a song started**. It wiped every fan's votes on
every song in the room, and settled the paid part of the ledger while it was there.

Everything else followed from that one line:

- the board went back to zero every few minutes
- free credits *appeared* to refresh, because spend was counted out of the votes a
  fan was holding and they were no longer holding any
- a song nobody started never accumulated anything — votes cast at 9pm and at
  midnight were in different contests and never met
- `releaseUnvotable` existed to hand credits back when the artist narrowed the list,
  and `voteFinal` was a flag with a working refund path behind its off switch

## What it is now

Starting a song takes **that song's** votes off the board (`consumePlayedVotes`) and
touches nothing else. Every other vote stands until its own song is played or the
night ends.

**Spend had to stop being derived.** It was counted out of `fan.v`, which is only
correct while `v` holds every vote a fan still has. A played song now removes its
votes from `v` — so a derived count would hand the credits back at the exact instant
the new rule says it must not. Two stored fields, both monotonic:

- `used` — every credit spent tonight
- `freeUsed` — how much of that came out of the free allowance

The paid portion is `used - freeUsed`. `freeUsed` is stamped **as it is spent**, not
worked out at the end, because the artist can change the free-credit number mid-show
and computing it afterwards would re-price votes already cast — that was a real bug
on the old path, and stamping makes it unreachable.

Charging moved to the cast. It used to happen at the round reset, deliberately, since
un-voting would otherwise have burned a paid vote. With no un-vote and no round, the
cast is the only honest moment left — and it kills a trap with it: a replay used to be
priced at 1 instead of `replayCost` if the ledger settled after `play` moved the song
out of `played[]`.

## Deleted

`clearAllFanVotes` · `releaseUnvotable` · `releaseNote` · the `voteFinal` flag · the
un-vote branch in `vote.mjs` · `openUnvote` and `VMODE` in the page · the twelve-shard
sweep that ran whenever an artist narrowed the setlist.

That last one is a saving, not a loss: `test/cost.mjs` used to assert narrowing read
all twelve fan shards, and now asserts it reads none.

## The sentence is the feature

This design is only fair if nobody finds out afterwards, so the vote sheet says it in
Perry's own words, with his emphasis, before anyone confirms:

- You have **6** votes right now.
- Once you confirm, it's final! Votes **can't be changed** once cast and ***don't come
  back***.
- The list should update itself, but **please pull down on your screen** to refresh
  the page if you want to **see the current list now**.

Two tests read that text out of the shipped file rather than trusting the code to
behave — the words are the promise.

## One decision that was mine, and it is a dial

**Free votes are now an allowance for the NIGHT, not for each song.** Perry did not
say this; it falls out of the rule. The per-song refresh existed *because* the board
reset — spend was counted out of votes that had just been wiped. With votes standing,
there is no round to refresh with.

So the default of 5 that used to mean "5 every few minutes, all night" now means "5,
for the whole night". The number is already a setting in the Studio (Settings → free
votes per person), so if 5 is too tight it is one field, not a deploy.

## What still gives votes back

Exactly one thing: a song **request the artist declines**. Nothing was ever put on the
board for it, so `request.mjs` refunds it and the ask card still says so. A test pins
that this is the *only* "you get it back" sentence left on the page.

## Worth knowing

An artist who deletes a song their room paid to hear keeps the money, and nothing in
the code stops them. That used to be prevented on purpose. It is Perry's call, it is
recorded in INVARIANT 15 rather than left to be discovered, and `test/finality.mjs`
asserts the new behaviour with the reasoning written next to it.

## Also fixed on the way

`roundVotes` in the show log was **the whole board's total**, which was right while
each round's votes were a separate set — summing them counted every vote once, and
that sum is a night's `totalVotes` in the Money tab. With votes standing, the old sum
counted the same standing vote again at every play, and a quiet night would have
reported thousands. It is now the votes that song collected. One vote, counted once:
when its song plays, or in `leftover` if it never does.

## Verification

- `sh test/run.sh` — green, 0 failures, 1,679 assertions
- `test/votesstay.mjs` — new, 23 assertions, the rule as behaviour: a vote survives
  four songs, three people's votes meet on one song across an evening, and nothing —
  winning, hiding, deleting, ending — gives a credit back
- `test/credits.mjs`, `test/finality.mjs`, `test/voting-sheet.mjs`, `test/e2e.mjs`,
  `test/cost.mjs`, `test/audit-0902.mjs` — rewritten where they asserted the old rule,
  with the old assertion left visible in the comment so the change is legible
- the sheet rendered at a 390px iPhone viewport and read back word for word
