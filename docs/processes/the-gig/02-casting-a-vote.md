---
tab: The gig
section: Casting a vote (server path)
puzzle_section_id: 41965
sources:
  - netlify/functions/vote.mjs (read in full, 2026-09-12)
  - netlify/functions/_lib.mjs — mutateFan, chargeVotes, creditsUsed, takeCastToken, isUnlimited, costOf
  - MYSET-MASTER-OVERVIEW.md §1.4, §1.5, §1.9, §1.11, §1.12
  - INVARIANTS.md § Storage (1–5), § Show behaviour, § Live-show safety (15h, 0ae, 0fa)
  - docs/decisions/0001, 0008, 0030
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps with roles, tools, connections)
verified: code read 2026-09-12 — every refusal below is quoted from vote.mjs with its status code
---

# Casting a vote (server path)

**Who:** `POST /api/vote` with `{fan, song, n, cast}` (role *MySet server*). **Trigger:** the fan pressed Confirm. **Outcome:** `n` song ids appended to the fan's `v`, the ledger charged once, the cast id remembered — or a refusal that writes nothing.

The order matters and is the order in the code. Steps c01–c06 run **before** the fan document is touched; c07–c13 run **inside the fan mutation** so two racing retries cannot both get past them.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| c01 | Clamp the quantity | task | Automation | MySet server R | Netlify | `n` = `max(1, min(50, floor(body.n)))`. The affordability check is what really bounds it; the cap only stops a hand-made request turning one fan record into a million-element array. `src: vote.mjs; overview §1.5 (1)` |
| c02 | Validate the cast id | conditional | Automation | MySet server R | Netlify | `cast` must match `^[A-Za-z0-9_-]{8,64}$`. **Malformed → 400 "bad cast id"** — refused rather than ignored, because silently dropping it removes the one thing it exists to provide (idempotency on bar wifi). Absent is allowed (legacy pages). `src: vote.mjs; INVARIANT 15h` |
| c03 | Resolve the artist | conditional | Automation | MySet server R | Netlify | The artist id comes from the **host/slug or the session, never the request body**. Unknown → 404 "unknown artist". `src: overview §1.11; _lib.mjs publicArtist` |
| c04 | Has the show ended? | conditional | Automation | MySet server R | Netlify | `show.status === 'ended'` → **409 "The show has ended"**. `src: vote.mjs` |
| c05 | Is the song on tonight's list? | conditional | Automation | MySet server R | Netlify | Not in the show's songs → **404 "That one isn't on tonight's list"**. `src: vote.mjs` |
| c06 | Is it playing right now? | conditional | Automation | MySet server R | Netlify | `show.nowPlaying === song` → **409 "That one is playing right now"**. `src: vote.mjs` |
| c07 | Open the fan mutation | database | Automation | MySet server R | Netlify | `mutateFan(aid, fan, fn, verify)` on shard `f<hash>_<aid>` (12 shards so a burst does not contend on one key; load-tested 80 simultaneous voters, zero loss). Strong-consistency read, conditional write, **re-read after writing, retry if the votes did not stick** — compare-and-swap alone is not enough on this store. Stamps `ipH` (per-show network hash) if absent, so `nets` counts one network making many phones. `src: INVARIANTS 1–5, 0ae; decision 0008` |
| c08 | Is the voting window open? | conditional | Automation | MySet server R | Netlify | `!show.windowOpen` → **409 "Voting is closed right now"** and **no changes at all**, in or out. `src: vote.mjs` |
| c09 | Seen this cast id before? | conditional | Automation | MySet server R | Netlify | A prior entry in `me.casts` with this id → return **exactly what it returned the first time** (`replay: true`) and write nothing. Checked inside the mutation so racing retries cannot both pass. Up to 20 receipts kept (`CASTS_KEPT`) — this is most of a voter's ~2 KB record, see P3-013. `src: vote.mjs; INVARIANT 15h` |
| c10 | Is this an old page asking to clear? | conditional | Automation | MySet server R | Netlify | `op === 'clear'` → **409 "Those votes are cast — they stay with the song"**. The un-vote branch was deleted 2026-09-07; a cached page is told why in words a person can act on. `src: vote.mjs; decision 0001; overview §1.16` |
| c11 | Can the fan afford it? | conditional | Automation | MySet server R | Netlify | `cost` = 1 for an unplayed song, the artist's replay cost for a played one (`costOf`). `total` = the show's free allowance + `me.extra` (bought stock). Unless the device or room is unlimited: `creditsUsed(me) + cost×n > total` → **402 "no-credits"**. Enforced here; the page's stepper is a convenience, not a control. `src: vote.mjs; overview §1.3, §1.11` |
| c12 | Take a rate-limit token | conditional | Automation | MySet server R | Netlify | Token bucket on the fan record (`rl`): a burst of `CAST_BURST` casts, then `CAST_PER_MIN` a minute (values in overview §2.1). Empty → **429 "Easy — that's a lot of taps. Give it a few seconds"**, and nothing is written. Deliberately **after** the credit check: a fan who is out of votes keeps hearing that, and only casts that would have landed spend a token. The hole it closes is a script running up the write bill. `src: _lib.mjs takeCastToken; decision 0030; INVARIANT 0fa` |
| c13 | Charge, attribute, push | database | Automation | MySet server R | Netlify | `chargeVotes()` moves `used` and `freeUsed` (free credits spent first; `freeUsed` stamped **now**, never re-priced if the artist changes the allowance mid-show) and appends each vote's `[cost, paidCredits]` source tuple to `va[song]`. An unlimited device is charged nothing but still stamped, so `used` stays honest if unlimited is switched off mid-show. Then `n` copies of the song id into `v`; `ts[song]` stamped only if absent (ties are broken by first vote); `lastAt` set; the cast receipt `{id, at, out}` pushed. `src: vote.mjs; overview §1.4, §1.9` |
| c14 | Verify the write stuck | conditional | Automation | MySet server R | Netlify | The re-read must show `held(me) === mine + n`; otherwise the mutation retries. A store error → **503 "busy"** and the error is logged to the hourly error document (`logErr('vote', …)`). `src: vote.mjs; INVARIANT 4` |
| c15 | Answer the phone | notification | Automation | MySet server R · Fan I | Netlify | `{ok, voted, votes: n, cost, remaining}` (`remaining` is `null` when unlimited). The page merges it locally (`applyCast`) and the next board poll confirms it. `src: vote.mjs; public/vote.html` |

## Connections

c01 → c02; c02 —valid or absent→ c03; c02 —malformed→ *400*; c03 → c04 → c05 → c06 → c07 → c08 → c09; c09 —new→ c10; c09 —seen→ c15 (replay); c10 → c11; c11 —affordable→ c12; c11 —not→ *402*; c12 —token→ c13; c12 —empty→ *429*; c13 → c14; c14 —stuck→ c15; c14 —did not stick→ c07 (retry). Every refusal (c04–c06, c08, c10) → *the phone shows the sentence*.

## Rules that guard this section (link as changelog / notes)

- A vote never comes back — decision 0001; the only setlist exception is the artist's decline of an unplayed song — decision 0016 (that path is in *The artist's night*).
- Never `list()` for live data; every key computable — decision 0008, INVARIANT 1.
- Charging happens at the cast and never again (§1.5). Spend cannot be derived from `v` because a played song removes its votes from `v` (§1.4).
- There is deliberately no head-count check — decision 0006.
