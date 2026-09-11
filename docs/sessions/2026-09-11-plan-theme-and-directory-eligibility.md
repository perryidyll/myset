# 2026-09-11 — Plan fee, theme default and directory eligibility

## Asked

- Show Signed only when an artist has supplied both a label name and its website.
- Change the $20/month artist plan's transaction fee to 2%.
- Make loading screens follow the active light/dark theme.
- Make light mode the first-visit default.

## Changed

- The directory requires both a sanitized label/management name and safe website before
  displaying Signed; explicit independent values remain excluded.
- The Pro artist plan now takes 2% in the shared plan table, direct-charge flow, Studio
  copy, finance model and payment documentation.
- First visits now start in light mode, while a stored light or dark choice is respected.
- Initial page paint, intro, boot and leave screens use the active theme rather than a
  hard-coded black background.

## Verified

- `test/artists.mjs`: 13 passed, 0 failed.
- `test/connect.mjs`: 54 passed, 0 failed.
- `test/copy.mjs`: 33 passed, 0 failed.
- `finance/model-test.mjs`: passed.
- `tools/uicheck.mjs`: first-visit light, saved dark, live theme switching, loaders and
  mobile layouts passed.
- Full suite and overview stamp: 1,876 assertions, 0 failures.

## Deployment state

The work is in the same uncommitted batch as the filtered event map. Draft
`6aa3b8e8eedd9a5d7e4e5391` serves the 2% copy and light-default theme asset; its map
config remains honestly disabled without a key. Nothing in this batch is in production.
