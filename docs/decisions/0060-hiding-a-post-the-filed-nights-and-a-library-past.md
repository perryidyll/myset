---
id: 0060
title: hiding a post, the filed nights and a library past 100 songs are Bar Star; the free room is 50
date: 2026-09-13
status: decided
decided_by: perry
area: plans
reverses:
superseded_by:
invariants: [0dy]
commits: []
tests: [test/limits.mjs, test/clips.mjs, test/community.mjs, test/histname.mjs, test/roomsize.mjs, test/copy.mjs]
files: [netlify/functions/_plan.mjs, netlify/functions/admin.mjs, netlify/functions/history.mjs, public/studio.js, tools/overview.mjs]
---

## The question

The founder rewrote the three plan cards in his own words on 2026-09-13 and, in
four places, asked for the rule behind the words to move with them: the free
room is 50 people, not 200; the free library holds 100 songs, not 2,000; hiding a
fan's post ("hide 1–2 star reviews — protect your page from drunk haters") is a
Bar Star feature and deleting a post for good is gone; and the filed nights on the
Money tab ("data reports — track the numbers of fans and tips from every show")
are a Bar Star feature, "viewing data is a paid feature". Each of those was a
rule with its own history: the room and the library were sized by cost and by
what the read path could serve; hiding was free on every plan by the founder's
own call of 2026-09-05 (INVARIANT 0dy), and deleting was what a paid plan bought.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | `_plan.mjs` gets `library` (100 / 2,000 / 2,000) and `reports` (no / yes / yes); `audience` 50 / 300 / 2,000; `moderate` now gates `postHide`; `postDelete` is no longer an action. `history.mjs` answers a free plan with the running night, the COUNT of filed nights and no rows, 402 on a night's detail. Every add to the library reads `libraryCap(limits)`. | A free artist with more than 100 songs keeps them all (the cap refuses the next add, never a song — INVARIANT 0s) and sees nothing change until they add. A free artist can no longer take a post off their page at all. | `libraryCap`, `reportsAllowed`, the locked reply shape (`locked:'plus'`, `nights`). | A rule enforced only on the page is not a rule — so every one of these is refused by the server too (15k). |
| B | Change the cards only. | The cards would sell rules the code does not keep — the fourth rule of AGENTS.md, in reverse. | none | An artist reads "up to 50" and the room takes 200 anyway; "hide 1–2 star reviews" on Bar Star while free hides for nothing. |
| C | Gate hiding on the post's stars (1–2 star reviews paid, everything else free). | Cleverer than the card; a hate post with no stars would be hideable on free and a two-star one not, which nobody could explain at a bar. | a rule about stars | Confusion, and a lie by omission on the card. |
| D — do nothing | | The founder's own words would not be true. | | |

## What was chosen, and why

A, because the founder said so, in four places, with "(please adjust this rule in
the code)" against each. The one concern was raised and is recorded here: hiding
was free because every artist should be able to take something offensive off
their page the second they see it (0dy's old text). The founder's product answer
is that the page is the artist's and protecting it is worth paying for; the
compromise kept is that nothing is ever erased — `postDelete` is gone, so a hidden
post can always come back, and a fan's own words stay theirs.

Ten shows are still counted per calendar month in the code; the card says "10
shows for free". The founder's line was read as a shorter way of saying the same
thing, and the card errs generous rather than mean if that was wrong — flagged in
the session note as the one reading to confirm.

The band sign-in lines came off every card at the founder's ask; the seats
themselves (1 / 1 / 5) are untouched in the code, so a Rock Star band still signs
in as before — only the card stopped mentioning it.

## What this makes harder

A free artist cannot moderate their community page. The `moderate` flag changed
meaning (delete → hide) while keeping its name, so a reader of an old note will be
one step behind; INVARIANT 0dy says which rule is current. `history.mjs` has two
reply shapes for one GET, and `drawFirstRun` in the Studio reads `nights` when the
rows are withheld — a future reader of `HIST.shows.length` on a free plan sees an
empty list, not a locked one.

## What would reverse it

An artist with real abuse on a free page and no way to act on it; or the founder
watching a first free artist hit 100 songs. The room and the library numbers are
plan copy as much as rules and will move again — `tools/overview.mjs` reads them
from `_plan.mjs`, so a change is one line plus the card.

## How it was verified

- `sh test/run.sh` — exit 0, 2,302 ✓, 0 ✗ across 44 files. `test/limits.mjs`: an
  import of 101 songs on the free plan keeps 100 with the Hobbyist wording, the
  101st by hand is 402, Bar Star takes it. `test/clips.mjs`: free hide 402, delete
  400 on any plan, Bar Star hide 200. `test/community.mjs`: the founder hides
  (owner bypass) and a hidden photo post's photos are gone. `test/histname.mjs`:
  a free plan's night detail is 402 and the list comes back `locked:'plus'` with
  `nights:1` and no rows; on Bar Star both read. `test/roomsize.mjs`: over the
  50 cap the room is `over` and nobody is refused; the throttle is asserted at the
  dial's own rung, since the cap and the rung no longer coincide.
- `node tools/uicheck.mjs` 113 ✓; `node tools/sheetcheck.mjs` 12 ✓.
- Headless Chrome, Studio on a synthetic free stage: the plan sheet in the
  founder's words, the Money tab's locked "Data reports" card with the count.
- Not checked: the Studio's community moderation row painted from a real signed-in
  stage; a real iPhone.
