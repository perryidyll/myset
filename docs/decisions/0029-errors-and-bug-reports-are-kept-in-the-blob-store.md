---
id: 0029
title: Errors and bug reports are kept in the blob store, not in a vendor
date: 2026-09-11
status: decided
decided_by: perry-confirmed
area: ops
reverses: 0013
superseded_by:
invariants: [0fb]
commits: [e74292b]
tests: [test/errlog.mjs]
files: [netlify/functions/_errlog.mjs, netlify/functions/bug.mjs, netlify/functions/admin.mjs, public/vote.html, public/studio.html]
---

## The question

Netlify deletes function logs after 24 hours, and its log drains are Enterprise-only.
So when a fan said "it broke on Saturday" there was nothing to look at by Monday
(GATE-004, open since the ledger was written). The user asked whether a "report bug"
feature could store the report together with the function logs from the hours before
it, somewhere outside Netlify's 24-hour window — Google Drive, or beside the rest of
the data. The open-line report had ranked error tracking as the first thing to build.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: errors and reports in the blob store** | The server writes its own errors into Netlify Blobs, one document per hour under a computable key; a public `/api/bug` endpoint stores the fan's sentence plus the last three hours of those; the Studio reads them on demand | Nothing new — reads and writes on the store already paid for, only on the error path | None. No account, no dependency, no vendor | The store itself being down is exactly the failure it cannot record — the console line still reaches Netlify's 24-hour log |
| B — Sentry over raw HTTP | A hosted error tracker with counts, grouping and alerts; free tier 5,000 errors a month, 30-day retention | $0 now, $26/month on the Team tier; the user's hands to open the account and hold the DSN | A second dashboard, a second login, a second thing to keep alive | A vendor outage or a quota hit silently drops errors |
| C — Google Drive | Write each report as a file in a Drive folder | OAuth, a service account, a token in Netlify's environment | A Google integration to keep working, and a folder that nobody indexes | Token expiry, silently |
| D — do nothing | — | GATE-004 stays open | — | The next fan-reported bug is undiagnosable, as today |

## What was chosen, and why

**A.** It closes GATE-004 with no new vendor, which is the ranking rule for everything
in this codebase (a platform is not a one-off cost — the open-line report, § "What to
build first"). It also answers the user's actual question: yes, the report can carry the
server's own errors from the hours before it, and no, they do not need to leave the
store that already holds everything else. Google Drive was ruled out because it adds an
OAuth integration to keep alive for a job the blob store already does. Sentry stays the
next step if grouping and alerting are ever wanted — the hourly buckets can be shipped
to it later without changing where they are written.

## What this makes harder

There is no alerting: nobody is paged. The Studio shows reports when the artist looks.
Errors are capped at 100 an hour and reports at 30 per artist, so a flood is sampled, not
kept. The error log is global (per hour), not per artist — a report attaches everything
the server saw in that window, which on a busy night includes other rooms' errors. That
is acceptable at today's scale and is the first thing to change if it stops being.

## What would reverse it

A second operator who needs to be paged; more than one artist regularly needing to
read errors that are not theirs; or Netlify's log retention changing. Any of those
means "ship the hourly buckets to Sentry", not "stop writing them".

## How it was verified

`node --import ./test/register.mjs test/errlog.mjs` — 42 assertions, 0 failing: the key
is the hour and computable; a row can be read back with a cut-short stack; an hour never
holds more than the cap; a guarded handler's uncaught throw becomes a 500 and lands on
the record; an empty report is refused; a real one is readable through `admin` with what
the phone saw and what the server saw; the same device is thanked but not stored twice
inside ten minutes; every public handler is wrapped. `sh test/run.sh` — 1,926
assertions, 0 failing. **Not checked:** the pages in a real browser at phone width.
