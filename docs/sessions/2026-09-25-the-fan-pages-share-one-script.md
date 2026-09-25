# 2026-09-25 — The fan pages share one script (decision 0087)

**Asked:** after a read-only study of the single-page-app question (the report is a
claude.ai artifact, "MySet Single-Page Study"; its finding: MySet is already half an
SPA, fans rarely switch pages, the real win is one shared brain instead of five copies
— achievable without a rewrite), the founder asked for that step now: "please do this
step now, along with the shared modules". Then, mid-session: an app-wide load-time
analysis and pass afterwards (separate session note).

**What was found first.** The shared checkout was 67 commits behind origin/main (the
study had measured a stale tree), so this work started in a fresh worktree from
origin/main `a2f1e27`. A scan of the nine fan pages at that commit: 58 names declared
on two pages or more, 17 byte-identical, 41 drifted. The bottom sheet had four
variants (the shop's with inert/focus/Back, the artist page's with the frozen-page
counter, the vote page's with neither, the venue's without a grab zone); `toast` at
3.2/3.4/3.6 s; `firstName()` on three pages falling back to "the"; `esc` on the vote
page not null-safe; the About page's strip loop a hand-kept fork of the artist
page's ("kept in step by hand").

**What shipped — **live as `68efdb4`** (PR #85, merged 2026-09-25 03:51 UTC; live on production ~30 s later), one PR with 0088:**

- `public/fan.js` (21 KB raw, 8.8 KB gzipped): `$`, `API`, `esc`, `fanId`, `toast`,
  `shareLink`, the date words (`MON`/`MONFULL`/`DOW`, `dayNum`, `monShort`,
  `dayMonth`, `dowName`, `todayISO`, `whenWord`, `fmtTime`, `ago`, `money`, `liveIn`,
  `firstNameOf`), `APPLE`/`dirHref`, the rsvp memory (`rsvpMap`/`rsvpRemember` with
  the front door's in-memory fallback), the intro (`cssReady`, `hideIntro`, `lift`),
  the sheet (`freezePage`/`thawPage`, `openSheet`/`closeSheet`/`attachDrag`, Escape,
  `customAmt`), the strips (`drift`/`undrift`/`ghost`), `menuDoors`.
- Nine pages load it (`<script src="/fan.js?v=…">` right before their own script) and
  lost their copies: 716 lines deleted, 73 added. Per page: index (the A2HS sheet is
  now `openSheet()` and freezes the page — `body.sheeting` CSS added), artist (`MONL`
  → `MONFULL`; `nextLabel` on `liveIn`; the Escape handler keeps `lbClose`/`winClose`
  only), artists (`$`/`esc`), vote (`nextLabel`, `share`, `customAmt` moved), community
  (`sheetopen`/`sheetclose` park the composer; `openTip` passes `customAmt` its five
  arguments), venue (grab zone + ✕ CSS added; `fmtTime`/`dirHref` null-safe versions
  were already its own), about (`drift(el.id, 1)`; `esc` now escapes the apostrophe
  too), shop (`data-handle=".grabzone,h3" data-scroller=".sizes,.more,.gal"` on
  `#sheet`; `sheetclose` → `undrift('more'); CUR=null`), diary (`menuDoors('diary')`).
- `tools/stamp.mjs`: nine `PAIRS` rows for `fan.js`, `FANPAGES` exported;
  `netlify.toml`: `/fan.js` immutable for a year (after `/:slug`); `test/_src.mjs`:
  `src()` appends `fan.js` for a page that loads it; `test/structure.mjs`: no fan page
  redeclares a `fan.js` name, every fan page loads it once before its own script, every
  page with a sheet is a fan page or a Studio; `test/copy.mjs`: the shop's scroller rule
  now reads the `data-scroller` attribute.
- `tools/_puppeteer.mjs`: the three browser-driven checkers (`uicheck`, `sheetcheck`,
  `clipcheck`) had imported puppeteer-core from a hand-typed path into a repo that has
  since moved, and had been dead since 2026-09-20; they now resolve it by content
  (`MYSET_PUPPETEER`, then the known homes) and `clipcheck` serves the `public/` beside
  itself like the other two.
- Docs: decision `0087`, INVARIANT `0gc`, a row in AGENTS.md's table, a row in the
  master overview's file table.

**Verified (run, output quoted in decision 0087):** `sh test/run.sh` 52 files /
3,478 assertions / 0 failed (3,502 / 0 on the final tree, after the review's fixes and 0088); `node tools/sheetcheck.mjs` vote 12/12 + shop 27/27 in
real Chrome with real touch; `node tools/uicheck.mjs` 242 ✓ / 2 ✗ on origin/main's
pages and the same on these (the two are the stale profit figures the 2026-09-20 push
log names); `node tools/clipcheck.mjs` the same one ✗ on both trees; `tools/mock.mjs`
in the app's browser at 375 px on every fan page — no console errors from the pages
(the mock 404s its own favicon), every sheet froze and thawed the page, gave focus
back, the shop's Back closed its sheet, the composer was parked, the tip sheet's
"· $7" read-out worked on both pages that have it.

**Not checked:** a deploy preview; `/fan.js` answering `immutable` from Netlify; a
first open on a phone in a bar. **Not done:** the Studios keep their own `$`/`esc`/
`toast`/sheet (0053 keeps them apart from app.css and this file); `docs/processes/`
has no engineering-os sheet in origin/main to update — the Puzzle changelog entry
was made directly.

**Known pre-existing failures, not from this change:** `tools/uicheck.mjs` lines
564/614 (profit figures) and `tools/clipcheck.mjs` "the refusal names the size AND
what to do" — both fail identically on origin/main.
