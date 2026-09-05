# How big a room can get — the cap, the throttle, and what the research changed

2026-09-05. Perry: *"let's set up a limit to how many people can enter your gig!
that's an easy fix!! to the potential of 10000+ people at one arena show signing in
… and the entire app collapsing."*

He was right that it needed doing and wrong about which fix it was — and the
research changed the shape of the answer twice.

---

## 1. Where MySet actually breaks, and it is not the money

`tools/loadsim.py` already prices a gig. What it does not model is that **every poll
re-reads the whole audience bag** (`readFans` merges 12 shards on every single
request). So the cost of one poll grows with the size of the room, and the number of
polls grows with the size of the room. That is the quadratic:

| people | audience bag | polls/sec at 3s | internal blob traffic |
|---|---|---|---|
| 100 | 15 KB | 33 | 0.5 MB/s |
| 500 | 76 KB | 167 | 13 MB/s |
| 1,000 | 152 KB | 333 | 50 MB/s |
| 5,000 | 762 KB | 1,667 | **1.3 GB/s** |
| 10,000 | 1,523 KB | 3,333 | **5.1 GB/s** |

100× the people is 10,000× the internal traffic. Measured with `/tmp/fanscale.mjs`
against the real shapes; CPU is fine (5.7ms to fold 10,000 fans) — it is the bytes.

**So the honest ceiling today is roughly 1,000 people in one room, and it breaks on
reads, not on cost.** The $36.40 the simulator quotes for 10,000 people is what it
would cost if it worked.

## 2. What the research changed — twice

A 20-agent research workflow was launched (11 real systems, 4 architectures, 4
adversarial checks). It **hit the session usage limit after 4 studies** — Uber,
Mentimeter, Discord and YouTube Live chat completed; the rest did not run. Those
four turned out to cover the important ground, and they converged hard.

### They said the first thing I built was wrong

I had built a hard door: person 501 at a Plus gig becomes a read-only watcher.
Mentimeter publishes the opposite as policy, verbatim: *"we will never prevent
participants from joining and voting on an ongoing presentation… you can go over
your participant limit during one of your sessions without any interruptions"*,
followed by an 8-hour grace period. The cap bites on the **next** show.

YouTube goes further: the only hard caps anywhere in Live chat are on **spend**
($500/day, $2,000/week) and on **attention** (a $5 floor to appear in the ticker).
There is no plan anywhere that caps how many people may watch. The agent's warning
was blunt: capping the audience *"will read as punitive to an artist whose show went
well."*

So the door came out. A plan's `audience` number is a billing line now — the room
slows down and shortens instead, and nobody is ever refused.

### And they named a better fix than a cap

Discord's single biggest fanout win was noticing that ~90% of listeners in a big
room are passive; only waking the active ones made fanout *"90% less expensive"* and
bought *"~3x win in maximum community size."* MySet's rule — **any vote resets every
phone to the 3-second rung** — is precisely the opposite, and it is the term that
squares.

YouTube's answer to the same problem is one field: it stamps `timeoutMs` on every
live-chat response and its clients sleep exactly that long, at streams past **eight
million concurrent viewers**. Uber's whole push platform is built on *"the backend
decides when the app gets the next thing"* — after finding that *"80% of requests
made to the backend API gateway were polling calls."*

That is the change that shipped.

## 3. What shipped

**The server sets the pace.** `pollFloorFor(heads)` in `_lib.mjs` returns the
fastest interval a room may use; `show.mjs` sends it as `nextPollMs`; `vote.html`
builds all three rungs off it. At the default floor the numbers are exactly the
3s/10s/25s they have always been — an ordinary gig feels identical.

| people | interval | board | throttled | on a fixed 3s ladder |
|---|---|---|---|---|
| ≤200 | 3s | everything | 2 MB/s | 2 MB/s |
| ≤1,000 | 5s | top 40 | 30 MB/s | 51 MB/s |
| ≤2,000 | 10s | top 25 | 61 MB/s | 203 MB/s |
| 10,000 | 20s | top 15 | 762 MB/s | 5,077 MB/s |

