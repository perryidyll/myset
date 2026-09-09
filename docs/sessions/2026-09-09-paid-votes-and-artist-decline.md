# Paid-vote visibility and artist decline/refund

The user asked for an orange-accented audience voting list, simpler purchase copy,
repeat voting from the queue, paid-vote visibility in the Artist Studio, an artist
decline action that returns votes, and a clear already-played replay state.

## What changed

- The audience search, sort control and main voting list have thin orange borders.
  The list heading and the two specified vote-pack lines are orange, and the pack
  sheet names only the artist's first name.
- Queue songs remain tappable for additional votes, including songs the fan already
  voted on.
- Played songs remain visible, are visually greyed, and say **already played (pay to
  request again)** while retaining the replay-vote action.
- Each newly cast vote records its cost and paid-credit portion. The Artist Studio
  shows total votes plus a green paid-vote pill on the top action, queue rows and
  Setlist rows.
- **Decline + refund votes** is available on voted, unplayed songs. It hides the song
  before sweeping fan shards, restores the exact free/paid source of every attributed
  vote, removes the board entries, and is safe to retry.
- Decision `0016` supersedes decision `0001` only for this explicit artist action.
  Fan-side un-voting and every ordinary play/hide/delete/clear/end path remain final.

## Evidence

- `sh test/run.sh`: full suite passed.
- `node tools/overview.mjs --tests`: 1,762 assertions, 0 failures.
- `test/decline.mjs`: mixed free/paid refunds, unrelated-song isolation, retry safety
  and hidden-song vote refusal passed.
- `tools/uicheck.mjs`: all requested visual states rendered at phone width with no
  horizontal overflow.
- `git diff --check`: clean.
- Draft deploy `6aa0db9c42570c274fbd5c1e`: served content contains the requested
  audience copy/styling and Studio totals, paid-vote pills, and decline control.
  The read-only show endpoint succeeded; no write path was exercised because previews
  share production data.

The user approved this exact draft for production. The final release action is one
commit and one push to `main`; production is verified by served content after Netlify
publishes it, without a second manual production deploy.
