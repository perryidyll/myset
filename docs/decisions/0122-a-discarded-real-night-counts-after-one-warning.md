---
id: 0122
title: A discarded real night counts after one warning
date: 2026-09-29
status: decided
decided_by: perry
area: plans
reverses:
superseded_by:
invariants: [9d9]
commits: []
tests: [test/limits.mjs, test/sheets.mjs]
files: [netlify/functions/_lifecycle.mjs, netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/_warehouse.mjs, public/studio.js]
---

## The question

Decision 0120 made the free plan ten shows in total, and gave a discarded show its count back, so an artist can try "Start the show" without spending one. The founder confirmed that a discard gives the count back whoever started the night. That leaves a loophole: a free artist could play every gig and discard it afterwards, for ever. The founder asked for "a robust monitoring system to help prevent people from taking advantage of that loop hole", and suggested the shape: "send them a little warning pop up window message if they try to discard a show that lasted >1 hour and had 5+ votes (and especially if they received payments during it) saying that any shows in the future that meet those requirements will be logged as one of their 10 freebies".

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A real night (over an hour AND 5+ votes) is warned about once, then counts when discarded; every free-plan discard is logged to a Discards tab on the Sheet | A second question on a real night's discard | `discardVerdict`, `show.discardWarnedAt`, `meta.discards`, one Sheet tab | An artist who discards a real night after the warning uses one of their ten |
| B | Monitoring only: log discards, act by hand | Nothing for the artist | The log | The loophole stays open until someone reads the log |
| C | A real night can never be discarded | Simple | Nothing new | Punishes an artist who genuinely wants a night off their record |
| D — do nothing | Discards always give back | Nothing | Nothing | Unlimited free shows |

## What was chosen, and why

Option A, the founder's own suggestion, made one step stricter than a warning alone: the server enforces it, so the Studio cannot be bypassed.

- **A real night** ran for 60 minutes or more (to when it ended, if it has) and took 5 or more votes (every round's, plus what still stands). Both conditions are needed. The numbers are `REAL_NIGHT` in `_lifecycle.mjs`.
- **Money is named, not a trigger.** The warning says "and you were paid $X" when there was money, but money alone does not make a night real, because an artist trying their own tip button is testing. This is the one judgement call beyond the founder's words.
- **The flow.** A discard of a real night on the free plan answers 409 with `confirm: { outcome, minutes, votes, paid, cap, used }` and changes nothing. The Studio shows it, and sends the discard again with `ack` set to the outcome it showed. An ack that no longer matches asks again.
  - **First time (`warned`):** "This looks like a real show… We won't count this one, but from now on a show you discard that runs over an hour with 5 or more votes counts as one of your 10 free shows." The night is given back, and `show.discardWarnedAt` is set, for good.
  - **After that (`counted`):** "This one will count… Save it instead and it's in Past shows." The night keeps its count, and `freeNight` is cleared so a second discard of the same night has nothing to give back.
- **Tests still cost nothing.** A short night, or one with fewer than five votes, is given back with no question. So is any discard on a paid plan or by the founder.
- **Monitoring.** Every free-plan discard writes a row on `meta.discards` (last 30 per artist): when, minutes, votes, money, and what happened (given back, warned, counted). The Sheet gets a **Discards** tab, rewritten every sync, with the artist's free shows used beside each row. One artist with many rows is the pattern to watch.
- The Studio's copy now says "a **test** show you discard doesn't count".

## What this makes harder

- An artist who really did play and genuinely does not want the night on file, after the one warning, spends a free show to discard it. Saving it and hiding it from Past shows is the free way.
- The warning is once per account, ever. It is not re-armed after an upgrade and a downgrade.
- The log is a copy on the Sheet. Nothing alerts the founder in real time.

## What would reverse it

- Real artists being counted for nights they call tests. That would mean the thresholds are wrong; raise `REAL_NIGHT`.
- Rows on the Discards tab showing artists who stay just under the thresholds night after night. That would mean lowering them, or counting money as a trigger.

## How it was verified

- `test/limits.mjs` (170 ✓) pins:
  - a short night with no votes is given back without a question, and logged as a test;
  - 30 minutes with 10 votes is still a test, because both conditions are needed;
  - two hours with 6 votes answers 409 `warned` with the figures and ends nothing; with `ack: 'warned'` it is given back, remembered and logged;
  - the next real night, with a $5 tip, answers 409 `counted` naming the money; a stale ack asks again; with `ack: 'counted'` it counts, says so, and is logged with the money;
  - a second discard of that ended night writes nothing new;
  - a paid plan or the founder is never asked, and an ended night is measured to when it ended;
  - the Studio sends back the outcome it showed, and its copy says "a test show".
- `test/sheets.mjs`: the sync makes twelve tabs, Discards among them.
- Suite: 4,686 passed, 0 failed.
- Localhost at 375 px: the warning renders in the Studio's own window, and tapping through ends and gives back a test night (0/10).
- Not checked: a real night's discard on production (it needs an hour and five votes).
