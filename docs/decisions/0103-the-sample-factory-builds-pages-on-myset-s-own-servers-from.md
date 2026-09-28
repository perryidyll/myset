---
id: 0103
title: The sample factory builds pages on MySet's own servers from YouTube, the act's website and Claude, and never scrapes Instagram
date: 2026-09-28
status: decided
decided_by: user-confirmed
area: ops
reverses:
superseded_by:
invariants: [0go]
commits: [c940a6e]
tests: [test/factory.mjs, test/samples.mjs]
files: [netlify/functions/_fsrc.mjs, netlify/functions/_fai.mjs, netlify/functions/_factory.mjs, netlify/functions/factory-background.mjs, netlify/functions/factorycron.mjs, netlify/functions/factory.mjs, public/factory.html]
---

## The question

Decision 0101 says what a sample page is; this one says where they come from. The blueprint proposed a small app on the founder's Mac, forked from Wellmee's Python generator, with the founder pasting Instagram bios and photos by hand. The founder (2026-09-28): "for the factory, do whatever you think is best long term — I'd like for this to eventually run 99% automatically at scale (hundreds per month if not thousands eventually)", YouTube thumbnails first "but only if they're judged to be genuinely good… otherwise taking them from IG or websites is perfectly fine — I'll take responsibility", the review "will definitely do in the beginning but don't make that a hard rule", and a venue engine for the places he plays.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Node inside MySet: a queue in Blobs, a background worker (15 min) per page, a five-minute ring that drains the queue within a daily cap and runs the samples' clock, Claude through its HTTP API, YouTube through its Data API, websites, MusicBrainz, iTunes and OpenStreetMap by plain fetch. The founder's console at `/factory`. | Claude per page (an estimate is shown on every job; list prices put it around ten to fifteen cents); Netlify function time; one free YouTube key. | Seven new files, two keys, no dependency. | A bad build — held by the quality gate and the review switch. |
| B | The blueprint's Mac app, a Python fork of Wellmee. | Nothing hosted. | A second language and a second codebase; runs only while the Mac is awake. | "99% automatic" stops at a closed laptop lid. |
| C | Scrape Instagram through a logged-in browser at scale. | — | A headless browser and an account to drive it. | Against Instagram's terms; the account it runs on is flagged — the founder's or MySet's. |
| D — do nothing | Pages made by hand. | The founder's evenings. | — | A few pages a week at most. |

## What was chosen, and why

A. Running where the site runs is what "99% automatic" needs: nothing to keep awake, the samples written straight into Blobs, one language and one codebase with the rest of MySet, and no dependency (the two stay two). Photos are never cropped on the server — there is no image library — and do not need to be: the vision judge returns a focus point and the page positions the picture on it (the profile's `focus`, decision 0101), and a picture too big is swapped for a smaller variant the site already publishes, or dropped.

One job, eight stages, each reported to the console as it starts: the seed line; suppression (anyone who pressed Remove is never built again, checked before any fetch and again later); discovery (Claude with web search finds the official profiles, a link kept only when the name and at least one more signal agree); collection (YouTube's channel and top videos by views and recency — never `search.list`, which costs a hundred units; the act's website, obeying robots.txt, refusing private addresses; MusicBrainz, iTunes, and OpenStreetMap for venues); facts (Claude, every fact citing the numbered source it came from); photos (Claude with vision scores every candidate — is it the act, sharp, well lit, how much text is burned in — and the ladder the founder chose: YouTube frames first when they pass, then the website, and Instagram photos only as the founder adds them by address); copy (a tagline, a style, a two-to-four-sentence bio, and one true line to open a DM with; every sentence names its facts or is dropped, hype words and invented numbers are refused); the gate (weighted checks — name, identity, a cover that passed, a portrait, a sourced bio, links, media — review when the score or the identity is under 0.85 or no photo passed).

The review is a switch, not a rule: off (the default), every page waits for the founder's look; on, a page that passes the gate goes straight to Ready. The daily cap (`factorycfg.perDay`) is the ceiling on what Claude costs, one number whether a build starts from the ring or the Build button.

Instagram is never scraped by the server. Its terms ban automated collection and it flags accounts that behave like bots. At the founder's scale the photos come from YouTube and websites; Instagram photos come in by hand — the founder, or a Claude session working through the founder's own Chrome at a person's pace — through the console's *Add a photo by link*, which fetches the picture itself, checks its bytes and stores it under the sample's own name.

Venues run the same machine with their own sources: the venue's website (JSON-LD opening hours, address, telephone), OpenStreetMap, a Google Maps link as a plain link (never the Places API, whose terms forbid keeping its data), and the venue's own copy rules.

The outreach drafts live in `factory.mjs` (`messagesFor`); decision 0101 records what they must say. They are sent by hand: MySet's mail sender carries every account's sign-in codes and must not be put at risk by cold mail.

## What this makes harder

Two keys to keep (`ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`); a model name or a price that changes means editing `_fai.mjs` (both are constants, overridable by environment for the model). MusicBrainz asks for one request a second and the pacing is per worker, so three builds at once can be refused there — which only means no MusicBrainz result. Acts whose presence is Instagram-only build thin until a photo is added by hand.

## What would reverse it

Claim rates that do not justify the spend (then lower the cap, or build only after meeting someone); Claude's quality on real acts falling short of the founder's bar (then review stays on); Meta granting an approved route to act photos, or YouTube's terms on thumbnails changing.

## How it was verified

`node --import ./test/register.mjs test/factory.mjs` — 146 checks, all offline against fakes: fourteen seed shapes; robots.txt precedence, a site naming MySetBot, a 503 as keep-out; eleven private-address forms, a name resolving privately, a redirect to a private address; image signatures, the 900 KB edge, the Squarespace, WordPress and srcset fallbacks; one repair retry then a clear error, no retry after a timeout, the web-search fallback and a paused search resumed; unsourced sentences and invented numbers dropped; the photo ladder; the gate's review cases; suppression before any request and after discovery, through the real `_sample.mjs`; a whole artist job and a whole venue job; the worker's key, its done / skipped / requeued / failed / cancelled paths and at most one progress write per stage; the ring's three-a-ring, the daily cap and its reset, stuck jobs, the lock and the gap. Live, read-only: a page fetch, a YouTube thumbnail parsed as 1280×720, a frame-grab address, the cloud metadata address refused. The console walked against the real endpoint on localhost (the list, the funnel, the Messages sheet).

Not checked: real Claude answers (no key yet), so the quality of real discovery and copy is unknown until the first ten; the second web-search tool version; the background suffix, the schedule and the bundling on Netlify itself.
