# 2026-09-14 — Five small things in the Artist Studio

Asked by the founder on the morning after the business dashboard shipped. Branch
`studio/small-things`, off `origin/main` `7691945`. No decision record: nothing here
could have gone another way.

- **The editor sheet closes on a drag.** *Log a show* only moved and stopped: its sticky
  profit readout (`.bizro`) sits over the top of the sheet, so a thumb on the handle
  landed on it, and the editor also refused a body drag on purpose (fifteen inputs
  must not vanish). Now `.bizro` counts as the grab zone and the editor closes like
  every other sheet — the 24 h draft brings the numbers back (`studio.js attachDrag`).
- **Settings wears a gear** in the Menu sheet (`studio.js` menu).
- **The tab bar is a little smaller** — 19 px icons, 11.5 px labels (`lock.css .tabbar`,
  both Studios).
- **Song cards are as tall as their words:** edit (pencil-square), hide (eye-slash)
  and the delete ✕ in a column at the right, all three on the accent-soft fill the ✕
  always had (the outlines lasted an hour), 26 px each, the edit at the title's top
  edge (`studio.html .songcard`, `.act.ico`).
- **Delete asks in the Studio's own window.** `removeSong` used the browser's
  `confirm()`, which an installed app on some phones does not show; the small
  centred *End current song?* window (UX-042) is now `ask({title, lede, yes, no, go})`
  and *Delete this song?* — *Yes, delete it* / *Keep it* — goes through it.
- **Every question goes through that window** (the founder's go, later the same day,
  PR #48): the seventeen other `confirm()`s in `studio.js` — deleting a setlist or a
  gig, hiding a night, clearing the board or the setlist, a fresh show, declining a
  song, ending without saving, a merch item, hiding a post, freeing the page
  address, a team address, a passkey, new recovery codes, the hard reset, signing
  out everywhere — and the one in `studio-money.js` (*Remove the numbers?*) now use
  `ask()`. It returns a promise, so `if(!confirm(x))return` became
  `if(!await ask({title,lede,yes,no}))return`; the `go` form stays for the inline
  buttons. A tap on the dim, or the ringed button, resolves false. The window sits at
  z 66, above every sheet (65), which the *Remove the numbers?* case inside the
  editor sheet proves. `test/darkroom.mjs` asserts not one `confirm(` is left in
  either Studio script.
- **Up next shows ten songs** before it scrolls — cut at the eleventh row's top edge
  by `render()`, since a voted row is taller than a plain one (`studio.html
  .queue-window`).

Verified: suite 2,733 ✓ / 0 ✗ (45 files); uicheck 231 ✓ / 0 ✗ / 0 page errors (a real
touch drag on the readout closes the editor; the card column measured; the queue
window equal to its first ten rows); sheetcheck 39 ✓; looked at on the localhost at
375 px.

Second verification (PR #48, every `confirm()` through `ask()`): suite 2,934 ✓ / 0 ✗
(48 files); uicheck 244 ✓ / 0 ✗ / 0 page errors (*Clear setlist* opens *Remove every
song?*, a tap on the dim closes it and the songs stay); the Money editor's *Remove
this show's numbers* opened *Remove the numbers?* above the sheet on the localhost
at 375 px, *Keep them* left the record. Not checked: each of the eighteen sites tapped
by hand — the change at every site is the same one-line substitution.
