---
id: 0204
title: A sample page is erased leaves first, and its register row goes only when nothing it names is left
date: 2026-10-09
status: decided
decided_by: claude
area: storage
reverses:
superseded_by:
invariants: [0jg]
commits: []
tests: [test/sampleerase.mjs, test/samples.mjs]
files: [netlify/functions/_sample.mjs, test/sampleerase.mjs]
---

## The question

The scale audit of 2 October 2026 (*Background jobs fall behind*): "account deletion removes the index first, so a killed run orphans files". Decision 0173 fixed it for accounts and venues with `eraseKeys`, which walks a key list from the end so that what an index names goes before the index. A sample page's erase, `eraseData` in `_sample.mjs`, was not moved onto it. It deleted in the key list's own order (the show, meta and profile first), put the pictures after the profile that names them, swallowed every failed delete, and its callers (Delete forever, Cancel page, a rebuild, the 180-day clock) then dropped the register row whatever had happened. Every key in MySet is computed from an index, never listed (INVARIANT 1), so a file left behind with nothing naming it is stored, and mirrored, for ever. A failed read of the profile or the key list was swallowed too, and the erase went ahead blind. The founder asked on 2026-10-09 for every audit item that needs no answer from him to be done.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: `eraseData` through `eraseKeys`, and throw when it stops** | One list (the record, the key list, the pictures), walked from the end with its namers; the first failed delete or read throws, so the caller never drops the row. | A failing store now makes Delete forever, Cancel or a rebuild answer an error instead of "done". | None: `eraseKeys` exists (0173). | The founder retries; the row and its files are still there to retry on. |
| B — reorder only, still swallow | Leaves first, failures ignored, row dropped. | Smaller. | None. | A failed leaf is still orphaned when the row goes. |
| C — a background purge with a cursor, like accounts | Delete in rings with a saved cursor. | More code; a sample holds a dozen keys, which one call deletes well inside the limit. | A queue. | Unneeded at this size. |
| D — do nothing | — | — | — | Files nothing can name, kept and mirrored for ever. |

## What was chosen, and why

A, because the account path already proved the walk, and a sample is small enough to erase in one call. Throwing is the important half: the register row is the root that names everything else, so it may only go once the erase has run whole.

## What this makes harder

A store hiccup during Delete forever, Cancel page or a rebuild now shows the founder an error, where it used to say done and leave files behind.

## What would reverse it

Samples growing past what one call can erase (hundreds of keys), which would move them onto the account's cursor-and-ring purge.

## How it was verified

- `node --import ./test/register.mjs test/sampleerase.mjs` → 8 ✓ / 0 ✗: a sample with a cover and a portrait (five documents) is deleted forever with the store failing after each of 0…5 deletes; every time, while anything is left the row is still there and everything left is named by the key list, the profile's pictures or the record, the run threw, and the next Delete forever finished and left nothing. A rebuild that keeps its photos still keeps them.
- Knock-outs, each red then restored: the old `eraseData` (2 ✗), the throw removed (2 ✗).
- `test/samples.mjs` 131 ✓ (building, claiming, the clock, Delete forever, venues).
- Not checked: a real store failure.
