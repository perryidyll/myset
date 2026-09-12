# 2026-09-12 — Product Dev 4: one card everywhere, the bar's second pass, the venue says who's coming

**What was asked.** One founder message with two phone screenshots (Airbnb's profile
tab for the hairline; the Studio's Gigs tab for the broken row), sent as batch three
went live: RSVP on the venue page's events too; the location icon on every event card
replaced by the thin *Directions* button the map sheet's cards use, placed beneath the
time and date, with all of a card's text and buttons centred — globally, the profile
page too, the map sheet's own cards left alone; a bigger drag area at the top of the
map sheet so it can be pulled down to close, with a grab bar; orange borders on
"View on map" and "Search for artists" and off the search bar, whose placeholder
becomes "search by name, venue, date, time…"; a very thin line across the top of both
Studios' tab bars; the tab bar's icons and words moved down a little, the words 2–3px
bigger, the tabs a hair closer; the Live icon's clipped arcs fixed; and the Gigs
tab's *Coming up* rows laid out like the Setlist tab's song cards.

**How it was built.** Efficient Mode (AGENTS.md § Default working mode), in a clean
worktree off `origin/main` (`7859b75`): targeted reads, surgical edits, one harness
per surface, one full gate. No workflow — ultracode was off.

**What shipped.**

- `netlify/functions/venue.mjs`: every row the venue page draws carries `eventId`
  and `rsvp`, read in the same hop as the owner's events (`readRsvp` beside
  `readEvents`, for the venue's own events under `v_<venueId>` and for each artist's
  gigs at it). `test/rsvp.mjs` gained the venue page (48 ✓).
- `public/venue.html`: the RSVP column on *Next up* and *What's on*, keyed as the
  front door keys them (`v:<venueSlug>|event|date` for the venue's own, the artist's
  slug for a gig), the same `myset.fan` and `myset.rsvp` memory, optimistic paint to
  every button carrying the key, a refused tap reverting with a toast, the button
  above the row link; a thin *Directions* pill under each date (the venue's own
  link); the row centred.
- `public/index.html`: the feed row centred (`align-items:center`, `text-align:center`),
  the pin circle replaced by the thin pill (`.dirs`, the map sheet's `.hmapgo` recipe)
  under the time and date; both chips under the finder wear the finder's orange ring;
  the search field a hairline with "Search by name, venue, date, time…"; the map
  sheet's head is the handle — taller, with a 44×5 grab bar, `touch-action:none`,
  pointer events that move the sheet with the finger, close past 80px and spring back
  short of it; `data-nopull` on the modal so pull.js never reloads the page under it.
- `public/artist.html`: the row centred, `.dirs.thin` in place of `.dirs.ico`. After the
  founder's look at the local preview: the next-show card keeps its orange time block
  on the left, centres the venue and city in the middle, and carries the RSVP pill on
  the right (the same night as row 0 — a tap paints both, `rsvpTap` now repaints every
  button with the key), with the wide Directions button still beneath; and the cover's
  `onerror` fallback drops `srcset` before swapping in the stored file (the preview
  showed the pre-existing loop: with `srcset` in place the browser kept re-picking the
  failed transform and the cover stayed blank — on production the CDN answers, so
  nobody had seen it).
- `public/index.html`: "Takes about 6 seconds" on the install card (was "six").
- `public/studio.js`: the "N of M featured. Keep as many as you like…" paragraph under
  *Organize your songs into setlists* is gone (the founder, 2026-09-12).
- `public/lock.css`: the bar is 56px with 3px of top padding (the content sat high
  over the home-indicator space), a 1px top line (`rgba(255,255,255,.2)` dark,
  `rgba(0,0,0,.14)` light), 13px labels, 4px gap, the pill inset 4px, `overflow:visible`
  on the icon — the Live icon's outer arcs reach x=0 and x=24 and a 2.3px stroke was
  clipped. Both Studios' bodies still reserve 72px + the inset, which clears 56.
- `public/studio.js` + `studio.html`: the *Coming up* rows are `.gigcard`s — `.gighead`
  (date + words) over `.songactions` (Feature / Edit / ✕, or Restore / Hide on a
  cancelled night) — restamped `?v=d6907d62`.
- Docs: `docs/design-system.md` § 5 (the show row is one card on three pages), § 7
  (the bar's second pass), § 10 (the map sheet), § 12 (the chips); the fan's-night
  f21 sheet and Puzzle step 370394; ledger UX-031–UX-034.

**Verified, and how.** `sh test/run.sh` → exit 0, 0 ✗, 2,290 ✓ across 44 files (`rsvp.mjs` 48 ✓); uicheck 113 ✓; sheetcheck 12 ✓. `check-dev4-tonight.mjs` 10 ✓ (the card's three columns on one middle line, the words centred, the wide Directions beneath, the pill keyed to row 0 and both painting on a tap, the cover falling back to the stored file with `srcset` dropped). `tools/uicheck.mjs` 113 ✓ / 0 ✗,
`tools/sheetcheck.mjs` 12 ✓ / 0 ✗, both pointed at the worktree's `public/`.
Headless-Chrome harnesses in the session scratchpad, both themes: `check-dev4-public.mjs`
28 ✓ — on the front door, the artist page and the venue page every column's centre is
within 0.0px of the row's, the *Directions* pill sits under the date at 11px/750, the
count is centred under the RSVP pill to 0.01px, no `.dirs.ico` or pin svg remains;
both chips' computed shadows carry `rgb(255,122,69) 0 0 0 1.5px inset` and the field's
does not; the placeholder reads as asked; the map sheet opens with `data-nopull` and a
44×5 bar centred in a 75px head, a 140px drag reads `translateY(120px)` mid-way and
closes it (hidden, body scroll restored, transform cleared), a 40px drag springs back;
on the venue page three rows carry RSVP under the right keys, a tap on the quiz turns
the pill on with "1 going" and remembers it without navigating, and the pill on an
artist's row is what `elementFromPoint` finds. `check-dev4-studio.mjs` at 390 and 320
in both themes — bar 56px, 1px top line, 13px labels, 3px top padding, `overflow:visible`,
five labels fitting; gig cards block-laid with the words column 258px at 390 (188 at 320)
where it was ~120, buttons on their own row beneath, Restore and Hide sharing it.
Screenshots were looked at.

**Not checked.** A real iPhone: the drag on the map head under touch (pointer events
in headless Chrome only), the 1px line and the bar's new height over a real home
indicator, the Live icon at 3× scale. The signed-in Studio on myset.vip. An RSVP
against production from the venue page.

**Left for a human.** The venue page now shows *Directions* on every row and again
under *Things to know* — the founder asked for the same card everywhere; say if the
lower one should go. The artist cover's `onerror` loop on a failed CDN transform
(pre-existing). The Engineering OS c02 sheet/step 370033 still want the *Studio
scripts* line (another session's uncommitted file).
