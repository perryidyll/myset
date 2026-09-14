# 2026-09-14 — a password from the Studio code, and a sheet that hands over before it is full

## Asked

The founder, an hour after the password door and the sheet shipped:

1. "I don't see a set password option though, only this" — a screenshot of the
   Settings row *This sign-in has no email on it. Sign in with your email to set a
   password for it.* He is in with the Studio code.
2. He imported the first workbook into the *MySet data* sheet.
3. "Please let me know when this sheet is becoming too large … maybe set up an
   automatic generation of a new one when it nears that point?"

## Shipped (decision 0073)

**A password from a code session.** `passwordSet` on `/api/auth` and
`/api/venueauth` now takes `email` + `code` when the session has no address: the
address must be an owner/manager row on this account (never member/crew, never
off the account — refused before any code is checked), the code must have been
sent to it. Settings → *Password* on a code session lists the account's addresses
(a read-only field when there is one), *Email me a code*, the code, the password.
Both Studios. The founder's account has two addresses; both work.

**The sheet's room.** `_sheets.mjs`: `sheetCells` (one GET of every tab's grid),
`createSheet`, `shareSheet` (Drive permissions, `drive.file` scope — only files the
service account made), `useSheet` / `activeSheetId` / `sheetUrl`, `CELL_LIMIT`.
`_warehouse.mjs`: `settleSheet` runs on every sync before the writes — ≥60% one
email per sheet to the owner addresses on the founder's account (or
`GSHEET_SHARE`); ≥80% a successor named `<title> · from YYYY-MM-DD`, shared as
writer, recorded in the `gsheet` document (`id`, `since`, `prev[]`, `warned{}`),
the run continues into it. `sheetStatus` carries `id`, `url`, `cells`, `pct`,
`limit`, `rollAt`, `prev`. The Studio's Sheet card has a *Room* row and an *Open*
link. INVARIANT 0fv.

## Verified

`test/password.mjs` 59 ✓ (new section FROM THE STUDIO CODE). `test/sheets.mjs`
193 ✓ (new section ROOM, with the stub extended for the create and share calls).
Suite: see the push log entry for the count and exit code.

## Not done / for the founder

- The nightly sync still needs the service account and the three variables (run
  sheet 29). Until then there is nothing to measure; the .xlsx he imported sits in
  the sheet the sync will find.
- The successor's share goes to the two addresses on his account. `GSHEET_SHARE`
  overrides.
