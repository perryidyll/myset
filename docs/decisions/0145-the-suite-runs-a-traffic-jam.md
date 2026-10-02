---
id: 0145
title: The suite runs a traffic jam — a big room on a virtual clock, on every run
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: scale
reverses:
superseded_by:
invariants: [0ht]
commits: []
tests: [test/contention.mjs]
files: [tools/roomsim.mjs, test/contention.mjs, test/blobs-fake.mjs, test/run.sh]
---

## The question

The scale audit of 2 October 2026 found that the test suite cannot see a traffic jam. Every test calls the handlers one at a time against a store that answers in the same tick, so one write never meets another: `casDoc`'s retry loop barely runs and "busy" never does. The largest real room so far is 18 phones. Every finding in the audit's "one big room" section came from a simulator the audit built outside the repo. The founder asked for phase two of the audit's fixes; this is its first item, and the one the others are proven with.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The audit's simulator moves into the repo as `tools/roomsim.mjs`; the test store gains a latency mode where a conditional write is judged when it lands; `test/contention.mjs` runs five rooms through it on every suite run | About 15 s on a suite of about 85 s | One tool, one test file, one mode on the fake store | A model mistaken for a measurement (see below) |
| B | Keep the simulator outside the repo and run it by hand | Nothing | None | Nobody runs it; the next change to the vote path ships unproven |
| C | A real load test against a separate site | A second Netlify site and its credits | A site, a script, a schedule | The right proof, but it is its own item (the founder's word is needed for the site) and it cannot run on every pull request |
| D — do nothing | | | | The suite stays blind to the one failure the audit rated most likely at scale |

## What was chosen, and why

A, and C stays on the list as the measurement A cannot give.

- **One store, not two.** The audit's simulator had its own fake store. Here the suite's fake (`test/blobs-fake.mjs`) gets `__latency`: a read takes time, and a write waits its own delay and is then judged against the etag. Off by default, so every other test is unchanged.
- **A virtual clock.** `node:test` mock timers, so one process's CPU time does not bend the timing of what would be thousands of function calls.
- **A seeded run repeats to the byte** (on Node 24 and later). One seeded source replaces `Math.random` for the whole process, the handlers' retry jitter included, and every function module is loaded before the virtual clock starts. A number that moves moved because the code did. On Node 20 and 22 (GitHub's runner is 22) the module loader's first use of a dynamically imported module takes a varying number of event-loop turns, so the same seed gives the same outcome (every answer, every vote landed or lost) but not the same timings, and the suite compares the outcome there.
- **What is asserted is the shape, not the speed.** A vote the fan was told landed is on the board. A vote that could not land was refused (a 503), never dropped. Nobody waits past the function limit in a room the product says it can hold (5,000 phones, 75 votes a second). The times are printed and only loosely bounded.
- **Play's known gap is measured, not asserted.** A vote that read the show before Play and landed after it stays on the song that just started (8 at 5,000 phones in the seeded run). The fix is its own decision; when it lands the printed line becomes an assertion of zero.

## What this makes harder

- The suite is about 15 seconds slower.
- The numbers look like measurements and are a model: 42 ms reads and 80 ms writes are assumptions. The store's real write time is still unmeasured (ledger P3-005).
- The fake's read answers with what is there as the read returns, the kind end of the truth. A stricter model would show a little more contention.

## What would reverse it

- A real load test on a separate site that disagrees with the model: then the model's constants change, or it goes.
- The live room leaving the twelve shared files (one small file per fan, or a Durable Object): the rooms asserted here would need rewriting around the new shape.

## How it was verified

- `node test/contention.mjs`: 22 ✓, 0 ✗. Rooms: a pub (200 phones, 90 votes in 10 s), a big room (5,000 phones, 1,500 votes in 20 s: all answered yes, all on the board, slowest 3.9 s), the doors (5,000 arrivals in 60 s), a stampede on a slow store (800 votes in one second with 400 ms writes: 62 refused, none dropped), Play mid-rush.
- The big room reproduces the audit's own run (1,500 of 1,500 landed, half in about 460 ms).
- Two knock-outs, both red: the retry loop cut to 3 tries (4 ✗), and the conditional write made unconditional (6 ✗).
- `sh test/run.sh` exited 0 with the new section in it.
- **Not checked:** anything on production. No real room was loaded. The model's two constants are unmeasured.
