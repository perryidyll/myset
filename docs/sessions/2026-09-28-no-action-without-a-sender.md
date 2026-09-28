# 2026-09-28 — No action without a sender

**Asked (the founder):** apply the no-zombie rule to `admin.mjs` and `venueadmin.mjs`: find every action no client sends, confirm each with grep, present the list, and remove only after a yes. Starting evidence: `showTime` (no sender, "the old placeholder") and `city` (sent only by `test/sheets.mjs`).

**Found.** Of 139 action names, eleven had no sender in any page: `showTime`, `city`, `askList`, `listAll`, `learnList`, `lyricsGet`, `chartFlags`, venueadmin's `verifyPreview`, `spotifyPeek`, `venuePlan` and `tagRemove`. The script's false positives were read by hand: senders built at runtime (`q('promoList')`, `askDo('askDone')`, `startSong('playTop')`, `vComm('postDelete')`), and names that appear only in the pages' own Set literals (`SAMPLE_READS`).

**The founder's answers.**

- The eight leftovers: yes, after a plainer explanation. That includes the always-empty `showTime` field end to end.
- `spotifyPeek` and `venuePlan`: remove.
- `tagRemove`: *add a delete button* rather than remove it.

**Built** (branch `chore/dead-admin-actions`, off origin/main `013c090`). Decision `0115`, INVARIANT 0hl (0q amended), ledger UX-063.

- **Removed.**
  - The ten actions, and their `CAPABILITY` / `PLAN_ACTIONS` / set entries.
  - The `chartFlags` import in `admin.mjs`, and `checkWebsite` in `venueadmin.mjs`.
  - `showTime` from `stage.mjs`, `_board.mjs`, `_history.mjs`, `_lib.mjs` and the mock.
  - `venuePlan` from the mock's founder list.
  - The `_venues.mjs` comment that leaned on `venuePlan`: it now says the read is the tick's gate, because `_billing.mjs` never cleared the flag either.
- **Added.** A ✕ on each of your own genres in the song sheet. It asks through `ask()`, calls `tagRemove`, and carries `data-ed="setlist"`, which `test/seatstudio.mjs` holds. It reuses a `.tgx` style nothing used.
- **Tests.**
  - e2e, request-payments, connect and limits read the stage poll, as the Studio does.
  - `test/sheets.mjs` sets `show.city` on the show record.
  - `test/verification.mjs` sets and lapses a venue's plan the way `_billing.mjs` does.
  - `test/structure.mjs` has the new check: every action either endpoint takes is quoted in `public/` outside a Set literal.
- **Docs.**
  - INVARIANTS 0q and 0hl.
  - The overview: the Setlist line, the env list, the §5 degrade line, and §8's Spotify gap. §8 had said the button was offered, and there never was one.
  - The sheets: onboarding/01 o04, marketing-and-growth/02 f03 and its sources, community-and-media/05 sources, and venue-lifecycle/02 sources.
  - The decisions README, and the ledger.
  - `docs/landing/` is a dated 2026-09-06 study with line numbers, so it was left as the record it is.

**Verified.**

- The new check against `main`'s files named nine of the ten removed actions and failed. It missed `city`, a common word that passes on any mention. Against this branch it passes (144 and 51 names). The restored files were checked with `shasum -c`.
- The first full run failed on a browser `confirm()` in the new ✕ (`test/darkroom.mjs`), which was fixed to use `ask()`. Then `node tools/overview.mjs --tests` exited 0 with 4,516 ✓.
- On `tools/localhost.mjs` at 375 px, the ✕ deleted a custom genre with the sheet still open. The stage poll agreed, and the console showed no errors.
- **Shipped** on the founder's word as `e043010` (PR #134, 08:05 UTC), after the preview drew `/studio` at 375 px. **Live:** `https://myset.vip/studio` serves `studio.js?v=1026ed88`, and that file holds `function delOwnTag`. Puzzle: o04 370015, f03 370183, the section 42003 notes, and changelog 2441.
