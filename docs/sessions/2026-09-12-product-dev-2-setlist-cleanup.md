# Product Dev 2 — setlist cleanup

## Changed

- Add a song and Import songs now sit side by side, above an orange-outlined “Organize your songs into setlists” button.
- See what fans see follows Want to learn; Clear setlist is the final page control.
- The starter-pack UI, server action, bundled songs, test dependency, and landing-page claim were retired.
- Refund actions are Live-only. Inactive Studio payloads receive no stale vote, voter, room, or network totals; the ended-night state remains recoverable through “Resume it instead” until a true new show begins.
- The first-Settings verification notice is centered.

## Evidence

- `sh test/run.sh`: passed.
- Batch-specific rendered checks passed.
- Production push requested after preview `6aa4ddc1e0cb0e8daff06a56`.
