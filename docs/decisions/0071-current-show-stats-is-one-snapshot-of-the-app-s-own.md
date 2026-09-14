---
id: 0071
title: Current Show Stats is one snapshot of the app's own records, sliced by date in the browser — a night counts when it lines up with a published gig; published daily as an artifact until it is myset.vip/metrics
date: 2026-09-14
status: decided
decided_by: perry
area: docs
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/metrics.mjs, test/sheets.mjs]
files: [netlify/functions/_metrics.mjs, tools/metrics.mjs, finance/metrics.html, netlify/functions/_sheets.mjs, netlify/functions/_warehouse.mjs]
---

## The question

The founder (2026-09-14): turn the *Gig Week One* analysis into *Current Show
Stats* — "a living, breathing snapshot of all the current performance metrics
(all-time, as well as from adjustable time ranges … 60, 90, 30, 7 days, 24
hours, and a custom date range)", updated every 24 hours, and "once you get
this finalized and I review it, an actual page on the site like the money
model — myset.vip/metrics". Plus the Google Sheet formatted with bold,
colour-filled title cells.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One pure module (`_metrics.mjs`) turns the documents — registries, each artist's filed nights, payments cache, posts, RSVPs, calendar — into one JSON snapshot; a template (`finance/metrics.html`, beside the money model) carries the snapshot and does every range in the browser. Today a read-only CLI (`tools/metrics.mjs`, Netlify CLI reads by name) fills the template and a session publishes it as the artifact once a day; when the founder says so, a function reads the same documents with `readDoc` and serves the same file at `/metrics`, and the daily job retires. The night rule from the first week's analysis is now code: real = started on a published gig, no earlier than 90 min before the slot and before it ended, and something happened. | A snapshot a day, ~60 KB. | `_metrics.mjs`, `tools/metrics.mjs`, `finance/metrics.html`, a scheduled task on the founder's machine | The daily task depends on the desktop app being open; the page says when it was taken, so stale is visible, never silent. |
| B | Compute ranges on the server per request. | A function that reads every artist's index on every open; at 10⁴ artists that is a warehouse question, not a page. | | Cost on a page anyone with the passcode can refresh. |
| C | Charts from the Google Sheet. | The sheet has never been switched on; three env vars and a service account are the founder's. | | Nothing until then. |
| D — do nothing | The 11 Sep analysis stays as it was. | The founder asked for a living page. | | |

## What was chosen, and why

A: the same module and the same file serve both the artifact today and the
page tomorrow, so nothing is built twice, and the browser doing the ranges means
a custom range costs nothing on the server. Every number is read by name (no
`list()`); the snapshot carries counts, slugs and timestamps — never an email,
never a device (`test/metrics.mjs` asserts the string is not there). Nights that
fail the rule are shown greyed as tests rather than dropped, so the rule is
visible at work.

The Google Sheet: `styleTabs()` in `_sheets.mjs` — header row bold white on the
brand pink-orange and frozen, the row-title column bold on a pale tint, columns
auto-sized — one `batchUpdate` per sync, idempotent, never the reason a sync
fails. It runs the night the sheet is connected; until then the sheet does not
exist (search of the founder's Drive on 2026-09-14 found no spreadsheet; the
only "MySet" document there is the content strategy).

## What this makes harder

A second page with its own numbers to keep honest — it reads the same records
the Money tab reads, and says which. The daily artifact is a habit on one
machine until `/metrics` exists.

## What would reverse it

`/metrics` shipping (the artifact then stops). A second artist's worth of nights
making the browser-side range slow (it will not before thousands of nights).

## How it was verified

`test/metrics.mjs` 20 ✓: 89 minutes early is the gig, 91 is not, inside the
slot is, after it is not, a Thursday afternoon is nobody's; a night on the gig
where nothing happened is not real; money is the tip and the pack, never the
fan, a tip in `paid` not counted twice; nothing names a device or an email; the
tool fills the template from a backup-shaped folder. `test/sheets.mjs` 168 ✓
with the styling asserted. Against the live documents (read-only, 2026-09-14
03:38Z): 19 nights, 7 real — the same seven the first-week analysis counted plus
Seaflower 11 Sep and Sand & Tan 13 Sep; 66 phones, 139 votes, 65 songs, $10 room
money, 4 nights unread. Rendered headless: the 30-day, all-time and custom
ranges recompute the tiles and the table. Suite exit 0 / 3,085 ✓.
