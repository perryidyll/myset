---
id: 0003
title: The free tier is capped by gigs played, not by features
date: 2026-09-03
status: decided
decided_by: perry
area: plans
invariants: [0cr, 0da]
commits: []
tests: [test/limits.mjs, test/plans.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/admin.mjs]
---

## The question

A free tier has to be survivable at a thousand artists or the $10/month business does
not exist. Something has to be limited. Which thing?

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Cap shows per calendar month (4)** | Limits the real cost driver | A hobbyist is fully served for free; a working musician pays | a stored per-show month stamp | An artist is refused a show on a night they are standing on stage |
| B — cap features | The usual SaaS answer | Saves nothing: cost comes from phones polling during a gig, not from which buttons exist. And it punishes the artist who is least able to pay | none | Free tier still costs whatever a big free gig costs |
| C — cap the audience | Also a real cost driver | Refuses a person standing in front of a musician — see decision 0006 | a head-count gate on the vote path | Reads as punitive at exactly the wrong moment |
| D — no free tier | Simplest to reason about | No way in for the artist MySet exists for | none | No adoption |

## What was chosen, and why

A. Every phone in the room polls for the whole gig, so what MySet costs to run is
driven by **gigs played**, not by artists signed up. Capping free on the real cost
driver is what makes free survivable. Four shows a month is a hobbyist; five is
somebody earning from it.

Counted in **UTC calendar months**, resetting on the 1st, and **stamped onto the show
record** — so what the Studio shows and what the server enforces are computed the same
way and the count cannot be fudged from a phone.

It was briefly two a week (2026-09-03) and Perry changed it straight back to four a
month the same day.

## What this makes harder

The number now appears in five places that must move together: the Studio's Live-tab
warning, the founder's note under Your plan, both refusal messages in `admin.mjs`, and
this document. The tests read `PLANS.free.gigs` rather than repeating it, which is what
keeps the drift down to copy.

## What would reverse it

The shared-board fix landing (which changes what a gig costs) or evidence that four is
turning away artists who would have paid. Both are measurable.

## How it was verified

`test/limits.mjs` asserts every plan flag not named in `NOT_BUILT` is genuinely enforced
somewhere on the server, and reads the gig number from the plan table rather than
repeating it.
