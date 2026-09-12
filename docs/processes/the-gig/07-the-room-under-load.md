---
tab: The gig
section: The room under load
puzzle_section_id: 41970
sources:
  - netlify/functions/_lib.mjs — pollFloorFor, boardLimitFor, takeCastToken, the polling-dial comment block
  - netlify/functions/board.mjs, me.mjs, _board.mjs (the split; durable cache headers)
  - netlify/functions/_errlog.mjs, bug.mjs (errors that outlive the night)
  - public/vote.html — mergeBoard, the "Big room tonight" label, backoff and jitter
  - MYSET-MASTER-OVERVIEW.md §1.12, §5.3, §5.4
  - docs/reports/room-ceiling.html, open-line.html; tools/loadsim.py
  - INVARIANTS.md 0ae, 0fa, 0fh–0fk, 9d6
  - docs/decisions/0006, 0012, 0029, 0030, 0034
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps with roles, tools, connections)
verified: code read 2026-09-12 (pollFloorFor and boardLimitFor rungs; board.mjs cache headers)
---

# The room under load

**Who:** the server and the edge (roles *MySet server*, with the fan informed). **Trigger:** more phones than a pub. **Outcome:** nobody is refused; the room slows down and shortens, one shared copy of the board serves everyone, and a bad night can still be diagnosed the next morning.

This is the section behind Phase 3 of the plan and GATE-003 (*a room of 2,000 works, not just costs an affordable amount*). Everything here is measured or simulated — the ledger's metrics table has the numbers and their dates; **no real big gig has been run**. Every figure below is a pointer to overview §2.1 or the ledger, not a copy.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| l01 | Count the heads | database | Automation | MySet server R | Netlify | `countInRoom` from presence stamps across the twelve fan shards — phones in the room tonight, not just phones that voted. Also `nets`: distinct per-show network hashes (INVARIANT 0ae), so the artist can see one network producing many "phones". `src: _board.mjs; stage.mjs room/nets` |
| l02 | Set the pace | conditional | Automation | MySet server R · Fan I | Netlify | `pollFloorFor(heads)`: three rungs (the thresholds and intervals are in overview §2.1 — *How a room slows down as it fills*). The payload carries it as `nextPollMs`; the page builds all three backoff rungs off it, with ±20% jitter, backing off two rungs when nothing changes, and stopping entirely when the tab is hidden or the phone asleep. The Studio polls every 4 s regardless. **The server sets the pace; the page obeys.** `src: _lib.mjs pollFloorFor; overview §5.4` |
| l03 | Serve one shared board | database | Automation | MySet server R | Netlify | `/api/board` carries no fan id and is held in Netlify's **durable** edge cache for exactly the polling interval, so the whole room is rendered **once per interval**. Measured 2026-09-11: the durable cache ignores any lifetime under 10 s (3–9 bypassed in every spelling; 10 and 60 hit), which is why the middle rung is 10 s and pubs keep a 3 s per-node copy. The browser itself is told `max-age=0, must-revalidate`. `src: board.mjs; decision 0034; INVARIANT 0fh–0fk, 9d6` |
| l04 | Serve the personal call | database | Automation | MySet server R | Netlify | `/api/me`: one shard read, never cached — the fan's own credits, votes, and `remaining`. If it fails the page keeps its board and shows the last known personal state; if the board fails the page keeps the last board and still shows the fan's own cast as theirs (`mergeBoard`/`applyCast`). Verified in a real browser with each half failing in turn. `src: me.mjs; vote.html; ledger verification log 2026-09-11` |
| l05 | Shorten the board | conditional | Automation | MySet server R · Fan I | Netlify | `boardLimitFor(heads)`: past the first rung only the top N songs are sent (N per rung in §2.1). Anything **this fan voted for is concatenated back on** regardless of rank, and the page says so: *"Big room tonight — showing the top N. Songs you voted for stay on your list wherever they are."* A song that silently vanished would read as a lost vote — a trust failure, not a cosmetic one. `src: _lib.mjs boardLimitFor; vote.html 944` |
| l06 | Never refuse a cast for size | conditional | Automation | MySet server R · Fan I | Netlify | There is deliberately **no head-count check** in `vote.mjs`. A room over its plan's audience number keeps voting; the number is a billing line stamped at show start, and the artist is told afterwards. Mentimeter publishes the same policy. Decision 0006. `src: vote.mjs comment block` |
| l07 | Throttle a script | conditional | Automation | MySet server R | Netlify | The token bucket on each fan record (→ *Casting a vote* c12): burst then steady, checked inside the write that already happens, so a refused cast costs no read and no write. A person tapping as fast as they can stays under it. Decision 0030, INVARIANT 0fa. `src: _lib.mjs takeCastToken` |
| l08 | Log the server's own errors | database | Automation | MySet server R | Netlify | Every handler is wrapped in `guard()` (`_errlog.mjs`): an exception is written to a capped **hourly** error document under a computable key in the blob store (Netlify deletes function logs after 24 hours). No vendor, no account, no new dependency. Decision 0029 (supersedes 0013's "a service that outlives the night"). `src: _errlog.mjs; decisions 0013, 0029` |
| l09 | Take a fan's report | form | Person | Fan R · MySet server R · Artist I | Netlify | *"Something wrong?"* on the voting page → `POST /api/bug`: the fan's sentence, the last twenty things the page saw fail, and the three server hours before the note. Read in Studio → Money. GATE-004: *a bug reported by a fan can be traced without reproducing it* — done, 42/42 focused assertions. `src: bug.mjs; vote.html bugSend; ledger GATE-004` |
| l10 | Know the ceiling | research | Person | Founder R | — | `tools/loadsim.py --ceiling` draws the read wall for the busiest case at today's measured record weight (the ledger's *Honest room ceiling* row). The wall is reads, not money; the **write** wall has never been measured (P3-005). A voter's record weighs ~2 KB after eight casts because of the cast receipts (P3-013) — trimming them moves the simulated wall an order of magnitude. **Still do not sell a bigger room.** `src: IMPLEMENTATION_STATUS.md GATE-003, P3-005, P3-013; docs/reports/room-ceiling.html` |
| l11 | The open line (not built) | task | AI Agent | Coding agent R · Founder A | Cloudflare | P3-002: push the board to every phone the instant it changes (Cloudflare Durable Objects) instead of polling. Deferred behind the split and R2 on purpose — it adds a platform (decision 0012; `docs/reports/open-line.html`). Trigger changed 2026-09-11: build it on the founder's word, not on a 2,000-person booking. **Status: Draft.** `src: IMPLEMENTATION_STATUS.md P3-002` |

## Connections

l01 → l02 → l03; l01 → l05; l02 → l04; l03 → l05; l06 and l07 sit on the cast path (→ *Casting a vote*); l08 → l09 (a report bundles the hours l08 wrote); l10 → l11.

## What is simulated versus measured

| Claim | Kind | Where |
| --- | --- | --- |
| 80 simultaneous voters, zero lost votes | measured | INVARIANT 5 |
| Durable cache needs ≥10 s | measured on drafts and production, 2026-09-11 | ledger verification log |
| Busiest-case read wall ~2,500 at today's record weight | **simulation** | `tools/loadsim.py --ceiling` |
| Personal call ~50 ms billed | estimate, never measured | ledger P3-001 next action |
| Write ceiling | **unknown** | P3-005 |
