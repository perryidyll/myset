# Gig week one — the first real data, and what it did to the money model

2026-09-11. The user: *"i have been using the app at real gigs all week – please analyze
all of the data and generate an in-depth report of your findings in simple language
and a crisp top level tl;dr (except for the shows that were at random times
throughout the day and possibly lasted for inordinate amounts of time – these were me
starting/ending a show manually for testing purposes, so only analyze the data from
the shows that aligned with the actual shows i have published). please explain to me
how all the data is being stored too … once you've analyzed all the data, please
update the money model accordingly … please give me a tl;dr overview on these
differences too."*

The report itself, in plain language, is `finance/reports/2026-09-11-gig-week-one.html`
(also published as a private artifact, "Gig Week One"). This file is the working
record: what was read, how it was checked, what changed, and what is still open.

---

## 1. What was read (all read-only against production)

- Every archived night: 17 `hist_perry-idyll_*` documents plus the three `hist_samcole_*`
  load-test records and the two legacy `hist_<showId>` copies, via `netlify blobs:get`.
- The live show document, the calendar (`ev_perry-idyll`), the scheduler index
  (`gigsched`), the registry, the platform ledger, the fan-request list, the history
  indexes, venues, promos.
- Netlify's account-wide bandwidth counter (a new mark, `11 Sep, after the gig week`,
  335,747,208 bytes in the period from 8 Sep) and the deploy list for all six sites.
- Netlify's pricing page (15 credits per production deploy confirmed).
- The code paths that write and read all of it, and their git history.

A safe copy of the show records, calendar and requests (no passcode hash, no emails)
is in `finance/fixtures/2026-09-11/` and is what `tools/actuals-test.py` runs against.

## 2. How it was checked

A workflow of six analysis lenses (engagement, lifecycle, server cost, money,
model-vs-actual, storage) over one shared dataset, each followed by a skeptic told to
refute every numbered claim against the raw files, then a reconciler that recomputed
anything still in dispute. 13 agents, 319 tool calls, 24 minutes. Twelve claims were
refuted and replaced with recomputed figures; the important ones:

| The lens said | The skeptic showed | Used |
|---|---|---|
| The Stripe key was "later removed" (my own ground truth said so too) | It was REPLACED and verified live at 8 Sep 21:57 local (commit `d329a90`); the archives kept saying `stripe-unreachable` because of a code bug (below) and `off` because deploy previews share the store with the key unset | The corrected timeline |
| 14 of 95 votes were for songs never played | ≥28 of 95 — the lens applied the stays-cast formula to Sunday's wipe-rule night | 29.5% |
| Votes per phone fall monotonically with room size | Not monotonic on 4 nights (7→2.29, 8→3.13, 14→1.93, 18→1.50); monotonic on the 3 comparable ones; r = −0.83 | The pattern, with the caveat |
| The tracker "as written" would count 13 nights | True of the committed file; the on-disk file already had the calendar rule | Withdrawn |

Where the lenses disagreed among themselves — which hours a night should contribute —
the resolution is in §4.

## 3. What the week says

**Which records are real.** 17 archives: 5 real gigs (30 Aug Sand & Tan; 6 Sep Sand &
Tan; 7 Sep Ugly Duckling; 8 Sep Crystal Day; 9 Sep Anantara), 1 on the calendar but
unused (4 Sep Seaflower, one phone), 1 accident (a show left running 107.9 h across
four gig nights, 31 Aug–3 Sep), 10 hand-started tests. Plus Thu 10 Sep, which the
scheduler started at 19:00:47, the artist ended at 19:21, nobody came, nothing filed.
The app was used at 5 of the 11 gigs published since 30 Aug.

**The four nights this week.**

| | Sun 6 | Mon 7 | Tue 8 | Wed 9 |
|---|---|---|---|---|
| Room | Sand & Tan | Ugly Duckling | Crystal Day | Anantara |
| Phones · networks | 8 · 7 | 14 · 11 | 7 · 6 | 18 · 4 |
| Votes | 25 | 27 (+4 requests) | 16 | 27 |
| Most voting at once | 5 | 5 | 4 | 5 |
| Song starts (full performances) | 7 (7) | 15 (11) | 8 (6) | 15 (11) |
| First→last song | 2.17 h | 2.09 h | 0.51 h (last 30 min only) | 2.93 h |
| Record | 2.53 h | 2.81 h | 4.23 h | 6.00 h (auto-ended, slot + 3 h) |
| Counted length | 2.53 | 2.81 | 2.09 | 4.07 |
| Card path | dead | dead | dead until 21:57 | working all night, unread |

Totals: 47 phones, 95 votes, 45 starts, 4 requests (1 added, 3 declined). Averages
over the five real nights (with 30 Aug): 11.0 phones, 23.2 votes, 2.35 votes+requests
per phone, 11 starts, 2.74 h.

**Patterns (all survived the skeptics):**
- 4–5 phones vote at any one moment regardless of room size, so votes per phone fall
  as the room grows (2.29 → 1.93 → 1.50 on the three comparable nights).
- Voting front-loads: 30% of votes before the first logged song; 0–2 in the last
  30 min of every set.
