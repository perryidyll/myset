---
id: 0175
title: The nightly copy keeps each changed document under the day it was copied, on R2, for ninety days — so a bad deploy's damage no longer overwrites the only good copy
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: storage
reverses:
superseded_by:
invariants: [0io, 0ft, 0hs]
commits: [20be08a]
tests: [test/snapshots.mjs, test/foundations.mjs]
files: [netlify/functions/_mirror.mjs, tools/r2pull.mjs, tools/backup.py, test/snapshots.mjs, test/foundations.mjs, test/run.sh]
---

## The question

`mirrorcron` copies every changed document to R2 under `backup/<key>`, overwriting the copy before it. R2 keeps no versions. So when a bad deploy damages documents, the damage is copied over the good copy within a day, and the only dated copies are the founder's laptop copies, weekly at best (b06). The scale audit of 2 October 2026 said *keep dated snapshots*. Decision 0146 left it for later as a retention and cost call.

**The founder has not answered.** His desk offers *Keep 30 days*, *Keep 90 days (recommended)* and *No dated copies*. This builds 90 days as one named constant, in a commit of its own, so it can be changed by one number or dropped whole.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: 90 days** | When a pass copies a CHANGED document, it also writes that version to `snap/<YYYY-MM-DD>/<key>`. Each day's keys are listed in `mirrorsnap_<day>`; a ring with nothing to copy deletes the days past `SNAP_DAYS` from those lists | A second PUT per changed document; at today's size well inside R2's free tier (below) | `SNAP_DAYS`, `snapKey`, the day lists, `expireSnaps`; `--date` on the R2 pull | A day list lost before its day expires: that day's copies stay on R2 for ever (storage only, never wrong data) |
| B — 30 days | The same, one number | A third of the storage | The same | A slow corruption noticed after a month has no good copy left |
| C — no dated copies | Today | Nothing | None | A bad deploy's damage is copied over the good copy within a day; the laptop's weekly copy is the only way back |
| D — an R2 lifecycle rule (expire `snap/` after N days) | Cloudflare deletes old copies itself | Nothing in code | A bucket setting outside the repo | A setting nobody can see from the code, made in a dashboard; tonight's rules forbid touching production, and the bucket also holds every clip |

## What was chosen, and why

A, at 90 days, until the founder says otherwise.

- **A changed version, kept under the day it crossed.** The first pass keeps everything once. After that only what changed is kept, so a day costs what changed that day. To get a document back as it was on day D: the newest dated copy on or before D. If there is none in the window, `backup/<key>` is still that version, unless a dated copy after D shows it changed since, in which case D is older than the window.
- **Both writes or neither.** A failed dated PUT fails the key: the manifest does not record it, and the next pass copies both again.
- **Deleted without a listing.** The functions never list live data. 0146 lists R2 only from a laptop, on the day the store that names the keys is gone.
  - Each day's keys are written down as they cross, in `mirrorsnap_<day>`. The day list is written before the manifest, so no dated copy is ever left unnamed.
  - The mirror's state remembers which days have any (`snapDays`).
  - A ring with nothing to copy, which is most rings, deletes the days past the window, 48 at a time from that day's list. It always does at least one batch and stops at the ring's budget.
- **Under `snap/`, never under `backup/`.** The plain R2 pull (`tools/r2pull.mjs`, `backup.py --from-r2`) lists `backup/` and is unchanged. `--date YYYY-MM-DD` pulls one day's dated copies into the same folder shape, so `--restore` and a by-hand look work on them as on any copy.
- **One number.** `SNAP_DAYS = 90` in `_mirror.mjs`. Thirty is a one-character change. "None" is dropping this commit.

### What it costs, from today's size

The R2 pull of 2 October 2026 read 258 keys, 1.5 MB.

- **Storage.** The first day keeps all of it: 1.5 MB. Each later day keeps what changed. Even if every document changed every day, 90 days would be 90 × 1.5 MB = 135 MB.
- **Free tier.** Cloudflare's published R2 Standard rates (read 2026-10-03): storage $0.015 per GB-month with 10 GB-month free; writes (Class A) $4.50 a million with a million free each month; DeleteObject free. The worst case is 1.4 % of the free storage and about 7,700 extra writes a month (258 a day). The bucket's free tier is shared with the clips, which are far larger.
- **The day lists** are Blobs documents of a few kilobytes each, at most 91 at a time.
- **At scale.** At a hundred times today's size, and everything changing every day, 90 days is 13.5 GB: about 3.5 GB past the free tier, about $0.05 a month.

## What this makes harder

- A new kind of document needs nothing new: if it is copied, its changed versions are dated. The day lists have their own `FAMILIES` line (`skip`).
- A restore "as of a day" is a by-hand job: the newest dated copy on or before that day, document by document. Nothing automates it yet.
- A lost day list leaves that day's dated copies on R2 for ever, because nothing else names them.
- A hard delete on request still does not reach R2 (0069), and now there are up to 90 days of dated copies too. They leave with their window, not with the account.

## What would reverse it

- The founder choosing "No dated copies": drop this commit.
- The founder choosing 30 days: `SNAP_DAYS = 30`.
- An R2 lifecycle rule on `snap/` (option D), if the founder sets one up: the expiry code could go.

## How it was verified

- `node --import ./test/register.mjs test/snapshots.mjs`: 19 ✓, 0 ✗.
  - The first pass keeps every document under its day, and the day list names them.
  - A day later only the changed document crosses and is kept under the new day. `backup/` then holds the damage while the day before still holds the good copy.
  - At 91 days a ring with nothing to copy deletes the expired day's copies and its list, keeps the next day's, leaves `backup/` alone, and never lists the bucket.
  - `pull(dir, { day })` brings one day home in the restore's folder shape, and the plain pull still reads `backup/` alone.
- `test/foundations.mjs` 103 ✓. Its R2 counts now look under `backup/` only.
- `sh test/run.sh`: exit 0, 5,288 ✓, 0 ✗. One run before it failed two assertions in `test/foundations.mjs` "A VERSION BEFORE EVERY OVERWRITE" — code this change does not touch; green on the rerun and in three runs of the file alone.
- Three knock-outs, each red, then restored: no dated PUT (2 red), no expiry (3 red), no day list (2 red: the copies would never leave).
- **Not checked:**
  - the real bucket;
  - the first real pass's second PUT on every document (about 1.5 MB, once);
  - `backup.py --from-r2 --date` against Netlify's real R2 variables (the Python change is a pass-through of the flag).
