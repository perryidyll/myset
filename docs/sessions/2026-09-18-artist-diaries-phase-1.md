# 2026-09-18 — Artist Diaries, phase 1 (DIA-001, decision 0085)

**Asked:** "take the next steps" on the Artist Diaries pitch from 2026-09-15 — a
storytelling layer beside the songs. Two structural questions were put to the
founder before any code: who sees it (every plan, sized 3 / 10 / 40 by plan —
"pages", his word) and where it lives (a dedicated diary page, not a widget on
the setlist sheet). Then "let's begin."

**Built** on `docs/artist-diaries-phase1-scope` off `origin/main` `9f46b8b` (the
local `~/Docs/MySet` checkout is 60 commits behind and carries other sessions'
uncommitted docs — not touched). Decision `0085` has the options and the reasons;
the ledger row is DIA-001; INVARIANT 0gb.

- `_plan.mjs` — `diary: 3 / 10 / 40` on the three rows, `diaryCap(limits)`,
  `MAX_DIARY`; `shapeLimits` ships `diary` so the plan cards read the number.
- `_lib.mjs` — `KEY.diary = diary_<aid>` (the family reserved on 2026-09-15). One
  document per artist, the whole list; never on the audience poll.
- `_diary.mjs` — `normPage` (title 80, when 40, body 4,000 with paragraphs kept),
  `readDiary` / `mutateDiary` (casKeep — a version before every change),
  `movePage`, `shapePages` (the song resolved from `show.songs` on every read),
  `handleDiary` for `diaryList / diarySave / diaryRemove / diaryMove`. The cap is
  inside the CAS, against growth, never size; the refusal names the number and the
  plan; the song is checked by id against the library. No owner bypass — the
  founder is comped Rock Star in production and reads as Rock Star; in the fake he
  is stopped at three like anyone, which is the point.
- `admin.mjs` — `DIARY_ACTIONS` routed to `handleDiary`; `diarySave / Remove /
  Move` need `profile` (a band mate may; crew may not).
- `diary.mjs` on the warm door (`fan.mjs` `what=diary`): name, first, avatar, the
  tick, `live`, the shown pages; `jsonCached` fifteen seconds like the profile.
- `profile.mjs` — `diary`: the count of shown pages, one more read in the batch.
- `_account.mjs` — the export carries `diary` (every page) and its versions;
  `keysFor` names the document and its version keys.
- `_auth.mjs` — `diary` and `diaries` reserved. `netlify.toml` — `/:slug/diary` →
  `/diary.html` above the catch-all, with the shop's cache header.
- `public/diary.html` — new: the shop's skeleton (splash, tokens, brandbar, the
  crumb to the artist's page wearing their first name once known, lastSeen
  paint, MySetPull, the five-minute re-read, the live bar). Each story is a card:
  the moment as a kicker, the title, a song chip, the paragraphs, *Read the
  lyrics* (the vote page's `/api/lyrics`, opened on a tap, the same honest
  label). A drop cap on the first story. `#<pageId>` lands on a story.
- `public/artist.html` — the **Diary** door when `P.diary > 0`; four doors take
  two rows of two (`.pacts.four`).
- `public/studio.js` — `DIARY / DIARYCAP / DIARYLIM`; Menu → **Diary**;
  `diarySection` (n/N from the server, the rows, ↑ ↓ Edit ✕, *+ Write a page*
  replaced by the plan note at the cap, with *see the plans* below Rock Star);
  `openDiaryPage` (title, when, the song list from `D.songs`, the story with a
  counter, On/Off) with a phone-side draft (`myset.diary.draft`) that fills as
  they type, comes back on reopen, and clears on save; `?tab=diary` accepted;
  the plan cards' diary line reads `PLAN.plans[k].diary`. `tools/stamp.mjs` run.
- `tools/overview.mjs` — the plan table's new row. `INVARIANTS.md` — 0gb.
  `test/copy.mjs` — the diary page in the theme / splash lists.
  `docs/processes/community-and-media/06-the-artist-diary.md` — the sheet,
  drafted; not loaded into Puzzle yet.

**The second round, the same evening**, after the founder saw it: the diary's
front door on the community page is a second card under the merch card — the
same `.shopcard`, ring and fan, *Read the diary →* — and each page takes a cover
photo. `community.mjs` ships `diary` (the count) and `diaryPeek` (three titles +
covers); `_img.mjs` gains `DIARY_SLOT` (`d<id>`); `_diary.mjs` gains
`diaryPhoto` / `diaryPhotoClear` and keeps `img` on a page (a save never sets it);
`keysFor` names the covers; `public/diary.html` heads a story with its cover
(16:10, full-bleed on the card); `public/community.html` draws the card, an
initial standing in where a page has no cover; the Studio editor gets a *Cover*
slot through the existing wide crop sheet, staged for a new page and uploaded
right after the save mints the id. Answered on the way: the Studio entry is a
Menu row (Menu → Diary), like Merch and Messages, not a bottom tab.

**Verified:** `sh test/run.sh` green, 54 files, with the new `test/diaries.mjs`
(89 assertions — the table, the fields, the cap on every plan and after a
downgrade, the founder, the public read and what never leaves it, the profile
count, the reserved slug and the route, who may write, export / keys / delete).
Walked on `tools/localhost.mjs` at 375 px, light and dark: the Diary screen at
0/3; a page written through the editor (the draft in localStorage as typed,
cleared on save, the row reading *Winter 2019 · ♪ Valerie*); two more through
the API and the fourth refused with the 402; 3/3 with the button gone and the
note in its place; the Diary door on `/demo-artist`; `/demo-artist/diary` with
the three stories; *Read the lyrics* opening Creep through `/api/lyrics`. Second
round: a page with a cover through the real crop sheet (the editor back with its
draft and the staged cover, the save minting the id, the cover following —
`/api/img?…&s=d<id>` 200), the Diary card under the Merch card with the cover in
its fan, the cover heading the story, ✕ clearing it and the card falling back to
the initial.

**Not checked:** the deploy preview; the founder's own first page on the live
site; the editor on a real phone keyboard.

**Left open:** timed lyrics (wait for audio); a restore-a-version for a page;
`tools/uicheck.mjs` does not open the diary yet; the Puzzle load + changelog
entry for 0085 (the sheet is drafted); a Notion task tick.

**Not pushed.** AGENTS.md: never commit or push unless asked.
