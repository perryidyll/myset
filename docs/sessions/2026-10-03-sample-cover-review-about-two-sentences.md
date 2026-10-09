# 2026-10-03 — Andrew's cover by hand, a cover review for the generator, an About of two sentences

## Asked

- Andrew's cover was still the two actors from his music video. Find a better picture, from Instagram or elsewhere. The cover has to look great, so put more time and review into this step.
- An About should be two sentences with a space between them, not a line, on venue pages too.

## Done

- **Andrew's page (CRM data, no code):**
  - Looked at:
    - his website: merch shots and one portrait;
    - every video on his YouTube channel, with YouTube's three alternate frames each;
    - his Instagram grid and two carousels, in the founder's Chrome. Instagram's own feed API answered 429 once and was left alone after that.
  - The best picture was "Pinch – Live @ The Hollow, Albany", a sharp 1280×720 frame of him singing with his guitar on stage, his bassist behind him.
  - Set through CRM's `addPhoto` by its `i.ytimg.com` address:
    - cover = that video's `maxresdefault`, focus 45% 30%;
    - p0 = the same video's `maxres1` (the band);
    - p2 = "Hey Caterina" `maxres1` (him playing in a field);
    - p1 stays the beach portrait.
  - The blurred vertical Short and the music-video still are gone.
- **The two Abouts:** Andrew's and Sand & Tan's were rewritten to two sentences from the same facts, through CRM's `edit`.
- **0158** (PR #207, `cb2272f`):
  - `.aline + .aline` has a 1em gap and rises in; no hairline.
  - The generator asks for exactly two sentences (360 characters) and keeps two (400 characters).
- **0159** (PR #209, `1a4456b`):
  - `coverChoices`, `reviewCover` and `pickPhotos({cover})` are new in `_fai.mjs`.
  - Up to two live-titled videos past the top three give frames.
  - The review runs in `choosePhotos` and falls back to the picker's choice if it fails.

## Verified

- `sh test/run.sh` exits 0 on both branches.
- Production at phone width (`?pv=1`):
  - Andrew's cover and the three-photo strip, screenshot checked;
  - the About has two `.aline`, a 16 px gap and no background line.
  - The service worker and HTTP cache held the old copy for a few minutes; a reload showed the new one.
- Netlify production deploys `cb2272f` and `1a4456b` are ready.

## Not checked

- A real (paid) generator build with the cover review or the two-sentence copy.

## Numbers

- Decisions 0158 and 0159 are this session's.
- A rate-rules branch had briefly used 0159; it moved to 0160 before merging.
- Puzzle changelog 2694 (0158), 2695 (0159).
