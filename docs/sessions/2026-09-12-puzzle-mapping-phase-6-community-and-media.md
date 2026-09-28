# 2026-09-12 — Puzzle mapping, Phase 6: Community & media

**Asked:** *"keep it public – now go ahead with community & media."* The first half is decision 0047 (recorded, `HARDENING.md §2` corrected, ledger risk resolved by decision, changelog 1623). The second half is below.

## What shipped

Five sheets under `docs/processes/community-and-media/`, loaded onto tab 39038, RACI on every step, read back through `list_sections`:

| Sheet | Section | Steps | Draft |
| --- | --- | --- | --- |
| 01 | Saying something about a night | 41999 (w01–w09) | — |
| 02 | A clip, as it was filmed | 42000 (k01–k12) | k12 *Measure it on a real phone* (the two unmeasured ledger risks) |
| 03 | Moderating the page | 42001 (g01–g08) | g08 *Take something off MySet itself* (no platform queue — threat #2) |
| 04 | Photos on a page | 42002 (i01–i08) | — |
| 05 | Lyrics and chords on stage | 42003 (l01–l08) | l08 *Chords aligned above the lyrics* (decision 0022's open end) |

45 steps (370126–370170), 72 role links (326468–326539), 39 connections; two cross-section (w04 → k01 *a clip*; w08 → g06 *a count*). Tools: Netlify everywhere, Cloudflare R2 on the three R2 steps.

Changelog: **1624–1627** for decisions 0011, 0020, 0022, 0033 — four of the eight records that had no entry — linked to the steps they govern. Remaining without an entry: 0015, 0025, 0027, 0036, and the other session's 0042, 0043.

Ledger: DOC-009 done, DOC-010 added, verification-log row.

## Findings

- **"Where a night happened" (overview §3.8) is not a section on this tab** — it is already *Money → Past shows* h04 (*Name these from my calendar*); the plan listed it under Community & media because the community page picks nights from it. It is a `go_to` from w03. The plan row's intent is met without a duplicate.
- The community page picks nights from the **calendar**, not the archive (`pickableNights` — every gig in the last 120 days, one per venue-and-date); the overview's §3.7 says "a real archived show from the artist's own history", which was true before `pickableNights` and is now the fallback. Worth one sentence in the overview; not changed here because §3.7 is prose the other session may be touching (`MYSET-MASTER-OVERVIEW.md` is in the tree).
- Hiding a post strips its photos and clip **on the way in** and un-hiding does not restore them — a detail nowhere in the documents, only in `_community.mjs moderate`. It is on the canvas now (g04).

## Verified / not checked

**Verified:** `list_sections` on 39038 returns five sections with 9/12/8/8/8 steps; code read for every `Live` step (`community.mjs`, `_community.mjs`, `clipup.mjs`, `_video.mjs`, `vid.mjs`, `_img.mjs`, `img.mjs`, `admin.mjs` post/photo/lyrics actions, `_lyrics.mjs`, `_chart.mjs`, `_chords.mjs`, `venueadmin.mjs` role sets, `studio.html` crop sheet). **Not checked:** the canvas in a browser; anything on a phone.

Nothing committed or pushed. The other session's working-tree files are untouched.
