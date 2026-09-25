---
id: 0092
title: The Instagram dashboard lives on the site at /mediadash, fed by pushes from the content engine, never pulling Instagram itself
date: 2026-09-25
status: decided
decided_by: claude
area: ops
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/structure.mjs]
files: [netlify/functions/mediadash.mjs, public/mediadash.html, netlify.toml]
---

## The question

The founder asked for the Instagram metrics dashboard — built the same day inside the
content engine (a separate repo, `myset-content`, which holds the Instagram token, the
posting plan and four pulls a day of every post's numbers) — to be reachable at
**myset.vip/mediadash** from anywhere, not only on `localhost:8798` on his Mac. The site
had none of what the page needs: no Instagram token, no post names or formats or music,
no history of pulls. Something had to carry that across, and the question was which side
does the work.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: the Mac pushes** | After every pull the engine POSTs one JSON (every live post's numbers and curve, the account's daily series, the queue) plus a small JPEG per post to `/api/mediadash` with a dedicated key; the function stores it in three computable blob keys and serves it | A push key in Netlify's env and in the engine's `.env`; the page is stale when the Mac is asleep (the same dependency posting itself already has) | One function, one page, one redirect; nothing else on the site knows the dashboard exists | The page shows yesterday's numbers with a *pushed 14 h ago* line; nothing on the gig path is touched |
| B — the site pulls Instagram itself | A scheduled function holds the Instagram token and pulls every six hours into Blobs | The token in production's env; the plan (names, formats, music, the queue) still has to come from the Mac, so it is A plus a second collector | A scheduled function, a token rotation every 60 days on the site, two sources of truth for the history | A token expiry silently stops the curves; two collectors disagree |
| C — do nothing | The dashboard stays on `localhost:8798` | The founder opens his Mac to see it | None | — |

## What was chosen, and why

A. The engine already does the whole job — it holds the token, knows every post's
name, format, hook and track, and keeps every pull as a curve — so the site only has to
*keep and show* a JSON it is handed. That keeps every Instagram credential off
production, keeps one copy of the history (the Mac's, committed where it cannot be
re-pulled), and puts nothing new on the path the room votes over. The push uses its own
key (`MEDIADASH_KEY`), never the master admin code: a leaked push key can overwrite a
dashboard and nothing else. Boosts the founder logs from the live page are the one thing
that flows the other way; the engine reads them back on its next pull, so the Mac stays
the single record.

Reads are public on purpose — the page shows what @myset.vip's Instagram already shows
anyone, plus the titles of the next eight scheduled posts, which is not a leak of any
media. Writes are two doors that both fail closed: the push key, or the founder's own
sign-in / recovery code (`requireArtist`, and only the founding artist).

## What this makes harder

The live page is only as fresh as the Mac: if the Claude app is closed the scheduled
pull does not run and the page ages (it says so). Moving the dashboard to another
machine means moving the engine. And there are now two copies of one HTML file
(`publish/dashboard.html` in the engine, `public/mediadash.html` here) that must stay
byte-identical — the engine's header says so.

## What would reverse it

The founder wanting the page fresh without his Mac (then option B's scheduled function,
with the plan still pushed), or a second person needing to log boosts (then the founder
gate widens to a role). If the pushed JSON ever nears the 4 MB cap in the function, thin
the curves to daily points past seven days before raising the cap.

## How it was verified

Written in `docs/sessions/2026-09-25-mediadash.md`: the suite on this branch, the deploy
preview checked by content, the push from the engine, and the live page fetched by
content after the merge. Anything not in that note was not checked.
