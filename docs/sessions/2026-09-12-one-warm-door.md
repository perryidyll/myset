# 2026-09-12 — The one warm door

Decision `0049`. Ledger UX-013. Live as `c4a70c6` (PR #6).

## Asked

"let's do the one-warm-door merge and move photos off /api/img".

## Done

- `netlify/functions/fan.mjs`: `/api/fan?what=profile|events|board|me|community|venue`
  — a lookup table in front of the six existing handler modules, so one function
  (one Lambda) serves every public read. `what=warm` answers 200 with no reads.
- `autocron.mjs` GETs `/api/fan?what=warm` every fourth minute (~11k calls a month).
- `artist.html`, `vote.html`, `community.html`, `venue.html` ask the door (head
  early fetches and the in-page reads; community's POSTs stay on `/api/community`).
  `index.html` and `artists.html` NOT switched — another session had them open;
  the old addresses still answer.
- `test/fandoor.mjs` (22 checks) added to `test/run.sh`. Full suite 2157/0.

## Photos — looked at, left alone

`img.mjs` already answers `cache-control: public, max-age=31536000, immutable` and
`netlify-cdn-cache-control: public, durable, …, immutable`, keyed by the `?v=`
stamp that changes on every upload. A photo is read by a function once per
version for the whole world; the Image CDN transforms from that copy. R2 would
need the founder to set up a public bucket/domain and would remove no wait.

## Measured on production after the deploy (curl, same country as the fans)

| | cold (asleep) | warm |
|---|---|---|
| `/api/fan?what=warm` (reads nothing) | 2.14s | 0.33s |
| `/api/me` | 2.38s | 0.53s |

So the sleep costs ~1.8s and the round trip itself ~0.33s. With the ping the
door should never be asleep when a fan arrives; the first ping fires at the next
minute divisible by four. NOT verified on a phone.

## What is left if 2–3s is still not met on the phone

The function's region vs the fans (a Netlify dashboard setting the founder would
change; the blob store's location must be checked first), and the Image CDN's
first transform of each photo size on a cold node.
