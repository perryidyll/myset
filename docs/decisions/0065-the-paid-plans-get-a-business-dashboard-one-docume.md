---
id: 0065
title: the paid plans get a business dashboard — one document per artist, keyed by the calendar night, profit before app fees, the whole evening in the hourly rate
date: 2026-09-13
status: decided
decided_by: perry
area: plans
reverses:
superseded_by:
invariants: [0fn]
commits: []
tests: [test/biz.mjs, test/bizmath.mjs, test/limits.mjs, test/cost.mjs, test/books.mjs, test/autoshow.mjs, test/histname.mjs, test/structure.mjs, test/copy.mjs, test/syntax.mjs]
files: [netlify/functions/_biz.mjs, netlify/functions/admin.mjs, netlify/functions/_plan.mjs, netlify/functions/_lifecycle.mjs, netlify/functions/_history.mjs, netlify/functions/_ledger.mjs, netlify/functions/_account.mjs, public/biz.js, public/studio-money.js, public/report.html, public/studio.js, tools/stamp.mjs, tools/overview.mjs, netlify.toml]
---

## The question

The founder asked for "a full CRM / business management dashboard for all the
essentials artists need to track", for the paid plans only: what a gig paid,
who in the band got what (up to 5 on Bar Star, 10 on Rock Star), cash tips, merch
sold and in what quantity, up to 5 / 10 costs a show, four kinds of time (on
stage, breaks, travel, set-up and pack-down), the gear used, profit, and — the
thing he cared about most — an honest hourly rate: *"people think 'oh you get $x
just to play music for 2 hours' but in reality it takes like 4 hours or so of my
evening, sometimes more."* Plus a branded report for any date range or any
hand-picked shows. It had to open fast and be built to change.

Nothing like it existed. The Money tab showed Stripe's numbers (votes and tips
through the app, the monthly statement) and the filed nights; no field anywhere
held a fee, a split, a cost or a minute. Four things forced the shape: a gig is a
residency RULE in `ev_<aid>` whose only per-night state is a `skip[]` list, so a
per-night figure cannot live on it; a filed night does not exist until the show
ends and its index row is rebuilt from a fixed literal on every archive, so a
figure typed before the show has nowhere to go there; the live show document is
CAS-written on every vote, so nothing optional belongs on it; and the day before,
the founder's own Rock Star card had sold a "professional business dashboard"
as *coming soon*.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One new document per artist, `biz_<aid>`, holding a record per night keyed by the calendar occurrence (`eventId@date`, the key the scheduler already uses) or, for a night MySet ran with no gig on the calendar, the `showId`; plus a default per RUN (`rules[eventId]`) so a weekly residency is entered once. Read by one strong hop when the Money tab opens. Gated on the existing `reports` flag (Bar Star and Rock Star). The filed night learns its `key` and whether its money is known (`source`) so the dashboard joins exactly from now on and by time window for history. | A second place money lives, beside Stripe's; a third writer on the sacred start/archive path (six additive lines). | `_biz.mjs`, three admin actions, `public/biz.js` (the maths, testable in node), `public/studio-money.js` (loaded only when a paid owner opens the tab), `public/report.html`. | A hand-typed figure printed as fact beside a Stripe figure that disagrees — the exact thing ACCOUNTING.md warns about. Answered by labelling, below. |
| B | Fields on the filed night's detail document (`hist_<aid>_<showId>`), the way a night's name is edited by hand (0057). | No record before the show ends, so the gig form could not carry pay; a report over a year would open one document per night (~42 ms each, 400 reads for the founder's own history). | a second hand-edited field on the archive, which 0057 named as the thing that would revive a side document | The index row is rebuilt on every archive; anything the dashboard needs on the LIST would be lost or would need both row builders changed. |
| C | Fields on the event rule. | `normEvent` is a whitelist and the save is a whole-record replace; a residency has one record for fifty nights; the rule rides every Studio poll and the public city feed. | none | A figure typed for one Thursday would apply to every Thursday, and be dropped by the next edit. |
| D | A separate page (`/dashboard`) instead of the Money tab. | Leaves the Studio's tab bar and session; the founder said "start with the current money tab". | a page | Two places to look for money. |
| E — do nothing | The Rock Star card keeps saying *coming soon*. | The founder asked. | | |

## What was chosen, and why

A, because the founder asked for exactly this and the codebase has one honest
place for it. The rules that decided the details, each one a paragraph of the
design contract after a three-lens review found it wanting:

- **Both paid plans, on `reports`.** The brief says "paid plans only" and gives
  Bar Star its own caps (5 band members, 5 costs), so it is not a Rock Star-only
  feature. `reports` already meant "read your own nights back" and is enforced on
  the server with a 402; its meaning widens rather than a new flag being added.
  `analytics` stays in `NOT_BUILT` — that is the Rock Star-only "by venue / by
  song" cut, and it is still not built.
- **Profit is (pay − splits) + cash tips + merch + app − costs, and the hero
  names MySet's fee in dollars whenever app money is in it.** *App* is the filed
  night's `gross`: votes and tips fans paid through MySet before MySet's cut and
  Stripe's fee. The one fee the dashboard can name is MySet's — the plan's
  percentage of the app money, *"10% ($11.20) goes to MySet for transaction
  fees"* — and Stripe's stays Stripe's to state (INVARIANT 5d / 0dt: the net is
  the statement under *Your earnings*). The figure is green in the plan tag's
  pill; the heading says *Profit*, not "before app fees" (the founder,
  2026-09-13 — the fee sentence is the honesty, the heading is the number).
  Merch bought through the app is not in `gross` (archive excludes it) and the
  legend says so.
