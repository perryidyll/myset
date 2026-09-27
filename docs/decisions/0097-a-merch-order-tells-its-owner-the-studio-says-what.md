---
id: 0097
title: A merch order tells its owner, the Studio says what is waiting, and an artist link shows the artist
date: 2026-09-27
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/ordernote.mjs, test/sharecard.mjs]
files: [netlify/functions/_ordernote.mjs, netlify/functions/_pay.mjs, netlify/functions/admin.mjs, netlify/functions/artistpage.mjs, netlify.toml, public/studio.js, public/studio.html, tools/mock.mjs]
---

## The question

Two asks from the founder on 2026-09-27.

The first was about merch. A fan bought a shirt, and the artist heard about it only when the fan asked. An order was written to the Studio's Merch list and to nowhere else: no push, no email, and no sign of it on opening the Studio. The founder asked for three things: push notifications, email notifications, and a pop-up on opening the Studio. The pop-up says "you have pending orders" and "you have unread messages". Each line has a button to Merch or Messages and a "do not remind me again for 24 hours" box.

The second was about link previews. A link to an artist's page, pasted into a chat, showed the MySet icon. The founder asked for the artist's main photo instead.

## The options

**Order alerts**

- **A (chosen):** send the alerts from inside `redeemSession`, on the fresh claim that writes the order. The return page, the webhook and the sweep all go through that claim, so exactly one of them sends.
- **B:** send them from the webhook only. This misses the orders that the return page lands first.

**The pop-up**

- **A (chosen):** once per opening of the Studio, after two quiet counts (`msgCount`, which already existed, and the new `orderCount`).
- **B:** re-check it on the poll. This was ruled out by 9d8.

**Share card**

- **A (chosen):** route `/:slug` through a small function (`artistpage.mjs`). It serves `artist.html` with the artist's `og:image`, `og:title` and `og:url` written in. Its responses are durable-cached.
- **B:** an Edge Function. This was ruled out by 9d6.
- **C:** a relative `og:image`. Crawlers disagree on how to resolve it, and the title would still say "MySet".

## What was chosen, and why

**Order alerts**

- `_ordernote.mjs` `tellOrder` pushes to the owner's devices, with a tag per order.
  - The push's door is `/studio?tab=merch`, which the Studio now accepts.
- It also emails each owner-role address, at most five.
  - Band mates and crew are not written to.
  - A venue's order writes to the venue's owners.
- The letter names the item, the size, the count, the price and how the order leaves: shipped, or pickup plus its code.
  - It names nothing about the buyer (0bu).
- Sending is time-boxed at 1.5 s and never throws.
  - The money is already safe when it runs (INVARIANT 16).

**The pop-up**

- It is a centred card titled "Waiting for you", with one block per thing waiting.
  - "You have N pending orders" leads to **Open Merch**, which lands on the Orders list.
  - "You have N unread messages" leads to **Open Messages**.
- A snooze box under each keeps that one line quiet for 24 hours on this phone.
  - It is stored in `localStorage` as `myset.nudge.<aid>.<kind>`.
- It never shows in these cases:
  - while a show is live
  - over a sheet that is already open
  - to a crew seat
  - for the tab the Studio opened onto
- When the Studio opens in the background, it waits until the Studio is visible.

**Share card**

- The picture is the portrait, else the cover, else the MySet icon, always as an absolute URL.
- The share card's title is the artist's name.
- Any failure serves `artist.html` untouched, which is what `/:slug` served before:
  - an unknown slug
  - a profile read slower than 1.5 s
  - a page without `og:image`
- The function repeats the site-wide security headers, because `netlify.toml` headers do not reach function responses (measured on `/moneymodel`). `test/sharecard.mjs` holds the two lists equal.

## What this makes harder

- **The artist page now runs through a function.** It runs once per artist per 5 minutes of durable cache, and a deploy clears that cache.
  - A change to a site-wide header in `netlify.toml` must be made in `artistpage.mjs` too; the test refuses a drift.
  - A new photo reaches share cards within about 5 minutes. The chat apps keep their own copy of a preview for longer.
- **Push reaches only devices where the artist switched Alerts on** (Studio → Settings). On an iPhone, that means the Studio saved to the home screen.
- **The pop-up snooze is per phone**, not per account.

## What would reverse it

- Order alerts: the founder asking for fewer alerts, or for a digest instead.
- Share card: a measured cost or first-byte regression on `/:slug`. Put `to = "/artist.html"` back; nothing else depends on the function.

## How it was verified

- The full suite, `sh test/run.sh`, including the new `test/ordernote.mjs` (26) and `test/sharecard.mjs` (38).
- The pop-up was checked in the mock Studio at 375×812, in light and dark themes:
  - both lines showed
  - the snooze box hid only its own line on the next open
  - **Open Merch** landed on "Orders · 2 to do" below the sticky header
- Not yet checked:
  - the function on a deploy preview (whether the rewrite's `?a=:slug` arrives, and the durable cache)
  - a real push or letter from a real order
  - a real iMessage or WhatsApp preview
