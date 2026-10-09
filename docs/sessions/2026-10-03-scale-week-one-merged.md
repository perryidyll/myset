# 2026-10-03 — Scale audit week one, merged and live

## Asked

The founder asked for the 2 October scale audit's week-one items to be fixed: payments that fail quietly, a scheduler that stalls as artists grow, reads that fail as empty documents, a vote page that hammers a struggling server, no alerting, no edge rate limit, no test run on pull requests. On 2026-10-03 the founder said "merge". This session then recorded the merges in the docs, the process sheets and Puzzle.

## Shipped

Every merge is a squash on `main`; "live" is Netlify's published-deploy record for that commit.

| PR | Merge commit | Decisions | What it is | Live (UTC) |
| --- | --- | --- | --- | --- |
| #208 | `4dc1301` | 0144 | The `suite` check runs `sh test/run.sh` on every pull request | merged 2026-10-02 17:05 |
| #205 | `0387145` | 0138, 0139 | A failed grant answers Stripe 500 and is written to `payowed`; the bell retries it. The card-fee correction runs only for `splitFee` plans | 2026-10-02 19:29 |
| #211 | `8306251` | 0140, 0141 | The bell does shows first, then the daily pass on a clock (`RING_BUDGET_MS`, heal in chunks). The audience path reads a 60 s copy of the artist list | 2026-10-02 19:38 |
| #212 | `831dcb8` | 0142, 0143 | A failed read throws `StoreError` and `guard()` answers 503 busy. The vote page backs off, times every request and resends a busy vote | 2026-10-02 19:56 |
| #213 | `b7444c4` | 0157 | The watch (`_watch.mjs`, `watchcron`), `/api/health`, and the outside check in `.github/workflows/watch.yml` | 2026-10-02 19:59 |
| #214 | `9407416` | — | 'Copy them' under the recovery codes and 'Move my account' work again | by 20:03 (inside `6ee1884`'s deploy) |
| #210 | `6ee1884` | 0160 | Two rate rules in `netlify.toml`: `/api/auth` at 300 a minute per address, above `/api/*` at 60,000 | 2026-10-02 20:03 |

#204 (`d8a3e56`) went in earlier the same day.

The docs pull request from this session:
- fills `commits:` on the nine records;
- corrects 0144: the ruleset has no bypass actors, and `suite` is not a required check yet;
- adds `payowed` and `watch` to `docs/processes/DATA-MODEL.md`;
- turns every "not live" note for these PRs in the sheets into live wording;
- raises the suite job's timeout from 15 to 25 minutes.

## Broke

- **A CI run timed out.** A test in `test/accounts.mjs` brute-forces a six-digit sign-in code. It read the store on every guess, up to a million reads. On GitHub's runner that took longer than the code's ten-minute life, so the run failed. Fixed in #212: the test reads the code once and tries the digits in memory.
- **Two stacked pull requests got no `pull_request` run.** Their base was another PR's branch. They were retargeted to `main` before pushing, and then the check ran.
- One full suite run took about eleven minutes, close to the job's old 15-minute timeout. That is why the timeout is now 25.

## Verified

- Netlify's published-deploy record for each merge commit, at the times in the table.
- `https://myset.vip/vote.html` carries `timed(`.
- `/studio.js` carries the button fix: `esc(JSON.stringify(`.
- `/api/health` answers 200 with `ok: true`. The first read showed `bellAgeSec` ~108; later reads showed 9 and 68, with `owed` 0 and `errorsLastHour` 0.
- `main`'s `netlify.toml` has both `rate_limit` blocks.
- `gh api …/rulesets/23031933` shows deletion, non-fast-forward and pull request. It has no bypass actors and no required status check.
- **Production still serves `theme.js` with `max-age=60`.** The fix is in open PR #229, not on production yet.

## Not checked

- A real Stripe redelivery against production.
- A real store outage or throttle.
- A real alert reaching the founder's phone.
- The outside workflow on GitHub's schedule: no scheduled run of `watch.yml` was listed yet.
- That Netlify enforces the edge rate limits as documented.
- `_mirror.mjs` `GLOBALS` does not list `payowed` or `watch` yet, so the off-site mirror does not copy them. The phase-two stack's FAMILIES work is where that lands.

## Puzzle (workspace 13099)

- Steps 397309–397314 and 370083 (i09) are now Live, with the merge commit in their notes.
- 29 more steps had their "not live on 2026-10-03" lines rewritten as live. That includes 370120 (h06), 369797 (a02) and 27 lines of the form "Not live … in pull request #N".
- Changelog entries 2696–2701, 2703 and 2704 are completed, with their live commits.
- 2702 (0144) stays *in progress*, because making `suite` a required check is still open.
- Entities 5186 `payowed` and 5187 `watch` were created on Netlify and linked to their steps.
- d08 (397315) was re-placed in section 41990 through the API. Whether it still overlaps another step can only be seen on the canvas.
