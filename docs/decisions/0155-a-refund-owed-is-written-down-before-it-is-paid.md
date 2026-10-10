---
id: 0155
title: A refund owed is written down before it is paid — "Decline + refund" can be finished, and never pays twice
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: voting
reverses:
superseded_by:
invariants: [0ik, 0ac, 13b]
commits: [3111e4c]
tests: [test/refundowed.mjs, test/decline.mjs]
files: [netlify/functions/admin.mjs, netlify/functions/_requests.mjs, netlify/functions/_lifecycle.mjs, netlify/functions/stage.mjs, public/studio.js, test/refundowed.mjs]
---

## The question

"Decline + refund votes" (decision 0016) is the one setlist exception to vote finality: the artist turns a song down and every vote on it goes back to the fan who cast it, at its exact free and paid split. `admin.mjs` did it in two steps: the show write hid the song (`active: false`), and then `refundSongVotes` gave the votes back across the twelve fan files. If the second step failed, the Studio said "tap Decline + refund again" — but the song was hidden, and its row and its Decline button with it.

The scale audit of 2 October 2026: under contention the refund fails, and the credits are stranded on a song nobody can see. They stay stranded: the next fresh start carries each fan's unspent bought votes into the new night (`carryFans`), and a bought vote still sitting on the hidden song counts as spent, so it does not carry.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| A | Refund first, then hide | A reorder | None | While the twelve files are being refunded the song is still on the board: a vote cast into a file already done lands on a song that is then hidden, with nobody to give it back. A second pass after the hide closes that, and its failure is the same bug again |
| **B — chosen** | Write the refund down in the hide's own write (`show.refundsOwed[song]`), pay it, and take the mark off only when the refund has run whole. The Live tab offers "Finish the refund" for any mark; an End and a fresh start finish it on their own | One small map on the show | `settleOwedRefund`, `settleOwedRefunds`, `owed` on the stage payload, `owedPanel` | A mark could outlive its night — so a mark names its night, and one from another night is dropped, never paid |
| C | Retry the refund inside the request until it lands | Time on the tap | A loop | Contention is exactly when it does not land; the tap times out and the song is hidden anyway |
| D — do nothing | | | | Stranded credits after any failed refund, lost for good at the next new night |

## What was chosen, and why

B. It is the only option where every state the store can be left in still has a way forward.

- **One write hides and owes.** `declineSong` sets `active: false` and `refundsOwed[song] = { show, title, at }` together. Then `settleOwedRefund` runs `refundSongVotes` and `declineRequestsForSong` — the existing calls, unchanged: who is refunded and how much is exactly what it was — and takes the mark off only after both have run.
- **Never twice.** `refundSongVotes` takes a vote off its fan in the same write that gives its credit back, so any pass finds only what has not been given back yet; a request already declined is not declined again (`resolveRequest`). So retrying is always safe, wherever it is done from. *(Amended by 0202: a declined request's refund could fail silently, so the request now carries its own `owed` mark and `declineRequestsForSong` throws while one is still owed.)*
- **Never stranded with nothing to retry.** The mark stays until the refund has run whole:
  - **The Live tab** shows "Votes still owed back" with **Finish the refund** for each (the stage payload's `owed`, tonight's marks only and only while live — the same rule as every refund affordance). The button sends the same `declineSong`.
  - **An End** finishes what is owed while the night's fans are still the night's.
  - **A fresh start** finishes it before `carryFans` carries the fans into the new night — the last moment there is anything to give back to — and then drops last night's marks. It never refuses the start over it (rule 1): what cannot be finished is written to the log.
- **Showing the song again un-declines it.** `toggleSong` on takes the mark off: the votes still on it stand, on a song the room can see.
- **Deleting a song with votes owed refunds them.** `removeSong` drops votes without a refund (INVARIANT 15), but a song with a refund owed was already promised one; it goes through the refund instead, and its mark stays until that has run.
- **A failed decline still does not say it worked** (`test/decline.mjs`): 503, now naming where to finish it.

## What this makes harder

- The show record carries `refundsOwed` while a refund is unfinished (usually never).
- If the fan files cannot be written at the decline, at the End and again at the next fresh start, the bought votes on that song do not carry into the new night. The log names the song. That is three failures in a row of the same store; before this it took one.
- Found, not changed: a declined **request** (`resolveRequest`) is marked declined before its vote cost is returned, and a failed return is reported to the artist (`refunded: 0`) but cannot be retried. The same shape of fix would apply; it was outside this audit row.

## What would reverse it

A refund that cannot fail half-way: the live room moving off the twelve shared fan files (one record per fan, or the open line, P3-002), so a song's votes go back in one write.

## How it was verified

- `node --import ./test/register.mjs test/refundowed.mjs`: 43 ✓, 0 ✗. With the fan files not answering, the decline answers 503 and says "Finish the refund"; the song is hidden; the Live tab's payload offers it by name; the mark names tonight; nothing was given back. Finishing gives Ann her four and Bob his one; a second finish gives nothing and leaves no mark. Showing the song again takes the mark off and Bob's vote stands. Deleting an owed song gives Cy both back. An End gives Dee both back and takes the mark off; an ended show offers no button. A fresh start with a refund owed carries Eve's three bought votes into the new night and drops the mark. A mark from another night is not offered, settling it gives nothing, and tonight's vote stands.
- Six knock-outs, each red, each restored: no mark written at the decline (3 fail — without the mark nothing is ever refunded); the mark taken off when the refund failed (1); a fresh start not finishing it (1); an End not finishing it (2); deleting an owed song dropping its votes (2); settling a mark from another night (2).
- `test/decline.mjs` 43 ✓ unchanged (its acked-but-lost refund is still a 503, and repeating the decline still completes it exactly once); `credits` 47, `finality` 61, `votesstay` 23, `request-payments` 45, `foundations` 64, `e2e` 71.
- Added after review, 2026-10-03: `refundSongVotes` waits for every fan file (`Promise.allSettled`) before it answers. With `Promise.all` the first failed file answered at once while the others kept writing, so a refund reported as failed could land a moment later, after the artist had shown the song again; GitHub's runner caught it as a flake in this file's "Bob's vote stands" check. `test/refundowed.mjs` "A REFUND THAT FAILS HAS STOPPED WRITING BY THE TIME IT ANSWERS" (one file failing, one slow) is red with `Promise.all` and green with the fix.
- **Not checked:** the panel in a browser at phone width; a real store failure in the middle of a refund.
