---
id: 0208
title: The outside watch runs every five minutes on a Cloudflare clock, with GitHub's schedule as the backstop
date: 2026-10-11
status: decided
decided_by: claude
area: ops
reverses:
superseded_by:
invariants: []
commits: []
tests: []
files: [cloudflare/clock/wrangler.toml, cloudflare/clock/src/index.mjs, .github/workflows/watch.yml]
---

## The question

`.github/workflows/watch.yml` is MySet's outside check (decision 0157: is production answering, told to the founder's phone when that changes) and the release of a production build held while a show was live (decision 0196). Both assume it runs every five minutes, as its `*/5` schedule asks. GitHub treats that schedule as a request it honours when it is not busy: it ran the workflow 35 times between 2 and 10 October 2026, three to seven hours apart (13:34 and 17:57 UTC on 10 October, for example). So an outage could reach the founder hours late, and a build held during a show could wait hours after the room emptied unless somebody ran the workflow by hand. The founder asked for a real five-minute clock ("Do this task here", on the task offered when the gap was measured); which clock was this session's choice.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A Cloudflare Worker with a `*/5` cron trigger asks GitHub to run `watch.yml` now (`workflow_dispatch`). The workflow keeps every decision; the Worker only rings. | Nothing: cron triggers are part of both Workers plans (Free allows five per account and 10 ms of CPU a run; a dispatch is one outbound request); Actions minutes are free on a public repository. | One Worker (`cloudflare/clock`), one fine-grained GitHub token in its secrets. | The token expires or is revoked: the Worker says so on the founder's phone every six hours, and GitHub's own schedule carries on as before. |
| B | Move the whole watch into the Worker: it asks the site, pushes to ntfy, fires the build hook itself. | A second home for the logic of 0157 and 0196, or a rewrite of both; the `uptime` issue still needs a GitHub token; `LAST_RELEASE_AT` moves to Workers KV; unauthenticated GitHub reads from Cloudflare's shared addresses hit the 60-an-hour limit. | A Worker with real logic, KV, the build hook's address in a second place. | Two watches that disagree, or a rewrite that loses what the workflow already gets right. |
| C | A third-party cron or uptime service (cron-job.org, UptimeRobot) calls the same dispatch. | Free tiers exist; a new account with a vendor that holds a GitHub token. | An outside account nobody else in the project uses. | The vendor's free tier changes or goes quiet, and nobody is told. |
| D | A Netlify scheduled function dispatches the watch. | Free. | One function. | It stops when Netlify does — the one failure the outside check exists to see. |
| E — do nothing | Keep GitHub's schedule; after a show, run the workflow by hand with `release=no`. | Nothing. | None. | An outage reaches the founder hours late; a held build waits for somebody to remember. |

## What was chosen, and why

A. It fixes the clock without moving any judgement: what counts as down, when a build may be released, how releases are spaced, all stay in the one workflow decisions 0157 and 0196 describe and already verified. The Worker lives on the Cloudflare account MySet already uses (the R2 mirror, the open-line probe), so there is no new vendor, and it fails loudly: when GitHub refuses the dispatch, the tick at 00:00, 06:00, 12:00 and 18:00 UTC sends one ntfy push saying why. GitHub's own schedule stays on as the backstop for a Cloudflare outage — it costs nothing, and a dispatched run and a scheduled one queue behind each other in the workflow's `watch` concurrency group, never run side by side.

- **The token** is fine-grained: this repository only, Actions read and write, no expiry. It can start, re-run and cancel workflow runs; it cannot read or change code, issues, secrets or settings.
- **The dispatch** names `main` and no inputs, so `release` is `no`: the Worker can never use the valve (`release=yes`), which stays the founder's.
- **Deployed by hand** from `cloudflare/clock` with a pinned wrangler (`npx -y wrangler@4.146.0 deploy`), never by the Netlify pipeline; nothing in the directory is published, and the site gains no dependency.

## What this makes harder

- One more thing to keep alive: the Worker and its token. A dead token only puts things back where they were (GitHub's schedule), and the phone hears about it.
- The watch now really asks production every five minutes, as decision 0157 meant it to: about 288 runs a day, each reading `/api/health`, the front page, `/version.json` and (only while production is behind `main`) `/api/live` — roughly 1,150 requests a day, two of them functions, where the late schedule made a few dozen.
- The Actions list fills with `workflow_dispatch` runs, and a run that waits behind another in the `watch` group can show as cancelled. Neither is a failure.

## What would reverse it

- GitHub's schedule keeping time: a week of runs no more than ten minutes apart from `schedule` alone, and the Worker can be deleted (`npx -y wrangler@4.146.0 delete` in `cloudflare/clock`, then revoke the token).
- A monitoring service taking over the outside check (decision 0157's option B), or the release moving into Netlify itself.

## How it was verified

- `wrangler dev --test-scheduled` with a fake token, one tick by `/__scheduled`: GitHub answered `401 Bad credentials` and the Worker logged it; with no ntfy topic set it stayed quiet, as it does on 71 of a day's 72 ticks outside 00/06/12/18 UTC.
- Deployed on 2026-10-10 at about 18:35 UTC: `Deployed myset-watch-clock triggers — schedule: */5 * * * *`. Secrets `NTFY_TOPIC` and `GH_DISPATCH_TOKEN` uploaded; the token, made by the founder, read `watch.yml` (HTTP 200) before it was stored, and went from the clipboard straight into the secret — its value is in no transcript or file.
- **The clock rang.** The next ticks started `workflow_dispatch` runs at 18:40:05 and 18:45:06 UTC (runs 38076699682 and 38077038482), where the last scheduled run had been 17:57. The first read `ok=yes front=200 health=200`, said "no change", and its release step said "production ran b8c9fb0…; every commit since is marked not to build; nothing held" — right, since only docs had merged after #257.
- **Not checked:** the failure push on a real phone, and a held build released by a dispatched run.
