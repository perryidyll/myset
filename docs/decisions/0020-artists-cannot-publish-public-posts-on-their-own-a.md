---
id: 0020
title: Artists cannot publish public posts on their own artist page except the founding account
date: 2026-09-10
status: decided
decided_by: perry
area: auth
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/community.mjs]
files: [netlify/functions/community.mjs, public/community.html]
---

## The question

Community comments should represent fans rather than let artists manufacture activity on their own profiles, while preserving the user's explicit founding-account exception.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Hide the composer and reject self-posts server-side | One authentication check | A `canPost` response field | A client-only rule could be bypassed |
| B | Hide only the composer | Cheapest UI | None | Direct API calls still create posts |
| C — do nothing | Allow artist self-posts | Nothing | None | Community trust is weakened |

## What was chosen, and why

The server identifies a signed-in artist and rejects new posts and clip uploads to that artist's own page. The founding artist ID is explicitly exempt. Other artists may still comment on pages they do not own.

## What this makes harder

An artist who wants to announce something must use an artist-owned publishing feature rather than impersonating a fan post.

## What would reverse it

Revisit if MySet introduces clearly labeled artist posts distinct from fan comments.

## How it was verified

`test/community.mjs` proves the composer signal is false for a signed-in owner, the server returns 403 for a self-post, and the founding-account exception still posts successfully.
