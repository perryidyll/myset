---
id: 0174
title: The city index carries each owner's gigs in that city — the front door is one read, a feed reads only who is on, a venue page only the artists who name it; a daily bell heals a lost write
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: storage
reverses:
superseded_by:
invariants: [0in, 0i, 0dh]
commits: []
tests: [test/citycounts.mjs, test/featured.mjs, test/gigok.mjs, test/rsvp.mjs, test/fandoor.mjs]
files: [netlify/functions/_events.mjs, netlify/functions/events.mjs, netlify/functions/venue.mjs, netlify/functions/citycron.mjs, test/citycounts.mjs, test/run.sh]
---

## The question

Three public reads walked every owner in a city, inside `/api/fan`, the function that also serves live rooms (decision 0088):

- **The front door's picker** counted each city's gigs by reading up to forty calendars a city, one after another.
- **A city's feed** read every owner in the city, one after another, and read the whole artist registry once per owner (`artistById`).
- **A venue page** did the same for the first sixty artists in its city, and silently dropped the sixty-first.

Once a walk timed out, nothing was cached at the edge, so every visit walked again and held a slot the live rooms needed. The scale audit of 2 October 2026 put the end at about 130 to 240 artists, and named the fix: *keep counts per city when a calendar is saved.*

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The write that puts an owner in a city (`reindexCities`, the same compare-and-set) keeps that owner's rules there beside the id: date, time, zone, length, repeat, skipped nights, venue. Readers work out counts and windows from the rules and the clock. A daily bell re-points every owner from their own calendar | About 230 bytes an owner and city on `cityindex` (one weekly rule); one heal pass a day | `gigs` on `cityindex`; `placeGigs` / `upcomingAt`; `healCityIndex` and its bell, `citycron` | A lost write leaves an owner's rules stale for up to a day — the same as the membership it rides with, which nothing healed before |
| B | Store counts (`{count, nextAt}`), as the audit suggested | Smaller | The same bell, but it must run before every count goes stale | A count is true for a moment: it needs re-working every time a gig passes, and a missed ring shows wrong numbers. Rules need no topping up |
| C | One document per city with its owners' rules | The picker would read one per city | A key family per city | The picker is the hot one; it would be back to N reads |
| D — do nothing | | | | A marketing spike on the front door at a few hundred artists times out every visit and takes slots from live rooms |

## What was chosen, and why

A.

- **Rules, not nights or counts.** A weekly residency never runs out, so nothing has to come back and top up a count. The count is worked out at read time, in memory, over the same window the feed has always drawn: the owner's own yesterday to seven days ahead, not yet over. The owner's zone (`tz`) rides with the rules, so "today" means what it meant before.
- **The same write.** Membership and rules are put in one compare-and-set, so they can never disagree. A rule that can never be on again (a one-off more than two days gone, a repeat whose end has passed) is left out, and so are past skipped nights. An owner still in a city for a one-off a few days gone has an empty rule list: known, and nothing on.
- **The picker is one read.** Each city's count is that city's gigs only. Before, an owner with gigs in two towns had all their gigs counted in both.
- **A feed reads only who is on.** An owner whose rules have nothing in the window is not read at all. The registry is read once, not once per owner. The calendars that are read go side by side, eight at a time (`inTurn`). The nights shown still come from the calendars themselves, so a feed is as fresh as the calendar.
- **A venue page reads only the artists who name it.** The match is `sameVenue` on each rule's venue. No sixty-artist cut for an artist the index has rules for.
- **Nothing goes missing on the day it ships.** An owner the index has no rules for yet (written before this) is read the old way: the picker reads their calendar, a feed reads them, a venue page reads up to sixty of them. The first heal, within the hour, writes everyone's rules.
- **The heal (`citycron`, hourly).**
  - Once a day it walks every owner on the two registries, eight calendars at a time, inside its budget, carrying on from `heal.cursor`, and makes one write a ring. A ring after a finished pass is one read.
  - An owner whose rules were written by a save **after** the heal read their calendar is left alone, because the save is newer (`at`).
  - An account on its way out is taken out, never put back (0dh).
  - An id no registry names (a sample, a stray) is not touched.
  - No page ever writes the index.

## What this makes harder

- `cityindex` grows from about 18 bytes an owner and city to about 230 for one weekly rule: roughly 2 to 3 MB at 10,000 artists. Every calendar save rewrites it, and the picker, each city's feed and each venue page read it (each held at the edge: 5 minutes, 1 minute, 30 seconds).
- A lost write to the index lasts up to a day. Before, nothing healed it at all.
- One more scheduled function, ringing hourly.
- The picker's numbers change for any owner with gigs in two cities: each city now counts its own.

## What would reverse it

- The index outgrowing one document: split it by country, so the picker reads a handful.
- A real database with a query per city and window: the rules move there.

## How it was verified

- `node --import ./test/register.mjs test/citycounts.mjs`: 28 ✓, 0 ✗. Ninety owners, real `eventSave` calls for the artists.
  - **Picker.** One read (`cityindex`); counts equal an oracle that reads every calendar in the city; the owner in two towns counts once in each.
  - **Feed.** The nights equal the oracle's. No calendar of an artist with nothing on this week was read: 8 calendars of 28 in the city, the registry once. A 28-day window reaches the nights three weeks out.
  - **Venue page.** Only the two artists who name The Lamp were read. The sixty-first artist in a city is on the page of the venue it names.
  - **Old index.** With every rule stripped, the picker, the feed and the venue page answer the same, and no page writes anything. The bell puts back the same rules a save wrote; the next ring inside the day is one read.
  - **Lost write.** A save's index write lost on purpose: the heal a day on puts it back and the front door counts it.
  - A leaving account is not put back.
  - **Race.** A save that lands while the heal is reading (reads slowed to 15 ms) is kept.
- Five knock-outs, each red, then restored: the picker reading calendars, the feed reading everyone, the venue page reading every artist with rules, the heal without the newer-save guard, and the heal re-indexing a leaving account.
- `sh test/run.sh`: exit 0, 5,269 ✓, 0 ✗ (`test/keyfamilies.mjs`: no new kind of document; the rules live on `cityindex`, already copied).
- The existing suites that touch these paths are green: `featured` 75 ✓, `gigok` 28 ✓, `rsvp` 57 ✓, `fandoor` 31 ✓, `e2e` 71 ✓, `artists` 15 ✓.
- **Not checked:**
  - the real index's size;
  - the first heal against production's registries;
  - the edge caching under a real spike;
  - two function instances whose clocks disagree by more than the gap between a save and a heal's read. Then the heal could put back a calendar a moment old, until the next day.
