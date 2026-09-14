---
id: 0073
title: the Google Sheet measures itself every sync, warns the founder at 60% of Google's cell limit and hands over to a new spreadsheet it makes and shares at 80% — nothing moved, the old sheet kept; and a Studio-code session sets a password by naming one of the account's own addresses and proving it with a code
date: 2026-09-14
status: decided
decided_by: perry
area: server
reverses:
superseded_by:
invariants: [0fu, 0fv]
commits: []
tests: [test/sheets.mjs, test/password.mjs]
files: [netlify/functions/_sheets.mjs, netlify/functions/_warehouse.mjs, netlify/functions/auth.mjs, netlify/functions/venueauth.mjs, public/studio.js, public/venue-studio.js, GOOGLE-SHEET-SETUP.md, ACCOUNTS.md]
---

## The question

Two things the founder hit on 2026-09-14, an hour after the sheet and the
password door shipped.

1. "Please let me know when this sheet is becoming too large … maybe set up an
   automatic generation of a new one when it nears that point?" Google caps a
   spreadsheet at ten million cells; the log tabs only ever grow.
2. "I don't see a set password option, only this" — the Settings row reading
   *This sign-in has no email on it. Sign in with your email to set a password
   for it.* He was in with the Studio code, as he always is; the row sent him
   to a different door to reach the one he wanted.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen (sheet)** | Every sync reads the sheet's allocated cell count (one GET). ≥60%: one email per sheet to the owner addresses on the founder's account (or `GSHEET_SHARE`). ≥80%: create a successor named after the old one with the date, share it with the same people as editors, record `{id, since, prev[]}` in a `gsheet` document, point the client at it and finish the run there. The old sheet is never written again. The Studio card shows the percentage, links the sheet in use and counts the chain. | One GET per sync; a second OAuth scope (`drive.file` — files the account created, nothing else). | `settleSheet`, `sheetCells`, `createSheet`, `shareSheet`, `useSheet`, the `gsheet` doc | A successor made but not shared: the email still carries the link and the service account owns the file; `shareSheet` returns per-address results. |
| B | Warn only; the founder makes the next sheet and edits `GSHEET_ID`. | A 2 a.m. write failure the night it fills, then a Netlify edit. | | |
| C | Trim the log tabs (archive old rows). | Deletes rows a person may have charted; against the sheet's one promise. | | |
| **A — chosen (password)** | `passwordSet` from a session with no address takes `email` + `code`: the address must be an owner/manager row on THIS account, the code must have been sent to it. The Studio sheet lists the addresses, *Email me a code*, code, password. Both Studios. | Nothing on a hot path. | one branch, one sheet | Bounded: a member/crew row or an address off the account is refused before any code is checked; the code cap (5/hour/address) is unchanged. |
| D | Leave it: the founder signs in by email once, then sets it. | A door to a door, and he had already found it. | | |

## What was chosen, and why

The sheet: a hand-over rather than a trim, because the sheet's whole promise is
that a row written is a row kept (decision 0072). Eighty percent rather than the
limit itself, because a sync appends thousands of cells and must never be the
write that fails. The service account makes and owns the successor: it is the
only party that can write to it without an invitation, and the founder is made an
editor of it rather than the other way round. `GSHEET_ID` stays the seed only, so
nobody edits Netlify at 2 a.m.

The password: a Studio-code session already proves the page; a code to one of the
page's own addresses proves the inbox; a password is set only for an address that
answered. That is the same root of trust as every other door (INVARIANT 0fu) with
one fewer step for the person who owns the account.

## What this makes harder

Two sheets after a hand-over: a person charting across the boundary joins them
by hand (the Growth tab restarts in the new sheet from that night). The Drive
scope is a change in the token's claims — the existing service account needs no
new permission, but the setup guide now says why the scope is there.

## What would reverse it

Google raising the cell limit past what a decade of nights fills, or the
`/metrics` page replacing the sheet as the founder's daily read.

## How it was verified

`test/sheets.mjs` 193 ✓ (ROOM: status shows id, percentage, link; at 60% one
email, not two; at 80% a new sheet named with the date, shared as writer, the
chain recorded, this run written into the successor, the old tab untouched, the
next sync stays in the successor). `test/password.mjs` 59 ✓ (a code session
must name an address on the account; an address off it or a member row is
refused before any code is checked; wrong code refused; right code sets it and
the email+password door opens; a second owner address gets its own). Suite
exit 0.
