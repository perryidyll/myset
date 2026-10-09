---
id: 0113
title: The records that hold a person are sealed at rest under a keyring the secret wraps, so a new secret re-wraps one document
date: 2026-09-28
status: proposed
decided_by: claude
area: storage
reverses:
superseded_by:
invariants: [0hb]
commits: []
tests: [test/seal.mjs, test/secret.mjs, test/foundations.mjs, test/gmail.mjs]
files: [netlify/functions/_seal.mjs, netlify/functions/_lib.mjs, netlify/functions/_cred.mjs, netlify/functions/_img.mjs, netlify/functions/_append.mjs, netlify/functions/_versions.mjs, netlify/functions/_gmail.mjs, netlify/functions/_mirror.mjs, netlify/functions/mirrorcron.mjs, tools/backup.py, tools/prod.py]
---

## The question

Netlify encrypts the store's disks. That does nothing about the ways a document
actually leaks: a Netlify token that reads the store, the nightly copy on R2, a backup
on a laptop, a deploy preview reading the live store. Every one of those handed over,
in the clear, the booker's email and phone, the ID photos waiting for review, the
password hashes, the recovery codes, every session, the error log and — since `0108`
— HQ's contacts and the founder's Gmail tokens.

## What was chosen

**Seal those records, and nothing the room reads.** `protectedKey` is an allow-list of
prefixes: `msg_`, `inbox_`, `inboxarch_`, `cred_`, `rec_`, `sess_`, `log_`, `push_`,
`bugs_`, `err_`, `crm` (HQ's index, contacts and Gmail record), `idqueue`, the ID
photo, and — since main grew it in `0127` — the Studios' suggestions box (`suggest`), a
name and free text like a bug report. `readDoc` opens and `casDoc` seals, so every caller is covered without a
change; the four raw writes (a password, an ID photo, a spilled log part, a version)
seal themselves. AES-256-GCM, a fresh IV each time, the record's own key as the
authenticated data. Thirty-seven bytes and microseconds a record. `test/seal.mjs`
holds the list against the poll's keys.

**Under a keyring, not a key.** Records are sealed with random data keys kept in one
document, `sealkeys`, which holds them only wrapped under the key `MYSET_SECRET` gives
(`0112`). A new secret re-wraps that one document — opened with
`MYSET_SECRET_PREVIOUS`, given a fresh data key for everything written from then on,
wrapped under the new value — and no record is re-encrypted. Old data keys stay in the
ring for ever, so the previous value can be removed and a password set years ago still
checks. The mirror's twenty-minute bell opens the ring, so this happens within twenty
minutes of a deploy even on a quiet day, and `tools/prod.py` shows when.

**It fails closed and never destroys.** No secret: plaintext, exactly as before. A
plaintext record still reads, and is sealed on its next write — the migration, with no
batch and no `list()`. A record that cannot be opened reads as missing and refuses to
be written over; a new protected record is refused rather than written in the clear;
a keyring that cannot be opened is never made again over the one that exists.

**HQ's Gmail tokens move onto the ring** (`v2.`), because they were sealed under a key
cut from the store key: moving the signing key would have disconnected the mailbox.
A `v1.` token still opens with the store key, which stays in the store.

**The keyring is copied everywhere the records are.** It is wrapped, so the mirror and
the backup carry it, and `backup.py` fails a copy that has sealed records without it.

| Option | Why not |
|---|---|
| A data key cut straight from the secret (the original slice C) | Every record written under the old value would read as missing once the previous value was removed, unless each had been rewritten first. |
| A re-encryption pass after each rotation | A job to write, run and trust, touching every sealed record, to do what re-wrapping one document does. |
| Seal everything | The show, the shards and the registry are read on every phone's poll, and hold nothing a store dump does not already show on the public page. |

## What this makes harder

`MYSET_SECRET` can never be removed once set, and `sealkeys` must never be deleted: without
either, sealed records read as missing (they are kept, and come back with the key). A
tool that reads the store directly sees ciphertext for these families; `prod.py` says
so instead of printing it. If a copy of the store leaked together with an old secret,
records written before the rotation stay readable to whoever holds both until each is
next written.

## What would reverse it

A hot-path read that turns out to be on the list (move it off; the test names the
poll's keys). A tool that genuinely needs to read a sealed family offline (give it the
key through the environment, never a file).

## How it was verified

`test/seal.mjs`: the list against the poll's keys; ciphertext on the store and the
document to the reader; plaintext records migrating on write; the raw doors; a wrong
secret, no secret, a touched byte and moved bytes failing closed without a write and
without remaking the ring; a rotation re-wrapping one document, after which the
previous value is removed and a password, an ID photo, a Gmail token, an HQ contact and
a sealed log's old parts all still open; two cold instances agreeing on one ring; seal
and open under a millisecond for a five-kilobyte record. The whole suite also ran with
`MYSET_SECRET` set. Nothing was written to production.
