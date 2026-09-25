---
id: 0090
title: The page-change, boot and busy loaders move by transform from their first frame, and lyrics read as verses in the MySet face
date: 2026-09-25
status: decided
decided_by: founder
area: ui
reverses:
superseded_by:
invariants: [0gf, 0dp, 0f1, 9f]
commits: [ee39bb1]
tests: [test/copy.mjs, test/structure.mjs, test/syntax.mjs, tools/sheetcheck.mjs, tools/uicheck.mjs]
files: [public/leave.js, public/vote.html, public/artist.html, public/community.html, public/diary.html, public/shop.html, public/venue.html, public/studio.html, public/venue-studio.html, public/studio.js]
---

## The question

The founder sent a screen recording from an iPhone (2026-09-25). Every page change
showed the MySet splash as three still dots for most of a second, and only then did
the bars start to move. The ask was that the loader should run from its first frame,
because an Apple app would. In the same message the founder asked for a revamp of
the lyrics sheet, starting with the format. The artist's Studio sheet was set in a
typewriter font (the chord chart's monospace) and was hard to read. The ask for both
sheets was the standard MySet font, plenty of white space, and verses that alternate
between white and light grey.

Why the dots froze: every loader animated `height`. The page's main thread draws a
height animation. WebKit stops drawing the old page's frames once a navigation's
provisional load starts, and they stay stopped until the next page is visually
non-empty. The source path is `WebLocalFrameLoaderClient::provisionalLoadStarted`
→ `WebPage::didStartPageTransition` → `freezeLayerTree(PageTransition)`. The bars
also carried small positive delays (.02/.12/.22 s). WebKit only hands an animation
to Core Animation once its delay has run out. So the frame that froze was the bars
still at their 18 px rest height, which reads as three dots.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Each bar is a fixed-height rounded window (`i`, `overflow:hidden`). A rounded pill (`b`) slides up and down inside it by `transform: translateY`. The gradient (`b::before`) stretches with the visible part by `scaleY`, on the same timing. Negative delays mean the first frame is already mid-swing. | One `<b>` inside each bar's `<i>`, and a second keyframe per bar height. | None. It stays CSS only, with the same show/hide code. | If a browser did not composite it, it would behave exactly like today, a main-thread animation. |
| B | Animate `transform: scaleY` on the bar itself. | One line per splash. | None. | The round ends squash and stretch with the scale, so the logo looks wrong. |
| C | Wait longer before navigating, so the height animation is seen moving first. | Adds latency to every tap. | None. | It only hides the freeze. It still freezes. |
| D — do nothing | Keep the height animation. | Nothing. | None. | The recording stays true on every page change. |

For the lyrics, the chosen design keeps the Studio's `chartview stage-lyrics`
classes. `chartOpen()` and the tip burst's brief mode depend on `.chartview`, and
test/copy.mjs reads that rule. Only the stage-lyrics rule changes font, and the
chord chart keeps monospace. The rejected alternative was a new class, which would
have needed `chartOpen` and the test changed.

## What was chosen, and why

**Loaders.** A transform animation is handed to Core Animation. It keeps playing in
the system's render server through the navigation freeze and while a page's scripts
are busy, so it is the only kind that can "run immediately" here. Where it applies:

- the leave splash (`leave.js`, every fan page)
- the six fan-page arrival splashes (`#intro`: artist, community, diary, shop,
  venue, and the vote page's new one from 0088)
- both Studios' `#leave`, `#boot` and `#busy`

Two bar animations still move by height, by choice:

- the in-feed clip loader (`community.html` `.clipwait`). It is not a page change.
- the home page's once-a-session opener (`index.html` `#intro`). It is a one-shot
  spring whose bezier overshoots, which WebKit would not composite anyway.

The window-and-pill shape keeps both ends of every bar round at every height. The
translate and the scale run on one timing, so the whole pink-to-orange gradient
fills whatever part of the bar is showing, exactly as when the bar itself grew. The
first review of this change caught an earlier version that had the gradient on the
sliding pill. At rest that showed only the pink end, and the three bars differed.

The negative delays do two things. The first frame is the three-bar logo
mid-swing, not three dots. And the animation is active from the start, so nothing
is held back from the compositor. Rest and peak heights, widths, colours and rhythm
are unchanged. The Venue Studio's `#busy` gained the reduced-motion rule the Artist
Studio's always had, a still 28 px.

**Lyrics.** Both sheets now use `--f`, the Apple system face (SF Pro on an iPhone).
That is the face every other MySet screen uses; no web font is loaded. The type is
larger: 20 px in the Studio, read from a music stand, and 19 px on the vote page.
Line height is 1.55. The text is split into one block per verse on its blank lines,
and each block is set as text, never HTML. Every other block sits on a light grey
band: `rgba(120,120,128,.12)` in light mode and `.24` in dark mode. Those are Apple's
own fill alphas, so the band is visible on both the white and the near-black sheet.
The boxes reach into the sheet's padding, so the bands do too, while the words stay
aligned with the title.

**Studio drag.** The Studio's sheet drag now ignores a touch that starts inside
`.chartview`. Before this, scrolling the lyrics back up dragged the whole sheet down.
The vote page has refused a drag from inside `.lyr` since INVARIANT 0f1.

## What this makes harder

- A new loader must follow the same shape: a window `i`, a pill `b`, a gradient
  `b::before`, a translate and a scale keyframe on one timing, and negative delays. A height animation copied from an old
  page would bring the freeze back.
- A universal `*` reduced-motion rule does not reach `::before`. Each splash
  therefore carries its own `::before{animation:none}` rule.
- The Studio's lyrics can no longer be used to drag the sheet closed. The grab
  handle, the title and the ✕ still close it.

## Landing beside the fan-page script (0087, 0088)

The fan-page script batch (0087, the fan pages sharing one script, and 0088, the
first-open speed pass) was built on its own branch on the same day and went live
first, as 68efdb4. Its decision numbers are why this record is 0090; 0089 had
also been taken, by the money-model audit.

This batch was rebased onto it. The only conflicts were in the two generated
documents. 0088 had given `vote.html` its own `#intro`, copied from the old
height-bar recipe. It was converted here to the same window, pill and fill shape,
so the vote page's arrival splash does not freeze either. The vote page's lyrics
scroller guard now lives in `fan.js` (`SCROLLER` includes `.lyr`) and still covers
the verse blocks.

## What would reverse it

- A WebKit release that keeps drawing main-thread animations during a page
  transition would make the window-and-pill shape unnecessary. The threaded
  animation resolution in Safari Technology Preview is a candidate; it was not
  checked there.
- A lyrics format with section headers or timing, such as synced LRC, would want a
  richer block than one plain verse per band.

## How it was verified

- **The freeze, before and after, in a real WebKit.** Test rig: iPhone 17 Pro
  simulator (iOS 27.0), Mobile Safari, and a local server that answers the next page
  3 s late. The rig ran the old and new `leave.js` byte for byte, plus the Studio's
  own `#leave` CSS and `goTo` (40 ms, then one frame). It was recorded with
  `simctl io recordVideo` and sampled at 8 fps. The old versions showed identical
  still dots for the whole 3 s wait, which matches the founder's recording. The new
  versions showed the bars moving in every sampled frame of the wait, from the
  first frame on. That held on both paths, including the Studio's single-frame
  handoff. Both ends stayed round at full resolution.
- **Old against new, pixel for pixel.** Tools: Playwright WebKit (webkit-2359) and
  headless Chrome, 390 px at 3x. Scope: all twelve splashes (5 × `#intro`,
  `#msLeave`, and `#busy`/`#leave`/`#boot` in both Studios). Every animation was
  paused at 0, ¼, ½, ¾ and the end of its swing.
  - Visible heights (18→38/64/28 and 12→44) and widths matched old at every sample.
  - Both ends were round at every sample.
  - Nothing was drawn outside the bars, running or paused.
  - The mean bar colour was within 1/255 of old at every sample, in both engines.
    At rest it was 255,89,83 against old 255,90,83, the same on all three bars.
  - Reduced motion was identical, except the Venue Studio `#busy` change noted
    above.
- **Lyrics at 375 px, in the mock (`tools/mock.mjs`, Chromium).**
  - Tested with sample multi-verse text containing `\r\n` and blank lines of spaces.
  - Four verse blocks, with bands on the 2nd and 4th.
  - Nothing overflows sideways: `scrollWidth == clientWidth`, `overflow-x:hidden`.
  - The words line up with the title (18 px on vote, 20 px in the Studio).
  - The font resolves to the `-apple-system` stack.
  - `chartOpen()` is still true with the lyrics open.
  - The chord chart is still `ui-monospace` with `white-space:pre`.
  - Checked in both light and dark themes.
- `sh test/run.sh`: 3,282 passed, 0 failed (3,288 after the rebase onto 0087/0088,
  with the 0gf guard).
- **Live as `ee39bb1`** (PR #90, merged 2026-09-25 06:22 UTC). Production was
  verified by content at ~06:24: every changed page and script serves the new code.
  The deploy preview was checked at 375 px first.
- **Not checked:**
  - On a physical iPhone, or in a home-screen install.
  - On Android Chrome. Paint holding there can show a still frame for up to 500 ms
    after commit.
  - `tools/uicheck.mjs` and `tools/sheetcheck.mjs`: puppeteer is not installed in
    this checkout.
  - The Studios' `goTo` still navigates one frame after showing `#leave` (leave.js
    waits two). One reviewer read WebKit's source as a race. Another re-ran it in
    the simulator and it held every time, which matches the recordings above. It
    was left as it is.
