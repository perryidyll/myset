---
id: 0169
title: Notes for the generator sit on CRM's Generate form, and a setlist pasted into them goes first on the song list
date: 2026-10-04
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/factory.mjs]
files: [public/crm.html, netlify/functions/hq.mjs, netlify/functions/_fai.mjs, netlify/functions/_factory.mjs, netlify/functions/factory.mjs, netlify/functions/_sample.mjs]
---

## The question

An artist sent the founder part of their setlist on Instagram. The founder wanted a sample page built from it, but the Generate form had nowhere to write instructions: "there's no where for custom instructions on the generator window". Generator notes (0136) existed only after a page was built, on Edit profile, and they were read on a rebuild.

## What was chosen, and why

- The Generate form has a **Notes for the generator** box, between Photos and More. What is written there becomes the build's notes: the same notes 0136 keeps on the seed, so a rebuild reads them again and Edit profile shows them.
- Notes hold **2,000 characters** (was 600), enough for a pasted setlist. One constant, `NOTES_MAX` in `_fai.mjs`; `crm.html` mirrors it.
- The songs call reads the notes. Every song the notes say the act plays comes back as `theirs`, in the notes' order, at most 20, with its best-known performer (the act's own name for an original). They go **first** on the song list, ahead of the 20 suggestions, and are never repeated among them. A sample keeps at most **40** songs (`SAMPLE_SONGS_MAX`, was 20).
- With the suggestions switched off, a setlist in the notes is still read, and only the act's own songs are kept.

The setlist is the one fact about a sample artist that is certain and that the room votes on. Putting it on the form, rather than a step after the build, means the first page the founder sees already has it.

## What would reverse it

Founders pasting things into the notes that should never reach a page. The notes still steer the copy only where the facts allow (0136).

## How it was verified

`test/factory.mjs` (192 passed): a setlist in the notes comes first, before the twenty suggestions; an original with no performer is credited to the act; the notes reach the songs call; with suggestions off only the act's songs are kept; notes keep 2,000 characters. The whole suite passed (5,035). The form was checked on myset.vip/crm after the merge.
