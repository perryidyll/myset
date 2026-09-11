# 2026-09-11 — Verified directory and plans cleanup

## Asked

- Keep every $20/month artist-plan fee reference aligned at 2%.
- Show only verified artists in Find artists cards, the day-by-day event list and map.
- State that discovery requirement in Settings → Get verified.
- Show the requested verification notice on the first Settings visit.
- Remove placeholder testimonials from the plans popup.

## Changed

- `/api/artists` now admits only accounts with both the verification flag and a
  currently effective Plus or Pro plan, before any directory records are read.
- The Get verified card names all three discovery surfaces affected by verification.
- A dark, one-time, per-artist Settings sheet uses the requested white/orange/white
  hierarchy and takes the artist directly back to the verification steps.
- Placeholder testimonial data, rendering and styling were removed from the plans sheet.
- The superseded 2.5% pricing decision is now linked to the current 2% decision.

## Verification

- `test/artists.mjs`: 15 passed, 0 failed.
- `test/copy.mjs`: 37 passed, 0 failed.
- `tools/uicheck.mjs`: verified-only notice, exact copy, colors, one-time persistence,
  plan copy and the existing mobile interface all passed.
- Full suite and overview stamp: 1,882 assertions, 0 failures.

## Production release

The complete combined batch shipped in production commit `d1a6531` on 2026-09-11.
Netlify completed successfully and `myset.vip` returned HTTP 200. Google billing uses
the confirmed US profile; Maps Static API is enabled; the browser key is restricted to
MySet production/previews and Static Maps only; and the secret is configured in Netlify
production, deploy-preview and branch-deploy contexts. The live config endpoint reports
enabled and a referrer-valid production request returned a 50,325-byte PNG.
