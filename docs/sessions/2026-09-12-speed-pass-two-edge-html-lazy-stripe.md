# 2026-09-12 — Speed pass two: pages at the edge, the Stripe SDK off the cold path

Decision `0048`. Ledger UX-012. Live as `7f183b2` (PR #4) and `dfd1d13` (PR #5) —
`main` became pull-request-only at 16:33 (decision 0045, another session), so this
was the first work shipped through the new procedure.

## What the founder reported

Repeat opens are quick after pass one; a FIRST open still takes 5–7s on the phone.
Target: 2–3s.

## What was measured before

- Every page open: `cache-status: "Netlify Edge"; fwd=stale` — the edge had the
  HTML but revalidated with the origin each time: 0.6–0.9s before any HTML.
- `/api/me` 2.06s cold, 0.57s warm; `/api/profile` 1.7–2.2s cold, 1.1s warm.
  The cold-start penalty is ~1.5s per function, and each function goes cold on
  its own.
- The Stripe SDK was imported at the top of `_history.mjs` (in the profile,
  community, artists bundles) and `_requests.mjs` (board, me, show, stage): every
  cold start evaluated it.
- A desktop waterfall of `/perryidyll`: HTML TTFB 0.62s; both API calls start at
  0.63s and land at 1.4–1.7s; the photos are served by `/api/img` (a function)
  behind the Image CDN, so on a cold node the pictures also wait on a cold start.

## What changed

1. HTML routes (`/*.html`, `/`, `/:slug`, `/:slug/vote`, `/:slug/community`,
   `/v/:slug`, `/v/:slug/community`) carry
   `Cache-Control: public, max-age=60, stale-while-revalidate=600`. Measured on
   the preview over one connection: miss 0.52s, then hits at 0.05s. A first cut
   used `Netlify-CDN-Cache-Control … durable` — no effect on static files
   (functions only, per the docs); corrected in PR #5.
2. Every `json()` reply says `netlify-cdn-cache-control: no-store` outright.
   Checked on the preview and production: `/api/me`, `/api/admin` → `fwd=bypass`.
3. Stripe is a dynamic import in `_history.mjs` and `_requests.mjs`;
   `stripeForRow` is async (two callers awaited).
4. `/api/profile` runs its six reads in one batch (was profile, then five);
   `/api/venue` reads the vouches in the first batch.

## What was measured after (production, 2026-09-12 ~17:10)

- HTML on a kept connection: hit, ~0.05s (was 0.6–0.9s every tap).
- `/api/me` cold 2.06s → warm 0.57s; `/api/board` cold 2.35s; `/api/profile`
  cold 1.7s. The cold penalty is unchanged by the lazy Stripe as far as one
  sample can tell — the wall is now, clearly, the cold start itself.

## What this means for the 5–7 seconds

At a gig the phones' polling keeps board/me warm, so the first fan after a quiet
hour pays the cold start and everyone after does not. The founder's test — one
phone, quiet site — is the worst case: cold HTML revalidation (now gone) + cold
function (~1.5s) + cold Image CDN transforms of photos served by a cold `/api/img`.

## Open, for the founder's decision

- **Warming.** A ping every five minutes to the seven fan-facing functions is
  ~60k invocations a month; to board+me+profile only, ~26k. Whether that fits
  the Netlify plan is a billing question. The one-warm-door merge (0048 option B)
  cuts it to ~9k for one function and remains the structural answer.
- **Photos.** Serve profile photos as static-ish objects (R2 or the Image CDN
  reading from a public URL) instead of through `/api/img`, so a picture never
  waits on a Lambda.

## Also

- `5b4a531` (pass one) accidentally carried the other session's uncommitted
  `profile.mjs` (decision 0043 work). It is live and answering 200. Their
  `_history.mjs` `topOf()` hunks were left unstaged this time (only this
  session's hunks were committed, via `git hash-object`/`update-index`).
  The push-log rule now says how to stage only your own hunks in a shared tree.
- The pre-push hook needed a fix for new branches (`origin/main..HEAD`).
- `sh test/run.sh` 44 files, 2128 assertions, 0 failed. Not phone-checked.
