# Live controls, replay placement and artist fees

The requested batch touched the live audience list, the Artist Studio lifecycle,
archived-show navigation, checkout copy, platform fees and touch behavior.

## Completed in the working tree

- Played songs remain greyed but now stay in the same sortable audience list. Their
  replay sheet opens at the artist's replay minimum (five votes by default), cannot
  go below it, and can increase in replay-minimum increments.
- A live artist can end the current song without ending the show. The song moves to
  Played and stale Now playing state is cleared.
- Start top voted is absent when no song has a positive tally, and the server also
  refuses a zero-vote fallback.
- The ambiguous `0/5` device ratio is now explicit copy: `0 voting`, `5 in room`, and
  the approximate number of networks.
- Between shows, Live hides the previous show's voting controls, stats, queue, tips
  and Now playing card, and its four-second poll is stopped. Archived numbers remain
  available from Money → Past shows.
- Past shows initially displays the latest three, with See more / Show fewer; search
  still covers the entire history.
- Tip sheets on both audience surfaces use the requested orange first-name and Stripe
  checkout lines.
- Artist transaction fees are 25% Free, 10% Plus and 2.5% Pro. The platform-owner
  account is explicitly exempt in both checkout and payout-status reporting.
- `touch-action: manipulation` disables double-tap zoom throughout the app while
  preserving ordinary pinch zoom for accessibility.
- Replay cash choices are now `$5`, `$10` and custom whole dollars at **$1 = 1 paid
  vote**. They are applied directly to the replayed song and appear in its artist-only
  green paid-vote count; they do not create loose wallet credits.
- Off-setlist song requests remain available for the normal request cost (three votes
  by default) and may add a `$5`, `$10` or custom whole-dollar offer. Stripe authorizes
  the card at submission. The artist sees the offer, acceptance adds $1-per-paid-vote
  weight, completion captures, and decline refunds the request votes and releases the
  hold. Ending a show also releases unfinished offers.
- Birthday requests now share the explicit three-vote default.

## Evidence

- `test/request-payments.mjs`: 35 assertions passed for paid replay votes, request
  authorization, artist-visible offers, acceptance, completion capture, decline,
  refunds, idempotency and show-end cancellation.
- `test/connect.mjs`: 54 assertions passed, including connected-account scoping for
  request authorization and capture.
- `sh test/run.sh`: every suite section passed before the final documentation stamp.
- `node tools/uicheck.mjs`: phone-width rendered checks passed for unified played-song
  placement, replay/request payment controls and orange copy, artist-visible offer and
  paid-vote pills, tip colors, live controls, zero-vote state, clear room-stat labels
  and the inactive Live state.
- `git diff --check`: clean.

Final gate: **1,808 assertions, 0 failures**, plus rendered phone-width and touch checks.
The user explicitly authorized the complete working tree for an immediate production
push after this gate.
