---
id: 0161
title: A sample's About is written in a magazine voice, with a wink of humour
date: 2026-10-03
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: [72dbe98]
tests: [test/factory.mjs]
files: [netlify/functions/_fai.mjs]
---

## The question

The generator wrote every About "plain, warm and concrete". Andrew's read like a résumé. The founder asked for a rewrite "like how a magazine would write it to feature an artist", liked the result, and asked for the generator to write that way too. A sample page is a pitch the artist rewrites once they claim it, so it can show some personality.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | The bio and venue-about instructions ask for a music magazine's voice: lively, a little playful, one wink of humour, built on the facts. One invented example sets the voice, with an instruction to vary the words and shape | Two prompt lines | Jokes that miss; every page shaped alike |
| B | Keep the plain voice and hand-edit pages the founder cares about | None | Every sample reads flat, and the founder rewrites by hand |
| C | A separate "make it fun" pass after the facts are written | One more paid call per page | Twice the cost for a tone change |

## What was chosen, and why

A.
- The rules that keep a page true stay the same:
  - every sentence cites its facts;
  - only what the facts say;
  - no hype words;
  - two sentences, 360 characters.
- The humour sits in how a fact is said, never in an invented one, and the prompt says so.
- The tagline and style line stay plain. They sit beside the name and need to be read at a glance.
- The prompt's example is an invented artist, so no real person's words are copied onto every page. It asks for a different shape each time.

## What would reverse it

- Artists who object to the tone of a page written about them.
- Bios that start to bend facts for the sake of a joke.

## How it was verified

- `test/factory.mjs` checks that the artist and venue copy prompts ask for the magazine voice and still require only the facts and two sentences.
- The full suite exits 0.
- NOT checked: a real (paid) generator run in the new voice. Andrew's About was hand-written in this voice on production on 2026-10-03, and the founder approved it.
