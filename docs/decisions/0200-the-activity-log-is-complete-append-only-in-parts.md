---
id: 0200
title: The activity log is complete: append-only, in parts, never trimmed
date: 2026-10-09
status: decided
decided_by: perry-confirmed
area: storage
reverses:
superseded_by:
invariants: [0jc, 0hb]
commits: []
tests: [test/activity.mjs, test/foundations.mjs, test/seal.mjs]
files: [netlify/functions/_session.mjs, netlify/functions/_append.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs]
---

## The question

The activity log — who signed in, who was added to the page, when the Studio code
changed, when a recovery code was used — was `log_<owner>`: one document, the newest
hundred entries, the hundred-and-first gone. It is the one record a musician asks for
when something feels wrong ("did somebody else get into my page?"), and it forgot its
own beginning. SECURITY.md named it under Tier 2: *"Today's audit log is 100 entries
per account. A real one is append-only, off-platform, and survives a deleted
account."* Decision 0068 had already made the rule for every other capped list in the
store: a capped list must have a complete sibling. This was the one security record
still without one.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `note()` appends to an `_append.mjs` log: a head of at most two hundred entries, oldest first, spilled into write-once parts `log_<owner>_p<n>`; the screen reads the newest twenty-five from the head and, just after a spill, the last part; the parts join the export-and-delete key lists; the nightly mirror copies them like every other document, and never deletes a copy | One CAS write per entry, as before; a part write every two hundred entries; one more cold read on the screen just after a spill | A `size` and an `upgrade` option on `appendLog`; `LOG_CHUNK`; `logKeys` on both account key lists | A log kept the old way read wrongly — the suite takes one over and reads it before and after its first new note |
| B | A write per entry straight to R2 as well | Fifty to a hundred milliseconds on every sign-in, code send and seat change, with no `waitUntil` to hide it; a second failure mode on the sign-in path | An R2 PUT in `note()` | A slow or refused R2 slows every door that notes something |
| C | Raise the cap to a thousand | Nothing | A number | Still a record that forgets; a bigger document on every append |
| D — do nothing | A hundred entries | Nothing | None | The account's security record is the only capped list left in the store |

## What was chosen, and why

A, because the machinery already existed and had been proven by the night's event log
(0066) and the archives (0068): write-once parts, computable keys, no `list()`
(INVARIANT 1), a head that names its parts so export and delete find all of it. What
this decision added:

- **Oldest first on disk, newest first on the screen.** The old document was
  newest-first; an append-only log must push to the end. A log kept the old way is
  taken over on its first new note — reversed and counted, inside the same CAS write —
  so nothing already recorded moves, and a log nobody writes to again still reads as
  it did.
- **Two hundred, not two thousand.** `_append.mjs` spills at two thousand by default,
  which is right for a night's votes and heavy for a document read on every sign-in.
  A part of two hundred keeps the head small; `appendLog` grew a `size` option for it,
  with the default untouched.
- **The screen is never empty just after a spill.** A spill empties the head, so the
  newest twenty-five are read from the head and then the last part — one extra read,
  only on the screen that asks, only until the head has twenty-five again.
- **Off-platform and outliving the account, by what already runs.** `log_` is a
  sealed family (0113), parts included — the prefix test covers `log_<owner>_p<n>` —
  and every key on an owner's list is copied to R2 by the nightly mirror, which copies
  and never deletes (`_mirror.mjs`). The parts are now on that list. So the record is
  encrypted at rest, copied off Netlify nightly, and the copy stays when the account
  goes. That is the Tier 2 line, met by two lines of key-listing rather than a new
  pipeline.
- **Written best-effort, still.** `note()` keeps its `.catch(() => {})`: a logging
  failure is never the reason a musician cannot start a show.

Decided by the founder's "do all of this" against the list that named it.

## What this makes harder

- The R2 copy outlives a deleted account on purpose. That is what a security record
  is for, and it is the mirror's existing behaviour for every document; but a future
  "the R2 copy on a hard delete" (SECURITY.md Tier 1) must leave `log_` out, or decide
  otherwise in a record of its own.
- A log that has spilled costs the screen one more read for up to twenty-five entries
  after each spill. On a log that notes a few times a week that is rare; on a busy
  five-seat page it is still one cold read on one screen.
- `appendLog` has one more option. Anyone changing its spill must keep `size` honoured
  — `test/activity.mjs` would say so.

## What would reverse it

- A sign-in path measured slower by the larger head, which would argue for a smaller
  `LOG_CHUNK`, not for a cap.
- A legal requirement to erase the log with the account, which would move the R2 copy
  into the delete path for this family alone.

## How it was verified

`node --import ./test/register.mjs test/activity.mjs` — 23 checks: two hundred and
fifty notes leave one part, fifty in the head, two hundred and fifty counted, every
entry readable in order with its moment, kind, who and note; the screen reads the
newest twenty-five newest first, and three when asked for three; two hundred notes
leave an empty head and the screen still shows twenty-five from the part, then the
next note fills in ahead of it; a log written the old way reads as it did and after
its first new note reads all four newest first, oldest first on disk with its count
and no part; a log nobody wrote reads as empty; the artist's and the venue's key lists
name the head and the existing part and not a part that does not exist; the head and
a part are a sealed family; the Studio's `activity` door returns twenty-five rows
newest first; a part is write-once; the raw part holds two hundred.

Mutation-checked: with the screen's read of the last part removed, two checks fail.
`test/foundations.mjs` (the append log's own suite, 64), `test/seal.mjs` (68),
`test/accounts.mjs` (235) unchanged and green.

Not checked: the nightly mirror carrying a part to R2 on production — it copies
whatever `keysFor` names, and `test/activity.mjs` pins that the parts are named.
