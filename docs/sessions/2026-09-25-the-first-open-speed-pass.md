# 2026-09-25 — The first-open speed pass (decision 0088)

**Asked:** "an extremely detailed analysis on how the entire app is functioning and
implement every little strategy you can to increase the speed of the load times
across the entire app" — right after the fan pages' shared script (0087, same session,
same branch `perf/fan-script`).

## What was measured (production, from the founder's Mac, read-only GETs; the raw file is the session's scratchpad `perf/prod-timings.txt`)

| What | Bytes (br) | TTFB | Edge |
|---|---|---|---|
| `/` `/about` `/artists` `/perryidyll` `/perryidyll/vote` `/perryidyll/community` `/perryidyll/shop` `/perryidyll/diary` `/studio` `/venues` | 6.8–37.9 KB | 0.42–1.36 s | `fwd=miss; stored` on 30 of 33 requests; 4 hits in 12 rapid GETs of the vote page (per-node copies, a year's `ttl`) |
| `/app.css` `/theme.js` `/leave.js` `/pull.js` `/lock.css` `/sw.js` | 2.2–5.0 KB | 0.16 s (hit) – 0.75 s (miss) | the same lottery |
| `/studio.js?v=…` | 117 KB | 0.62–1.45 s | miss ×3 |
| `/api/fan?what=profile` `…events` `…diary` | 1.2–1.7 KB | 0.44–0.65 s on a `"Netlify Durable"; hit`; 0.75–1.5 s stale/first | durable cache, region-level |
| `/api/fan?what=board` `…community` | 1.5–3 KB | 0.55–0.73 s | `fwd=bypass` by design (3 s rung; personal) |
| `/api/artists?maps=1` `/api/mapconfig` `/api/events?places=1` | 0.07–1.3 KB | **1.98 / 1.15 / 1.77 s cold**, 0.43–0.85 s warm | `bypass` (artists, mapconfig — uncached); `places` durable 60 s |
| `/.netlify/images?url=%2Fimg%2Fband.jpg&w=800` (the artist page's LCP) | 35 KB | 0.61 s | miss ×4 |
| handshake | | dns 0.002–0.06, tcp 0.05–0.19, tls 0.11–0.41 s | HTTP/2, Brotli everywhere, no Early Hints |

The artist page's waterfall in the app's browser (warm cache, 375 px): HTML 178 ms → profile + events start at 183 ms, arrive at 576 ms → the cover transform's first byte at 1.2 s → **`/api/img?…` originals of 85 / 108 / 123 / 85 KB fetched behind the 220 px thumbnails and the 320 px portrait** — layered backgrounds download every layer.

## What shipped — **live as `68efdb4`** (PR #85, merged 2026-09-25 03:51 UTC; live on production ~30 s later) (one PR for both batches: the tree that was verified end to end)

1. **One picture per slot** — `artist.html`'s three thumbnails and the portrait are `<img>` of the small copy with the original only on error (the cover's own pattern); the portrait keeps its 48 px copy behind as the placeholder. ~400 KB off every first open of an artist page with photos. INVARIANT 0gd; `test/structure.mjs` refuses `), url(` on a fan page.
2. **No blocking script in any head** — `pull.js` moved to the bottom group on the vote page, the front door and About (its head comment had argued the worker makes it free; a first visit has no worker); `theme.js` is `defer` in both Studios (nothing reads `MySetTheme` at parse). The structure check refuses a non-deferred `<script src>` before `</head>` on a fan page.
3. **The vote page paints first** — a `#intro` logo screen in the HTML (the other fan pages' three bars), taken off at the first board or when the board cannot be reached (then *Couldn't reach the room — check the wifi, then pull down to try again*, which a pull or the poll replaces); app.css's `:root` blocks inline as `<style id="tokens">` (byte-identical to app.css by test) and app.css itself preloaded instead of render-blocking; `render()` waits for it, 400 ms at most, before the first paint.
4. **The last two cold reads through the warm door, cached** — `fan.mjs` gained `artists` and `mapconfig`; `artists.mjs` is `jsonCached(…, 60)`, `mapconfig.mjs` `jsonCached(…, 300)`, the places picker 60 → 300 s; `index.html` and `artists.html` ask `/api/fan?what=…` and start those reads from the `<head>` (the front door also starts the remembered city's feed). The old addresses stay up. `test/fandoor.mjs`, `test/artists.mjs`, `test/copy.mjs`, `tools/mock.mjs`, `tools/uicheck.mjs` follow.

## What was NOT done, and why (each is a decision the founder can make)

- **Serve navigations stale-while-revalidate from `sw.js`** — the one lever for a returning phone's HTML wait; changes when a deploy lands on a phone during a gig; `sw.js` is do-not-touch (0ax).
- **Inline all of app.css into every page** — removes the CSS round trip for every first paint but turns every app.css edit into a ~3,600-line diff; the vote page got the 2 KB that matters.
- **Split the community read** (shared, cached posts + a small personal call, as 0034 did for the board) — `what=community` is `fwd=bypass` because it carries `fan=`; a real project.
- **The HTML edge lottery** is Netlify's per-node cache; a busy bar fills the nodes on its own.
- **Preload hints for the bottom scripts** — the preload scanner already finds them as the HTML streams; tens of milliseconds at most.

## Verified

`sh test/run.sh` on the final tree: 52 files, 3,502 assertions, 0 failed. `node tools/uicheck.mjs` 242 ✓ / 2 ✗ (the same two as origin/main: the stale profit figures). `node tools/sheetcheck.mjs` 39 ✓ / 0 ✗. `node tools/clipcheck.mjs` the same one pre-existing ✗. `tools/mock.mjs` in the app's browser at 375 px: vote (logo screen lifts, app.css applied through the preload, tokens inline, pull.js at the bottom, the failure message and the recovery), artist (one `<img>` per slot, no stacked `url(`), front door and directory (both reads through `/api/fan?what=…`, network log). The fresh-context review of 0087 (its findings fixed in the same tree: one declaration per line in `fan.js` so the guard sees every name; the guard now also catches `var` and comma lists; `docs/design-system.md` §8 re-pointed; the artist page's `#toast` moved outside `.wrap`; two stale comments).

## The AFTER, measured on production 2026-09-25 (same Mac, same loop)

| Read | Before | After |
|---|---|---|
| `/api/fan?what=artists&maps=1` | 1.98 s cold, 0.76–0.85 s warm, `fwd=bypass` | 1.49 s on the first call after the deploy, then `"Netlify Durable"; hit` 0.46 s (an Edge hit at 0.17 s) |
| `/api/fan?what=mapconfig` | 1.15 s cold, 0.60–0.68 s warm, `fwd=bypass` | 0.42 s, durable hits |
| `/api/fan?what=events&places=1` | 1.77 s cold, 0.43 s hit | 0.42–0.45 s, durable hits, ttl 299 |
| `/perryidyll` in the app's browser | 4 originals (85/108/123/85 KB) behind the thumbnails | 0 originals; four `<img>` slots |
| the directory's reads in the browser | — | 322 / 314 ms |
| the front door's places read in the browser | — | 311 ms |
| `/fan.js` | — | `public,max-age=31536000,immutable`, Brotli, stamp `580721d7` = the file |
| `/perryidyll/vote` (curl) | bare until the board | `<style id="tokens">`, `#intro`, app.css preloaded, no `<script src>` in the head |

The old addresses (`/api/artists`, `/api/mapconfig`, `/api/events?places=1`) still answer 200. Not measured: a first open on a phone in a bar.

## How to measure again

From the same Mac, the same read-only loop (`curl -s -o /dev/null -w '%{time_starttransfer}'` with `-H 'accept-encoding: br, gzip'`, three runs each): `/api/fan?what=artists&maps=1` and `/api/fan?what=mapconfig` should answer `"Netlify Durable"; hit` on the second run at ~0.45 s instead of 0.75–2.0 s; `/perryidyll` in the app's browser should show no `/api/img?…` entries behind the thumbnails; the vote page's first paint (Performance API `paint` entries on a cleared cache) should land at the HTML's arrival rather than after app.css. A real phone on bar wifi remains the honest test.
