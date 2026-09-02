# What the independent review left open

Five reviewers with fresh context went at `feat/voting-sheet-and-verification` and
returned **33 findings**. The two criticals and four highs are fixed (commit
`9910371`), plus the two fan-facing mediums below. This is everything still open,
so none of it is lost.

Raw output: `_tmp_audit/review-findings-raw.txt`.

> **A note on how these were nearly lost.** All five reviewers completed their work
> — 850k tokens, 315 tool calls — and then every one of them failed to emit output
> matching the schema I gave them, so the workflow returned nothing at all. The
> findings were recovered from the run journal by reading their attempted tool
> calls. If a review ever comes back empty, look there before believing it.

## Fixed after the review

* The queue's new `+` button had no affordability gate, so a fan with nothing left
  got a sheet and then a 402 (L2-1 / L4-5). Now uses the same rule as the list rows.
* `.note` was used in `studio.html` and defined nowhere, so the gig-cap explainer
  rendered full-bleed with no padding (L4-6). Defined from the page's own tokens.
  (`.big.alt` turned out to be fine — both Studios define it as a compound
  selector; it was only missing on the audience page, where it is already fixed.)

## THE THEME WORTH READING FIRST: three features are write-only

The reviewers found this from three directions independently, and it is the honest
gap in this branch. The backends exist, are tested, and cannot be reached by a user.

* **The artist verification tick has no UI at all** (L5-05, L3-4). Nothing in
  `public/` calls `verifyStatus`, `idUpload`, `idQueue`, `idApprove` or `idReject`.
  An artist cannot ask for the tick, Perry cannot review one, and no page renders it.
* **`voteFinal` has no switch** (L5-02). It can only be flipped with hand-made HTTP.
  That is enough for Perry to run a gig each way — which is what it is for — but it
  is not a feature anyone else can use.
* **The venue tick is now HARDER than before** (L3-1). Adding `paidPlan` to the
  verdict means a venue that completes everything it is told to do sees every box
  ticked, "4 of 4 done", and is still refused — because nothing a venue can reach
  sets `plan`, and `venuePlan` is owner-only with no UI. **Either drop `paidPlan`
  from `passed` until venue billing exists, or add it as a visible fifth line with a
  real route to paying.** Shipping it as-is would be a checklist that lies.

## Still open, by area

### The tick, and revoking it
* **`idApprove` re-checks nothing** (L3-5) — it will verify any artist id, with no ID
  on file, no plan and no Connect. Owner-only, so the blast radius is Perry
  approving something by accident, but it should re-run `artistVerifyChecks` first.
* **A verified artist can never be un-verified** (L3-3); `idReject` after approval is
  a no-op. There is no path back from a mistake.
* **A verified venue keeps the tick after its plan lapses** (L3-6) — `verified` is a
  stored boolean, and nothing re-tests `paidPlan` after the fact.
* The public venue page still tells artists that vouches alone earn the tick (L3-7),
  and Venue Studio Settings credits a self-verified venue to "Checked by MySet"
  (L3-8). Both are now false.
* The ID delete is never verified and its failure cannot be seen (L3-9) — INVARIANT
  0bk says the photo goes on decision, and a silent failure means it might not have.

### Voting and credits
* **Hiding a song or narrowing the setlist strands the fan's credits** (L2-2), which
  INVARIANT 15 says must not happen — `dropSongVotes` is called on delete but not on
  hide or on a setlist change.
* **A malformed cast id is silently treated as absent** (L5-04), so the request
  proceeds with no idempotency at all rather than being refused.
* **The cast id is never reused by any client** (L5-03) — nothing retries a failed
  cast with the same id, so the idempotency INVARIANT 15h demands is real on the
  server and nominal in practice. The client should retry once with the same id.
* A read-back-verify failure re-runs the mutator and *may* be able to cast twice
  (L5-08). Worth reproducing carefully: the cast-id ring should prevent it, because
  a retry re-reads the document, but the reviewer believes there is a window.
* `paidLeft` under-reports for a device granted unlimited (L2-3) — `unspentPaid`
  called without the fan id.
* "Your 2 votes — tap to take back" still shows when voting is paused and after the
  show has ended, with nothing to tap (L4-4).

### Money
* **`redeemSession` claims the session before granting** (L1-5). No marker separates
  "claimed" from "delivered", so a lost grant write means money taken, nothing
  delivered, and all three recovery paths answering `already: true`. This is the old
  audit's C004 and it is still real. Fix: write `delivered:false`, flip it after the
  read-back verify passes, and treat a claimed-but-undelivered marker as work to do.
* **`payStart` never sends a country** (L5-01), so every connected account is created
  in the platform's country — and an Express account's country is immutable. For an
  artist on Koh Phangan that means they can never be paid out properly. Ask for it in
  the Get-paid card and refuse an empty value.

### Layout and copy
* **At 320px the vote sheet pushes its own Confirm button below the fold** (L4-2) —
  with a long title only 9px of it is on screen, and "Not yet" is 83px below the
  viewport even in the short case. Make the action block a sticky footer inside the
  sheet.
* A brand-new artist's room tells the fan to "pick a song below" and that
  "everything's in the queue above" — with zero songs (L4-9).
* The Studio Money tab shows the artist a raw machine error slug (L4-7).

### Owner-only hardening (low, blast radius is Perry)
* `flagSet` accepts prototype-chain names (`__proto__`, `toString`) as declared flags
  and persists them (L5-06).
* `idApprove` / `idReject` / `venuePlan` report success for targets that do not exist
  (L5-07).

## Suggested order

1. **Decide the venue tick question** (L3-1) — it is the only one that would ship a
   dishonest screen.
2. `redeemSession` delivered-marker (L1-5) — the last live piece of the 2026-08-30
   failure.
3. The 320px sheet fold (L4-2) — it is on the phone the whole room uses.
4. `payStart` country (L5-01) — cheap now, immutable later.
5. UI for the artist tick and a flag switch, or drop them from the branch.
6. The rest.
