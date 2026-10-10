---
id: 0146
title: Every kind of document has a second home or a stated reason, and the off-site copy has been read back
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: storage
reverses:
superseded_by:
invariants: [0hs, 0ft]
commits: [a202836]
tests: [test/foundations.mjs, test/keyfamilies.mjs]
files: [netlify/functions/_mirror.mjs, netlify/functions/mirrorcron.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, netlify/functions/_featured.mjs, tools/r2pull.mjs, tools/backup.py, test/keyfamilies.mjs, test/blobs-fake.mjs, test/r2-fake.mjs]
---

## The question

Decision 0069 says every document is copied to R2 once a day. The scale audit of 2 October 2026 found that it is not:

- **A dozen kinds of document had no second home.** The CRM (index, contacts, message library, Gmail tokens), every sample page and the samples' registers, the company's costs, venues' suggestions, the factory's settings and queue, the sheet hand-over, the media dashboard, fans' bug reports and the error log. Each was added by a batch with no reason to think of the mirror, and the mirror said nothing about what it was not told.
- **Three venue documents were on no list at all:** the pitches a venue was sent (0123), its alert devices (0124) and its answers to shows at its place (0128). They were not copied, and they outlived a deleted venue.
- **Nothing had ever read the R2 copy.** The one rehearsed restore starts from a folder on the founder's laptop.
- **The laptop copy had read "not whole" since an account signed up and never opened its Studio.**

The founder asked for phase two of the audit's fixes: *backup covers every family; a rehearsed restore*.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Add the missing kinds to the walk. One table in `_mirror.mjs` names every kind and who copies it, or why nobody does; the suite fails on a key no line matches. A tool reads the R2 copy into the folder shape the rehearsed restore already reads. A check compares a laptop copy with the mirror's own manifests | About 50 more keys a pass today; one line per new kind of document, for ever | One table, one small tool, one suite step | The table says "owner" for a kind `keysFor` forgot (the production check catches it; the suite cannot) |
| B | Add the missing keys to the lists and stop | Less code | None | The next batch repeats the gap silently, which is how this one happened |
| C | Let the mirror list the store | No lists to keep | `list()` in a function | INVARIANT 1: it lags, and it has broken the live path before |
| D — do nothing | | | | A bad deploy or a lost account loses the CRM, every sample page and the costs book outright |

Left for a later decision, named so it is not lost: **dated snapshots on R2.** The mirror overwrites `backup/<key>` in place, so damage is copied within a day and R2 has no versions. Keeping a dated copy of each changed document is cheap but it is a retention and cost call (the bucket grows for ever unless a lifecycle rule trims it), and the founder was not asked. The dated copies today are the laptop's, weekly.

## What was chosen, and why

A.

- **The walk.**
  - Sample pages: `mirrorcron` reads `samplereg` beside the two registries, so a sample's documents are copied under its own keys like any account's.
  - Globals, by name: `samplereg`, `samplearc`, `samplesup`, `samplestat`, `crm`, `crmlib`, `crmgmail`, `factorycfg`, `factoryq`, `costs`, `suggest`, `gsheet`, `mediadash/data`, `mediadash/boosts`, and `payowed` (week one's owed deliveries, decision 0138).
  - Globals, named off an index document, never a `list()`: a CRM contact off `crm`, a taken-down sample's snapshot off `samplearc`, a thumbnail off the media dashboard's posts, a city's featured slots off the city index (and off each artist who bought one), and the last 48 hours of the error log off the clock.
  - `keysFor` gains `bugs_<aid>`; `keysForVenue` gains `vpitch_<vid>`, `push_v_<vid>` and `gigok_<vid>`. Because that list is also what a deletion walks, **these four are now deleted with their account.** They were orphans before.
- **`crmgmail` is copied.** It is sealed with the server's secret (0109), so the copy is ciphertext, and a restore keeps Gmail connected.
- **Never copied, each with its reason in the table:** the two passcode doors' wrong-try counts, an upload in pieces, the mirror's own cursor and manifests, and everything 0069 and 0110 already excluded.
- **The table is the rule.** `FAMILIES` replaces the old `SKIP` pattern; `skipped()` reads it. Every test process logs the keys it wrote, and `test/keyfamilies.mjs`, the last step of the run, fails on a key that matches no line.
- **Reading it back.** `tools/r2pull.mjs` lists `backup/` and writes `keys/` plus a `manifest.json` with a checksum per key. `tools/backup.py --from-r2` runs it and checks the copy; `--restore` then works from it unchanged. The listing is allowed here for the reason it is allowed in `backup.py`: on the day it is needed, the store that names the keys is the thing that is gone.
- **The production check.** `tools/backup.py --coverage` takes a laptop copy (which lists the store itself), reads the mirror's manifests out of it, and names every key no manifest has copied and no line excuses. It separates three things that are not gaps: old strays from before artists had ids, documents whose owner is on no register, and error hours older than the two-day window.
- **The laptop copy's check** no longer fails on an account with no `show_` document (the code reads a missing one as an empty library), and counts the media dashboard's thumbnails as pictures.

## What this makes harder

- A new kind of document needs a line in `FAMILIES` before the suite passes.
- Deleting an artist or a venue now removes four more documents. There is no undo for those beyond the thirty-day grace the account already has.
- The pass is longer: 48 metadata reads a day for error hours, and one per CRM contact.

## What would reverse it

- The mirror moving to a "changed" list (the audit's fix for a pass that takes over a day past about 130 accounts): the walk goes, the table stays.
- A platform that lists strongly and cheaply: option C becomes honest.

## How it was verified

- `node --import ./test/register.mjs test/foundations.mjs`: 103 ✓, 0 ✗. The new section makes one of each kind, rings the real `mirrorcron`, and finds each on the R2 fake; then pulls the bucket back and compares every file with the store, byte for byte.
- Five knock-outs, all red: samples not walked, `bugs_` out of `keysFor`, CRM contacts not named, `hqlock` no longer skipped, the three venue documents forgotten.
- `test/keyfamilies.mjs` on a full run's log: 984 keys, none unclassified; red when an unknown key is added to the log.
- **Against production, read-only:**
  - `python3 tools/backup.py --coverage` on the laptop copy of 2026-10-02 06:21 UTC: 258 of the store's keys had a second home; 68 of kinds the mirror should take did not.
  - A dry run of the new walk over that same copy, in memory: 310 cross. What is left: 13 documents whose owner is on no register (`samcole`, `thelantern`, and seven keys from before artists had ids, each of which has a migrated twin), two old error hours, and one chart of a song no longer in the library.
  - `python3 tools/backup.py --from-r2`: 258 of 258 keys read back from the real bucket in 25 s, 1.5 MB, "copy is whole". 254 are byte-identical to the laptop copy taken two hours later; the other four are schedule and sync documents that changed in between.
  - `python3 tools/backup.py --restore <that R2 pull> --store rehearsal-20261002`: 258 of 258 keys restored and read back equal, 687 s (about 2.7 s a key, the same pace as the 2026-09-14 rehearsal from a laptop copy). The rehearsal store was wiped afterwards. It is a separate store on the same site; the functions only ever open `myset`.
- **Not checked:** the new kinds on the real bucket (they arrive with the first pass after this merges; run `--coverage` on the next laptop copy). A restore into the production store has never been run, by design.
- **Open:** a chart or lyric sheet whose song has left the library is named by nothing, so it is neither copied nor deleted with the account. Dated snapshots on R2 (above). A hard delete still does not reach the R2 copy (0069).
