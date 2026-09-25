# 2026-09-25 — the Instagram dashboard at myset.vip/mediadash (decision 0092)

**Asked.** "Ship this dashboard to www.myset.vip/mediadash." The dashboard was built the same
day in the content engine (`myset-content`, `npm run dashboard` → localhost:8798): every
post, every metric Instagram will give, every pull kept as a curve, boosts logged by hand.

**Shipped on branch `content/mediadash`.**
- `netlify/functions/mediadash.mjs` — GET serves the stored JSON (+ `?thumb=<id>` a JPEG);
  POST with `x-mediadash-key` stores the JSON and thumbs; POST with the founder's sign-in or
  recovery code logs a boost into `mediadash/boosts`. Three computable keys, no `list()`.
- `public/mediadash.html` — byte-identical to the engine's `publish/dashboard.html`; the
  page reads `location.port` to pick its endpoints (`/data` there, `/api/mediadash` here),
  hides the Pull button here, and asks once for the admin code (kept in `localStorage`
  `myset.admin`, like report.html) before a boost is saved.
- `netlify.toml` — `/mediadash` → `/mediadash.html`, above the `/:slug` catch-all.
- Netlify env: `MEDIADASH_KEY` (secret, functions scope, all contexts) — set through the
  Netlify MCP before the merge so the deploy carries it. The same key sits in the engine's
  `.env` as `MEDIADASH_KEY` with `MEDIADASH_URL=https://myset.vip/api/mediadash`.
- Engine side (its own repo, commit noted there): `publish/mediadash-data.mjs` builds the
  JSON and `pushToSite()` sends it after every `publish/insights.mjs` run, with a 320-px
  JPEG per live post the first time (`publish/mediadash-pushed.json` remembers), and pulls
  back boosts logged on the site into `publish/boosts.ndjson`.

**Verified.** (filled in as each step ran — nothing below was assumed)
- `sh test/run.sh` on the branch: every section green, exit 0 (the last sections printed
  44/0, 63/0, 59/0, 20/0, 91/0, 89/0; `test/structure.mjs` walked `public/mediadash.html`
  with the other pages and raised nothing).
- Deploy preview 92 (`deploy-preview-92--mysetvip.netlify.app`): `/mediadash` answers the page
  by content (`<title>MySet Signal</title>`, the hero line); `/api/mediadash` answers
  `{ok:true, empty:true}` before any push; a boost without a code → 401; a push with a wrong
  key → 401. The first push from the engine also got 401: the preview had been built before
  `MEDIADASH_KEY` landed in Netlify's env, so the branch was rebuilt (this commit) and the push
  repeated — result below.
- Preview 92 rebuilt with the key: the engine's push answered `38 KB, 14 thumb(s)`; GET then
  had 14 posts · 29 days · `pushedAt`; `?thumb=` → 200 image/jpeg 7649 B. The page in the
  in-app browser (1280 and 375 wide): Pull hidden, `pushed 0 min ago`, 14 rows with 14
  thumbnails loaded, 8 Up next cards, no horizontal scroll.
- Merged as `4f95289` (#92). **No production build started**: the squash message inherited
  `[skip ci]` from the docs commit on the branch. Triggered a build of `main` with
  `netlify api createSiteBuild` (06:54 UTC; not `netlify deploy --prod`, INVARIANT 9d3 —
  this is the platform building `main`, the same thing the merge should have done). Live
  ~60 s later, by content: `<title>MySet Signal</title>`, `/api/mediadash` 14 posts · 29
  days, thumb 200, boost-without-code 401. A push straight to production then answered ok.
- Not checked: a boost saved from the live page with the founder's code; the pull-back of a
  site-logged boost (ran against an empty list).

**Lesson for the next squash.** `gh pr merge --squash` without `--body` folds every branch
commit message into the squash body; one `[skip ci]` in there and Netlify builds nothing on
`main`. Pass `--body` (or keep `[skip ci]` off branch commits that ride with code).
