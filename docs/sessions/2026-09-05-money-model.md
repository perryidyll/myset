# 2026-09-05 — The MySet Money Model

A dedicated session on the business model: an interactive projections dashboard
with every key variable as a dial, a master formula, tables and charts, saved
scenarios, selectable hosting cost models, and a way to replace the guesses with
real show numbers as they arrive. Also answers Perry's two side questions (does
installing the web app change server costs? how do we defend against a tidal wave
from one big artist?) and lists the costs he may be overlooking.

**Deliverables**

| Thing | Where |
|---|---|
| The dashboard | `finance/model.html` (single self-contained file; also published as a Claude artifact — link in HANDOFF-MySet.md) |
| Real-show importer | `tools/actuals.py` → `finance/actuals.json` |
| Engine test | `finance/model-test.mjs` (run: `node finance/model-test.mjs`) |
| Folder guide | `finance/README.md` |
| This record | `docs/sessions/2026-09-05-money-model.md` |

---

## 1. What Perry asked for, item by item, and where it lives

| Ask | Where in the dashboard |
|---|---|
| Server costs adjustable, real data replaces guesses automatically | **Server & host** dials (every measured per-call number is editable); **Real shows** panel + `tools/actuals.py`; "Use real shows" overrides people/gig, hours, room money, deploys, and solves the screen-on dial from an observed polls-per-phone-hour |
| Select different server cost models to compare hosts | **Server & host → host list** (8 models), "Same month, every host" table, per-host columns in the show-size table, all rates editable under "Host rates (advanced)" |
| Key metrics visible: revenue, costs, profit… | KPI row (8 tiles), formula table, ladder table |
| Table + ≥3 chart kinds | Tables: formula line-by-line, show sizes, every host, scale ladder, month-by-month. Charts: line (36 months), area (cumulative profit), 100%-stacked bar (where each dollar goes at every scale), two donuts (revenue mix, cost mix), bar (server cost per person by show size) |
| Variables by typing AND sliders | Every dial is a number cell + a range slider, kept in sync |
| 20 × 3h bar · 300 × 3h concert · 10,000 × 2h arena · 50,000 × 3-day festival | **Show sizes** dials (editable) → the "four shows" table with polls, per-phone, polls/s, functions running at once, reads/s, a holds / at-the-edge / breaks verdict, credits, $ on every host, and what the room might spend |
| Tidal-wave defenses brainstorm | The "If a big artist shows up" note: 10 ranked defenses from the research panel, plus the big-room brake as a dial you can switch on to see its effect |
| Artists, shows/day, people/show, minutes using the app → polling → cost | Artists · gigs per artist (paid / free, with the free cap) · people per gig · length · screen-on share · actions per person · Studio Live-tab share |
| Installed as a web app: does it change costs? | Dial present (moves nothing) + the note explaining why not, and what would |
| Extra interactions that poll/update | "Actions per person per gig" (each = one write call + one immediate poll + wakes the ladder) and "Actions everyone notices" |
| % free / plus / pro, editable prices | Artists & plans: Plus %, Pro % (free = remainder, bar shows the mix), both prices, comped share, venues on Venue Pro |
| Average tips on free & plus (transaction fees) | Money from the room: room money per gig by tier, MySet's cut by tier (10 / 2 / 0 from the plan table) |
| % of gigs paid as featured shows, editable price | Featured shows: share, price, refund share |
| Stripe fees + overlooked costs | Stripe section (card, international, conversion, Billing 0.7%, disputes, refunds, Express account + payout fees, bad debt) · Fixed costs list · support time · optional tax on profit |
| Save custom scenarios with labels, auto summary, up to 20, first 4 visible, rest collapsible, drag to reorder | Scenarios strip: save/load/update/rename/delete, six-bullet auto summary, 4 shown + "Show N more", pointer drag on the grip, Compare-all table, export/import JSON. Stored in the artifact's shared store when published, in the browser otherwise |

