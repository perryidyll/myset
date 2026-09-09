---
id: 0016
title: An artist-declined unplayed song returns its votes
date: 2026-09-09
status: decided
decided_by: user
area: voting
reverses: 0001
superseded_by:
invariants: [13, 13b, 14, 14b, 15]
commits: []
tests: [test/decline.mjs, test/finality.mjs, test/votesstay.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/vote.mjs, netlify/functions/admin.mjs, netlify/functions/stage.mjs, public/vote.html, public/studio.html]
---

## The question

A setlist can contain a song the artist cannot or will not play tonight, or a song
that was performed without being marked as played. The board previously let the
artist hide or delete that song, but the votes disappeared without returning to the
fans. The artist needs an explicit way to decline an ordinary, unplayed song and
return those votes.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Add a distinct **Decline + refund votes** action for an unplayed song; hide it and restore every attached free/paid credit | Per-vote source attribution and a twelve-shard refund pass | One compact `va` allocation map on each fan record | Restoring the wrong kind of credit, minting credits on retry, or accepting new votes during the refund |
| B | Reuse Hide or Delete and refund implicitly | Less UI | Same ledger work | A familiar destructive action changes financial meaning without saying so |
| C | Remove the song but keep all credits spent | No ledger change | None | The artist still has no fair way to correct an unusable queue entry |

## What was chosen, and why

Option A. It is deliberately narrower than an un-vote: fans still cannot change or
withdraw their own votes, and play, replay, hide, delete, clear-board and end-show
paths still do not refund. Only the artist's explicit decline action does.

Each newly cast vote records a compact `[cost, paidCredits]` tuple under its song id.
This handles both ordinary one-credit votes and replay votes that can straddle the
free/paid boundary. The artist-facing stage payload derives `paidVotes` by counting
held vote instances with a non-zero paid portion. Decline is offered only for
unplayed songs, makes the song inactive before touching fan shards, then removes its
votes and subtracts their exact free and paid portions from the ledger. A retry sees
no votes and cannot restore anything twice.

Records created before attribution use a fan-favouring paid-first fallback. That
case cannot be reconstructed exactly because older records stored aggregate spend
but not its song-level source.

## What this makes harder

- A vote's source must stay aligned with its board entry whenever votes are cast,
  played, cleared, carried to a new show, deleted, or declined.
- Decline touches all fan shards. If a shard write fails, the client retains its old
  screen and can repeat the same idempotent action; the song is already hidden, so
  no new vote can race into the refund.
- Paid-vote counts are exact only for votes cast after source attribution shipped.

## What would reverse it

Evidence that artists use decline to erase legitimate requests after taking money,
or a product decision to make every removal refundable. Either change would require
new wording and a new decision; it must not silently alter Hide or Delete.

## How it was verified

`test/decline.mjs` casts free and paid votes across two songs and two fans, verifies
the artist sees total and paid counts, declines one song, checks each fan's exact
restored balance, proves the other song is unchanged, retries the action, and proves
the retry cannot mint credits. Existing finality tests continue to pin every
non-decline path as non-refundable.
