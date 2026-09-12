---
tab: The gig
section: Shows that start and end themselves
puzzle_section_id: 41969
sources:
  - netlify/functions/autocron.mjs (schedule */2, lock, heal, purge, clip sweep)
  - netlify/functions/_auto.mjs (END_GRACE_MS, IDLE_MS, SHOW_IDLE_MS, occKey, the gigsched index)
  - netlify/functions/_lifecycle.mjs (startShow/endShow — the one implementation)
  - MYSET-MASTER-OVERVIEW.md §5.7
  - INVARIANTS.md 1, 0i, 9d9, 9d13, 13b, 16, 17c
  - docs/decisions/0021
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps with roles, tools, connections)
verified: code read 2026-09-12 (autocron.mjs config; _auto.mjs constants and guards)
---

# Shows that start and end themselves

**Who:** the scheduled function (role *Scheduled jobs*). **Trigger:** `autocron.mjs` rings every two minutes (`schedule: '*/2 * * * *'`). **Outcome:** a calendar gig's show is live at its start time even if the artist forgot, and ended a grace period after its scheduled end even if they walked off stage without tapping — and an idle show is ended so nothing runs all night. Neither path ever touches the audience poll.

The founder's rule (2026-09-04): a gig on the calendar starts its show at the gig's start time if the artist hasn't already, and ends it three hours after the gig's scheduled end if the artist hasn't already. Decision 0021.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| s01 | Ring | signal | Automation | Scheduled jobs R | Netlify | Every two minutes. A show can therefore start up to two minutes late — inside what the room notices. Same discipline as the sheet cron: the scheduler's `next_run` marker is logged, never enforced; errors are **logged, never thrown** (a thrown scheduled function is retried). `src: autocron.mjs header` |
| s02 | Take the lock | conditional | Automation | Scheduled jobs R | Netlify | Skip if the last run was seconds ago; *"another run is in progress"* / *"lost the lock"* → return 200 `busy`. Two rings cannot act at once. `src: autocron.mjs 37–52` |
| s03 | Read the one index | database | Automation | Scheduled jobs R | Netlify | `gigsched` — one global document rewritten by every calendar write (the `cityindex` pattern, INVARIANT 0i). A tick reads **one** document to learn who has a gig due; it never `list()`s (INVARIANT 1) and never walks every artist's calendar (9d13). A quiet ring costs one read. `src: _auto.mjs; overview §5.7` |
| s04 | Is a gig due to start? | conditional | Automation | Scheduled jobs R | Netlify | Now is inside the occurrence window and the artist has not skipped it. Venue-owned events (`v_…`) are never shows. `src: _auto.mjs 179` |
| s05 | Start the show | task | Automation | Scheduled jobs R · MySet server R · Artist I | Netlify | `startShow(aid, {by:'schedule', occKey, eventId})` — the **same** function the Studio button calls, so the gig cap, the archive, tonight's setlist, the venue name and the paid-vote carry happen identically (9d9, 17c, 13b). The occurrence key is stamped on the show so the same gig is **never started twice**, and a night the artist ended early **stays ended**. Won't start with no songs switched on. The Live tab says *started by itself*. `src: _lifecycle.mjs; _auto.mjs` |
| s06 | Cap refused? | conditional | Automation | Scheduled jobs R · Artist I | Netlify | A free-plan cap refusal is remembered on the index entry so it is **not retried every two minutes** for the rest of the night. `src: _auto.mjs header` |
| s07 | Is a gig past its grace period? | conditional | Automation | Scheduled jobs R | Netlify | `now ≥ endsAt + END_GRACE_MS` and the show is live. If the show started **after** that moment it is *a later show* and left alone. `src: _auto.mjs 151–153` |
| s08 | Is a song still recent? | conditional | Automation | Scheduled jobs R | Netlify | A song started within `IDLE_MS` means the set is still on → **defer to the next tick** (never end mid-song, INVARIANT 16) — unless the show is *stale* (six hours past the grace period), in which case it ends anyway. `src: _auto.mjs 161–162` |
| s09 | End the show | task | Automation | Scheduled jobs R · MySet server R · Artist I · Fan I | Netlify | `endShow(aid, {by:'schedule'})` — archive first, always. The Live tab says *ended by itself*. **A night where nothing happened — no song, no vote, no phone — is not archived**, so an empty scheduled start never becomes "Shows: 1". `src: _lifecycle.mjs endShow; overview §5.7` |
| s10 | End idle shows | task | Automation | Scheduled jobs R · Artist I | Netlify | Any live show with nothing happening for `SHOW_IDLE_MS` is ended (*"ended after three idle hours"*) — the guard against a show left running all night burning polls. Decision 0021. `src: _auto.mjs 220–222` |
| s11 | Heal the index | task | Automation | Scheduled jobs R | Netlify | Once a day: walk the artist registry (one global read) and re-point every artist from their own calendar (one read each), in batches with a cursor — catches gigs saved before the index existed and any entry a lost write dropped. `src: _auto.mjs "THE HEAL"` |
| s12 | Sweep the leftovers | task | Automation | Scheduled jobs R | Netlify | Purge expired rows; drop unposted clips left in `vidqueue`. Each in its own try/catch, logged. `src: autocron.mjs 69–81` |

## Connections

s01 → s02 —lock→ s03 → s04; s04 —due→ s05 → s06; s04 —not due→ s07; s07 —past→ s08; s08 —recent song→ *defer*; s08 —idle or stale→ s09; s07 —not past→ s10 → s11 → s12.

## Nine ways a night could vanish (closed 2026-09-05)

Worth keeping on the canvas as notes on s05/s09, because they are the shape of the bugs this section exists to prevent: a Stripe hiccup that threw past the archive into an empty catch; an index row built from the wrong snapshot; two writes ending in `.catch(() => {})`; a `status === 'pre'` guard that made every later archive return null for ever; an index cap of 100 that stranded row 101 invisibly; and a browser cache never invalidated, so ending a show made the night *look* lost. The **heal** behind *Look for missing shows* rebuilds an artist's index from every id it can name. `src: overview §5.7`
