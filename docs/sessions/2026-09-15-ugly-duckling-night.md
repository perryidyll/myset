# 2026-09-15 — The Ugly Duckling night (Mon 14 Sep): the room, the money, the cost

The founder came back from the show ("got $30 in tips, most so far") and asked for the
numbers: the room, the votes, the songs, the money, and the polls and costs.

## The night, from the night's own record

Show `2026-09-14-1330-gap5`, started by the schedule at 20:30:31, ended by the artist at
23:44:39 (3.24 h; counted as 3.0 h — the slot; the last song started 23:27). Archive:
13 phones, 11 wifi networks, 22 votes, 13 song starts, peak 6 voting at once. Event log
(decision 0066; the first real night with one): 35 events, nothing left on the board.

- **Ten of the thirteen phones voted** (77% — the highest share yet). Six used all three
  free credits, four used one. 1.7 votes a phone (2.2 per voter). No requests.
- **The first vote came 75 minutes in** (21:45). Then three bursts: 21:45–22:33 (16
  votes), 22:53–23:00 (6), nothing after 23:00; four songs played in the last 44 minutes.
- **Every vote was played.** 12 of 13 song starts had votes (the last, *Ain't No Sunshine*,
  none). Top of the board: *Hey Soul Sister*, *Peaceful Easy Feeling*, *Tennessee Whiskey*
  (3 each; *Tennessee Whiskey* was also 7 Sep's top song).
- **Money, per Stripe via the archive: two $10 card tips — 21:46 and 22:06** — each within a
  minute of a voting spell. $20 = **$1.54 a head**, four times the previous best. Nobody
  bought a vote pack; six phones hit the 3-credit ceiling and stopped. The founder counted
  $30 because the Studio's Live tab summed the account's whole tip history (Sunday's $10
  included) — a bug, fixed the same night (see
  `2026-09-15-live-tab-tips-and-the-founders-money.md`). There was no third tip. MySet's cut:
  none — his charges are on his own account; Stripe's card fee ≈ $1.18.
- Across the four money-known nights: $33 from 32 phones = **$1.03 a head** (was $0.68).

## The cost of the night — from Netlify's own meters, not the model

Read off the dashboard at 12:40 UTC (before) and 17:50 UTC (66 min after End): over those
5.17 h, web requests +4,052 (0.8 credits), compute +2.5 credits, bandwidth +1.7 credits
(85 MB), deploys +2 (30 credits — both the assistant's PRs, nothing to do with the show).
Taking 12 Sep (no gig) as the background rate, **the show itself was about 3 credits ≈ 3¢:
~3,500 requests, ~1.9 credits of compute, ~0.8 of bandwidth.** One deploy costs five of it.
Second reading appended to `finance/credits.json`; the per-day chart will show 14 Sep whole
tomorrow.

The model's guess for 13 phones × 3.24 h × 1.7 actions: 8,000–11,000 requests, 1.6–3.0
credits of compute, 11–23 MB. Compute and bandwidth land; **requests come in at about a
third of the model's** — either the room glances far less than the 22% screen-on guess
(~8% would fit), or Netlify's meter counts fewer than every edge hit. One night; the
screen-on dial is not moved on it.

## The bandwidth bracket — the first, and why it is withheld

Marks #3 (17:00, 1,157,497,665) and #4 (00:40, 1,265,806,304): 108 MB over 7.67 h. The
tracker's solve gives 1,025 ticks per phone-hour and **withholds it** — no quiet pair
measures the background, and since 12 Sep the account moves ~8 MB an hour with nobody
playing (the scheduler, the warm-door pings, the nightly mirror; 12 Sep alone was 200 MB).
The bandwidth method cannot read a 20 MB night out of a 60–90 MB background. The dashboard
delta above is the better instrument now; the tracker's method stays for a quiet-day pair.

Mark #3 had been lost from the shared worktree's copy of `marks.json` (the file was reset to
a stale `main` after the PR merged); restored from `origin/main` and #4 appended.

## What moved in the model

`finance/actuals.json` rewritten: 8 nights, 9.88 phones, 2.78 h, 2.24 actions, $1.03 a head,
272 deploys in 30 days (87 this period). The page's seed follows. Benchmark case moves with
the per-head figure — see the handoff for the numbers.

## For the founder

- Stripe › Payments, 14 Sep evening: is there a third $10? If it was cash, say so and the
  archive stays right.
- Two marks an hour apart on a quiet afternoon (no show, no deploys) would give the tracker
  its background and make the bandwidth method usable again.
