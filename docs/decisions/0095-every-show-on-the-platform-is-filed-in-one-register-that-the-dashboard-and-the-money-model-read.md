---
id: 0095
title: Every show on the platform is filed in one register that the dashboard and the money model read
date: 2026-09-25
status: decided
decided_by: perry-confirmed
area: money
reverses:
superseded_by:
invariants: [0gi]
commits: [a8cd3c9]
tests: [test/everyshow.mjs, finance/model-test.mjs, tools/actuals-test.py, test/metrics.mjs, test/sheets.mjs, test/structure.mjs]
files: [netlify/functions/_register.mjs, netlify/functions/_nightrule.mjs, netlify/functions/_showsdash.mjs, netlify/functions/registercron.mjs, netlify/functions/_passgate.mjs, netlify/functions/moneymodel.mjs, netlify/functions/_lifecycle.mjs, netlify/functions/_history.mjs, netlify/functions/_pay.mjs, netlify/functions/_metrics.mjs, netlify/functions/_warehouse.mjs, netlify/functions/_mirror.mjs, netlify/functions/_auth.mjs, netlify.toml, finance/shows.html, finance/model.html, finance/fixtures/2026-09-25/, tools/actuals.py, INVARIANTS.md, finance/README.md]
---

## The question

The founder, 2026-09-25: *"set up a robust system for tracking and reporting the numbers
from ALL shows from ALL artists … i want to see literally the data on every single show on
the platform — who hosted it (artist & venue), what country/city, how long, how many
people, how many tips/votes bought/merch bought, etc. — track and report all of it …
create an entirely new dashboard for this that then feeds into and continuously updates
the money model."*

What existed: every finished night is filed by the archive (`hist_<aid>_<showId>`, an
index row, an append-only id list — decision 0043/0065); the money model's real-show
numbers were produced by a Python script run by hand on the founder's Mac against
production (`tools/actuals.py`, decisions 0031/0089) and pasted into the page; a
"Current Show Stats" snapshot (0071) was filled by another hand-run script and published
as an artifact once a day; the Google Sheet (0072/0073) exported per-night rows when its
env vars exist. Three places judged "which nights count" three ways. Nothing ran on its
own, nothing was platform-wide on a page, and the model's numbers went stale between
audits. Six artists are on the platform; one has played (fifteen counted nights).

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: a register folded on the server, a dashboard behind the model's door, a live feed into the model** | A scheduled function walks the registries and each artist's own index (no `list()`), builds one lean row per filed night into month shards under a head with the roll-ups, and the model's Real shows panel reads the head's `act` block live. The night rule moves into one module every page uses. | A week of work; a bell every ten minutes (an idle ring is two reads); one more page in `finance/` | `_register.mjs`, `_nightrule.mjs`, `_showsdash.mjs`, `registercron.mjs`, `_passgate.mjs`, four store documents (`register`, `register_<YYYY-MM>`, `register_work`, `registersync`), `regdirty` marks on `gigsched` | A fold that writes bad rows shows bad numbers to the founder (never to a fan or an artist); a runaway ring costs reads — bounded by BUDGET_MS, MIN_GAP and the run lock |
| B — ship `finance/metrics.html` at /metrics as 0071 foresaw | The existing snapshot behind the passcode | An afternoon | one function | Per-night rows without money breakdown, merch, requests, country; still hand-filled per view (every open walks the store); a second night rule; nothing feeds the model |
| C — keep pasting `tools/actuals.py` | Nothing changes | Nothing | none | The model's numbers are as fresh as the last audit; nobody sees the other artists' nights until an audit |
| D — compute everything on each page open, no stored register | The dashboard walks the store per view | Nothing stored | one function | Fine at six artists (~60 reads); at a hundred, seconds per open and a walk on every founder tap; requests, RSVPs and ratings still decay because the store forgets them |
| E — do nothing | As C | Nothing | none | As C |

## What was chosen, and why

