---
id: 0079
title: a tipper's votes are paid votes on the artist's song cards; the setup's Prices step no longer sends a new artist to the plans; and Bar Star artists may show the room tonight's votes, voters and tips
date: 2026-09-15
status: decided
decided_by: perry
area: product
reverses:
superseded_by:
invariants: [0fz]
commits: []
tests: [test/decline.mjs, test/limits.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/stage.mjs, netlify/functions/_plan.mjs, netlify/functions/admin.mjs, netlify/functions/_board.mjs, netlify/functions/board.mjs, netlify/functions/show.mjs, public/studio.js, public/studio.html, public/lock.css, public/vote.html]
---

## The question

Three things the founder asked for on 2026-09-15, after walking a test account
through the setup.

1. Step 3 of the setup (*Prices*) offered a free-plan artist **See the plans** —
   "jarring", it pulled them out of the page and the flow. He wants Next, an
   orange line saying they can change this later in Settings, and the greyed
   section in Settings to be where the upgrade is offered.
2. The song cards' green pill counted the votes bought through *buy more votes*.
   He wants it to also count **every vote cast by somebody who tipped tonight**:
   5 free + 5 bought + 5 from tippers shows 15 votes total to everyone, and the
   artist sees *Paid votes: 10*. Why: late in a night the queue is longer than the
   time left, and the artist choosing what to play last should know which
   requests came from the people who put money in.
3. A Settings option, Bar Star and up, to show the **crowd** tonight's numbers —
   the artist always sees them on the Live tab — as two switches: votes and
   voters together, and tips on their own.

## The options

| Option | What it does | What it costs | Risk if it goes wrong |
|---|---|---|---|
| **A — chosen (setup)** | The no-pricing branch of step 3 draws **Next** and one orange line (`.frnote`). `frPlans` is gone. The lock pill in Settings reads *Bar Star feature · Upgrade*, the last word in orange — it was already a button to the plans. | Nothing. | None: the plans are one tap away in Settings, where the greyed prices are. |
| B (setup) | Keep the plans button, smaller. | Still a door out of the setup. | |
| **A — chosen (pill)** | `paidVoteCounts(fans, tippers)`: a fan in `tippers` has every held vote counted; anyone else counts rows with a paid portion, as before. `tippersTonight(meta.tips, show.startedAt)` is the set — tips are the account's whole history, so the night boundary is the show's start. The pill reads *Paid votes: N*. | Nothing: `meta` was already read for the Live tab. | A tipper's bought votes counted twice — prevented: a tipper's fan is counted by `held` alone and skipped for the paid rows. |
| C (pill) | A separate "from tippers" number. | Two pills on a card that has room for one; the founder asked for one number. | |
| **A — chosen (room)** | `show.crowd = {votes, tips}`, two `crowdSet` switches, gated by a new plan flag `crowdNumbers` (free off, Bar Star and Rock Star on; the founder's owner bypass as for pricing). `buildBoard` adds `numbers` — `{votes, voters}` and/or `{tips:{total,count}}` — only while live and only for what is on; `board.mjs` and `show.mjs` read `meta` **only when the tips switch is on**, so a room whose artist never touched this costs exactly what it did. The vote page draws one *Tonight* line under the voting strip; `signature()` includes it so a tip landing redraws it. | One blob read per board interval, per room, for artists showing tips. | The board is edge-cached by URL alone (9d6): the numbers are the same bytes for every phone, which is the only kind of thing the board may carry. |
| D (room) | Always show the numbers. | The founder wants it the artist's choice; some rooms would rather not know the tip total. | |

## What was chosen, and why

The setup: a first-run flow should end, not branch. The greyed prices in Settings
already open the plans on a tap; now the pill says so.

The pill: the artist's question at 11:40 is "which of these did the people who
supported me ask for?" — a bought vote and a tipper's free vote are the same
answer to it. One number, one pill, the same green as the plan tag.

The room: the artist's numbers are the artist's to show. Two switches because a
tip total is a different kind of fact from a tally; a plan flag because it is a
feature of a paid room and the ledger of plan flags is where every such gate
lives (`test/limits.mjs` proves each is enforced).

## What this makes harder

A "paid vote" now means two things on one card. The history's `paidVotes`
(`_history.mjs`, the filed nights) still counts bought credits only — the
tipper rule is a live-tab reading aid, not an accounting change, and the
business dashboard is untouched.

## What would reverse it

The founder wanting the tipper's votes shown separately (option C), or the vote
page growing a stats card of its own.

## How it was verified

`test/decline.mjs` 40 ✓ (WHO PUT MONEY IN: a tipper's free vote joins the paid
count, a tip from last week counts for nothing tonight, a tipper who also bought
votes is counted once per vote; WHAT THE ROOM SEES: null by default, the tally
and voters after one switch, tonight's tips after the other, each switch alone,
an unknown switch refused, both off is null again). `test/limits.mjs` 112 ✓
(`crowdNumbers` a real flag, refused 402 on free, forwarded, greyed).
`tools/uicheck.mjs` 244 ✓ (section order, *Paid votes: 2* on the top-voted
button and the queue). Mock screenshots: step 3 on free, Settings locked and
unlocked, the pill, the vote page's *Tonight* line. Suite exit 0.
