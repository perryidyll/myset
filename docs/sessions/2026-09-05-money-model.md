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
- The four-digit code is a courtesy lock: it keeps the page off search engines and
  away from anyone who stumbles on the URL. It would not stop somebody trying ten
  thousand codes. Nothing that would ruin the business if seen belongs behind it.
