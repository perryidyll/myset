---
id: 0012
title: An open line to the room is the right end state, and not the next thing built
date: 2026-09-07
status: decided
decided_by: claude
area: scale
invariants: []
commits: [5e94a55]
tests: []
files: [docs/reports/open-line.md]
---

## The question

Perry, after the last-call countdown made the limit visible: *"what would it look like
to hold an 'open line' to the room? how would that work functionally, on the back end,
and affect server costs?"*

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| A — Cloudflare Durable Objects | One object per live room holding every phone's socket | **~2¢ for a 3-hour 10,000-person gig, and $0 inside the free allowance** — against $4.29 today. Compute is billed **per ROOM, not per person**, and outgoing messages are free | a second platform, a second deploy pipeline, a fallback path, sharding above ~8,000 phones | A room object hits the ~1,000 requests/second soft limit when everyone arrives at once |
| B — a hosted realtime service (Ably) | Publish and they fan out | **~$29 a gig — six times worse than today.** Connections are cheap ($1.80); they charge $2.50 per million messages **consumed**, and MySet is broadcast-shaped: 1,080 board updates × 10,000 people = 10.8M messages = $27 | a vendor | Paying six times more for the privilege of a nicer architecture |
| C — stay on Netlify | Nothing to do | **Netlify cannot hold a socket at all** — a function is request-in, response-out, and then it ends. True of every serverless platform, not a Netlify shortcoming | none | The polling cost stays *people × time* |
| **D — chosen. Do the shared-board split first, then reconsider** | One cacheable board with no `fan=` plus a tiny per-fan endpoint | ~5 days, no new vendor | one endpoint split | Takes the same problem down without the platform |

## What was chosen, and why

D. The shared-board split takes the *same* problem down without a second vendor, a
second deploy pipeline, or a fallback to maintain. The open line is 1.5–2 weeks **on top
of that** and adds a platform to operate.

The finding worth keeping regardless: **hosted realtime services charge for delivery,
and Cloudflare does not.** For a one-board-many-watchers product the two are a thousand
times apart, and it is not because one is a better company — it is the shape of MySet
meeting the shape of their price sheet.

Three rules that would not be optional if it is ever built:

1. **The line is a hint; the API is the truth.** Every message carries a version number
   and a phone that sees a gap re-fetches once. Without this, one dropped message means
   a phone quietly showing a wrong board all night — worse than polling, not better.
2. **Polling has to stay.** Corporate wifi, captive portals, old browsers, backgrounded
   tabs. It is an addition, not a replacement.
3. **Reconnection storms** need the same jitter and backoff the polling ladder already
   learned.

## What this makes harder

Nothing yet — this decision is to *not* build. What it does close off is treating the
polling ladder as a stopgap: it stays the main path for the foreseeable future and
should be maintained as such.

## What would reverse it

**A booked show over 2,000 people, with a date and a deposit.** Unchanged from the room
research on 2026-09-05.

## How it was verified

Priced from published rates, re-checked 2026-09-07: Cloudflare Durable Objects pricing
and limits, Ably pricing, and Netlify's own writing on websockets. Full working in
`docs/reports/open-line.md`. **Nothing was built and nothing was benchmarked** — these
are list prices applied to MySet's own measured traffic, not a load test.
