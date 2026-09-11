# 2026-09-11 — The open line, measured: a throwaway Durable Object

**Asked:** start P3-002 (the open line — Cloudflare Durable Objects, one per gig,
hibernating between votes, polling kept as the floor). The user withdrew decision
`0012`'s trigger; do not wait for a 2,000-person booking. Before writing code: say
whether the shared-board split (P3-001) ships first or is folded in, and ask; answer the
report's open questions by measurement, not arithmetic; check where `myset.vip`'s DNS
lives; keep `wrangler` out of the repo's two dependencies.

**Stopped first, then continued on the user's word.** `git status` in the main checkout
showed 27 uncommitted files from another session, last touched 16:40 — and three of them
(`netlify/functions/_board.mjs`, `board.mjs`, `me.mjs`, with `show.mjs` down 192 lines)
*are* the P3-001 split, calling themselves decision `0031`. This session ran in its own
worktree, clean at `5614bed`, and built on none of it. The user chose: measure now in a
separate directory, design the production line after the split is committed, and reach
the Worker at `*.workers.dev` for now.

**While the probe ran, the split landed.** By 18:36 the other session had pushed the
split as `c3d0a4d` (decision `0034`) and clips-to-R2 as `a4e3657` (decision `0033`). This
worktree was fast-forwarded to `a4e3657` before the write-up, so the ledger row below
sits on top of both. P3-001 and P3-003 are done; the only thing between here and the
production open line is the design itself.

**Recommendation given, and confirmed:** the split ships first as its own step. It is
already half-written elsewhere; the open line's payload *is* the shared board and needs
`buildBoard` as one function; and the two carry different risk (a Netlify-only change
with a suite, versus a second platform that had to be measured before being trusted).

## Shipped in this worktree (nothing committed, nothing pushed)

- `cloudflare/probe/` — the throwaway. `wrangler.toml`, `src/index.mjs` (the `Room`
  Durable Object: hibernating WebSockets, runtime-answered `hb` heartbeats, a `wakes`
  counter in SQLite that climbs every time the constructor runs, the decision-`0030`
  bucket per connection kept in the socket attachment), `probe.mjs` (the driver: Node's
  own WebSocket client, modes `wake bucket fanout storm wakebig`), `analytics.mjs`
  (reads Cloudflare's GraphQL analytics using wrangler's stored token, prints numbers
  only). Its own `package.json` holds `wrangler@4.131.0`; the repo root still has
  exactly two dependencies.
- Decision `0035` (main had reached `0034` by the time this was written).
- This file; the ledger row for P3-002.

## What was run, and what it printed

Account: Workers **Free** (dashboard `workers/plans`, read through the user's signed-in
browser). Durable Objects on Free: 100,000 requests/day, 13,000 GB-s/day, 100,000 SQL
rows written/day. Paid rates on the page match the report ($0.15/M requests, $12.50/M
GB-s). No upgrade was needed or made.

Auth: `wrangler login` (OAuth, the user said yes, Authorize clicked in the in-app
browser). Token in wrangler's local config on this Mac; never printed, not in the repo.

Deploy: `npx wrangler deploy` → `https://myset-open-line-probe.myset-open-line-probe.workers.dev`.
**The fresh `workers.dev` subdomain answered TLS handshake failures for about a
minute** after "Success" — third poll at 20 s intervals was the first 200.

Nearest PoP from this Mac: `colo=BKK` (`cdn-cgi/trace`). Every latency below includes
Koh Phangan → Bangkok and back.

### Local first (`wrangler dev`, workerd on this Mac)

```
25 casts in 15 ms: 20 landed, 5 refused (expect 20 / 5)
after 2.1s: board (expect board — one token refilled)
200 open, 0 failed, in 312 ms; connect n=200 min=34 p50=65 p90=98 p99=195 max=195 ms
round 0: http vote answered in 10 ms (sent to 200); board arrival n=200 min=4 p50=8 p90=10 p99=10 max=10 ms
```

### Live — bucket

```
25 casts in 72 ms: 20 landed, 5 refused (expect 20 / 5)
after 2.1s: board (expect board — one token refilled)
```

### Live — hibernation and wake (one socket, heartbeats every 5 s during idle)

```
room probe-mtwuxzqi
connected in 846 ms; hello: wakes=1 bootAt=1789125190831
warm ping RTT: n=10 min=58 p50=60 p90=93 p99=93 max=93 ms
after 15s idle: ping RTT 67 ms — OBJECT WOKE (wakes 1→2, awake 0 ms at reply)
after 30s idle: ping RTT 70 ms — OBJECT WOKE (wakes 2→3, awake 0 ms at reply)
after 60s idle: ping RTT 67 ms — OBJECT WOKE (wakes 3→4, awake 0 ms at reply)
after 120s idle: ping RTT 71 ms — OBJECT WOKE (wakes 4→5, awake 0 ms at reply)
```

`bootAt` changed and `wakes` climbed on every ping after idle: the object was evicted
while the socket stayed open, and the heartbeats did not wake it. Wake overhead ≈ the
gap between the after-idle RTT (67–71 ms) and warm (p50 60 ms): **about 10 ms**.

