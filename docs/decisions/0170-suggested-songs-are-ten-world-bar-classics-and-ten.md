---
id: 0170
title: suggested songs are ten world bar classics and ten of the act's country
date: 2026-10-07
status: decided
decided_by: perry
area: ui
reverses: 0167
superseded_by:
invariants: []
commits: []
tests: [test/factory.mjs, test/samples.mjs]
files: [netlify/functions/_fai.mjs, netlify/functions/_sample.mjs]
---

## The question

Decision 0167 had the model name an act's main genre plus two "neighbouring" genres and
suggest the most popular songs of each. A Thai singer-songwriter on Koh Phangan, with no
genre on file, got Thai pop as the main genre and then neighbours guessed from the place,
which is known for full-moon dance parties. That is how Tiësto's *Adagio for Strings*, a
trance anthem, landed on an acoustic act's song list. A genre guess made from where an
act plays, not what it plays, puts songs on the page that the act would never play.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Ten fixed world bar classics, then ten bar classics of the act's country (the model names them); the fixed American ten when the country is the US or unknown | Less tailored to the act's genre | Two fixed lists in `_fai.mjs` | A non-US country's ten are still model-picked, but bounded to "bar classics", never club music |
| B | Keep 0167, forbid dance music in the prompt | Nothing | None | The next wrong guess is a different genre |
| C — do nothing | Leave the genre guess | Nothing | None | More pages that look careless to the artist we are pitching |

## What was chosen, and why

The user's call, on seeing Adagio for Strings on the page. Bar songs are what a covers act
plays and what a room votes for, whatever the act's own genre. A fixed world ten cannot be
wrong in the way a guess can. Ten of the act's own country keeps the page local. With no
country to go on, the default is the American bar canon.

## What this makes harder

A metal band or a jazz trio gets the same singalong list as everyone else, until they edit
it. The genre and its neighbours are no longer stored on the sample record (`songs.country`
is stored instead).

## What would reverse it

Artists claiming their pages and deleting most of the suggestions, or the user asking for
genre-aware lists again.

## How it was verified

`sh test/run.sh` was green: 33 passed, 0 failed. `test/factory.mjs` checks the following:
- the ten world songs come first, in order;
- the ten of the country follow, with nine refused and repaired once;
- the prompt carries no genre;
- a US act and an act with no known country get the American ten with no model call;
- a setlist song is never repeated.

The live model's choice of Thai bar classics was not checked before the merge.