**A.** The founder asked for a system that runs indefinitely and reports every show, and
for the model to update continuously. A stored register is the only shape that gives all
three: it is built once per change (not per view), it can remember what the store forgets,
and the model can read one small block off it. It stays honest by refusing to be a second
ledger: every figure is read off the record the app already keeps, and money is Stripe's
answer as the archive kept it — or "unknown", never $0.

The shape, as built (the code is the record; this is the map):

- **One night rule, one place.** `_nightrule.mjs` judges a filed night — counted, unused,
  refused — with the tracker's rules ported line for line (on a published gig no earlier
  than 90 min before the slot and no later than its end; nobody there; no start or end;
  ended before it started; one phone and no votes; ten or more phones on one network in
  under half an hour; under 30 minutes; over 12 hours with no gig). `_metrics.mjs` (the
  stats page) and `_warehouse.mjs` (the Sheet) call it; `tools/actuals.py` is pinned to the
  same answers on two snapshots of production (`finance/fixtures/2026-09-11`, `2026-09-25`:
  5 nights; 15 nights, 2 unused, 13 refused, $1.037 a head). `test/sheets.mjs`'s synthetic
  night now runs two hours, because a two-millisecond night is a demo everywhere.
- **The register.** Month shards `register_<YYYY-MM>` (keyed by the night's local day,
  spilling into `_<n>` parts past 700 KB), a head `register` with the roll-ups (by artist,
  venue, country, city, month, weekday; the platform's most-played songs; sign-ups by month
  and first touch; totals; the model's `act` block), working state `register_work` (row
  signatures, frozen counts, per-night song tallies, silent gigs, departed artists, re-check
  marks) and the bell's state `registersync` (lock, cursor, watermarks, calendar etags).
  A row is lean (~600 B): no song list — a night's own page is read on demand from its
  `hist_` document, stripped of anything a fan typed.
