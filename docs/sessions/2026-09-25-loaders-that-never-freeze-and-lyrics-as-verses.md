# 2026-09-25 — Loaders that never freeze, and lyrics as verses (decision 0090)

**Asked:** the founder sent an iPhone screen recording. The loading screen's
animation paused briefly before it ran. The ask was to make it run immediately,
because an Apple app would. In the same message the founder asked to revamp the
lyrics pop-up for artists and the audience, starting with the formatting: the
standard MySet font instead of the Studio's typewriter face, plenty of white space,
and verses alternating white and light grey. Then: *"please ship it live."*

## What the recording showed

Frames were sampled at 15 fps. On every page change the splash sat as three still
dots for ~0.9 s, and only the next page's own splash moved.

The cause, read from WebKit's source and then reproduced:

- The bars animated `height`, which is drawn on the page's main thread.
- WebKit freezes the old page's layer tree from provisional-load start until the
  next page is visually non-empty. The call path is
  `provisionalLoadStarted` → `didStartPageTransition` → `freezeLayerTree(PageTransition)`.
- The bars' positive delays (.02/.12/.22 s) also kept them off Core Animation. At
  the moment of the freeze they were still at their 18 px rest, which is three dots.

## What shipped

- **Splashes.** Every page-change, boot and busy splash is rebuilt: `leave.js`, the
  six fan-page `#intro`s, and both Studios' `#busy`/`#leave`/`#boot`. Each bar is a
  rounded window `i`, a pill `b` that slides by `translateY`, and a gradient
  `b::before` that scales by `scaleY` on the same timing. All of it is compositor
  work, with negative delays. The look is unchanged: heights, widths, round ends,
  colours and rhythm.
- **Lyrics.**
  - The Studio's sheet (`.chartview.stage-lyrics`) now uses `--f`, the Apple system
    face (SF Pro on an iPhone), at 20 px.
  - The vote page's `.lyr` is 19 px.
  - Both split into `.lyr-st` verses on blank lines and set each verse as text.
  - Every other verse sits on `rgba(120,120,128,.12)`, or `.24` in dark mode.
  - The boxes reach into the sheet padding, so the bands do too, while the words
    stay aligned with the title.
  - The chord chart keeps monospace, and `chartOpen()` still sees the lyrics.
- **Studio sheet drag.** A drag that starts inside `.chartview` now scrolls the words
  instead of closing the sheet (0f1).
- **Guards.** INVARIANT 0gf, and two checks in `test/copy.mjs`.

## What broke along the way

The first version put the gradient on the sliding pill. The adversarial review
measured the result: at rest the bars showed only the pink end, and the three bars
differed. The stretching `b::before` fixes that. The re-measure was within 1/255 of
the old colour in WebKit and Chrome.

## Landing beside 0087/0088

The fan-script batch went live first, as `68efdb4`. This branch rebased onto it,
and the only conflicts were the two generated docs. That batch's new vote-page
`#intro` still had height bars, and it was converted here. Decision numbers 0087,
0088 and 0089 were already taken, so this record is 0090.

## Verified

- **iOS 27 Simulator, Mobile Safari.** The next page answered 3 s late, recorded
  with `simctl io recordVideo`. The old `leave.js` and the Studio `#leave` froze for
  the full 3 s. The new ones moved in every sampled frame.
- **Old against new, pixel for pixel.** Playwright WebKit and headless Chrome, all
  twelve splashes, paused at five points. Everything matched, within 1/255 on colour.
- `sh test/run.sh` 3,286/0.
- `tools/sheetcheck.mjs` 39/39, including "the words scroll on their own" and
  "dragging inside the words does not drag the sheet".
- `tools/uicheck.mjs` 242 ✓. Its 2 ✗ are the known stale profit figures.
- **Not checked** on a physical iPhone.
