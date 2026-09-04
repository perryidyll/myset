# Making MySet fast — every option, and the order to do them in

Written 2026-09-04, after Perry noticed the profile photos loading slowly. Measured
where it says measured; the rest is reasoning from how the pieces are built.

## Where the time actually goes

A MySet page is a static file from Netlify's CDN (fast, cached, ~30–50 KB gzipped)
plus one or more calls to a **Netlify Function**, plus photos that are ALSO served
by a function. Each function call costs:

| Piece | Typical | Why |
|---|---|---|
| Cold start of a function | 200–600 ms | Netlify spins up the Node bundle; happens after minutes of quiet, per region |
| Warm function | 20–60 ms | just the code |
| One strong Blobs read | ~40 ms | measured (`_lib.mjs` comments); the audience poll does 15 of them in parallel, so ~150 ms, not 600 |
| A photo through `/api/img` | 150–700 ms | a function call + a strong read of the bytes, PER viewer, PER photo — and the cover was up to 850 KB |
| Round-trips in series | additive | the Studio used to do stage → planGet → promoList → venueList one after another |
| A render-blocking `<link>`/`<script>` in `<head>` | 100–400 ms on 4G | nothing paints until they arrive — that was the white flash |

So the slow things were, in order: photos (function + bytes, uncached at the edge,
too big), serial round-trips, and blocked first paint. Not the JavaScript.

## What is done (this batch)

1. **Photos are cached at Netlify's edge, durably** (`netlify-cdn-cache-control` on
   `/api/img`). A photo is read out of Blobs by a function ONCE per version, then
   served from the CDN to every viewer. The `?v=` stamp makes it safe for a year.
2. **Photos go through Netlify's Image CDN on the artist page** — resized to the
   slot (1200 px cover, 320 px portrait), WebP/AVIF, edge-cached. Falls back to the
   original if a transform fails.
3. **The cover upload is 1200 px and ≤ 450 KB** (was 1400 px / ≤ 850 KB). Same on a
   phone screen; half the bytes.
4. **First paint is black, from an inline style, before any external file.** The
   splash needs nothing from the network; `app.css` no longer blocks rendering;
   `pull.js` and `lock.css` sit after the splash/boot markup. No white flash.
5. **Studio boot: one round-trip on the critical path** (`planGet` beside `/stage`,
   the owner's lists off the path, `drawPush` not awaited). Measured in code review:
   2→1 serial round-trips for artists, 4→1 for Perry.
6. **The artist page makes two requests, not three** — the profile payload carries
   live/venue/city, so the page no longer pays a 15-read poll to draw one pill.

## What is left, ranked by win ÷ effort

| # | Option | Win | Effort | Risk | Do it? |
|---|---|---|---|---|---|
| 7 | **Upload two sizes** (a 320 px thumb beside every photo) so the cluster and the community feed never load a 1200 px file | big on slow wifi | small (client canvas already exists) | none | yes, next |
| 8 | **Head prefetch of the first API call** on public pages: a 3-line inline script starts `fetch('/api/profile…')` before the stylesheet is even requested | ~100–300 ms first paint of data | tiny | none | yes, next |
| 9 | **Stop cold starts on the hot functions**: keep `show.mjs`/`stage.mjs` bundles tiny (they import `_lib.mjs`, 941 lines — fine); do NOT add scheduled "keep-warm" pings (they cost credits and Netlify may still cold-start per region) | 200–600 ms on the first tap after quiet | none/medium | – | measure first: log `Date.now()-startedAt` per invocation for a week, then decide |
| 10 | **Split the audience payload**: `/api/show` returns the ~40-song list on every 3 s poll; a fan's phone only needs it when it changed. Send `songsVersion` and let the phone skip the list when unchanged (9d6 already notes this split) | −60% bytes per poll, fewer reads if the shards are skipped when `updatedAt` is unchanged | medium | medium (touches the most-polled path; count the reads) | yes, with cost.mjs ceilings |
| 11 | **Durable-cache the public GETs** (`/api/profile`, `/api/venue`, `/api/events`, `/api/community`) for 15–30 s | a busy page becomes one function call per 30 s | small | **product**: a granted tick or a profile edit is stale for up to 30 s; contradicts INVARIANT 0bm and "a write returns the fresh state" | not yet — needs 0bm amended and a cache-bust on write |
| 12 | **HTTP/2 push / preload of `app.css`** | small | tiny | none | done as part of 4 |
| 13 | **Smaller Studio HTML** (197 KB raw, ~45 KB gzipped, one file): split the six tabs' render code into lazy chunks | first load −20 KB | large | medium (one `render()` is load-bearing; structure test pins it) | no — gzip already makes this small |
| 14 | **Move photos out of Blobs entirely** (Netlify Blobs → a bucket + CDN) | none beyond 1+2 | large | migration | no |
| 15 | **Edge Functions** for the poll | lower latency in some regions | large rewrite | high (no Node runtime, no test suite; 9d6) | no |
| 16 | **Service worker precache of the shell** | instant repeat loads | small | INVARIANT 0ax forbids precaching so the newest version always wins; could allow shell-only with versioned names | later, carefully |
| 17 | **Fewer Blobs reads on the Studio poll** (20 of 22): `lists_`, `learn_`, `fb_` change rarely — read them only when `show.updatedAt` moved | −3 reads/4 s per open Studio | medium | low | yes, after 10 |

## The implementation plan

**Now (this session):** 1–6 above. Ship, then measure the artist page and the
Studio from a phone on bar wifi with the browser's timing panel.

**Next session, in this order:**
1. Two-size uploads (#7) — cover 1200/thumb 320, avatar 640/160, community photos
   1024/320; pages pick the small one where the box is small. Half a day.
2. Head prefetch on artist/venue/community (#8). An hour.
3. The poll split (#10) with new `test/cost.mjs` ceilings and an A/B via the
   `flags` document. A day, plus a gig to watch it.
4. Studio poll read trimming (#17). Half a day.
5. Cold-start measurement (#9): one line of logging, one week, then decide.

**Not doing, and why:** 11 until the invariant is rewritten with a write-side cache
bust; 13–15 because the wins do not justify the rewrite; 16 only as a versioned
shell precache after 0ax is reconsidered.

## How to measure, so "faster" is a number

* Phone, bar wifi, Safari → Develop → Timelines; or Chrome remote → Network.
* For the API: `curl -o /dev/null -s -w '%{time_starttransfer}\n' https://myset.vip/api/profile?a=perryidyll` ten times; the first is a cold start.
* For a photo: the same against `/api/img?…` twice — the second should be edge-served (`cache-status` header says `"Netlify Durable"; hit`).
* Never re-derive COST from response times (INVARIANT 9d5): speed and credits are different questions.
