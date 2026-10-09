---
id: 0156
title: Free vibes keep their own waiting places, and "Resume it instead" on the same night is never counted or refused at the free cap
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: plans
reverses:
superseded_by:
invariants: [0il, 9d9]
commits: []
tests: [test/vibesandresume.mjs, test/limits.mjs, test/tenancy.mjs]
files: [netlify/functions/_requests.mjs, netlify/functions/_lifecycle.mjs, netlify/functions/_lib.mjs, netlify/functions/stage.mjs, public/studio.js, test/vibesandresume.mjs, test/limits.mjs, test/tenancy.mjs]
---

## The question

Two small rows from the scale audit of 2 October 2026.

**Free vibes could block paid requests.** `createRequest` refused anything past `MAX_PENDING` (30) open requests for the night — songs, birthdays and vibes counted together. A vibe is a free mood tap (cost 0, one open per fan). Thirty of them in a night, and a fan with votes to spend on a song request, or a card already authorised for one (`authorizeRequestSession`, which then cancels the hold), was told "There are a lot of requests in already".

**Resume was refused on the tenth free show.** On the free plan (decision 0120, ten shows in total) a resume counted as another show: `countGig` ran on every start, fresh or not, and the cap check came first. So an End tapped by mistake on the last free show could not be undone — "Resume it instead" answered 402. 0120 kept "a resume counts again" deliberately, so that one night could not be stretched over many; the audit's fix keeps that and exempts only a resume of the same night.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen (vibes)** | Vibes count against their own `MAX_VIBES` (30); songs and birthdays keep `MAX_PENDING` to themselves | One constant | `MAX_VIBES` | A night with thirty open vibes refuses the thirty-first vibe — as it refused it before |
| B (vibes) | A true tally: one row per mood with a count and its fans | A new shape on `req_` | Every reader of request rows: the Studio's panel, the fan page's own asks (`myAsks`), the archive's counts, the register | The fan page (`public/vote.html`) reads each vibe as its own row, and is not this branch's to change tonight |
| **A — chosen (resume)** | A resume of the same night — not live, counted on the free plan for this showId, started under twelve hours ago — skips the cap and is not counted | One pure function | `sameNightResume`, `SAME_NIGHT_MS`, `resumeSameNight` on the stage | A night resumed inside twelve hours is one show; a long night is one show |
| B (resume) | Skip the count for every resume | Simplest | None | A night resumed next week plays for free: exactly what 0120 guarded against |
| C (resume) | Exempt a resume only within minutes of the End | Tighter | A clock on the End | An artist who ended at the break and came back an hour later pays a show for it |

## What was chosen, and why

**Vibes: A.** The fault is the shared count, so the fix is to stop sharing it. Each kind keeps thirty places, so together they stay under `MAX_KEPT` (80) and the list stays bounded. Every row keeps its shape, so the fan page, the Studio, the archive and the register read exactly what they read before. A vibe refused for being one too many says it is the vibes.

**Resume: A.** "The same night" is the night already counted on the free plan (`freeNight.id === showId`), not live, and started less than `SAME_NIGHT_MS` (twelve hours) ago. Such a resume is not refused at the cap and not counted again, at the cap or below it — so an accidental End is undone for nothing, which is what the button says it is for. Everything else meets the cap exactly as before:

- a new show at the cap: refused, same words;
- a resume of a night that began over twelve hours ago: counted, and refused at the cap, so a night still cannot be stretched over many;
- a resume of a night given back (a discard, a quiet calendar night — `freeNight` cleared): counted, because it was given back;
- a resume of a night played on a paid plan whose plan has since lapsed: counted, because it was never counted;
- a paid plan and the founder: never counted, as before.

`sameNightResume` lives in `_lib.mjs` because the Studio's stage payload asks it too (`resumeSameNight`) and must not load the lifecycle. The Studio offers "Resume it instead" only when the server would allow it: at the cap, only for the same night (rule 3).

## What this makes harder

- Below the cap, a resume of the same night no longer uses a free show. 0120's text "a resume counts again" now reads "a resume of a night over twelve hours old counts again". The founder decided 0120; this narrows one sentence of it on the audit's word, and is marked proposed for that reason.
- A free night can be ended and resumed for up to twelve hours from its start as one show.
- Vibes still sit in the request rows. A night with hundreds of fans who all want to send a mood waits at thirty open, as before; the tally (option B) is the follow-up.

## What would reverse it

- The founder choosing a different window for "the same night", or none (`SAME_NIGHT_MS` is one constant).
- Vibes moving to a tally (option B), which needs the fan page to read a mood's own row with a count, and `myRequests` to say which mood is the fan's.

## How it was verified

- `node --import ./test/register.mjs test/vibesandresume.mjs`: 48 ✓, 0 ✗. Thirty vibes go in; a fan spending votes on a song request still gets in; the thirty-first vibe waits and says so; songs keep all thirty places and their own cap; the list stays within `MAX_KEPT`; a fan still sees their own vibe waiting. A free artist plays ten shows, ends the tenth by mistake, the Studio is told it is the same night, the resume works and is not counted; ending and resuming again the same night is still one show. At the cap a new show is refused; a night begun over twelve hours ago is not the same night and its resume is refused, changing nothing. Below the cap the same night is one show; a resume after twelve hours counts again; a discarded night resumed counts again, straight away or later; a paid plan counts nothing.
- Six knock-outs, each red, each restored: vibes sharing the paid places again (2 fail); vibes with no cap of their own (1); a same-night resume meeting the cap (3); a same-night resume being counted (5); no twelve-hour bound (4); a night given back treated as the same night (2).
- Two existing tests changed, each saying why: `test/limits.mjs` 172 ✓ (a resume of the same night is one show; it pinned 0120's "the resume counted too", 2) and `test/tenancy.mjs` 86 ✓ (at the cap, resuming the night just ended works; "Start the show is capped too" now resumes a night begun over twelve hours ago, and is still 402).
- **Not checked:** the Studio's ended screen in a browser at the cap; a real room with thirty open vibes.
