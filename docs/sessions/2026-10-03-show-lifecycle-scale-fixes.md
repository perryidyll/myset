# 2026-10-03 — The show's lifecycle under load: End before Stripe, one live mark per artist, refunds owed, vibes and the same night

**Asked.** An overnight builder for "MySet Audit Solutions 2", while the founder slept: five rows of the 2 October scale audit about starting, ending and refunding a show, on branch `fix/show-lifecycle` (cut from week one's open stack, #205 → #214). Commit only; the coordinating session reviews, pushes and opens the pull request. Not to touch `_pay.mjs`, `webhook.mjs`, `_auto.mjs`, `autocron.mjs` or the vote page.

**Built.** Four decisions, one commit each, all `proposed` and `agent-recommended`.

- `0153` — **The room stops first; the night is priced after, on a clock.** `endShow` flips the show to ended as its first write, then releases the holds and files the night. Pricing has a deadline (3 s at the End and before a fresh start, 5 s on the Money tab and Re-check) and stops at ten pages an ask; a count that stops with pages left is `source: 'stripe-partial'` with a place-marker, read everywhere as not known. `priceNight` finishes it from the marker — the register's bell every ring, and Re-check — and writes only over the count it started from. INVARIANT 0ii. `test/endfirst.mjs` 45.
- `0154` — **One live mark per artist.** No start or end writes `gigsched` any more: the show record is the mark. `walkLive` runs first in the register's bell (registry + one show record per artist from a cursor, one write when something changed) and fills the idle sweep's `live` list and the register's `regdirty` marks. INVARIANT 0ij; 0gi amended. `test/livewalk.mjs` 42.
- `0155` — **A refund owed is written down before it is paid.** "Decline + refund" hides the song and sets `refundsOwed[song]` in one write; `settleOwedRefund` runs the existing refund calls and only then takes the mark off. The Live tab offers *Finish the refund*; an End and a fresh start (before the fans are carried on) finish it on their own. INVARIANT 0ik. `test/refundowed.mjs` 43.
- `0156` — **Free vibes keep their own places; the same night resumes at the cap.** Vibes count against `MAX_VIBES` on their own. A resume of the night already counted, started under twelve hours ago, is neither refused at the free cap nor counted. INVARIANT 0il; 9d9 amended. `test/vibesandresume.mjs` 48.

**Verified.**

| Check | Result |
| --- | --- |
| `test/endfirst.mjs` | 45 ✓ / 0 ✗; four knock-outs red |
| `test/livewalk.mjs` | 42 ✓ / 0 ✗; five knock-outs red |
| `test/refundowed.mjs` | 43 ✓ / 0 ✗; six knock-outs red |
| `test/vibesandresume.mjs` | 48 ✓ / 0 ✗; six knock-outs red |
| Existing tests changed, each saying why | `autoshow` (two idle cases walk first), `everyshow` (the walk leaves the mark; the idle bell's read count), `limits` and `tenancy` (the same night is one show; Start at the cap is still refused for an older night) |
| `test/stripe-fake.mjs` | now pages `checkout.sessions.list` (`limit`, `starting_after`, `has_more`) and can be slowed, failed or watched |
| `sh test/run.sh` | exit 0 on the last commit's tree (5,455 ✓ lines, no ✗); the last block, push alerts per seat, 33 ✓ / 0 ✗ |

**Not checked.**

- Anything on production. Nothing was pushed.
- A real Stripe window of more than a hundred sessions, or how long one expanded page takes (the 3-second End deadline is sized to the scheduler's seven-second ring, not measured).
- A live walk over hundreds of real show records; the register's bell's total time with a walk, a fold and the morning-after asks in one ring.
- The Studio's three new pieces in a browser: *Still counting* on the tile and a night's page, the *Votes still owed back* panel, and the ended screen at the free cap.

**Choices made where the founder did not say.**

- The End's pricing clock is 3 seconds; the Money tab's and Re-check's 5; ten pages an ask.
- A cut-short count is a new `source` value, `stripe-partial`, so every existing reader treats it as unknown rather than learning a new flag.
- A re-check of a whole night that is itself cut short files the night as partial until finished (the last ask wins, as before).
- The live walk lives in the register's bell (every ten minutes), not the scheduler's (every two), because `autocron.mjs` was not this branch's tonight; the hook is written in 0154. 300 show records a ring, 2 seconds.
- The walk marks every artist with a night once on its first lap (one large fold, time-boxed).
- Refunds owed are finished automatically at End and before a fresh start; a fresh start never refuses to start over one, and logs what it could not finish.
- Showing a declined song again un-declines it (the votes stand); deleting a declined song with votes owed refunds them.
- Vibes got a separate cap of the same size (30) rather than a tally, because the fan page reads each vibe as its own row.
- "The same night" is twelve hours from the night's start. This narrows the founder's 0120 sentence "a resume counts again".

**For the coordinator.**

- No new blob key family: `liveSeen` and `liveCursor` are fields on `gigsched`; `refundsOwed` is a field on the show record; the partial count lives on `hist_<aid>_<showId>`. No `_mirror.mjs` FAMILIES line needed.
- `_auto.mjs` `sweepIdle`'s comment ("the start, until a ring looks") is now "the live walk's sighting" in effect; worth a word when week one's files are next open.
- Found, not changed: a declined request's own vote-cost return (`resolveRequest`) is marked declined before the return and cannot be retried if the return fails.