## 2. How the model works

One block at the top of the script (`ENGINE-START … ENGINE-END`) does all the
arithmetic; the UI never computes anything.

1. **Polls per phone** — the voting page's ladder (3 s → 10 s → 25 s; nothing
   while the screen is off; any change in the room resets everyone to 3 s; a tap
   only lifts a phone out of the 25 s rung) simulated for 300 sample phones with a
   seeded random generator, using the real room's activity rate. Calibrated to
   `tools/loadsim.py` at eight room sizes: worst error 2.9%. Two things added over
   loadsim: one immediate extra poll per action (the page reloads after every
   vote), and an optional server-driven floor (defense #2).
2. **One gig's traffic** in raw units: requests, bytes, function-ms, document reads,
   writes, CPU-ms, object-seconds. Per-call sizes are the measured ones (poll
   2,530 B / 15 reads; action 1,200 B / 4 reads / 260 ms; Studio poll ~17 reads
   every 4 s while the Live tab is visible; page load 6 CDN requests / 48 KB).
   **A poll gets heavier as the room grows** (every poll reads every fan record),
   modelled as `pollMs + people × 0.08 ms` — the research panel's estimate; editable.
3. **The month** = gigs (free artists capped at the plan's 4) × one gig, plus
   background jobs (the scheduler every 2 min), priced on the selected host.
   Netlify picks the cheapest plan automatically (Personal $9/1,000 · Pro $20/3,000
   · Pro 5k/10k/15k/20k) with top-ups; other hosts use their published allowances
   and unit prices.
4. **Revenue** = subscriptions (Plus/Pro/Venue Pro × paying share) + MySet's cut of
   the room's money by tier + featured shows − refunds.
5. **Stripe, MySet's side only**: card fee + Billing 0.7% on subscriptions; card fee
   on featured; disputes; refunds; Express active-account and payout fees (the
   platform pays these — and the code pays artists out *daily*); bad-debt reserve on
   room money. The artist's own card fee on tips is *not* MySet's cost.
6. **Fixed** = editable lines + flat support hours + per-paying-artist support minutes.
7. Break-even (search), 36-month path (start artists × growth, capped at the
   scenario size), the four show sizes on every host with a feasibility verdict.

## 3. What the research panel found (20 agents: 5 lenses × 3 skeptics each)

### The architecture, not the bill, is the ceiling
- Every poll reads all 12 fan shards, so poll cost is O(people²). At 10,000 phones a
  shard is ~0.5–2 MB and a poll takes seconds, not 155 ms. In a big room every vote
  changes the tally, so the "adaptive" ladder never backs off — every screen-on phone
  sits at 3 s all night.
- 300 phones: ~12 polls/s, ~2 functions at once — fine. 10,000: ~740 polls/s,
  hundreds of concurrent functions, ~11,000 strong reads/s against 15 hot keys,
  plus a vote stampede (compare-and-set on 12 shards, 40 retries, then "busy")
  every time a song ends. 50,000: not survivable. Netlify publishes no concurrency
  figure (~125 is the unverified number people quote).
- Also: doors-open triggers a presence *write* from every phone on its first poll.

### Costs (Netlify, today's rates, Pro top-up price unless noted)
| Show | Polls | Credits | $ |
|---|---|---|---|
| 20 × 3 h bar (simulated) | 6,030 | 4.2 | $0.03 ($0.04 on Personal) |
| 300 × 3 h concert | 129k | 89 | $0.60 |
| 10,000 × 2 h arena | 5.3 M | 3,677 at 155 ms/poll; **~15,000 with the per-person poll weight** | $25 → **~$100** |
| 50,000 × 8 h × 3 days | 317 M | 217k at 155 ms; millions with the weight | $1,450 → far more, if it ran at all |

One arena show exceeds a whole Pro month's credits. **Auto-recharge is already ON**
for the account (measured: 500 credits for $5, alerts at 50%), so an arena is a
bill not an outage — but Netlify has no spending cap.

### The ranked defenses (in the dashboard note; short form here)
1. Burn watchdog on top of auto-recharge (½ day) · 2. Arena/Festival tier, booked
and prepaid (policy 1 h, form 1–2 days) · 3. Terms (2 h) · 4. Server-driven poll
floor, the brake (1 day) · 5. Kill switch / read-only flag that stops the *reads*
(½ day) · 6. 3-second edge cache on a split, fan-free poll (2–3 days; arena → ~$9,
festival → ~$530; needs the head-count write off the poll) · 7. Big-room mode +
phone cap (2–4 days) · 8. Edge rate limits per IP (1 h; weak against a real crowd
behind venue wifi) · 9. Votes that queue instead of "busy" (1 day short version) ·
10. One object per live show in memory (2–4 weeks; only once a booking pays for it).
**Do 1–3 this week (no code), then 4–5, then 6.**

### The installed-web-app question — No
Installing changes nothing the server is charged for today. The service worker
never touches `/api`, navigations are network-first, static assets are
stale-while-revalidate but still refetched, nothing is precached; the ladder and
the screen-off silence are identical in a tab and installed. Push instead of poll
would need an installed app on iPhone, is a bad fit for a room of strangers, and
already exists in the code for the *artist* (the Studio's 4-second poll is ~20% of
a gig's cost from one device). Honest reasons to nudge installs anyway: Safari wipes
a site's storage after 7 days without a visit and an installed app keeps it (that
storage IS the fan's credits and requests); a home-screen icon brings people back;
a future "your artist plays tonight" notification. Traps: the vote page never shows
an install card (only the city page does); installing *mid-gig* on iPhone creates a
new storage partition, so the fan loses paid votes — ask after the show; the
audience manifest opens the city feed, not the show; install cannot be verified by
the server, so never attach money to it.

### Costs Perry may be overlooking (now in the model or noted)
- **Stripe Connect Express fees are MySet's**: $2 per connected account per month
  with a payout + 0.25% + $0.25 per payout, and `_connect.mjs` sets a **daily**
  payout schedule, so a busy artist can cost ~$5.50/month in payout fees alone.
  Consider weekly.
- Stripe Billing 0.7% on subscriptions; international cards +1.5% (most of MySet's
  cards); disputes $15; refunds keep Stripe's fee; Express negative-balance
  liability lands on the platform after 180 days.
- **Perry's Stripe account is in the US** (country US, USD, checked via the Stripe
  connector — the earlier working notes said Thailand; they were wrong). So US rates
  apply; the Thai preset is kept for comparison.
- Background jobs cost credits with nobody playing (scheduler every 2 min).
- Resend is free to 3,000 emails/month and 100/day, then $20; domain ~$5/yr at
  Porkbun; accounting; company/legal; Claude Code and dev tooling; support time per
  artist; income tax on profit (structure-dependent; a dial, default 0).
- Revenue-side leaks: the referral "free month" only moves a date in the registry
  (a paying referrer keeps being billed — a latent bug); the 50% retention coupon
  applies to any paid plan once; the founder's own gigs cost credits and earn the
  company nothing; venue merch on the 2% row nets ~0 under $27.

### Host price sheets (all re-checked 5 Sep 2026)
Netlify (Personal / Pro / Pro tiers, credits) · Netlify optimised (bytes ×0.4,
compute ×0.35 — guesses) · Netlify + 3-second cache · Cloudflare Workers + KV
($0.50/M reads makes it worse than Netlify) · Cloudflare Durable Objects (the
earlier audit's "13× cheaper" omitted the per-second duration charge; with it the
gap is ~1.3× at bar size, more at arena size) · Vercel Pro Fluid compute · own
always-on servers (fixed $ + ops hours) · custom. Supabase Realtime was researched
(push architecture, $25 + peak-connection packages) and left out of the page.

## 4. Verification
- `finance/model-test.mjs`: ladder vs Python simulator at 8 sizes (worst 2.9%);
  independent re-computation of gigs, subscriptions, cuts, featured, Stripe, fixed,
  profit for the default month; the 10,000-artist month within 10% of the audit's
  $5,597; KV worse / DO cheaper ordering; free cap; break-even; timeline; show
  sizes; brake cuts arena polls ≥3×; cache makes the arena far cheaper; calibration
  recovers the screen-on share. All pass.
- Page loaded in the Browser pane from a local server: no console errors; charset
  and KPI overflow fixed after the first look.
- Second workflow: headless-Chrome UI tests and an adversarial review against
  Perry's request — see §6 for results.

## 5. What Perry must do / decide
1. **Auto-recharge is on; add a spend alert habit**: check the credit balance after
   any unusual night. Consider the Pro plan at the end of the billing cycle (8 Sep).
2. **Stripe**: confirm cross-border direct charges onto Thai Express accounts are
   allowed from a US platform (Stripe's docs now discourage direct charges with
   legacy Express); consider a weekly payout schedule to cut Express payout fees.
3. **Decide the Arena/Festival policy** (booking + prepayment above ~500 phones) and
   put it in the terms.
4. Run `python3 tools/actuals.py --write` after next week's shows and paste the
   JSON into the dashboard; read the function-invocation count from the Netlify
   dashboard for one night to calibrate the screen-on dial.
5. Tell the next session the real tier mix, room money and featured take-up as they
   appear, so the defaults move from guesses to measurements.

## 6. Verification results, fixes, and the live deployment

### The four-lens review (headless Chrome + adversarial checks)
- **UI behaviour**: 20 of 21 checks passed outright — slider/cell sync, host
  switching, save/load/update/rename/delete, 20-cap, 4 + "Show more", pointer drag
  reorder (persisted), compare table, export/import, real-shows apply and the
  hand-edit switch-off, reset, host rates, fixed-cost lines, size edits, the brake,
  all six canvases painting, no errors light/dark, no horizontal scroll at 390 px,
  every details toggling, 17 ms per render. The one split result (a clamped Plus/Pro
  value not written back to the typed cell) is fixed.
- **Against Perry's request**: every ask located; 18 copy findings.
- **Model logic**: 20 checks passed; 13 findings, two of them real model defects.
- **Design**: 14 passed; 18 findings on charts, contrast and mobile tables.

### What was fixed as a result (all in `finance/model.html`)
- Express payout fees were charged 8 payouts a month to every paid-out artist,
  including free artists who can only play 3 nights — now capped at nights played,
  and the payout % and bad-debt lines use the money actually paid out (gross minus
  MySet's cut). Subscription refunds now reduce revenue instead of sitting in the
  Stripe line. Netlify top-ups are priced in whole packs (500/$5, 1,500/$10).
  Durable-Object requests exclude page files; background jobs add CPU time; a VPS
  rate of 0 no longer explodes; margin shows "—" rather than 0% when revenue is 0.
- Loading or importing a scenario saved before a dial existed used to render ∞ /
  NaN everywhere; saved params are now laid over today's defaults (deep merge).
- Dials: a clamped value is written back to both controls; typed values respect the
  slider minimum (no 0-hour gigs); typing past the slider's maximum grows the
  slider instead of desyncing it; the screen-on dial is marked green when it was
  calibrated from real shows; pasting new real numbers replaces the old record
  instead of merging in a stale note; the import toast counts what actually landed
  and skips duplicates; number cells are 16 px on phones so iOS does not zoom.
- Charts: profit is one green everywhere (revenue blue, costs violet as their own
  families); the "where each dollar goes" bars are no longer capped at 100% (a
  loss row now runs past 100% with a tooltip saying so); timeline shows ~13 month
  labels upright with "Month N" tooltips; the cost donut holds costs only with the
  margin in the centre; the show-size bars carry their values at the bar end;
  Stripe amber and the green were re-stepped to pass 3:1 on white.
- Layout: only the first two dial groups open by default with Expand all /
  Collapse all; wide tables get a scroll shadow and a sticky first column; on
  phones the explanation column has a minimum width; the loaded scenario is never
  hidden inside the collapsed section; keyboard reorder with the arrow keys on the
  grip; primary buttons and control borders pass contrast in both themes.
- Copy: "poll" is defined in the first paragraph; the defenses are referred to by
  name, not number; the numbers quoted in the notes are rendered live from the
  model (no more 6,030 vs 5,870); units for the screen-on dial show the minutes;
  the Stripe tile splits card fees from artist-payout fees; "Paying subscribers"
  replaces the ambiguous "paying artists … revenue each".

### Live at myset.vip/financialmodel (passcode 2068)
> **Superseded 6 Sep:** the address is now `myset.vip/moneymodel` and the function
> is `moneymodel.mjs`; `/financialmodel` 301s to it. See §9. Everything else here stands.
- `netlify/functions/financialmodel.mjs` serves the model from OUTSIDE the
  published folder: GET without a valid cookie → a small passcode page; POST with
  the code → an HttpOnly, Secure, 30-day cookie and a redirect; GET with the cookie
  → the model. Wrong code → the same page with one line. `?signout=1` clears it.
  `FINMODEL_CODE` in the Netlify environment overrides the default.
- The site's Content Security Policy is untouched (`default-src 'self'`): Chart.js
  and the Archivo / JetBrains Mono files are self-hosted under `public/vendor/`,
  and the function rewrites the CDN links on the way out. The artifact version
  keeps the CDN links (its host allows only those).
- Routing: `/financialmodel` → the function, placed above the `/:slug` catch-all.
  `[functions.financialmodel] included_files = ["finance/model.html"]`.
- Verified on a free draft deploy before production: gate 200 with noindex and
  no-store; wrong code refused with no cookie; right code 303 + cookie; model
  served with `/vendor/` links and no CDN reference; vendor assets 200; an unknown
  slug still reaches the artist page; in headless Chrome the code submits, six
  canvases paint, Archivo and JetBrains Mono load, no page errors. `npm test`: all
  suites pass (88 in the last stage). Local gate tests: 12 of 12.
- Shipped as commit `ebb7479` on main; Netlify production build `6a9bb789a62aa90007fe0430`, published 2026-09-05 06:33 UTC, verified live by content.
- The four-digit code is a courtesy lock: it keeps the page off search engines and
  away from anyone who stumbles on the URL. It would not stop somebody trying ten
  thousand codes. Nothing that would ruin the business if seen belongs behind it.

## 7. The comprehensive audit (Perry's third ask) and what it changed

Perry: *"one last extensive, comprehensive audit of the entire site – the fine details
of the math, every equation, variable, and connection between the charts, etc. … give
the server costs one more objective 3rd party cross examination too … and confirm
that the system is in place to track the real data as it begins to accumulate."*

### How it was run
A workflow of fifteen agents: five lenses (derivation, variables, server cost,
tracking, decisions), each finding adversarially checked by two skeptics (one
reproduces by computation, one re-reads the code and sources). 71 checks verified as
correct; 69 findings survived; the full digest is in the session scratchpad
(`audit2-digest.txt`). The arithmetic itself came back clean — a from-scratch Python
rebuild agreed with the engine on ~75,000 numbers and forty hand-checked rows matched
exactly. What was wrong was what the model *believed*.

### The findings that changed a decision (fixed in `finance/model.html`)
- **A bigger room earned nothing.** Room money was flat $/gig, so an arena earned
  what a bar earned and every extra phone was pure cost. Now per person everywhere
  (`roomFree/Plus/Pro` = $/person/gig, default $0.40; old scenarios migrate by
  dividing by their own `fans`; INVARIANT 0ed).
- **The show-size table measured the wrong pocket** — MySet's server bill against
  the *artist's* takings, and one day's takings against a three-day bill. It now
  prices MySet's own revenue over the whole run, with a tier selector (`sizeTier`)
  and a "charge to book" price at the current margin. A Pro artist's arena earns
  MySet $0 and costs $27; it says so.
- **`pollMsPerFan` 0.08 ms was ~13× high** (an unmeasured guess with no provenance
  label). Now 0.006; the arena's server cost fell from ~$99 to ~$27.
- **Half the modelled cost was a Stripe fee nobody has checked** (Express account +
  payout + bad debt, 53% of costs). Arithmetic kept, claims changed: the dial and
  the bad-debt line are marked UNVERIFIED with the Connect-settings check to do.
- **The opening screen was the optimistic case dressed as the base case** (40%
  paying vs published freemium medians 2–8%). KPI band reframed "A SCENARIO, NOT A
  REPORT" with two buttons, **Benchmark case** and **If it all works**.
- Also: the feasibility verdict follows the host (cached / in-memory / always-on
  thresholds differ); break-even walks back across the Netlify plan-and-pack step
  function (brute-force verified at three settings); the timeline charges
  acquisition (`cacUsd`) and churn (`churnPct`); a per-tier contribution table and
  the Plus crossover ("Plus stops paying MySet above $X of room money"); bad debt is
  gated by the same Express switch; deploys count the whole account (176/30 days);
  `intlShare` 70 → 13; Vercel's allowances zeroed with its $20 credit; revenue KPI
  sub-line and scenario cards agree with the headline; the ladder chart's axis is
  capped at 250% and a clipped loss row prints its true figure; the plan tile says
  when top-up packs are on top of the plan; no more "−$0.00".
- Real shows survive a reload and put the guesses back when switched off
  (`PRE_ACT` stash + `store.saveUse`).

### The tracker, rewritten (`tools/actuals.py`)
The old script could never learn what a room spends (no Pro bucket, and Perry is
comped Pro), counted a one-phone zero-vote test as a night, would have turned three
deploys into ninety a month on 8 Sep, and hard-coded polls-per-phone-hour to null.
Now: `roomFree/Plus/Pro` and `roomPerHead` **per person**; deploys account-wide over
the trailing 30 days; the night rules of INVARIANT 0ef; a night whose Stripe lookup
failed counts for people and hours but not money; unknown artists are "unknown", not
"free"; and **`--mark`**, which records Netlify's account bandwidth counter so that
the bytes a night adds, less Studio ticks / page loads / votes / views and less the
background the other four sites add (measured from quiet mark pairs), ÷ 2,530, is the
audience poll count — the number the whole server projection hangs on, measured
instead of typed. Refuses to compare marks across a billing-period rollover. The
solver was tested offline with synthetic marks (`solver-test.py`: recovers 5,870
polls exactly, refuses a rollover, ignores unbracketed nights) and its constants are
pinned to the model's by `model-test.mjs` (INVARIANT 0ee).

**One audit finding was wrong and is recorded as such:** the digest said the three
largest rooms on file (31/44/26 people) were real shows being thrown away by the
30-minute rule. Reading the records: all three were on ONE network, lasted 4–6
minutes, and cast 125/168/21 votes — the load-test script. The new rule excludes them
for the right reason and prints it.

Live run 2026-09-05 (read-only): 1 night that really happened (30 Aug, 8 phones,
2.19 h, 21 votes, $3.00 = $0.375 a head); 176 deploys / 30 days, 171 this period;
first bandwidth mark taken at 09:11 UTC (573,414,454 bytes used since 8 Aug). The
page's built-in seed now matches that output.

### Verified after the fixes
`node finance/model-test.mjs`: 46 checks, all passed (incl. brute-force break-even at
three settings, the cache/brake regressions, the show-size tier check, the
timeline's acquisition line, the actuals.py constant drift guard). Headless Chrome:
six canvases painted; KPI tiles consistent; real-shows apply → fans 8 / hours 2.19 /
room $0.375 on every tier (Free and Plus filled from `roomPerHead` with a badge that
says "all plans together") / deploys 176; switching off restores 20 / $0.40; a reload
keeps the real numbers in force; Forget clears them; Benchmark preset applies; no
horizontal scroll at 390 px; dark theme paints. Full-page screenshots in the
scratchpad (`ui/final-*.png`).

## 8. The final audit (post-fix), and what it changed

Perry re-emphasised the stakes ("this model's data and dashboard will play a massive
role in determining some pretty crucial business decisions"), so a second workflow
went over the REBUILT model: seven lenses (fix ledger · independent re-derivation ·
every chart/table/KPI connection in headless Chrome · third-party server-cost
cross-exam · Stripe/revenue rules vs the actual code · the real-data loop end to end
· copy vs numbers), two skeptics per finding, a completeness critic. It was stopped
by hand at 91% of the 5-hour usage window (Perry sent the meter) with six of seven
lenses reported and every one of their findings skeptic-checked; the server-cost lens
did not finish. Salvaged from the run journal. Every finding that stood was fixed
except the four listed as deferred.

**Fixed (finance/model.html)**
- Plus crossover honours the free plan's night cap and the featured spots: $107 →
  **$351.83** of room money a month per artist (the free artist can only play 4 of the
  Plus artist's 8 nights, so the 10% cut reaches half the money). Caption says so.
- Per-tier "Net to MySet" now carries every Stripe line month() charges (refunds,
  featured card fee, disputes); Σ tier nets × artists = revenue − server − Stripe
  (test added).
- "Charge to book" is grossed up for Stripe's card fee on the booking and priced at
  one stated margin (the platform's, or a 50% target while it is losing money — the
  caption says which).
- On the cache host "Reads / s" printed reads-per-call (15) for every size; now 5.
- The show-size chart on the Pro tier drew four identical 1000% bars with labels off
  the canvas; no-revenue rows are 0 with the loss in the label, and labels flip inside
  the bar when they would overflow. Tooltip and the tidal-wave note say "on this host"
  instead of "today's code" (the verdict is host-dependent now).
- Tax reaches the profit tile ("$X after N% tax") and the timeline/cumulative chart
  (profitable months only); the month table has an Acquisition column so Server +
  Stripe + Fixed + Acquisition = Costs once the CAC dial is set.
- The seed (the tracker's real night) is treated as real data: ticking "Use real
  shows" now survives a reload with only the seed on file.
- Moving "actions per person" or "changes everyone sees" re-solves the screen-on dial
  from the recorded polls instead of leaving a stale "calibrated" badge.
- Sliders accept off-grid values (0.375, 13) instead of snapping and disagreeing with
  the typed cell.
- Copy: Studio reads 21 (the code counts 21, the page said 17); "MySet has 1 today"
  (the registry has one artist, not two); "one card in eight international" (the
  measured share, not "most"); room dials "start at a rounder $0.40"; scenario cards
  use subscriptions after refunds; Express fees labelled per Stripe's docs (the
  platform pays them for Express accounts — confirm in Connect › Settings) instead of
  UNVERIFIED; the payout-share dial explains that room money is the average over every
  gig, dry nights included, so the two agree.

**Fixed (tools/actuals.py)**
- The load-test rule needs the night to be over in under 30 minutes as well as on one
  network — a real beach-bar room shares the venue's wifi (both lenses caught this).
- The bandwidth solver: marks are timed by Netlify's own last-updated stamp; an AFTER
  reading the counter had not caught up to is refused; a test show inside a would-be
  quiet pair stops it counting as quiet; nights that share one bracket are solved
  together with one rate over their combined phone-hours; Studio minutes are an input
  (`--mark … --studio-min N`) with the model's 60% share as the stated default, each
  night reports the Studio share of its bytes and a confidence; without a quiet pair
  the rate is withheld as `pollsProvisional` and the note says why. Nine offline
  solver tests, all passing.

**Deferred, with reasons**
1. `netlify/functions/webhook.mjs` → `_feesplit.mjs`: the fee-split correction runs
   on ARTIST accounts too and refunds part of MySet's cut whenever Stripe's real fee
   beats the 2.9% + 30¢ estimate (3–38% of the cut on small charges). This is an app
   bug, not a model bug — fix in the app session (skip owners whose plan row has no
   `splitFee`; add an artist-owner case to test/billing.mjs). The model's cut is a
   little optimistic until then.
2. The server-cost cross-exam lens (live re-check of every vendor price sheet and the
   573 MB bandwidth-counter reconciliation) did not finish before the stop. Resume:
   `Workflow({scriptPath: …/money-model-final-audit-wf_6cdb5cc1-cfc.js, resumeFromRunId: 'wf_6cdb5cc1-cfc'})`
   — the six finished lenses and their skeptics return from cache.
3. The "simulated" note's prose is static while its numbers are live (LOW).
4. Hand-nudging a real-shows dial switches the mode off but leaves the other real
   values on screen (by design; the toast could say so).

**Shipped:** artifact republished (label "After the two audits"); commit + Netlify
production deploy recorded below.

## 9. 6 Sep — the address, and a hero that is not a projection

Two asks from Perry, both taken as read.

**`/financialmodel` → `/moneymodel`.** `netlify/functions/financialmodel.mjs` is now
`moneymodel.mjs`; `[functions.moneymodel] included_files` and the 200-rewrite follow
it, and the old address 301s to the new one from above the `/:slug` catch-all (an open
tab or a saved link still lands). While renaming, the two hard-coded `/financialmodel`
strings inside the gate — the form's action and the cookie's `Path` — became
`url.pathname`, so the next rename is a routing change and nothing else. Perry's
30-day cookie was scoped to the old path and will not be sent to the new one: he types
2068 once more. `FINMODEL_CODE` keeps its name (an env var nobody reads).
Gate tests: 12 of 12, run against the renamed module.

**The hero chart.** Perry: *"where is this growth curve coming from … I don't really
see the point in including a growth curve that is based on arbitrary projections… I
just want to see what the key business metrics look like based on how I set the
variables. I think a simple bar graph would be the best hero visual."* He is right,
and it was the one place the page still led with a made-up number after two audits
spent themselves removing exactly that.

- The hero is now **"The money, at the dials as they stand"**: three stacked bars on
  one scale — Revenue split into subscriptions after refunds / cut of the room's money
  / featured shows; Costs split into server / Stripe / fixed; Profit (green, or red as
  "Loss"). Totals are drawn at each bar's end, the margin rides in the Profit tooltip,
  and zero-height segments are filtered out of the hover. Every figure comes straight
  from `month(P, P.artists)` — no time axis, no growth assumption.
- The 36-month line chart, the cumulative chart and the month-by-month table now live
  together in one collapsed section titled **"If it grew to this size over 36 months —
  the only invented path on the page"**, with a paragraph saying plainly that the
  growth rate is a guess and nothing outside the box depends on it. Nothing was
  deleted: the growth dials still work, they are just no longer the first thing read.
  A `toggle` handler resizes the two charts the first time it opens (a canvas inside a
  closed `<details>` is built at zero size).
- The scale-ladder panel became full width so the grid still pairs cleanly.

Verified headless: hero segments sum to the KPI tiles exactly ($4,554 + $1,824 +
$2,475 = $8,853 revenue; $175 + $1,880 + $658 = $2,713 costs; $6,140 profit); all
three bars follow the artists dial; the growth section is closed on load and both its
charts paint at full size when opened; 37 rows in the month table; no page errors; no
horizontal scroll at 390 px; dark mode paints. `node finance/model-test.mjs` all
passed.
