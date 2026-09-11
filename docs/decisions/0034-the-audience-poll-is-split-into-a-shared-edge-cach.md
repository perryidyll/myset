---
id: 0034
title: The audience poll is split into a shared, edge-cached board and a tiny personal call
date: 2026-09-11
status: decided
decided_by: claude
area: scale
reverses:
superseded_by:
invariants: [0fh, 0fi, 0fj, 0fk, 0em, 0ep, 9d13]
commits: []
tests: [test/split.mjs, test/cost.mjs]
files: [netlify/functions/_board.mjs, netlify/functions/board.mjs, netlify/functions/me.mjs, netlify/functions/show.mjs, netlify/functions/vote.mjs, netlify/functions/_lib.mjs, public/vote.html, tools/loadsim.py]
---

## The question

*(Numbered 0034 and 0fh–0fk rather than 0033/0fd because a parallel session's
uncommitted R2 work in `.claude/worktrees/r2-clips` had already taken those; check the
numbering again at merge time.)*

Every phone in the room polled `/api/show?fan=<id>&in=1`, which answered with the whole
board plus that phone's own credits. Because the fan id was in the address, no two phones
ever asked for the same thing, so nothing could be cached (INVARIANT 0ep) and every poll
re-read all twelve fan shards. The read traffic the store had to move grew with the
*square* of the room, and the room-ceiling report of 2026-09-05 put the honest limit at
~2,500 people — with GATE-003 ("a room of 2,000 works") blocked on this, and decisions
`0006` and `0012` both naming this split as the thing that raises the tier numbers and as
the step to take before any open line. The user asked for it to be built now, ahead of
R2 and the open line.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen. Two calls: `/api/board?a=` cached at the edge for the poll interval, `/api/me?fan=` never cached** | The audience bag is read once per interval for the whole room; each phone reads one shard | Two web requests per tick instead of one; ~0.3¢ more for a 20-person gig, less for anything bigger | two handlers, a shared builder module, a merge on the phone | A stale copy shows a vote landing, vanishing, and coming back — handled (0fk) |
| B — cache `/api/show` as it is | Nothing to build | Nothing saved: the fan id is the cache key, so every phone still gets its own copy | none | A day spent for nothing — 0ep already measured this |
| C — one call, with the personal part in a cookie or header and `Netlify-Vary` | Keeps one request per tick | `Netlify-Vary` is silently ignored through the `/api/*` rewrite (9d6) | a header contract | The cache never collapses and nobody notices |
| D — per-fan documents instead of shards, then cache | Makes the personal read O(1) | A storage migration on live fan records mid-season, against INVARIANTS 4 and 5 | a migration | Lost votes — the one thing this project has already paid for once |
| E — the open line (Durable Objects) first | Removes the polling altogether | A second platform to operate, 1.5–2 weeks, and decision `0012` said not yet | a platform | A room stuck on a data centre's bad day |

## What was chosen, and why

A. It removes the same quadratic the open line removes, on the platform that already
runs everything, with no new vendor. The board carries **nothing personal** and its
address carries only `?a=<slug>`, so every phone requests an identical URL and the URL
alone is the key. It is cached with `netlify-cdn-cache-control: public, durable,
s-maxage=<n>, stale-while-revalidate=<n>` where `n` is `pollFloorFor(heads)` in seconds —
the interval the room is already told to wait — so a copy is at most one interval old,
two while it is being replaced. The personal call reads the show record and **one**
shard (two strong reads; three for a slug artist), never the registry for a name it does
not show.

`/api/show` stays, for pages opened before the deploy and for the suite, and answers the
old shape composed from the same two builders — one definition of the song shape, the
rank and what a fan is owed. The phone's copy of the merge is held to the server's by
`test/split.mjs`.

Three things a shared board had to keep that a per-fan payload got for free:

1. **Your own song never falls off a short board** (0el). The board carries a *tail* —
   `[id, votes, firstAt]` for every song below the cut with any vote on it — and the
   personal call carries the titles this phone holds, so the phone puts its own song back.
2. **A vote cannot visibly vanish.** A cached board may predate this phone's own cast by
   a few seconds. The page keeps what it showed itself when it voted and lets the board
   raise that number but not lower it until a board rendered after the cast arrives —
   server clocks on both sides, so no skew.
3. **Either half may fail and the room can still vote.** With `/api/me` down the board
   renders with the last personal state, or the honest fresh-phone numbers; the vote's
   own answer is applied locally so the phone still sees its vote and its `remaining`.
   With `/api/board` down the page keeps the board it has. Watched in a real browser
   with each half returning 500 in turn.

## What this makes harder

- Every tick is two requests, and Netlify bills a cache HIT as a web request (0ep). A
  20-person gig goes from 2.70¢ to 3.01¢ in the simulator, because at that size the
  edge copy expires between polls 39% of the time and there is little compute to save.
  Every bigger room costs less than before. The point was never money; it was the wall.
- Two copies of the merge exist — `mergeForOne` on the server, `mergeBoard` on the phone
  — and only a test keeps them together. Change one, change both.
- The countdown is late by the copy's age. The page subtracts the `Age` header; a phone
  that cannot read it sees "7" where it would have seen "10". A nudge, not a promise (0010).
- The tier numbers were **not** raised. The ceiling moved in a simulator — and the
  simulator, now fed the real record weight, says the old ceiling was overstated.

## What would reverse it

A measured production number that contradicts the simulator — the personal call billing
far more than the ~50 ms it is estimated at, or the edge failing to hold a three-second
copy — or the open line landing and making the polling path the floor rather than the
road. Neither reverses the *shape*: even then the board should carry nothing personal.

## What the fresh-context review found, and what was done with it

