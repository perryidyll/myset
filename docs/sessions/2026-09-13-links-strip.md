# 2026-09-13 — The link pills drift, the other way

Branch `ui/links-strip`, worktree off `b966884` (PR #24), Efficient Mode. No decision record — a presentation change with no alternative worth arguing.

## What was asked

After batch seven went live the founder reported the Bandcamp link he saved was not on his page. The live profile record had `bandcamp: ""` — the code was live and `safeLink` accepts `https://name.bandcamp.com`; he retried and it saved ("the https:// was pasted but for some reason it just didn't save" — cause not found, not reproduced). Then: rename the artist page's link heading to *Listen, follow, & support* ("list, follow, & support", read as *listen*) and make the pills auto-scroll like the proof strip above, in the opposite direction (left to right).

## What shipped

`public/artist.html`: `.links` is a nowrap `overflow-x:auto` strip (scrollbar hidden), pills `flex:0 0 auto`; `render()` draws the set twice (ghost copies `tabindex=-1 aria-hidden`) when there are two or more pills and motion is allowed; `startProof()` became `drift(id,dir)` run for `#proof` (+1) and `#links` (−1) with per-strip frame/timer handles in `DRIFT{}`. Running backwards the scroll starts one set in and is pushed forward a set when it reaches the front. `test/darkroom.mjs` and `tools/uicheck.mjs` assert the new heading; uicheck's last-pill check queries `.links a:not([aria-hidden])`. Master overview and `docs/design-system.md` note the change.

## Verified

Suite 44 passed / 0 failed. uicheck 113 ✓ / 0 ✗ against the worktree. Headless harness (`shots8.mjs`): heading *Listen, follow, & support*, 6 real pills + 6 ghosts, over 1.5 s proof strip +42 px and links strip −42 px. Deploy preview 25 by content, then myset.vip by content 30 s after the squash merge `466a907`.

## Not done

The Studio Profile form's section label still reads *Listen & follow*. The dropped-first-save of the Bandcamp link is unexplained.
