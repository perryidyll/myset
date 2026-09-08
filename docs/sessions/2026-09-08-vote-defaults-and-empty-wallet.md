# Vote defaults and the empty-wallet path

2026-09-08. The user asked for four connected audience changes: three free votes by
default; a “Buy more votes” action inside the voting sheet when the fan is out; the
word “votes” after the header's free-vote `x/x` counter; and default packs of three
votes for $5 and fifteen votes for $20.

## What changed

- `DEFAULT_FREE_CREDITS` is now 3 and is the single source used by new shows, legacy
  fallback, and the generated master overview.
- `DEFAULT_PACKS()` now returns 3/$5 and 15/$20. Artist-set prices remain authoritative.
- `/api/show` now gives the page separate `freeRemaining` and `freeTotal` values, so
  the header describes the free allowance while the combined wallet still includes
  bought votes.
- A fan with zero spendable votes can open a song's voting sheet when payments are
  available. The sheet replaces the unusable stepper and Confirm action with “Buy
  more votes”. With payments unavailable, the dead-end song button stays disabled.
- The master overview and decision index were regenerated. Decision `0014` records
  the commercial and UI choice.

## Verification

- `sh test/run.sh` — 1,721 assertions, 0 failures.
- `node tools/uicheck.mjs` — all phone-width checks passed, including `3/3 votes`,
  opening a song with an empty wallet, and the rendered “Buy more votes” action.
- `node tools/overview.mjs --check` — current.
- `git diff --check` — clean.

## Internal preview

Netlify draft deploy `6aa03c5c4e14a64f2722db68` is live at
`https://6aa03c5c4e14a64f2722db68--mysetvip.netlify.app`. A content fetch of
`/vote.html` found the new `x/x votes` rendering, “Buy more votes” action, and
3/$5 plus 15/$20 fallback packs. This is a visual-inspection preview only because
deploy previews share production data.

Nothing was committed, pushed, deployed to production, or written through a preview.
