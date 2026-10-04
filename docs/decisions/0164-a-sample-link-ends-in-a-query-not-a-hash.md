---
id: 0164
title: A sample link ends in ?sample-profile, not #sample-profile
date: 2026-10-03
status: decided
decided_by: perry-confirmed
area: ui
reverses:
superseded_by:
invariants: []
commits: [e4b23a5]
tests: [test/samples.mjs, test/hq.mjs]
files: [netlify/functions/_sample.mjs, netlify/functions/_crm.mjs, netlify/functions/factory.mjs, netlify/functions/hq.mjs]
---

## The question

A sample link sent in an Instagram DM opened as "No page here". Instagram's in-app browser dropped the `#sample-profile` part, so the page saw a bare address, which by 0101 is the ordinary "no such page".

## The options

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **A — chosen** | The link the CRM hands out ends in `?sample-profile`; the preview is `?pv=1&sample-profile`. The pages already read both forms | Four lines | Links sent before today still end in `#` |
| B | A bare address opens a sample whenever one exists | A second request on every unknown address | Reverses 0101: a stranger finds samples by guessing names |

## What was chosen, and why

A. A query string reaches the page through Instagram's redirect; a fragment did not. The pages (artist.html, venue.html, sample.js) have read `?sample-profile` since 0101, so no page changes and old `#` links still work wherever the `#` survives.

## What would reverse it

- An app that strips query strings from links.

## How it was verified

- The full suite exits 0 with the link and preview checks updated.
- `https://myset.vip/andrew?sample-profile` answers 200 with the artist page.
- NOT checked: a tap from an Instagram DM after the deploy (the founder's phone).