- **A night whose Stripe lookup failed has app money `null`, never 0.** Every
  night from 2 to 11 September 2026 was archived `stripe-unreachable` (0fc); the
  index row now carries `source` so the dashboard can say "app money not
  available for N shows" and offer the existing *Re-check* instead of printing $0.
- **A rule default is not income.** A weekly $300 rule with no filed night and no
  per-night record is LISTED ("$300 from the run — not confirmed") but never
  COUNTED — 0031 / 0ef: an unplayed calendar slot is not a gig. *Log it* makes it
  one; *Didn't happen* is the existing skip. A rule edit changes every night of
  the run that has no record of its own, and the gig form says so.
- **The hourly rate counts the whole evening by default** — all four kinds of
  time in, with a toggle per kind saved as an account preference (on the
  dashboard's $/hour tile, never asked while logging a night) — and is computed
  over the TIMED shows only (Σ profit of shows with minutes ÷ their hours), so an
  untimed residency does not inflate it. Both rates, *Stage time rate* and *Full
  evening rate*, sit side by side under *Total time invested* — every hour of
  every show in the period, so a 2-hour set reads as the 5-hour evening it was
  and thirteen hours over four nights reads as thirteen hours, not one night.
  Each rate has two more readings, kept on the phone: **Total or My cut** (the
  whole act's profit, or the artist's own share — `cut` on the record, typed
  under *Splits* when it is not simply what is left after the splits and the
  costs) and **before or after MySet's fee**.
- **Caps are enforced against growth, not size.** A Rock Star record with eight
  band members stays editable after a move to Bar Star (INVARIANT 0s); it can
  shrink but not grow, and the editor replaces the *Add* button with the plan
  line rather than offering a tap the server would refuse (rule 3).
- **Owner only.** Pay and splits are the owner's livelihood (0du / 0dc); a band
  member on a Rock Star seat is shown one line, not a dashboard, and the server
  refuses with 403 either way.
- **Cents and minutes, integers, everywhere but the screen edge.**
- **One module the phone downloads once, only on a paid owner's Studio,
  pre-warmed after boot** — the Studio's own script does not grow (0053), and the
  maths lives in `public/biz.js` so node can test it and the report page can
  share it.

Also taken while in this code, because the redesigned tab would otherwise print
it: an artist with no usable Connect account was shown MySet's own platform
statement as *Your earnings* (`stripeFor` falls through to the platform client
with empty options; `statement()` caches the result under the artist's key with
no record of which account it came from). Reproduced by execution; now
`enabled:false` without a `statement()` call, and a cached ledger remembers its
account and is recomputed once when the account changes — INVARIANT 0fn.

## What this makes harder

Money now has two authors. Stripe's figures are still only added up, never
worked out, and the hand-typed ones are labelled as the artist's — but a reader
of the report has to hold both in mind, and the footer does that work. A filed
night's index row has two new fields (`key`, `source`) that both row builders
must carry; `test/histname.mjs` and `test/autoshow.mjs` pin them. The gig form
is longer for a paid owner. `has('band')` and `has('costs')` are FALSE on Bar
Star because `has()` compares a number against the top plan — the Studio reads
`PLAN.limits.band` directly and `test/structure.mjs` refuses the string, but a
future reader will reach for `has()` first. The `biz_<aid>` document is capped at
400 KB; the year shard is designed and not built.

## What would reverse it

A band member on a Rock Star seat asking to see their own split (a new decision,
not a page toggle). The founder deciding the dashboard is Rock Star-only after
all — one flag change and the caps. An artist's business document approaching
400 KB (a few hundred fully logged nights) — the year shard. Stripe exposing a
usable per-session net, which would let *app* be after fees.

## Follow-up, 2026-09-13 (the founder's first pass on the localhost)

The words and the colours changed, the maths gained one field: *Paid for the
gig* → *Total pay from venue*; *Band* → *Splits* everywhere (the section, the
form, the report's column and table); the editor is titled *Log a show* and no
longer carries the four *in $/h* pills (the toggles are the dashboard's); a *My
cut* field sits under the splits above *+ Add band member*, blank meaning "what
is left" (the readout writes that figure in as its placeholder); the profit is
green in the plan tag's pill under a larger pink-orange *Profit*, with *"N%
($x) goes to MySet for transaction fees"* under it; every tile leads with a
pink-orange heading; *Report* → *Generate report*, an outlined pink-orange
button in both themes; the merch legend is pink-orange; *Your evening* →
*Total time invested* with *Stage time rate* / *Full evening rate* headings,
the *Total / My cut* toggle and a fee button that flips both rates to post-fee.
`Biz.calc` takes the plan's percentage and returns `fee` and `cut`; `Biz.sum`
returns `timedSum` and `Biz.rates(timedSum, view)` gives the four readings;
`normGig` stores `cut`. The report's hero, KPIs and table follow the same words
(its rates stay the whole act's, before the fee — an accountant's figures).

**Second pass, same day:** the report grew a sixth card, *Adjust $/h
calculations → Rate settings*, a window with the four hour switches (saved to
the account as `bizPrefs`, so the Studio follows), the *Total / My cut*
toggle and a *Show rates after MySet's fee* switch (kept on the phone under
the Studio's own `myset.biz.view`, so a toggle here is the toggle there); the
report's rates and its $/h column now follow that view and say so. A filed
night learned **what the room paid for**: `moneyForShow` counts the votes
bought (`votes.paid`, the packs' `votes` metadata summed) and the paid requests
accepted (`requests`, a `request_hold` is only `paid` once captured); the row
carries `paidVotes` / `paidRequests`, Re-check fills them on an older night,
and the heal is NOT re-opened for them (a block written before the counts has
nothing to yield — the same rule as `key`). The editor sheet and the report's
venue cell read *"63 votes · 40 free · 23 paid · 2 paid requests"*, free votes
being the tally less the bought ones, floored at zero; a night that does not
know says only its tally. The Shows list shows three and folds the rest behind
*Show N more* (a search or *Pick shows* lists every row).

## How it was verified

Built in a clean worktree off `origin/main` (`b966884`, rebased onto `34215b8` when
three commits landed mid-build and took number 0062), one maths builder then three
builders on disjoint files, a five-lens fresh-context review with two skeptics per
finding (8 majors confirmed, 0 refuted, all fixed with a test that was red before
the fix), then:

- `sh test/run.sh` — exit 0, **2,693 ✓, 0 ✗** across 44 files. New: `test/biz.mjs`
  136 ✓ (free 402 with the message, member 403, band/costs over the cap 402 naming
  both plans, the growth rule after a downgrade — and a night pre-filled from a
  Rock Star rule of eight, a full book refusing an add but taking a remove, the
  record following a moved gig, the export carrying `business`, no key left after
  a purge, the founder's `cutPct` 0); `test/bizmath.mjs` 149 ✓ (calc, parseHm
  incl. `'3'→180` and `'90'→NaN`, the join by key / by the 30-minute window /
  orphans / two nights on one gig / a `stripe-unreachable` night → `app:null`, a
  rule-only slot listed and not counted, a record found under every key its night
  ever had, the rate over the timed subset, the constants equal to the server's).
- `test/cost.mjs`: **6 reads for the Money tab, 7 for the report** on a Bearer
  call, the first admin action ever counted. `test/books.mjs` 75 ✓: an
  unconnected artist AND an unconnected venue get `enabled:false` with platform
  rows present; a cache computed against the wrong account is recomputed once.
  `test/histname.mjs` 53 ✓: `key` and `source` on the doc and the row, the heal
  back-fills `source`, *Re-check* clears "app money not available" on the row,
  *Name these from my calendar* stamps the key. `test/autoshow.mjs` 123 ✓: a hand
  start near a gig stamps `autoKey`, a fresh start far from one clears it.
  `test/structure.mjs`: five stamps in order, the module is one IIFE that
  redeclares none of studio.js's top-level names, no `has('band')`.
  `test/syntax.mjs` now `node --check`s every `public/*.js`.
- `MYSET_PUBLIC=<worktree>/public node tools/uicheck.mjs` — **159 ✓, 0 ✗, 0 page
  errors**: the Money tab as a Bar Star owner (hero $765.50 from a logged night plus
  a filed one, the unreachable night adding nothing and saying so, the rule-only
  slot listed and not counted, *Log tonight* in the upper half of an 844 px phone,
  the editor's sticky readout following every keystroke without a render, `90`
  refused as hours, the draft kept, the module forgotten on sign-out, a past gig
  added on the Gigs tab listed after one fresh `bizGet`, *Add it* with nothing
  typed sending no `bizSave`, a record whose gig is gone listed as *Logged show*).
  `tools/sheetcheck.mjs` 12 ✓. Full-page screenshots at 390 px, both themes, of
  the tab, the editor, the hours sheet and the gig form, looked at by eye.
- The report: headless Chrome against the worktree with a mocked `bizGet` — 35 ✓
  (one call with `nights:true`, the hero labelled *before fees* when app money is
  in it, the sentence for the unreachable night, dates with a full year, the
  `?shows=` mode, 402 / 403 / no-session / failure states, a print-media render
  and an A4 PDF).

**Not checked:** anything on the live site (nothing is deployed); a real phone's
touch on the `.sheet.biz` drag exception; `prefers-reduced-motion` under emulation;
the founder's own Money tab with his real nights; the `#gDate` change path opening
the disclosure; a bizGet that turns 402 mid-session; the report at 390 px.
