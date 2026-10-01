# 2026-09-29 — A discarded real night counts after one warning

**Asked:** confirm that a discarded show never counts against the ten free shows (so
testing "Start the show" costs nothing), and set up "a robust monitoring system" so the
discard can't be used for unlimited free shows. The user's shape: warn an artist who
discards a show over an hour with 5+ votes that such shows will count from now on. At
the merge: only those two conditions; money is not a trigger.

**Shipped:** decision 0122, INVARIANT 9d9 extended. `discardVerdict`, `nightVotes`,
`nightPaid` and `REAL_NIGHT` in `_lifecycle.mjs`; `endShow` answers 409 with a
`confirm` on a real night and needs `ack` to match; `show.discardWarnedAt`;
`meta.discards` (last 30); the Sheet's Discards tab; the Studio's two questions ("This
looks like a real show", then "This one will count"). The artist's-night process sheet
(a04, a19) and the data model row 46035. Live as `413d116` (PR #162).

**Verified:** suite 4,686/0; `test/limits.mjs` 170 ✓. Localhost at 375 px: the warning
renders and tapping through gives a test night back (0/10). Deploy preview and
production serve `studio.js?v=515988b6` carrying the warning.

**Not checked:** a real night's discard on production (it needs an hour and five
votes); the Discards tab on the live Sheet until the next sync writes a row.

**Learned:** a counted discard must clear `freeNight`, or the same ended night can be
discarded again and asks a second time.
