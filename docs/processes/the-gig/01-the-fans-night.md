---
tab: The gig
section: The fan's night
puzzle_section_id: 41964
sources:
  - netlify/functions/rsvp.mjs, _rsvp.mjs, events.mjs (the RSVP count)
  - MYSET-MASTER-OVERVIEW.md §1.1–1.4, §1.7–1.10, §1.13, §3.1, §3.2
  - public/vote.html (the sheet wording, the dock, "Something wrong?")
  - netlify/functions/board.mjs, me.mjs, vote.mjs
  - docs/decisions/0001, 0002, 0009, 0014, 0056
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps with roles, tools, connections)
verified: code read 2026-09-12 (vote.mjs refusal order; vote.html dock and bug link)
---

# The fan's night

**Who:** a person in the room (role *Fan*, external). **Trigger:** scanning the QR code or opening `/<slug>/vote`. **Outcome:** votes cast that never come back, money spent on the artist's own Stripe account, and the room's tally shaping the set.

Every failure on this path degrades to *the room can still vote*. Nobody signs in.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| f01 | Scan the code | task | Person | Fan R | — | The artist shows a QR (Studio → Settings makes two: home page and voting page). No app, no account. The whole product hinges on a stranger voting within ten seconds of this. `src: VISION.md § Non-goals; overview §3.3 Settings` |
| f02 | Open the voting page | webpage | Automation | MySet server R · Fan I | Netlify | `/<slug>/vote` → `vote.html` (`netlify.toml` slug redirect; real files always win). `leave.js` paints the splash instantly; the first API call starts from `<head>`. A random fan id is minted into the phone's own storage on first visit — *"never a person, never an account"*. `src: overview §1.2, §3.1; decision 0037` |
| f03 | Is a show running? | conditional | Automation | MySet server R | Netlify | The page polls `/api/board` (shared, edge-cached) and `/api/me` (personal, one shard). Branches: **live** → f04; **no show** → f20 (the dark room). `src: overview §5.4; decision 0034; INVARIANT 0fh–0fk` |
| f04 | Read the board | notification | Automation | MySet server R · Fan I | Netlify | Top of page: artist name, live badge, credits pill (votes remaining, or ∞). *Playing now* card with animated bars and a Lyrics button. Status strip: *Voting open* / *Voting paused*. *Up next* — top three, leader marked *"Winning — plays next"*. A song this fan voted for shows *"Your N votes"* and stays tappable. Already-played songs stay votable at the replay cost. Ties break on first vote (`ts[songId]`, never overwritten). `src: overview §1.2, §3.2` |
| f05 | Pick a song | task | Person | Fan R | — | Tap any song in the list, in *Up next*, or in *Already played*. Search and genre chips filter; only genres matching a visible song are offered. `src: overview §3.2` |
| f06 | Read the confirmation sheet | notification | Automation | MySet server R · Fan I | Netlify | The bottom sheet: a stepper capped at what they can afford; the words, in the approved emphasis: *"You have **N** votes right now."* / (if bought) *"You also have **M** votes you bought — those are yours to keep until you spend them."* / *"Once you confirm, it's final! Votes **can't be changed** once cast and ***don't come back***."* Under Confirm: *"Are you sure? Votes can't be changed!"* Two tests read this text out of the shipped file. Buttons: Confirm (shows total cost), Not yet, ✕, full-width drag handle. `src: overview §1.10; INVARIANT 0f0–0f2 (sheet touch traps)` |
| f07 | Confirm the cast | task | Person | Fan R | — | Pressing **Confirm** mints the cast id (not when the sheet opens — stepping the quantity would reuse it). `n` = the stepper value. `src: overview §1.5 step 2` |
| f08 | Cast the vote | go_to | Automation | MySet server R | Netlify | → section **Casting a vote (server path)**. Returns `{voted, votes, cost, remaining}` or a refusal in plain words. `src: vote.mjs` |
| f09 | Was the cast accepted? | conditional | Automation | MySet server R · Fan I | Netlify | **accepted** → f10. **no-credits (402)** → f11. **refused (404/409/429)** → the page shows the server's sentence (*"Voting is closed right now"*, *"That one isn't on tonight's list"*, *"That one is playing right now"*, *"Easy — that's a lot of taps. Give it a few seconds"*) and the fan is back at f04. `src: vote.mjs` |
| f10 | See your vote on the board | notification | Automation | MySet server R · Fan I | Netlify | `applyCast` merges the outcome locally; the next board poll confirms it. *"Your N votes"* appears on the song. The credits pill drops by the cost. There is **no un-vote**: the endpoint has no path that removes a vote at a fan's request. `src: overview §1.5, §1.11; decision 0001` |
| f11 | Offer more votes | notification | Automation | MySet server R · Fan I | Netlify | Out of credits → the sheet offers **Buy more votes**. The dock's **More votes** (orange ring) and **Tip** (solid gradient) never hide while the artist can take cards; they disappear entirely only when the artist cannot take card payments — *never a button that leads to a shrug*. `src: overview §3.2; rule 4` |
| f12 | Buy votes or tip | go_to | Person | Fan R | Stripe | → section **Buying votes and tipping**. `src: overview §1.8, §4.1` |
| f13 | Ask for something not on the list | go_to | Person | Fan R | — | → section **Requests and shout-outs**. Shown only if the artist switched requests or birthdays on. `src: overview §1.3` |
| f14 | Keep voting through the night | sequence | Person | Fan R | — | Votes stay on their song until it is played or the night ends. When a song is played its votes come off the board and **nobody gets credits back**; free credits are an allowance for the night, not a refill per song. The artist's *Decline + refund* on an unplayed setlist song is the one setlist exception (exact free/paid split restored). `src: overview §1.6, §1.7; decisions 0001, 0002, 0016` |
| f15 | Read the last-call box | notification | Automation | MySet server R · Fan I | Netlify | When the artist taps Last call, a full-width box at the top counts down. It sends **time left**, not an end moment (a phone four minutes fast would show nothing). A later poll never shortens a running countdown. Voting stays open at zero — a nudge, not a lock. Some phones in a big room will not see it at all (longer interval). `src: overview §1.14; decision 0010` |
| f16 | Report something wrong | form | Person | Fan R · Artist I | Netlify | The **"Something wrong?"** link: a sentence (≤600 chars) + the last twenty things the page saw fail + the last three hours of the server's own hourly error documents. Read by the artist in Studio → Money. No vendor. `src: overview §1.12; decisions 0029; vote.html bugSend()` |
| f17 | Rate the night | form | Person | Fan R | Netlify | *"Enjoying MySet?"* — five stars and an optional note, after an hour of real use, at most once a week, never over another sheet or mid-vote. Read in Studio → Money → *What the room said*. `src: overview §3.2, §3.3 Money` |
| f18 | The show ends | signal | Automation | MySet server R · Fan I | Netlify | *Playing now* becomes *"Tonight — that's all, see you next time"*. The board is gone with the night. Unspent **free** credits are gone. `src: overview §1.6, §3.2` |
| f19 | Carry or gift bought credits | conditional | Person | Fan R | Netlify | A fan holding unspent **bought** credits is asked: carry them to the next show, or let the artist keep them. **Doing nothing carries them** — never silently pocket what somebody paid for. The gift is a *pledge*, honoured only at the real end-of-show boundary, so an accidental End that is restarted cancels it invisibly. `src: overview §1.8; INVARIANTS § Money` |
| f20 | See the dark room | notification | Automation | MySet server R · Fan I | Netlify | No show running: the setlist, whole and quiet — every song listed, no votes, nothing playing, every song priced at 1. Display only — the show record is untouched, so the artist's *Resume it instead* still finds the night. The **Tip** button stays, full width: the minute after a night ends is when somebody decides it was worth something. `src: overview §1.13; decision 0009` |
| f21 | Say you're coming | task | Person | Fan R | Netlify | **RSVP** under the time and date of any listed show — on the front door's city feed and on the artist page's *Upcoming shows* — with "*N* going" beneath it (decision 0056, 2026-09-12). One tap, no account: `POST /api/rsvp?a=<slug>` (or `?v=<venueSlug>` for a venue-listed event) with the same anonymous `myset.fan` id the vote page keeps; the phone remembers its own RSVPs (`myset.rsvp`), the server keeps only a hashed id per occurrence (`rsvp_<owner>`, never `list()`), and every event row from `/api/events` carries the count. Refused for a show that has ended, does not exist, or is more than 120 days out. A count is a social signal, not a ticket and not money. |

## Connections

f01 → f02 → f03; f03 —live→ f04; f03 —no show→ f20; f21 stands alone (any listed show, before or between nights); f04 → f05 → f06 → f07 → f08 → f09; f09 —accepted→ f10; f09 —no credits→ f11; f09 —refused→ f04; f10 → f14; f11 → f12; f12 → f14; f04 → f13; f13 → f14; f14 → f15 (when tapped); f14 → f16 (any time); f14 → f17 (after an hour); f14 → f18; f18 → f19; f19 → f20; f20 → f12 (tip only).

## What is deliberately absent

- No head-count check on a cast: a room over its plan size slows and shortens, it is never refused (decision 0006, §1.12).
- No un-vote, no round reset, no `clearAllFanVotes` — deleted 2026-09-07, not disabled (§1.16). Any document describing a board that resets between songs is stale.
- No way to recognise Safari and Chrome on one phone as one person; the free allowance is kept small so a second browser is a handful of votes, not a swing (§1.12).
