# Profile CTA and Settings simplification

The user asked to remove the voting sheet's manual-refresh bullet, review draft pull
request 3, simplify the artist Studio's Settings tab, and ship the complete verified
batch to production.

## Review finding

The pull request made the two requested profile changes, but it also replaced safe HTML
entity escaping for ampersands, angle brackets and quotes with the raw characters. That
unrelated change was not accepted. The cover-pill removal and new primary CTA copy were
applied manually on top of `main`, retaining the safe `esc()` implementation.

## What changed

- The voting confirmation sheet no longer shows the pull-to-refresh instruction.
- A live artist profile has one route to voting: its primary **TAP TO VOTE THE SETLIST**
  button. The duplicate cover-photo pill and its dead styles are gone.
- Settings no longer contains Tonight's gig, its duplicate Voting explanation, or the
  New show reset section. The old `saveGig()` function was removed with its inputs.
- Starting by itself now sits directly beneath Requests from fans. The operational
  controls remain in their canonical Live and Gigs/calendar surfaces.

## Evidence

- `sh test/run.sh`: full suite passed.
- `node tools/overview.mjs --tests`: 1,737 assertions, 0 failures.
- `node tools/uicheck.mjs`: phone-width vote, profile and Settings checks all passed.
- `git diff --check`: clean.
- Draft `6aa04e5930bf024ac5cfb479`: served the new CTA and section order; the retired copy
  was absent. A read-only show request still returned 3/3 free votes and the default
  3/$5 and 15/$20 packs.

The user explicitly authorized one push to `main` after these gates. That push is the
only production deployment action; no separate production CLI deploy is used.
