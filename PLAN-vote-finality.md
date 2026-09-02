# Making votes final — the restructure plan

> **STATUS: built and verified on `feat/voting-sheet-and-verification`, flag still OFF.**
> Steps 1, 2, 4 and 5 are done. Step 3 turned out to need one real fix and two
> verifications rather than the three rewrites predicted — see the notes inline.
> `test/finality.mjs`, 43 assertions, exercises both flag states. Switch it on with
> `flagSet {flag:'voteFinal', on:true}` (globally or per artist) whenever you want to
> run a gig on it.

The flag exists and is **off**: `voteFinal` in `netlify/functions/_flags.mjs`, switched
per-artist or globally by the owner (`flagSet`), and reported to the room in
`/api/show` as `flags.voteFinal` so the sheet already changes its own words. What
follows is what has to change before it can be switched **on** without breaking
things that quietly depend on the refund.

Turning it on today would not crash. It would do something worse: charge a fan twice
for one tap on bad wifi, and leave three other features telling people about refunds
that no longer happen.

---

## Why the un-vote is load-bearing

`vote.mjs` has no request id. **The toggle is what makes voting idempotent.** Today, if
a fan taps once and the response is lost, the retry finds the vote already there and
removes it — annoying, but self-correcting and never a double charge. Take the toggle
away and the same lost response means the second attempt casts *again*, on a phone in
a bar, at 3 credits a go for a replay. That is the whole reason INVARIANT 15 is
phrased as a refund rather than as a nicety.

So finality cannot ship until idempotency comes from somewhere else. That is step 1
and nothing else should start before it.

---

## Step 1 — move idempotency to a cast id — ✅ DONE

Give each **confirmation** in the sheet a fresh id and send it with the cast:

* `vote.html`: mint `crypto.randomUUID()` when `confirmVote()` runs — not when the
  sheet opens, or a fan who steps the quantity and reconfirms reuses it. One id per
  press of Confirm.
* `vote.mjs`: keep a small ring of recently seen ids **on the fan record** (`me.casts`,
  last ~20, `{id, at, song, n}`). If the incoming id is already there, return the
  stored outcome and write nothing. Same shape as the `meta.paid[sid]` guard that
  already makes payments replay-safe, and same reason.
* Bound it: 20 entries, dropped on `clearAllFanVotes` with everything else, so it
  cannot grow.
* Test: the same cast id twice in a row moves the tally once; two *different* ids for
  the same song both land; an id replayed after the round reset is treated as new,
  because the votes it refers to are gone.

Only when this is green does anything below make sense.

## Step 2 — split "remove" from "cast" at the API — ✅ DONE

Right now one endpoint means both, decided by whether the fan already holds votes.
With finality on, "cast again" and "take back" are different intentions and must not
be inferred from state:

* Accept an explicit `op`: `'cast'` (with `n`) or `'clear'`.
* `'clear'` is refused with a plain message when `voteFinal` is on for that artist.
* Keep the old bare-body behaviour working for one release — a phone with a cached
  page will still be sending it. Read the flag, not the body, to decide.

## Step 3 — the three features that promise a refund — ✅ DONE, and the prediction was wrong

Worth recording, because the plan guessed wrong in a useful direction. Only ONE of
the three needed surgery, and it was a bug nobody had noticed:

* **`dropSongVotes` removed only the FIRST occurrence** (`indexOf` + `splice`),
  written when a fan could hold at most one vote per song. With multi-vote casting
  that left the rest of a fan's votes pointing at a deleted song: the tally was
  right, the fan stayed charged, and under finality there was no way back. Now
  filters every occurrence. Caught by a test, not by reading.
* **`resolveRequest` was already honest** — it refunds only when the request belongs
  to the current show and sets `row.refunded` to what actually happened. A request
  charge goes to `me.spent`, which resets with the free credits and is counted by
  `creditsUsed`, so the paid portion settles correctly at the round reset. No change.
* **The narrowed-setlist case needed words, not code.** Removing votes from `v`
  already returns the capacity, so the credit is never lost — but a fan who was not
  told would reasonably think it had been. It is now the fourth rule in the sheet.

Original prediction, kept for the record:

Each of these currently returns credits by removing entries from `fan.v`. With
finality on, "refund" has to mean *credit the stock*, not *undo the vote* — the same
distinction the audit already found wrong in `askDecline`.

1. **A deleted song** — `dropSongVotes(aid, songId)` in `_lib.mjs`. Today it strips the
   id from every fan's `v` and hands the credits back. Under finality the vote is
   still gone (the song is gone), so this becomes a credit to `extra`, and the artist
   should be told how many votes they just refunded. Do not silently keep the money.
2. **A declined request** — `_requests.mjs`. Already broken independently (it reports
   a refund that did not happen once a song has started); fix it as the plan's A2 item
   *first*, to the stock, and finality then needs no further change.
3. **A narrowed setlist** — INVARIANT 0bc's residual case. Today a fan holding a vote
   on a song that dropped out of the set can still toggle it off and recover the
   credit, which is the only reason that case was judged harmless. Under finality
   there is no toggle, so the credit is genuinely stranded until the round resets. It
   still resets at the next song, so the harm stays bounded — but say so in the sheet's
   rules rather than leaving it as a surprise.

## Step 4 — the words, in both states — ✅ DONE

The sheet already branches on the flag. Check every one of these reads true under
finality, because a false line here is worse than a missing one:

* the line under Confirm becomes Perry's: *"Are you sure? Votes can't be changed!"*
* the "changed your mind" rule must disappear entirely, not soften
* the top-three card's *"tap to take back"* must become *"your 3 votes"* with no
  affordance — and the `.qvb` button should stop being tappable for a held song
* the un-vote sheet becomes a read-only *"these are cast"* panel (already written)
* add the stranded-credit note from step 3

## Step 5 — INVARIANT 15, rewritten rather than contradicted — ✅ DONE

15 currently says voting is idempotent per (fan, song) and a second tap refunds. When
the flag flips, that sentence is false, and a stale invariant is worse than none.
Rewrite it as two states with the flag named, keep the *reason* the refund existed on
the record (it was the idempotency mechanism), and point at the cast id as its
replacement. Add the new rule: **a cast is idempotent by cast id, not by state.**

---

## What to do with the flag afterwards

`FLAGS.voteFinal.remove` says it: run a gig each way, pick one, delete the loser and
the flag. A flag that outlives its decision is dead code with extra steps. Two real
gigs is the evidence — not an opinion in a planning document, and not the synthetic
40-phone probe that already misled one audit (INVARIANT 9d11).

## Order, and the honest sequencing note

1 → 3.2 → 2 → 3.1 → 3.3 → 4 → 5. Step 1 is a prerequisite for switching the flag on
at all. Step 3.2 is worth doing immediately whatever happens, because that refund is
broken today with the flag off.
