---
id: 0035
title: The open line is built now, after the split lands, from measured numbers rather than list prices
date: 2026-09-11
status: decided
decided_by: user-confirmed
area: scale
reverses: 0012
superseded_by:
invariants: []
commits: []
tests: []
files: [cloudflare/probe/, docs/reports/open-line.html, docs/sessions/2026-09-11-open-line-probe.md]
---

## The question

Decision `0012` said the open line (one Cloudflare Durable Object per gig, holding every
phone's socket, hibernating between votes) was the right end state but not the next
thing built, and set its trigger as *a booked show over 2,000 with a date and a
deposit*. On 2026-09-11 the user withdrew that trigger and said to start now. Two
things had to be settled before a line of production code was written: whether the
shared-board split (P3-001) ships first or is folded into this build, and whether the
report's open questions — every Cloudflare number in it was list price, nothing had
been run — could be answered by measurement instead of arithmetic.

A third fact surfaced at the start: the split was already half-built and uncommitted in
another session (`_board.mjs`, `board.mjs`, `me.mjs`, `show.mjs` down 192 lines), so
"fold it in" would have meant two sessions editing `show.mjs` and `netlify.toml` at
once in a repository where `main` is production. (It landed as `c3d0a4d`, decision
`0034`, before this record was finished.)

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: measure first, in a throwaway Worker in its own directory; design the production line after the split is committed** | A probe Durable Object deployed by hand to `workers.dev`, driven from one Mac with Node's own WebSocket client; real numbers for hibernation, wake latency, fan-out, a reconnection storm and the 0030 bucket | An afternoon; $0 (Workers Free, no upgrade needed) | `cloudflare/probe/` with its own `package.json` holding `wrangler` — the repo's two dependencies untouched | Numbers from one laptop through one PoP are not numbers from a bar full of phones |
| B — fold the split into this build | One session owns both the board split and the socket | Saves one hand-over | none | Collides with the other session's uncommitted `show.mjs`; a merge on a production branch during somebody's show |
| C — design from the report as written | Skip the probe, build the production Worker straight away | Nothing now | none | Every ceiling in the design is a list price; the first real number would come from a gig |
| D — do nothing (keep 0012's trigger) | Wait for a 2,000-person booking | Nothing | none | The user has withdrawn the trigger; waiting is now his decision to reverse, not the code's |

## What was chosen, and why

**A**, and the user confirmed both halves: measure now, design after the split lands;
and reach the Worker at `*.workers.dev` for now rather than moving DNS.

The split ships first because it is already half-written elsewhere, because the open
line's payload *is* the shared board and needs `buildBoard` to exist as one function, and
because the two carry different risk: the split is a Netlify-only change with a test
suite, the open line is a second platform that had to be measured before being trusted.

The probe found, from this Mac through Cloudflare's BKK PoP, all of it run and printed
(`docs/sessions/2026-09-11-open-line-probe.md` has the raw output):

- **Hibernation is real.** The object slept within 15 s of quiet with the socket held
  open and heartbeats answered by the runtime; every real message afterwards ran the
  constructor again (`wakes` climbed 1→5). With 1,000 sockets attached and 5,000
  heartbeats a minute it still slept within 20 s.
- **Waking costs ~10 ms** on an empty object (ping 67–71 ms after idle vs 58–60 ms
  warm) and **~40–70 ms with 1,000 sockets attached** (a vote answered in 206–211 ms
  after idle vs 137–171 ms warm).
- **Fan-out:** one vote in, 1,000 boards out, last arrival 179 ms; 3,000 sockets,
  last arrival 447 ms; 4,000 sockets in one object, last arrival 552 ms.
- **Storm:** 3,000 sockets opened at once — 0 failures. Four processes opening
  4,000 into one object — 3,998 open, 2 client-side errors with no server reason. The
  aggregate acceptance rate stayed ~500/s however many processes ran, so the ceiling
  reached was **this Mac's**, not the object's: the published 1,000 requests/second
  soft limit was *not* reached and cannot be from one laptop.
- **The bucket** from decision `0030`, kept in the socket attachment so it survives
  hibernation: 20 land, the 21st is refused, one token back after 2.1 s.
- **Cost, from the object's own analytics:** 24,473 billed requests for 12,202
  connections — **two per connection** (upgrade + close), where the report assumed one.
  13.65 s of billable duration for the whole afternoon (≈ 1.7 GB-s, ≈ $0.00002 at the
  paid rate) for ~12,000 connections and 35,839 free outbound messages: hibernation
  makes duration a rounding error. The "errors" column read 12,200 — one per socket —
  and `wrangler tail` showed why: a socket's upgrade request ends as
  `responseStreamDisconnected` even on a clean close, so the column counts departures,
  not faults. Nothing was billed: Workers Free, 24,473 of a 100,000/day allowance.

Two facts about the account that shape the production design:

- **`myset.vip`'s DNS is at Netlify** (nameservers `dns1-4.p04.nsone.net`, SOA
  contact `domains+netlify.netlify.com`), not Cloudflare. There is no Cloudflare zone,
  so a Worker cannot sit at `myset.vip/...`. The line is reached cross-origin at a
  `workers.dev` hostname, which means `netlify.toml`'s `connect-src 'self'` gains one
  `wss://` entry when the production Worker ships — and nothing else on `myset.vip`
  changes. Delegating `line.myset.vip` to Cloudflare by NS record stays open as the
  later, tidier option.
- A freshly registered `workers.dev` subdomain answered TLS handshake failures for
  about a minute after `wrangler deploy` said success. Production must be deployed
  well before a gig, never during one.

## What this makes harder

A second platform now exists in the account with a deploy path (`wrangler`, OAuth
token in wrangler's local config on one Mac) that the Netlify pipeline knows nothing
about. The probe Worker is public and unauthenticated; anyone who finds the URL can
spend the free daily allowance. It is not connected to anything and `npm run delete`
in `cloudflare/probe/` removes it.

The 1,000/s ceiling remains unmeasured. Proving or disproving it needs load from more
than one machine, or a load generator inside Cloudflare's own network.

## What would reverse it

Nothing about the sequencing — the split landed on `main` as `c3d0a4d` (decision `0034`)
while the probe was running, so that half is spent.
A measured number from a real room that contradicts the probe — in particular a wake
latency a person can feel, or a fan-out that does not reach the back of the room. Or
the user deciding to move DNS to Cloudflare, which would change the hostname half
without touching the rest.

## How it was verified

`cd cloudflare/probe && node probe.mjs --url wss://myset-open-line-probe.myset-open-line-probe.workers.dev <mode>`
for `bucket`, `wake`, `fanout 200`, `fanout 1000`, `storm 1000|2000|3000`, four
parallel `storm 1000` into one `--room`, and `wakebig 1000`; every line quoted above
is from that output. The same `bucket` and `fanout 200` first ran against
`wrangler dev` locally and printed the same shape. `node analytics.mjs` read the
Worker- and Durable-Object-level analytics through Cloudflare's GraphQL API (the object's
arrived ~55 minutes after the runs); `wrangler tail` for the close outcomes. `dig` for the DNS. The
Workers plan page in the dashboard for the plan and the rates. **Not checked:**
the 1,000/s ceiling, behaviour of a
backgrounded iOS Safari tab (INVARIANT 9d12), and anything from a phone on venue Wi-Fi.
