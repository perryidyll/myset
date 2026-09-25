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
