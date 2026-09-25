# finance/ — the MySet Money Model

An interactive projections model for the whole business: how many phones in how
many rooms for how long, what the artists and the rooms pay, what the server and
Stripe take, and what is left. Built 2026-09-05.

| File | What it is |
|---|---|
| `model.html` | The dashboard — **live at myset.vip/moneymodel behind a passcode** (served by `netlify/functions/moneymodel.mjs`, INVARIANT 0ec) and published as a private artifact. One self-contained file: dials (typed cells + sliders), KPI tiles, five charts, the formula line by line, the four show sizes on every host, the scale ladder, month-by-month, up to 20 saved scenarios with automatic summaries. Open it locally (double-click, or serve the folder) or use the published artifact. |
| `actuals.json` | The latest real-show numbers, written by `tools/actuals.py --write`. Paste its contents into the dashboard's **Real shows** panel and switch on "Use real shows". |
| `marks.json` | Bandwidth readings taken with `tools/actuals.py --mark` — two hours before a gig, just before it and after it; the script solves the ticks per phone-hour out of a bracket that has a quiet pair of its own day. |
| `credits.json` | Netlify's own credit meters, read off the dashboard by hand and appended (never edited): the per-category split, and since 25 Sep the per-day COUNTS — requests, compute, bandwidth — the tracker's meter method reads a night's cost from. |
| `model-test.mjs` | The engine's test suite (`node finance/model-test.mjs`). |
| `fixtures/2026-09-11/` | A read-only snapshot of every archived night, the calendar and the fan requests as of 11 Sep 2026 (nothing secret) — what `tools/actuals-test.py` runs the night rules against. |
| `reports/` | The plain-language reports: `2026-09-11-gig-week-one.html` (the first gig week) and `2026-09-25-fortnight-audit.html` (fifteen nights in; the artifact "Fifteen Nights In"). |
| `../tools/actuals.py` | Pulls every archived night out of production (read-only, via the signed-in Netlify CLI), keeps only nights that line up with a gig on the artist's published calendar (the rules are at the top of the file), records bandwidth marks, and prints the JSON the dashboard understands. |
| `../tools/actuals-test.py` | Offline tests of those rules against the fixtures, plus the bandwidth solver on synthetic marks. |
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

## What the first gig week changed (11 Sep 2026)

Five real nights (30 Aug; 6, 7, 8, 9 Sep) replaced the one-night seed: 11 phones a
night, 2.74 h, 2.35 votes + requests per phone, 216 deploys a month. Room money is
still the single $3 pack from 30 Aug — card payments were down until Tue 8 Sep
evening, and a bug in the archive's Stripe call (fixed that day, INVARIANT 0fc) hid
every night's money regardless. The page opens on the real nights unless you switch
them off. A **profile clips watched per gig** dial was added (a guess, 0.5) because
three ~75 MB clips, not polls, were most of the bandwidth. Full record:
`../docs/sessions/2026-09-11-gig-week-one.md`; the report: `reports/`.

## Keeping it honest as real shows happen

Three commands, all read-only against production:

```bash
cd ~/Docs/MySet && python3 tools/actuals.py --mark "before Sat gig"
```

The founder's way, no git and from any folder: `~/Docs/MySet/tools/mark.sh before "Seaflower"`,
then `… start "Seaflower"`, then `… after "Seaflower" 40` (40 = minutes the Studio's Live tab
was on screen; leave it off if unsure). It writes to `~/.myset-marks.json`; the tracker reads
that file alongside `finance/marks.json` and folds it in on its next `--write`.

Three marks make a night: one about **two hours before** the gig, one **just before it
starts** (those two are the quiet pair — the background of that very day, taken with nothing
else running: no tracker pass, no probes, no agent reading the store), and one
**after** it ends (with `--studio-min N --clip-views 0`: one view of a posted clip is
~75 MB, twenty thousand ticks' worth, so say how many there were). Each records Netlify's
account-wide bandwidth counter in `finance/marks.json`. Every audience tick is 3,470 bytes
on the wire (the 79-song board + the personal call), so the bytes a night adds, minus the
background and minus what the Studio tab / page loads / votes cost, is the tick count. Two
rules, since 25 Sep (decision 0089, INVARIANT 0ge): a quiet pair is applied only to a
bracket within 48 h of it — the account's idle traffic changed 10× inside a fortnight, so
last week's pair says nothing about tonight — and a bracket longer than 24 h is withheld;
the script says why in `pollsByNight`. The counter resets on the billing-period start (8
Sep this month); marks on either side of that cannot be compared and the script says so.

When no bracket qualifies — most of the time — the tracker reads the same two numbers
off **Netlify's own per-day meters** instead: copy the day's requests, compute and
bandwidth off Usage & billing › Credits into `finance/credits.json` (`perDay.days[]`,
with `webRequestCount`, `functionsCompute`, `bandwidthMB`), and `solve_meters` takes a
gig day minus an empty day (no record, no published slot), subtracts the Studio tick,
the page loads, the votes and the extra pages, halves what is left (a tick is two
requests) and divides by phone-hours. It also gives `creditsPerShow` — what one night
adds to the traffic bill, never a deploy — which the page shows against its own figure.

```bash
cd ~/Docs/MySet && python3 tools/actuals.py --write
```

Then paste `finance/actuals.json` into the dashboard's Real shows panel. It carries
people and hours per night, room money **per person** by plan (`roomFree` / `roomPlus`
/ `roomPro`) and across plans (`roomPerHead`, which fills any tier that has no figure of
its own — Perry is comped Pro, so his nights land there), account-wide deploys per 30
days, and `pollsPerPhoneHour` — from Netlify's per-day meters once the counts are on file, or
from marks that bracket a night with a same-day quiet pair — with `pollsSource` saying which
(the model solves the screen-on dial from it). Which nights count is written at the top of the script; the
ones it refuses are listed under `notCounted` with the reason, so nothing is thrown
away silently. When the dashboard is the published artifact, the same JSON can be
written into its shared store as `actuals/current` so every device sees it.

On the night: count heads once (the app keeps the room count itself), notice how long the
Studio's Live tab is actually on screen (both methods assume 60% of the night; it only
polls while it is on screen and the show is live), and **end the show in the Studio** — a
record left open runs on to the auto-end and reads as a longer night than it was.

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

