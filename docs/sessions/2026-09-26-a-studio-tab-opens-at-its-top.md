# 2026-09-26 — A Studio tab opens at its top (UX-058)

**Asked:** the first tap on the Studio's Gigs tab took a moment to load, and when it
finished the page sat at the bottom. Make it open at the top. Then: ship it.

## Cause

`render()` in `studio.js` saves `window.scrollY` and puts it back, so the 4 s live
poll never moves an artist who is reading. `setTab` calls `render()` too, so a tab
switch carried the previous tab's offset onto the new one. Gigs before its reads
answer is short (~740–880 px at phone size), so the offset clamped to its bottom;
when the gigs arrived the page grew and the offset stayed. The Venue Studio's
`render()` does not save the offset, but replacing the page kept it all the same.

## Change

`setTab` in both Studios scrolls to the top when the tab changes. A re-render of
the same tab still keeps the scroll. Per-tab scroll memory (iOS's own tab bars) was
considered and not chosen: a remembered offset on a tab still loading clamps the
same way, and the ask was the top.

## Verified

- `tools/mock.mjs` with the Gigs reads held 1.5 s, before and after, in Chrome
  (375×812) and Playwright WebKit (webkit-2359, iPhone 13): before, scrollY 72 =
  the bottom of the loading page, still 72 once loaded; after, 0 and 0.
- Same-tab re-render keeps 300 → 300. The Venue Studio's tabs open at 0.
- `test/copy.mjs` guards both `setTab`s, mutation-tested; `sh test/run.sh` 3,434/0.

**Live as `beed75b`** (PR #98, merged 06:21 UTC); production verified by content at 06:22 — both Studios' pages point at the new stamps and the scripts carry the new `setTab`. Main moved twice under the PR (#99, #100); the ledger was re-applied on top each time.

**Not checked:** a physical iPhone. A Studio already open on a phone keeps the old script until it reloads.
