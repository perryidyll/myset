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

## Deployment state

Draft `6aa3bcce9fd9709b3a45eb9c` serves the updated Studio and a directory payload
containing only the qualifying profile. Map configuration remains safely disabled until
its restricted browser key exists. The combined batch is uncommitted; production is
unchanged.
