# 2026-09-13 — Sherlock: the *Peaceful Easy Feeling* vote at Sand & Tan

Read-only investigation from the datastore copy `~/Docs/Project Handoffs/myset-backups/20260913T150747Z` (taken with `tools/backup.py` after the show; nothing on the site was touched). Times are UTC; Koh Phangan is UTC+7.

## What the founder reported

*Peaceful Easy Feeling* was on the screen as the top voted song. After finishing the song he was playing he looked back to select it: the top voted song was *Ain't No Sunshine* and *Peaceful Easy Feeling* had no votes. He also recalls songs disappearing before.

## What the record says

Show `2026-09-13-1123-yvaz`, started 11:23:53, ended 14:12:00. Two phones voted all night (`f1_…/fox4t52yxarlp`, `f3_…/frnrl0xmusifv`), five votes in total, one voter at a time. The show record's `log` (written by `logPlay` on every *play*) and the archived `hist_…` agree:

| UTC | play | that song's votes | the round at that moment |
|---|---|---|---|
| 11:56:28 | All Of Me | 2 | All Of Me 2, 2009 1 |
| 12:19:09 | 2009 | 1 | 2009 1 |
| 12:53:09 and 12:59:30 | *(phone fox4t casts one vote each for Ain't No Sunshine and Peaceful Easy Feeling — order unknown, the timestamps are consumed with the votes)* | | |
| 13:50:47 | Have You Ever Seen The Rain | 0 | Ain't No Sunshine 1, Peaceful Easy Feeling 1 |
| **13:53:30** | **Peaceful Easy Feeling** | **1** | Ain't No Sunshine 1, Peaceful Easy Feeling 1 |
| 13:53:57 | Ain't No Sunshine | 1 | Ain't No Sunshine 1 |

So *Peaceful Easy Feeling* held its one vote right up to 13:53:30, when a **play** of it landed — 2 m 43 s after *Rain* started, which is about a song. The only thing that writes a *play* is the Studio (`act('play',{song})` from an *Up next* row's ▶ Start, or `act('playTop')`); nothing scheduled or automatic does. Starting a song spends its votes (`consumePlayedVotes`) and, being *now playing*, it leaves the *Up next* list — which is then headed by *Ain't No Sunshine, 1 vote*, and the *Start top voted* button re-labels itself to that song. 27 seconds later *Ain't No Sunshine* was started, which filed *Peaceful Easy Feeling* as played.

## Reading

No vote was lost and nothing changed by itself. The most likely sequence: at 13:53:30 the tap that was meant to *select* Peaceful Easy Feeling **started** it; the page re-rendered with Peaceful gone from *Up next* (it was now the *Now playing* card, above the fold, without a vote count) and *Ain't No Sunshine* at #1 — which reads, from the queue, exactly as "the top song changed and Peaceful has no votes". The second tap, on *Ain't No Sunshine*, then played that one. The same mechanism explains "songs disappearing before": a started song leaves *Up next* the moment it starts, and only comes back if it collects replay votes.

Not knowable from the record: which of the two 1-vote songs the Studio showed on top at 13:53 (the tie-break is the earlier first vote, and those timestamps were consumed), and which of the two buttons was tapped.

## What would stop it happening again (not built — the founder's call)

1. After a *play*, a toast on stage: "Started *Peaceful Easy Feeling* — its 1 vote is spent", and scroll to the *Now playing* card.
2. Keep the just-started song at the top of *Up next* as a greyed "Now playing" row for the length of one song, so the queue never looks like something vanished.
3. A confirm on ▶ Start when the song has votes and something is already playing ("Start *X* now? *Y* will be filed as played.").
