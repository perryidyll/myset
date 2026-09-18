---
tab: Community & media
section: The artist diary (the stories behind the songs)
puzzle_section_id: (not loaded yet — see status)
puzzle_steps: (none yet) · changelog 1835 (in_progress until the batch merges)
sources:
  - netlify/functions/_diary.mjs, diary.mjs (the document, the cap, the public read)
  - netlify/functions/admin.mjs (DIARY_ACTIONS, CAPABILITY), _plan.mjs (PLANS.*.diary, diaryCap)
  - netlify/functions/profile.mjs (the `diary` count for the door), _account.mjs (export, keysFor)
  - public/diary.html, public/artist.html (the Diary door), public/studio.js (Menu → Diary)
  - docs/decisions/0085
  - INVARIANTS.md 0gb, 0s, 0fs, 1
status: drafted 2026-09-18 with the build; changelog entry 1835 written the same day (in_progress) — to be loaded into Puzzle (create_process) and the entry moved to completed the day the batch merges
loaded: (not yet)
verified: code read 2026-09-18; test/diaries.mjs; walked on tools/localhost.mjs
---

# The artist diary (the stories behind the songs)

**Who:** the artist (role *Artist*), a band mate on a seat, and the fan who reads (role *Fan*, no account). **Trigger:** Menu → **Diary** in the Studio; the **Diary** door under the numbers on the artist's page. **Outcome:** a page of stories at `myset.vip/<slug>/diary` — each one a title, a moment, a story, and (when it is about one) a song from the library with its lyrics a tap away.

Every plan has the diary. What the plan buys is how many pages it holds — 3 · 10 · 40 — read from `PLANS` and typed nowhere else (decision 0085).

| id | step | type | executor | role (RACI) | tool | notes |
|---|---|---|---|---|---|---|
| d01 | Write a page | form | Person | Artist R | Netlify | Studio → Menu → **Diary** → *Write a page*: a title (80), *When* (40, optional — "Summer 2019"), the song it is about (a list of the library, by id, or *No song — it's a moment*), the story (4,000, paragraphs by blank line), *On the page* On/Off, and a *Cover* — one photo, cropped wide on the phone like the profile's cover, up by `diaryPhoto` once the page has an id (staged in the editor for a page not saved yet). The phone keeps a draft as it is typed (`myset.diary.draft`) and forgets it only once the server has the page. `src: public/studio.js openDiaryPage / saveDiaryPage; _img.mjs DIARY_SLOT` |
| d02 | The server keeps it, inside the cap | conditional | Automation | MySet server R | Netlify | `diarySave` on `/api/admin`: the song must be in `show.songs` (by id, 0fs) or the page is refused with a sentence; the cap is checked INSIDE the CAS on `diary_<aid>` — the next page past `diaryCap(limits)` is a 402 naming the number and the plan; an edit on a full diary saves; the newest page goes on top. The document as it was is kept as a version before every change (0067). `src: _diary.mjs handleDiary; INVARIANT 0gb` |
| d03 | Order, hide, remove | task | Person | Artist R | Netlify | ↑ ↓ set the order the page reads in (`diaryMove`); *Off* keeps a page in the Studio and off the page — it still counts; ✕ removes it after the Studio's own window asks (`diaryRemove`, never gated: a lapsed artist can always take a page down, 0s). A band mate may do all three (`profile`); the sound engineer may not. `src: _diary.mjs; admin.mjs CAPABILITY` |
| d04 | The door appears | conditional | Automation | MySet server R · Fan I | Netlify | The profile read carries `diary` — the count of shown pages — and the artist page wears the **Diary** door only when it is above zero (the third rule: never a button to a shrug). Four doors take two rows of two at 320 px. The community read carries the same count and `diaryPeek` (three titles and covers), and the community page draws a **Diary** card under the merch card — the same card, *Read the diary →*, the covers fanned where the shop fans its pictures, a page's initial where there is no cover. `src: profile.mjs; community.mjs; public/artist.html; public/community.html` |
| d05 | Read the diary | task | Person | Fan R | Netlify | `/<slug>/diary` → `/api/fan?what=diary&a=<slug>`, one read, edge-shared fifteen seconds like the profile; only shown pages travel, with each song resolved from the library on the way out (a song that left the library leaves the page standing on its own). The last copy the phone saw paints first; a link to `#<pageId>` lands on that story. `src: diary.mjs; public/diary.html` |
| d06 | Read the lyrics beside it | task | Person | Fan R | Netlify | *Read the lyrics* on a page that names a song: `/api/lyrics?song=<id>&a=<slug>` — the vote page's read, plain words, the same "Unofficial lyrics" label. Opened on a tap, never on load. No audio, no embeds in v1; timed lyrics wait for the phase that brings playback. `src: public/diary.html; lyrics.mjs` |
| d07 | Export, mirror, delete | database | Automation | MySet server R | Netlify | `keysFor` names `diary_<aid>` and its versions; the account export carries every page, shown or hidden, and the versions kept of the document; the nightly mirror copies it; a deleted account leaves none. `src: _account.mjs exportArtist / keysFor` |

## Connections

d01 → d02; d02 → d03; d02 and d03 → d04 (the count changes); d04 → d05; d05 → d06; d07 stands alone (every write, every night, on leaving).

## What is deliberately absent

- No diary for a venue page: `/v/<slug>/diary` has no route and the read has no `?v=` branch.
- No pictures IN a story, no audio, no embeds: a page has one cover photo and the story is words (decision 0085 names the phases that could change that, and the rights question each brings).
- No drafts folder past the cap: *Off* keeps a page out of sight, and it still counts — the cap is the plan line, exactly as the library's is.
- No restore-a-version button: the versions are kept (`listVersions` on `diary_<aid>`); the Studio has no door to them yet, for the diary or for anything else (0067's open item).
