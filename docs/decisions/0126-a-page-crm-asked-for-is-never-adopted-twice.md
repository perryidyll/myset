---
id: 0126
title: A page CRM asked for is never adopted twice
date: 2026-09-30
status: decided
decided_by: founder
area: crm
reverses:
superseded_by:
invariants: []
commits: [9fde2c7]
tests: [test/hq.mjs]
files: [netlify/functions/_crm.mjs, netlify/functions/_sample.mjs, netlify/functions/factory-background.mjs, netlify/functions/hq.mjs]
---
## The question

The founder generated the first venue page from CRM (Sand & Tan, 2026-09-30) and the table showed it twice: two rows, one `/v/sandtan`. The factory writes the page into the sample registry first, then uploads its photos, settles the job and only then links the contact. The CRM summary polls fast while a build runs, and its repair `adoptOrphans` gives every registry page with no contact a contact of its own (it exists for pages the old console built before CRM). A poll in that window saw the new page as an orphan and made a second contact for it.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The registry row names the contact that asked (`cid`); adoption links that contact instead of making one, and skips any page a CRM job made. A repair drops a twin nobody has touched. | One field on the registry row | `row.cid`, `dropTwins` | A twin with a message on it stays until deleted by hand |
| B | Adopt only pages older than a few minutes | Nothing | A timer | A slow build still races it |
| C | Hide duplicates in the table | Nothing | Nothing | Two contacts still hold the conversation apart |

## What was chosen, and why

Option A. It closes the window exactly rather than narrowing it.

- `createSample` stores `cid` on the registry row when the payload carries one; `factory-background` passes the job's `cid`.
- `adoptOrphans` (now given the jobs): a row whose `cid` is a live contact is linked to it, never adopted; a page a CRM job made is skipped.
- `dropTwins`, on every summary: two contacts on one page keep the one CRM built for (it carries the job); the other is erased only when nobody has touched it (no message, note, tag, star, follow-up, email or phone). The founder's Sand & Tan twin clears itself on the next load.

## What this makes harder

A twin that somebody already wrote from is kept, on purpose: it has history. Delete contact removes it by hand.

## What would reverse it

A second row appearing for one page again.

## How it was verified

- `test/hq.mjs` (166 ✓): a poll mid-build links the contact that asked and makes no second one; a twin made before the fix is dropped and the contact CRM built for stays; a twin somebody wrote from is kept.
- Suite: 4,741 passed, 0 failed.
- Not checked on production until merged.
- **Live as `9fde2c7` (PR #177, which carried #175):** Netlify production deploy ready 2026-10-01; checked by content on myset.vip — `/venue.html` carries "Tip the staff", "See more · ", `drift('links'`, "Confirmed by the venue" and `myset.pending.vtip`; `/venue-studio.js` carries "Everything in Free, plus" and no testimonials. Suite 5,076 passed, 0 failed on the merged tree.
