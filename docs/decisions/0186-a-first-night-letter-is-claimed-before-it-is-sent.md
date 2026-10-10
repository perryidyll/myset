---
id: 0186
title: A first-night letter is claimed before it is sent, so it can be missed but never sent twice
date: 2026-10-03
status: decided
decided_by: claude
area: ops
reverses:
superseded_by:
invariants: []
commits: [f83b15d]
tests: [test/firstgig.mjs]
files: [netlify/functions/_auto.mjs]
---

## The question

The morning after an artist's first night, the bell sends one letter with the night's
figures (`sweepNotes`, 2026-09-15). It read the queue, sent every letter that was due,
and only then moved those notes from `notes` to `noted` — in a write whose failure was
swallowed. The 2026-10-02 scale audit found two ways that sends the same letter twice:

- the write after the sends is lost or refused, so the next ring finds the notes still
  queued and sends them all again;
- two rings overlap (a slow ring and the next one), both read the same queue, and both
  send.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Claim, then send** | One CAS write moves every due note to `noted` first; only the notes that write actually took are sent | A send that fails after the claim is a letter missed, not retried | None — the same document, the same write, earlier | One artist does not get the morning letter |
| B — send, then mark (as it was), but retry the mark | Keeps "never missed" | A lost mark still sends twice; overlapping rings still both send | None | The founder's first artist gets the same letter two or three times |
| C — a per-note lock with an expiry, retry failed sends | Neither missed nor doubled, mostly | A lock key per note, an expiry rule, a retry counter | Lock documents, a sweep for stale locks | A stuck lock holds a letter for ever |
| D — do nothing | | | | Doubled letters, worst on the busiest nights |

## What was chosen, and why

A. The letter is a courtesy, not a receipt: one missing is invisible, two identical ones
read as a broken product on an artist's first morning. The sweep already drops a note
whose night or address is gone rather than retrying it ("a missing letter beats a daily
failure in the log"), so "at most once" is the rule the code already leaned toward.

- The claim is ONE `casDoc` on `gigsched`. Inside it, a note is claimed only if it is
  still queued and still due, so a second ring that read the same queue claims nothing
  and sends nothing.
- If the claim cannot be written, `sweepNotes` throws and sends nothing; the notes stay
  queued for the next ring, and `autocron`'s `step()` logs the failure.
- A send that fails, or an account that has gone since, is logged and not retried — as
  before.

## What this makes harder

- A letter whose send fails (Resend down, a bounce) is not tried again. If that ever
  matters, option C is the next step.

## What would reverse it

Evidence that letters are being missed often enough to matter — a send failure rate
that a retry would fix — and a lock-with-expiry design that cannot double-send.

## How it was verified

`node --import ./test/register.mjs test/firstgig.mjs` — 49 passed, 0 failed, including:

- two `sweepNotes` rings run at once over the same due note send ONE letter;
- with every write to `gigsched` failing (`__failWrites`), the ring throws, sends
  nothing, and the note is still queued; the next ring sends it once.

Against the old `_auto.mjs` the new checks fail (four of them: two letters from two
rings; with the claim unwritable it sent anyway).

**Not checked:** a real overlapping ring on production.
