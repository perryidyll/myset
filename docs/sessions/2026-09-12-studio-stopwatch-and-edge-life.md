# 2026-09-12 — the Studio gets a stopwatch, and a longer edge life

**Follow-up to decision 0050.** The head start shipped (`fdfdbaa`), and from a
desk the Studio's boot chain now measures about 2 s (page 0.65–0.93 s from a
*stale* edge copy, `/api/stage` 1.2 s, planGet 0.95 s, the two calls side by
side). The founder's phone still says 5–7 s. Nobody can see where those seconds
go from a desk, so instead of guessing — or rewriting the page into five pages,
which was proposed and declined (every tab tap would become a full reload and the
shared brain would be copied five times) — two small things:

1. **A stopwatch line** under *Sign out* on the Settings tab:
   `Opened in 2.3 s · page 0.8 · stage 0.9 · plan 0.6`. `page` is when the whole
   HTML had arrived (`navigation.responseEnd`); `stage`/`plan` are how long the two
   early reads from the `<head>` took to answer; `Opened in` is when the boot
   screen came down. If the 6 s safety timer is what ended the wait, the line says
   so — that is a hang to chase, not slowness. `window.__boot` in the head script,
   `BOOT`/`bootStat()` next to `bootDone()`.
2. **Edge life for `/studio` and `/studio.html`: 60 s → 10 min** (+1 h
   stale-while-revalidate). One person opens the Studio a few times a day, so the
   60 s copy never hit. The rule sits after `/:slug` so it wins for the same header.

**Next, with the phone's number in hand:** the Studio's script into its own
cached file (`/studio.js`, a year in the browser, new name per deploy) so return
visits skip the 98 KB download; optionally let the boot screen drop on `stage`
alone and let the plan fill in after.

**Seen on the way:** the suite on `origin/main` is red before this branch —
`test/structure.mjs` wants `function fitTabs(){` and `top:var(--headh` in
studio.html, and `test/copy.mjs` fails "the Studio Live tab label is red" and
"Settings omits the retired gig…". Those belong to another session's in-flight
Studio work; nothing here touches them. Every other file: green.
