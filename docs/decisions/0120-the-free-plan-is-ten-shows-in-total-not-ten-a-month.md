---
id: 0120
title: The free plan is ten shows in total, not ten a month
date: 2026-09-29
status: decided
decided_by: perry
area: plans
reverses: 0037
superseded_by:
invariants: [9d9]
commits: []
tests: [test/limits.mjs, test/tenancy.mjs, test/autoshow.mjs]
files: [netlify/functions/_lifecycle.mjs, netlify/functions/_lib.mjs, netlify/functions/_plan.mjs, netlify/functions/stage.mjs, public/studio.js, public/venue-studio.js, public/about.html]
---

## The question

Writing the terms of use (decision 0119) turned up places where pages, docs and code disagreed. One of them was the free plan's show count. The Hobbyist plan card said "10 shows for free". The code allowed ten a calendar month, resetting on the 1st (decision 0037). `_plan.mjs`'s header said "unlimited shows… six nights a week forever", and the overview said four a month.

The founder's direction was "please make the code match the current wording on the plans". Asked which rule "10 shows for free" means, the founder answered: "10 in total, ever, but not counting shows they manually discard – maybe next to the 'hobbyist' green badge at the top right of the studio it can have 'x/10' counting how many free shows they've used".

In the same pass:
- **Auto start and end.** The founder said "let all shows auto start/stop but don't present that feature on the hobbyist plan". It is already only on the Bar Star card, so the code is unchanged.
- **The venue tick.** The Free venue card promised "Verification", but the code checks Pro venues only. The founder chose Pro only and to fix the Free card.

## The options

| Option | What it does | Risk if it goes wrong |
|---|---|---|
| A | Keep ten a month; add "a month" to the card | None; the card changes, not the code |
| **B — chosen** | Ten in total, ever. A discarded night gives its count back. A paid night never counts. The Studio shows x/10 | A free artist who has played ten shows cannot start an eleventh without paying |

## What was chosen, and why

B, on the founder's word.

**How shows are counted**
- `show.gigCount` counts shows started on the free plan, and never resets. `countGig` runs inside `startShow`'s CAS, after the fresh showId is set, and only when the artist has a cap. A paid plan and the founder have none.
- `show.freeNight` records how many counts the current showId used. A resume counts again, as it always did, so one night can't be stretched over many.
- **Discard + end show** calls `uncountGig` inside the end's own CAS, which gives all of that back. A second discard is a no-op.
- The refusal reads: "That's your 10 free shows. Upgrade to Bar Star to keep playing — a show you discard doesn't count." No reset is promised.

**Migration.** This is one-way, in `normShow`. A record still stamped with `gigMonth` keeps its count, because those shows were really played. The exception is a record whose last night was on a paid plan: that month's count was paid shows, so it becomes 0. `gigMonth` and `gigMonthOf` are removed everywhere, including the Studio's `monthKey`, the stage payload and the mock.

**What the artist sees**
- **The header:** a free artist sees one green **Hobbyist · x/10 ↗** tag, which opens the plans; it becomes the pink **Upgrade ↗** once all ten are used. One chip, not two: two pushed the name off a 375 px phone. It is never shown to a paid plan or the founder.
- **Settings:** the plan line reads "Hobbyist — x of your 10 free shows used".
- **Warnings:** at two left, the Live tab says so, and adds that a discarded show doesn't count.
- **The past-due banner:** it says "free shows in total".
- **About:** its FAQ no longer says everything the room sees "stays free".
- **The founder's note in Settings:** the note ("Why there's a limit at all") said "limited to 4/month on the free plan… play for free — forever". Its sentence now says the free plan comes with 10 shows. The rest of the note is unchanged.

**The other contradictions**
These are wording only; the code already matched the cards:
- the Studio's request switch now mentions the money offer as a card hold;
- About's payout line says weekly on Hobbyist and daily on the paid plans;
- the overview no longer lists hiding a post as free on every plan;
- the stale promo comment in `_plan.mjs` is fixed;
- `VERIFYING-A-VENUE.md` says the automatic tick needs Pro and both checks, or the founder's switch;
- the Free venue card no longer promises verification, and the Pro card's tick line says what it takes;
- the merch process sheet has stock counts, and says "Shipping".

## What this makes harder

- **A night the calendar started and nobody voted on is given back.** The founder's answer to "auto-start spends free shows" was "don't count auto-started shows with no votes". `countGig` marks a night the schedule began (`freeNight.auto`); `quietAutoNight` checks every round's votes plus what still stands on the board, and a quiet one is given back when it ends, or when a new show replaces it while it is still running. A quiet night the ARTIST started still counts: they pressed the button. The marker costs one field on the show record, and a tip with no votes does not save the night.
- **The cap is small, and a free account never gets shows back.** A free artist who uses up ten can only pay. Making a second account needs a second email.
- **Existing free artists start from this month's count.** Earlier months were never stored.

## What would reverse it

A new free-show rule from the founder, which changes `PLANS.free.gigs`, `countGig` and the plan card together.

## How it was verified

- **The suite:** 4,641 passed, 0 failed.
- **`test/limits.mjs` (126 ✓) pins:**
  - a discard gives back;
  - a resume counts again, and a discard of that night gives both back;
  - a kept show stays counted;
  - the eleventh is refused with no reset promised;
  - time gives nothing back;
  - the gigMonth migration, both ways;
  - paid nights don't count;
  - the Studio reads `s.gigCount`, draws Hobbyist · x/10 only for a free non-founder plan, and turns it into Upgrade once all ten are used.
- **`test/tenancy.mjs` and `test/autoshow.mjs`:** updated for the new words, and for a Bar Star night no longer counting.
