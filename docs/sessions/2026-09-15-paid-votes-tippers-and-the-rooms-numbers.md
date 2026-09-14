# 2026-09-15 — Paid votes count tippers; the room may see the numbers; the setup keeps its shape

**Asked.** Three things, after the founder's test-account walk-through:
1. Setup step 3 (*Prices*): drop the *See the plans* button — "jarring, pulls
   them out of the page and flow"; just Next and an orange note that they can
   change it later in Settings, where the greyed section prompts the upgrade.
2. The song cards' paid-vote number should include every vote from somebody who
   tipped tonight (5 free + 5 bought + 5 from tippers → 15 total for everyone,
   the artist sees *Paid votes: 10*) — so at the end of a night the artist knows
   which requests came from people who actually paid.
3. A Settings option, Bar Star and up, to show the crowd tonight's numbers: one
   switch for votes + voters, a separate one for tips.

**Shipped (decision 0079, INVARIANT 0fz).**
- `studio.js` step 3: on a plan without pricing, **Next** + `.frnote` in orange;
  `frPlans` gone. The lock pill (`lock()`) reads *Bar Star feature · Upgrade*,
  the word in orange (`lock.css` `.lockveil b i`).
- `_lib.mjs`: `paidVoteCounts(fans, tippers)` counts every held vote of a fan in
  `tippers`, the paid rows for everyone else; `tippersTonight(tips, since)`,
  `tipsTonight(tips, since)`. `stage.mjs` passes tonight's tippers; the pill
  reads *Paid votes: N*.
- Plan flag `crowdNumbers` (free off, plus/pro on), `crowdNumbersAllowed`;
  `admin.mjs` `crowdSet {which: votes|tips, on}` → `show.crowd`, 402 on free
  (owner bypass); `shapeLimits` forwards it; `stage` payload carries
  `show.crowd`. Settings: *What the room sees*, two `.tog` rows inside
  `lock('crowdNumbers', …)`, between *Requests from fans* and *Starting by
  itself*.
- `_board.mjs` `crowdNumbers()` → `numbers` on the board (null unless live and
  something is on); `board.mjs` / `show.mjs` read `meta` only when the tips
  switch is on. `vote.html`: a *Tonight* strip under the voting strip;
  `signature()` includes it.
- Bar Star plan card gains *Show the room your numbers*; `tools/overview.mjs`
  labels the flag; process sheets a02 and f04 updated; `tools/mock.mjs` knows
  the flag.

**Verified.** `test/decline.mjs` 40 ✓ (two new sections), `test/limits.mjs`
112 ✓; suite exit 0, 3,237 ✓; `tools/uicheck.mjs` 244 ✓ (three assertions
updated for the wording and the section order). Mock screenshots of all five
surfaces at 390px.

**Left alone.** The filed nights' `paidVotes` (history, business dashboard) still
count bought credits only — the tipper rule is a live reading aid.

**Puzzle.** Changelog entry for 0079; a02 / f04 sheets edited in the repo.
