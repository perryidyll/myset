---
id: 0136
title: CRM shows a sample's photos where the page shows them, takes notes for the generator, and a rebuild keeps what was set by hand
date: 2026-10-02
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: [5c0f812]
tests: [test/hq.mjs]
files: [public/crm.html, netlify/functions/factory.mjs, netlify/functions/_sample.mjs, netlify/functions/factory-background.mjs, netlify/functions/_factory.mjs, netlify/functions/_fai.mjs]
---

## The question

While rebuilding Sand & Tan, the founder wanted to tell the generator to use photo 1 as the cover, and found nowhere to say it. They asked for two things in CRM's page tab:

- **Choose which photo goes where:** the first is the cover, the second is the main profile shot, and the third, fourth and fifth are the small photos from top to bottom, each labelled.
- **Write notes:** anything else they want done with the page.

Three things made the old grid misleading:

- **Labels:** it said "Cover, Photo 1 … Photo 5", and nothing said where each one shows on the page.
- **Hidden cover:** a venue with no cover shows its last photo there (decision 0131), so on Sand & Tan the slot marked Cover read "Empty" while the page showed Photo 5.
- **Rebuild wipes:** a rebuild erased the page and built it again from scratch. That threw away the photos the founder had placed, and the hours, menu link and Google rating filled in from Google (0134).

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | The photo grid is drawn the way the page lays it out, with each photo labelled by its place. Drag one photo onto another, or tap "Swap with" in the chooser, and the two swap at once. Notes are kept on the sample's seed and read by the next rebuild. A rebuild keeps the photos and details unless the founder unticks a box. | Two small actions (`arrange`, `notes`), a `keep` flag on the job | A note can ask for something the sources do not support. The generator still writes only what the facts say. |
| B | Notes only: the founder writes "use photo 1 as the cover" and the generator follows it | One field | The photo judge cannot reliably match "photo 1" to a picture, and the rebuild would still wipe the Google details |
| C | A notes box that an agent session reads and acts on by hand | No code | Nothing happens until a session opens. A queue nobody watches is a shrug. |

## What was chosen, and why

A. Photos are arranged by hand and change instantly. The generator is steered with words.

- **The grid is the page.** The cover runs across the top, the three small photos go down the left, and the main shot sits beside them. A venue's sixth photo sits underneath and waits in the page's photo rail. `rolesOf` reads a profile the way `venue.html` and `artist.html` draw it, including the venue cover fallback and skipped blanks. The server sends that order as `profile.roles`, so CRM never computes it a second way.
- **Labels:**

  | Place | Venue | Artist |
  |---|---|---|
  | Top | Cover | Cover |
  | Large square | Main shot | Profile shot |
  | Left column | Small · top, Small · middle, Small · bottom | Small · top, Small · middle, Small · bottom |
  | Underneath | Extra · rail | (none) |

  An empty artist profile shot reads "Shows the cover", which is what the page does.
- **Swapping:** dragging works with a mouse. On a phone, the chooser has a "Swap with one on the page" row. Each swap animates: the two photos fly to each other's places (a View Transition keyed by the photo's address). With reduced motion, or without View Transitions, the swap is instant. If the server refuses, the photos fly back. `arrange` refuses an order that adds or drops a photo.
- **A new photo is stored under a name no other photo uses.** Once photos can move, the stored name `p4` might be holding the cover, and writing over it would change a picture shown somewhere else. Pictures are cached for a year under their address, so the old copy could also linger. Choosing a photo that is already on the page makes the two trade places.
- **Notes** (600 characters) are kept on the sample's seed and never shown on the page. They reach the generator in two ways:
  - as the founder's own source, so a fact the founder states can be cited like any other;
  - as wishes to the photo judge and the copy writer, "followed where the facts allow". The no-invention rules are unchanged.

  This is a different field from a contact's private CRM note, which still never reaches the seed. A page made by hand has no build, so it shows neither the notes box nor Rebuild.
- **A rebuild keeps by default.** It rewrites the words and links from the sources plus the notes. It keeps:
  - the photos in their places, still stored, with no new pictures stored for them;
  - a venue's hours, but only if some day is open;
  - the venue's menu link and Google rating.

  Unticking "Keep the photos…" restores the old behaviour.

## What would reverse it

The founder wanting a rebuild's fresh photo picks more often than their own arrangement; then the box starts unticked. Notes being ignored often enough that a stronger mechanism earns its cost.

## How it was verified

- `test/hq.mjs` (187 passed, 0 failed). New cases:
  - five photos with no cover show the last one as the cover;
  - a swap is stored plainly, and the list card's thumbnail follows the cover;
  - an order that adds or loses a photo is refused;
  - a new photo gets an unused stored name;
  - choosing a photo that is already on the page makes the two trade places;
  - a hand-made page takes no notes;
  - notes are trimmed, carried by a rebuild, and survive it;
  - a kept rebuild keeps photos, hours, menu link and rating, and the pictures are still stored;
  - `keep: false` replaces all of them.
- `sh test/run.sh`: exit 0.
- On `tools/localhost.mjs` with the real functions:
  - drag-and-drop, and the chooser's "Swap with", each swapped the cover and the main shot;
  - notes saved;
  - a generated venue was arranged, given hours, a menu link, a rating and notes, then rebuilt with keep. After the rebuild the photo order was identical, every picture still answered 200, and the details and notes were intact;
  - the public page drew the cover, the main shot and the three small photos exactly as CRM labelled them;
  - no horizontal overflow at 375 px.
- NOT checked: on production, and the generator's real response to notes. A pretend build ran locally; a real build costs money and reads the web.
