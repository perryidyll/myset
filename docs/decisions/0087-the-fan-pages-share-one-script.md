---
id: 0087
title: The fan pages share one script
date: 2026-09-25
status: decided
decided_by: perry
area: performance
reverses:
superseded_by:
invariants: [0gc]
commits: []
tests: [test/structure.mjs, test/_src.mjs, test/copy.mjs, tools/sheetcheck.mjs, tools/uicheck.mjs]
files: [public/fan.js, public/index.html, public/artist.html, public/artists.html, public/vote.html, public/community.html, public/venue.html, public/about.html, public/shop.html, public/diary.html, tools/stamp.mjs, netlify.toml, test/_src.mjs, test/structure.mjs]
---

## The question

Every fan page was hand-written and self-contained, which is why one request draws
a page and why no build step exists — and it meant each page carried its own copy of
the same helpers. A read-only study on 2026-09-25 (the single-page-app question: is
MySet worth rewiring as one?) counted them at origin/main: fifty-eight names declared
on two pages or more, seventeen still byte-identical, forty-one drifted. The bottom
sheet was the clearest case — the shop's copy had learned focus, `inert` and Back-
closes-it, the artist page's had learned the frozen-page counter, the vote page's
had learned neither, and the venue's had no grab zone at all; `toast` sat at three
different durations; `firstName()` on three pages fell back to the word "the". The
founder asked for the shared brain to be made one file now, without the single-page
rewrite the study had argued against.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One classic script, `public/fan.js`, loaded by every fan page right before its own `<script>`; the helpers move there and the page copies are deleted; the shop's sheet is the sheet; the file is hash-stamped and immutable like `studio.js` (0053) | nine pages carry a stamp line; a name declared in fan.js may not be declared by a page; one more file to fetch on a first visit (8.8 KB gzipped, in parallel with the three the pages already load) | `fan.js`, nine `PAIRS` rows in `tools/stamp.mjs`, one header rule, `src()` reading the pair, three structure checks | a stale stamp ships old helpers under a new page — the suite refuses it; a page redeclaring a name paints nothing — the suite refuses that too |
| B | Also move each page's OWN script out, the way `studio.html` → `studio.js` went | a fan's only open of the night waits on a second round trip before its script can run; every page becomes two files to edit; ~16 tests re-pointed | nine more script files | the vote page slower on exactly the visit that matters |
| C | A real single-page app with a client router | weeks; a build step, or 'unsafe-inline' forever; a router in front of Stripe's return URLs; every source-reading test rewritten | a framework or a hand-written router | a bug in the shell takes every view down at once |
| D — do nothing | nine copies keep drifting | the next sheet fix lands on one page and not the others, as the last three did | none | none |

## What was chosen, and why

A, because it is the whole of the win the study found and none of the cost: the
copies become one, the drift stops, and no page pays a new serial hop — `fan.js`
is fetched alongside `theme.js`, `leave.js` and `pull.js`, which the page's own
script already waited for. The founder chose it on 2026-09-25 ("please do this
step now, along with the shared modules"). B was left for a measured reason to
exist (see the study: the saving lands on a hop fans rarely make); C the study
recommended against.

Where two copies disagreed, the more careful one won and the reason is in the
file: the sheet is the shop's (inert page, focus on the title, focus back to the
opener, Back closes a history-entry sheet) on the artist page's frozen-page
counter, with per-page drag zones declared on the element (`data-handle`,
`data-scroller`) and two events (`sheetopen`, `sheetclose`) for what a page must
do around it; `esc` is the null-safe one; `fmtTime` and `dirHref` are the
null-safe ones; `firstNameOf` falls back to the whole phrase; `toast` is 3.6 s
everywhere (the vote page's, the room in the dark); the clipboard says "copied"
only once it has. Two visible changes came with that and are meant: the venue's
pitch sheet now has the grab zone and the ✕ every other sheet has, and the front
door's home-screen sheet freezes the page behind it.

What stays per page, on purpose: `SLUG` and `FAN`, `handleReturn()`/`redeem()`
(INVARIANT 5b), `openTip()`/`pickTip()` (the copy differs, the state differs),
`nextGig()`, and everything that draws the page.

## What this makes harder

A helper that every fan page uses now has one definition and nine callers: an
edit to `openSheet` is an edit to six pages at once, which is the point and the
risk. `node tools/stamp.mjs` must run after ANY edit to `fan.js` (the structure
suite fails loudly if it did not). A page may not declare a name `fan.js`
declares — the structure suite names the clash — so a new page-local helper
needs a name check first. The Studios still keep their own copies of `$`, `esc`,
`toast` and their own sheet; folding those in would mean the Studios loading a
fan-page file, which 0053 kept apart.

## What would reverse it

A build step arriving for another reason (then bundling replaces the stamp and the
one-file-per-page rule goes with it), or a measured first open of the vote page on
a phone in a bar that is slower with the extra file than without — in which case
the file's contents inline back into the pages, one copy each, and this record is
marked reversed.

## How it was verified

`sh test/run.sh`: 52 files, 3,478 assertions, 0 failed — including the new checks
in `test/structure.mjs` (every fan page loads `fan.js` once before its own script,
none redeclares a name it declares, every page with a sheet loads it) and the
stamps. `node tools/sheetcheck.mjs` (real Chrome, real touch): the vote page's
lyrics sheet 12/12 and the shop's product sheet 27/27 — frozen, inert, focus on
the title and back to the card, a drag inside the lyrics or the size row does not
move the sheet, the title pulls it down, Back closes it, the strip's loop stops.
`node tools/uicheck.mjs` against origin/main's pages and against these: 242 ✓ / 2 ✗
both times, the same two (the stale profit figures the 2026-09-20 push log
names). `node tools/clipcheck.mjs`: one ✗ on both trees (the size refusal's
wording), not from this change. `tools/mock.mjs` in the app's browser at 375 px:
the front door, an artist's page, the vote page (lyrics and tip sheets), the
community page (tip sheet, composer parked), the shop (product sheet, Back),
the diary, a venue's page (pitch sheet, new grab zone), the directory and About —
no console errors, every sheet froze and thawed the page and gave focus back.

NOT checked: a deploy preview (the change is not pushed); `/fan.js` answering
`immutable` from Netlify — the header rule is the same shape as `/studio.js`'s,
which does; the first open on a real phone in a bar.
