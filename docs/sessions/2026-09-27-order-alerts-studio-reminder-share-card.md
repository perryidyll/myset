# 2026-09-27 — Order alerts, the Studio's reminder, and the artist on the share card

**Asked (the founder):**

- Make an artist page's link preview show the artist's main photo.
- Merch orders need push notifications, email notifications, and a pop-up on opening the Studio:
  - "you have pending orders" and "you have unread messages"
  - a button to Merch or Messages under each
  - a "do not remind me again for 24 hours" box under each

A fan had bought a shirt, and the artist found out only when the fan asked.

**Built (decision `0097`, ledger UX-059):**

- **Order alerts:** `_ordernote.mjs` `tellOrder`, called from `redeemSession`'s fresh claim.
  - One push and one letter per order, never on a replay.
  - Owner-role addresses only. A venue order writes to the venue's owners.
  - Time-boxed to 1.5 s.
- **Studio reminder:** a new `orderCount` admin action, plus `orderPeek` / `nudge` / `goOrders` in `studio.js` and `.sheet.nudges` in `studio.html`.
  - `?tab=merch` is now accepted.
  - `tools/mock.mjs` answers `orderCount`.
- **Share card:** `/:slug` → `artistpage.mjs`, with `artist.html` in its included_files.
  - The share image is the portrait, else the cover, else the MySet icon; the title is the artist's name.
  - It repeats the site-wide headers, because `netlify.toml` headers don't reach function responses (measured on `/moneymodel`).

**What broke on the way:**

- The first check of the pop-up in the app's browser showed nothing, because the pane reported `document.hidden`. The pop-up now waits to be seen instead of skipping.
- The first **Open Merch** scrolled to the orders, and then `render()`'s two-frame scroll restore pulled the page back to the top. The scroll now runs two frames late, below the sticky header.
- Decision 0096 was taken by the tax session in the meantime, so this became 0097.

**Verified:**

- Both new test files, and the whole suite.
- The pop-up in the mock at 375×812, light and dark.

**Not checked:**

- the function on a deploy preview
- a real order's push and letter
- a real chat preview
