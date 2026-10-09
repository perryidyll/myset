---
id: 0203
title: No short field a page draws holds markup
date: 2026-10-09
status: decided
decided_by: claude
area: auth
reverses:
superseded_by:
invariants: [0jf]
commits: []
tests: [test/nomarkup.mjs]
files: [netlify/functions/_profile.mjs, netlify/functions/_maps.mjs, netlify/functions/_requests.mjs, netlify/functions/_community.mjs, netlify/functions/_diary.mjs, netlify/functions/_wishes.mjs, test/nomarkup.mjs]
---

## The question

The scale audit of 2 October 2026 rated one finding critical: *any artist can plant script on their own public page*. The management name was written into `artist.html` without escaping, and it ran for every visitor on the site that holds Studio sign-ins. #204 (`d8a3e56`) escaped it on the page that day. The audit's fix had a second half that nobody had built: *strip angle brackets when the profile is saved*, so that the next page that forgets to escape draws text, not a tag. The founder asked on 2026-10-09 for every audit item that needs no answer from him to be done.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: strip `<` and `>` in every short-field cleaner that feeds a page** | The one-line `clean` in `_profile.mjs`, `_maps.mjs` (venues), `_requests.mjs`, `_community.mjs`, `_diary.mjs` and `_wishes.mjs` takes the two characters out. Long text is left alone. | Six lines. A name or title can no longer contain `<` or `>`. | None. | A real title with `<3` loses the `<`; the page still reads. |
| B — the artist profile only | What the audit named. | One line. | None. | The same mistake on a venue page, a request title in the Studio or a diary page has no second guard. |
| C — strip from long text too | Bios, Abouts, stories, posts. | Real writing loses characters (`I <3 this bar`, `->`). | None. | Those are escaped where drawn (`esc`, `aboutLines`); the gain is small and the loss is visible. |
| D — do nothing more | Rely on `esc` on every page. | — | — | One forgotten `esc` on a public page is script on myset.vip. |

## What was chosen, and why

A. Escaping on the page is the real defence and stays the rule; this makes a forgotten escape harmless for every field that is short by nature, wherever it is drawn. `normProfile` also runs on every read (`getProfile`), so a value stored before this is clean when served, with no migration. Long text keeps its own characters because people write `<3`, and every place that draws it was checked to escape it.

## What this makes harder

A short field can no longer hold `<` or `>`, even legitimately.

## What would reverse it

A real need for those characters in a name or title, which would mean escaping is trusted alone again.

## How it was verified

- `node --import ./test/register.mjs test/nomarkup.mjs` → 17 ✓ / 0 ✗: the artist's management, names, tagline and style hold no tag, the bio keeps `<3`; a venue's name, tagline, city and menu hold none, its About keeps `<3`; a diary page's title and *when*; a request sent through `/api/request` is stored with a tag-free title and artist; each of the six cleaners strips.
- Knock-outs: the strip removed from `_profile.mjs` (4 ✗), `_maps.mjs` (3 ✗), `_requests.mjs` (2 ✗), each restored.
- Checked by reading: `artist.html` escapes `P.bio` (`esc`) and `P.management` (since #204); `venue.html` draws the About through `aboutLines`, which escapes each sentence (`fan.js`).
- Not checked: every other page that draws these fields, one by one; that is what the strip is for.
