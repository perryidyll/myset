# 2026-09-12 — The Studio's head start, the rest of step 6, and a hotfix

## A hotfix first (`69ef030`, PR #7)

`5b4a531` (16:10) had appended a `// comment` to the Studio's profile read with
sed, swallowing `.then(r=>r.json()).catch(...)`: `PROF` held a `Response` and the
Profile tab drew blanks until 17:50. Found while reading the Studio's boot path
for this task. Live profile data was untouched (`updatedAt` predates the bug).
`test/copy.mjs` now holds the parse to the same statement. The session that
shipped it had "verified" with `node --check` — syntax was valid; the
behaviour was not. Lesson recorded in the ledger row.

## Asked

Step 6 (storage reads side by side) and: the artist Studio still opens in 5–7s —
halve it.

## Step 6, finished

`profile` (six reads, one hop) and `venue` (vouches in the first hop) were done
in 0048; `community`'s venue branch now reads the registry and the profile in one
hop. `board` and `me` were already one lookup + one batch; `me`'s conditional
`readRequests` stays conditional by design ("nothing goes on it unconditionally").

## The Studio (decision `0050`, `PR #8`)

Where the time went: a 328KB page (98KB gzip) whose script is at the bottom, so
the first request leaves only after the whole page has parsed; then
`/api/stage` and `/api/admin` (planGet), two functions that sleep on their own
(~1.8s each to wake, and admin carries the Stripe SDK at the top of
`_billing`/`_connect`).

- A `<head>` script starts both reads with the stored session before the body
  arrives; `api()` consumes each once (checked on the preview: signed-out starts
  nothing; a bad token starts both, consumes both, gates cleanly).
- autocron's ping now wakes the fan door, `/api/stage` and `/api/admin` every
  fourth minute: ~32k calls a month in all.
- Not done, on the list if the phone says so: lazy Stripe in `_billing`/`_connect`
  (17 sync call sites), moving the Studio's script to a cached file,
  `venue-studio.html`'s head start.

Full suite 2191/0. Pushed via PRs #7 and #8; local `main` realigned.
