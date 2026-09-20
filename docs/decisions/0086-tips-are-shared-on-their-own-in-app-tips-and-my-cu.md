---
id: 0086
title: Tips are shared on their own: In-app tips and My cut of tips on the show sheet, and the profit block reads Total or My cut
date: 2026-09-20
status: accepted
decided_by: founder
area: money
reverses:
superseded_by:
invariants: []
commits: [84f0b6b]
tests: [test/bizmath.mjs]
files: [public/biz.js, public/studio-money.js, public/studio.js, netlify/functions/_biz.mjs]
---

## The question

The founder plays in a three-piece that splits the tips as well as the pay. The
show sheet had one tips box (cash), the in-app tips were only a green line under
the profit, and *My cut* was a single typed figure that had to include the
artist's share of the tips by hand. On the Live tab the sticky "Tonight" figure
was the tips alone, while votes bought — the same money, the same account — sat
elsewhere. The founder asked (2026-09-20) for the Tonight figure to include paid
votes, for *In-app tips* and *My cut of tips* on the show sheet, and for a
*Total / My cut* toggle on the profit block that follows what was typed.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A `tipsCut` field on the record: the artist's share of cash + in-app tips, blank = all of it. `calc` returns `tipsAll`, `tipsMine`, and *My cut* becomes (typed cut, or what's left minus the tips) plus the tips share. The profit block, the row chips and the sheet's readout follow the existing `VIEW.mine` toggle. In-app tips is a read-only box fed from the night's `tipped`. | One more nullable field on the record, the server normaliser, one more `calc` argument (the night's app tips). | The Total / My cut segment in the profit block. | A typed *My cut* now EXCLUDES the tips share — an artist who had typed a whole-night figure reads a little high in My cut view until they clear it. |
| B | Split the tips by the band rows' proportions automatically. | Guesses — a band that splits pay 50/30/20 may split tips evenly. | A proportion rule. | Wrong money in the artist's own book, silently. |
| C — do nothing | Keep one cut box. | The founder keeps doing the tips arithmetic in his head at 11pm. | — | — |

## What was chosen, and why

A, because the founder asked for exactly these boxes and a typed figure is the
one thing the book never gets wrong. Blank keeps every existing record's maths
unchanged: `cut` blank and `tipsCut` blank is the profit, as before. The Live
tab's Tonight figure and the "Tips" tile are `tips.total + paid.total` off the
stage payload — both are the artist's own money (0079, 0082).

## What this makes harder

*My cut* has two boxes now (the pay share, the tips share) instead of one whole
figure; the hint under each says so. The report's per-show *My cut* column moves
for anyone who had typed a cut that already included tips.

## What would reverse it

A second artist asking for the tips share to follow the band rows automatically,
or a band whose tip split differs from an even share often enough that typing a
third every night is the chore the box was meant to remove.

## How it was verified

`node test/bizmath.mjs` — 199 passed, 0 failed, nine new assertions: tipsAll = cash +
in-app; tipsMine typed / blank; profit unchanged; my cut blank and typed with a
tips share; in-app tips unknown count as none; norm keeps tipsCut in cents.
`sh test/run.sh` exit 0. Real Chrome at 375px against `tools/mock.mjs`: the profit
block toggles PROFIT → MY CUT with the segment inside it; the sheet shows Cash tips
/ In-app tips (read-only, green, "Not available" when the night has no figure) /
My cut of tips with the placeholder "20 — all of it"; typing 5 moved the readout
$92 → $97; the Live tab (`?live=1`) reads Tonight $50.00 = $42 tips + $8 votes,
"3 tips · 2 vote buys". NOT checked: `tools/uicheck.mjs` — its puppeteer-core
import under `~/Docs/MySet-Content/node_modules` is gone from this Mac.