- **One writer.** `foldRegister` runs under the lock in `registersync`, from the bell
  (`registercron.mjs`, every ten minutes) or the dashboard's Refresh. Nothing on the End
  tap or in the scheduler's ring folds: `markLive`/`unmarkLive` in `_lifecycle.mjs` and the
  rename/hide/re-check actions in `history.mjs` leave a `regdirty` mark inside a write they
  already make, and the next ring folds those artists first. An idle ring is two reads. A
  full walk happens at least every six hours (renames, heals and re-checks leave no mark
  on the store's other documents). Per artist the fold reads the index, the id list and
  the calendar; a night's detail is read when it is new, its index row changed (`rowSig`)
  or the calendar's etag changed; the five other documents only then. Time-boxed at
  BUDGET_MS with a cursor, so a big registry is walked across rings.
- **What the store forgets, the register keeps.** `req_` keeps 80 rows, `rsvp_` prunes three
  days after the gig, a device's re-rating replaces its earlier row — and `interactions`
  (votes + requests a phone) is a dial the model takes from here. So request, RSVP and
  rating counts are frozen on first observation and only ever raised (the index row's
  never-go-down rule), and since this change the archive files request and RSVP counts,
  the plan the night was played on, who started and ended it, and the gig's country and
  zone on the night itself. The register is therefore not merely derived and is mirrored
  (`_mirror.mjs` GLOBALS + the shards named by the head).
- **Money.** `$ a head` = (tips + vote packs + paid requests) ÷ phones over nights with
  money known; merch is the app's own order record, goods and postage apart, never in it.
  Untagged money is a window figure: a merged night takes it once, and `moneyForShow` no
  longer counts an untagged payment made after the next night began. The morning after a
  night (10 h) the bell asks Stripe once more (`reconcileShow`, two a ring) so a tip from
  the walk home lands on the row. The app's own tip and pack marks now carry the show tag
  (`_pay.mjs`), shown beside an unknown Stripe answer as a marker, never as the figure.
- **Where a night was.** Country and zone come off the record (stamped since this change),
  else the calendar gig the night lines up with, else a venue in the registry with the
  same name (only when exactly one matches and it does not contradict the record), else
  the tail of the "City, Country" text older nights carry. The row says which.
- **The dashboard** lives at `/moneymodel/shows` (`myset.vip/shows` 301s to it) behind the
  money model's passcode — the same `fm` cookie, scoped to `/moneymodel`, covers the page,
  its data (`shows.json`), its CSV, a night's page (`shows/night.json`) and the model's
  feed (`live.json`) — served from `finance/` outside the published folder, CDN chart and
  fonts localised to `/vendor/` like the model, `private, no-store`, `noindex`. Hidden is a
  flag beside the status (the totals follow the rule on both sides; the page greys it);
  silent gigs are rows with dashes; a departed artist's nights stay, nameless, so the
  platform's ledger never moves.
- **The feed into the model.** `finance/model.html` asks `/moneymodel/live.json` on load and
  lays the block over its baked seed keeping METER_KEYS from the seed (ticks per
  phone-hour, credits a night, deploys, the two bills — Netlify's dashboard numbers, read
  by hand). Precedence: the live feed when it answers with nights; a paste only when
  pasted after the live build; the seed otherwise. The REAL SHOWS stamp names the winner.
  The published artifact has no myset.vip origin and keeps the seed.

Perry confirmed the ask and the shape ("create an entirely new dashboard for this that
then feeds into and continuously updates the money model"); the engineering choices
(cron-only writer, month shards, hidden as a flag, the door under `/moneymodel`) came
out of a three-critic review of the design brief and are recorded in the session note.

## What this makes harder

- A new place to keep in step: any field added to a filed night that the founder should
  see has to reach `slimNight`, `buildRow`, the CSV columns and the page.
- The register remembers counts the store has since forgotten, so a wrong observation
  cannot be corrected by fixing the source alone — `register_work.observed` must be edited
  (or the night's row rebuilt with `rebuild: true`). The trade is deliberate: the
  alternative was a dial that decayed every fold.
- `tools/actuals.py` still expands calendars by weekday (weekly/biweekly, no `until`, no
  monthly); the server uses the scheduler's own expansion. Identical on every calendar so
  far and pinned on two snapshots; a monthly rule or an `until` would make the two
  disagree until the Python is ported. The Python is now the meters' tool, not the
  nights'.
- The service worker keeps a copy of any page the founder opens for offline fallback on
  his own phone (sw.js rule 2) — `/moneymodel/shows` included, as `/moneymodel` already
  was. One device, offline only; `.json`/`.csv` are never served stale.
- The passcode is the model's courtesy lock (PER-010, `FINMODEL_CODE`, still the code in
  the repository until the founder sets one in Netlify). This page shows every artist's
  takings per night, so the lock matters more than it did; the code is not printed here.
- Current Show Stats (`finance/metrics.html`, 0071) is superseded as a founder surface —
  its snapshot builder stays for the Sheet and re-exports the one rule; its daily
  artifact republish should stop (MET-001 retired). Posts and sign-ups: sign-ups moved
  into the register's roll-ups; community posts did not (the community side owns them).

## What would reverse it

- A month shard that spills into parts routinely (the head's `months[]` shows `parts > 1`)
  is the signal the register should move to one document per artist per month, or to a
  real table.
- A ring that hits BUDGET_MS every time (the head's `build.finished === false` on most
  rings) means the walk is too wide for a ten-minute bell: raise the budget, or fold in a
  background function.
- If the idle ring measurably moves the empty-day meter (INVARIANT 0ge — re-take
  `finance/credits.json`'s empty day after this ships), the bell goes to every thirty
  minutes.
- If the founder wants hidden nights OUT of the platform figures, `tools/actuals.py` must
  learn to read `histidx_` first — pick one side and change both.
- A second country in the money-known nights retires the Thai-floor sentence by itself
  (it is computed from the rows, never typed).

## How it was verified

- `node --import ./test/register.mjs test/everyshow.mjs` — 91 ✓: the same five nights as
  the tracker on the 11 Sep snapshot and the same fifteen (2 unused, 13 refused, $1.037 a
  head, 8.6 phones, 2.73 h, 2.09 actions a phone, 22 gigs on the calendar, 5 silent) on
  the 25 Sep snapshot; the twelve hidden nights flagged and none counted; place resolution
  in all four orders; nothing about a fan in the register or the CSV; frozen counts never
  going down; a filed count winning when larger; two records in one slot merged with
  untagged money once; end to end on the fake store — a night stamped with country, zone,
  plan, who started/ended it and its request count, a mark on start and none on the End
  tap, the first fold, a second fold reading no detail, the mark cleared, rename and hide
  reaching the register, a departed artist nameless with totals unchanged, the door on
  seven paths without the code, the page localised with no external script, `private,
  no-store`, the data, the CSV, a night's page, the feed with none of the meters, a refresh
  inside the gap saying so, two `fm` cookies, and the bell idle in two reads / folding on a
  mark / waiting on the lock.
- `node finance/model-test.mjs` — all passed, with the live feed's precedence pinned (live
  over a paste made before the build, a paste made after wins, seed last), the merge
  keeping every METER_KEY, the register's `act` carrying none of them and all the seed's
  platform fields.
- `python3 tools/actuals-test.py` — all passed, the 25 Sep snapshot added (15/2/13, $1.037,
  8.6/2.73, five silent, a merged night takes untagged money once).
- `sh test/run.sh` — see the session note for the count; `test/sheets.mjs` and
  `test/metrics.mjs` green on the shared rule; `test/structure.mjs` now checks that every
  address the toml routes is a reserved slug.
- The dashboard opened in a real browser against `tools/localhost.mjs` (the real functions on
  an in-memory store) — see the session note for the screenshot.
- NOT checked here: a fold against production's real store (the first ring after the merge
  does it; the head's `build` block on the page is the evidence), the empty-day meter after
  the bell has run for a day, and Netlify's actual scheduled-function timeout (BUDGET_MS
  is set to six seconds under the repo's measured ~12 s death).

## Amendment, 2026-09-26: the page's look

The founder asked for the dashboard to wear the /mediadash look (decision 0092) and for
the tables to read more clearly. `finance/shows.html` now uses the /mediadash tokens and
the system's own SF type, so it loads no web font at all. The main table groups its
money columns (Votes: all / bought / $ · Tips: count / $ · Merch: items / $), shades
alternate column bands with each group as one band, pins a totals row under the headers
that adds up whatever the filters show, and paints every dollar figure above zero green.
No table window shows more than fifteen rows before it scrolls. Every chart names both
axes. The nine breakdown tables sit in a carousel, two in view, turned by arrow buttons.
The night opens in a side drawer. The data, the endpoints and the rules are unchanged.

The by-country chart had printed "$0" on its country axis: the dollar formatter was on
the wrong axis of a horizontal bar chart. Fixed; the tooltip now says dollars too.

## Amendment, 2026-09-26 (later): the model in the same look

The founder asked for the money model to wear the same look, and for four changes on
both pages: column headings larger, bold and in the ink colour; the totals row shaded
light orange with its text not black; the By artist and By venue tables full width and
stacked, not side by side; the "how these numbers are made" part on a darker ground; a
divider above the main table and a hero above it. `finance/model.html` now uses the
shows page's tokens and system type; its engine, its data and its endpoints are
unchanged, and so are the functions `finance/model-test.mjs` reads out of it. Sum rows
and totals are one light orange on both pages; the model's selected-host row moved from
orange to blue so a highlight never reads as a total. Every table on both pages shows at
most fifteen rows before it scrolls. The breakdown carousel now turns a page of two
tables, one above the other.
