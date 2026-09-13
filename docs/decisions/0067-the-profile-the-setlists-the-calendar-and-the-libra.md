---
id: 0067
title: the profile, the setlists, the calendar and the library keep a version before every overwrite — write-once, at most one every thirty seconds
date: 2026-09-14
status: decided
decided_by: perry
area: storage
reverses:
superseded_by:
invariants: [0fr]
commits: []
tests: [test/foundations.mjs]
files: [netlify/functions/_versions.mjs, netlify/functions/_append.mjs, netlify/functions/_profile.mjs, netlify/functions/_lists.mjs, netlify/functions/_events.mjs, netlify/functions/admin.mjs, netlify/functions/_account.mjs]
---

## The question

Every document in the store was overwritten in place. A profile saved wrong, a
setlist emptied, a song deleted from the library, a gig edited to the wrong
night — the old bytes were gone the moment the CAS write landed, and the only
history was the laptop backup, of which there were two copies, both from the
same weekend. The storage report (2026-09-13) named it the second of three real
gaps; the founder said build it.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `casKeep()`: the CAS loop captures the document as read; if the write changed it, the old bytes go to `ver_<key>_<ts>` (write-once) and the timestamp to the append-only `vers_<key>`. Used by `mutateProfile`, `mutateLists`, `mutateEvents`; the show record only when `admin.mjs` measures a library change. At most one version per key per 30 s: a burst of taps keeps the state before the burst. | One read of the version index and two writes, on a Studio save — never on a poll, a vote or a play. Bytes: a version per real change; the library is the big one (kilobytes each). | `_versions.mjs` | A version taken of a document that did not exist would be junk — the fallback's bytes are recognised and skipped. |
| B | Netlify Blobs' own versioning. | It does not have one. | | |
| C | Version every document on every write. | The show record is CAS-written by every vote; a version per vote is a second write on the hottest path and megabytes a night of noise. | | Rule 5's contention, for nothing anyone would restore. |
| D — do nothing | The backup is the history. | A seven-day cadence, on one laptop; "undo" is a support ticket to the founder with a JSON file. | | |

## What was chosen, and why

A: only the documents a PERSON edits, at the moment a person edits them, and
never twice inside half a minute. Building a setlist is fifty writes in a minute;
the version anyone wants back is the one from before the first tap, and that is
the one kept. The library door is `libChanged`, the measured comparison
`admin.mjs` already makes (an allow-list of actions was rejected there for the
same reason it would be wrong here), so a play, a price or a vote never makes a
version.

No restore button yet. The versions are readable (the export carries the bytes
for the small documents and the timestamps for the library; `listVersions` /
`verKey` name every one) and a restore is one CAS write from a version's bytes —
that is a Studio feature the founder can ask for when the first person needs it,
and the data will be there.

## What this makes harder

A key that is versioned is two writes on a save instead of one. A new hand-edited
document should go through `casKeep`, and the reviewer has to notice. Versions
are keys `keysFor()` must enumerate (it does, from the index); a delete walks
them.

## What would reverse it

Storage cost that shows on a bill — then the gap widens or the library is
versioned by diff. A vendor that versions objects natively.

## How it was verified

`test/foundations.mjs`: the first write of a missing profile keeps nothing; two
changes inside thirty seconds keep one version and it is the profile from
before the burst; thirty seconds on, another; the version is write-once; the
keys are computable; the library is versioned on `addSong` and not on `play` or
`freeCredits`, and the kept bytes are the library without the added song; a
setlist's first write keeps nothing and its second keeps the first; the
calendar goes through the same door. 60 ✓, suite exit 0.
