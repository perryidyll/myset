# 2026-10-09 — No markup in a short field (scale audit leftovers)

**Asked:** the founder, 2026-10-09: do every audit item that needs no answer from him. The audit's critical *Any artist can plant script on their own public page* was half done: #204 escaped the management name on the page; *strip angle brackets when the profile is saved* was not built.

**Built (branch `fix/no-markup-in-profiles`, decision 0203, INVARIANT 0jf, ledger SCL-026):** the short-field cleaner in six files (artist profile, venues via `_maps`, requests, reviews, diary, shop wishes) takes out `<` and `>`. Long text untouched and escaped where drawn.

**Verified:** `test/nomarkup.mjs` 17 ✓; three knock-outs red. Read: `artist.html` escapes the bio and management; `aboutLines` escapes.

**Left for the founder (desk):** the Show-log door's guess limit (*Three doors can be guessed without limit*): a longer lockout per round of wrong guesses would also let a stranger keep him out of his own CRM for longer, so it is his call, not built.
