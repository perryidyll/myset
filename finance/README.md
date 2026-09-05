# finance/ — the MySet Money Model

An interactive projections model for the whole business: how many phones in how
many rooms for how long, what the artists and the rooms pay, what the server and
Stripe take, and what is left. Built 2026-09-05.

| File | What it is |
|---|---|
| `model.html` | The dashboard — **live at myset.vip/financialmodel behind a passcode** (served by `netlify/functions/financialmodel.mjs`, INVARIANT 0ec) and published as a private artifact. One self-contained file: dials (typed cells + sliders), KPI tiles, five charts, the formula line by line, the four show sizes on every host, the scale ladder, month-by-month, up to 20 saved scenarios with automatic summaries. Open it locally (double-click, or serve the folder) or use the published artifact. |
| `actuals.json` | The latest real-show numbers, written by `tools/actuals.py --write`. Paste its contents into the dashboard's **Real shows** panel and switch on "Use real shows". |
| `marks.json` | Bandwidth readings taken with `tools/actuals.py --mark`, before and after each gig; the script solves the polls per phone-hour out of them. |
| `model-test.mjs` | The engine's test suite (`node finance/model-test.mjs`). |
| `../tools/actuals.py` | Pulls every archived night out of production (read-only, via the signed-in Netlify CLI), keeps only nights that actually happened (the rules are at the top of the file), records bandwidth marks, and prints the JSON the dashboard understands. |
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

Three commands, all read-only against production:

```bash
cd ~/Docs/MySet && python3 tools/actuals.py --mark "before Sat gig"
```

Run that the evening **before** a gig and again the morning **after** it (with a
different label). It records Netlify's account-wide bandwidth counter in
`finance/marks.json`. Every audience poll is 2,530 bytes on the wire, so the bytes a
night adds, minus what the Studio tab / page loads / votes cost, is the poll count —
the one number the server projection hangs on, measured instead of guessed. Take two
marks an hour or more apart on a quiet day too: that pair measures what the other four
sites add per hour, which is subtracted from every show window. The counter resets on
the billing-period start (8 Sep this month); marks on either side of that cannot be
compared and the script says so.

```bash
cd ~/Docs/MySet && python3 tools/actuals.py --write
```

Then paste `finance/actuals.json` into the dashboard's Real shows panel. It carries
people and hours per night, room money **per person** by plan (`roomFree` / `roomPlus`
/ `roomPro`) and across plans (`roomPerHead`, which fills any tier that has no figure of
its own — Perry is comped Pro, so his nights land there), account-wide deploys per 30
days, and `pollsPerPhoneHour` once two marks bracket a night (the model solves the
screen-on dial from it). Which nights count is written at the top of the script; the
ones it refuses are listed under `notCounted` with the reason, so nothing is thrown
away silently. When the dashboard is the published artifact, the same JSON can be
written into its shared store as `actuals/current` so every device sees it.

On the night: count heads once (the app keeps the room count itself), leave the Studio
tab open the whole set (it is ~30% of a night's bytes, so the solve assumes it was),
and **end the show in the Studio** — two of the seven nights on file are unusable
because they were not (one ran 107.9 hours).

## Testing the engine

```bash
cd ~/Docs/MySet && node finance/model-test.mjs
```

The engine block is extracted from `model.html` and run in Node. It checks the ladder
against the Python simulator at eight room sizes, re-computes one month independently,
checks the free-tier cap, break-even (brute-forced at three settings), the timeline,
the show sizes on every host, the big-room brake, the 3-second cache, the calibration
solver, the audit-fix regressions, and that `tools/actuals.py`'s byte constants still
match the model's (so the bandwidth method cannot drift from the engine).
