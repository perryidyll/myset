---
id: 0048
title: the pages and the static files live at the edge; the Stripe SDK loads only when money moves
date: 2026-09-12
status: decided
decided_by: claude
area: performance
reverses:
superseded_by:
invariants: [9d6]
commits: []
tests: [test/run.sh (full suite)]
files: [netlify.toml, netlify/functions/_lib.mjs, netlify/functions/_history.mjs, netlify/functions/_requests.mjs, netlify/functions/profile.mjs, netlify/functions/venue.mjs]
---

## The question

After speed pass one (0042) the founder reported repeat opens are quick but a
first open still takes 5–7 seconds on his phone, and wants 2–3 at most. Checked
on production 2026-09-12: every page open answered `cache-status: "Netlify Edge";
fwd=stale` — the edge held the HTML but went back to the origin to revalidate it,
0.6–0.9s per tap before any HTML moved; `/app.css` was `fwd=miss`. `/api/me`
answered in 2.0s cold. The read functions' bundles carried the Stripe SDK: `import
Stripe from 'stripe'` sat at the top of `_history.mjs` (in the profile, community
and artists bundles) and `_requests.mjs` (in the board, me, show and stage
bundles), so every cold start evaluated the SDK before answering a fan who wanted
a name and a photo. `/api/profile` read the profile, then five more things.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | HTML routes carry `Cache-Control: public, max-age=60, stale-while-revalidate=600` (the edge and the phone answer at once for a minute, then serve the copy for ten more while refreshing); every `json()` reply says `netlify-cdn-cache-control: no-store` outright; the Stripe SDK becomes a dynamic import in `_history.mjs` and `_requests.mjs`; profile's six reads and venue's vouches travel in one batch | a new build can be up to 60s late on a page (a deploy purges the cache, so in practice seconds) | seven header blocks in netlify.toml | a header rule caching a function reply — closed off by the explicit no-store in `json()` |
| B | one warm function for all fan reads, pinged by the cron | an afternoon; every fan read depends on one door | the merge and the pinger | one bug takes every read down |
| C | move the function region nearer the fans | a dashboard setting; the blob store may then be farther from the functions | none | five reads in a row get slower, not faster |
| D — do nothing | | | | 5–7s first opens stay |

## What was chosen, and why

A: each piece is small, independent and reversible, and together they remove the
two waits that hit every single tap (the HTML revalidation and the SDK
evaluation) rather than the one that hits only cold functions. B stays held
until this pass is measured on the founder's phone; C needs a measurement of
where Netlify Blobs actually lives before it can be more than a guess.

The header rules name the REQUEST paths (`/:slug`, `/:slug/vote`, …) because
rewrites are matched on what was asked for, not on the file behind it. `/api/*`
matches none of the seven patterns, and the explicit no-store in `json()` means
it would not matter if it did.

## What this makes harder

A page edit is not instantly visible to a phone that loaded it in the last
minute — the purge on deploy makes this seconds, not a minute, but a session
verifying a copy change on production must allow for it. Anyone adding a new
rewritten HTML route must add a header block for it or that route revalidates
like before. Anyone adding a top-level `import Stripe` to a module that a public
read imports puts the tax back; the two comments in `_history.mjs` and
`_requests.mjs` say why not to.

## What would reverse it

A stale page causing a real support case after a deploy; Netlify changing the
purge-on-deploy behaviour of the durable cache; option B landing and making the
function-side half of this moot.

## Correction, same day

The first cut set `Netlify-CDN-Cache-Control … durable` on the static routes. Measured on deploy-preview-4 and then on production: no effect — Netlify's docs say the directive is for function responses only; static files are governed by plain `Cache-Control`, and the edge copy is invalidated by every deploy anyway. Replaced with `Cache-Control: public, max-age=60, stale-while-revalidate=600` on the HTML routes; the css/js/img blocks keep the browser-side values they already had.

## How it was verified

`sh test/run.sh`: 44 files, 2128 assertions, 0 failed (on a tree that also held
another session's uncommitted work; only this session's hunks were staged).
`node --check` on every touched function. Production measured with curl AFTER the
push — see the session note for the numbers. NOT verified on a phone.
