# 2026-09-13 — The business dashboard for the paid plans

Branch `crm/artist-dashboard`, worktree off `origin/main` `b966884`, rebased onto
`34215b8` mid-build, then onto `f004926` to ship. Decision `0065` (numbered 0063
when written; #30 took that number on `main` and the merch batch holds 0064), INVARIANT
0fn. **Live as `81a48f3`, PR #31, 2026-09-13**, with the founder's first pass folded in.

## What was asked

"A full CRM / business management dashboard for all the essentials artists need to
track (paid plans only)": start from the Money tab and redesign it as a sleek,
minimal, professional dashboard with charts and restrained delight; pay per gig with
up to 5 / 10 band members (Bar Star / Rock Star) and their amounts, editable on the
gig form and again after the show; cash tips; merch sold and in what quantity; up to
5 / 10 costs per show; four time fields (performing, break, travel, set-up/break-down);
profit; an hourly rate with a toggle per time field — *"people think 'oh you get $x
just to play music for 2 hours' but in reality it takes like 4 hours or so of my
evening"*; an equipment list that bullets itself; a branded, professional report for
any date range or any chosen shows; fast to open, smooth to use, built to change.

## How it was built

Ten fresh-context readers mapped the Money tab, the gig form, plans, storage, the
admin API, the visual system, the tests, the invariants, merch and the filed nights;
a critic named twelve gaps and twelve readers answered them by reading code. A
design contract (`DESIGN.md`, in the session's scratchpad) was reviewed by three
critics — risk, the artist, engineering — whose thirty findings rewrote it (the
five that mattered most: a night archived `stripe-unreachable` must never print as
$0; a residency rule is not income for a night that was never played; "Profit" says
"before app fees" whenever app money is in it; *Log tonight* must sit above the
charts at 1 am; nothing in the suite parsed an external script). Then one maths
builder, then three builders on disjoint files, a five-lens review with two skeptics
per finding, and a fix round. Every builder verified in a real browser against the
worktree — `tools/uicheck.mjs` learned `MYSET_PUBLIC` for that.

## What changed

**Server.** `netlify/functions/_biz.mjs` (new): the artist's book `biz_<aid>` — a
record per night keyed `eventId@date` (the scheduler's own `occKey`, now in
`_events.mjs`) or by `showId`, a default per run in `rules`, prefs for the hourly
rate; `normGig` trims, caps and refuses; caps enforced **against growth** (0s); the
document capped at 400 KB on growth; orphan rules pruned. `admin.mjs`: `bizGet`
(one hop for the book + the calendar expanded on the server; `nights` only for the
report; 6 / 7 reads under `test/cost.mjs`), `bizSave`, `bizPrefs` — owner-only,
402 on free with the plan named; `eventSave` re-keys a record when a one-off gig
moves; `eventDelete` prunes rules; `planGet` forwards `band`/`costs`; the
founder's `cutPct` is 0. `_plan.mjs`: `band` 0/5/10, `costs` 0/5/10; the `reports`
comment names the dashboard; `NOT_BUILT` untouched. `_lifecycle.mjs`: a hand start
near a gig stamps `autoKey`/`autoEvent`; a fresh start far from any gig **clears**
them (they were never cleared before). `_history.mjs`: the filed night carries
`key` and `source` on the doc and the row; the heal back-fills `source`
(`ROW_TOPS`); `reconcileShow` writes `source` to the row; `placeShows` stamps the
key and reports `placed` / `keyed` separately. `_account.mjs`: the book in the
export as `business` and in `keysFor`. **D14:** `admin.mjs` and `venueadmin.mjs`
`ledger`/`ledgerCsv` answer `enabled:false` for an owner with no usable Connect
account instead of MySet's platform statement; `_ledger.mjs` stamps the account on
the cache and recomputes once when it changes (INVARIANT 0fn).

**Client.** `public/biz.js` (new, 16 KB, loads in node): the maths — `calc`,
`join` (by key, then the 30-minute window `placeShows` uses, then orphans; a
record is found under every key its night ever had), `sum` (counted shows only;
the rate over the timed subset), `parseHm` (a bare number is hours), bullets,
money. `public/studio-money.js` (new, one IIFE, `window.Money`, its CSS injected
once, loaded on demand and pre-warmed for a paid owner, never for free or a member
seat): the tab — *Log tonight*, a scrolling period row, the profit hero and tiles,
profit by month / by show, the mix donut, *Total time invested* with both rates, Shows
(pick mode for the report; *Log it* / *Didn't happen* on a rule-only slot; *Re-check*
on an unknown night; *Logged show* for a record whose gig is gone), Merch, Band,
Costs, then the Stripe cards; the editor sheet with a sticky profit readout, a
draft on the phone, a non-optimistic Save, the drag-to-dismiss exception; the gig
form's *The business side*. `public/studio.js`: the hooks (render branch, `ensureMoney`,
pre-warm from `loadPlan`, `Money.forget()` on sign-out and every door back in,
`Money.stale()` after every calendar write, the disclosure, the `saveGig2` chain,
`TIER_COPY`, the free-plan row reworded, the member line). `public/report.html`
(new, 21 KB): the paper-white branded report — one API call, print CSS, the states.
`netlify.toml`: `/report` above `/:slug`; `/biz.js`, `/studio-money.js`, `/report`
headers. `tools/stamp.mjs`: five ordered pairs, exported for the test.

**Tests and tools.** `test/biz.mjs`, `test/bizmath.mjs` (new); `test/cost.mjs`,
`limits.mjs`, `books.mjs`, `histname.mjs`, `autoshow.mjs`, `structure.mjs`,
`copy.mjs`, `syntax.mjs` extended; `tools/uicheck.mjs` gained a Money-tab pass
and `MYSET_PUBLIC` (also `sheetcheck.mjs`, `clipcheck.mjs`); `tools/overview.mjs`
generates the two caps and the book's constants.

**Docs.** Decision `0065`; INVARIANT 0fn; `docs/processes/money/08-the-business-dashboard.md`
(new) with cross-references from sheets 03 and 07; the Puzzle Money tab section
`42066`, changelog entry 1647; this note; the ledger; `docs/design-system.md` § 15.

## What was verified

See decision 0065 § How it was verified: suite exit 0 / **2,693 ✓ / 0 ✗** (44 files);
uicheck **159 ✓ / 0 ✗** / 0 page errors against the worktree; sheetcheck 12 ✓; the
report's headless check 35 ✓ with a print render and an A4 PDF; `node
tools/overview.mjs --check` current; screenshots of every new screen in both themes
looked at by eye.

## What broke, and what was found

- The review confirmed eight majors, every one reproduced: an unconnected **venue**
  shown MySet's platform statement (the same hole D14 closed for artists); a logged
  record silently dropping out of every total when its gig moved, was deleted or its
  night learned a key; the module remembering artist A's book after sign-out;
  every gig save writing a business rule because the slot length sat in the input's
  value; the Money tab not seeing a gig added on the Gigs tab until a reload;
  *Re-check* never clearing "app money not available" because `reconcileShow`
  wrote `gross` to the row but not `source`. All fixed, each with a test that was
  red on the code before.
- Three commits landed on `origin/main` during the build and took decision number
  0062; this work renumbered to 0065 and rebased (conflicts only in generated
  files and a stamp).

## The founder's first pass (same day, on the localhost)

Words, colours and one field, then shipped: *Total pay from venue*; *Splits*
for *Band* everywhere; the editor titled *Log a show* with no *in $/h* pills; a
*My cut* field under the splits (`cut` on the record, blank = what is left);
the profit green in the plan tag's pill under a larger pink-orange *Profit*,
with *"N% ($x) goes to MySet for transaction fees"*; pink-orange headings on
every tile; *Generate report* outlined; the merch legend pink-orange; *Total
time invested* with *Stage time rate* / *Full evening rate*, the *Total / My cut*
toggle and the post-fee button (`Biz.rates`). Suite 2,571 ✓ / 0 ✗; uicheck
167 ✓ / 0 ✗ / 0 page errors; the report check 35 ✓; looked at in both themes
on the localhost, the fee and cut toggles moving the figures the maths says.
Shipped as PR #31 → `81a48f3`; the live `/biz.js` and `/studio-money.js` compared
byte-equal to the tree and `/studio` names `studio.js?v=ade6a231`.

**Second pass (same day):** the report's *Rate settings* card and window (hours →
`bizPrefs`, view → the phone); a filed night counts the votes bought and the paid
requests accepted (`_history.mjs` `moneyForShow` → `votes.paid`, `requests`; the row's
`paidVotes` / `paidRequests`; Re-check fills an older night; the heal is not re-opened);
the editor sheet and the report's venue cell read *"N votes · free · paid · paid
requests"*; the Shows list folds to three behind *Show N more*. Suite 2,588 ✓ / 0 ✗;
uicheck 173 ✓; report check 44 ✓ (the window exercised: a switch redraws and saves,
the fee switch, My cut with nothing typed changing the words and not the figure).

## Open

- The year shard `biz_<aid>_<yyyy>` is named and not built; the first artist to
  fill 400 KB gets a plain message.
- A rule-only slot MySet ran as a test night is a counted show (decision 0031's
  territory) — no way yet to mark a night "not a gig".
- `dropped > 0` ("MySet keeps your last 400 nights") cannot render on the tab —
  `bizGet` without `nights` does not read the index; the report path does.
- A bizGet that turns 402 mid-session renders the locked row (coded, not seen).
- The report at 390 px is unviewed; the `#gDate` change path is untested.
- The founder's own phone: his real filed nights (nine `stripe-unreachable`, six
  `off`) will read "app money not available" until *Re-check*; the heal back-fills
  `source` on the next Money-tab load.
