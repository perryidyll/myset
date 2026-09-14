---
id: 0075
title: The artist page has a month calendar and a tour poster the artist uploads
date: 2026-09-14
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/messages.mjs, tools/uicheck.mjs]
files: [public/artist.html, public/studio.js, netlify/functions/_img.mjs, netlify/functions/img.mjs, netlify/functions/_profile.mjs, netlify/functions/profile.mjs, netlify/functions/admin.mjs]
---

## The question

Three asks from the founder on 2026-09-14, all on the artist page and its Studio:

1. The hero: drop the **Songs** count; put **Votes cast** on the same line as
   Joined · Shows · Fans, after Fans, closer together, same size; numbers read
   `10k`, `10.1k`, `100k`, `1m` once they get there. Under the numbers, **Book** at
   the far left and a **Merch** button.
2. A **View calendar** button under **See more** in Upcoming shows that opens a
   popup month like the Studio's Gigs tab — dots on show dates — and a tap on a
   date opens that night's details in a floating popup.
3. In the Studio's Gigs tab, an upload for a **tour dates graphic** (PDF, PNG or
   JPEG) and a **booking link**; when set, a **View tour dates** button under the
   Upcoming shows headline that opens the graphic in a floating popup with
   **Download** top-right and a **Grab your tickets** button to the link.

The choices underneath: what the calendar draws from, how a PDF gets in and out
of a store that only ever held photos, and where the poster lives.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: one floating window, the public diary, a `tour` slot** | A centred `.win` card (a sibling of `#app`, frozen page behind it, 0f2) draws the calendar, a night, and the poster; the calendar's dots come from the diary the page already has plus one lazy read of the full 120-day diary; the poster is one file under the image family's new `tour` slot, a PDF accepted by signature, served by `/api/img` with its real type; a `tour` field on the profile | A PDF is a new file type in the store; a poster can be 3 MB where photos are 900 KB | `TOUR_SLOT`, `decodeTourFile`, `tourSet`/`tourClear`, `normTour`, `.win`, the calendar recipe copied page-locally | A blank frame on a phone that will not draw a PDF inline; a big file on the mirror ring |
| B — a bottom sheet for everything | The community page's `.sheet` for the calendar, the night and the poster | The calendar grid inside a draggable sheet fights the drag (0f1) | The same | A day cell that reads as a drag start |
| C — pictures only, no PDF | Refuse PDFs; ask for PNG/JPEG | Nothing new in the store | — | The founder asked for PDF by name |
| D — a new endpoint and a new document family for the poster | `/api/tour`, `tour_<aid>` | Another route, another key family in `keysFor`, another mirror rule | Many | More to forget |
| E — do nothing | — | — | — | The page keeps no door for the fan who is not in the room tonight |

## What was chosen, and why

**The hero.** `compact()` now shows the whole number with a comma under 10,000
and one decimal from there (`10k`, `10.1k` … `999.9k`, `1m`), rounding checked
before the unit so 999,950 is `1m` and never `1000k`; the RSVP counts and the
proof strip share it, so they read the same way. The four numbers sit on one
flex line sized to their words (the month and year need more room than a count;
320 px still holds all four). Merch is drawn only when the shop has something on
it — a button to an empty shop is the shrug rule three forbids. The three buttons
keep `class="ps cta"`, which `test/copy.mjs` pins. `stats.songs` stays in the
payload: the venue page still prints it.

**The calendar** is the Studio's Gigs-tab month, copied page-locally in the
page's colours, in the floating window. A night sits on its own `date` string —
the artist's local day — never on `new Date(date)`, which shifts a night across
midnight for a fan in another zone. Months run from the earlier of the phone's
month and the earliest listed night's month (a fan already on the 1st can still
reach tonight's show on the 31st) to the last month with a show; the diary is
future-only, so no past night is ever dotted and the lede says "over the next
four months". Dots come from the 24 nights the page fetched and, once per open,
from the full diary (`days=120&n=60`, edge-cached, never at first paint). A
tapped night draws the same row the list draws — Directions, Tickets, RSVP — and
a night past the 24 joins `ROWS` so RSVP works there too.

**The poster** is a file in the image family under a slot of its own (`tour`,
a regex family like merch pictures, never in `SLOTS` — whose names `photoUpload`
turns into an index into `photos[]`). Pictures keep the photo path's rules (900 KB,
shrunk on the phone, signature-checked, SVG refused — 0m); a PDF is accepted only
when its bytes begin `%PDF-` and it is under 3 MB, and is served with
`content-type: application/pdf` and `content-disposition: inline` so a browser
opens it in its viewer, in the page's frame or on its own — never `<object>` (the
CSP says `object-src 'none'`). A PDF can carry script, which is why SVG was
refused (0m); a PDF is accepted here because only the signed-in artist can put
one on their own page, it is served from this origin inside the browser's PDF
viewer, and the founder asked for it by name. The profile holds
`tour: {url, type, link}`; `normTour` accepts only a same-origin `/api/img?…&s=tour`
address and an https link; `planGet` carries the byte caps so the Studio never
types one. Not plan-gated, and not the "Press kit" row (`presskit` stays in
`NOT_BUILT`).

**Download** is the file itself from this origin (`<a download target=_blank>`);
**Grab your tickets** is drawn only when a link was set.

## What this makes harder

- The calendar cannot show a night the diary does not: past nights, and anything
  beyond 120 days. A year-long tour is the poster's job, which is the point.
- A 3 MB poster rides the nightly mirror ring once per change (0069 skipped clips
  for this reason at 70 MB; 3 MB fits the 5.5 s budget, and only on change).
- A PDF in an `<iframe>` on iPhone shows its first page without scrolling —
  right for a one-page poster, wrong for a booklet. The Download button is the
  way to the whole file.
- Two windows on one page (`#win` and the Book sheet) — the freeze is a counter
  so they can coexist; a third kind of popup should reuse one of the two.

## What would reverse it

- A poster the phone cannot draw (a blank frame reported from a real iPhone):
  then the page shows the first page as an image the Studio makes at upload — or
  the PDF door closes and PNG/JPEG stay.
- The mirror ring timing out on posters: then `tour` joins the `vid_` skip and
  gets its own copy rule.
- The founder wanting past nights on the calendar: then a public month read of
  the filed nights, with a record.

## How it was verified

- `test/messages.mjs` (the poster half): a PNG goes in with `type:'png'` and a
  same-origin `/api/img?…&s=tour&v=` address; the caps ride the reply; the link
  saves on its own; a `javascript:` link is dropped and the file kept; a PDF
  replaces the picture with a link in the same save; `/api/img` serves it as
  `application/pdf`, inline, immutable; the public profile carries it; a PDF
  over 3 MB, a file that is not really a PDF and an SVG are refused with a
  sentence; `photoUpload` never accepts the slot; crew is refused; `tourClear`
  takes the file, the link and the bytes; a link with no poster is refused;
  `keysFor` names the slot.
- `tools/uicheck.mjs` — 244 ✓ / 0 ✗ with the new hero: the links strip is still
  above the fold (top 568 px at 390×844), "Watch & listen" is still the last
  section.
- Headless Chrome at 375×812 on the mock: the hero's four numbers and three
  buttons; the calendar with dots and disabled month arrows; a night's card with
  On now / RSVP / 12 going; the poster window with Download and Grab your
  tickets; `body.sheeting` with `top:-537px` while the window is open.
- NOT checked: a PDF drawn inside the window on a real iPhone, and whether iOS
  Safari saves or opens the Download; both need the founder's phone.
