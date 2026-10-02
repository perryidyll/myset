# 2026-10-02 — Sample pages: photos by role, notes, welcome, covers, the strip

**Asked.** The founder reviewed Sand & Tan and Andrew's sample pages and asked for six changes:

- an About broken into lines;
- a better cover crop;
- a way in CRM to say which photo goes where, plus notes for the generator;
- the welcome on every click of the link;
- an artist cover that shows the act, not a music-video scene;
- three small photos sitting the way they do on the founder's own page.

Then: ship everything.

**Shipped.** All three decisions are live as `5c0f812` (PR #201), verified by content on myset.vip. PR #199 conflicted with main after #200, so it was folded into #201 and closed.

- `0135`: the About reads one sentence per line, and the cover crop finds the busiest area. Lives in `fan.js` (`aboutLines`, `coverFocus`) and `.aline`.
- `0136`: photo roles in CRM, with `arrange` and `notes` actions; a rebuild keeps what was set unless "Keep" is unticked.
- `0137`:
  - `sample.js` uses `Tips.open` when the address carries the sample label;
  - the judge's new `video-scene` kind keeps story frames off covers and out of the strip;
  - an artist cover must be performing, group or portrait, with playing first;
  - `pickPhotos` fills three small photos, taking a second frame of a video only after every source is judged;
  - the strip's nudge applies only when there are three.

**Verified.**

- `sh test/run.sh` exit 0; `test/factory.mjs` 162/0; `test/hq.mjs` 187/0.
- Deploy preview, Andrew's page with `?pv=1` (so it was not counted):
  - the welcome deck opened on a second load of the link;
  - the About had 3 lines;
  - both small photos sat at x=20, straight.
- Production: `sample.js` has `viaLink`, `/crm` has "Generator notes", `fan.js` has `aboutLines`, and artist pages carry the `nth-last-child(3)` rule.

**Not checked.** A real (paid) generator run reading notes or judging video frames.

**Still to do.** Andrew's existing page keeps the two-actors cover. The founder can swap it in CRM, or rebuild with "Keep" unticked (a paid run).
