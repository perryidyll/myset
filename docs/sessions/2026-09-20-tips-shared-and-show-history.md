# 2026-09-20 — tips shared on their own; the founder's show history

**Asked:** (1) the green Tonight figure on the Live tab should include votes bought;
(2) *In-app tips* (read-only) under *Cash tips* on the show sheet, and *My cut of tips*
under that; (3) a *Total / My cut* toggle on the profit block that follows the new
field; (4) housekeeping on the founder's own account — every show on his Google
calendar from 9 April (Crystal Day) into the book, THB → USD, three-way splits named
Ball and Art, and the recent in-app tips split three ways too.

**Shipped (decision 0086, UX-056):** `tipsCut` on the record; `Biz.calc` takes the
night's app tips and returns `tipsAll` / `tipsMine`; *My cut* = the pay share plus
the tips share; the sheet's three tips boxes; the hero's segment; `Money.tonight`
untouched; the Live tab's `earned()` = `tips.total + paid.total`. `tools/mock.mjs`
answers `paid` on `?live=1`.

**Verified:** `node test/bizmath.mjs` 199 ✓ · `sh test/run.sh` exit 0 · real Chrome
375px against the mock — see the decision record. `tools/uicheck.mjs` could not run:
its puppeteer-core import under `~/Docs/MySet-Content/node_modules` no longer exists.

**The data pass** (after the merge, against the live account through the founder's
signed-in Chrome — the only session that can write his book): see the addendum.

**Open:** the 13 Sep Sand & Tan night is keyed to Seaflower 11 Sep (`gh71d4pfq@2026-09-11`)
and `placeShows` never overwrites a key, so its $10 of in-app tips sit under the
wrong show; a 15 Sep Crystal Day night is filed with no calendar event behind it.

## Addendum — the data pass (live as `84f0b6b`, PR #80)

Run from the founder's signed-in Chrome against `/api/admin` (his `x-admin-code`),
after the merge was verified live by content (`tipsCut` in `/biz.js`):

- The six weekly runs now start at their first night: Crystal Day Thu `g3ei0k6l3`
  2026-04-09, Crystal Day Tue `gimj34ujp` 2026-08-18, Seaflower `gh71d4pfq`
  2026-05-08, Sand & Tan `guwi123an` 2026-05-10, Anantara `g9zst3nmn` 2026-08-05,
  Ugly Duckling `gx78yyhxp` 2026-08-10. Two one-offs added: Crystal Day Mon
  2026-06-08 (`g4jmmlaua`), Anantara Sat 2026-08-22 (`gzkwstah4`). Eighteen
  weeks the calendar did not have are skipped (Crystal Day Thu ×12, Seaflower ×4,
  Sand & Tan ×2). Plantasia and the Muse open mics were never on the list.
- 64 records saved, `saved 64 of 64`, no refusals. THB → USD at 33.356 (open.er-api,
  2026-09-20): 2000 THB = $59.96, 4500 = $134.91, 6000 = $179.88; a third = $44.97 /
  $59.96, named Ball and Art. Crystal Day solo, everything else three ways. The seven
  records the founder had typed kept their times, cash tips, notes; pay and splits
  were rewritten to the same convention (his Sep 20 *My cut* $60 became blank =
  what's left), and *My cut of tips* on those is a third of cash + in-app tips
  (Sep 20: $50 → $16.67; Sep 18 $17 → $5.67; Sep 16 $10 → $3.33; Sep 14 $22 →
  $7.33; Sep 13 $10 → $3.33; Sep 11 $17 → $5.67). Times left blank on the
  back-filled nights — nothing to read them from.
- Live after: PROFIT $3,673.65 / MY CUT $3,589.65, 76 shows · 64 logged, `occ` 66.

**Flags for the founder:** the 12 extra "shows" are unkeyed test nights (Aug 30 ×2,
Sep 4, 6, 7 ×3, 9 ×3, 10 ×3, 11 ×2 — *Delete show* hides each); two calendar slots
have no record (Crystal Day Tue Sep 15 has a filed night but no Google event; one
more past slot reads *Log it*); votes bought stay in *My cut* whole — only tips are
shared; the Sep 13 Sand & Tan night's $10 of in-app tips sit under Seaflower Sep 11.
