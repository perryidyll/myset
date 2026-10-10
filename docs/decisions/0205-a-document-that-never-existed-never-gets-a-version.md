---
id: 0205
title: A document that never existed never gets a version, even when its blank carries the clock
date: 2026-10-10
status: decided
decided_by: perry-confirmed
area: storage
reverses:
superseded_by:
invariants: [0fr]
commits: [b9467b6]
tests: [test/foundations.mjs]
files: [netlify/functions/_versions.mjs, test/foundations.mjs]
---

## The question

`casKeep` (decision 0067) keeps the bytes of a document before every change, and promises never to keep a version of a document that did not exist: it serialises `fallback()` once as the blank and compares what the write read against it. But `casDoc` called `fallback()` again for each read of the missing document, and `defaultProfile()` carries `updatedAt: Date.now()`. When the two calls fell in different milliseconds the read no longer matched the blank, and a version of a profile that was never written was kept as the oldest entry of a brand-new artist's history. Restoring it would wipe what they typed. The same race made `test/foundations.mjs` ("A VERSION BEFORE EVERY OVERWRITE") fail at random, and since 0197 made the suite a required check, that could block any pull request. Found while merging #264 on 2026-10-10; the founder asked for the fix the same day.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: `casKeep` makes the blank once and hands every read a fresh copy of its bytes** | `const same = () => JSON.parse(blank)` replaces `fallback` in the `casDoc` call. | One parse per read of a missing document. | None. | None found: the missing document reads exactly as before, with one timestamp for the whole call. |
| B — drop `updatedAt` from `defaultProfile()` | The profile's fallback becomes constant. | Changes what a new profile reads as; leaves the trap for the next fallback that stamps the clock. | None. | The next time-varying fallback brings the bug back. |
| C — compare without `updatedAt` | Strip the field before comparing. | Special-cases one field in a general door. | A field list to keep true. | Any other varying field slips through. |
| D — retry the test | Nothing changes. | A red required check on random pull requests. | — | Blank versions keep being kept. |

## What was chosen, and why

A, because the promise belongs to `casKeep`, so `casKeep` should keep it whatever its fallback does. A fresh object for each read matters: `fn` mutates what it is handed, and a shared object would carry a lost try's changes into the next try.

## What this makes harder

Nothing.

## What would reverse it

A fallback that must differ between the tries of one write, which no caller has.

## How it was verified

- `node --import ./test/register.mjs test/foundations.mjs` → 106 ✓ / 0 ✗, every run. Two new checks: `casKeep` handed a fallback that reads differently on every call, and the real `mutateProfile` for a new artist with `Date.now` a millisecond on at every call (first write keeps none; the second keeps one, the first name, never a blank). On the old `casKeep` all three assertions are red (103 ✓ / 3 ✗). The profile-path check was suggested by another session, which measured the same.
- The whole suite, `sh test/run.sh`.
- Not checked: whether any live profile already holds a blank version from before this fix. Finding one needs a read of each artist's oldest version; it is harmless unless someone restores it.
