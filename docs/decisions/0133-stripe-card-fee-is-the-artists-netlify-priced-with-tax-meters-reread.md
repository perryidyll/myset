---
id: 0133
title: Stripe's card fee on an artist's room money is the artist's in every profit figure, Netlify is priced with its tax, and the meters were re-read after the register's bell
date: 2026-10-01
status: decided
decided_by: founder
area: money
reverses:
superseded_by:
invariants: []
commits: []
tests: [test/everyshow.mjs, finance/model-test.mjs, tools/actuals-test.py]
files: [netlify/functions/_showcosts.mjs, finance/shows.html, finance/model.html, finance/credits.json, finance/actuals.json, tools/actuals.py, build-sheet.py]
---

## The question

Decision 0132's audit left four questions for the founder. Answered on 2026-10-01:

1. **Stripe inside "MySet profit".** Room money (tips, vote packs, requests, merch) is a direct
   charge on the artist's connected account (ACCOUNTING.md), so Stripe's card fee comes out of
   the artist's share. Every profit figure nevertheless took it off MySet. Founder: "yes please
   make sure that is properly reflected in both tables as well as the projection table".
2. **Price of a Netlify credit.** $5.00 a 500-credit pack, or the $5.48 the invoices charge with
   tax. Founder: use $5.48.
3. **The retired "Current Show Stats" task.** Founder: switch it off. Done in the scheduler
   (`myset-current-show-stats`, disabled, not deleted).
4. **A fresh per-day meter reading** after the register's bell (25 Sep). Founder: read it.

## The options

| Option | What it does | Risk |
|---|---|---|
| **A — chosen** | Card fee shown in every Stripe column, taken off MySet only on the founder's own nights; Netlify dollars carry a 1.096 tax multiplier; a new reading from the dashboard's own per-day numbers | The meter reading after the bell has one empty day only |
| B | Drop the Stripe column from the tier tables | Hides what a night really cost the artist |
| C — do nothing | MySet's profit understated by the whole card fee on every artist night | Rock Star read as a loss when it is a profit |

## What was chosen, and why

**1. Card fee.** `costOf` in `_showcosts.mjs` takes Stripe off `myset.usd` only when the night is
the founder's (`isPlatformOwner`); `myset.stripeMine` says how much came off. The shared TIER
MATH block subtracts `t.stripeMine`, not `t.stripe`: the Show log's tier table passes the
founder's nights' fee as played, and nothing as if on a plan or with the "paying customer"
toggle on (then the founder's money would be a direct charge too). The money model's projected
tier table passes 0. The monthly projection engine already charged MySet only for its own
charges (plans, Billing, featured shows, disputes, Express payout fees, bad debt). Plan fees still
pay Stripe: that charge is on MySet's account.

**2. Tax.** Every Netlify host on the money model carries `taxMul: 1.096` ($5.48 ÷ $5; the $9
plan invoices at $9.86), applied once in `netlifyDollars`, in the marginal per-show price and in
the tier table's credit price. `usdPerCredit` stays the published price, so a saved scenario
picks the tax up from the page. Cloudflare, Vercel and the VPS are not taxed. The Show log prices
a credit from the latest reading's pack, now `usd: 5.48` (1.096¢).

**3. Meters.** The reading (`finance/credits.json`, 1 Oct) is the usage page's own per-day
numbers, fetched from the same endpoint the chart draws, not read off the bars. `cleanFrom` is
now 25 Sep. Only one day since then had no show and no slot (26 Sep), and it carried 192.5 MB
nobody's gig made. Used as the bandwidth floor, it made every night negative. So
`perDay.bandwidthCleanFrom` (16 Sep) lets the bandwidth floor come from the quietest empty day
since then (19 Sep, 13.3 MB), because the bell adds requests, not bytes. Requests and compute
still come from 26 Sep only.

Result: **2.72 credits of traffic a show** (was 2.98), from four nights (25, 27, 28, 30 Sep;
1.44–4.09). At 1.096¢ that is about 3¢ a show. Ticks per phone-hour read **16.9** (was 42), but
from two nights only. On 27 and 30 Sep the requests over the one empty day are near zero or
below it, because 26 Sep had twelve deploys. **Treat the tick rate as thin until a second clean
empty day lands.** `_showcosts.mjs` now refuses a credits-per-show of zero or less rather than
pricing a show as free.

## What would change this

- Another empty day after 25 Sep. Read the meters again and the background becomes a median.
- A plan or tax change on Netlify's invoices: change `taxMul`.
- Room money moving onto MySet's own account (destination charges). Then the card fee is
  MySet's, and `stripeMine` must follow.
