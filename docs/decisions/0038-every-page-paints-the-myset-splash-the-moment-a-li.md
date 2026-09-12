---
id: 0038
title: Every page paints the MySet splash the moment a link is tapped, and starts its first call from the head
date: 2026-09-12
status: decided
decided_by: claude
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/syntax.mjs, test/structure.mjs, test/copy.mjs]
files: [public/leave.js, netlify.toml, public/artist.html, public/vote.html, public/community.html, public/venue.html]
---

## The question

The founder asked for two things on 2026-09-12: make switching between pages
faster, and make the MySet logo animation appear the instant a person taps
something that goes to another page. A read of how the pages load found four
places the wait was coming from: (1) only the two Studios painted a splash before
leaving — the artist, vote and community pages went white between taps; (2) every
page's first API call could not start until `app.css`, `theme.js` and `pull.js`
had all arrived, because the call lived in the page's own script below them;
(3) Netlify's default for every static file is `max-age=0, must-revalidate`, so
each page opened re-asked the network about those three files (four now) and got
"not modified" back — a round trip each, in a bar, on Safari, which has no service
worker help; (4) the default cover photo was a 277 KB image drawn 400 px wide.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One shared `leave.js` paints the splash synchronously in the click and navigates two frames later; an inline `<script>` in each fan page's `<head>` starts its first API call before the stylesheet blocks; `Cache-Control: max-age=600, stale-while-revalidate` on `/*.css` and `/*.js`, a day on images; Chrome speculation-rules prefetch on pointerdown; `band-sm.jpg` as the default cover | One more script per page (cached), ~40 lines of head script across four pages | `leave.js`; `window.__early` handed from head to boot | A CSS change takes up to ten minutes to reach a phone that already has the file; a script that fails to load leaves the page working with a plain navigation |
| B — also edge-cache `/api/profile` and `/api/events` for 10 s like the board | Repeat opens of an artist page skip the function | Same durable-cache pattern as 0034 | The Studio reads `/api/profile` after saving; a 10 s stale copy would show the artist their old photo | Rejected: helps only a second open within 10 s, and the artist would notice the staleness |
| C — a single-page app with client routing | No navigation at all | A rewrite of nine pages and the one-file-per-page rule | Everything | Far outside the ask |
| D — do nothing | — | — | — | White flashes and four revalidations per tap stay |

## What was chosen, and why

A. Each piece is small, independent and reversible, and none of them changes what
the server does. The HTML pages themselves deliberately keep `must-revalidate` so
a deploy is on every phone at its next tap (sw.js rule 2 says the same). The
Studios keep their own `goTo`; `leave.js` steps aside if `window.goTo` exists.

## What this makes harder

Nothing structural. A rename of `app.css` or `theme.js` should be a new filename,
not a same-name change, if it must land within the ten-minute window.

## What would reverse it

A measured page-switch that is still slow after this — the remaining wait is the
function's own time, which is a server matter (0034's pattern applied to more
endpoints), not a page one.

## How it was verified

`test/syntax.mjs`, `test/structure.mjs` and `test/copy.mjs` (37/37) after the
change; `node --check public/leave.js`; every inline block in the four pages
compiled with `new Function`. NOT verified in a browser: the session's preview
server pointed at another project's folder, and a screenshot pass was not worth
the founder's credits. The first production tap is the check.
