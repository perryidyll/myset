# 2026-09-25 — The founder's three levers: the service worker (0091), app.css inline (0094), the community read split (0093)

**Asked:** "let's do the service worker stale-while-revalidate next" — the first of the
three levers 0088 left to the founder. Same day, after 0087/0088 went live as `68efdb4`.

## What changed

`public/sw.js`, the one file the agent guide marks do-not-touch, on the founder's word:

- **Rule 2 rewritten.** A page this phone fetched in the last six hours (`FRESH`) is
  shown at once from its copy and re-fetched behind (`waitUntil`); older or unseen
  pages wait for the network, the copy is only the no-signal fallback. The copy is
  keyed by path (the query never changes the HTML) and stamped `x-myset-stored` on the
  way in; a redirect or a non-200 is never stored. Cache name `myset-runtime-v4`, so
  the old cache is dropped on activate.
- **Rule 3 tightened.** A stamped file (`?v=…`) is never re-asked once held; the
  background refresh of an unstamped static file is held open with `waitUntil`.
- Push, notification click, activate and the `myset-unregister` escape hatch:
  byte-identical.

- **Two rules the review added.** A reload (`no-cache` / `reload`: a pull, the
  Studio's button) asks the network first — the fan's only hatch stays a hatch. A
  page that says `no-store` or `private` (the passcode-gated money model) is never
  stored. Every cache call is guarded so a broken store never costs the page.

INVARIANT 0ax rewritten; 0ce, the agent guide's row, `netlify.toml`'s comment (which
had claimed HTML is `must-revalidate` — it has been a minute fresh since 0048),
`pull.js`, six pages' registration comment, `FINGERPRINTS.md`, 0038, the master
overview and the handoff say the new thing. `test/sw.mjs` is new and in
`test/run.sh`: the real worker in a fake browser, 33 assertions, each rule proven by
mutation (delete the rule, the test fails).

## The review

A fresh-context reviewer read the first cut and found: the money model stored and
served for six hours without its passcode gate (fixed: `no-store`/`private` never
stored); `pull.js`'s reload landing on the copy — the exact case 0ce is about (fixed:
`no-cache`/`reload` go network-first); a rejected `caches.match` failing the navigation
before the network was asked (fixed: every cache call guarded); the `/api` assertion
vacuous — the request would not have been intercepted anyway (fixed, and every rule
mutation-checked); stale sentences in `pull.js`, six pages, `FINGERPRINTS.md`,
`netlify.toml`, 0038 (fixed); the overview's assertion count unstamped (fixed:
`node tools/overview.mjs --tests`); the `?v=` rule undersold in 0091 — it is
load-bearing (rewritten). Two of its claims were not taken: the overview's suite and
decision counts are generated, not typed; the `docs/processes/` sheets are untracked
in another session's checkout, so the Puzzle changelog entry (2317) stands in.

## Verified

`node test/sw.mjs` 33/0, eight mutations each fail. `node tools/overview.mjs --tests` 3,535/0. The app's browser on
`tools/mock.mjs` with the worker registered by hand (pages only register on https):
artist page first open 101,281 bytes over the network, stored by path with its stamp;
second open (different query) 0 bytes transferred, page whole; a `location.reload()`
(type `reload`) 101,281 bytes — the reload goes to the network; the open after it 0
again; vote page 117,484 then 0, board rendered both times; no `/api` key in the cache;
no console errors; `myset-unregister` still drops the worker and reloads. For that
check `tools/mock.mjs`'s pages now say `no-cache` instead of `no-store` (the worker
refuses `no-store`; production's pages are `public, max-age=60`, verified by read-only
GETs — only `/moneymodel` is `private, no-store`).

## Later the same session: "please do all of these!"

The founder, given the three levers in plain words (the worker's rule, inlining app.css,
splitting the community read), asked for all three, then added: "double check every
single line of code one last time before shipping it all live".

**app.css inline (decision 0094, INVARIANT 0gh).** `tools/stamp.mjs` gained the inline
step — `appBlock`/`appRe`, the whole file between `<style id="app-css">` and `</style>`
on all nine fan pages, where the `<link>` stood; the vote page's 0088 tokens block and
the five preload/noscript pairs are gone; `test/structure.mjs` refuses a stale copy, two
blocks, or a re-added `<link>`. `fan.js`'s `cssReady()` is true at once (comment only;
the waits stay for any page that links a stylesheet again). Sentences re-pointed:
`netlify.toml`'s CSS comment, `AGENTS.md`'s row, `docs/design-system.md`'s table, the
artist/index/vote/shop/diary comments that reasoned about a stale or in-flight app.css.
**A bug of mine, caught in the app's browser:** the first cut named the block
`id="app"` — every fan page's content container is `<div id="app">`, so
`getElementById('app')` found the style element first and the page's render wrote its
HTML into the stylesheet (posts 0, buttons square, body unpainted). Renamed `app-css`;
the invariant says why.

**The community read split (decision 0093, INVARIANT 0gg).** `community.mjs`: a GET with
no device named is the shared read (`canPost` true, every mark off, no token consulted,
`jsonCached(…, 30)`); `…&fan=<id>&me=1` is the personal call (`mine`, `editable`,
`liked`, `canPost` — registry, posts, likes, nothing else, never cached); the old whole
reply stays; every reply that carries the list says when it was made (`at`).
`community.html`: both reads start from the head (the shared one for a signed-in artist
too), the page paints from the shared one, `wear()` puts the marks on from the kept copy
and then from the personal call (redrawing only if a mark changed), a newer list the
phone already holds outranks an older shared copy (a post just made never vanishes on a
pull), `like()` marks `D`. The shop's read is the shared one for free. `tools/mock.mjs`
answers `me=1`; `test/community.mjs` +20, `test/fandoor.mjs` +3.

**Verified.** `node tools/overview.mjs --tests` 3,571/0 (stamped). `tools/uicheck.mjs`
242 ✓ / 2 ✗ — the same two stale profit figures as origin/main. `tools/sheetcheck.mjs`
39/0 — after one assertion was moved from `getBoundingClientRect().height` to
`offsetHeight`: with the styles present at first paint the sheet is mid-spring when the
check runs and the bounding box read 55.99998 px against a `min-height` of 56; the
layout height is the thumb target. The app's browser on the mock at 375 px: no request
for `/app.css` from any of community/artist/vote/shop, 98 inline rules, buttons at
999px radius, body painted from the tokens in light and dark, the vote board drawn with
`CSSWAIT` 0; the community page fires `what=community&a=demo` and `…&me=1` from the
head, 5 posts, the composer docked; the shop asks the shared read alone.

## Not done

Not committed, not pushed, not live at the time of writing — the fresh-context review
the founder asked for comes first, then the PR. Not checked on production or on a
phone. Option D (tell the page a newer copy arrived) is still his; the other two 0088
levers were built later the same session (below).
