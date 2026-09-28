---
tab: Community & media
section: Lyrics and chords on stage
puzzle_section_id: 42003
sources:
  - netlify/functions/_lyrics.mjs (LRCLIB, the two headers, MISS_TTL, readLyrics, saveLyrics), lyrics.mjs (public), admin.mjs (songGet — the song sheet reads the words with the song —, lyricsSet, lyricsFetch, lyricsWarm — the 350 ms spacing), _chart.mjs (MAX_CHART — the artist's private chart), _chords.mjs (the Ultimate Guitar link resolver, CACHE_MS)
  - public/vote.html ("Unofficial lyrics"), public/studio.html (lyricsWarm, the chart)
  - MYSET-MASTER-OVERVIEW.md §5.8 Lyrics
  - INVARIANTS.md § Lyrics
  - docs/decisions/0022
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections)
verified: code read 2026-09-12 (_lyrics.mjs headers and cache; admin.mjs lyricsWarm loop; _chart.mjs; _chords.mjs header)
---

# Lyrics and chords on stage

**Who:** the artist mid-set; the room reading along. **Trigger:** *Lyrics* on the voting page; the chart button in the Studio's live sheet. **Outcome:** the words of the current song on every phone, honestly labelled *Unofficial lyrics*, fetched once and never forty times; and the artist's own chart — or a link to somebody else's — without MySet ever republishing a chord sheet it has no licence for (decision 0022).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| l01 | Warm the setlist before the gig | task | Person | Artist R · MySet server R | Netlify | Studio → *lyricsWarm*: every active song fetched from LRCLIB once, spaced by 350 ms because LRCLIB asks for spacing; the reply says how many were found and names the missing ones. `src: admin.mjs lyricsWarm` |
| l02 | Fetch from LRCLIB, server-side | task | Automation | MySet server R | Netlify | LRCLIB — free, keyless, no AI, community-contributed. It **must** run on the server: LRCLIB asks clients to identify themselves and a browser is forbidden from setting `User-Agent`; the two documented headers (`Lrclib-Client`, `X-User-Agent`) do it. `src: _lyrics.mjs HEADERS; overview §5.8` |
| l03 | Cache for ever, misses for a month | database | Automation | MySet server R | Netlify | `lyr_<aid>_<song>` (a flat key — INVARIANT 2): a hit is kept permanently; a miss is re-checked after `MISS_TTL`. A whole bar tapping *Lyrics* the moment a song starts never becomes forty simultaneous calls to a free community API. `src: _lyrics.mjs saveLyrics, MISS_TTL` |
| l04 | Show the room the words, labelled | webpage | Automation | MySet server R · Fan I | Netlify | The voting page, **current song only**, footer *"Unofficial lyrics · community-contributed, may not be exact"* — the honest label for a community database — with one-tap removal by the artist. `src: vote.html 1410; overview §5.8` |
| l05 | Correct or remove them | task | Person | Artist R | Netlify | `lyricsSet` (the artist's own text replaces the fetched one), `lyricsFetch` (pull this one again now). `src: admin.mjs lyricsGet/lyricsSet/lyricsFetch` |
| l06 | Keep your own chart, privately | form | Person | Artist R | Netlify | `_chart.mjs`: words, chords, capo notes, a reminder the second verse is different — whatever they paste, up to `MAX_CHART`. **Never in any public payload, never fetched from anywhere.** Its own document, because a full chart runs to kilobytes and `show` is the hot read every phone polls. `src: _chart.mjs; admin.mjs chartSet` |
| l07 | Find somebody else's chart, honestly | conditional | Automation | MySet server R · Artist I | Netlify | Chord sites publish no supported feed and their arrangements are third-party content. `_chords.mjs` reads a provider's search-result metadata only long enough to find the direct chords URL for an **exact** title-and-artist match (a plausible-but-wrong song is worse on stage than a search page), caches the link for `CACHE_MS`, and otherwise hands the artist the ordinary search. It never downloads, parses, stores or republishes a chart, and never pretends a link is an in-app chart. `src: _chords.mjs; decision 0022` |
| l08 | Chords aligned above the lyrics | research | Person | Founder R | — | **Draft — decision 0022's open end.** Aligned display is easy once MySet has ChordPro-like source text; obtaining that text properly — a licensed feed, or recording analysis — is the hard part and does not exist. The in-app chart surface is kept ready for it. `src: decision 0022 § What was chosen` |

## Connections

l01 → l02 → l03 → l04; l04 —wrong→ l05 → l03; l06; l07 —exact match→ *the provider's page*; l07 —no match→ *the search*; l07 —Draft→ l08.
