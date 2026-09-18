# 2026-09-18 — the founder's Money-tab list (UX-053, decision 0082)

**Asked:** two screenshots and a list from the founder's phone (2026-09-17). The tip
burst on every payment — votes bought as well as tips — but not sitting over a lyrics
or chord chart; *$x from in-app tips* under the profit; a currency; pay on a gig
reaching the dashboard, runs included; the hours boxes on the normal keyboard; the
editor sheet's ✕ half hidden and a save that left the page mid-scroll (screenshot 1);
the tab pinching out to a too-zoomed-out layout with a strip down the right
(screenshot 2); *Shows* → *Past shows*; *All payments* and *MySet's books* folding
5 then 20 at a time; *If something broke* at the bottom; in the editor, the tips
subtotal under the readout instead of in the grey line, and a *Delete show* that also
takes the show off the Gigs tab.

**Built** on `studio/money-tab-batch` off `origin/main` `0b4db1c` (the local `~/Docs/MySet`
checkout is 58 commits behind and carries other sessions' uncommitted docs — not
touched). Decision `0082` has the options and the reasons; the ledger row is UX-053.

- `stage.mjs` — `paid: {count, total, last}`: tonight's vote purchases off `meta.paid`,
  the same window as the tips. `studio.js` `tipWatch` fires on `paid.count` rising;
  `tipBurst(..., 'votes')` says *Votes bought*; `chartOpen()` (a `.chartview` in the open
  sheet) makes it **brief** — no button, `pointer-events:none`, gone in 2 s, small and
  high so the chart stays readable (`.tipburst.brief` in `studio.html`).
- `_history.mjs` — `tipped` on every index row (`tippedOf`, in `ROW_TOPS` so the heal
  back-fills it from the detail's `money.tips.amount`; `refreshShowMoney` writes it on
  *Re-check*). `biz.js` — `s.tipsApp` in `join` (null unless every night knows),
  `tipsApp` / `tipsAppKnown` in `sum`. `studio-money.js` — `tipsLine()` under the hero
  figure and under the editor's readout; the lede no longer says it.
- Currency — `Biz.CURRENCIES` (twenty), `Biz.currency(code)` sets the symbol `money()`
  writes; `bizPrefs {currency}` (admin.mjs: three upper-case letters or refused, USD
  clears); a chip beside the range → `currencySheet()`; `/report` follows the pref.
- Gig form — *Pay and the business side* is open by default for every gig (it was
  folded unless the date was past); the copy says the pay reaches the Money tab for
  every night of a run until one is logged separately. Nothing new on the server —
  `bizSave {rule}` already did this.
- Hours — `.bzmin` `inputmode="text"` (was `decimal`), so "2h 15m" can be typed.
- Editor — `.bizro{margin-top:20px}` clears the ✕ (grab zone 27px, ✕ to 44px);
  `toTop()` **before** `render()` (render restores the scroll it started with).
- **The zoom-out** — reproduced on the iOS Simulator (iPhone 17 Pro) against the live
  Studio: the page sat at ~0.91; the mock at the same size opened Safari's tab switcher
  instead (no overflow). Measured under Playwright WebKit with the founder's Studio-code
  session read out of the simulator's Safari `localstorage.sqlite3`: `scrollWidth 441`
  on 393, the three elements past the edge the by-show chart's labels "Sep 15 / 16 / 17"
  — twenty-one `flex:1` spans each refusing to shrink below its text. Fix: past eight
  bars only every k-th is named (the last always, the one before it stepping aside),
  `.ml{overflow:hidden}`, spans `min-width:0` so a named label spills over blank
  neighbours and the row clips at its edges; the last label is a flex box justified
  end so it spills left. A fifteen-bar mock chart lays out at 393 after.
- Lists — `FOLDN` in `studio.js` (`fold` / `foldMore`, 5 then +20, *Show fewer* at the
  end, reset on entering the tab) on *All payments* and *MySet's books*; the same on
  *Past shows* in `studio-money.js` (`MORE` is now a count, `FOLD=5`, `STEP=20`).
