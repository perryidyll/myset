---
id: 0132
title: Every dashboard number was audited on 1 Oct 2026, and each one that was wrong or stale now says what the code and the data say
date: 2026-10-01
status: decided
decided_by: claude
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/everyshow.mjs, test/stripefees.mjs, finance/model-test.mjs]
files: [finance/model.html, finance/shows.html, netlify/functions/_showcosts.mjs, netlify/functions/_register.mjs, netlify/functions/mediadash.mjs, public/mediadash.html, public/dash.html, public/crm.html]
---

> **Answered 2026-10-01 (decision 0133):** the four open questions below were answered by the founder: Stripe's card fee is the artist's on an artist's night; Netlify is priced with tax ($5.48 a pack); the Current Show Stats task is off; the meters were re-read (2.72 credits a show).

## The question

The founder, 2026-10-01: run a full audit "through every formula and number in every cell
of every table/graph of every dashboard", and make certain everything is correct and up to
date. Seven independent passes read the money model (engine, then prose and tier table),
the Show log (server math, then the page), the CRM, the Media Dash with the hub, and the
providers' own price pages. They changed nothing; this record is what was then fixed.

## The options

1. Fix only arithmetic slips. There were almost none: every rendered number equalled an
   independent recomputation. The faults were stale prose, labels that said more than the
   math, and rules that had moved in the code but not on the page.
2. Fix everything that is unambiguous, and put the questions that are the founder's to him.
   Chosen.
3. Also re-define "MySet profit" for connected artists. Not done here: see "left open".

## What was chosen, and why

Fixed, because the code or the data already settles each one:

- **The free plan is ten shows in total, ever (0120)** — the model still capped it at four a
  month. The engine no longer refuses nights inside a month; `freeCap` (now 10, held to
  `_plan.mjs` by a test) says how long an artist can stay free. The Plus crossover moves
  from $418.77 to $56.60 of room money a month, because a free artist plays the same nights.
- **Payouts follow the plan (0080)**: Hobbyist every Monday, paid plans daily. The engine
  caps a free artist's payouts at a month's Mondays.
- **The cut is on merch goods, never postage** (`pay.mjs` already charges it that way):
  `_showcosts.mjs` and both tier tables take the order's amount less its postage (an order
  from before the shop page has no goods figure; its whole amount is goods).
- **A row whose detail is gone** (none in production) carries its tips as dollars and can
  never show a negative pack count, the next time it is folded.
- **Show log totals add up**: the Total column and the Costs tile are the server total plus
  the Stripe total (server is priced on every counted night, Stripe only where money is known).
- **Plan fee after Stripe is whole cents** in the shared tier formula ($18.75 + $1.25, not
  $18.76 + $1.25).
- **Prose that the live data had passed** now reads the live register instead of a typed
  number: the "$85 across 82 phones" line, "eleven nights", "1 artist today", the 20-phone
  gig label, the per-dial "from N real shows" notes (meters say meters).
- **Background jobs** are what an empty day measures (3,200 requests, 1.7 credits of compute,
  19 Sep), not 22,000 calls a month.
- **Published rates re-read 1 Oct 2026**: all current except Stripe's second $15 dispute
  fee (countered and lost, since June 2025) and Vercel Pro's included 1 TB / 1M requests
  (since 8 Sep). The open line is decision 0035, not 0036.
- **The sizes table marks a room past the plan's cap** (50 / 300 / 2,000 phones).
- **Media Dash**: one row per post id (a deleted duplicate reel counted twice: 27 posts and
  873 views for 26 and 792, reel median 60 for 22); real publish time in "Posted"; a
  followers line from the pulls; dates that do not slip a day west of UTC. The content
  engine's ledger now honours a retraction (`myset-content` 129ef10).
- **CRM**: funnel rails are a true rate (the share of the previous stage that also reached
  this one, no clamp); the drawer's tag count; filter counts follow the segment and search;
  "ago" always rounds down; "This month" says UTC.
- **Show log small ones**: requests "played" uses played; the week chart uses the night's
  local date; the plan-fee total takes each artist's latest plan; the drawer no longer
  shows the artist's money less MySet's costs (nobody's figure).

Left open, for the founder:

1. **Whose Stripe fee is in "MySet profit".** On a connected artist's night the card fee is
   the artist's (ACCOUNTING.md; the engine's own tier table); `_showcosts.mjs` and both tier
   tables subtract it from MySet's cut, by the founder's word of 2026-10-01. True for his own
   platform-account nights (every counted night so far), not for a paying artist.
2. **The price of a credit**: $5.00 for 500 (the pack) or $5.48 (the invoice, with tax).
3. **Meters after the register's bell** (25 Sep): `creditsPerShow` 2.98 and the empty day
   predate it; both need a fresh reading off Netlify's per-day meters.
4. **A hidden record inside a split slot is not merged** with its night (`mergeSplitNights`),
   though the tracker merges it. Left as it is: merging would turn a known night's money
   unknown when the hidden shard has none, and no such night exists (merged: 0).
5. **"Current Show Stats"** — retired by 0095, still republished daily by a scheduled task,
   with hours that disagree with the Show log (268.6 against 52.4).

## What this makes harder

The model's free plan no longer has a monthly brake: a dial set to many free gigs now plays
them all, which is what the plan does until the ten are used. A saved scenario carrying
`freeCap: 4` (the old plan rule) is brought forward to 10 when it loads, with the re-read
background jobs and Vercel allowances; every scenario card is re-summarised by today's engine.

## What would reverse it

A plan change (a monthly free cap again, or a fee on postage); the founder choosing the
other answer on any of the open items; a provider re-pricing.

## How it was verified

Each auditor recomputed by hand and rendered the pages headlessly (local test data, and
production by GET only). After the fixes: `test/everyshow.mjs` 120 passed, `stripefees` 29,
`cost` 19, `hq` 166, `gmail` 159, `finance/model-test.mjs` all passed; the four pages render
locally with no console error; the Media Dash, fed production's own JSON, reads 26 posts,
792 views, reel median 22. Not verified: the live Show log (behind its passcode).
