---
tab: The gig
section: The artist's night (Studio → Live)
puzzle_section_id: 41966
sources:
  - netlify/functions/admin.mjs — cases play, playTop, endSong, window, countdown, toggleSong, removeSong, declineSong, unplay, resetVotes, freeCredits, unlimited, unlimitedFan, replayCost, packs, askSet, status live/ended, newShow
  - netlify/functions/_lifecycle.mjs — startShow(fresh|resume), endShow
  - netlify/functions/stage.mjs — the Live tab's payload
  - MYSET-MASTER-OVERVIEW.md §1.6, §1.14, §1.15, §3.3 Live, §5.7
  - GIG-NIGHT.md
  - docs/decisions/0001, 0010, 0016, 0021, 0037
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps with roles, tools, connections)
verified: code read 2026-09-12 (admin.mjs switch cases; _lifecycle.mjs startShow/endShow)
---

# The artist's night (Studio → Live)

**Who:** the artist, or a team member with a role that allows running a show (role *Artist* / *Artist team member*, external), on their own phone, one-handed, in low light. **Trigger:** opening `/studio` on the night. **Outcome:** a show that started, played the room's choices, and ended — and was filed to the past-shows archive.

The Studio is dark-only by design. The Live tab polls `/api/stage` every 4 seconds.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| a01 | Sign in to the Studio | go_to | Person | Artist R | Netlify | → *Artist lifecycle → Signing in* (studio code, email link, passkey, or recovery code — no password exists). `src: ACCOUNTS.md §6, §9` |
| a02 | Read the Live tab | notification | Automation | MySet server R · Artist I | Netlify | Top: the **Voting** box (thin orange ring, Open/Paused — it lives here and nowhere else), the **Last call** button, a line saying when the show started or ended *by itself*, three tiles labelled exactly `Votes now`, `Voting · in room`, `Tips`. Then Now-playing + **My chart** (private notes), **▶ Start top voted**, the ranked queue with ▶ on every row, the Played list with undo, **■ End the show**, requests waiting, the free-plan gig-cap warning at two shows or fewer remaining, and *see what the audience sees*. `src: overview §3.3 Live; stage.mjs` |
| a03 | Start the show or resume it? | conditional | Person | Artist R | Netlify | **New show** = `startShow(fresh:true)`: archive the previous night first (before anything wipes the tally), new `showId`, `played[]` and the log reset, fans wiped **with their unspent bought votes carried**, open song-request pledges cancelled. **Start / Resume it instead** = `startShow(fresh:false)`: only the status flips; everything stays — the server cannot tell a new night from an accidental End, so the artist decides. `src: _lifecycle.mjs; INVARIANTS 13b, 17c` |
| a04 | Check the gig cap | conditional | Automation | MySet server R · Artist I | Netlify | The free plan allows a number of shows per calendar month (overview §2.1; decision 0036). At the cap → **402** with `CAP_REFUSAL` wording; the show does not start. Paid plans: no cap. The cap is the free tier's only gate — features are never the gate (decision 0003). `src: _lifecycle.mjs gigCapFor` |
| a05 | Pick tonight's setlist and place | task | Automation | MySet server R · Artist I | Netlify | If a calendar gig is near, its venue and city are copied onto the show and its named setlist becomes tonight's (*"Playing your 'X' tonight — N songs."*). A fresh artist-started night with no nearby gig clears the venue so five filed nights do not all carry one typed-in name. A setlist with nothing votable falls back to the whole library **and says so** (`listFellBack`). `src: _lifecycle.mjs tonightFor; stage.mjs` |
| a06 | Stamp the room size | database | Automation | MySet server R | Netlify | The plan's audience number is a billing line, not a door: stamped on the show at start so an upgrade mid-set does not change the room underneath the artist. `src: overview §1.12; _lifecycle.mjs roomCapFor` |
| a07 | Start the top-voted song | task | Person | Artist R · MySet server R · Fan I | Netlify | `playTop`: the pool is what the room can vote for right now (`votable()`, one definition), minus the song playing, minus played songs unless they hold replay votes, minus anything with zero votes. Empty → **409 "nothing left in the pool"**. Within `DOUBLE_TAP_MS` of the last start → **409 "That one just started — give it a moment"** (a retry would pick the *next* song down, the worst outcome). The tally is captured **before** it is wiped (`logPlay`), so the show log records what that song collected. `src: admin.mjs playTop; overview §1.16` |
| a08 | Start any song | task | Person | Artist R · MySet server R | Netlify | `play`: same as a07 for a named song; a second tap on the song already playing is a no-op. If another song was playing it moves to `played[]`. Replaying a played song takes it back out of `played[]`. Starting **opens the voting window**. `src: admin.mjs play` |
| a09 | Take the song's votes off the board | database | Automation | MySet server R · Fan I | Netlify | `consumePlayedVotes(aid, songId)` removes that song's entries from every fan's `v`. **Nobody gets credits back** — `used` does not move. Every other vote stands. `src: _lib.mjs; overview §1.6; decision 0001` |
| a10 | End the song | task | Person | Artist R | Netlify | `endSong`: nothing playing → **409 "Nothing is playing right now"**. The song goes to `played[]`, `nowPlaying` clears. If it was a paid song request, its authorisation is captured now (→ *Requests and shout-outs*). `src: admin.mjs endSong` |
| a11 | Pause or reopen voting | task | Person | Artist R · Fan I | Netlify | `window`: the orange-ringed Voting box. Paused → every cast is refused **409 "Voting is closed right now"** with no changes in or out; the tally is untouched. `src: admin.mjs window; vote.mjs` |
| a12 | Tap Last call | task | Person | Artist R · Fan I | Netlify | `countdown`: stored as an **end time** (`countdownAt = now + COUNTDOWN_MS`) so a poll landing anywhere inside it works; the payload sends **milliseconds left**. The button counts down on itself so a second one cannot fire over the first. A nudge, not a lock — voting stays open at zero. `src: admin.mjs countdown; overview §1.14; decision 0010` |
| a13 | Undo a played song | task | Person | Artist R | Netlify | `unplay`: the song goes back into the list. Its votes are already gone and do not return. `src: admin.mjs unplay; overview §1.15` |
| a14 | Hide or remove a song | task | Person | Artist R · Fan I | Netlify | `toggleSong` (off) / `removeSong`: the song leaves tonight's list and its votes come off the board (`dropSongVotes`). **Nobody is refunded.** Nothing in the code stops an artist deleting a song the room paid to hear (INVARIANT 15) — they keep the money. `src: admin.mjs; overview §1.6, §1.7` |
| a15 | Decline + refund an unplayed song | task | Person | Artist R · MySet server R · Fan I | Netlify | `declineSong`: the song is hidden, then `refundSongVotes` removes its votes and restores **the exact free/paid split** recorded in each vote's `[cost, paidCredits]` tuple. If the refund step fails after the hide: **503 "Song hidden, but the vote return is still finishing — tap 'Decline + refund' again"** (idempotent retry). The one setlist exception to finality. `src: admin.mjs; _lib.mjs refundSongVotes; decision 0016` |
| a16 | Clear the board | task | Person | Artist R · Fan I | Netlify | `resetVotes` → `wipeBoard`: every song's votes go at once; **nobody is refunded, and the confirm says so before the tap**. `src: admin.mjs resetVotes; overview §1.15` |
| a17 | Change a price mid-show | task | Person | Artist R | Netlify | `freeCredits` (incl. ∞), `replayCost`, `packs`, `askSet` (requests/birthdays on/off and their costs), `unlimited` (whole room), `unlimitedFan` (one device — the artist's own phone, so testing does not eat the room's credits; no plan gate at all). A new free-vote number applies to **future casts only** — `freeUsed` already stamped is never re-priced. Packs are clamped server-side (overview §2.1). `src: admin.mjs; overview §1.4, §1.8, §1.9` |
| a18 | Accept or decline a request | go_to | Person | Artist R | Netlify | → *Requests and shout-outs* (`askAccept` / `askDecline` / `askDone`). `src: admin.mjs` |
| a19 | End the show | task | Person | Artist R · MySet server R · Fan I | Netlify | `status: ended` → `endShow(by:'artist')`: **archive first, always** (`archiveShow` with a title; a title-less night falls back to the venue/date); idempotent — ending an ended show refreshes the archive and changes nothing else. Unspent **bought** credits survive; free credits and the board do not. Gift pledges are honoured at this boundary. `src: _lifecycle.mjs endShow; overview §1.6, §1.8; INVARIANT 17c` |
| a20 | Was that an accident? | conditional | Person | Artist R | Netlify | *Resume it instead* → a03 (fresh:false): the night comes back exactly as left; a fan's gift pledge is quietly cancelled and they are made whole. `src: overview §1.7, §1.13` |
| a21 | Read tonight's numbers | notification | Automation | MySet server R · Artist I | Netlify | Studio → Money: the songs played, the votes each won, what the room wanted and never got (`leftover`), the vote-pack/tip split, every payment, bug reports from the room, and *What the room said*. One vote is counted once: when its song plays, or in `leftover`. `src: overview §1.16, §3.3 Money` |

## Connections

a01 → a02 → a03; a03 —new→ a04; a03 —resume→ a02; a04 —under cap→ a05 → a06 → a02; a04 —at cap→ *402, stays on a02*; a02 → a07 / a08 / a11 / a12 / a13 / a14 / a15 / a16 / a17 / a18 (any time while live); a07 → a09; a08 → a09; a09 → a10 → a02; a02 → a19; a19 → a20; a20 —accident→ a03; a20 —done→ a21.

## Things the artist cannot do (deliberately)

- Refund on play, hide, delete, clear or end (decision 0001). Only a15 refunds.
- Turn *Last call* into a lock — there is a separate switch for that (a11).
- Make the room bigger mid-set by upgrading — the size is stamped at start (a06).
- Start a show past the free plan's monthly cap (a04) — the only thing the free plan refuses; every room-facing feature stays free on every plan (VISION rule 3).
