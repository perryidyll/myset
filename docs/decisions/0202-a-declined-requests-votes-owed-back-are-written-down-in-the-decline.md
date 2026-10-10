---
id: 0202
title: A declined request's votes owed back are written down in the decline, and given back once
date: 2026-10-09
status: decided
decided_by: claude
area: voting
reverses:
superseded_by:
invariants: [0je, 0ik]
commits: []
tests: [test/requestowed.mjs, test/refundowed.mjs, test/e2e.mjs]
files: [netlify/functions/_requests.mjs, netlify/functions/admin.mjs, netlify/functions/stage.mjs, public/studio.js, test/requestowed.mjs]
---

## The question

Decision 0155 closed one failure the scale audit of 2 October 2026 found: a "Decline + refund" that hid a song and then failed to give its votes back stranded them. The read-only pass over the audit on 2026-10-09 found the same shape one level down, in `resolveRequest`. Declining a request wrote `status: declined` in one write and gave the fan's votes back in a second, and the second's failure was caught and swallowed. The row said declined; nothing said its votes were still owed; a second Decline answered *"That one has already been dealt with"*; and the Studio told the artist *"No votes to give back — that request was from an earlier show"*, which was false. The fan's votes were gone for the night. The same swallow sat under 0155's own song refund: `declineRequestsForSong` never failed, so a song's mark could be taken off while one of its requests had given nothing back. The founder asked on 2026-10-09 for every audit item that needs no answer from him to be done.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: 0155's pattern, on the request row** | The decline sets `owed` on the row in the same write; the fan's write gives the votes back with a `back:<id>` mark in the fan's own `rq` (beside the `ask:<id>` marks that stop a double charge); only then is `owed` taken off. A row still owed is answered as owed, listed under the stage's `owed` for *Finish the refund*, retried by a second Decline, and finished by the End and the fresh start (before `carryFans`). `declineRequestsForSong` throws while one is owed, so a song's mark stays. | One field on the row, one mark on the fan, a branch in `settleOwedRefunds`. | `owed` on a request row. | A mark that cannot be cleared is shown until the next fresh start drops it; it never pays twice. |
| B — make the decline and the refund one write | Impossible as stored: the request list and the fan files are different documents. | — | — | — |
| C — refund first, decline after | Gives the votes back, then marks declined. | A crash between leaves a refunded request still open, which a second Decline refunds again. | — | Mints votes. |
| D — do nothing | — | — | — | A fan's votes vanish on a storage hiccup, and the artist is told something false. |

## What was chosen, and why

A, because 0155 already proved the shape: write the debt down in the write that creates it, pay it with a mark that makes paying idempotent, take the debt off last. The fan's `rq` list already exists for the same purpose on the charge side (`ask:<id>`), so the refund side reuses it rather than adding a field. A mark from another night is dropped without paying, because those credits refreshed and a refund would mint votes (INVARIANT 0ac), which is the rule the stale-request decline already followed.

## What this makes harder

`rq` now holds both kinds of marks within its 40, so a fan who makes and has declined many requests in one night pushes older `ask:` marks out sooner; a retry of a request that old is already answered by the row itself (`prior`). The Studio's *Votes still owed back* card now mixes songs and requests.

## What would reverse it

Requests moving into the fan's own record (one write for both), which would make the mark unnecessary.

## How it was verified

- `node --import ./test/register.mjs test/requestowed.mjs` → 52 ✓ / 0 ✗: a decline whose refund fails answers 503 with *Finish the refund* (never *earlier show*), the row is declined and owed, the stage lists it, the second Decline gives the three votes back, a third gives nothing; a refund that landed but whose answer was lost is not paid again (with other spending so the clamp at zero cannot hide it); an End finishes it; a fresh start finishes it before carrying four bought votes into the new night; a stale request is declined with nothing given; a mark from another night is dropped unpaid; a song declined with an accepted request keeps its mark; `declineRequestsForSong` throws while one is owed and finishes when run again.
- Knock-outs, each red then restored and `cmp`-checked: no `owed` in the decline (16 ✗), no fan mark check (1 ✗), no request loop in `settleOwedRefunds` (5 ✗), no throw (1 ✗).
- Neighbours green: e2e 71, request-payments 83, refundowed 46, decline 43, vibesandresume 48, endfirst 45. The whole suite: see the PR.
- Not checked: a real store failure in production; the Studio card in a browser.
