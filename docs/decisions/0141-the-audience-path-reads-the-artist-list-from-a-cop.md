---
id: 0141
title: The audience path reads the artist list from a copy up to a minute old
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: scale
reverses:
superseded_by:
invariants: [0dd, 9d13, 0hp]
commits: [8306251]
tests: [test/cost.mjs]
files: [netlify/functions/_auth.mjs, netlify/functions/_lib.mjs]
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

One document, `artists`, holds every artist. `publicArtist()` read it from the
store on every request for a slug address: every poll, every vote, every page
load. With six artists it is a few kilobytes. The 2026-10-02 scale audit measured
about 215 KB at 1,000 artists and estimated 2 to 3 MB at 10,000 — read and parsed
thousands of times a second across live rooms, and growing with every sign-up.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The public slug lookup uses a copy kept in the function instance for up to 60 seconds. A "no" from the copy is always re-asked of the store. Sign-in checks and plan lookups keep reading the store. | A page that left in the last minute can still answer on a warm instance | `readArtistsPublic`, `__flushArtists` | A stale "yes" for a minute |
| B | Cache every reader, including sign-in | Nothing more | Same | A signed-out phone works for up to a minute (breaks 0dd) |
| C | Split the registry: one small file per slug, per artist, per email | A migration | Three key families, a writer for each | The right long-term shape; days, not hours |
| D — do nothing | Fine today | Nothing | None | The hottest path grows with the square of success |

## What was chosen, and why

A now; C is the audit's next step and this does not get in its way.

- The flags document has been cached this way since it was added (`_flags.mjs`).
- **Only a YES is trusted.** A slug the copy does not know, or an account it shows
  as leaving, is asked of the store. So a page made a second ago opens at once, on
  any instance, and an undone deletion comes back at once.
- **Sign-in never uses it.** Signing out must take effect on the next request (0dd).
- **Pricing never uses it.** `planForArtist` still reads the store, so a checkout
  never prices against a plan a minute old.
- A registry write from the same instance clears the copy.

## What this makes harder

An account deleted on one instance can keep answering public requests on another
warm instance for up to a minute. The Studio and sign-in are not affected.

## What would reverse it

The registry split (C) landing: a per-slug file is small enough to read every time,
and this copy would then be removed rather than kept beside it.

## How it was verified

`node --import ./test/register.mjs test/cost.mjs` — 30 passed, 0 failed. New cases: a
warm poll for a slug artist reads no global document; an unknown slug costs one
read; a sign-up on this or another instance resolves at once; a deletion on another
instance may answer until the copy is refreshed; an undone deletion is back at
once; a deletion on this instance is dark at once.

**Not checked:** how long Netlify keeps an instance warm in production, which
decides how often the one read a minute actually happens.