## What the second fortnight changed (25 Sep 2026, decision 0089)

Fifteen nights on file (was eight): 8.6 phones, 2.73 h, 2.09 votes + requests a phone,
10 songs a night, $1.04 a head over the eleven nights with readable money ($85 across 82
phones — three nights carry 85% of it, the median night is $0; seven $10 card tips, two $5
vote packs, two $1 test tips), 286 deploys in 30 days. Netlify's own per-day meters, read for the first
time as an instrument: an empty day (Sat 19 Sep) is 3,200 requests, 1.7 credits of
compute and 13.7 MB; a night with a room adds about **3 credits** on top (2.3–3.8 over
the seven nights of 16–23 Sep) and the figure barely moves with the room's size, because
the Studio's own tick and the page loads are most of it. Read as ticks that is ~40 per
phone-hour — the model's 22% screen-on guess of 5 Sep gave 95 — so the screen-on dial
is now solved from the meters (about 9%). The board on the wire is 3,040 B (79 songs; was
2,175 for 40). Two things the numbers falsified: the "3 credits of compute + 1 of
requests a day" background quoted on 14 Sep (it was ~1.7 + 0.6 once the mirror stopped
moving clips), and the bandwidth counter as a per-night instrument without a same-day
quiet pair (the two rules above). This period: 119 production deploys = 1,785 credits
(94%) against 117 credits for everything every room did; the $9 Personal plan's 1,000
credits ran out on 15 Sep and a 500-credit pack bought itself. Record:
`../docs/sessions/2026-09-25-fortnight-audit.md`; the report: `reports/`.

## Two bills, never one number (14 Sep 2026, INVARIANT 0fx, decision 0077)

The server bill is two bills that have nothing to do with each other. The **traffic
bill** is what the rooms cause — web requests, bandwidth, function compute — and it
scales with gigs, phones and hours. The **shipping bill** is production deploys × 15
credits, and it scales with how often code is shipped and with nothing a room does.
Three times a "server cost per gig" carried the deploys spread over the gigs and
polling looked dear when shipping was (on the first gig week deploys were 98% of the
credits; the four gigs were 18¢). So:

- `hostBill()` returns `trafficUsd` (the same month at zero deploys) and `deployUsd`
  (what the deploys add on top); every per-gig, per-phone, per-tier and per-show
  figure on the page comes from the traffic bill alone.
- `tools/actuals.py` reports `shipping` (deploys and their credits) and `traffic`
  (the bandwidth counter) as two objects, and nothing per show, phone or hour may
  contain a deploy. `BYTES` has no deploy entry.
- `finance/model-test.mjs` turns the deploys dial from 0 to 400 on every host and
  fails if any per-gig figure moves, if the two bills do not sum to the total, or if
  the tracker divides deploys by anything.
- The exact split by category lives on Netlify's Usage & billing › Credit usage
  breakdown; the API exposes only the deploy list and the bandwidth counter.

When you read a server figure anywhere — this page, a report, a chat — ask which bill
it is. If it is "per gig" and it is not the traffic bill, it is wrong.

`credits.json` is the one place Netlify's own per-category split is kept: a reading of
Usage & billing › Credit usage breakdown (and the per-day chart), appended by hand with
the date it was read. The API cannot give it. `tools/actuals.py` carries the latest reading
into `actuals.json` as `shipping.dashboard` / `traffic.dashboard`, and the page's "Two
bills" note quotes it. First reading, 14 Sep 2026, period from 8 Sep: deploys 1,290 of
1,340.2 credits (96.3%); everything the rooms did — 39,505 requests = 7.9, compute 20.8,
bandwidth 21.5 — 50.2 credits. Third reading, 25 Sep: deploys 1,785 of 1,902 (93.8%);
the rooms 100,804 requests = 20.2, compute 54, bandwidth 42.8 — 117 credits. Since 25 Sep a
reading also carries the per-day counts the meter method needs (see above).
