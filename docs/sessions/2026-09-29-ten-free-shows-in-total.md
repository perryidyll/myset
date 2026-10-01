# 2026-09-29 — Ten free shows in total

**Asked:** fix the six page-vs-code contradictions listed in decision 0119, words only.
Mid-task, the user asked for the code to match the plan cards instead: "10 shows for
free" means ten in total, ever, not counting a discarded show, with an x/10 counter by
the Hobbyist badge; auto start/stop stays on every plan but is only advertised on Bar
Star; the venue tick is Pro only. At the merge: "don't count auto-started shows with
no votes".

**Shipped:** decision 0120 (reverses 0037), INVARIANT 9d9. `countGig`/`uncountGig`/
`quietAutoNight` in `_lifecycle.mjs`; `gigMonth` and `gigMonthOf` gone, migrated in
`normShow`; the Studio's "Hobbyist · x/10" chip (becomes Upgrade at ten) and Settings
line; the Free venue card; About's payout line; the request-switch copy; the founder's
note; `VERIFYING-A-VENUE.md`, the merch sheet, the overview. Live as `9adf0be` (PR #158).

**Verified:** suite 4,657/0 on the tree merged with main (decision 0121 landed first;
only the push log and the decisions index conflicted). Localhost at 375 px: the chip
fits beside the name, reads 0/10 then 1/10; Settings says "1 of your 10 free shows
used". Production: deploy ready 12:57 UTC; `studio.js?v=3edaa519` carries the counter,
About carries the weekly-payout line. Puzzle: merch sheet notes updated, changelog 2533.

**Not checked:** the quiet-calendar-night give-back on production (suite only); a real
iPhone.

**Learned:** two chips beside the artist's name overflow at 375 px, so the counter and
the Upgrade button are one chip that changes at the cap.
