---
id: 0185
title: The vote page paints the board first and asks for its own state only when something changed
date: 2026-10-03
status: decided
decided_by: claude
area: scale
reverses:
superseded_by:
invariants: [0af, 0hr, 0ie, 0if]
commits: [5bb659a]
tests: [test/split.mjs, test/request-payments.mjs]
files: [public/vote.html, public/fan.js, public/shop.html, netlify/functions/_lib.mjs]
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

Four faults on the vote page from the 2026-10-02 scale audit (CLI-4, CLI-6, CLI-8,
HOT-6), plus three about buying votes (CLI-2, the checkout limiter's words, and
replay votes that land in the wallet):

- **Every phone called a function on every tick.** The board is one shared copy at
  the edge, but `/api/me` went with it on every poll. It was the one load that grew
  with the number of phones.
- **The arrival wave shared the vote path.** The first paint waited for `/api/me`,
  and `/api/me` stamps the head-count with a write to the same shard the votes use,
  retried up to forty times. When a room scanned in at once, splash screens stayed
  up and votes waited for turns.
- **A phone unlocked in a big room showed old state for up to 24 s.** Waking only
  re-armed the ladder, whose first rung is 20 s in a big room. A ten-second glance
  never refreshed, and a tap on "Voting open" could meet a window that had shut.
- **Search dropped the keyboard after one letter.** Each letter rebuilt the box, and
  only a poll asked for focus back.
- **Votes bought in Instagram's or TikTok's browser could vanish.** A wallet lives in
  the browser that bought it, and the bank's page can send the return to Safari.
  The page there said "added" over an empty wallet.
- **The checkout limiter read as a broken card.** A 429 got "Card payments aren't
  working right now".

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Board first, `/api/me` after it and only when something changed (or once a minute); presence capped at three tries; on wake, a load after a random 0–1.5 s with the old board dimmed; focus and caret kept; honest buying words | A wallet changed by somebody else (a declined request's refund, a webhook grant) can show for up to a minute | `ME_DUE`, `ME_EVERY`, `ME_RETRY`, `paint()`, `wake()`, `PRESENCE_TRIES`, `WV` in fan.js | A personal change that does not move the show and is not this phone's own action waits for the minute safety |
| B | Make `/api/me` cacheable | It is personal: a cache keyed by device saves nothing | A cache key | Wrong wallet shown to the wrong phone |
| C | Push instead of poll | The audit's long-term step | A socket service | Large; not this batch |
| D — do nothing | | Nothing | None | The function bill and the wave grow with every phone |

## What was chosen, and why

A, on the page, with one server change (the presence cap).

- **When the personal call is made.** On the first load; after this phone acts (a
  vote, a request or vibe or birthday, a leftover choice, a payment coming back, a
  pull — each sets `ME_DUE`); when the board's `showId|updatedAt` changes, which is
  every artist action that can change a fan's state (a song played, a request
  added, a new night, free votes changed); when the screen comes back on; and
  otherwise once a minute. A call that failed is retried after 15 s, not a minute.
  A load whose board did not arrive asks for nothing (0143); the owed call is made
  on the next good load. Between those, the board carries the tallies and a cast's
  own answer has already corrected the wallet (`applyCast`).
- **Board first.** The `<head>` starts only the board now. `load()` paints the board
  the moment it lands and makes the personal call after. Until that call has
  answered once, the credit pill shows a placeholder and the strip leaves the count
  blank, so a fan who spent seven votes never sees "10/10" for a moment. A failed
  call ends the wait, and the fresh-phone numbers stand in as they always did.
- **Presence: three tries.** `markPresence` passes `PRESENCE_TRIES = 3` to
  `mutateFan` (a new optional `tries` argument, default 40). A stamp that loses three
  times is missed. The next personal call tries again, and a phone that votes is
  counted by its vote. It still never fails the call (0af).
