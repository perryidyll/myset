# 2026-10-11 — The outside watch gets a real five-minute clock

**Asked.** The founder, on the task offered when the gap was measured: "Do this task here: Give the outside watch a real five-minute clock". (The same evening the founder asked for the casKeep blank-version fix; Audit Solutions 2 was already building it as #269, decision 0205 / SCL-030, so this session read its diff, confirmed it, and stood down.)

**The gap.** `.github/workflows/watch.yml` is the outside check (0157) and the release of a held build (0196). Its `*/5` schedule ran 35 times between 2 and 10 October, three to seven hours apart; on 10 October the scheduled runs were 01:12, 07:05, 13:34 and 17:57 UTC.

**What was built (decision 0208, SCL-031).**

- `cloudflare/clock/` — a Worker, `myset-watch-clock`, on the Cloudflare account MySet already uses. Cron `*/5`. Each tick POSTs `workflow_dispatch` for `watch.yml` on `main` with no inputs (so `release` is `no`; the valve stays the founder's). When GitHub refuses, it logs why, and the 00/06/12/18 UTC tick sends one ntfy push saying so. No fetch handler, `workers_dev = false`: it has no address.
- Deployed by hand with a pinned wrangler (`npx -y wrangler@4.146.0 deploy`, the version the probe's lockfile pins), so the site gains no dependency and `cloudflare/clock` has no `package.json` for Dependabot to watch.
- GitHub's own schedule stays as the backstop; the workflow's `watch` concurrency group queues a dispatched run and a scheduled one, never side by side.
- Records: 0208 written; 0157 and 0196 amended with one line each; `watch.yml`'s header; AGENTS.md § Deploying; *Watching production* u11/u12; SCL-024's open cell; SCL-031.

**Options weighed** (in 0208): the whole watch moved into the Worker (two homes for one judgement, the issue still needs a token, unauthenticated GitHub reads from shared addresses rate-limited); a third-party cron (a new vendor holding a token); a Netlify scheduled function (dies with Netlify, the one thing the outside check exists to see); doing nothing.

**Verified.** `wrangler dev --test-scheduled` with a fake token: GitHub answered `401 Bad credentials`, logged. Deploy printed `schedule: */5 * * * *` (version `6edc4a25…`). Secret `NTFY_TOPIC` uploaded. Before building, production ran `main` (`b8c9fb0`, #257) and `/api/live` read `live: 0, sure: true`, so the first dispatched run had nothing to release.

**The token.** The founder made the fine-grained token from a pre-filled link (this repository only, Actions read and write, no expiry) and copied it; the session checked the clipboard's shape without printing it, read `watch.yml` with it (HTTP 200), piped it into the Worker secret `GH_DISPATCH_TOKEN` and emptied the clipboard. Its value is in no transcript or file.

**It rang.** `workflow_dispatch` runs at 18:40:05 and 18:45:06 UTC (38076699682, 38077038482); the last scheduled run had been 17:57. The first: `ok=yes front=200 health=200`, no change; release step "production ran b8c9fb0…; every commit since is marked not to build; nothing held". Suite on the branch: exit 0, nothing failing.

**Not checked.** The failure push on a real phone; a held build released by a dispatched run.
