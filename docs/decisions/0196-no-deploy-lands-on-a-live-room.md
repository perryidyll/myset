---
id: 0196
title: No deploy lands on a live room — a production build is held while any show is live and released by the outside watch
date: 2026-10-09
status: decided
decided_by: perry-confirmed
area: operations
reverses:
superseded_by:
invariants: [0jj, 9d3]
commits: [80cc05a]
tests: [test/live.mjs]
files: [netlify/functions/live.mjs, tools/hold.sh, tools/version.sh, netlify.toml, .github/workflows/watch.yml, test/live.mjs, test/run.sh]
---

## The question

Merging to `main` is the production deploy (decision 0045), and a deploy swaps the code under every room that is open: a phone mid-vote reloads the page, the service worker fetches a new script, a function answers with a shape the old page did not expect. The scale audit of 2 October 2026 asked for a hold, and until today every session checked by hand — `show_<aid>.status` for every artist — before each merge, which works only while someone remembers.

The founder chose "hold automatically" over "warn only" and "not now" on 2026-10-09.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Netlify asks MySet who is live before it builds production (`[build] ignore`, `tools/hold.sh`); a build during a show is cancelled, and the outside watch starts it again through the site's build hook once nobody is live and production is behind `main` | One function read per artist per production build and per watch tick while a build is held; nothing while nothing is held | `live.mjs` (`/api/live`), `tools/hold.sh`, a build hook stored as the GitHub secret `NETLIFY_BUILD_HOOK`, one step and one input in `watch.yml`, `commit` on `/api/health` | A held build that nobody releases: the watch asks every five minutes and treats "cannot ask" as "live", so a MySet outage holds deploys until the watch can ask again, or until the valve below is pulled |
| B — warn only | The pull request shows "a show is live"; merging stays the person's call | Nothing | A check on the PR | The merge still lands on the room when the person is in a hurry |
| C — not now | Sessions keep checking by hand | Nothing | None | The night somebody forgets |
| D — hold inside the merge | A GitHub ruleset check that goes red while a show is live | Nothing on Netlify | A scheduled check that re-runs on every PR | GitHub does not re-run a check when the room empties; the PR stays red until somebody pushes |

## What was chosen, and why

A.

- **The answer comes from the show records.** `live.mjs` reads the artist registry and one `show_<aid>` record per artist, eight at a time, inside `LIVE_READ_MS` (8 s): the live mark is the artist's own show record (decision 0154), so no shared document is read and nothing new is written. It answers counts only — `live`, `artists`, `read`, `unread`, `sure` — never names; `sure` is false when a record could not be read in time, and both callers read "not sure" as "a show may be live". Never cached (`json`'s `no-store`).
- **Netlify asks before it builds.** `tools/hold.sh` is the build's ignore command: exit 0 is "do not build", exit 1 is "build". It holds only `CONTEXT=production` — previews and branch deploys always build, because looking at them changes nothing on myset.vip — and only while `HOLD_DEPLOYS` is not `off`. It cannot ask (curl fails, a non-200, `sure:false`): hold. Netlify's docs say the ignore command does not cancel a build started by a build hook, which is exactly the door the release uses.
- **Production says what it runs.** Functions cannot read `COMMIT_REF` at runtime (Netlify gives them only `URL`, `SITE_NAME`, `SITE_ID`), so the build itself writes it: `[build] command = "sh ./tools/version.sh"` puts `{commit, branch, context, builtAt}` in `public/version.json`, and https://myset.vip/version.json is the one honest answer to "is my merge live" — by content, as the rules want, and the first build command this site has had (it never fails the build).
- **The watch releases it.** Every five minutes `.github/workflows/watch.yml` already asks `/api/health`; it now also reads `/version.json`. When production's commit is not `main`'s, nobody is live and the count is sure, the watch POSTs the build hook and notes the time in the repository variable `LAST_RELEASE_AT`; it never releases twice inside thirty minutes, so a build that fails is not retried every five minutes on credits. The hook's address is the GitHub secret `NETLIFY_BUILD_HOOK`; anyone holding it can start builds, which is why it is a secret and not a line in the workflow.
- **The valve.** A hotfix during a show: run the watch by hand with `release=yes` (Actions → watch → Run workflow), which fires the hook at once; or `netlify env:set HOLD_DEPLOYS off` and merge. Both are written in AGENTS.md and GIG-NIGHT.md. A session never pulls the valve on its own: the founder's word, as for any merge during a show.
- **What a session still does.** Nothing by hand. The hold is the rule the sessions followed tonight, made mechanical: a merge during a show is simply built later. Pull-request previews are unaffected.

## What this makes harder

