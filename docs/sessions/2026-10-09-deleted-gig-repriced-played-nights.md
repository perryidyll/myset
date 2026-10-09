# 2026-10-09 — a deleted gig re-priced five nights that had already been played

## What was asked

The founder, first thing: "big issue to fix asap: i deleted 3 shows on wednesday that are no longer repeating – anantara and the 2 weekly crystal day shows – but now in the money tab the last 2 anantara shows in the history log are showing 0$ and the hours typically logged with them via what i input in the saved/repeating gig info in the gigs tab is missing."

## What was actually wrong

The artist's book (decision `0065`) keeps two maps. `gigs[<eventId>@<date>]` is one night's own numbers. `rules[eventId]` is what a run of gigs is worth by default — typed once on the gig form and read by every night of the run that has no record of its own, **past nights included**. `public/biz.js` resolves it in one line: `s.gig = s.biz || s.rule || null`, with `source` reading `'gig'`, `'rule'` or `'none'`.

`pruneRules` dropped a rule the moment its gig left the calendar, on the principle in the code's own comment: "Nights already logged under the gig keep their own records: a record is the artist's, a rule was the gig's." That is right about the future and wrong about the past. A night already played and filed under the gig, with no record of its own, had never needed one — the rule was pricing it. Deleting the gig deleted the only thing that had ever said what that night was worth, and the row fell to `source: 'none'`: no pay, no splits, no hours.

Five nights, all confirmed against the live store:

| Night | Key | What it lost |
| --- | --- | --- |
| Crystal Day (solo), 15 Sep | `gimj34ujp@2026-09-15` | 160 min (100 stage / 20 break / 30 travel / 10 set-up); pay was blank |
| Crystal Day (solo), 29 Sep | `gimj34ujp@2026-09-29` | the same |
| Crystal Day (solo), 6 Oct | `gimj34ujp@2026-10-06` | the same |
| Anantara Rasananda, 30 Sep | `g9zst3nmn@2026-09-30` | pay and hours both |
| Anantara Rasananda, 7 Oct | `g9zst3nmn@2026-10-07` | pay and hours both |

Three gigs were deleted (`gimj34ujp`, `g3ei0k6l3`, both Crystal Day weeklies, and `g9zst3nmn`, the Anantara weekly) — the calendar diff between the 2026-10-02 and 2026-10-09 backups says exactly that. `g3ei0k6l3`'s one filed night (17 Sep) had a record of its own and was untouched, which is why only five rows broke rather than nine.

Two things made it worse than one lost rule:

- **The same sweep runs on every rule save.** "Orphans go whenever a rule is touched" meant a rule that survived one delete could be swept weeks later by an unrelated edit. The snapshots show it happening: on 2026-09-25 only one rule was left standing; by 2026-10-02 four were back, re-typed by hand on 26 Sep inside 75 seconds.
- **It is silent.** A night at $0 with no hours is indistinguishable from a night the artist never got round to filling in. Nothing warned, nothing logged.

## What was repaired, and how

Done on production before the fix shipped, through the `bizSave` action with the recovery key (read from the login keychain, never printed):

- **Three Crystal Day nights** — written byte-for-byte from `rules['gimj34ujp']` as it stood in the 2026-10-02 backup and the 2026-10-02 R2 mirror, which agree: `pay` null, no band, no costs, `min` 100/20/30/10.
- **Two Anantara nights** — `rules['g9zst3nmn']` is in **no** snapshot. It was typed after the last copy (2026-10-02 16:27 UTC) and before the delete on the 7th, so it is gone for good. The founder's own Anantara per-night records for 9, 16 and 23 September are identical on every field that matters — $180 pay, Ball $60 and Art $60, 120/40/50/10 minutes — so those were offered to him as the reconstruction and written **on his explicit confirmation**, with his own cut at $60 (the arithmetic remainder, and what his 23 Sep record says).

Read back and verified: the book went from 69 records to 74, and all five keys now resolve. If his real Anantara figures differed from September's, those two nights are his to re-type — there is no source that can tell us.

## The fix

`pruneRules(doc, events, filed)` takes a third argument: every `<eventId>@<date>` key the history index carries. Before deleting a rule it copies that rule onto each of those nights that has no record of its own, so the night keeps its figures as its **own** record — which nothing prunes — and only then drops the rule. A record the artist typed is never overwritten. A night never played is never invented.

The safe direction of failure is in the signature: **no `filed` in hand means nothing is pruned.** A future caller that cannot see the history index leaves an orphan rule standing rather than deleting a figure. An orphan rule is untidy; a re-priced night is wrong.

Both call sites now read the index — `eventDelete`, and the orphan sweep inside `bizSave` when a rule is touched. Neither is a room-facing path, and in both cases the read runs in parallel with the calendar read that was already happening.

If materialising records pushes the book past its 400 KB cap, `mutateBiz` refuses the whole write, which leaves the rule standing and loses nothing — the failure shows up as an orphan rule, not as missing money.

Decision `0198`, INVARIANT `0ja`, ledger `MON-002`.

## What was verified

- `test/biz.mjs` — 175 ✓ / 0 ✗, with 15 new assertions under "A DELETED GIG LEAVES ITS PLAYED NIGHTS PRICED": a rule priced only on the gig form, a night played and filed under it, the gig deleted, and the pay, the band split and both kinds of time still on the night; nothing written for a night never played; and a night the artist had written by hand keeps its own figure rather than the rule's.
- **The test fails on the old code.** `pruneRules` reverted to its previous body: "but the night that was played keeps the pay" fails with no value at all, "and the band split" with `[]`, and the hours assertion finds no `min` object. That is the founder's bug, reproduced.
- `sh test/run.sh` — exit 0, whole suite.
- The five repaired keys read back off production through `bizGet`.

## Not done

- **Not merged.** The branch was cut at `7a27f36` while another session was merging fifteen audit PRs, so it needs a rebase on `main` before it goes in.
- The Puzzle sheet for the business dashboard (section 42066) has its step b04 updated here in `docs/processes/money/08-the-business-dashboard.md`; the Puzzle side and its changelog entry are owed in the same session.
- Nothing was checked on a phone — the fix is server-side and changes no screen at the moment of a delete, which is the point of it.
