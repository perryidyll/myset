---
id: 0092
title: app.css rides inside every fan page, byte for byte
date: 2026-09-25
status: decided
decided_by: perry
area: performance
reverses:
superseded_by:
invariants: [0gf]
commits: []
tests: [test/structure.mjs]
files: [public/app.css, tools/stamp.mjs, public/index.html, public/artist.html, public/artists.html, public/vote.html, public/community.html, public/venue.html, public/about.html, public/shop.html, public/diary.html, public/fan.js, netlify.toml, AGENTS.md, docs/design-system.md]
---

## The question

Every fan page shared one stylesheet, `public/app.css`, fetched on its own: three pages
linked it in the head and painted nothing until it arrived (0088 measured that link at
0.16–0.67 s before a single pixel on a first visit), six preloaded it and painted their
first frame from private token copies (0051, 0088) while the file was still in flight,
with `lift()` and the vote page's `render()` waiting up to 400 ms for it. 0088 listed
inlining the whole file as option B and left it to the founder, because the cost is
plain: an edit to app.css becomes a nine-page diff, and a tool has to keep the copies
honest. The founder, told that cost in plain words, said "please do all of these".

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The whole of app.css rides inside every fan page between `<style id="app-css">` and `</style>`, byte for byte; `tools/stamp.mjs` writes it (the tool every script edit already runs) and `test/structure.mjs` refuses a stale copy or a re-added `<link>` | ~16.6 KB raw, ~4 KB compressed, on every page's HTML; a nine-page diff per app.css edit; 0051's token copies in the shop and the diary are now redundant | one regex and one loop in the stamp tool, one test block | a forgotten `node tools/stamp.mjs` ships two designs — the structure test is the guard |
| B | Inline only what the first paint needs, per page (the tokens and a few recipes — what 0051 and 0088 already did for three pages) | judgement per page about what "the first paint needs", wrong the day a recipe moves; the round trip stays for everything after the first frame | a per-page critical-CSS decision | a recipe used above the fold that is not in the inline set flashes unstyled |
| C | HTTP/2 push or `103 Early Hints` for app.css | nothing to build | none | Netlify does not offer either on this plan (measured in 0088) |
| D — do nothing | | three pages keep painting nothing until app.css lands; six keep their 400 ms wait | none | none |

## What was chosen, and why

A, because the founder said so, and because the discipline already exists: the Studio
scripts and `fan.js` are hash-stamped into their pages by `tools/stamp.mjs` after every
edit, and `test/structure.mjs` refuses a page whose stamp is stale (0053, 0087). This is
the same rule with a bigger payload — "a build step by another name" only in the sense
the stamps already were. The pages in `public/` are still what ships; nothing is
transformed on the way out. The block sits exactly where the `<link>` stood, so the
cascade is unchanged: app.css first, the page's own rules after it.

The id is `app-css`, not `app`. Every fan page's content container is already
`<div id="app">`, and the first cut used `id="app"` for the style block — the browser
then handed `getElementById('app')` the style element, the page's render wrote its HTML
into it, and the stylesheet vanished. Caught in the app's browser on the mock within the
hour; a lesson worth a sentence here because `#app` is the most reused id on the site.

With no `<link>` on any page, `cssReady()` in `fan.js` is true at once, so the 400 ms
waits (`lift(true)`, the vote page's first `render()`) end on their first frame; they
stay for any page that ever links a stylesheet again. `/app.css` is still published —
it is the source the tool reads — but no page asks the network for it.

## What this makes harder

An app.css edit is a nine-page change: edit the file, run `node tools/stamp.mjs`, and
the diff carries nine copies. A reviewer reads app.css, not the copies. The three pages
that also carry 0051's private token and recipe copies (shop, diary; the vote page's
tokens block is gone) now hold those twice; retiring 0051's copies is a follow-up, not
this change. Each page's HTML grew by the size of app.css — ~4 KB compressed — on every
open that reaches the network; a page seen tonight comes from the phone's copy (0091).

## What would reverse it

app.css growing past ~50 KB raw, when its weight on every page would outrun the round
trip it saves; or Netlify offering Early Hints, which would give back most of the win
without the copies.

## How it was verified

`node test/structure.mjs` — every fan page carries app.css inline byte for byte and
none asks the network for it (18 assertions). `node tools/overview.mjs --tests` —
3,571 assertions, 0 failed. The app's browser on `tools/mock.mjs` at 375 px: no request
for `/app.css` from the community, artist, vote or shop page; the inline sheet's rules
present; buttons rounded and the body painted from the tokens, light and dark. Real
Chrome: `tools/uicheck.mjs` and `tools/sheetcheck.mjs` (numbers in the session note).
NOT checked: production, a real phone.
