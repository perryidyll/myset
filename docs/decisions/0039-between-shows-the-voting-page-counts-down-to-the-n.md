---
id: 0039
title: Between shows the voting page counts down to the next gig, and the wrap-up card lasts three hours
date: 2026-09-12
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/darkroom.mjs, test/split.mjs, test/syntax.mjs]
files: [netlify/functions/_board.mjs, public/vote.html, public/artist.html]
---

## The question

A fan who opens the voting page with no show running saw, at the top, a card
labelled **Tonight** reading *"That's all — see you next time"* — for ever, whether
the show ended ten minutes ago or ten days ago — and under it an **Up next** box
with nothing in it. The user asked for the card to mean what it says: keep the
wrap-up for the three hours after a show, when someone might still want to say
something about the night, and after that tell the room when the *next* show is
instead; drop the word "Tonight"; and do not draw an empty queue until a show has
actually started.

The page could not do that on its own. The shared board payload (`/api/board`)
said `status: 'ended'` but not *when*, so "three hours after" was unanswerable, and
the page had never read the artist's calendar.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The board carries `endedAt` (server clock, only while `status==='ended'`). The page compares it with the board's own `at`, shows the wrap-up inside three hours, and otherwise fetches `/api/events?a=<slug>` once and counts down to the next gig with the same label as the artist page. Up next is drawn only while live. | One field on a cached payload; one extra request per dark-room page open (not per poll) | A gig loader and a one-second tick on the vote page | A stale `endedAt` on a resumed show — avoided by sending it only while ended, and `_lifecycle.mjs` sets `status:'live'` on resume |
| B | Guess "recent" from the phone's clock and the page's own memory of when it last saw `live` | Nothing on the server | Per-phone state that a fresh open has none of | A phone that arrives after the end never sees the wrap-up; one that was open all night sees it for ever |
| C | Put the next-gig details on the board payload itself | No second request | The board reads the calendar on every poll for the whole room | Raises the per-poll read count `test/cost.mjs` holds the board to |
| D — do nothing | Keep the permanent "Tonight — that's all" card and the empty queue | Nothing | — | The page keeps claiming a night that is long over |

## What was chosen, and why

A. The user asked for exactly this behaviour; the only decision was where the
clock lives. Both timestamps are the server's (`at` is stamped before the reads
begin; `endedAt` by `_lifecycle.mjs` at End), so a phone whose clock is wrong gets
the same answer as everyone else — the same reasoning as the last-call countdown
(decision 0010). The calendar is read once per dark-room open, not per poll, so a
room of phones between shows costs what it did before plus one request each.

The countdown wording is copied from `artist.html` (`nextLabel`) rather than
shared, because the two pages share no script and the copy is nine lines. The
artist page's pill now also says "(view setlist)", because it is a real link and
read as a status.

## What this makes harder

`endedAt` is now part of the public board's shape, so it cannot quietly change
meaning. A show ended before the stamp existed has no `endedAt` and reads as
"long ago" — the wrap-up will not show for it, which is right for anything more
than three hours old and wrong for nothing that still exists.

## What would reverse it

An open line to the room (P3-002) could push the next gig with the show state and
remove the second request. If artists stop keeping the calendar, the countdown
box would read "Nothing scheduled yet" more often than not, and a plainer card
would be better.

## How it was verified

- `node test/syntax.mjs` — every inline block of `vote.html`, `artist.html`,
  `index.html`, `studio.html` compiles.
- `sh test/run.sh` — see the session file for the count; `test/split.mjs` (the
  board carries nothing personal) and `test/darkroom.mjs` (the ended board's
  shape) both pass with the new field.
- Not checked in a browser against a real ended show: the three-hour boundary
  itself, and the countdown ticking. The founder's page is the only live account
  and its show state is whatever the last gig left it.
