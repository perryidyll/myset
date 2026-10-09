---
id: 0137
title: A sample's welcome opens every time its link does, an artist's cover is the act playing, and the strip holds three
date: 2026-10-02
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: [5c0f812]
tests: [test/factory.mjs]
files: [public/sample.js, public/artist.html, netlify/functions/_fai.mjs, netlify/functions/_factory.mjs]
---

## The question

The founder looked at Andrew's sample page and found three faults:

- **The welcome showed once.** "Hey Andrew…" played the first time the link was opened on a phone and never again. The founder wants it every time the link is clicked, on artist and venue samples alike.
- **The cover was not Andrew.** It was a frame from his music video: two actors on a dock. The photo judge had called it the act and a good cover.
- **The strip was crooked.** The page draws three small photos in an arc, with the top one nudged right. Andrew's page had two, so the nudged one sat where the middle one should and read as misaligned. The founder's own page, with three, is the reference.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | The welcome opens whenever the address carries the sample label. The judge gets a `video-scene` kind, and an artist's cover must be performing, group or portrait, with playing ranked above posing. The factory fills three small photos, using a second frame of a video only after every source has been judged. The nudge applies only when there are three. | A prompt change, a picker change, one CSS selector | A video with one usable frame still leaves a short strip, but it now sits straight |
| B | Hand-fix Andrew's page in CRM | None | Every future page repeats it |
| C | Drop YouTube frames from covers entirely | One line | Loses the many good stage frames YouTube gives (the founder's YouTube-first rule) |

## What was chosen, and why

A.

- **Welcome:** `sample.js` opens the deck with `Tips.open` when the address has `#sample-profile` (or `?sample-profile`), and keeps `Tips.first` for a visit without the label, such as the stored key or a tap back from the Studio. The founder's own `?pv=1` preview follows the same rule.
- **Cover:**
  - The judge is told that a music video often casts actors. A person counts as the act only if they match the act's other pictures, or are the one playing or singing.
  - A story frame is `video-scene`.
  - `coverOk` now needs the act performing, or a proper band or promo photo. It excludes frames with black bars or blurred side panels.
  - For an artist, `pickPhotos` takes a cover only of kind performing, group or portrait. Performing and group rank first, then the existing source order.
  - A `video-scene` is never one of the small photos either.
- **Three small photos:**
  - `pickPhotos` fills the strip in three passes: varied kinds from unused sources, then any kind from unused sources, then a second frame from a source already used, never one the judge marked a duplicate.
  - The factory's "enough" check counts only the first two passes. A second frame of the same video is therefore taken only once the website and the founder's photos have been judged.
- **Layout:** `.strip .pth:first-child:nth-last-child(3)` carries the nudge, so two photos or one sit flush where the middle and bottom ones go.

## What would reverse it

- The founder finding the welcome tiresome on repeat visits through the same link.
- Covers coming out empty too often because no frame shows the act playing. The portrait fallback should prevent that, and the gate already sends a page with no cover to review.

## How it was verified

- `test/factory.mjs` (162 passed, 0 failed). New cases:
  - a story frame never covers and is never a small photo;
  - a group photo beats a higher-ranked portrait;
  - a portrait still covers when nothing shows the act playing;
  - three small photos come from a second frame when needed;
  - a duplicate never fills the strip;
  - the end-to-end factory run still takes another video, then the website, before a second frame.
- The strip with two photos and with three: see the session note.
- NOT checked: a real (paid) generator run judging Andrew's video frames. Existing pages keep their photos until they are rearranged in CRM or rebuilt with "Keep" unticked.
