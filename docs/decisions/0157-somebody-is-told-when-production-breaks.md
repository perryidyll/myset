---
id: 0157
title: Somebody is told when production breaks
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: ops
reverses:
superseded_by:
invariants: [16]
commits: [b7444c4]
tests: [test/watch.mjs]
files: [netlify/functions/_watch.mjs, netlify/functions/watchcron.mjs, netlify/functions/health.mjs, .github/workflows/watch.yml]
---

<!--
  FRONT-MATTER FIELDS

  id           four digits, in order. ./tools/decide.sh picks the next one.
  title        what is now TRUE, not what was done. "A vote never comes back",
               not "changed the vote logic".
  status       proposed | decided | superseded | reversed
  decided_by   perry | claude | perry-confirmed   (who actually chose — this matters
               later, because a decision Perry made is not one to re-litigate)
  area         voting | plans | money | storage | auth | media | scale | ops | ui | docs
  reverses     the id of a decision this overturns, if any
  superseded_by  filled in later, by whatever replaces this
  invariants   the INVARIANTS.md ids this created or changed
  commits      short hashes
  tests        the suites that would fail if somebody undid this
  files        the files where this decision physically lives

  Delete this comment when you fill the template in.
-->

## The question

Nothing told anyone when production broke. There was no monitor and no pager;
scheduled jobs failed into a log that keeps a day; decision 0029 left alerting for
later. The 2026-10-02 scale audit counted three such failures in September, each
found by a person the next day. The founder's word (2026-10-02): an outside uptime
check, and an alert to his phone.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Inside: `watchcron` asks three questions every ten minutes and pushes to the founding page's owner seat when an answer changes. Outside: a GitHub Actions schedule reads `/api/health` and the front page every five minutes and opens or closes an issue assigned to the owner. | One small scheduled function; Actions minutes are free on a public repository | `_watch.mjs`, `watchcron.mjs`, `health.mjs`, `watch.yml`, one document `watch` | GitHub starts schedules late (5–30 minutes) — so the outside half is a backstop |
| B | A monitoring service (UptimeRobot, Better Stack) | Free tier, an account | A vendor and its app | The fastest outside check; needs the founder to make the account |
| C | Only the inside watch | Nothing | Less | Blind to Netlify itself being down |
| D — do nothing | | Nothing | None | The next failure is found by an artist |

## What was chosen, and why

A, because both halves can be built without a new account or a new dependency, and
each sees what the other cannot. B stays open as the faster outside check; the
health address is what it would point at.

- **Three questions** (`look`): did the bell ring in the last 10 minutes; is any
  payment still owed after 15 (decision 0138); did the last hour log 25 or more
  server errors. A store that does not answer is itself an answer.
- **Told on change, not on a timer.** Once when it goes wrong, hourly while it
  stays wrong, once when it is right again. The state is one document, `watch`.
- **To the owner seat of the founding page only**, through `notify` — the same
  push the Studio already uses, so there is nothing new to install.
- **`/api/health`** is never cached and returns ages and counts only. 200 when every
  answer is inside its limit; 503 otherwise, with `why`. It also reports how long
  ago the inside watch ran, which is how the outside check sees a stopped schedule.
- **The outside check** tries three times, forty seconds apart. It opens one issue
  labelled `uptime`, assigned to the repository's owner (GitHub emails and pushes
  that), and closes it when the check passes. If the repository has a secret named
  `NTFY_TOPIC`, both messages also go to ntfy.sh as a phone push.

## What this makes harder

- The repository is public, so an outage leaves a public issue. It carries the
  health address's counts and nothing else.
- Two more things to keep true: the limits in `_watch.mjs`, and the push
  subscription on the founder's phone.

## What would reverse it

A monitoring service being set up (B): the outside workflow would be removed, the
health address and the inside watch kept.

## How it was verified

`node --import ./test/register.mjs test/watch.mjs` — 30 passed, 0 failed: all well
tells nobody and answers 200; a stalled bell is told once, not again ten minutes
later, again after an hour, and "back to normal" once; a payment owed five minutes
is not an alarm and one past fifteen is; 25 logged errors are; an unreadable store
is a problem and a 503; a stopped watch shows on the health address; a failed push
does not stop the watch.

**Not checked:** a real push arriving on the founder's phone from the watch; the
outside workflow on GitHub's schedule (it only runs from `main`); how late GitHub
actually starts it.
