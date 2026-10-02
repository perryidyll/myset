---
id: 0162
title: An artist sample ends with a link to the founder's own page, as a live example
date: 2026-10-03
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: [public/sample.js]
---

## The question

A sample page shows an artist what their page could look like, but nothing on it is live: no gigs, no votes, no tips. The founder asked for a button at the bottom of every artist sample, styled like "Claim profile", that says "View the founder's profile as a live example" and opens the founder's own page.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | `sample.js` adds the button under the preview note on every artist sample, linking to `/perryidyll` in the same tab | A few lines in one file | The founder's page is the example, so it has to stay in good shape |
| B | Put the link in the welcome tips | A tip edit | Seen once, then gone |
| C | A configurable example artist per sample | A CRM field and a server change | More than was asked |

## What was chosen, and why

A.
- **Where:** the button is added in `decorate`, after the note, so it survives the page redrawing itself.
- **Look:** it borrows the `.sbx-claim` look with a `.sbx-eg` margin.
- **Same tab:** the browser's Back returns to the sample. The founder's page doesn't match the stored sample slug, so it opens as a normal page.
- **Venue samples:** they get no button, because there is no live venue example yet.

## What would reverse it

- A better live example than the founder's page.
- Artists leaving the sample through this button instead of claiming.

## How it was verified

- **On production, by injection:** the button was added to Andrew's sample page on myset.vip, because a deploy preview can't open a sample. It sits under the preview note and is the same width.
- **Suite:** exit 0 (5,137 checks).
- **Not checked:** a click-through count. The funnel doesn't record this button.
