# 2026-09-25 — The fortnight audit: fifteen nights, Netlify's own meters, the screen-on dial measured

**Asked:** a detailed audit of all the numbers since the last one (14–15 Sep), a concise
artifact report of the findings, the money model fully updated, and a full run-through of
the model to make sure it works and the projections are as solid as the real data allows.

## What the fortnight held (15 Sep → 25 Sep, read from production, read-only)

- **Eight more nights filed** (15–23 Sep); seven had a room, one (Tue 15 Sep, Crystal Day)
  had one phone and no votes. Thu 24 Sep's Crystal Day slot ran to an empty room and, by
  design, filed nothing (the archive refuses a night where nothing happened). **Fifteen nights
  on the model now** (was eight): 8.6 phones a night (2–18), 2.73 h, 2.09 votes + requests a
  phone, 16.6 votes, 10 song starts (one every ~16 min), 4.1 voting at the peak. The app was
  used at 15 of 22 published gigs (68%).
- **Money:** eleven nights with readable takings, $85 across 82 phones = **$1.04 a head**
  (was $1.03 on four nights). It is lumpy: three nights carry 85% of it (14 Sep $22, 16 Sep
  $15, 20 Sep $35); the median night is $0. Seven $10 card tips — every real tip has been
  the middle preset — plus two $1 test tips, the $3 pack of 30 Aug and the first two $5 vote
  packs since then (16 and 20 Sep): $72 + $2 + $3 + $10 = $85. The 14 Sep
  record now reads $22, not $20: two $1 test tips from 15 Sep midday fell inside its money
  window (decision 0081) — 2¢ a head across the set, noted, not corrected (production is
  read-only here and the window rule is right).
- **Context the founder added afterwards:** every measured night is in Thailand, where the pay
  is close to nothing and the tipping culture is, in his words, atrocious. So $1.04 a head is a
  floor for a market where tipping is normal, not a ceiling — and the model does not guess a
  figure for such a market, because none has been measured. The page and the report say so.
