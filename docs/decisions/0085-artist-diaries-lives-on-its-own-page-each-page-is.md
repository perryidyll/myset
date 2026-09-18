---
id: 0085
title: Artist Diaries lives on its own page; each page is a written story tied to a song or a moment, and how many an artist can publish is capped by plan
date: 2026-09-18
status: decided
decided_by: perry
area: media
reverses:
superseded_by:
invariants: [0gb]
commits: []
tests: [test/diaries.mjs]
files: [netlify/functions/_diary.mjs, netlify/functions/diary.mjs, netlify/functions/community.mjs, netlify/functions/_img.mjs, public/diary.html, public/community.html, public/studio.js, public/artist.html, netlify/functions/_plan.mjs]
---

## The question

The founder pitched "Artist Diaries" on 2026-09-15 — a storytelling layer of
origin stories and pivotal moments, ideally sitting next to a song's synced
lyrics — and a research artifact (`diaries-and-streaming-concepts`, session
memory) compared it against Tidal, Napster and Ampled's streaming failures and
recommended shipping the storytelling layer first, on existing infrastructure,
before touching licensed audio. Two things that would have made the scope
ambiguous are now cleared: R2 writes are proven end to end (decision consequence
of P3-003, done 2026-09-15) and the name is free (the gig-calendar rename,
UX-052, PR #72). Before any code exists, two structural questions had to be
pinned down, because both are expensive to reverse once the data model and UI
are built around them: who can see a diary page, and where it physically lives
on the artist page.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A dedicated `/<slug>/diary` page. Each page is a short written story, optionally tied to one song (whose lyrics the reader can open beside it) or to no song at all. Every plan gets the feature; the number of pages a diary holds is capped by plan — free 3, Bar Star 10, Rock Star 40 | A new Studio editor, a new public page, a new capped-count check shaped like the library cap | One `diary_<aid>` document per artist (the `diary_*` family reserved in the push log), a plan-limit number, one new route, one new warm-door read | A cap that lands wrong in either direction — too tight at 3, meaningless at 40 — is a one-line number to change, not a redesign |
| B | Same page and format, but uncapped on every plan | No lever pulls anyone toward Bar Star or Rock Star; Diaries becomes pure cost with no upgrade incentive attached | none beyond A | Gives away the one thing about this feature that could have sold a plan upgrade |
| C | Gate the whole feature behind Bar Star+; free-plan artists see nothing | Breaks the pattern the gig list and lyrics both follow — every fan-facing surface has stayed plan-neutral so far, only the *artist's own* tools (the business dashboard) are gated | none beyond A | A free artist's page looks visibly unfinished next to a paid one, which cuts against "nothing may break the gig" for the artist who can least afford to look amateur |
| D — do nothing | Leave it as a researched pitch; build nothing yet | Zero cost, zero page | none | The groundwork already paid for — LRCLIB/lyrics reuse, R2 proven, the name freed specifically for this — sits unused |

**Do nothing** was genuinely on the table: nothing forces Diaries to ship now.
It was rejected because the founder asked to move on it today, not because A
was the only workable option.

## What was chosen, and why

Perry's call, in his own words: every plan gets Artist Diaries, but the number
of pages an artist can publish is capped by plan — 3 on free, 10 on Bar Star,
40 on Rock Star — the same shape as the existing library cap (100/200) rather
than a hard paid-only gate. And a dedicated page, not a widget folded into the
existing Setlist/Lyrics sheet, because a "page" does not have to be tied to a
song at all — it can be a moment — and a page-per-entry format wants its own
list/detail view rather than living inside a component built for something
else.

Two more calls the same day, once the founder saw it on localhost: the diary's
front door on the **community page** is a second card under the merch card —
the same card, the same ring, the same fan of three — with *Read the diary* in
place of *Browse the shop* (the artist page keeps its Diary door as well, exactly
as merch has both); and each page takes a **cover photo** the artist uploads,
which heads the story on the diary page and fills the fan on the card. A cover
is one picture per page, the page id as its slot (`DIARY_SLOT` in `_img.mjs`,
next to the merch family), cropped wide on the phone like the profile's cover,
written only by `diaryPhoto` / `diaryPhotoClear` — a save can never point a page
at another picture — and dropped with the page and with the account.

## What this makes harder

- The public page needs its own near-empty state — 3 pages is not a lot to
  fill a dedicated page with, and the founder's own account will be the first
  one anyone sees it on. (Built: one story reads as a page; none at all reads
  as "nothing written yet", and the artist page hides the door until there is
  a shown page.)
- A future "unlimited on the top plan" pass would need the cap check to
  understand an unbounded tier, not just three fixed numbers.
- A page can optionally link to a song or stand alone — the strictly
  per-song option (not chosen) would have let the data model skip that
  optionality entirely.
- "Synced" lyrics were in the pitch; v1 shows the plain lyrics the vote page
  already serves, because there is no audio on the page to sync them to. Timed
  lyrics wait for the phase that brings playback, and that phase brings the
  rights question with it.
- The cap counts every page kept, shown or hidden — like the library counts
  every song — so an artist cannot hoard drafts past the plan line. The price
  is that "Off" is not a free drafts folder; the Studio says so on the switch.

## What would reverse it

If the founder's first real diary pages show fans skipping straight past the
dedicated page to the gig list or the shop, folding entries back into the
existing Setlist/Lyrics sheet (option A's alternative shape) is worth
revisiting. If the 3/10/40 caps prove too tight or too loose against real
usage, that is a constant to change, not a reason to reopen this record.

## How it was verified

The shape was fixed from the founder's answers in chat on 2026-09-18, and the
build followed the same day, in a worktree off `origin/main`:

- `sh test/run.sh` — the whole suite green with the new `test/diaries.mjs`
  (89 assertions): the 3/10/40 table and `diaryCap`; a page needs a title and a
  story; the song is refused unless it is in the library, by id; the fourth
  page on Hobbyist is a 402 that names the number and the plan; an edit on a
  full diary still saves; removing is never gated; a downgrade from eleven pages
  keeps all eleven and refuses the twelfth; the founder is stopped at three like
  anyone; the public read is edge-shared for fifteen seconds, carries only shown
  pages and never a hidden page's words or the plan; a song that leaves the
  library leaves the page standing; the profile carries the count for the door;
  a band mate may write and the sound engineer may not; the route sits above the
  `/:slug` catch-all; `diary` is a reserved slug; the export carries the pages
  and their versions; `keysFor` names the document and a deleted artist leaves
  nothing behind; a cover goes on by page id and is refused for a page that is
  not there or bytes that are not a picture, a save never sets it, the reader
  and the community card carry it, clearing it leaves the page and drops the
  bytes, `keysFor` names it.
- Walked on `tools/localhost.mjs` (the real functions on the in-memory store)
  at phone width, light and dark: the Studio's Diary screen at 0/3, a page
  written through the editor with the phone-side draft filling as it was typed
  and cleared on save, 3/3 with the add button gone and the plan note in its
  place, the Diary door on the artist page, the diary page with the three
  stories, and "Read the lyrics" opening Creep's words through `/api/lyrics`.
  Then, for the second round: a page written with a cover — the wide crop sheet,
  the editor back with its draft and the staged cover, the save minting the id
  and the cover following it (`/api/img?…&s=d<id>` 200) — the Diary card under
  the Merch card on `/demo-artist/community` with the cover in its fan, the cover
  heading the story on `/demo-artist/diary`, and ✕ in the editor clearing it (the
  card falls back to the page's initial).
- Not checked: the deploy preview, and the founder's own first page on the
  live site — that is the next step, and the ledger row `DIA-001` says so.
