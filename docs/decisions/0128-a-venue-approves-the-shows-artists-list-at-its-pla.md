---
id: 0128
title: A venue approves the shows artists list at its place
date: 2026-09-30
status: decided
decided_by: founder
area: venues
reverses:
superseded_by:
invariants: [0y]
commits: [9fde2c7]
tests: [test/gigok.mjs]
files: [netlify/functions/_gigok.mjs, netlify/functions/venue.mjs, netlify/functions/venueadmin.mjs, netlify/functions/admin.mjs, public/venue.html, public/venue-studio.js]
---

## The question

The founder: "make sure that venue have a way to approve/deny events that artists say are happening at their venue – if it is a recurring show they only have to approve it once, but it must be made clear that they are confirming it's a recurring show".

Nothing links an artist's gig to a venue but the name the artist typed, inside the venue's city (INVARIANT 0y). A venue had no say over what its page listed.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The venue answers each artist calendar RULE: confirmed, or not here. Unanswered shows list as before | One document per venue | `gigok_<vid>`, `gigList`/`gigSet`, `tellVenueOfGig` | A venue that never answers keeps the old behaviour |
| B | Nothing shows until the venue approves | Every unclaimed venue page goes empty | The same | Samples and unanswered venues lose their whole gig list |
| C | Answer per night | A weekly residency is fifty answers | More | The founder asked for once |

## What was chosen, and why

Option A: the venue's word is added to the artist's claim, never required for it.

- `_gigok.mjs`: `gigok_<vid>` holds `by['<aid>:<eventId>'] = { st: 'ok'|'no', at, rec }`. The key is the RULE, so a weekly show is one answer for every week.
- **A recurring show is confirmed as recurring.** `setGigOk` refuses `ok` on a repeating rule without `recurring: true` (409, `recurring: true`); the Studio asks first: "Is this a recurring show? … says they play here every Thursday … Approving it confirms every one of those nights, not just the next — you only do this once."
- If the artist later turns a confirmed one-off into a repeat (or back), `rec` no longer fits and it waits again.
- **The public page** (`venue.mjs`, one `listings()` shared with the Studio): a confirmed show carries `confirmed: true` and says **✓ Confirmed by the venue**; a show the venue said is not here leaves the venue's page (the artist's own page and calendar are untouched). Unanswered shows list as before.
- **The Venue Studio**, What's on: *Waiting for you* (Approve / Not here), *Confirmed* (Undo), *Not at your place* (Undo) — one row per rule, with "Every Thursday · next 1 Oct".
- `venueadmin`: `gigList` (crew, and samples, read-only) and `gigSet` (manager). `gigSet` only answers a key that names this venue right now.
- **A new listing tells the venue**: `eventSave` calls `tellVenueOfGig`, which finds a venue on MySet in the gig's city whose name matches (`sameVenue`) and pushes its phones `{ tab: 'shows' }` — only when the rule is new there, never on an edit. Time-boxed; the artist's save never waits.

## What this makes harder

- A denied show stays on the artist's own page; the artist is not told. If artists list shows at the wrong place often, telling them is next.

## What would reverse it

- Venues wanting only approved shows on their page: a switch that hides the unanswered.

## How it was verified

- `test/gigok.mjs` (28 ✓): one row per rule; a recurring show refused without the word, then confirmed for every week on the public page; Not here leaves the page, Undo brings it back; a confirmed one-off turned weekly waits again; another venue's show, a bad key and a bad answer are refused; another venue sees none; the venue's phone hears a new listing once, not an edit, not another place.
- Localhost at 375 px: the Waiting / Confirmed sections, the recurring sheet ("Yes, it's every Thursday"), and nine nights marked Confirmed on the page.
- **Live as `9fde2c7` (PR #177, which carried #175):** Netlify production deploy ready 2026-10-01; checked by content on myset.vip — `/venue.html` carries "Tip the staff", "See more · ", `drift('links'`, "Confirmed by the venue" and `myset.pending.vtip`; `/venue-studio.js` carries "Everything in Free, plus" and no testimonials. Suite 5,076 passed, 0 failed on the merged tree.