- **The two bills this period (8 Sep → 25 Sep, Netlify's own Credit usage breakdown):**
  production deploys 119 = 1,785 credits (93.8%); everything the rooms did — 100,804 requests
  = 20.2, compute 54, bandwidth 42.8 — **117 credits**. Total 1,902. The $9 Personal plan's
  1,000 credits ran out on 15 Sep and a 500-credit pack ($5.48) bought itself; 146.6 credits
  were left at reading time, about ten deploys' worth — the next pack buys itself soon.
  Deploys have slowed: 90 in the period's first week, 17 in the last ten days.
- **Where the shipping goes:** the API's deploy list at the morning's count — 118 of the
  dashboard's 119, plus one that landed during the audit — 110 mysetvip, 7 myset-content, 1 the
  iOhm site (per site, per day; the daily counts match the dashboard's daily credits exactly).

## The instrument that changed the model: Netlify's per-day meters

Usage & billing charts, per day, the three things Netlify bills for traffic. Copied off the
chart into `finance/credits.json` (reading #3, with `perDay.days[]` counts):

| day | room | requests | compute cr | bandwidth |
|---|---|---|---|---|
| Sat 19 Sep | none — the empty day | 3,200 | 1.7 | 13.7 MB |
| Wed 16 Sep | Anantara, 9 phones, 3 h | 7,000 | 3.5 | 41.8 MB |
| Thu 17 Sep | Crystal Day, 3 phones, 2 h | 5,600 | 3.1 | 36.9 MB |
| Fri 18 Sep | Seaflower, 6 phones, 3 h | 5,800 | 3.1 | 50.9 MB |
| Sun 20 Sep | Sand & Tan, 9 phones, 3 h | 6,600 | 3.5 | 60.7 MB |
| Mon 21 Sep | Ugly Duckling, 11 phones, 3 h | 6,900 | 4.0 | 53.8 MB |
| Tue 22 Sep | Crystal Day, 9 phones, 1.9 h | 6,900 | 2.8 | 53.4 MB |
| Wed 23 Sep | Anantara, 3 phones, 2.9 h | 5,600 | 3.2 | 55.1 MB |
| Thu 24 Sep | empty room | 3,700 | 2.2 | 488.1 MB |

**A night adds about 3,100 requests, 1.6 credits of compute and 37 MB over an empty day —
2.98 credits on average (2.3–3.8)**, and the figure barely moves between 3 and 11 phones,
because the Studio's own 4-second tick (only while the Live tab is on screen) and the page
loads are most of it. Read as ticks — requests over the background, less the Studio (assumed
60% of the night), the page loads, the votes and the extra pages, halved — the room's phones
tick **42 times a phone-hour**. The model's 22% screen-on guess of 5 Sep gave 95. The 14 Sep
night, read the hard way from a dashboard delta, had said "a third of the model's requests";
seven nights now say the same thing with a method.

The 24 Sep 488 MB is not a gig (requests sat at the empty-day level). myset.vip carries 1.9 of
the period's 2.2 GB; the likeliest source is that day's landing-page copy edits reloading a
page with 33 screenshots and four strips — unproven, flagged.

## What was falsified

- **The bandwidth-counter method as it stood.** The first quiet pair was taken this morning
  (mark #5, 09:52 Bangkok; #6 an hour later: 7.0 MB/h — an hour that held this audit's own reads
  of the store, so even the first "quiet" pair was not quiet of agents; the per-day chart's
  empty day is 0.6 MB/h). Laid over the 14 Sep bracket it reads 350–750 ticks per phone-hour
  at 3,470 B a tick depending on which background is believed — 8–18× the meters — and the
  15→25 Sep bracket, 249 h with seven nights inside, reads negative. Three fences now, with
  tests, and a rule for the hands: the marks for a night are taken with nothing else running. a quiet pair counts only within 48 h of a bracket and only if the pair
  itself is under 6 h; a bracket over 24 h is withheld. Every withheld bracket says why in
  `pollsByNight`. The right way to take marks is three per night: two hours before, just
  before, after.
- **"A no-gig day is ~3 credits of compute + ~1 of requests"** (14 Sep). It was 1.7 + 0.6
  once the mirror stopped moving clips; the 12 Sep "no-gig day" used as the background then
  carried hand tests and the first warm-door pings.
- **Bytes on the wire.** The board is 3,040 B gzipped for the founder's 79-song board (every
  song in the library is live to the room since 13 Sep); the 2,175 of 11 Sep was a 40-song
  room. About 200 B + 36 B a song. The personal call is 208 B for a phone that only watched,
  430 for one that voted.

## What moved in the model (all shipped in this PR)

- `tools/actuals.py`: `solve_meters` (the meter method), `PAGE_REQS`, `QUIET_PAIR_MAX_H = 48`,
  `MAX_BRACKET_H = 24`, `MAX_QUIET_PAIR_H = 6`, `BYTES.board = 3040`; output gains
  `pollsSource`, `creditsPerShow` (traffic only), `meters{}`; the note names the method.
- `finance/credits.json`: reading #3 with the plan, the balance, the invoices, the per-domain
  bandwidth and the per-day counts (`cleanFrom: 2026-09-16`).
- `finance/actuals.json`: 15 nights, ticks 42/phone-hour (meters), 2.98 credits a night.
- `finance/model.html`: `boardBytes` 3,040; the seed; the screen-on dial solves itself from the
  measured ticks (9.4%, was 22) and says so; the room-money help, the KPI band, the "Two bills"
  note and the assumptions note carry the fortnight's numbers; a new measured bullet on what a
  night costs.
- `finance/model-test.mjs`: 97 checks (was 89) — the seed carries the method, the tracker has
  the two rules and the meter method, the seed's ticks solve to 3–20% screen-on, the modelled
  night lands within 35% of the metered one (2.82 vs 2.98), every credits reading adds up.
- `tools/actuals-test.py`: the stale synthetic night (built at 2,530 B a tick) fixed; the two
  rules and the meter method on a synthetic week — all pass. (It was already failing on
  `origin/main`: nobody had run it since the split changed what a tick weighs.)
- `INVARIANTS.md` 0ge; decision 0089; `finance/README.md`.

## What the projections say now (the same engine, before → after)

| scenario | 15 Sep seed | 25 Sep, calibrated |
|---|---|---|
| 1,000 artists, 30% Plus / 10% Pro — revenue / profit | $14,221 / $11,498 | $13,325 / $10,664 |
| … traffic bill / per gig | $136 / 2.7¢ | $93 / 1.9¢ |
| … break-even | 32 artists | 35 |
| Benchmark (4% Plus, 1% Pro, 3+3 gigs) — revenue / profit | $8,230 / $6,492 | $7,310 / $5,613 |
| … traffic bill / per gig | $83 / 2.8¢ | $60 / 2.0¢ |
| … break-even | 56 artists | 64 |
| Arena, 10,000 phones, on Netlify (traffic) | $2.62 · at the edge | $1.42 · holds |

Revenue moved because rooms got smaller (9.88 → 8.6 phones) at the same $1.04 a head; the
server moved because phones look a quarter as often as guessed. The sensitivity nobody can
measure yet is the Studio share (20% → 100% moves a night 2.1 → 3.6 credits and the
1,000-artist traffic bill $70 → $115); the sensitivity that dwarfs everything is the per-head
figure ($0.50 → $1.50 a head moves the benchmark's break-even 143 → 44).

## Verified

`node finance/model-test.mjs` 97 ✓ · `python3 tools/actuals-test.py` all pass · `sh test/run.sh`
52 files, 0 failed · the page served from the worktree: no console errors,
15 shows used, screen-on 9.4% marked real, KPIs and notes match the engine probe, a scenario
saved / loaded / compared / deleted, the Benchmark preset, dark and light, 375 px wide without
horizontal scroll · `myset.vip/moneymodel` after the merge (see the push-log entry).

## Not done / for the founder

- Three marks on the next gig night (`--mark` two hours before, just before, after with
  `--studio-min N --clip-views 0`) — the first bandwidth-solved night under the new rules.
- The 488 MB of 24 Sep: if it recurs on a copy-edit day, the landing page's screenshots are
  the suspect; Netlify Analytics would name the URL.
- Auto-recharge will buy the next $5.48 pack after about ten more deploys; the traffic alone
  would not have reached the plan's 1,000 credits this period.
