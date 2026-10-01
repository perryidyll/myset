---
id: 0134
title: A venue sample carries its hours, menu link and Google rating, read from its Google listing and dated
date: 2026-10-01
status: decided
decided_by: perry
area: venues
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/factory.mjs, test/samples.mjs, test/hq.mjs]
files: [netlify/functions/_factory.mjs, netlify/functions/factory.mjs, netlify/functions/_venues.mjs, netlify/functions/_sample.mjs, public/venue.html, public/crm.html]
---

## The question

The founder rebuilt Sand & Tan (decision 0131) and asked for the hours, the menu and the Google reviews to be on the page already when the venue first opens it — "will make it feel twice as real". The generator reads hours only from the venue's own website (schema.org JSON-LD) and OpenStreetMap, and Sand & Tan's website (phanganbayshore.com, its /dining page) carries neither hours nor a menu link: both live on its Google listing. Decision 0103 keeps the factory off the Google Places API, whose terms forbid keeping its data, and scraping Google from a server breaks Google's terms too. The founder did not want to type any of it by hand.

While looking, a second problem turned up: a new venue profile starts with every day 17:00–01:00 (a template for an owner to edit), and a sample whose sources had no hours kept that template, so its page showed made-up hours.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A Details form in CRM's Edit profile (hours as a person writes them, the menu link, the Google rating and review count). An agent session fills it per venue from the venue's Google listing, through the founder's own browser, on the founder's request. The rating is stored with the day it was read and the page says "as of Mon YYYY". | Nothing per view. One agent pass per sample. | `humanHours`, `rating` on the venue profile, `ratingHtml`, the Details form | A rating goes stale: it is dated on the page, and the owner can change it once they claim |
| B | Places API at render time: a live rating and hours on every view | Paid per request; reverses 0103 | An API key, a billing account, a cache it may not keep | Bills grow with traffic; terms on caching and display |
| C | The factory scrapes Google Maps server-side | Breaks Google's terms; Google blocks it | A scraper | Banned IP, broken builds, a legal letter |
| D — do nothing | Pages show what the venue's own site says | Nothing | None | Pages feel thin; Sand & Tan has no hours, menu or rating |

## What was chosen, and why

A. The founder asked for the rating, the reviews link and the date ("so it doesn't pretend to be live"), and for no hand-typing. An agent reading a public listing through the founder's browser is the founder looking at Google with help, not a server harvesting it. The page says when the number was read, and the link opens Google's own reviews, so nothing on the page claims more than it knows.

Hours read as a person types them ("Daily 8am-10pm", "Mon-Fri 5pm-1am; Sun closed") go through `humanHours`, which turns them into the simple OSM form and hands them to `parseHours`, so there is still one reader of hours. Anything it cannot read is refused, never guessed. Google's split hours (lunch and dinner on Sand & Tan) do not fit the page's one opening per day and are left out.

A sample built with no hours now has every day shut, which hides the block. Hours set since (through Details) survive a rebuild: only the untouched template is closed.

## What this makes harder

A per-venue agent step sits between the build and a complete page. A claimed venue's rating stays as it was read until the owner changes it. The Venue Studio has no field for it yet, so today only CRM can change it.

## What would reverse it

A venue owner asking for a live rating. The Places API's display terms changing to allow keeping a rating. Enough samples that one agent pass each costs more than option B.

## How it was verified

- `test/factory.mjs`: `humanHours` reads daily ranges, am/pm, en dashes, day lists, "to", "till", midnight, and a day closed after the fact. It refuses "blah", a day with no time, "13pm" and an empty string.
- `test/samples.mjs`: a venue sample built with no hours shows every day shut, and has no rating.
- `test/hq.mjs`: the edit action stores the hours, the menu link and a rating with today's date, and CRM reads them back. Unreadable hours and a non-https menu link are refused (400). A rating out of range is not stored. Cleared hours hide the block.
- On localhost (port 8953) at 375 px and 320 px, with Harbour Bar set to "Daily 8am-10pm" and 4.5/1100:
  - the rating pill reads "4.5 ★★★★½ 1.1K Google reviews / as of Oct 2026";
  - the pill links to a Google search for the venue's reviews;
  - the hours list shows 8:00am – 10:00pm every day;
  - the Menu door opens the menu link;
  - there is no horizontal overflow.
- Full suite: one failure, `test/books.mjs` "with the venue's own gross". It also fails with this change stashed, so it is a date edge on 1 October and not from this change.
- In CRM on localhost, with the local test passcode: Edit profile → Details showed the stored values. Typing "Mon-Sat 5pm-1am; Sun closed" and 4.6, then Save, toasted "Details saved", and the form read the same text back.
- NOT checked: Sand & Tan on production.
