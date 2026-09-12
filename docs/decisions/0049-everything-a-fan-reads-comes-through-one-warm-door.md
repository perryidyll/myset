---
id: 0049
title: everything a fan reads comes through one warm door
date: 2026-09-12
status: decided
decided_by: perry
area: performance
reverses:
superseded_by:
invariants: [9d6]
commits: []
tests: [test/fandoor.mjs, test/run.sh]
files: [netlify/functions/fan.mjs, netlify/functions/autocron.mjs, public/artist.html, public/vote.html, public/community.html, public/venue.html]
---

## The question

After speed passes one and two (0042, 0048) the founder's first open of a fan
page on a quiet site was still ~4–5s, and the measurements said why: each of the
six public reads is its own function on Netlify, each falls asleep on its own,
and the first call to a sleeping one costs ~1.5s more than a warm one (`/api/me`
2.06s cold, 0.57s warm, 2026-09-12). A first open woke two or three of them.
Keeping six programs awake on a schedule is six pings a tick; the founder was
given the cost of that (26–60k calls a month) against the alternative and chose
the alternative: one door.

He also asked to move photos off `/api/img`. Looked at: `img.mjs` already
answers `cache-control: public, max-age=31536000, immutable` AND
`netlify-cdn-cache-control: public, durable, …, immutable`, keyed by the `?v=`
stamp that changes on every upload — a photo is read out of Blobs by a function
once per version for the whole world, and the Image CDN transforms it from that
copy. Moving the bytes to R2 would need a public bucket or custom domain set up
by the founder and would remove no measurable wait. Not done; recorded here.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `fan.mjs` imports the six handlers and picks one by `what=`; the four fan pages ask `/api/fan?what=…`; autocron GETs `?what=warm` every fourth minute (~11k calls a month); the old addresses stay up | one larger bundle; every fan read shares one function's fate | `fan.mjs`, the ping, `test/fandoor.mjs` | a bug in the door takes every fan read down — mitigated by the door being a switch with no logic of its own, and the old addresses still answering |
| B | ping the six functions separately | 26–60k calls a month | six pings | billing |
| C | move the function region nearer the fans | a dashboard setting | none | the blob store may be farther from the functions than the fans are |
| D — do nothing | | | | quiet-site first opens stay 4–5s |

## What was chosen, and why

A — the founder's call ("let's do the one-warm-door merge"). The door has no
logic: it is a lookup table in front of the same modules the old addresses run,
so the answer through it is byte-for-byte the old answer (the test holds
profile and me to that) and each handler's own cache headers travel with it —
`profile`, `events`, `venue` and `board` are still kept at the edge under their
new URL, `me` and `community` are still never kept (9d6: the URL, including
`what=`, is the whole key). The old addresses are kept for pages a phone cached
before the switch and for `index.html`/`artists.html`, which another session
had open and were not touched.

## What this makes harder

Adding a seventh public read means adding it to the door, or it goes cold on
its own again. The bundle behind `/api/fan` is the union of six; a slow import
in any one of them slows the cold start of all — the same reason the Stripe SDK
was taken off the top of `_history.mjs` and `_requests.mjs` (0048). The cache
key changed for `board`: an edge copy made under `/api/board?a=` is not the one
under `/api/fan?what=board&a=`, so for one interval after the switch the room
pays two renders instead of one.

## What would reverse it

Netlify pricing the warm ping above what the site earns; an incident where the
door fell and every fan read with it; a smaller cold start making the ping
pointless (measure `what=warm` cold vs warm after the deploy).

## How it was verified

`test/fandoor.mjs` 22/22: the ping reads nothing and is never cached; an unknown
`what` is a 404; `profile` and `me` through the door match the old address
(status, body, cache headers); the four pages and autocron reference the door.
`sh test/run.sh` 2157 assertions, 0 failed. Production timings after the
deploy are in the session note. NOT verified on a phone.
