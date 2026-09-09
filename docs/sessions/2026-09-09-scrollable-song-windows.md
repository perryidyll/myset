# Scrollable song windows and profile management — 2026-09-09

## Outcome

- Audience and Studio queue/setlist areas are bounded internal scrollers with a mobile
  thumb lane, orange border and restrained animated edge glow.
- Up next is orange and larger; the audience vote allowance uses the green plan-pill
  treatment.
- Live voting, vote-pack and tip actions carry the requested orange pulse.
- Played songs remain accessible to the replay-rules flow when their replay minimum is
  greater than the fan's remaining free balance.
- Artist profiles can store and display an optional label/management company.
- Existing touch-action rules continue to disable double-tap zoom without blocking
  pinch zoom.

## Evidence

- `sh test/run.sh` — passed.
- `node tools/uicheck.mjs` — all browser assertions passed.
- `git diff --check` — passed.
- Netlify draft `6aa18cdbd7ecd9114d2c1aba` deployed after changing the orange window
  ring to a true border and clipping every row fully inside it.

## State

Uncommitted working-tree changes. Draft preview only; no production deployment or push.
