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
