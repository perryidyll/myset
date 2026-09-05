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

| people | interval | board | resulting blob traffic |
|---|---|---|---|
| ≤200 | 3s | everything | 2 MB/s |
| ≤1,000 | 5s | top 40 | 30 MB/s |
| ≤3,000 | 10s | top 25 | 46 MB/s |
| 3,000+ | 20s | top 15 | 76 MB/s |

Without the dial, 10,000 phones is 5.1 GB/s and the room does not work. With it, the
same room is in the same order of magnitude as a busy small one.

**The board shortens, and says so.** `boardLimitFor(heads)` — YouTube's "Top chat"
default. Anything this fan voted for is concatenated back on regardless of rank: a
song that silently vanishes does not read as a shorter list, it reads as a lost vote.
`vote.html` labels it: *"Big room tonight — showing the top 15. Songs you voted for
stay on your list wherever they are."*

**The caps, soft.** `PLANS.*.audience` = 200 / 1,000 / 3,000, stamped onto the show
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
