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

## Same evening — the stopwatch found it

Eight readings from the founder (laptop + phone, Chrome + Safari, browser + installed
app): page ≤ 1.4 s, stage ≤ 1.7 s, plan ≤ 1.1 s, **Opened in 6.0–7.4 s, "the 6 s
timer ended the wait" on all eight.** Reproduced in the Browser pane after he signed
in (`BOOT.forced:true`, 6.96 s); the console said why:
`ReferenceError: drawFirstRun is not defined at render … at load (studio:1063)`.

`render()` calls the first-run wizard at its tail. The call reached main in `5b4a531`
(this session's pass-one commit carried ~290 uncommitted lines of another session's
wizard, the same way it carried the decision-0043 profile work) while the function
was still being written. So from 16:10 every paint of the Studio threw at that line:
`load()` never reached `bootDone()` — every open waited the full 6 s safety timer —
and the lines after it in render() (scroll restore) never ran. The head start and
the pings (0050) were real but invisible behind that timer.

The other session shipped the function itself in PR #11 (`d980ec4`, 18:56), which
is the fix; a one-line guard prepared here (PR #13) was closed unmerged as
superseded. Verified live after #11 with the founder signed in:
`Opened in 1.8 s · page 1.3 · stage 1.2 · plan 0.9`, `forced:false`.

Two lessons, both now in the push-log rule: stage only your own hunks (this was the
second casualty of one commit), and a boot screen with a safety timer needs a
readout that says when the timer — not the data — ended the wait. The stopwatch
stays; the founder reads it, nobody guesses.
