---
id: 0166
title: CRM's Generate form takes photos uploaded from the device, and the generator looks at the founder's photos first
date: 2026-10-04
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: [b086a33]
tests: [test/hq.mjs, test/factory.mjs]
files: [public/crm.html, netlify/functions/hq.mjs, netlify/functions/_crm.mjs, netlify/functions/_factory.mjs]
---

## The question

The founder asked to upload images for artists and venues in the page generation window. CRM's Generate profile form only took three photo *links*. A picture saved on the phone (from a DM, a camera roll or a screenshot) had no way in until after the page was built, one slot at a time in the review drawer.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | Each photo is shrunk on the device and sent on its own (`stagePhoto`). It is stored under an unguessable name, as a sample's own pictures are (0101), and comes back as an address. The address rides with the photo links into the seed, and the factory fetches it like any founder link | One action, one form section | A stored picture stays behind if the contact is deleted |
| B | Put the pictures in the build request as data | No storage step | Every job lives in the one `factoryq` document, read on every poll and kept for a week; six photos would also pass a function's request limit |
| C | Upload only after the build, in the review drawer (as today) | None | The generator never sees them; the founder places each one by hand |

## What was chosen, and why

A.
- **One photo per request.** Each stays under the 900 KB the server already takes (`_img.mjs`), and the queue document carries only addresses.
- **Six photos in all, links and uploads together** (`PHOTO_MAX` in `_crm.mjs`). That is as many as `seedOf` reads.
- **The founder's photos are now judged FIRST**, before YouTube frames and website images. Links count too, not only uploads. They were picked by hand, so when enough of them are good they fill the page and nothing else is fetched. Until now a founder link was judged only if the other sources ran short.
- **The vision step still judges them.** It picks the cover, the portrait and the small photos from them, and drops a logo or a picture covered in text, as before.

## What would reverse it

- Uploaded pictures that are routinely worse than what the factory finds, so judging them first costs the page its best photos.
- Stored pictures left behind by deleted contacts growing into a cost. Today it is a handful of files under 900 KB each.

## How it was verified

- `test/hq.mjs`:
  - an upload comes back as an `/api/img` address under an `s…` name, and its bytes are kept;
  - a file that is not a picture is refused;
  - uploads go first in the seed's photos, six at most.
- `test/factory.mjs`: the founder's photo is judged first (`f1`).
- Full suite exit 0.
- At 375 px on a local copy of CRM running on the test store:
  - four photos uploaded, each springing out of the "Add photos" tile;
  - one removed, which shows 3/6;
  - Generate sent the three addresses.
- NOT checked: an upload on production, or a real (paid) build from uploaded photos.
