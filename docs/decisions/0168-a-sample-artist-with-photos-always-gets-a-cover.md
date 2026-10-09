---
id: 0168
title: A sample artist with photos always gets a cover, and the suggested songs lead with the place's country when no genre is known
date: 2026-10-04
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/factory.mjs]
files: [netlify/functions/_fai.mjs, netlify/functions/factory.mjs, public/crm.html, public/factory.html]
---

## The question

Jay's sample page (2026-10-04) opened with no cover. The founder had uploaded five good phone photos. An artist's cover had to be at least 1000 px wide and 1.2 times wider than tall, and his photos were square or tall, so none of the five qualified. The founder: "something needs to be adjusted to make sure that doesn't happen again".

On the same page, the suggested songs had no genre to work from: the only facts were his name and Koh Phangan, Thailand. The founder asked for popular Thai songs as his main ten.

## The options

| Option | What it does | Risk |
|---|---|---|
| **A — chosen** | Keep the strict bar first. When nothing passes it, an artist takes the best sharp shot of the act (performing, group or portrait; quality 0.5 or more; at least 400 px on the short side). The judge's covers come first, then wide before square before tall, then playing before posing. The cover review always picks one; "none" is no longer an answer | A tall photo is cropped hard; `coverFocus` keeps the busy rows |
| B | Keep "no cover" and send the page to review | The founder has to fix every phone-photo page by hand, which is what happened |

## What was chosen, and why

A. It amends decisions 0137 and 0159 (the cover) and 0167 (the songs).
- **Decision 0159's "none" answer is gone.** `coverChoices` already leaves out anything that is not plainly the act: a story frame, text across it, a duplicate, or a blurry shot. So the review only chooses among acceptable pictures.
- **A venue is unchanged.** It still never takes a tall photo as its cover.
- **Songs (amends 0167):** when the facts name no genre, the main genre is the most popular music of the place's country, in its own language, unless the facts say the act sings in another.
- **Two small fixes in the same change:**
  - CRM and the old factory screen open a page in a new tab. Passing `'noopener'` to `window.open` made Chrome open a small pop-up window instead.
  - A draft message with no named source said "your public public pages"; it now says "your public pages".

## What would reverse it

- Covers chosen this way that the founder replaces often enough that review is cheaper.

## How it was verified

- `test/factory.mjs`:
  - Jay's five photos as judged give the beach shot as the cover, his electric-guitar shot as the portrait, and two small photos;
  - a blurry shot or a story frame is still never a cover;
  - a venue still never takes a tall one;
  - a "none" from the cover review is refused.
- Full suite.
