---
id: 0082
title: Every payment is celebrated, the Money tab folds, and Delete show hides a night but never destroys it
date: 2026-09-18
status: decided
decided_by: perry
area: money
reverses:
superseded_by:
invariants: [0s]
commits: []
tests: [test/bizmath.mjs, test/biz.mjs, test/histname.mjs]
files: [netlify/functions/stage.mjs, netlify/functions/_history.mjs, netlify/functions/history.mjs, netlify/functions/admin.mjs, public/biz.js, public/studio-money.js, public/studio.js, public/studio.html, public/report.html, tools/mock.mjs]
---

## The question

The founder walked the Money tab on his phone on 2026-09-17 and came back with a
list: the tip burst should fire for votes bought as well as tips, but not sit over a
lyrics or chord chart mid-song; the profit needs "$x from in-app tips" under it; a
currency; pay entered on a gig should reach the dashboard, runs included; the hours
boxes want the normal keyboard; the editor sheet's ✕ was half hidden and saving left
the page mid-scroll; the whole tab pinched out to a too-zoomed-out layout with a
strip down the right; *Shows* should read *Past shows*; *All payments* and *MySet's
books* should fold; *If something broke* belongs at the bottom; and the editor
wanted a *Delete show* that also removes the show from the Gigs tab. One batch, one
record, because several of these change what the server writes.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The stage payload carries tonight's vote purchases (`paid`); history rows carry the night's tips alone (`tipped`, back-filled by the heal from the money block already on the detail); a `hide` action flags an index row and the lists skip it; the book's prefs carry a currency code that is a label only; the page changes above | One more field on the poll, one on every index row, one new POST on `/api/history`, a pref | `tippedOf`, `hideShow`, `Biz.currency`, `FOLDN`, the label thinning on the by-show chart | A hidden night that should have counted — it is a flag, so the fix is one write |
| B | Delete a night for real (drop the detail, the log, the row) | The money Stripe took would have no night to belong to; `Re-check` could never find it again | A destructive path through history | Money that vanishes from the book — the exact thing 0065 and INVARIANT 0s exist to prevent |
| C | Convert figures when the currency changes | A rate feed, a date to convert at, and a second number for every night | An exchange-rate dependency | Two books that disagree with Stripe's statement |
| D — do nothing | Leave the list as feedback | Nothing | None | The founder's phone stays the way the screenshots show it |

## What was chosen, and why

A, because every item on the list is the founder's own request and none of them
needs a destructive path. *Delete show* is three existing ideas in one tap: the
record is removed (`bizSave remove`, as before), the calendar night goes the way the
Gigs tab already removes one (`eventHide` — the whole gig if it plays once, that date
alone if it is a run), and the filed night is **hidden, never deleted**: `hideShow`
sets `hidden: true` on the index row and `history.mjs` filters it out of the lists.
The detail document, the event log and Stripe's record are untouched, and the heal
merges over the row so the flag survives. That keeps INVARIANT 0s intact: nothing
deletes.

The tips subtotal needed a number the row did not carry. The detail's money block
has always had `tips.amount`, so `tipped` joined `ROW_TOPS` — the heal back-fills it
from the detail on the next Money-tab load, and `refreshShowMoney` writes it on a
*Re-check*. A row that has not been healed reads `null`, which the page shows as
nothing: an unknown is never a zero (the same rule `paidVotes` follows).

The currency is a symbol in front of the book's figures and nothing more. The book
is the artist's own numbers in whatever they are paid in; Stripe's money is still
charged in dollars, and the sheet says so. Option C was not worth two numbers per
night.

The zoom-out had a real cause, found on the live site under WebKit: twenty-one shows
in the month gave the by-show chart twenty-one `flex:1` labels, each refusing to
shrink below "Sep 15" — 441px on a 393px phone, and iOS lets a page zoom out to
whatever it laid out. Past eight bars only every k-th one is named, the last always,
and a label may spill over its blank neighbours but the row clips at its edges.

The lists fold the same way everywhere: five rows first, twenty more a tap, another
*Show more* under each twenty. The founder's words: hundreds of shows must not drop
the screen into an endless abyss.

## What this makes harder

A hidden night is invisible to the artist but still on the index, still counted by
`nights` on the stage payload, still readable by the artist page's favourites. There
is no *Show hidden* yet; un-hiding is a one-field write an agent can do. The
currency symbol is shared by the book's own figures and the app money on the same
tab, which are dollars — an artist paid in baht sees ฿ in front of a Stripe figure
that is really $. The sheet says it; the hero does not.

## What would reverse it

An artist asking for a hidden night back (build *Show hidden*, do not delete the
flag). A second currency on the same account (convert then, not before). The heal's
one re-open per account for `tipped` costing more than a read a night on a big
account — it runs once and stamps.

## How it was verified

`sh test/run.sh` — green, exit 0 (51 suites' "passed" lines). New assertions:
`test/bizmath.mjs` (currency symbol, sign and fallback; `tipsApp` known/unknown/two
nights/orphan; the period sum counts only nights that know), `test/biz.mjs`
(`bizPrefs currency` stored upper-cased, USD clears it, a non-code is refused, hours
untouched), `test/histname.mjs` (hide answers ok, the night leaves the list, the row
stays flagged, the detail is untouched, another artist gets 404, hiding twice is
fine). Looked at in Chrome at 375px against `tools/mock.mjs` (now serving a book,
thirty nights, a ledger and payments): hero subtotal, currency chip → sheet → ฿ on
every figure, *Past shows*, folding 5 → 25 → 45 → "Show 3 more" on *All payments*,
*If something broke* last, the ✕ clear of the readout, "$9.00 from in-app tips" in
the editor, save → `scrollY 0`, delete → row gone, toast *Deleted*. The zoom-out
was reproduced on the iOS Simulator (iPhone 17 Pro) against the live Studio and
measured under Playwright WebKit with the founder's session: `scrollWidth 441`, the
three overflowing spans were "Sep 15 / Sep 16 / Sep 17"; after the fix a fifteen-bar
mock chart lays out at 393. NOT checked: the burst over a chart on a real phone (the
brief mode was asserted in Chrome — class, no button, pointer-events none, gone at
2 s — but the browser pane throttled the fade while hidden); the live `eventHide`
leg of *Delete show* against production data.
