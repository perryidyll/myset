---
id: 0069
title: every document is copied nightly to R2 under the same key, and a restore from the laptop copy has been rehearsed and refuses production by name
date: 2026-09-14
status: decided
decided_by: perry
area: ops
reverses:
superseded_by:
invariants: [0ft]
commits: []
tests: [test/foundations.mjs]
files: [netlify/functions/_mirror.mjs, netlify/functions/mirrorcron.mjs, tools/backup.py, test/blobs-fake.mjs, test/r2-fake.mjs]
---

## The question

Every byte of live data was on one Netlify store; the only copies were two on
the founder's laptop (and its SSD mirror), both taken the same weekend, by hand,
with a restore that had never been run — the script said so, deliberately. The
storage report's third gap. The founder asked for the second home and the
rehearsal.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A scheduled function (`mirrorcron`, every 20 min) walks the registries and, per owner, the same key list export and delete use, asks each key for its etag only and copies to R2 (`backup/<key>`, same key, content type kept) only what changed since the owner's manifest. Time-boxed with a cursor; a ring after a finished pass is one read until the pass is a day old. Never fan shards, sessions, lockouts, sign-in codes or the auth secret. Plus `backup.py --restore DIR --store NAME` (refuses `myset`) and `--wipe`, rehearsed against a separate store on the production site. | Per night: one metadata read per key, a copy per changed key, ~1 GB-month on R2 at today's size (cents). 72 rings a day of a function that mostly returns at once. | `_mirror.mjs`, `mirrorcron.mjs`, `mirror_<owner>` manifests, `mirror` state | A pass that never finishes at scale — the cursor carries it over rings; a stuck cursor is visible in the state document. |
| B | The laptop backup on a schedule (launchd, or a Claude scheduled task). | Needs the laptop awake and signed in; still one machine, one vendor's CLI. | a standing job on the founder's Mac | The founder's laptop is the backup's single point of failure — the thing this decision exists to remove. |
| C | A throwaway Netlify site for the rehearsal, as SECURITY.md suggested. | Creating a site on the founder's account, unasked. | a site to forget | Nothing; a separate store on the same site is the same namespace isolation with less to clean up — the functions only ever open `myset`. |
| D — do nothing | | One vendor away from losing every night. | | |

## What was chosen, and why

A: the R2 bucket already exists (the clips), the R2 client already exists and is
tested against a signing fake, and a copy nobody has to take is the only copy
that is reliably taken. Skipping by etag makes a nightly pass over ten thousand
artists a metadata read per key and a copy of the day's changes; write-once
documents (a night, a version, a log part) cross exactly once. The manifest is
per owner so the pass is naturally sharded and a stale owner cannot block the
rest. Secrets are not copied: a second copy of a secret is a second place to
lose it, and a restore regenerates them. Fan shards are tonight's device records
— wiped at the end, never exported — and a restore of a show in progress from a
nightly copy is not a thing.

The rehearsal ran the whole copy, not a sample: 209 keys, 274 MB, into store
`rehearsal-20260914` on the production site, every key read back and compared
by sha256, then wiped. The number and the time are in the session note.

## What this makes harder

A second place data lives, to be thought of on delete (the mirror keeps what
Blobs deleted — that is a backup's job; a hard delete on request has to reach
R2 too, and does not yet: named in the session note as the open item). A new
per-owner key must be in `keysFor()` to be copied — the same rule export and
delete already impose.

## What would reverse it

R2's bill at scale (its egress is free; storage is cents a GB). A vendor that
offers point-in-time restore natively. A deletion law that makes a backup's
retention the harder problem — then the mirror gains a delete path first.

## How it was verified

`test/foundations.mjs`: a pass copies every key an owner holds under
`backup/<key>`, never a shard, a session or the secret; the next ring does
nothing; a day later everything is skipped by etag; a changed document and its
new version cross and the bytes on R2 are the document; a budget of 0 ms does
one owner per ring and the cursor carries on until done; with R2 off the ring
says so. Against the real store: `python3 tools/backup.py --restore … --store
rehearsal-20260914` — the log is quoted in the session note; `--store myset` is
refused (run, exit 1). Not checked: the first scheduled ring in production —
the function log after the deploy is the measurement.
