---
id: 0144
title: Every pull request runs the suite
date: 2026-10-02
status: decided
decided_by: perry-confirmed
area: ops
reverses:
superseded_by:
invariants: []
commits: [4dc1301]
tests: []
files: [.github/workflows/tests.yml, AGENTS.md]
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

`main` is production and merging is the deploy (decision 0045). Nothing ran the
tests on a pull request: the gate was whoever opened it remembering to run
`sh test/run.sh` first. The 2026-10-02 scale audit counted 192 merged pull requests,
half of them open for under 53 seconds and 83 merged within 15, at about eight
production deploys a day, six of which landed during a filed show.

The founder's word (2026-10-02): run the suite on every pull request.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A GitHub Actions workflow runs `sh test/run.sh` on every pull request and reports a check named `suite`. The branch ruleset requires it once it has proved itself. | Nothing: Actions minutes are free on a public repository | One workflow file | Once the check is required, GitHub Actions being down blocks a merge — the ruleset has no bypass actors, so the way round is to lift the requirement in the ruleset |
| B | Run the suite in Netlify's build | A slower, billed build; a failed production build after the merge, not before | A build command | Finds out too late |
| C | A pre-push hook | Nothing | A hook each checkout must install | Skipped by any checkout that did not |
| D — do nothing | | Nothing | None | A red suite ships |

## What was chosen, and why

A. It tests the pull request before the merge, on a machine that is not the
author's, and costs nothing.

- **No secrets and a read-only token.** The suite needs neither. The repository is
  public, so a fork's pull request runs it too and can reach nothing.
- **Node 22**, and `npm ci --ignore-scripts` from the lock file. The suite's store
  and Stripe are the in-memory fakes; nothing leaves the runner.
- **`[skip ci]` moves to the merge subject.** GitHub skips a pull-request workflow
  when the branch's last commit message carries the marker, and a required check
  that never runs blocks the merge. A docs-only merge now carries the marker in
  the squash subject (`--subject "… [skip ci] (#n)"`), which is the part Netlify
  reads to skip the production build. AGENTS.md § Deploying says so.
- **Required, in a second step.** The ruleset (`main is production`, 23031933) gains
  "require status check `suite`" after the workflow has passed on real pull
  requests, so a fault in the workflow itself cannot lock `main`. As of 2026-10-03
  it is **not** required: the ruleset read back that day carries only `deletion`,
  `non_fast_forward` and `pull_request`, with no bypass actors. Making it required
  is a founder decision on the desk.

## What this makes harder

- A merge waits for the suite: about six minutes on GitHub's runner.
- A branch whose last commit says `[skip ci]` cannot merge once the check is
  required. Add a commit, or amend the message.

## What would reverse it

The suite growing past ten minutes, or flaking. Then split it, do not remove it.

## How it was verified

The `suite` check ran on the pull request that added it (#206): the whole of
`sh test/run.sh` on `ubuntu-latest`, Node 22, passed in 5 m 40 s (run 37035750687).

**Not checked:** holding code deploys while a show is live (the audit's other half
of this item). That needs a deploy gate, not a test run, and is not built.
