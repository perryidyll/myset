---
id: 0043
title: the public artist page carries the room's rating and comments, the top voted, played and paid-for songs, and a taste of the setlist
date: 2026-09-12
status: decided
decided_by: claude
area: ui
reverses:
superseded_by:
invariants: [0af]
commits: [5b4a531]
tests: [community.mjs, autoshow.mjs]
files: [netlify/functions/profile.mjs, netlify/functions/_history.mjs, public/artist.html, test/community.mjs, test/autoshow.mjs]
---

## The question

The artist page redesign wants a strip of proof under the stats — the room's
rating, what fans said on the community page, the song the room voted for most,
the one it heard most, the one it paid for most, and for a page with none of that
yet, a taste of the setlist. None of it was on `/api/profile`. The rating and the posts live
in their own blobs (`fb_<aid>`, `posts_<aid>`), the request switch is on the show
record the handler already reads, and the most-voted song of a night was only on
the per-night detail document — reachable from the index by id, but one read per
night, which grows with every gig and is exactly the shape of read the profile
must not have. And the star notes are anonymous free text that only the artist
has ever seen; the strip must not become the place they leak.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `/api/profile` adds `requests` (from the show in hand), `rating {avg,count,nights}`, `posts` and `comments` (one read for the feedback, one for the posts), `setlist` and `songs` (from the show in hand), and `topSongs` / `topVoted` / `topPlayed` / `topPaid` built from three compact per-night fields — `top {title,votes}`, `topPlayed {title,plays}`, `topPaid {title,paid}` — that the archive stamps on every index row from the snapshot it is writing, and the heal back-fills from the detail it was already reading. | Two more blob reads per uncached profile view, shared at the edge for fifteen seconds (0042); nothing else is a read. Nights archived before a field existed have it filled on the next Money-tab load: `healHistory` re-opens once for an index whose rows lack any of the three, back-fills from the details it reads anyway, and retires again. | `topOf()`, `topPlayedOf()`, `topPaidOf()` and the `ROW_TOPS` list in `_history.mjs`; `topAcross()` and `commentsOf()` in `profile.mjs`. | A wrong field leaks a note or a device id; a wrong count over-states a night. Both are asserted against. |
| B | The page fetches `/api/community` and `/api/board` beside the profile and derives the numbers itself. | A third and fourth request on a phone page, and the community payload is the whole feed with photos — for one integer. | none on the server | Slower first paint on every artist page for a strip that is decoration. |
| C | Send the per-night detail documents' `topSong` by reading each one on the profile path. | N reads per view, N = shows archived — unbounded. | none | The one page every venue and fan opens gets slower with every gig the artist plays. |
| D — do nothing | The strip shows only what the page already has: shows since, next gig. | Nothing. | none | The page keeps claiming less than the product can prove. |

## What was chosen, and why

A. The two extra reads are bounded and cached; everything else is already in hand.
The three top songs ride on the index row because that is the document the profile
reads anyway, and the archive writes them at the moment the numbers are known — the
same reason `room` and `nets` live there. Only a title and one count travel: never a
song id, never a note, never a device id. `rating` is `null` until somebody has
rated, so the page cannot paint zero stars. Presence is still never read on this
path (0af).

What each field is, exactly:

- `rating {avg, count, nights}` — the "Enjoying MySet?" stars from the vote page:
  the room's rating of the night on MySet, not of the artist. `nights` is how many
  different shows the kept ratings name (a floor: the list is trimmed and the
  earliest ratings named no show); the page says "rated by the room over N
  nights", or falls back to the count when that is 0.
- `comments[]` — up to three `{text, stars, when}`: the most recent community
  posts that are not hidden and carry words, newest first, the text cut to 140
  characters on the server and escaped on the page. Only what a fan chose to say
  in public on the community page; never a star note (those were written for the
  artist), never a name, never a device id.
- `topVoted {title, votes}` — `topSongs[0]` or null; `topSongs` stays for the
  page's older copies. Per night, `top` is the song that started with the most
  votes (or the most-wanted one if nothing was played); across nights the same
  title is one song and the votes add up.
- `topPlayed {title, plays}` — per night, the song with the most entries in the
  play log (a replay counts twice); a tie goes to the more-voted song, then to
  the one heard first. Across nights, plays add up. Two honest limits: on a
  night with no replay this is the most-voted played song, and the count only
  gathers the nights on which it was the most played — a floor, never a
  ceiling, like `people`.
- `topPaid {title, paid}` — per night, the song with the most paid votes in the
  play log. **The log does not carry a per-song paid count yet:** a song's votes,
  paid ones included, are consumed the moment it starts (`consumePlayedVotes`),
  and `logPlay` in `admin.mjs` records `votes` but not `paidVotes`. So `topPaidOf`
  answers null, every row is stamped `topPaid: null`, the page draws no card, and
  the day `logPlay` records `paidVotes` the field fills for new nights with no
  further change here. Nights before that day cannot be recovered — the count is
  gone with the votes.
