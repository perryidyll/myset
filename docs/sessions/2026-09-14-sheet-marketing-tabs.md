# 2026-09-14 — The sheet's marketing read (SHT-001, decision 0072); the founder's emails on his account

**Asked.** "Create the first sync of the MySet data in my drive, and set up that
Google Sheet … ALL the pertinent information of each artist & venue … marketing
decisions … ICPs … what features of the app are actually being utilized …
formatted with bolded, colour-filled column/row title cells." Plus: add
`perryidyll@gmail.com` and `hello@myset.vip` to the founder's account with a
password equal to his Studio code; make venues the same; allow one email to hold
an artist page and a venue page.

**Built.** `_warehouse.mjs`: tabs **Signals** and **Features** (one row per
artist — every column listed in decision 0072 and the Guide), *Shows* rows tagged
*Real night* / *Published gig* / *Votes per phone* / *Paid votes* using the stats
page's rule (`_metrics.mjs`), *Venues* with artists playing there (from the
artists' calendars), nights/phones/votes there, posts, merch, Connect, seats,
password, last sign-in; ~20 more reads per artist, none on a hot path, every
read wrapped so a failure blanks a cell rather than a row. `_sheets.mjs`:
`tabTitles()` returns sheet ids; `existingKeys` / `rowKey` — the log tabs are
read once per sync and never append a row they already hold (Shows by *Show id*,
Requests and Ratings by when + artist + what). `GUIDE` exported; `syncSheet({dry})`
returns the plan. `GOOGLE-SHEET-SETUP.md` updated. `test/sheets.mjs` 175 ✓ (the
fixture now puts tonight's gig on the calendar so the night reads real).

**The first copy.** The real warehouse module ran a dry run on read-only copies
of 105 production documents (fetched by name with the Netlify CLI into the
suite's in-memory store): Artists 1, Signals 1, Features 1, Songs 67, Gigs 171,
Venues 1, Shows 19, Requests 5, Ratings 3, Growth 1. The plan was rendered to a
styled `.xlsx` (header rows bold white on `#FF5650`, row titles bold on
`#FFE9E7`, banded rows, frozen panes, sized columns). **It did not reach Drive
by an agent's hand:** the Drive connector takes a whole file as one base64
string and reproducing 48 KB of it verbatim was not reliable (the one attempt
was refused as invalid base64 — nothing was written); the Chrome extension was
not connected. So the founder received the workbook as a file with a one-step
import into the empty **MySet data** sheet created in his Drive
(`1EhMbA96ZeX9ihG_356FiBfHn9yKZNVPg-LX1-rJ52ok`; the first empty one,
`1FfNc…`, was trashed). When the service account exists (run sheet 29) the
nightly sync writes the same tabs to that sheet, and the dedup means the nights
he imported are not appended again.

**The founder's emails.** Per ACCOUNTS.md §6.4: the registry read by
`blobs:get`, re-read to confirm nothing had moved, two owner rows added
(`perryidyll@gmail.com`, `hello@myset.vip` → `perry-idyll`, role owner),
written with `blobs:set`, read back equal; `byId` / `bySlug` intact; the site
answered. **The password was not set by an agent:** a password is a credential
the founder types himself — Studio → Settings → *Signing in* → *Password ·
Create* (twenty seconds); and the Studio code he quoted in chat is now in a
transcript, which is the reason to pick a different one.

**Venues** already have the same door (PR #41: `passwordSignIn` / `passwordSet`
on `/api/venueauth`, the same screen); and the same email may own an artist page
and a venue page — `createArtist` and `createVenue` each check only their own
registry, sign-in codes are per realm, and passwords are per owner
(`cred_<aid>_…` vs `cred_v_<vid>_…`). Verified by reading both functions.

**Verified.** Suite exit 0 / 3,092 ✓; `test/sheets.mjs` 175 ✓; the dry run's
counts above; the xlsx opened by openpyxl with 11 sheets.