- A deploy during a show arrives up to about five minutes after the last show ends (the watch's tick), and GitHub starts scheduled workflows late when it is busy — five to thirty minutes is normal — so a held build can wait longer than the room did (measured after the merge: the schedule ran three to seven hours apart — see below; since decision 0208 a Cloudflare clock starts the watch every five minutes). The valve exists for the one case that cannot wait.
- A MySet outage holds deploys: if `/api/live` cannot answer, nothing builds from git, and the watch does not release. The outside watch opens its `uptime` issue in the same minutes, so the founder knows, and the valve releases a fix.
- Each production build and each watch tick while a build is held reads one show record per artist. At 300 artists that is 300 reads in 8 s, eight at a time; past that the count comes back `sure:false` and the build waits for a quieter minute. Past a few hundred artists the count should read `gigsched.live` (the live walk's list, 0154) first and walk only when that list is empty.
- `HOLD_DEPLOYS` is one more Netlify variable to know about. `tools/prod.py` does not report it.

## What would reverse it

- Rooms that survive a deploy by design (the open line, P3-002, holding the room's state outside the function's code), which would make the hold unnecessary.
- The hold firing on previews or never releasing in practice; then B (warn only) is the fallback, with the same `/api/live` behind it.

## How it was verified

- `node --import ./test/register.mjs test/live.mjs`: three artists with no show live answer `live: 0, sure: true`; one starts and the address says 1; it ends and the count is 0; a record that cannot be read leaves the count `sure: false` with `unread: 1`; a deadline stops the walk and says so; the registry failing makes the address answer 503, which both callers read as "hold"; the answer carries no name or id and is never cached.
- `tools/hold.sh` run by hand on 2026-10-09 before the merge: `CONTEXT=deploy-preview` exits 1 (build); `CONTEXT=production HOLD_DEPLOYS=off` exits 1; `CONTEXT=production` against production as it was (no `/api/live` yet, so a 404) exits 0 — the "cannot ask, hold" branch.
- On the deploy preview of this change (#262): `/api/live` answered `{"live":0,"artists":8,"sure":true}` with `cache-control: no-store`, and `/version.json` named the branch's head.
- **The hold held its own merge.** The squash `80cc05a` (#262) started a production build that Netlify cancelled at the `ignore` step: production did not yet have `/api/live` (a 404), which is the "cannot ask, hold" branch working as written. After reading every artist's `show_<aid>.status` (none live), the build hook was fired once by hand; Netlify published `80cc05a` at 09:46:07 UTC on 2026-10-09. Read back by content: `/version.json` = `{"commit":"80cc05ac58525697c1fb016c1ad7f32122316f53","branch":"main","context":"production"}`, `/api/live` = `{"live":0,"artists":8,"read":8,"unread":0,"sure":true}`.
- **The hook was replaced on 2026-10-10.** Its id had been written into a ledger row of this public repository, so anyone could have started a production build with it. A new hook was made, its address stored only in the GitHub secret `NETLIFY_BUILD_HOOK`, and the old one deleted (a POST to it answers 404). No document names the hook's id.
- The watch dispatched once with `release=no` on 2026-10-10 (run 38029870710, success): its release step read `/version.json` and `main` and said "production is main (80cc05ac…); nothing held" — no hook call, as it should.
- **Amended 2026-10-10: a docs-only gap is not a held build.** A merge carrying Netlify's skip marker (`[skip ci]`, the rule for doc-only work) is never built, so `/version.json` stays one commit behind `main` with nothing held — and the release step as first written would have started a production build at its next run for every docs merge, billing exactly the build the marker exists to avoid. The step now reads GitHub's compare of production's commit and `main`'s, and releases only when some commit in between is not marked; if GitHub cannot answer, it releases as before. Checked against the real repository: `80cc05a…main` (#263 and #265, both marked) → nothing held; `970ddfe…main` (contains #262) → release; an unknown commit → release.
- **Not checked:** a real held build during a real show, and the watch's first real release (the hook was fired by hand, not by the watch, so `LAST_RELEASE_AT` has never been written).
- **Found after the merge: the watch is not a five-minute clock.** GitHub ran the `*/5` schedule 35 times between 2 and 10 October 2026, three to seven hours apart (for example 03:09, 10:26, 17:06, 21:37 UTC on 9 October). A build held during a show is released at the watch's next run, which can be hours after the room empties; `gh workflow run watch.yml -f release=yes` (or Actions → watch → Run workflow) releases it at once. The same gap applies to the outside check of decision 0157. **Closed by decision 0208:** a Cloudflare Worker (`cloudflare/clock`) dispatches the watch every five minutes, with GitHub's schedule as the backstop.
