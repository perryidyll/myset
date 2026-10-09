---
id: 0163
title: A sample's tagline is written in the magazine voice too
date: 2026-10-03
status: decided
decided_by: perry
area: ui
reverses:
superseded_by:
invariants: []
commits: [b32291a]
tests: [test/factory.mjs]
files: [netlify/functions/_fai.mjs]
---

## The question

0161 kept the tagline plain so it could be read at a glance beside the name. On Andrew's page the founder called the plain one "a super lame one-liner". It was hand-rewritten in the About's voice, and the founder asked for the generator to write every tagline that way.

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | The tagline instruction asks for the same magazine voice as the bio (acts) and the about (venues): what they play and where, with a little colour from a fact. One invented example sets the voice | Two prompt lines | A line too long to read at a glance |
| B | Keep it plain and hand-edit taglines the founder cares about | None | Every sample opens with a flat line |

## What was chosen, and why

A. The 120-character cap, the citations, the facts-only rule and the no-hype list are unchanged, so the line stays short and true. The style line (genre words joined by " · ") stays plain: it is a label, not a sentence. The example is an invented artist, as in 0161, because the repo is public.

This revises 0161's "the tagline stays plain"; the rest of 0161 stands.

## What would reverse it

- Taglines that read as a joke before they say what the act plays.
- Artists who object to the tone.

## How it was verified

- `test/factory.mjs` checks that the act and venue copy prompts ask for the tagline in the magazine voice, still from a fact.
- The full suite exits 0.
- NOT checked: a real (paid) generator run. Andrew's tagline was hand-written in this voice on production on 2026-10-03.
