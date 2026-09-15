---
id: 0081
title: the first gig is the onboarding, and a night's money is everything tagged to it
date: 2026-09-15
status: decided
decided_by: perry
area: studio, money
reverses:
superseded_by:
invariants: [0ga]
commits: []
tests: [test/latetips.mjs, test/firstgig.mjs]
files: [public/studio.js, public/studio.html, public/sign.html, netlify/functions/_history.mjs, netlify/functions/history.mjs, netlify/functions/_lifecycle.mjs, netlify/functions/_auto.mjs, netlify/functions/autocron.mjs, netlify/functions/admin.mjs, netlify/functions/stage.mjs, tools/mock.mjs]
---

## The question

A friend of the founder who runs a product that is working put onboarding in one
line: *get them to their first successful gig — upload the next show, print the QR,
share it at the venue, work the room, win tips — and the aha moment is when the
money hits their bank account.* The founder asked (2026-09-15) for the strategies
that serve that chain to be built, all but one (a push before the gig: "setting
the app up 30 minutes before the gig is potentially the WORST time").

The same message carried a money bug: two $1 test tips sent the day after the
14 Sep night showed in the Money tab's *Taken* tile for that night ($22) and not
in the profit under it ($30, should be $32). "It's very important for the CRM to
function perfectly."

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: one rule for money, one path for the first gig** | A payment tagged to a night belongs to that night whenever it arrives, until the next night starts; the Money tab refreshes the filed row from the same Stripe read that draws the tile. The first run drops to four steps and ends on the printed sign; a pinned *Your first gig* card holds two ticks until a night is filed; example rows on an empty first board; a full-screen tip burst; tonight's money sticky on the Live tab; one morning-after note. | A CAS on two documents when the tile and the row differ; one meta stamp per filed night; one letter per account, ever. | `moneyWindowEnd`, `refreshShowMoney`, `meta.signAt` / `meta.nights`, `notes` on the bell's index, `sweepNotes`, `/sign.html`. | A late tip lands on the previous night, which is where the fan meant it. |
| B — count late tips as untagged | Leave the filed row alone; show late money as "untagged". | Nothing. | None. | The founder's $2 never reaches profit — the bug as reported. |
| C — a webhook fold-in | The Stripe webhook adds late money to the filed row as it arrives. | A second writer to the history documents. | Webhook → history coupling. | Two writers, two figures again the first time the webhook is late. |
| D — the onboarding as a tour | Explain the Studio on first run. | Screens. | None. | The wall Brian's line warns against: decisions before a first night. |

## What was chosen, and why

**A.** The money rule first, because it is a correctness bug in live data. `pay.mjs`
tags a tip with `show.showId` whether or not the night is still live — a fan tipping
after the set, from the walk home, is the point — so the tag is the truth and the
window is only a search bound. `moneyWindowEnd(rows, showId)` is the next night's
start, or now. `history.mjs` heals the filed row when the tile disagrees, using the
read it already made; *Re-check* uses the same window, so it can no longer wipe a
late tip. Only a figure Stripe actually answered may overwrite the row.

Then the first gig, in the founder's words: "one card stays pinned until they've
done it — add your next show, print your QR code — that's it." The first run is
name, songs, Stripe, the sign; the prices step is gone (they are defaults, in
Settings). *Print my sign* opens `/sign.html` — the name, *Pick the next song*, the
code, the address, print-ready — and stamps the account (`signAt`), so a second
phone sees the tick. *Send it to my phone* is the share sheet, not an SMS provider
(no dependency). An empty first board shows three example rows to the artist only,
never on the board (INVARIANT 0fz). The first tip is loud: amount, a line, the
brand colours falling, a chime and a buzz where the phone allows. Tonight's money
sits sticky under the header on every plan. And the morning after the first night
on file, one letter: the figures and the one next step — put the next show on the
calendar — sent by the bell ten hours after the end, never the same evening, never
twice.

## What would reverse it

A night whose late money the artist wants kept OFF the night (a tip meant for
nothing in particular) — then a "between shows" bucket, not a change to the tag.
The morning-after note going to an artist who did not want mail — then a Settings
switch, which 0074's inbox pattern already has the shape of.
