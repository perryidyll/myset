---
tab: The gig
section: Requests and shout-outs
puzzle_section_id: 41968
sources:
  - netlify/functions/_requests.mjs — createRequest, resolveRequest, cancelPledge, completeSongRequests, declineRequestsForSong, cancelOpenPledges
  - netlify/functions/request.mjs, pay.mjs (kind request_hold), webhook.mjs, admin.mjs (askAccept/askDone/askDecline)
  - MYSET-MASTER-OVERVIEW.md §1.3, §1.7, §3.2, §4.1
  - INVARIANTS.md § Requests, and the room (0w, 0ac)
  - docs/decisions/0018, 0019
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps with roles, tools, connections)
verified: code read 2026-09-12 (_requests.mjs createRequest refusals; resolveRequest refund rule)
---

# Requests and shout-outs

**Who:** a fan (external) asking for something not on the list; the artist deciding. **Trigger:** *Ask for something not on the list* on the voting page — shown only when the artist has switched the kind on. **Outcome:** a song added to tonight's list (so the whole room can vote for it), a name the artist reads out, or a mood vote — paid for in **votes**, with an optional card offer on song requests that is captured only after the song is finished.

Three shapes, one mechanism: **song** (a title the artist doesn't have), **birthday** (a name), **vibe** (a free mood from a fixed list of twenty; the artist picks the song). Both paid kinds are off until the artist switches them on; every request keeps a vote-only path (INVARIANT 0w). Artists cannot post mood votes themselves (decision 0019).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| r01 | Is this kind switched on? | conditional | Automation | MySet server R · Fan I | Netlify | `show.requests.on` / `show.birthdays.on` (vibe is always on, cost 0). Off → **409 "Requests are off tonight"** / *"Birthday shout-outs are off tonight"*. The page does not offer a kind the server would refuse. `src: _requests.mjs createRequest; rule 4` |
| r02 | Is the show live and open? | conditional | Automation | MySet server R | Netlify | Not live → **409 "The show isn't live yet"**. Window closed → **409 "Voting is closed right now"**. `src: _requests.mjs` |
| r03 | Fill in the ask | form | Person | Fan R | — | Song: title (≤80) + artist (≤60). Birthday: a name (≤40). Vibe: one of `VIBE_OPTIONS`. Empty → **400 "What song?"** / *"Whose birthday is it?"* / *"Pick one of the vibes shown"*. `src: _requests.mjs` |
| r04 | Add a card offer? | conditional | Person | Fan R | Stripe | Song requests only: an optional whole-dollar offer ($1 = 1 paid vote). **yes** → r05. **no** → r06. `src: overview §1.3; decision 0018` |
| r05 | Authorise the offer | payment | Automation | MySet server R · Fan R | Stripe | `POST /api/pay {kind: 'request_hold'}`: a Checkout with `capture_method: 'manual'`, cards only — a **temporary authorisation**, not a charge. Returned to the voting page, `authorizeRequestSession` attaches the payment intent to the request as a *pledge*. `src: pay.mjs; _requests.mjs authorizeRequestSession` |
| r06 | Already got one in? | conditional | Automation | MySet server R · Fan I | Netlify | A retry with the same `requestId` or payment session → the existing row, `already: true` (idempotent). One open request **per kind per fan per show**: → **409 "You've already got a request in — wait for that one first"** / *"That shout-out is already in"*. More than `MAX_PENDING` open for the show → **429 "There are a lot of requests in already — try again in a bit"**. `src: _requests.mjs` |
| r07 | Charge the votes | database | Automation | MySet server R | Netlify | The kind's cost in votes (defaults in overview §2.1) is debited on the fan record inside `mutateFan`, with a marker `ask:<requestId>` so a retry cannot debit twice. Not affordable → the request is refused short. Unlimited devices pay nothing. `src: _requests.mjs createRequest` |
| r08 | Queue it for the artist | database | Automation | MySet server R · Artist I | Netlify | Written to `req_<aid>` (up to `MAX_KEPT` rows, oldest resolved dropped first). The artist gets a push alert if enabled (`_push.mjs notify`). The Live tab shows *requests waiting*. `src: _requests.mjs; overview §3.3 Live` |
| r09 | Accept, decline or mark done | conditional | Person | Artist R · Fan I | Netlify | `askAccept` (song only): adds the song to the setlist and marks the row `added`, so the whole room can now vote for it. `askDecline` → r10. `askDone` (birthday/vibe, or a song played) → `played`. `src: admin.mjs 885–964` |
| r10 | Decline: return the votes | database | Automation | MySet server R · Fan I | Netlify | Votes are refunded **only if the request belongs to the current show** — a request from an earlier show is deliberately not refunded because its credits have already refreshed and a refund would *mint* votes (INVARIANT 0ac). The message says what actually happened (`refunded` may be 0 if the write failed). The refund exists because **nothing was ever put on the board for it** — this is not the setlist rule. `src: _requests.mjs resolveRequest; overview §1.7` |
| r11 | Decline: release the card hold | payment | Automation | MySet server R · Fan I | Stripe | `cancelPledge`: the payment intent is cancelled while `requires_capture`; states tracked as `cancel_pending → cancelled`, or `captured` if Stripe already took it. `src: _requests.mjs cancelPledge` |
| r12 | Play the requested song | task | Person | Artist R | Netlify | The added song is played like any other (→ *The artist's night* a07/a08/a10). `src: admin.mjs askAccept` |
| r13 | Capture the offer when the song is finished | payment | Automation | MySet server R · Stripe webhooks I · Fan I | Stripe | `completeSongRequests(aid, songId)` runs on `endSong` (and at a fresh start, for anything left): pledges in `capture_pending` are captured — **only after the artist accepts, plays and finishes the song**. An uncompleted show end **releases** open pledges (`cancelOpenPledges` on the next fresh start). `src: _requests.mjs completeSongRequests, cancelOpenPledges; decision 0018` |
| r14 | Song hidden after accepting? | conditional | Automation | MySet server R · Fan I | Netlify | `declineRequestsForSong` — hiding an added song declines its request, returning votes and releasing the hold as in r10–r11. `src: _requests.mjs declineRequestsForSong` |

## Connections

r01 —on→ r02 → r03 → r04; r04 —yes→ r05 → r06; r04 —no→ r06; r06 —new→ r07 → r08 → r09; r06 —duplicate→ *the existing row*; r09 —decline→ r10 → r11; r09 —accept→ r12 → r13; r09 —done→ *closed*; r12 → r14 (if hidden) → r10.

## Rules that guard this section

- Every request has a vote-only path; a card is never required — INVARIANT 0w.
- A request is authorised now and captured only after the song is finished — decision 0018.
- Mood votes are free requests and artists cannot post them — decision 0019.
- A refund never mints votes: earlier-show requests are not refunded — INVARIANT 0ac.
