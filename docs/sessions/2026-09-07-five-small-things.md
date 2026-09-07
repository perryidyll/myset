# Five small things, and two bugs found underneath them
2026-09-07

Perry tried the trimmer on his own phone — it worked — and sent a short list of
tweaks. Three were exactly as small as they looked. Two were not.

---

## 1. The clip limit, 50MB → 75MB

`MAX_VIDEO_BYTES` in `netlify/functions/_video.mjs` and `CLIP_MAX` in
`public/community.html`. Both, because the phone refuses before it sends and the
server refuses again on the joined file; they are two guards, not one guard in two
places, and `test/clips.mjs` reads the server's number rather than hard-coding it.

His video is 2.3MB per second of footage, so 75MB is about 32 seconds of it.

The line under the button now reads **"Up to 75MB, one per post"**. It no longer
mentions seconds or sound. Seconds were never the real limit — bytes were — and a
clip's sound has not been a separate thing since the re-encoder was deleted.

The 30-second check is still in the page. A longer clip is not refused, it opens
the trim screen, which is the same place an oversized one goes.

## 2. Two placeholders

- the show picker: "Just in general" → **"Where did you see them?"**
- the link field: "Paste a video link — YouTube, Instagram or TikTok" →
  **"Paste a video link"**

## 3. The lyrics window — two real bugs

Perry's screenshot showed the sheet shifted to the right and the page scrolling
behind it. Three separate faults:

**It jumped sideways.** The sheet is centred by `transform: translateX(-50%)`, not
by geometry. The drag handler wrote `style.transform = 'translateY(0)'` — one
missing term, and the sheet moves half its own width the instant a finger lands on
it. (INVARIANT 0f0)

**The page behind moved.** Nothing froze the body. Added `body.sheeting`
(`position: fixed` at the offset the page was at, restored on close). (0f2)

**The words could not be scrolled.** The lyrics pane is a scroller inside a sheet
that is itself draggable, and the drag handler took the touch first — so trying to
read pulled the sheet down. It now refuses to begin inside `.lyr`, which is also
`overscroll-behavior: contain` and `touch-action: pan-y`. (0f1)

And the handle got bigger: the grab zone is 56px (was 44), and the title and the
line beneath it now drag the sheet too — on a sheet whose body is a scroller, the
bar was the only place a thumb could pull from.

`tools/sheetcheck.mjs` (new) drives all of this with real touch events in Chrome
at a 390px iPhone viewport. None of it was visible to a node test.

## 4. The MySet mark in the middle of every QR code

`qrSvg` now clears a square of modules in the centre and draws the three-bar badge
on it. Level M rebuilds about 15% of a code; the badge is 17% of the width, under
3% of the modules.

**21% was too big.** Rendered and decoded 15 real codes at three scales under
downscale + blur: at 21% three of fifteen stopped reading, at 17% all fifteen read
— identical to a plain code with no mark at all.

### And the bug underneath it

Verifying the logo meant decoding forty codes, and one of them — and only one —
would not decode **with or without the mark**. It was not the mark.

Every QR code has a "dark module", permanently black, at `(4×version + 9, 8)`. The
writer treated it as format bit 7: it wrote the bit there and shifted the whole
top-right run of the second format copy by one. The top-left copy was still
correct, so readers fell back to it and 39 of 40 codes scanned anyway. That is why
this survived the module-for-module review the file's own header describes.

Fixed. All forty now decode. `test/qr.mjs` (new, 10 assertions) checks the dark
module, that both format copies agree, that the finders are intact, and that the
badge stays clear of them — it fails on the old code. There was no QR test at all
before today, for something that gets printed and stuck on tables. (0f3, 0f4)

## 5. "Past shows" all say the wrong venue

Sent mid-session: his Money tab named every night "The Ugly Duckling Irish Pub".

Confirmed against production, read-only (`tools/prod.py`): five filed nights, all
carrying that venue — and his calendar holds three, including **Seaflower
Bungalows** on the Thursday one of those nights actually happened.

`show.venue` is ONE field, typed once in Settings. Every night copies it as it is
filed and nothing ever went back. Both halves fixed:

**Going forward.** Starting a show takes the venue and city from the gig that is
running — the same occurrence that already supplies tonight's setlist, six lines
away in `_lifecycle.mjs`. Only on a fresh night (a resume must not relabel a night
under way), only from a gig on now or within six hours, and it says so in the note
rather than changing the name quietly.

**Backwards.** `placeShows` in `_history.mjs`, reached by a new button under Past
shows: *"Name these from my calendar"*. It renames a filed night only when a gig
was actually **running** when that night started — half an hour of grace at the
front, nothing past the gig's own end. Not the nearest gig, not the same weekday.
A confidently wrong venue is worse than an out-of-date one. It writes the detail
document and the index row, touches nothing but the name and the city, and running
it twice does nothing. (0f5)

`test/place.mjs` (new, 18 assertions) pins the two halves and, mostly, the three
things it must NOT do.

---

## Verification

- `sh test/run.sh` — green, 0 failures (two new suites wired in)
- `tools/sheetcheck.mjs` — 12/12, real touch events, 390px iPhone viewport
- QR: 40 lengths × {with mark, without} rendered in Chrome and decoded — 80/80,
  plus 15 real MySet URLs at three scales under four kinds of degradation
- production read-only inspection of the five filed nights and the calendar
