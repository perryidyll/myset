# 2026-09-29 — The theme switch grows as a circle

**Asked:** the user liked HQ's expanding-circle light/dark switch and asked how hard it
would be in the app, and whether it would lag. Then: build it and ship it.

**Shipped:** decision 0121. `public/theme.js` — the one file every page's toggle goes
through — now runs the switch inside `document.startViewTransition` and grows a
`clip-path` circle on `::view-transition-new(root)` from the tapped button (720 ms, HQ's
easing). CSS is injected by theme.js on first use; no page changed. Instant as before
without the API, with Reduce Motion, or while hidden. The iOS home-screen reload and the
status-bar scroll nudge wait for the circle to finish. Live as `d10d24e` (PR #159).

**Verified:** `sh test/run.sh` green (new check in test/copy.mjs); headless Chrome at
390×844 on tools/mock.mjs `/studio?tab=settings` and on deploy preview 159's home page:
the circle ran from the button, ended in the new theme with nothing left behind; reduced
motion switched instantly; production served the new theme.js at 12:44 UTC.

**Not checked:** a real iPhone, including the home-screen reload after the circle.

**Learned:** the app's browser pane pauses rAF while hidden, so a view transition cannot
be watched there; headless Chrome through tools/_puppeteer.mjs can. The Studio mock opens
the "Waiting for you" card, which swallows a coordinate click on the header.
