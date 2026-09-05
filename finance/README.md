# finance/ — the MySet Money Model

An interactive projections model for the whole business: how many phones in how
many rooms for how long, what the artists and the rooms pay, what the server and
Stripe take, and what is left. Built 2026-09-05.

| File | What it is |
|---|---|
| `model.html` | The dashboard — **live at myset.vip/financialmodel behind a passcode** (served by `netlify/functions/financialmodel.mjs`, INVARIANT 0ec) and published as a private artifact. One self-contained file: dials (typed cells + sliders), KPI tiles, five charts, the formula line by line, the four show sizes on every host, the scale ladder, month-by-month, up to 20 saved scenarios with automatic summaries. Open it locally (double-click, or serve the folder) or use the published artifact. |
| `actuals.json` | The latest real-show numbers, written by `tools/actuals.py --write`. Paste its contents into the dashboard's **Real shows** panel and switch on "Use real shows". |
| `../tools/actuals.py` | Pulls every archived night out of production (read-only, via the signed-in Netlify CLI), keeps only nights that actually happened, and prints the JSON the dashboard understands, plus this period's deploy rate. |
| `../docs/sessions/2026-09-05-money-model.md` | The session record: what was asked, what was built, what the research panel found, what is still open. |

## How the model works, in one paragraph

Every number on the page comes out of one block of code at the top of the
script, marked `ENGINE-START` … `ENGINE-END`. It simulates the voting page's real
polling ladder (3 s → 10 s → 25 s, nothing while the screen is off — copied from
`public/vote.html`, calibrated to `tools/loadsim.py` within 3%) for a room of a
given size and length, turns the polls, votes, Studio polls and page loads into raw
units (requests, bytes, function time, document reads, writes), prices those units
on whichever host is selected, and lays the revenue lines (subscriptions, MySet's
cut of the room's money, featured shows) and the cost lines (server, Stripe on
MySet's own charges, Express fees, fixed costs) beside them.

## Where the numbers come from

- **Measured** through the real code on 2026-09-05: bytes per poll (2,530), reads per
  call (15 poll / 4 vote / ~17 Studio), 42 ms per document read. The 155 ms per
  poll was a probe before a fix; the account's bill implies 70–110 ms, so the
  default is 120.
- **Published** on 2026-09-05: Netlify credit rates and plan tiers, Cloudflare
  Workers/KV/Durable Objects, Vercel Fluid compute, Stripe US card / Billing /
  Connect Express / dispute fees. Links in the page footer.
- **Simulated**: the 20-phone, 3-hour reference gig (6,030 polls, 4.2 credits at
  155 ms). The only real night so far had 8 voters, so every crowd figure above
  that is simulation from measured inputs — and the page says so.
- **Guessed** (the dials): artists, plan mix, gigs, room size, what a room spends,
  featured share, fixed costs. Replace them with real numbers as they arrive.

## Keeping it honest as real shows happen

```bash
cd ~/Docs/MySet && python3 tools/actuals.py --write
```

Then paste `finance/actuals.json` into the dashboard's Real shows panel. If you
read the function-invocation count for a night from the Netlify dashboard, add
`"pollsPerPhoneHour": <invocations ÷ phones ÷ hours>` and the model will solve for
the screen-on share that reproduces it. When the dashboard is the published
artifact, the same JSON can be written into its shared store as `actuals/current`
so every device sees it.

## Testing the engine

The engine block is extracted from `model.html` and run in Node by the session's
test (`model-test.mjs` in the session scratchpad; copy lives in
`docs/sessions/2026-09-05-money-model.md`). It checks the ladder against the
Python simulator at eight room sizes, re-computes one month independently, checks
the free-tier cap, break-even, the show sizes, the big-room brake, the 3-second
cache and the calibration solver.