- ≥28 of 95 votes (29.5%) never became a play. Landslide, All Of Me, Ain't No
  Sunshine recur across nights.
- 41 of 45 starts had a vote, but 23 of the 38 board-leader starts were ties at 1–2.
- Participation floor 40% (peak voters ÷ phones); with the 3-credit cap, ≥64% Mon,
  ≥86% Tue, ≥50% Wed.
- The song log records taps: 10 starts re-tapped within 150 s; unlogged heads of
  10 / 31 / 95 / 68 min.

**Money.** The only room money ever recorded is $3 on 30 Aug ($0.375 per voter — the
denominator was 8 peak voters, phones were not counted then). The key was dead from
soon after 30 Aug to Tue 8 Sep 21:57 local. Sun/Mon: dead button, error toast on tap.
Tue: dead during the whole voting part. Wed: working checkout in front of 18 phones —
takings unread (last Stripe pull Tue 23:07 local; the connector in this session was
invalidated). Packs changed mid-week (5 free / $5 for 5 → 3 free / $5 for 3, $20 for
15 from Tue night).

**The archive bug.** `_history.mjs` passed `stripeFor()`'s `opts` — `{}` for an artist
on the platform account — to `stripe.checkout.sessions.list(params, {})`. stripe-node
17 throws "Unknown arguments" on an empty options object before any request, so every
archive since the 2 Sep deploy read `stripe-unreachable` whatever the key's state.
Reproduced locally: `list(p, {})`, `create(p, {})`, `paymentIntents.cancel(id, {}, {})`
all throw; `retrieve(id, {})` does not. Same shape in `revenue.mjs` (Studio Money tab),
`_ledger.mjs` `pull` (books), `_requests.mjs` (three `cancel` sites for held requests)
and `pay.mjs` (the founder's checkout when the phone sends no attempt id). The test
double swallowed `{}`, which is why 50 tests never saw it.

**Cost.** Period since 8 Sep (74.1 h): 335.7 MB = 6.7 credits ≈ 7¢. Deploys in the same
days: 24 × 15 = 360 credits ≈ $3.60. Trailing 30 days: 216 deploys (153 myset.vip) =
3,240 credits ≈ $34/month on Personal — the whole bill; the four gigs ≈ 18¢ (2.2 / 3.5 /
3.4 / 8.6 credits on the model's engine at room × counted hours). Per event: deploy 15 >
gig 2–9 > clip view 1.5 credits. The model's arithmetic puts the two real gigs in the
period at ~56 MB; the three profile clips (73.8 / 74.8 / 78.6 MB, uploaded ≥ 7 Sep)
explain the remainder at 1–3 views. Polls per phone-hour: unmeasurable — the two marks
straddle the 8 Sep reset, and Sun/Mon fell before it with no reading taken. The
account's `credits.used` field is unpopulated (0), so no Netlify counter corroborates
the deploy charge; the pricing page does.

**Storage.** Netlify Blobs: one store `myset`, key→JSON documents, no queries; names
computed from the artist id; fans sharded across 12 documents; archives written at
end/next-start before the wipe; per-fan votes and IPs deliberately not kept; Stripe the
source of truth for money; CAS writes with read-back verify; three ways in (functions,
CLI as owner, the tracker); no TTL, no backup; ~102 of 199 keys are dead weight; the
three clips (227 MB) dwarf all the text (~92 KB).

## 4. What changed

### `tools/actuals.py`
- `calendar()` / `gig_for()`: a night counts only if it started on a published gig day
  between 90 min before the slot and its end (in the gig's own zone). Not matched → "not
  on the published calendar — started <local>; a test or an accident". On the calendar
  with one phone and no votes → `onCalendarUnused`, listed, not averaged.
- Hours: the record, unless it overran the slot; then `min(record, max(slot, start→last
  song))`. Three definitions were on the table — first-to-last song (1.92 h, collapses
  on Tuesday's late Studio use), slot-capped record (2.51 h, undercounts Wednesday where
  the room was still voting 4 h in), start-to-last-activity (2.78 h). The chosen rule
  gives 2.19 / 2.53 / 2.81 / 2.09 / 4.07 = 2.74 h; `setHours` and `recordHours` are
  reported alongside, never fed to a dial.
- `merge_split_nights()`: two records inside one slot (accidental End then Start) become
  one night.
- `silent_nights()`: published gigs since the first counted night with no record at all
  (31 Aug, 1, 2, 3 Sep, 10 Sep). Output: `gigsOnCalendar 11 · gigsUsed 5 · gigsSilent 5`.
- `interactions` = (votes + song requests) ÷ phones, from `req_<artist>`; feeds the
  model's "actions per person" dial.
- `--clip-views N` on a mark: subtracted at 75,000,000 bytes each (`BYTES['clip']`,
  drift-guarded by `model-test.mjs`).
- `tools/actuals-test.py`: 25 offline checks on the 11 Sep snapshot plus a synthetic
  bandwidth solve (recovers 3,000 polls exactly with two clip views recorded; ~59,000
  phantom polls without).

### `finance/model.html`
- `interactions` dial carries `real: 'interactions'`; `applyActuals` maps it.
- New dials `clipViews` (0.5 a gig — a guess, labelled) and `clipBytes` (75 MB); the
  engine adds `clipViews × clipBytes` to a gig's bytes and one request each; the formula
  line shows the clip share.
- `PRESETS.bench` reads `SEED_ACT.people / hours / interactions / deploys` instead of a
  hard-coded 8.
- First-ever load (no stored preference) opens with real shows ON; switching off is
  remembered.
- `renderActSummary` shows gigs used of published, set hours, votes, interactions,
  songs, per-person room money.
- `SEED_ACT` regenerated from `finance/actuals.json` with the corrected note; the
  Benchmark toast and the "what is carrying these numbers" band updated (per voter,
  40–60% of phones vote).
- `model-test.mjs`: 53 checks — `applyActuals` mapping, seed = actuals.json drift guard,
  tracker rule presence, clip bytes constant match, audit-shape tests pinned to
  `clipViews: 0`.

### Projection deltas (Benchmark case, the opening screen, 1,000 artists)

| | Raw defaults | One night (5 Sep seed) | Five nights (today) |
|---|---|---|---|
| fans / hours / interactions / deploys | 20 / 3 / 2.5 / 176 | 8 / 2.19 / 2.5 / 176 | 11 / 2.74 / 2.35 / 216 |
| Revenue | $12,677 | $3,019 | **$3,835** |
| Profit | $9,956 | $1,378 | **$2,165** |
| Break-even | 37 | 212 | **148** |
| Server per gig | 3.9¢ | 2.4¢ | 3.1¢ (≈1¢ the clip guess) |

The whole move is fans × $0.375. That figure is per voter (n = 1 night); only 40–60% of
phones vote; if it is really per voter, the cut line halves. Stated on the page.

### The app (`netlify/functions`)
- `_connect.mjs`: `export const scope = (opts) => (opts && Object.keys(opts).length ? [opts] : [])`.
- Applied at `_history.mjs` (money lookup), `revenue.mjs` (Money tab), `_ledger.mjs`
  (`pull`), `_requests.mjs` (three `cancel` sites), `pay.mjs` (checkout create).
- `test/stripe-fake.mjs` throws on an empty options object exactly as the library does
  (except `retrieve`). The stricter fake immediately caught the `pay.mjs` site ("THE
  FOUNDER'S OWN ACCOUNT IS UNTOUCHED" went red, then green). Full suite: 38 files,
  0 failures.
- INVARIANTS 0ef rewritten (calendar rule), 0fc added (Stripe options).

### Records
- `finance/actuals.json` written from production with the final rules.
- `finance/fixtures/2026-09-11/`, `finance/reports/2026-09-11-gig-week-one.html`.
- `finance/README.md` tracking section; `.claude/launch.json` gained `myset-finance`.

## 5. Verified

- `node finance/model-test.mjs` — 53 checks, all passed.
- `python3 tools/actuals-test.py` — 25 checks, all passed.
- `./test/run.sh` — 38 files, 0 failures (after the fake was made strict).
- Live tracker run against production: 5 nights, 11.0 phones, 2.74 h, 2.35, 216
  deploys, identical to the offline fixture run.
- Browser (local static server): fresh load opens with real shows on, seven dials
  marked real, `REAL SHOWS 5 used · 2026-09-11`; Benchmark preset yields revenue $3,835 /
  profit $2,165 / break-even 148 with fans 11, hours 2.74; no console errors; 375 px
  wide with no horizontal scroll; dark mode paints.
- Engine cross-check: the model-vs-actual lens, its skeptic and my own `delta.mjs` ran
  the engine independently and agree to the dollar.

## 6. Not done, deliberately

- Netlify's billing page could not be read (Chrome extension not connected); the
  15-credit deploy charge rests on the pricing page. Ask: confirm ~360 credits from
  deploys this period.
- Wednesday's takings: needs the Stripe connector reconnected or a look in Stripe.
- Deleting ~102 dead keys and a scheduled read-only backup dump: production actions,
  the user's call.
- App defects noted, not fixed: `requested[]` over-counts vote-rounds since 7 Sep (the
  archive comment "votes are wiped each time a song starts" is stale); every Start tap
  counts against the free cap (25 starts in September vs 15 real); archives lack
  `startedBy/endedBy`; `histidx` `endedAt` inflated for re-archived records; six records
  carry the stale "Ugly Duckling" venue string.
- The uncommitted edits to `public/artists.html`, `public/index.html`,
  `public/studio.html` from another session were left untouched and not committed.

## 7. For the user, this week

1. Tonight (Seaflower, auto-start 18:30): tap End when the set ends.
2. Reconnect the Stripe connector / check Stripe for 9 Sep evening.
3. Netlify › Billing › Usage: is the deploy line ~360 credits?
4. Marks around Sunday: `--mark "before Sun gig"` the evening before; after,
   `--mark "after Sun gig" --studio-min N --clip-views 0`; no clip views between.
5. Then `python3 tools/actuals.py --write` and paste into the Real shows panel (or
   deploy — the seed is baked in).
