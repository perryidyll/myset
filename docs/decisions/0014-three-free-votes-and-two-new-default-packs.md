---
id: 0014
title: Every room on the former voting defaults moves to three free votes and the two new packs
date: 2026-09-08
status: decided
decided_by: user
area: voting
invariants: [0ad, 13]
commits: []
tests: [test/defaults.mjs, test/tenancy.mjs, test/credits.mjs, test/copy.mjs, tools/uicheck.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/show.mjs, public/vote.html, public/studio.html]
---

## The question

The user set new defaults for the free allowance and the two vote packs, and asked for
the audience page to make both the allowance and the path to buying more explicit.
The first implementation changed the source defaults but an existing show document
still stored and served the former values. The counter therefore also had to distinguish
free votes from bought votes, and the stored-default transition had to be explicit.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Version the voting defaults; migrate exact former defaults on read; preserve other choices; label the free `x/x` counter; offer purchase from the empty-wallet sheet | Less free participation and a small normalization branch | One version field and two explicit free-allowance fields in the existing show payload | Migrating an intentional choice that happens to equal a former default |
| B | Change only the source defaults and UI | Minimal engineering | None | Existing rooms keep serving five indefinitely, which is what the first preview exposed |
| C — do nothing | Keep 5 free, 5 for $5, and 15 for $10 | None | None | The product continues with defaults the user explicitly replaced |

## What was chosen, and why

Option A, because the user specified that three must apply globally, while paid artists
must retain the ability to choose another value. An unversioned stored value equal to a
former default migrates; a non-default value survives. The next ordinary show write
persists version 2, so any later paid choice—including choosing five—is never migrated
again. The server sends the free allowance separately from the combined wallet.

## What this makes harder

The header no longer communicates a fan's total spendable wallet by itself. A deliberate
old value identical to the former default cannot be distinguished from an untouched
default and migrates once; the artist can set it again on a paid plan.

## What would reverse it

The user changing the commercial defaults again, or real-gig evidence showing that three
free votes does not give a new fan enough participation to understand the game.

## How it was verified

`test/defaults.mjs` starts from raw legacy documents and checks migration, preservation
of non-default choices, version persistence, and a later choice of five. `test/tenancy.mjs`
checks that free artists cannot change pricing while a paid artist can, plus the 3-vote
allowance, 2/3 after one cast, separate free-balance fields, and both default packs.
`test/credits.mjs` confirms later allowance changes do not consume bought votes.
`test/copy.mjs` pins “votes” after the counter and “Buy more votes” in the empty-wallet
sheet. `tools/uicheck.mjs` opens that sheet at phone width and checks the rendered
counter and purchase action. The complete suite has 1,735 passing assertions. Draft
deploy `6aa041448e6b1e3af49326be` was read back against the existing stored room and
returned 3/3 free votes, 3/$5, and 15/$20.