Reviewed the same day by a second model with no memory of the build. Taken: the board's
clock was read *after* its twelve reads and a cast's before its write, so a board
rendered across a vote could look newer than the vote while not containing it (fixed —
the board stamps before it reads, the cast answers with a clock taken after its write,
and the page prefers that clock; `test/split.mjs` goes red with the old placement); a
kept board re-fed a stale countdown every poll during a board outage (fixed — only a
fresh board feeds it); the safety net around `render()` had been lost (restored); a
refused cast left its optimistic number painted (fixed); a personal state from another
night could be painted onto a new show (fixed, both copies); the record-size input to
the ceiling was wrong (fixed, above); and the "no global document" claim was only true
of the founding page (reworded — a slug reads the registry, as it always did). Noted and
not done: caching the registry read in module scope would take a slug's personal poll
from three reads to two and is a separate decision (P3-014); the roomsize suite still
exercises the legacy door (its negative assertions were added to `test/split.mjs` on the
new path).

## What the deploy taught, the same evening

Pushed as `c3d0a4d`. Live, the new page and both endpoints answered correctly at once —
and the shared board was **not** being shared: every request said `"Netlify Durable";
fwd=bypass` and rendered afresh. Two free draft deploys with a header switch found
why: **Netlify's durable cache ignores a lifetime under 10 seconds.** Every spelling of
3 through 9 (`max-age`, `s-maxage`, with and without `stale-while-revalidate`) was
bypassed; 10 and 60 were hits with a ttl. Under 10 the copy still lives on each edge
node on its own — a 3-second copy was `"Netlify Edge"; hit; ttl=2` on the same
connection and a miss from the next node, on the draft and on production alike.

So the middle rung of `pollFloorFor` changed from 5 s to 10 s: up to 200 phones the
interval stays 3 s and the copy is per node (cheap either way, and the tally stays live
in a pub); from 201 phones it is 10 s and the copy is shared by the whole room. For a
mid-sized room that is the same worst-case delay for seeing what the artist did — one
interval, as a 5 s poll against a 10 s copy would have given — for half the requests; a
phone's own vote is shown at once regardless. A 5 s rung would have quietly put every
phone in a 500-person room back on its own render, and `tools/loadsim.py --ceiling`
shows that case as *worse* than before the split (178 MB/s against 164 at 1,000). The
1,000-phone gig now costs $0.56 (was $0.98) and moves 9 MB/s (was 164). The
simulator's small-room figures are printed as a range — best case one render per
interval, worst case every poll — because how many edge nodes a bar's phones land on
is not known. Reversing the rung is one number in `pollFloorFor`, but then the board's
lifetime must be decoupled from the interval or the split stops working for those rooms.

## How it was verified

- `test/split.mjs` — 80 assertions: the board carries nothing personal and is
  byte-identical whoever asks; the personal call reads one shard and never writes once
  present; presence is stamped by the personal call and never by the board; `/api/show`
  is the two halves merged, through the handler, for five different phones; the phone's
  merge equals the server's; a fan's song comes back from the tail on a 1,200-phone
  board, where nobody is a spectator and a latecomer still votes; a stale board cannot
  lower a vote the phone already showed; the board's clock is read before its reads and
  a cast's after its write (red with the old placement); a personal state from another
  night is ignored by both copies; the board renders with the personal call gone; a dark
  room is dark on both halves.
- Parity with the `show.mjs` that shipped before the split was checked once, by hand, by
  the reviewer against `git show HEAD:netlify/functions/show.mjs` on the same in-memory
  store across fifteen scenarios (voter, paid pack, unlimited device, unknown fan, empty
  fan id, no `in=1`, played + now playing + window closed + countdown, requests on with a
  pending ask, a 1,200-phone short board with a tail voter, three dark-room cases):
  identical values; only the additive keys `at` and `freeCredits` and key order differed.
- `test/cost.mjs` — 14 reads per shared board render (ceiling 15), **2 per personal poll**
  (ceiling 3), one shard, no global document, no write once present; 14 for the legacy poll.
- Full suite: `sh test/run.sh`, every section green after the change (see the session file).
- A real browser against the real handlers over HTTP: vote through the sheet, tally and
  "Your vote" stable across polls; `/api/me` returning 500 — board still updates with
  other phones' votes, a cast still lands and is shown as mine with the right credits;
  `/api/board` returning 500 — the page keeps its board; no page errors.
- Live, read-only, before the deploy: `/api/img` on myset.vip, which carries the same
  `durable` directive through the same `/api/*` rewrite, answered `cache-status:
  "Netlify Durable"; hit` on the second request with an `age` header. After the deploy:
  the durable minimum and the per-node 3 s copy, measured as described above, on two
  draft deploys and on production.
- `tools/loadsim.py --ceiling` reproduces the room-ceiling report's column to the decimal
  at the record size the report assumed (152 bytes a fan), and then does the same sum at
  the record size the vote path writes today — measured on 2026-09-11: 101 bytes for a
  phone that only watched, 412 after one cast, 864 after three, **2,010 after eight**,
  because the cast receipts kept for idempotency (INVARIANT 15h) are most of a voter's
  record. Two honest lines come out of it, busiest case (every screen on, eight votes a
  head):
  - at the report's 152-byte record: before 462 MB/s at 10,000, after 40.5 — reads are
    not the wall anywhere up to 10,000;
  - at today's 2 KB record: **before the split the wall was ~700–1,000 people, not the
    ~2,500 the report said** (the record grew after the report was written); **after the
    split it is ~2,500** (2,000 → 34 MB/s, 3,000 → 77).
  So GATE-003's 2,000 is inside the line for the first time on reads; the cheapest next
  lever is trimming the receipts (P3-013), which moves today's line toward the lighter
  one; the write wall (P3-005, never measured) is next after that. **Not sold as a number
  until a real room has been watched.**