- Order — `bugCard()` last on both money bodies.
- *Delete show* — `deleteShow()`: `bizSave remove` if logged; `POST /api/history
  {action:'hide', show}` per filed night → `hideShow` flags `hidden:true` on the index
  row and `history.mjs` filters it (nothing deleted — INVARIANT 0s); `eventHide` for a
  calendar night (the Gigs tab's own remove). Confirmed by `ask()` with a lede naming
  what goes. Then `loadGigs(true)`, `stale()`, `toTop()`, re-read, *Deleted*.
- `tools/mock.mjs` — `bizGet` / `bizSave` / `bizPrefs` / `eventHide`, `/api/history`
  (thirty nights, `hide`), `/api/revenue` (48 payments), `ledger` (twelve months) so
  the tab can be looked at with enough rows to fold. `.claude/launch.json` (ignored)
  gained `money-mock` on 8788.

**Verified:** `sh test/run.sh` exit 0 (new assertions in `test/bizmath.mjs`,
`test/biz.mjs`, `test/histname.mjs`; the currency validator was tightened after its own
test caught `"dollars"` → `DOL`). Chrome at 375px against the mock: hero subtotal
*$22.20 from in-app tips*; USD chip → sheet of 20 → THB → `฿493.00` on every figure
and *Figures now in THB*; *Past shows* with 5 rows and *Show 6 more*; *All payments*
5 → 25 → 45 → *Show 3 more*; *If something broke* last; ✕ bottom 109 / readout top 112;
*$9.00 from in-app tips* in the editor for a night that knows; save → `scrollY 0`;
delete → the row gone, `bizSave remove` + `history hide` in the mock log, *Deleted*;
the gig form's `#gBiz` open with the pay box and `inputmode=text` on the hours; the
brief burst asserted (class, no button, `pointer-events:none`, gone at ~2.7 s — the
fade itself was throttled by the hidden browser pane, not the code).

**Not checked:** the burst over a chart on a real phone; the live `eventHide` leg of
*Delete show* (the mock's calendar had no occurrence on the deleted date, so that call
was not exercised — the server action is the Gigs tab's own, covered by its tests);
the deploy preview. The founder's walk: pinch the Money tab on the preview (it should
open the tab switcher, not zoom out), open the editor, save, delete a test show.

**Open:** no *Show hidden* for a hidden night (a one-field write to un-hide); the
currency symbol also fronts the app money on the same tab, which is dollars — the
sheet says so, the hero does not; the merch-through-the-app list still shows 40 at
once; Puzzle's changelog entry for 0082 (below).

## Later the same session — swipe to reveal, hold for more (UX-054, decision 0083)

The founder asked for Apple-style swipe actions and "hard presses" everywhere people
would try them. Built as one markup-free module at the foot of `studio.js`: any list
row that already carries action buttons gets a swipe-left tray and a press-and-hold
sheet, both cloned from the row's own buttons so a tap there is the original tap.
A full swipe only snaps the tray open (never a Delete by slip); red only where the
page already paints red; vertical intent in the first 6 px goes back to scrolling;
callout and selection off on rows and the actions sheet (iOS selected text under the
held finger until then). Verified in Chrome by synthetic touches and on the iOS
Simulator with real touch paths (tray on a song, Hide fired from it, hold → sheet).
Suite exit 0. Not checked: gig rows on a device (the mock has no events); the Venue
Studio is not ported.

## Addendum — hours and minutes (UX-055, decision 0084)

**Asked:** the founder kept logging hours where he meant minutes. Two fields per kind
(hours, minutes), no "hours" after the category, the number pad back, *Set-up /
break-down* not pack-down, and *Edit tonight's numbers* → *Edit last show's numbers*.
Push it live.

**Shipped:** `Biz.parseHms(h, m)` (both blank → null; a non-whole number or past the
cap → NaN); the time row draws two `.bzmin` boxes with `data-u="h"|"m"` and
`inputmode="numeric"`, the unit after each box; blur normalises 90 min → 1 h 30 and
shakes the box on a refusal; `readRows` and the gig form's *Add it* guard read the
pair; the slot's h and m are the *On stage* placeholders with a hint line. The kind
renamed in `public/biz.js` and `netlify/functions/_biz.mjs` (the overview's §2.1 row
regenerated) and in `about.html`'s prose.

**Verified:** suite exit 0; `tools/uicheck.mjs` exit 0 / 244 ✓ after repairing two
expectations 0082 had left stale (the fold at five; *Past shows*); Chrome 375px
against the mock. Not checked: the number pad on a real phone.
