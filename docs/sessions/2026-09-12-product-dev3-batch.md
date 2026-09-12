# 2026-09-12 — Product Dev 3: RSVP to the edge, a night you can name, the glow that matches

**What was asked.** One founder message, eleven items, sent as soon as the Product
Dev 2 batch (PR #17, `cd8cbc7`) was live: Puzzle changelog entries for the other
sessions' decisions 0053 and 0054; the title of a hand-started show editable when
tapped on the Money tab; the RSVP feature moved to the right edge of every event card
(globally) where the location button sat, the count centred under it, and the
location button moved to where RSVP was; *All songs* selectable alongside a named
setlist, with that step turning green on the Live tab; the pulsing orange glow on the
audience's scrollable windows made to match the artist-facing setlist's (extends
farther to the screen edge, smoother gradient); "+ Add a song" centred in its button;
the photos at the top of the profile page enlargeable on tap; the Community button
from red to orange, text too; the home page subtext changed to "Find a show, open the
setlist at the venue, and **vote on your favorite songs**." with the bold half orange;
an orange ring around the country/city selection box and its headings bold and white;
the "View on map" icon vertically centred with its text, slightly larger, and a real
map icon rather than a target.

**How it was built.** In a clean worktree off `origin/main` (`cd8cbc7`), the shared
checkout still carrying other sessions' uncommitted hunks. Four implementers on
disjoint files (front door; artist page; vote page; Studio + the history server
side), each followed by three refuting reviewers (looks and behaviour on a phone in
both themes; correctness and regressions; craft and the repo's conventions) and a fix
pass. What the reviewers caught and the fix passes repaired, all reproduced before
fixing:

- the lightbox image was not bounded by its sheet (`max-height:100%` against an auto
  grid row clamps nothing) — a tall photo, or the cover on a phone turned sideways,
  ran off the bottom; `grid-template-rows:100%`;
- a downward drag on the open lightbox armed pull-to-refresh and reloaded the page
  (every photo sits at `scrollY 0`) — `data-nopull` on the sheet;
- closing the lightbox with a bare `focus()` scrolled the page back to the opener —
  `focus({preventScroll:true})`, and the sheet takes focus while open so Enter on the
  photo behind it cannot open a second one;
- a hand-typed night name could not be found by the Money tab's own search (`hay`
  read venue, city, date and weekday only) — the title is read first;
- OK on an untouched prompt for a venue-named night POSTed the venue as a hand-typed
  title and froze it against `placeShows` — "unchanged" is now measured against what
  the prompt showed;
- the tappable name was a block, so blank space beside a short name renamed instead
  of opening the show — inline-block, the words and the pencil only;
- `role=button` with no keyboard path — Enter/Space forwarded to the rename;
- "⇪ Import songs" wrapped left-aligned at 320px beside a centred "+ Add a song" —
  `text-align:center` on the pair;
- the vote page's new CSS comment stated a phone-rendering fact nobody had reproduced
  (in headless Chrome the old `filter: drop-shadow` recipe reached *farther*, not
  shorter) — reworded to what was measured, the phone difference attributed to the
  founder's observation;
- the vote list's glow painted under the card after it while the Studio's paints
  over — `position:relative`, the one word the Studio's shell had.

After the workflow, by hand: a Tickets link on the artist page became a line under
the day and time instead of a fourth column (with the RSVP column at the edge it had
left the venue name 107px at 390 and 37px at 320 — five wrapped lines); the fixer's
`≤360px` wrap rule went with it. Invariant **0fm** registered for `titleByHand`, and
`test/structure.mjs` now refuses a byte of difference between the two `@keyframes
edgeGlow` blocks so the vote page cannot drift from the Studio again.

**What shipped.** Decision `0057` and INVARIANT 0fm; `netlify/functions/_history.mjs`
(`renameShow`, the `titleByHand` guard in `archiveShow`), `history.mjs` (action
`rename`); `public/studio.js` (the tappable name, `renameNight`, *All songs* with a
Use button, the centred label, the search reading titles) + `studio.html` (done steps
green, the pair centred; restamped `?v=4d1ab49f`); `artist.html` (RSVP column at the
edge, pin under the date, Tickets under the day, the lightbox, the orange Community
button); `index.html` (RSVP column at the edge, pin under the date, the hero line,
the finder's ring and ink headings, the map icon); `vote.html` (the Studio's
`edgeGlow`); `test/histname.mjs` in `test/run.sh`, `test/copy.mjs` (the map-button
assertion), `test/structure.mjs` (the edgeGlow pairing); AGENTS.md (a *Studio
scripts* row in *Where you may work*); `docs/design-system.md` (§ 0 the pairing, § 5
the RSVP pill, § 10 `edgeGlow`, § 12 the map icon, and every line citation into the
four touched pages refreshed); `docs/processes/the-gig/01` f21 and
`docs/processes/money/07` h12; the overview and decisions index regenerated.

**Verified, and how.** `sh test/run.sh` → exit 0, 0 ✗, 2,277 ✓ across the 44 files
(the new *naming a night by hand* section 27 ✓). `tools/uicheck.mjs` 113 ✓ and
`tools/sheetcheck.mjs` 12 ✓, both pointed at the worktree's `public/`. Headless-Chrome
harnesses in the session scratchpad at 390px (and 320px where wrapping could bite) in
both themes: front door (the RSVP column right of the headline and left of the
chevron, "3 going" centred under the pill to 0.01px, the pin 8px under the date and
38px square, a tap RSVPing without navigating, the two chips 51.75px tall with the icon
centred on the label to 0.00px and 7px before it, the finder's computed shadow
`rgb(255,122,69) 0 0 0 1.5px inset` + `--sh-2`, labels 700 in `--ink`); artist page
(116 ✓ across both themes plus the fixer's 19 and the Tickets re-check 32 ✓ — no spill
at 390/375/360/320, the lightbox opening on a cover, portrait and small photo with the
full-size source, closing on tap and Escape without scrolling, the Community ring and
text `rgb(255,122,69)`); vote page (at the 3200ms peak both windows' computed
`box-shadow` carries the 18/44/72px offsets and `filter` is `none`; the Studio's shell
rendered beside them as a stand-in for the eye); Studio (56 ✓ at 390 and 320 in both
themes — "+ Add a song" padding 34.1/34.1, the done step's title `--good`, *All songs*
showing Use then In play, the rename prompting and not opening, the row and the opened
night renamed, Enter/Space prompting, the search finding "pier"). Screenshots were
looked at, not only asserted.

**Not checked.** A real iPhone: the lightbox under touch, `body overflow:hidden`
while it is up, and the `edgeGlow` box-shadow on a `-webkit-overflow-scrolling:touch`
scroller (the vote list carries the animation on the scroll container itself, where
the Studio has a non-scrolling shell — same CSS, unmeasured on iOS). The signed-in
Studio on myset.vip. A rename against production. The Venue Studio's Numbers tab still
throws on `{ok:false}` (pre-existing, not touched).

**Left for a human.** Venue-listed events on the venue page have no RSVP at all (the
server accepts `?v=`, the page never offered it) — "globally" here meant the two
pages that had the button. The cover `<img>`'s `onerror` loops when the CDN transform
fails because `srcset` is left in place (pre-existing, ~7,600 requests in 2.5 s in
the harness); a separate change. The Engineering OS sheet's c02 row (*Which area is
it?*) and its Puzzle step 370033 want the same *Studio scripts* line AGENTS.md gained
— that sheet is another session's uncommitted file.
