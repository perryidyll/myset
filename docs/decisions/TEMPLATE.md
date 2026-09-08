---
id: 0000
title: A short sentence, in the present tense, saying what is now true
date: YYYY-MM-DD
status: decided
decided_by: perry
area: voting
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: []
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

One paragraph. What had to be decided, and what forced it — a bug, a bill, a
complaint, a thing Perry said, a limit somebody hit. Whoever reads this in a year
should understand the pressure without having been there.

## The options

Every option that was genuinely on the table, including the one nobody liked. An
option list with only the winner in it is a justification, not a decision record.

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | | | | |
| B | | | | |
| C — do nothing | | | | |

**Do nothing** goes in the table every time. It is always available and it is
sometimes right, and a record that omits it hides the real comparison.

## What was chosen, and why

The reason, not the restatement. If the reason is "Perry said so", write that —
it is a legitimate and common reason here, and it tells a future reader not to
argue with it.

## What this makes harder

The honest cost. Every decision closes something off: a future feature, a cheaper
path, a simpler explanation. Name it now, while it is still obvious.

## What would reverse it

The conditions under which this should be revisited — a number crossing a
threshold, a vendor changing a price, a real user hitting the edge. A decision
with no reversal condition is a decision nobody can ever safely revisit.

## How it was verified

What was actually run, and what it printed. "Tests pass" is not verification;
name the suite and what it asserts. If something was NOT checked, say so here.