**Corrected after first writing.** This table originally said 46 MB/s at 3,000 and
76 MB/s at 10,000 — both wrong by a factor of the head count, because the interval
had been divided out without multiplying the number of phones back in. The dial buys
1.7x at a club and 6.7x at an arena; it does not make an arena work. That correction
is also why the Pro number came down from 3,000 (137 MB/s) to 2,000 (61 MB/s):
2,000 is in the same neighbourhood as the busiest room MySet is known to serve.

**The board shortens, and says so.** `boardLimitFor(heads)` — YouTube's "Top chat"
default. Anything this fan voted for is concatenated back on regardless of rank: a
song that silently vanishes does not read as a shorter list, it reads as a lost vote.
`vote.html` labels it: *"Big room tonight — showing the top 15. Songs you voted for
stay on your list wherever they are."*

**The caps, soft.** `PLANS.*.audience` = 200 / 1,000 / 2,000, stamped onto the show
when the night starts (`show.roomCap`) so an artist who upgrades mid-set does not
have the room change size underneath them, and a show that started before caps
existed is never capped mid-gig. There is no head-count check in `vote.mjs` and no
spectator state anywhere. The plan cards say the number; the free card's old
"unlimited voters at each" was removed, because it had stopped being true.

## 4. What was deliberately NOT built

- **A hard door.** See above, and `INVARIANTS.md` 0ej.
- **The snapshot.** The real fix is to stop re-reading the audience per poll: render
  one shared room state when something changes and serve it from cache, turning read
  cost from O(people) into O(votes). Uber's CacheFront invalidates on write rather
  than on a timer; Discord's relay tier exists for exactly this; YouTube's cursor is
  a version. That is the next piece of work and it is what raises the tier numbers.
- **Websockets.** All four studies warn against it on this stack. On Netlify a held
  connection bills as compute (10 credits/GB-hour) instead of as requests
  (2 credits/10,000) — the wrong side of the price sheet. And on Ably's published
  billing one publish to N subscribers is billed as 1+N messages, which the
  Mentimeter agent priced at ~$270/event for a MySet-shaped feed at 10,000 phones,
  against $36.40 on polling. *Polling is not the embarrassing shortcut here.*

## 5. Checks

`test/roomsize.mjs` — 38 assertions, in `sh test/run.sh`. The ones that matter are
the negative ones: a phone that arrives **after** the cap still gets a normal page
and its vote is still taken, and there is no spectator state to find.

*`INVARIANTS.md` 0ej–0em. Research journal:
`subagents/workflows/wf_fef43a0b-35e/journal.jsonl` — 4 of 11 studies completed
before the usage limit; the remaining 7 studies, 4 designs and 4 verifications never
ran and are worth resuming.*

---

## The report

Published as an artifact for Perry: **The Room Ceiling** —
https://claude.ai/code/artifact/d85142a3-242a-415d-8f91-962e1cd2e942

Source kept in the repo at `docs/reports/room-ceiling.html` so it survives independently
of the artifact. It carries the log-log chart of internal read traffic against room
size (both the fixed-3s curve and the throttled one, with the band MySet is known to
serve), the four research quotes and what each one changed, the shipped dial and tier
tables, the ranked pricing recommendation, and the four open questions.

The chart's coordinates are computed from the same measured figures as
`pollFloorFor` — if those rungs change, the polyline points in that file are stale.

---

## The research, finished — and it refuted all four claims

The workflow resumed after the usage limit reset and completed 20/20 agents: 11 systems,
4 architectures, 4 adversarial fact-checks. **Every one of the four claims came back
wrong**, two of them mine.

### 1. Cloudflare is neither 13× nor 1.3× cheaper

