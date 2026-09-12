# 2026-09-12 — ten free shows, the folded composer, faster page switching

Three asks from the user in one message, all in the working tree, none pushed.
A second session was active in the same checkout (the interactive event map,
UX-004); its files were left alone.

## 1. Free plan: ten shows a month

`gigs: 4` → `gigs: 10` in `netlify/functions/_plan.mjs`. Everything else reads it —
the Live-tab warning, the refusal, the past-due banner, the overview's plan table
(regenerated) and both test suites. Only the plans-card string in `studio.html`
(`TIER_COPY`) had the number typed out; changed by hand. The past-due banner read a
field the server never sends (`gigsPerMonth`) and said "undefined shows a month";
it now reads `gigs`. Decision `0037`.

## 2. The community composer

- Folded: only the five stars show. Tapping one unfolds the text box, the
  where/name/video/photo/clip fields and Post, and stays unfolded for the visit.
  Arriving from the vote page's "Say something about tonight" (`?show=`) or with
  text already typed opens it straight away. A one-line hint sits under the stars
  while folded.
- "Where did you see them? (select)" gains a last option, "Somewhere else — I'll
  type it", which reveals a 60-character text field. The page sends it as
  `where`; `community.mjs` uses it as the post's `showLabel` when no night from the
  list was chosen. A typed name is only a label — it never becomes a show id, so
  the one-post-per-night rule does not apply to it.

## 3. Page switching

What was found, reading how the pages load: only the Studios painted a splash on
leaving; every fan page's first API call waited behind the stylesheet and two
shared scripts; Netlify's default headers made every page re-check every static
file; the default cover image was 277 KB.

What changed — decision `0038` has the options and the one rejected:

- `public/leave.js`, new, on the seven non-Studio pages: paints the three-bar
  splash synchronously inside the click, navigates two frames later; `pageshow`
  takes it down on a back-button return; `window.goTo(url,label)` for script
  navigations — the Stripe checkout hand-offs in `vote.html` and `community.html`
  now go through it. Steps aside where a Studio already has `goTo`.
- An inline `<script>` in the `<head>` of `artist`, `venue`, `vote` and
  `community` starts the page's first API call(s) before the stylesheet blocks,
  into `window.__early`; `boot()`/`load()` consume it once, then fetch fresh on
  later calls. The community page does this only for fans (no artist token).
- `netlify.toml`: `/*.css`, `/*.js` → `max-age=600, stale-while-revalidate=86400`;
  `/img/*`, `/icons/*` → a day. HTML pages unchanged (`must-revalidate`).
- Chrome speculation rules (prefetch on pointerdown, everything but `/api/*`),
  added by `leave.js`; other browsers ignore it.
- `band-sm.jpg` (800 px, 93 KB) as the default cover and the community avatar
  fallback instead of `band.jpg` (1600 px, 277 KB). `og:image` stays full size.

Not done, on purpose: edge-caching `/api/profile` and `/api/events` — see 0038.

## Verified

`test/syntax.mjs`, `test/structure.mjs`, `test/copy.mjs` 37/37, `test/limits.mjs`
84/84, `test/community.mjs` 116/116, `test/tenancy.mjs` 80/80. `node --check
public/leave.js`; every inline block of the four edited pages compiles. Not seen
in a browser — the preview server attached to another project's folder and a
screenshot pass was not worth the credits. Full `sh test/run.sh` to be run before
the push.

## Next

The split (`c3d0a4d`) and R2 (`a4e3657`) are both live: **the open line is next,
on the user's word** (P3-002).
