# 2026-09-15 — the first gig is the onboarding, and a night's money is everything tagged to it

**Asked.** The founder brought a friend's one-line onboarding model — get them to a
first successful gig fast; the aha moment is when the money hits their bank — and
asked for the strategies that serve it to be built, all but a push before the gig
("the WORST time"). In the same message: two $1 test tips sent the day after the
14 Sep night were in the Money tab's *Taken* tile ($22) but not in profit ($30).

**Shipped** (decision `0081`, INVARIANT 0ga, ledger MON-001 / UX-051):

- **The money rule.** A payment tagged to a night belongs to that night whenever it
  arrives, until the next night starts. `pay.mjs` already tagged tips with the
  ended show's id; the tile priced start→now and saw them, the filed row was
  priced start→end at the archive and never learned, and *Re-check* used that
  closed window. Now `moneyWindowEnd` is the shared window, `refreshShowMoney`
  writes one figure to the detail and the row, and `history.mjs` heals the row
  from the read that draws the tile. `test/latetips.mjs` (19 ✓; 6 fail on the
  old code).
- **First run: four steps**, prices gone, the last step is the sign. *Print my sign*
  opens `/sign.html` (new page: name, *Pick the next song*, the code, the address,
  print CSS; `?print=1` opens the sheet) and stamps `meta.signAt`. *Send it to my
  phone* is `navigator.share` → clipboard. `frFlag` step 5 lands on 4.
- **Your first gig**, pinned on the Live tab in place of Today until a night is on
  file: *Add your next show* (the calendar) and *Print your sign* (`D.signAt`).
  `meta.nights` rides on the stage payload, stamped by `endShow`; an account older
  than the stamp asks history once on the Live tab's first paint.
- **Example rows** on an empty first board — the artist's own songs, marked
  Example, dismissable, never on the board.
- **The tip burst** — `tipWatch` compares `tips.count` on every poll and write reply
  while live; `tipBurst` is the amount, a line, the brand colours falling, a chime
  and a buzz. Never on the first paint.
- **Tonight's money sticky** under the header during a show, every plan.
- **The morning-after letter** — `_lifecycle.mjs` queues one on the first filed
  night; `_auto.mjs` `sweepNotes` (called by `autocron`) sends it ten hours later
  to the owner's address with the night's figures and one next step; `noted`
  keeps it to once, ever. `test/firstgig.mjs` (34 ✓).

**Not built.** The push before the gig (#5) — the founder said no. SMS — no
provider, no dependency; the share sheet does the job.

**Verified.** `sh test/run.sh` exit 0 (48 suites; new `latetips.mjs`, `firstgig.mjs`);
`tools/uicheck.mjs` 244 ✓; mock screenshots at 390 px of the card, the two first-run
steps, the live tab with example rows, the tip burst, the sign, and the sign as a
Letter PDF. `tools/mock.mjs` learned `?first=1` and serves a real QR SVG.

**Open.** The tonight strip's sticky offset is the header's measured 76 px; a header
that grows a line will need it moved. The morning-after letter has no opt-out yet.
