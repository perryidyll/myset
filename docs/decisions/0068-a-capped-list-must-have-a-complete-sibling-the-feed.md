---
id: 0068
title: a capped list must have a complete sibling — the feed and the feedback list spill into archives, and an id once minted is never reused
date: 2026-09-14
status: decided
decided_by: perry
area: storage
reverses:
superseded_by:
invariants: [0fr, 0fs]
commits: []
tests: [test/foundations.mjs, test/community.mjs]
files: [netlify/functions/_append.mjs, netlify/functions/_community.mjs, netlify/functions/_feedback.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, INVARIANTS.md]
---

## The question

Several lists in the store are capped so a screen reads one small document:
`histidx_` at 400 rows, `posts_` at 200, the feedback notes at 200, `histpend_`
at 50, `show.log` at 200 entries. History already had the pairing right — the
index is capped, `histids_` is append-only and complete, and `_account.mjs`
says why in a comment. The audit for the storage report found two that did not:
past 200 the community feed **sliced off its oldest posts for ever**, and with
them the only reference to their photos and clips — bytes on disk nothing could
find or delete again (INVARIANT 1 forbids the one call that could) — and past
200 the feedback list dropped what the room had said. The founder's brief was
that nothing be lost.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The rule: a capped list must have a complete sibling. The feed and the feedback list spill their overflow into `postsarch_<owner>` / `fbarch_<aid>` — append-only logs, never trimmed, chunked (`_append.mjs`) — BEFORE removing it from the list; a crash between the two writes appends again next time and the reader dedups by id. `keysFor()` and `keysForVenue()` enumerate the archives and the photo and clip keys of every archived post. | Nothing until a list is full; then one read and one append on the write that overflows. | the archives, two readers | A crash between the append and the trim duplicates in the archive — chosen over the other order, which would lose. |
| B | Raise the caps. | The page reads a bigger document every open; the cap moves, the loss does not. | | |
| C | Drop the caps. | The community page reads every post ever on every open. | | The Studio's cost ceilings. |
| D — do nothing | | Orphaned bytes and a feed that forgets. | | |

Also decided here, because it is the same rule seen from the other side: **an id,
once minted, is never reused and never changes meaning** — artist, venue, show,
song, post, clip. They already were; it is now INVARIANT 0fs, because the event
log, the versions, the archives and the mirror all key on them, and a migration
at any scale depends on it.

## What was chosen, and why

A, because it costs nothing on the common path and turns a loss into a cheap
read. "At least once into the archive, never lost" is the right failure shape
for a record; a duplicate reads once. The remaining capped lists are paired or
harmless: `histidx_` ↔ `histids_` (already); `show.log` (200) ↔ the night's
event log (0066), which files every play; `histpend_` (50) is a work queue
whose complete answer is `histids_`; the Studio's `casts` (20) and `gr` (40) on
a fan record are idempotency windows, not records.

## What this makes harder

A new capped list has to name its sibling in the same change, and a reviewer has
to ask. Two more key families in the account walkers.

## What would reverse it

An archive that grows past what a chunked log reads comfortably (it is chunked;
the reader reads parts in parallel) — then the reader pages. Nothing else.

## How it was verified

`test/foundations.mjs`: 205 posts → 5 spill, the feed keeps the newest 200, the
archive holds the five oldest in order, spilling again moves nothing, a post
appended twice reads once, `keysFor` names the archive and the photo and clip of
a post that left the feed; 203 notes → 3 spill, the Studio list keeps 200. And
the cost: `test/community.mjs` "a post, reads — 8 (ceiling 8)" still holds —
the spill costs nothing until the list is full. Suite exit 0.
