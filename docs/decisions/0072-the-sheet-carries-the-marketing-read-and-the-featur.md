---
id: 0072
title: the sheet carries the marketing read (Signals) and the feature adoption (Features) per artist, tags every night real or test, and never writes a row it already holds — the first copy went to the founder as an .xlsx before the service account existed
date: 2026-09-14
status: decided
decided_by: perry
area: docs
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/sheets.mjs]
files: [netlify/functions/_warehouse.mjs, netlify/functions/_sheets.mjs, GOOGLE-SHEET-SETUP.md]
---

## The question

The founder (2026-09-14): "I want ALL the pertinent information of each artist &
venue tracked, including data that is universally considered crucial for making
marketing decisions — trends, behaviours, which ICPs to target — as well as what
features of the app are actually being utilized and used the most … this is very
important so please make sure it's done right", formatted with bold, colour-filled
title cells, and the first sync in his Drive. The sheet had nine tabs built on
3 Sep and had never run; no spreadsheet existed.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Two more snapshot tabs from records the app already keeps: **Signals** (one row per artist: source, referral, country, city from the calendar, a derived *segment*, active in 14 days, real nights all-time / 30 days / per week, calendar gigs per week, published gigs used %, average and biggest room, votes per phone and per night, packs and pack conversion, tips, money per night and per phone, days to first show, days since last, stars, library size, top genres, seats, test nights) and **Features** (one column per feature as a count or a yes, a score out of 24: setlists, songs to learn, charts, lyrics, requests, birthdays, replay cost, merch, shop requests, posts, clips, photos, hero video, links and which, bio, tagline, passkeys, recovery codes, password, Studio code, push, devices, sign-ins in 30 days, last sign-in, dashboard nights, Connect, featured spots, calendar, RSVPs). **Shows** rows gain *Real night*, *Published gig*, *Votes per phone*, *Paid votes*; **Venues** gain artists playing there, nights/phones/votes there, posts, merch, Connect, seats, password, last sign-in. The night rule is the stats page's (`_metrics.mjs`). Log tabs are deduplicated against what the tab already holds before appending, by identity columns. The first copy: the same plan, rendered to an .xlsx with the styling and uploaded to the founder's Drive (converted to a Google Sheet) by a session, from read-only copies of the documents. | ~20 more reads per artist per nightly sync, none on a hot path; one GET per log tab per sync. | two tabs, `existingKeys` / `rowKey`, `styleTabs` | A segment is arithmetic named as derived, not a judgement; the Guide says exactly how it is computed. |
| B | A separate analytics warehouse first. | Nothing on the founder's screen this week. | | |
| C | Ask an outside AI to format the sheet. | The sync formats it itself; a hand-formatted sheet is undone by the next `writeTab`. | | |
| D — do nothing | Nine tabs nobody has ever seen. | The founder asked twice. | | |

## What was chosen, and why

A: every number the marketing read wants is already in the store — it only had to
be put in one row per artist, next to the columns a person sorts by. The ICP the
content strategy names ("solo artists doing 5+ audience-facing gigs a month") is
now a filter on *Nights per week* and *Segment*; "which features are used" is a
column to sort. Nothing here reads a fan, names a device or carries a password —
`test/sheets.mjs` asserts the two tabs contain none.

The first copy went by a different road because the road the code takes needs a
service account only the founder can make: the real warehouse module produced its
plan against read-only copies of the production documents (a dry run — no Google,
no write), the plan became an .xlsx with the same styling — and the founder
imported it himself: the Drive connector wants a whole file as one base64 string,
which an agent cannot reproduce reliably at 48 KB, and the Chrome extension was
not connected, so the workbook went to him as a file with a one-step import. When the founder connects the service
account (run sheet 29), the nightly sync writes the same tabs to the same sheet;
the dedup means the nights already in *Shows* are not appended again.

## What this makes harder

Twenty more reads per artist a night — the 10-second scheduled function that runs
the sync will not fit hundreds of artists (it did not before either); the cursor
pattern from `mirrorcron` is the fix when it is needed. Columns are appended at
the end of *Shows* and *Venues*; nothing that read by header moves.

## What would reverse it

A privacy reading that per-artist activity counts should not sit in a
spreadsheet the founder shares — then the tabs stay and sharing is the rule.

## How it was verified

`test/sheets.mjs` 175 ✓: eleven tabs made; every artist a segment; the founding
artist's night on a calendar gig reads real and *occasional*; a feature score per
artist; *Shows* rows say real or test; the two tabs contain no fan, device or
password; the styling requests. The dry run against the founder's real documents
(read-only) produced the plan the .xlsx was built from — its counts are in the
session note. Suite exit 0.
