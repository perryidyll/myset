---
id: 0088
title: A fan's first open is the visit that matters
date: 2026-09-25
status: decided
decided_by: perry
area: performance
reverses:
superseded_by: 0092 (the vote page's inline tokens block only — app.css itself rides inside every fan page now), 0091 and 0093 (options C and D, taken up the same day)
invariants: [0gd]
commits: [68efdb4]
tests: [test/structure.mjs, test/fandoor.mjs, test/artists.mjs, test/copy.mjs, tools/uicheck.mjs, tools/sheetcheck.mjs]
files: [public/vote.html, public/index.html, public/about.html, public/artists.html, public/artist.html, public/studio.html, public/venue-studio.html, netlify/functions/fan.mjs, netlify/functions/artists.mjs, netlify/functions/mapconfig.mjs, netlify/functions/events.mjs, tools/mock.mjs, tools/uicheck.mjs]
---

## The question

The founder asked, after the fan pages' shared script (0087), for "an extremely
detailed analysis on how the entire app is functioning" and "every little strategy
… to increase the speed of the load times across the entire app". The analysis was
done by measuring, not reading: every page, asset and public read on production
from this Mac (three GETs each, headers kept), the artist page's real waterfall in a
browser, and twelve rapid GETs of one page to see what the edge actually does. The
question underneath was where a fan's first open — the QR scan in the bar, the one
visit most fans ever make — spends its time, and which of those seconds the repo
can take back without a build step, without touching `sw.js`, and without a rewrite.

## What was measured (2026-09-25, from the founder's Mac; the numbers in the session note)

- **HTML is an edge lottery.** Every page answered `cache-status: "Netlify Edge"; fwd=miss` on
  most requests — 4 hits in 12 rapid GETs of `/perryidyll/vote`, the hits carrying a
  year's `ttl` and an `age` in the hundreds. Netlify keeps a copy per edge node and
  spreads requests across nodes, so the `max-age=60` in `netlify.toml` is the phone's
  rule, not the edge's; time to first byte for HTML was 0.42–1.36 s. Nothing in the repo
  changes that.
- **A durable-cache hit still costs ~0.45 s** from here (`profile`, `events`: `"Netlify
  Durable"; hit`); a `fwd=bypass` read costs 0.55–0.75 s warm and **1.8–2.0 s cold**
  (`/api/artists?maps=1`, `/api/events?places=1` first call) — the directory and the
  front door's map were the last two public reads on their own sleeping functions,
  never kept at the edge.
- **The artist page downloaded ~400 KB nobody saw.** Its three thumbnails and the
  portrait were drawn as `background-image: url(220px copy), url(original)` — meant as
  a fallback, but a browser downloads every layer: 85, 108, 123 and 85 KB of originals
  behind 3–9 KB thumbnails, on every first open.
- **Three pages held their whole parse on a script in the head.** `pull.js` sat in the
  head of the vote page, the front door and About with a comment saying blocking
  "costs nothing measurable" because the service worker serves it — true only for a
  phone that has the worker, which a first-time QR scanner does not. Measured
  0.15–0.53 s per fetch. Both Studios did the same with `theme.js`.
- **The vote page painted nothing until the board.** No logo screen, no skeleton: the
  HTML's wait, then app.css's (render-blocking, 0.16–0.67 s), then the board's, on a
  bare background.
- Fine as it is: Brotli on everything (`enc=br`), HTTP/2, DNS 2–3 ms, the head-start
  fetches (0050), `lastSeen` paint-first, `leave.js`'s prefetch-on-pointerdown, the
  image CDN's immutable `/api/img`, function replies compressed.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The measured, page-side and function-side fixes: one picture per slot; no blocking script in any head; the vote page paints its logo screen from the HTML, carries app.css's tokens inline and preloads the rest; the front door and the directory read through the warm door, cached, started from the head | the vote page's inline token block must match app.css (a structure check keeps it so); nine pages re-stamped; four functions touched | one `<style id="tokens">`, two head-start scripts, two more doors in `fan.mjs`, three structure checks | a stale token block paints old colours for the ≤400 ms before app.css lands — the suite refuses a stale one |
| B | Also inline all of app.css into every fan page | ~3,600 changed lines in `public/` on every app.css edit; the cross-page cache lost | a tool to re-inline, a test per page | an edit to app.css that is not re-inlined ships two designs |
| C | Serve navigations stale-while-revalidate from the service worker, so a returning phone paints instantly | a deploy lands on the tap after next, not the next; `sw.js` is "do not touch" (0ax) | none in code, one rule changed | a bad deploy stays on phones one tap longer |
| D | Split the community read into a shared, cached board and a small personal call, the way 0034 split the vote page's | a second endpoint, a client merge, a copy-of-the-merge test | one function, one test | the personal flags drift from the shared list |
| E — do nothing | | the artist page keeps downloading 400 KB of originals; the vote page keeps its bare first second | none | none |

## What was chosen, and why

A, all of it, because each item was measured before it was built and none changes a
rule the repo holds: no build step, no dependency, `sw.js` untouched, `public/` is the
site. B was declined for its diff noise — the vote page gets the one block that
matters (the tokens, ~2 KB) and the other pages already load app.css without blocking
(the preload pattern the artist page had since 0048); the front door and About keep
the blocking link on purpose, because their first paint is static HTML styled by
app.css's classes and a flash of unstyled buttons on a marketing page is worse than
0.2 s. C is a real, measured lever for returning phones and is left to the founder as
its own decision — it changes what "deployed" means during a gig. D is the next
project, not this one: `what=community` carries `fan=` and is `fwd=bypass` for a
reason.

The things the repo cannot fix are said plainly: the HTML edge lottery is Netlify's
(per-node caches; the only counter is more traffic per node, which a busy bar
provides); a durable hit's ~0.45 s from Asia is the distance to the region; the
image CDN's first transform of a cover (0.6 s) is Netlify's too.

## What this makes harder

The vote page's token block is a copy of app.css's top, kept honest by a test — an
edit to the tokens is a two-file edit until somebody makes `tools/stamp.mjs` write it
(it should). `pull.js` at the bottom means a page must not call `MySetPull()` from an
inline script in the head (none does; the structure check refuses a blocking `<script
src>` before `</head>` on a fan page, so the old placement cannot quietly return).
`artists` and `mapconfig` are edge-shared for 60 s and 300 s: a newly verified artist
appears in the directory within a minute, not instantly.

## What would reverse it

A measured first open on a phone in a bar that is slower with the inline tokens than
with the blocking link (then the link returns and the block goes); Netlify shipping
Early Hints or a shared edge cache for static files (then the head-starts and the
inline tokens buy less and can be reconsidered); the founder choosing C (then the
vote page's logo screen matters less on installed phones and more on first visits —
it stays either way).

## How it was verified

`sh test/run.sh` on the final tree: 52 files, 3,502 assertions, 0 failed — including the new `test/structure.mjs` checks (no stacked backgrounds on a fan
page; no blocking script in a fan page's head; the vote page's tokens byte-identical
to app.css; app.css preloaded), `test/fandoor.mjs` (the front door and the directory
ask the door), `test/artists.mjs` (the directory shared at the edge for a minute, never
by the browser) and `test/copy.mjs`. `node tools/uicheck.mjs`: 242 ✓ / 2 ✗ — the same
two as origin/main. `node tools/sheetcheck.mjs`: 39 ✓ / 0 ✗. `tools/mock.mjs` in the
app's browser at 375 px: the vote page's logo screen lifts at the first board, app.css
arrives through the preload and is applied (`rel` becomes `stylesheet`), the tokens are
inline, `pull.js` is at the bottom; with `fetch` made to fail the page says *Couldn't
reach the room* and recovers on the next load; the artist page draws one `<img>` per
slot and no stacked `url(`; the front door and the directory read through `/api/fan`
(network log). Production timings are the BEFORE; the AFTER is measured once this is
live (the session note says how).

Checked after the merge (68efdb4, PR #85): the deploy preview at phone width, and the
AFTER on production — `what=artists` / `mapconfig` / `places` at 0.42–0.46 s from the
durable cache (were 1.15–1.98 s cold), the artist page fetching 0 originals (were 4) —
in the session note's table. NOT checked: a real phone on bar wifi.