### Live — fan-out (opened in waves of 100, then one HTTP vote, time to every phone)

```
room probe-mtwv36or: opening 200 sockets
200 open, 0 failed, in 2234 ms; connect n=200 min=243 p50=757 p90=1763 p99=1821 max=1823 ms
object says sockets=200 wakes=1
round 0: http vote answered in 85 ms (sent to 200); board arrival n=200 min=81 p50=86 p90=88 p99=90 max=90 ms
round 1: http vote answered in 91 ms (sent to 200); board arrival n=200 min=85 p50=89 p90=91 p99=92 max=94 ms
round 2: http vote answered in 101 ms (sent to 200); board arrival n=200 min=93 p50=99 p90=101 p99=101 max=134 ms

room probe-mtwv38rv: opening 1000 sockets
1000 open, 0 failed, in 5165 ms; connect n=1000 min=200 p50=270 p90=1069 p99=1563 max=1615 ms
object says sockets=1000 wakes=1
round 0: http vote answered in 171 ms (sent to 1000); board arrival n=1000 min=157 p50=167 p90=175 p99=175 max=179 ms
round 1: http vote answered in 137 ms (sent to 1000); board arrival n=1000 min=127 p50=133 p90=137 p99=138 max=161 ms
round 2: http vote answered in 137 ms (sent to 1000); board arrival n=1000 min=110 p50=124 p90=133 p99=138 max=150 ms
```

### Live — storm (everything opened at once, no pacing, one process)

```
room probe-mtwv3i2c: 1000 sockets opened at once, no pacing, from one machine
1000 open, 0 failed, all settled in 2060 ms → 486 accepted/s from here
connect n=1000 min=1583 p50=1814 p90=1966 p99=2005 max=2030 ms
object says sockets=1000 wakes=1
board reached all 1000: n=1000 min=127 p50=150 p90=154 p99=155 max=155 ms
room probe-mtwv3ns6: 2000 sockets opened at once, no pacing, from one machine
2000 open, 0 failed, all settled in 4120 ms → 485 accepted/s from here
connect n=2000 min=1973 p50=3733 p90=3886 p99=3934 max=3972 ms
object says sockets=2000 wakes=1
board reached all 2000: n=2000 min=179 p50=202 p90=224 p99=226 max=233 ms
room probe-mtwv3v5x: 3000 sockets opened at once, no pacing, from one machine
3000 open, 0 failed, all settled in 8135 ms → 369 accepted/s from here
connect n=3000 min=2174 p50=6928 p90=7223 p99=7271 max=8104 ms
object says sockets=3000 wakes=1
board reached all 3000: n=3000 min=194 p50=234 p90=253 p99=263 max=447 ms
```

### Live — four processes, 1,000 each, same room, at once

```
room storm-1789125492: 1000 sockets opened at once, no pacing, from one machine
1000 open, 0 failed, all settled in 7808 ms → 128 accepted/s from here
connect n=1000 min=1162 p50=5551 p90=6247 p99=7428 max=7723 ms
object says sockets=3998 wakes=1
board reached all 1000: n=1000 min=138 p50=276 p90=328 p99=341 max=510 ms
room storm-1789125492: 1000 sockets opened at once, no pacing, from one machine
1000 open, 0 failed, all settled in 7763 ms → 129 accepted/s from here
connect n=1000 min=1164 p50=5560 p90=6276 p99=7528 max=7630 ms
object says sockets=3998 wakes=1
board reached all 1000: n=1000 min=181 p50=317 p90=371 p99=384 max=552 ms
room storm-1789125492: 1000 sockets opened at once, no pacing, from one machine
999 open, 1 failed, all settled in 10522 ms → 95 accepted/s from here
connect n=999 min=1166 p50=5562 p90=6292 p99=7544 max=7715 ms
  failures: { 'ws error: error': 1 }
object says sockets=1998 wakes=1
board reached all 999: n=999 min=129 p50=154 p90=212 p99=221 max=288 ms
room storm-1789125492: 1000 sockets opened at once, no pacing, from one machine
999 open, 1 failed, all settled in 10534 ms → 95 accepted/s from here
connect n=999 min=1163 p50=5584 p90=6305 p99=7539 max=7668 ms
  failures: { 'ws error: error': 1 }
object says sockets=1998 wakes=1
board reached all 999: n=999 min=121 p50=144 p90=204 p99=214 max=280 ms
```

Wall clock for all four: 11.0 s. Aggregate ≈ 500 accepted/s whether one process or
four — the throttle is this Mac (TLS handshakes, one uplink), not the object. **The
published 1,000 requests/second soft ceiling was not reached.** Two of 4,000 opens
failed at the client with `ws error: error` and no server-side reason; not attributed.

### Live — wake with 1,000 sockets hibernated (5,000 heartbeats a minute)

