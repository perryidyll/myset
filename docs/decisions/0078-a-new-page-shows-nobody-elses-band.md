---
id: 0078
title: a new artist page has no photo until its own artist adds one — the cover is a brand tile and the portrait is the band's initial, never a stock picture of another act
date: 2026-09-14
status: decided
decided_by: perry
area: product
reverses:
superseded_by:
invariants: [0fy]
commits: []
tests: [test/sheets.mjs]
files: [netlify/functions/_profile.mjs, public/artist.html, public/community.html, public/shop.html, public/studio.js, public/studio.html]
---

## The question

The founder made a test account, *The Last Cigarettes*, and opened its page: the
cover and the portrait were the founder's own band on a beach — the site's stock
`band.jpg`, which `_profile.mjs` had given every new profile as its default
`photo` since the first build, and which the artist page, the Community page and
the shop fell back to whenever a profile had none. "It auto-populated my profile
page with these images lol please fix that asap."

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen** | The default `photo` is empty and the normaliser no longer fills it. No cover: the artist page draws the same box painted in the brand pink-orange gradient, no image. No portrait: a tile with the band's initial. Community and shop headers: the same initial tile. The static share image (`og:image`) is the MySet icon. | The two stock files stay for the founder's own page, which stores `/img/band.jpg` explicitly; nothing else references them. | A profile that stored the default value by name still shows it — that is the founder's, by his choice. |
| B | Keep the stock photo, mark it "placeholder" in the Studio. | Every stranger's page still opens as someone else's band. | |
| C | Generate a per-artist illustration. | A new asset path for a page that will hold real photos within a day. | |

## What was chosen, and why

A page is the artist's — a first-time visitor must never mistake one act for
another, and a musician must never find a stranger on their own page. An empty
state that is plainly empty (brand colour, their initial) is honest; a photo
that is plainly somebody else is not. The founder's page keeps its picture
because it stores the path itself.

Also in this change: the Studio's *Save profile* button is centred (`.big.mid`).

## What would reverse it

Nothing foreseeable; a real per-artist placeholder (option C) would replace the
tile, not the rule.

## How it was verified

`test/sheets.mjs` (a fresh profile's `photo` is `''`); the artist, Community
and shop pages screenshotted from `tools/mock.mjs` with `photo`, `avatar` and
`photos` cleared — pink-orange cover, "T" portrait, no `<img>`; the Studio's
Save profile button centred. Suite exit 0.