- `setlist[]`, `songs` — up to ten titles, and the total, from `playable(show)`:
  the list in play tonight, or the whole featured library when no list is chosen.
  Drawn only when the page has none of the proof above, as "On the setlist ·
  title" cards; a page with no setlist draws no strip.

## What this makes harder

The index row grows by three small objects per night. `healHistory` reports every
pre-existing row as `fixed` once, because the row gained a field — and that one
extra pass costs each already-healed account the same per-night detail reads the
first heal did, once. The self-retiring gate has two conditions (`healedAt` and
every row carrying every name in `ROW_TOPS`); the next field added to a row goes
on that list or it will wait for a human to tap "Look for missing shows". The
rating is a "how was MySet" prompt, not a rating of the artist — the page's
wording has to carry that honestly. `topPlayed` from compact rows is an
approximation (above); an exact "played N times" would need a per-title tally the
archive maintains, which is a new document and a new decision. And `topPaid` is
a promise the log has yet to keep — see the open question in the session note.

## What would reverse it

The profile read budget: if a cost test ever holds `/api/profile` to fewer reads
than it now makes, `rating` and `posts` are the first to go, or move into
a single aggregate the archive writes. Privacy: if any note text, star spread or
device-level detail is ever needed on the public page, that is a new decision with
a moderation story, not an extension of this one.

## How it was verified

`node --import ./test/register.mjs test/community.mjs` — section "THE PROOF
STRIP": `requests` is a boolean; `rating` is `null` before any rating and
`{avg:4.5,count:2,nights:1}` after a 4 and a 5; the payload never contains the
note text; after the founder's night is filed on the next New show, `topSongs` is
`[{title:'Valerie',votes:1}]` from the index rows alone and `topVoted` is its
first entry; `topSongsOf` skips rows without a top song, merges the same title
across nights, caps at three. `comments`: the three most recent public posts with
words, newest first, each `{text, stars 1–5|null, when}`; the hidden post absent;
no name or device id; a 300-character post cut to 140 with its stars; a star note
never quoted; an artist with no posts gets `[]`. `setlist` names Valerie and
`songs` counts the list; an artist with no songs gets `[]` and 0. After the
founder plays Valerie on a new night, `topPlayed` is `{title:'Valerie',plays:1}`;
`topPlayedOf` counts a replay twice and breaks ties by votes then order;
`topPaidOf` is null until a log entry carries `paidVotes` and sums them once it
does; `topAcross` merges titles and takes the biggest. Final line
`150 passed, 0 failed`.

`node --import ./test/register.mjs test/autoshow.mjs` — section "THE TOP-SONG
BACK-FILL RUNS ON ITS OWN": with all three fields stripped from an index already
stamped `healedAt`, a plain `healHistory(aid)` (no `force`, the Money tab's call)
reports `fixed: 1`, the row carries `top {Valerie, 7}` and `topPlayed {Valerie,
2}` from the detail's play log and `topPaid: null`, and the next plain call is
`skipped`; a row missing only `topPlayed` re-opens the heal on its own and it
retires again; a row whose detail document is gone is stamped null on all three
so the gate closes for that account too. Final line `107 passed, 0 failed`.

The page: a scratch browser at 375×812 and 430×932, light and dark, in the live,
next-gig and no-gig states with full data, a brand-new page with a setlist, and a
page with no setlist at all — the pinned block and its state line and action each
centred to within 1px of the viewport's middle, the block fixed inside the screen,
no horizontal overflow, `#joinBtn` inside `#app` with the live text and
`emberGlow`, the toast clearing the block, the footer clearing it when scrolled to
the bottom, no `<svg>` on any card; the strip's cards in the order rating,
comment, most voted, comment, most played, comment, most paid for; the strip
advancing on its own (`scrollLeft` 0 → 246 → 492 over two 3.5 s steps), landing
exactly on a card, pausing under a finger and for 6 s after it leaves, looping to
0 after the last card, continuing from a manual swipe, not advancing under
`prefers-reduced-motion`, and a payload from before this deploy rendering with no
strip and no error. `node tools/uicheck.mjs` PROFILE PAGE: 9 ✓.

The reader half — `topSongsOf` in `profile.mjs`, the cards in `artist.html` and
this record's row in the decisions index — reached `main` in 5b4a531 ahead of the
writer (`topOf` and the two row edits in `_history.mjs`), so until the writer
lands `/api/profile` answers `topSongs: []` for every night. They must land
together from here.