```
room probe-mtwv5j04: 1000 sockets, then leave the object alone and see what a wake costs
1000 open; warm ping 59 ms, wakes=1
after 20s idle with 1000 sockets: vote answered in 206 ms (sent to 1000); OBJECT WOKE (wakes 1→2); board arrival n=1000 min=171 p50=208 p90=210 p99=211 max=211 ms
after 45s idle with 1000 sockets: vote answered in 211 ms (sent to 1000); OBJECT WOKE (wakes 2→3); board arrival n=1000 min=182 p50=196 p90=202 p99=212 max=222 ms
```

Warm vote-to-all-1,000 from the fan-out run was 137–171 ms; after idle 206–211 ms.
Wake overhead with 1,000 attached sockets: **~40–70 ms**, and the object still slept
within 20 s despite the heartbeats.

### Cost — the Durable Object's own numbers (arrived ~55 minutes after the runs)

`node analytics.mjs`, Cloudflare GraphQL, 3-hour window covering every run above:

```
durableObjectsInvocationsAdaptiveGroups  requests=24473  errors=12200  responseBodySize=2745698
durableObjectsPeriodicGroups             activeTime=13653002 µs  cpuTime=7878071 µs
                                         outboundWebsocketMsgCount=35839  inboundWebsocketMsgCount=0
                                         max activeWebsocketConnections=3998
                                         storageReadUnits=0 storageWriteUnits=0 fatalInternalErrors=0
workersInvocationsAdaptive (Worker level) requests=12102 errors=0
```

Against the own tally of 12,202 socket opens + ~30 HTTP calls:

- **A connection is billed as two requests, not one.** 24,473 ≈ 2 × 12,202 + the HTTP
  calls. The upgrade request is one; the close event delivered to the object is
  another. The report's "a phone connecting is one request" is off by half.
- **"errors" = 12,200 ≈ one per socket, and it is not a health signal.** `wrangler tail`
  while closing one socket cleanly (`close(1000)`, awaited) and one abruptly
  (`process.exit` mid-handshake) showed the clean upgrade request ending with outcome
  `responseStreamDisconnected` and the abrupt one with `canceled`. Neither is `ok`,
  so every socket's eventual disconnect lands in the errors column. Do not alert on it.
- **Billable duration for the whole afternoon: 13.65 s active** ≈ 1.7 GB-s at 128 MB
  ≈ $0.00002 at the paid rate, for ~12,000 connections and 35,839 broadcast messages.
  The report priced a 3-hour 10,000-person gig at 1,382 GB-s assuming the object
  stays awake; hibernation makes duration a rounding error.
- 35,839 outbound messages: free, as the report said. `inboundWebsocketMsgCount` reads
  0 although ~47 JSON messages were sent in (pings and casts); the runtime-answered
  `hb` heartbeats — ~13,000 of them — are correctly absent. The zero is unexplained;
  possibly the 20:1 billing rounds ~47 to nothing in this dataset.
- Peak 3,998 connections in one object, 0 fatal internal errors, 0 memory errors.

The dashboard's billing card still read `$0.00 · 0 requests` at the same moment; it lags
the GraphQL dataset. The account is on Workers Free; the daily allowance (100,000
requests) absorbed 24,473.

### DNS

`dig NS myset.vip` → `dns1-4.p04.nsone.net`; SOA contact `domains+netlify.netlify.com`;
A records answer `server: Netlify`. DNS lives at Netlify. No Cloudflare zone exists,
so the production Worker is reached cross-origin (`connect-src` in `netlify.toml`
gains one `wss://` host) or a subdomain is delegated later.

## What this settles for the production design

- One object per gig, no sharding, is safe past anything MySet has ever seen: 4,000
  sockets in one object, every broadcast reaching the last phone in ≤ 552 ms.
- Budget two billed requests per phone per connection (open + close), and expect the
  "errors" column to equal the number of phones that ever left.
- Hibernation can be relied on for the cost model. Heartbeats must use
  `setWebSocketAutoResponse`; anything else wakes the object and bills duration.
- The bucket belongs in the socket attachment, not in memory, or a wake resets it.
- Deploy long before doors. A fresh hostname is not instantly reachable.
- Reconnect storms need the jitter the polling ladder already has (0012, rule 3) —
  not because the probe hit the ceiling, but because it could not.

## Not done, and why

- No production code. By the user's choice, the design waited for the split to land —
  which it now has (`c3d0a4d`). The design is the next session's first job.
- The 1,000/s ceiling: needs load from more than one machine.
- iOS Safari in the background (INVARIANT 9d12) and venue Wi-Fi: needs phones.
- The probe Worker is still deployed, public and unauthenticated, in case anything is
  worth re-running. `cd cloudflare/probe && npm run delete` removes it.

## Housekeeping to be aware of

- The main checkout still has uncommitted edits from another session (`INVARIANTS.md`,
  `netlify.toml`, `_lib.mjs`, `board.mjs`, `public/artists.html`, `test/copy.mjs`,
  `tools/loadsim.py`) — untouched by this session.
- Decision numbering: main gained `0031`–`0034` during this session;
  this record is `0035`. The worktree was fast-forwarded to `a4e3657` before the write-up.