`$3.81` a gig keeping HTTP polling (**9.6×**), `$0.065` on WebSockets with the
Hibernation API (**~500×**), priced from Cloudflare's own published rates and verified
against their worked hibernation example, which the verifier reproduced exactly.

`tools/loadsim.py` line 147 prices Durable Objects with `polls*10/1e6*0.02` — the
**Workers CPU-time rate**, which is not a Durable Objects billing dimension. It omits DO
duration entirely and omits the fronting Worker that a DO cannot be addressed without.
The 1.3× figure is not reproducible from published rates for any sane architecture.

The conceptual point both sides missed: **duration is billed per OBJECT, not per request
and not per connection.** One room = one object = one 128 MB allocation whether 8 phones
or 100,000 are attached. The free monthly allocation alone is 289 three-hour gigs.

**The real blocker is capacity, not price.** A single Durable Object has a published soft
limit of **1,000 requests/second**; the polling design needs 736/s at baseline and
3,198/s in the busy case. A relay tier is mandatory above ~8,000 phones.

### 2. A cache header on `/api/show` saves nothing

The poll URL carries `fan=<id>` and production returns `netlify-vary: query`, so 10,000
phones make **10,000 cache keys**. Netlify also bills a web request for a cache *hit* —
its docs count "content hosted on your project" with no exclusion for cached responses.
Caching removes compute only: 63% at best, **0% as the endpoint stands**.

This was the fix recommended in the first version of the report. It would have been a day
spent for nothing. `INVARIANTS.md` 0ep.

### 3. The write path was never one CAS document

`SHARDS = 12` since the file's first commit; `vote.mjs` never writes the show document.
The write wall is ~11,000–12,000 concurrent voters — five times further out than the read
wall. But `SHARDS` is a **shared knob**: 12 → 256 raises writes 235/s → 5,985/s and
raises blob reads per poll 15 → 259. The write path cannot be fixed without changing the
read path first.

*Unmeasured, and worth measuring:* the ~24 writes/sec per shard is derived from a measured
40 ms **read**, not from a measured write. If it is a quarter of that, the write wall
arrives at 4,000 people. Hammer one shard before selling a room over 2,000.

### 4. The market has not settled on caps

Slido free 100 · $12.50→200 · $50→1,000 · $150→5,000. Kahoot 360 $19→50 up to $79→5,000.
Poll Everywhere $10→700. **Mentimeter sells unlimited participants at $11.99.** Four of
five cap, the largest does not. MySet at $10 for 1,000 is five times cheaper than Slido on
the same capacity — so the caps are an engineering necessity, not a market convention, and
should be described that way.

## What the research made me ship

`signature()` in `public/vote.html` included `d.totalVotes`, so any cast by anyone reset
`QUIET` to 0 on every phone. The 10s and 25s rungs were unreachable in any busy room.
Split into `stageSig()` / `signature()`, with the room deciding which drives the ladder —
below the server's widening point nothing changes at all, because at eight people the
tally jumping the instant somebody votes IS the product. Plus ±20% jitter and a terminal
rung. `INVARIANTS.md` 0en, 0eo.

Measured over the real loop, a 3-hour gig:

| people | before | after | blob reads |
|---|---|---|---|
| 20 | 2.8¢ | 2.7¢ | unchanged |
| 1,000 | $2.76 | $0.98 | |
| 2,000 | $6.60 | $1.28 | |
| 10,000 | $36.40 | **$4.29** | 119.2M → 13.2M |

Busy-room read traffic at 10,000: 5,077 MB/s → 463 MB/s. **The honest ceiling moved from
~1,000 people to ~2,500**, which vindicates the tier numbers rather than changing them —
the research recommended dropping Plus to 500 on cost grounds, but that was reasoning
against the old ladder and a full Plus room now costs 98 cents.

`tools/loadsim.py` mirrors the new ladder, floor and jitter; its docstring says keep them
in step and this does.
