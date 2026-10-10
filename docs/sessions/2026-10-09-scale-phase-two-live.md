# 2026-10-09 — Scale audit phase two on production

**Asked:** the founder, 2026-10-09: "keep going until the whole chain is merged, and continue with all the items you can". The week-one session merged all fifteen audit PRs, one at a time, on the founder's word; this session restacked its own (#238 twice, #240 once), recorded each merge, and built the leftovers.

**Live (Netlify published_deploy, UTC):** #218 `a202836` 07:36 · #219 `7a27f36` 07:43 · #226 `821a7bc` 07:50 · #231 `b4ac330` 07:56 · #232 `3111e4c` 08:03 · #233 `20be08a` 08:14 · #237 `2969e5c` 08:20 · #238 `623f6ce` 09:11 · #240 `970ddfe` 09:30. Four desk questions shipped at the recommended answer because the founder had not picked: the device cap (200), the tenth-show same-night resume, dated backups (90 days), refunds take back unspent votes only and merch short of stock is refunded automatically. Each card says how to change it.

**Stripe:** the founder signed in to the dashboard in his Chrome; the five events (`charge.refunded`, `charge.dispute.created`, `.closed`, `.funds_withdrawn`, `checkout.session.expired`) were added to both destinations at 08:20 UTC, before #238 merged, because `webhook.mjs` answers 200 to a type it does not handle.

**Restacks:** #238 conflicted with 0153 in `_history.mjs` (the resume marker vs `lostOf`), `test/stripe-fake.mjs` (paging vs the payment-intent filter) and money/02, where week one's live w12/w13 already existed: refunds became w14, expired checkouts w15. `mhold` joined the FAMILIES owner regex and both key lists. #240: imports only, and `_warehouse` now counts archived packs net too.

**Puzzle:** step notes for every sheet row these PRs changed were reloaded from main's sheets and linked to their changelog entries (2691–2693, 2713–2731 completed); w14 and w15 were created with their arrows; the sample pages section's notes now cite 0176.

**Numbers:** #150 (security slice C) merged at 08:40 UTC holding decisions 0199/0200 and INVARIANTS 0jb/0jc over two sessions' board claims; this session moved to 0201–0206 / 0jd–0ji and the board says so.

**Leftovers built (open, waiting on the founder's own merge word — desk card):** #258 (0201), #259 (0202), #260 (0203), #261 (0204). Left on purpose: the Show-log door (the founder's call, desk card), the register fold per month, more fan files, the stage summary, the hot show record, the sign-in door locks (security area), fork previews (deploy-retention card).

**This PR:** docs only — the ledger rows live, phase two's SCL-001…007 renumbered SCL-017…023, every decision's `commits:`, and the #238 sheets' and ACCOUNTING's stale "proposed".
