---
id: 0159
title: A sample's cover is chosen twice — the best four side by side — and live videos past the top three give frames
date: 2026-10-02
status: decided
decided_by: perry
area: factory
reverses:
superseded_by:
invariants: []
commits: [1a4456b]
tests: [test/factory.mjs]
files: [netlify/functions/_fai.mjs, netlify/functions/_factory.mjs]
---

## The question

Andrew's cover was still the two actors from his music video after 0137 changed the rules. The rules govern future builds, and his page had been built before them. The founder asked for more time, energy and review on the cover step, because the cover has to look great: it is the first thing an artist sees.

Doing it by hand showed two gaps:

- **The best picture was never looked at.** Andrew's channel has "Pinch – Live @ The Hollow", a sharp 16:9 frame of him singing with his guitar on stage, with his bassist behind him. The generator takes frames from the three best-ranked videos only, by views and recency. A 2016 live clip ranks fourth or lower, so its frames were never judged.
- **The cover was one score among many.** The judge scores each picture on its own, ten to a call, and the picker takes the top one by rules. Nothing ever compared the few real contenders against each other as the one picture that tops the page.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | Up to two more videos whose title says live (live, session, concert, unplugged, gig, " @ ") give frames. Then a cover review: the best four covers go to the smart model together, and it picks the one that would make the act proudest, or "none". | About six more pictures judged, plus one more vision call per build (a few cents) | A "none" leaves a page without a cover; the gate already sends it to the founder |
| B | Judge every video's frames | Many more pictures per build | Cost and time, for frames that are mostly not covers |
| C | Leave it to the founder in CRM | None | Every page needs a hand fix, which is the work the generator exists to save |

## What was chosen, and why

A.

- **`_fai.mjs`:**
  - `coverChoices(judged, {kind})` lists every picture that could be the cover, in the order the picker ranks them. Playing comes first, then the source, then quality. The venue's fallback is unchanged.
  - `pickPhotos` takes the first choice, unless it is given `cover`. Given a cover, it picks the portrait and the small photos around it.
  - `reviewCover(choices, ctx, {kind, name, notes})` sends the top four to `COVER_SYSTEM` and gets back `{best, why}`. With one choice or none, it makes no call. An id it was not shown is refused, and a second bad answer is an error.
- **`_factory.mjs`:**
  - `ytCandidates` adds up to two live-titled videos from past the top three.
  - `choosePhotos` runs the review when there are two or more choices and the build is not late.
  - A failed review keeps the picker's choice and records `errors.cover`. A missing or refused key still stops the build, as everywhere else.
- **Andrew's page itself** was fixed by hand through CRM, using the same sources the generator now reads:
  - cover: the Pinch live frame;
  - small photos: a band frame from the same night, a frame of him playing guitar in a field, and the beach portrait.

## What would reverse it

- The review saying "none" too often, which would leave pages without covers.
- Its cost showing up in the per-build figure.

## How it was verified

- `test/factory.mjs`:
  - the choices are in the picker's order;
  - the review sees four at most, and its choice becomes the cover;
  - the portrait and the small photos are picked around that cover;
  - "none" gives no cover;
  - one choice makes no call;
  - an id it was not shown is refused, and a second bad answer is an error;
  - end to end: a live video ranked past the top three is fetched and the fourth, not live, is not; the review ran on two to four covers.
- `sh test/run.sh` exits 0.
- NOT checked: a real (paid) build. The review's judgement on real pictures is untested until the next build.
