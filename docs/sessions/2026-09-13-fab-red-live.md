# 2026-09-13 — The floating bar: red while live, the words are the button

Branch `ui/fab-live-red`, worktree off `34215b8` (PR #27), Efficient Mode. No decision record — the founder's colours.

## What was asked

Make the floating bar's button red while a show is in progress and change its text to "enter now to vote"; while counting down, make the words *view setlist* pink-orange and keep the parentheses in the pill's ink.

## What shipped

`public/artist.html`: `.act.now` (true-red `#FF3B30` fill, white text, red shadow, the glow kept) on the live button, text *ENTER NOW TO VOTE* (upper case like the label it replaces); `nextLabel()` wraps the words in `<i class="vs">` (pink-orange `--accent-2`), the tick writes `innerHTML`; `.act.cd` is `display:inline-block` so the flex gap does not open the parentheses. `tools/uicheck.mjs` and `test/copy.mjs` assert the new label; design-system and master overview updated.

Also in this PR: the ledger row and session note for UX-039 (band names + hero video, PR #27 `34215b8`) and the note on how its production build was recovered after GitHub's outage.

## Verified

Suite 44 passed / 0 failed. uicheck 113 ✓ / 0 ✗ against the worktree. Headless (`shots10.mjs`): live → text *ENTER NOW TO VOTE*, background rgb(255,59,48); next → *Live in 22h 34m 40s (view setlist)*, `.vs` rgb(255,86,80), parentheses in the pill's ink. Screenshots `b10-live-light.png`, `b10-next-light.png`. Preview and production by content after the merge.