- **Wake.** If the board is older than the floor, `wake()` loads after a random
  0–1.5 s, so a room of phones unlocked by the same moment is not one spike (the
  board is the edge's copy). Until the new board lands, the old one is dimmed to 45%
  and a "Catching up…" pill shows under the header. A board that does not arrive
  leaves the dimming on, because the board is still old. `wakeUp(full)`, `FAILS`,
  `TICKING` and `timed()` from 0143 are unchanged; the early load goes through
  `tick()`, so it is still one poll at a time.
- **Search.** The input handler sets `FOCUS` and remembers the caret before
  `render()`. The rebuilt box is focused with the caret where it was. A poll landing
  mid-word keeps the caret too.
- **Buying in an app's browser.** `WV`, the shop's Instagram/Facebook/TikTok test,
  moved into `fan.js`, so the shop and the vote page share one copy. The sheets that
  sell votes (a pack, paid replay votes) say above Continue that votes stay in the
  browser that buys them, and how to open the page in a real browser (··· → Open in
  browser, or Copy link). They never block the purchase.
- **The return.** A pack return (or replay votes that went to the wallet,
  `asCredits`) with no matching `myset.pending` in this browser says "Paid — the
  votes went to the browser you started in. Open this page there to use them." It
  shows no "added" and no confetti, and keeps any other pending record so that one
  is still redeemed. The device id never comes back from the server to make this
  browser the owner (0bu).
- **Replay votes that became wallet votes.** When confirm answers `asCredits: true`,
  the toast reads "That replay had already started, so your N votes went to your
  wallet instead." Without the field, the old words stay.
- **The limiter.** A 429 from `/api/pay` reads "Lots of people are buying at once —
  try again in a moment." The button stays usable. Any other failure keeps today's
  words.

## What this makes harder

- A personal change that neither this phone nor the show caused (a request
  declined and refunded, a webhook granting a pack this page did not redeem) shows
  up to a minute late. The refund itself is not lost; it is just seen later.
- A fan whose first personal call fails sees fresh-phone numbers for up to 15 s, not
  3 s.
- The first paint shows a placeholder pill for one round trip.

## What would reverse it

Push instead of poll would remove the cadence question. Moving request statuses
onto the board, or stamping `updatedAt` when a request is resolved, would remove
the minute's lag for a declined request.

## How it was verified

`test/split.mjs` lifts `load()` and `wake()` out of the page and runs them against
stubs. It checks the order (board, paint, personal call, paint), each trigger, the
minute and the 15 s retry, that no personal call follows a failed board, the wake
delay range and the dimming, the search focus and caret, and three-try presence
against a shard that refuses every write. `test/request-payments.mjs` lifts
`checkout()`, `wvHint()` and `redeem()` and checks the 429 words and button, the
hint in each user agent, the honest return for each case including `asCredits`, and
that `/api/pay` really answers 429. The full suite passes.

In headless Chrome at 375 × 812 against the real handlers (`tools/localhost.mjs`),
on a live show:

- first load: the board was requested at 7 ms and the personal call at 38 ms, with
  the board already on screen. In the app's browser pane, with the personal call
  slowed by 2 s, the 16 songs were drawn and the pill was a placeholder until it
  answered;
- 16 s of polling at the 3 s floor: 3 board calls, 0 personal calls;
- after a vote: `/api/vote`, then the board, then the personal call; the pill went
  from 3/3 to 2/3;
- six wakes with a minute-old board: the board was requested after 309–1499 ms, the
  personal call followed, "Catching up…" showed and lifted once the board landed;
- typing "wo" kept focus with the caret at 2; arrow left and "x" gave "wxo" with the
  caret at 2; a poll landing then kept focus and caret;
- a 429 from `/api/pay` showed the new words and left Continue enabled;
- an Instagram user agent showed the hint above an enabled Continue; Safari's did
  not show it;
- `?paid=` with no pending record showed the "went to the browser you started in"
  toast; with a matching record it showed "3 extra votes added";
- no horizontal scroll at 375 px; no page errors.

**Not checked:** a real phone (iOS keyboard behaviour on refocus in particular, and a
real Instagram webview); a real wake of a locked screen (the event was dispatched by
hand); the visual pill in dark mode; load figures at scale (the call counts above
are per phone).
