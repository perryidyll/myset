---
id: 0198
title: Deleting a gig never re-prices a night that was already played
date: 2026-10-09
status: decided
decided_by: perry-confirmed
area: money
reverses:
superseded_by:
invariants: ['0ja']
commits: ['694f56c']
tests: ['test/biz.mjs']
files: ['netlify/functions/_biz.mjs', 'netlify/functions/admin.mjs', 'test/biz.mjs']
---

## The question

The artist's book (decision `0065`) holds two maps. `gigs[<eventId>@<date>]` is one night's own numbers, typed for that night. `rules[eventId]` is what a run of gigs is worth by default — typed once on the gig form, and read by **every night of the run that has no record of its own, past and future**. That second half is the whole point of a rule: an artist with a weekly residency types the pay, the band splits and the four kinds of time once, and every Thursday carries them.

`pruneRules` then dropped a rule the moment its gig left the calendar, on the stated principle that "a record is the artist's, a rule was the gig's". That principle is right about the future and wrong about the past. A night already played, filed and counted had no record of its own — it never needed one, because the rule was pricing it. Deleting the gig deleted the only thing that had ever said what that night was worth.

The founder found it. On 2026-10-07 he deleted three repeating gigs that had stopped running — one Anantara Rasananda residency and two weekly Crystal Day slots. Five nights already in the Money tab's history log went to **$0 with no hours**: `gimj34ujp@2026-09-15`, `@2026-09-29`, `@2026-10-06`, and `g9zst3nmn@2026-09-30`, `@2026-10-07`. Nothing warned him, nothing logged it, and the Crystal Day rule was recoverable only because a backup happened to sit five days before the delete. The Anantara rule had been typed after the last snapshot and was gone for good; its figures were rebuilt from the artist's own three preceding Anantara records, on his word (2026-10-09).

Two things made it worse than a single lost rule. The same sweep runs again on every rule save ("orphans go whenever a rule is touched"), so a rule that survived one delete could be swept weeks later by an unrelated edit — which is what the 2026-09-25 and 2026-10-02 snapshots show happening. And the loss is silent: a night at $0 with no hours looks exactly like a night the artist never got round to filling in.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Before a rule is pruned, copy it onto every night already FILED under that gig that has no record of its own. Then drop the rule. | One history-index read on the two paths that prune. The book grows by one record per played night of a deleted run. | None — it writes the record the editor would have written. | A long-dead run with many filed nights pushes the book towards its 400 KB cap; the cap then refuses the whole write, which leaves the rule standing and loses nothing. |
| B | Keep the rule for ever once any night has been filed under it. | Nothing. | None. | Rules accumulate for gigs that no longer exist, `MAX_RULES` fills with ghosts, and the gig form has no way to show or edit a rule whose gig is gone. |
| C | Warn on delete: "three nights read their pay from this gig — delete anyway?" | A dialog, and a count the server has to compute anyway. | A confirm step on a common action. | The artist clicks through it and loses the figures with a receipt instead of without one. The data is still gone. |
| D — do nothing | Leave it. Artists re-type what they lose. | Nothing. | None. | Silent, unbounded loss of the artist's own bookkeeping, discovered by accident or never. It is money and hours, which is what the Money tab exists for. |

## What was chosen, and why

**A.** The rule was never a plan for the night in question — it was that night's price, and the night happened. Writing it onto the night makes true on disk what the Money tab had been showing all along, which is why no figure on screen changes at the moment of the delete. It also makes the record permanent: a per-night record is the artist's, and nothing prunes it.

B was rejected because it leaves ghost rules nothing can edit. C was rejected because a warning does not preserve anything — the founder would have clicked through it, having correctly concluded that deleting a gig that stopped running is a tidy-up, not a decision about September's income. D was rejected on the first rule in `AGENTS.md`: this is the artist's money and their hours, and losing them quietly is the worst available failure.

The safe direction of failure is written into the signature. `pruneRules` takes the filed keys as a third argument and prunes **nothing** when it is not given them, so a future caller that cannot see the history index leaves an orphan rule standing rather than deleting a figure. An orphan rule is untidy; a repriced night is wrong.

## What this makes harder

The book grows faster for artists who delete long runs — one record per played night instead of one rule. The 400 KB cap is years away at a few hundred bytes a night, and the year-shard path (`biz_<aid>_<yyyy>`) is already designed for when it is not, but the delete path is now one of the things that can push a book towards it. If the cap refuses the write the delete still succeeds and the rule simply stays, so the failure is visible as an orphan rule rather than as missing money.

Both pruning paths now read the history index, so a rule save costs one more blob read than it did. It is not a room-facing path and the read is in parallel with the calendar read it already did.

## What would reverse it

A book that hits the cap because of materialised records rather than real ones — then the year shard ships and this stays as it is. Or a decision that a rule should outlive its gig and be editable from somewhere other than the gig form, which would make option B coherent and this unnecessary.

## What was done to the live data

The five nights above were repaired in production on 2026-10-09 through the `bizSave` action, before the fix shipped. The three Crystal Day nights were restored byte-for-byte from the rule in the 2026-10-02 backup (`pay` blank; 100 min on stage, 20 break, 30 travel, 10 set-up). The two Anantara nights were rebuilt from the artist's own identical records for 9, 16 and 23 September — $180 pay, two band members at $60, own cut $60, 120/40/50/10 minutes — on his explicit confirmation, because the rule itself existed in no snapshot. The book went from 69 records to 74. A second pass the same day put **$60** on those three Crystal Day nights, on the artist's explicit word: the restored rule carried no pay figure, so the nights read correctly but emptily, while all sixteen of his other Crystal Day records carry $60. That figure is his decision, not a restoration — nothing in any snapshot says what those three nights paid.

## How it was verified

`test/biz.mjs` grew a block, "A DELETED GIG LEAVES ITS PLAYED NIGHTS PRICED": a weekly gig priced only by its rule, one night played and filed under it, the gig deleted — then the rule is gone and the night still carries the pay, the band split, the hours and the travel; nothing was invented for a night of the run that was never played; and a second gig's night, written by hand at a different figure, is not overwritten by its dying rule. Fifteen assertions, every one of which fails on the old `pruneRules` body — reverted, they report no pay, no splits and no time. `node --import ./test/register.mjs test/biz.mjs` is 160 ✓ / 0 ✗ on the merged tree, and `sh test/run.sh` exits 0 (6,397 assertions, 0 failures).

Live as `694f56c` on 2026-10-09: the Netlify production deploy for that commit reports `ready`, and all five repaired nights read back through the live site afterwards — the three Crystal Day nights at $60 and 2h 40m, the two Anantara nights at $180, 3h 40m, two splits and a $60 cut.

**Not checked:** the delete path itself was never exercised against production, and must not be — doing so would need a real gig deleted from the live calendar. The guarantee rests on the suite and on the repair being verified by read-back.
