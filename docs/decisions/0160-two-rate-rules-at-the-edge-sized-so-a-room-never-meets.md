---
id: 0160
title: Two rate rules at the edge, sized so a room never meets them
date: 2026-10-03
status: decided
decided_by: perry-confirmed
area: scale
reverses:
superseded_by:
invariants: [9d]
commits: []
tests: [test/roomsize.mjs]
files: [netlify.toml]
---

<!--
  FRONT-MATTER FIELDS

  id           four digits, in order. ./tools/decide.sh picks the next one.
  title        what is now TRUE, not what was done. "A vote never comes back",
               not "changed the vote logic".
  status       proposed | decided | superseded | reversed
  decided_by   perry | claude | perry-confirmed   (who actually chose — this matters
               later, because a decision Perry made is not one to re-litigate)
  area         voting | plans | money | storage | auth | media | scale | ops | ui | docs
  reverses     the id of a decision this overturns, if any
  superseded_by  filled in later, by whatever replaces this
  invariants   the INVARIANTS.md ids this created or changed
  commits      short hashes
  tests        the suites that would fail if somebody undid this
  files        the files where this decision physically lives

  Delete this comment when you fill the template in.
-->

## The question

MySet had no rate limiting at Netlify's edge. Every request to `/api/*` runs a
function and is billed (2 credits per 10,000 requests, plus compute), and when the
team's credits run out Netlify pauses every site on it. The 2026-10-02 scale audit's
point: one laptop could spend the credits at will. The plan (Personal) allows two
rate rules, per address, with a window of up to 180 seconds.

The founder's word (2026-10-02): add the two rules.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `/api/*` at 60,000 a minute per address; `/api/auth` at 300 a minute per address | Nothing | Two blocks in `netlify.toml`, one test | A cap set too low blocks a whole venue's wifi for a minute — the test ties the cap to the poll floors |
| B | A tight cap on `/api/*` (the docs' example is 50 a minute) | Nothing | Same | A venue's wifi is one address: 200 phones make 8,000 requests a minute. This would end gigs |
| C | A cap on the artist page route `/:slug` | Nothing | Same | The printed QR code points there; a room scanning at once comes from one address |
| D — do nothing | | Nothing | None | One machine can pause every site |

## What was chosen, and why

A. The rule on `/api/*` is deliberately loose: it has to clear the largest room on
one address at every poll floor, with every phone on the fastest rung — 8,000 a
minute for 200 phones, 36,000 for 3,000, 30,000 for 5,000, 60,000 for 10,000. So it
never sees a room. What it does is cap one machine at 1,000 requests a second, which
bounds what a flood can spend to about 12 credits a minute in requests.

`/api/auth` is the door a script guesses at, and a person types into. 300 a minute
per address is far above a workshop of artists signing up together and far below a
guessing run. The account-level lockouts stay as they are.

The specific rule sits above the general one, because the first redirect that
matches is the one whose limit counts.

## What this makes harder

Lowering a poll floor, or raising how many requests a phone makes per tick, now has
a ceiling to respect. `test/roomsize.mjs` fails if the sum no longer fits.

## What would reverse it

- Moving to Pro (five rules) or to a plan with per-domain aggregation: add rules,
  do not tighten this one.
- A real room being blocked. Netlify answers 429 for a minute; the vote page backs
  off and keeps its board (decision 0143), so it would show as a stall, not a blank.

## How it was verified

`node --import ./test/register.mjs test/roomsize.mjs` — 46 passed, 0 failed: both rules
are present, the specific one first, and the cap clears 200, 3,000, 5,000 and
10,000 phones on one address.

**Not checked:** that Netlify accepts a `window_limit` this large and enforces it
as documented. The deploy preview shows whether the file is accepted; enforcement
was not provoked, because doing so means sending over 60,000 requests in a minute.
