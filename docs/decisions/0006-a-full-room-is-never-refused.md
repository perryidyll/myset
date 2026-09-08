---
id: 0006
title: A room that is over its plan's size slows down; nobody is ever refused
date: 2026-09-05
status: decided
decided_by: claude
area: scale
reverses: 
invariants: [0ej, 0ek, 0el, 0em, 0en, 0eo]
commits: [421d5ac, 9e9fde4, bcaf9a1]
tests: [test/roomsize.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/show.mjs, netlify/functions/_plan.mjs, public/vote.html]
---

## The question

Perry: *"let's set up a limit to how many people can enter your gig! that's an easy
fix!! to the potential of 10000+ people at one arena show signing in … and the entire
app collapsing."* He was right that it needed doing. The first thing built was a hard
door: person 501 at a Plus gig becomes a read-only watcher.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| A — a hard door | Bounds the room exactly | Refuses a person standing in front of a musician, mid-song | a spectator state on every surface | The artist's best night is the one where MySet told fans no |
| **B — chosen. Soft cap: the server sets the polling pace and shortens the board** | Room degrades instead of breaking; cap becomes a billing line | Some phones see a shorter list | `pollFloorFor()`, `boardLimitFor()`, `nextPollMs` in the payload | A fan cannot find their song and thinks the vote was lost |
| C — nothing, and sell it anyway | No work | Breaks at ~1,000 people, on reads, not on cost | none | A booked show fails live |

## What was chosen, and why

B, and the research is the reason. **Mentimeter publishes the opposite of a hard door
as policy, verbatim:** participants may exceed the limit during a live session without
interruption, with an 8-hour grace period, and the cap bites on the NEXT one. YouTube's
only hard caps anywhere in Live chat are on **spend** and on **attention** — there is no
plan anywhere that caps how many people may watch.

So the door came out. `PLANS.*.audience` (200 / 1,000 / 2,000) is stamped onto the show
when the night starts, so an artist who upgrades mid-set does not have the room change
size underneath them. **There is no head-count check in `vote.mjs` and no spectator
state anywhere** — `test/roomsize.mjs`'s important assertions are the negative ones.

**Where MySet actually breaks is reads, not money.** Every poll re-reads the whole
audience bag, so 100× the people is 10,000× the internal traffic — 5.1 GB/s at 10,000
phones. The $36.40 the simulator quoted for 10,000 people was what it would cost *if it
worked*.

And the board **shortens and says so**: anything this fan voted for is concatenated back
regardless of rank, because a song that silently vanishes reads as a lost vote, not as a
shorter list.

## What this makes harder

The plan numbers are now an engineering ceiling described as a product tier. Slido at
the same capacity is five times the price and Mentimeter sells unlimited participants at
$11.99 — so the caps are a necessity, not a market convention, and have to be described
that way rather than defended as generosity.

Pro came **down** from 3,000 to 2,000 after the arithmetic was corrected: 3,000 puts
internal read traffic at 137 MB/s, nearly three times the busiest room MySet is known to
serve. Sell what the app can do.

## What would reverse it

The shared-board fix (one cached room state instead of a full read per phone). That is
what raises the tier numbers, and **raising them is gated on it, not on money.**

## How it was verified

`test/roomsize.mjs` — 38 assertions. `tools/loadsim.py` walks the real polling ladder.
Measured over the real loop for a 3-hour gig, after also splitting `signature()` so a
stranger's vote no longer resets every phone to the 3-second rung: 20 people 2.8¢ → 2.7¢;
1,000 people $2.76 → $0.98; 10,000 people $36.40 → **$4.29**, and 119.2M blob reads →
13.2M. The honest ceiling moved from ~1,000 people to ~2,500.
