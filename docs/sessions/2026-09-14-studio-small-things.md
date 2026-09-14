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
- **Up next shows ten songs** before it scrolls — cut at the eleventh row's top edge
  by `render()`, since a voted row is taller than a plain one (`studio.html
  .queue-window`).

Verified: suite 2,733 ✓ / 0 ✗ (45 files); uicheck 231 ✓ / 0 ✗ / 0 page errors (a real
touch drag on the readout closes the editor; the card column measured; the queue
window equal to its first ten rows); sheetcheck 39 ✓; looked at on the localhost at
375 px.
