# 2026-09-12 — Money model: light/dark toggle, and the plan for the split + open line

## What the user asked

1. What are the next steps for updating the money model to reflect the shared-board split
   (decision 0034) and the open line (decision 0035)?
2. A light-mode toggle on the money model page.

## What was done

### Light / dark toggle — `finance/model.html`

- A small `LIGHT` / `DARK` button at the right end of the stamp row (`#themeBtn`).
- Sets `data-theme` on the root element; the page already had the three-state token
  system (bare `:root` = light, `prefers-color-scheme: dark` guarded by
  `:not([data-theme="light"])`, `[data-theme="dark"]`), so the choice wins over the system
  setting in both directions.
- Remembered in this browser as `localStorage['myset.model.theme']` and applied by a
  three-line script right after the stylesheet, before first paint — no flash.
- The existing `MutationObserver` on `data-theme` already repaints the charts.
- Verified in the in-app browser on the local static server: click → light ground
  `rgb(242,241,238)`, button reads `DARK`, saved value `light`; reload keeps it; no console
  errors. `node finance/model-test.mjs` — all 53 pass.

### Plan — what the split and the open line change in the model (not built yet)

The model's engine (`gigTraffic`) still prices the **old** poll: one request per tick per
phone, one function call whose time grows with the room, 15 document reads each. The repo's
simulator (`tools/loadsim.py`) already models the split; the model page does not. Order of
work, smallest evidence-bearing step first:

1. **Port the split into the engine, from the simulator, with a parity test.**
   - One tick = two requests: the shared board (cached; 3 s per edge node up to 200 phones,
     10 s shared by the whole room from 201, 20 s from 3,001 — `pollFloorFor`) and the
     personal call (never cached, 2 reads, ~50 ms).
   - Board renders = `hours × 3600 ÷ interval` × (1 … nodes) — the simulator prints best and
     worst case because how many edge nodes a bar's phones land on is unknown; the model
     should carry the same range, not a point.
   - Bytes per tick = board (~2,180) + personal (~430) instead of one 2,530 poll.
   - Reads: 15 per board render, 2 per personal poll (from `test/cost.mjs`), not 15 per poll.
   - Function time: the personal call no longer grows with the room; the board render does,
     but it is shared.
   - Pin the engine to the simulator's 11-phone / 2.74 h figures (8.9 credits best case,
     13.3 worst; 20-phone gig 2.70¢ → 3.01¢) in `finance/model-test.mjs`, the way the clip
     bytes are pinned to `tools/actuals.py`.
   - Retire the "Netlify + 3-second cache on the poll (not built)" host — it is built. Keep
     "Netlify, before the split" as the comparison column.
   - Big-room status column: the simulated read wall moved from ~700–1,000 phones to ~2,500
     at today's 2 KB fan record. The dial that says "every poll reads every fan record" is
     no longer true of the personal call — rewrite that copy.

2. **Measure it at a real gig before trusting it.** The next calendar gig on the split code
   is Sunday 13 Sep, Sand & Tan. Take `python3 tools/actuals.py --mark "before Sun gig"` and
   `--mark "after Sun gig" --studio-min N --clip-views 0`, then read Netlify's per-function
   counts for `board` vs `me` for the night — the ratio is the cache-hit rate the simulator
   can only guess. Update the tracker's `BYTES` table (`board`, `me` instead of `poll`) and
   `solve_polls` so the bandwidth mark solves for ticks, not old polls.

3. **Feed the measurement back** — `pollsPerPhoneHour` becomes ticks per phone-hour;
   `calibrateLook` keeps working unchanged once the engine counts ticks.

4. **Rewrite the Durable Objects host from the probe's measured numbers** (decision 0035),
   replacing the list-price guess in both the model and the simulator:
   - two billed requests per connection (upgrade + close), not one;
   - duration ≈ 0 — hibernation made 12,000 connections cost 13.65 s of billable time;
   - outbound messages free; one vote → N boards, last arrival 179 ms at 1,000 sockets;
   - Workers Paid $5/month base; requests $0.30/M after 10M; DO requests $0.15/M after 1M;
   - a new dial: reconnections per phone per gig (a bar's Wi-Fi drops; each is two requests);
   - Netlify stays for pages, the Studio and the writes — the DO column must be Netlify +
     Cloudflare, not Cloudflare alone.

5. **Only after the production open-line design exists** (0035 said: design after the split
   lands — the design decision is still to be written), add it as the `host` the Benchmark
   case can be switched to, with the polling path kept as the fallback for phones that
   cannot hold a socket. The model then needs a "share of phones on the socket" dial.

6. Re-run the projection deltas and republish, the way the gig-week report did.

What this does NOT change: room money per head, the plan mix, deploys — the split moves the
server line (≈ 3% of revenue in the Benchmark case), not the revenue line. The biggest
uncertainty is still $0.375 per voter from one $3 sale.

## For the user

- Commit on `main`, pushed; the live `/moneymodel` picks up the toggle on deploy (15 credits).
- Sunday's marks are the first measurement of the split at a real gig.
