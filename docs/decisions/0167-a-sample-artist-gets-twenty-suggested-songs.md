---
id: 0167
title: A sample artist's song list starts with twenty suggested songs, unless the founder unticks the box
date: 2026-10-04
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: [b086a33]
tests: [test/factory.mjs, test/samples.mjs, test/hq.mjs]
files: [netlify/functions/_fai.mjs, netlify/functions/_factory.mjs, netlify/functions/_sample.mjs, netlify/functions/hq.mjs, netlify/functions/factory.mjs, public/crm.html]
---

## The question

A sample page opened with an empty song list. The founder asked for 20 suggested songs from what the generator learns about the act:
- the 10 most popular songs of their main genre (and country);
- 5 from one neighbouring genre;
- 5 from another.

It should be one checkbox in the generation window, ticked by default and possible to untick.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | One more model call after the copy (`suggestSongs`, the smart model, no web search), fed the act's genre, place and instrument facts. It answers with the genre, two neighbours and exactly 10 + 5 + 5 songs; the check refuses any other count or a song twice. `createSample` writes them into the library, the way `addSong` shapes a row | About one cent a page | A title the model gets wrong |
| B | Fold the songs into the copy call | No extra call | The copy's checks (facts only, citations) do not fit songs, which are suggestions, not facts |
| C | Search the web for each genre's charts | Truer "most popular" | Ten or more searches a page, and slower |

## What was chosen, and why

A.
- The songs are not facts about the act, so they are kept out of the facts-only copy. They are a starting list the artist edits once the page is theirs.
- **The library is the setlist** while no named list is chosen, which is always the case on the free plan a sample runs on. So the page shows them under "On the setlist", and the Studio's preview has something to vote on.
- **A failed songs call costs the song list, never the page.** The error goes into the build's `provenance.errors.songs`.
- **Artists only.** The switch is hidden for a venue, and the server ignores it there.
- **The ask rides on the seed**, so a Rebuild asks again. The songs are also kept on the sample record, so a revived page has them back.

## What would reverse it

- Artists who find the suggested list wrong for them often enough that it puts them off claiming.
- Model answers with songs that do not exist. A search-backed version (option C) would be the fix.

## How it was verified

- `test/factory.mjs`:
  - 20 songs come back, main first;
  - nineteen is refused and repaired once;
  - the songs are asked for with the smart model, from the facts and the place;
  - a failed call still builds the page;
  - a venue is never asked;
  - without the tick there is no call.
- `test/samples.mjs`:
  - the library holds the songs in order, a duplicate kept once, each row shaped like `addSong`'s;
  - the page reports them under "On the setlist";
  - a revive brings them back.
- `test/hq.mjs`: the tick is on by default, an unticked form asks for none, and a venue never does.
- Full suite exit 0.
- At 375 px on a local copy of CRM:
  - the switch is on by default;
  - it is hidden on Venue;
  - Generate sent `songs: true`.
- NOT checked: a real (paid) build's song list, or how good the model's picks are for a real act.
