# Live lyrics, profile links and speed — 2026-09-10

## Outcome

- Added a live-stage Auto lyrics action beside My chart, using the existing cached
  LRCLIB pipeline and clearly labelling the result unofficial.
- Moved End the show below Up next with an orange outline; updated request copy/color.
- Fresh manual shows now use a calendar location only inside the one-hour pre-show
  window; otherwise the audience location stays blank.
- Label/management now requires a safe HTTPS URL and appears last among profile links.
- Made artist and venue section headings orange, halved perceived loading-overlay delay,
  and began clip metadata loading early so black-poster recovery can seek immediately.

## Evidence

- `sh test/run.sh` and `node tools/overview.mjs --tests`: 1,828 assertions, 0 failures.
- `node tools/uicheck.mjs`: rendered mobile UI checks pass.
- Draft `6aa259b458b6e7d6f0caf660` is ready and served-content checks passed.
- Production is unchanged pending visual approval.

## Deliberate limit

Automatic chord charts were not fabricated from song titles or lyrics. The current app
has no audio/chord-analysis source; a trustworthy version needs an audio-derived chord
recognition provider and must remain visibly labelled unofficial.

## Follow-up

- Setlist is now the Artist Studio entry tab, including explicit Studio links.
- The live action uses delegated button wiring and reads `☰ Lyrics`.
- Declined-request copy now promises both returned votes and no card charge.
- Recovered legacy clip stills are cached on-device and reused as immediate posters.
- Draft `6aa260d099a6924deb1e566d`; 1,831 assertions and rendered UI checks pass.

## Second follow-up

- Studio Lyrics now mirrors the audience's public lyrics reader exactly and has a
  rendered click-through regression check.
- My chart remains the artist-authored chart; Auto chords opens Chordify's automatic,
  recording-derived search without copying third-party charts into MySet.
- Confirmed upload-time posters are already generated before upload, persisted as a
  global image slot, returned on every feed, and served with immutable edge caching.
- Draft `6aa264546debb0eda5211e48`; 1,832 assertions and rendered UI checks pass.
- The remounted SSD mirror completed successfully.

## Root-cause follow-up

- The Now Playing card's decorative `::after` shine covered the controls and consumed
  physical pointer input. Programmatic `.click()` checks had concealed the defect.
- The shine now has `pointer-events:none`; the regression check uses `elementFromPoint`
  to prove the real tap target is the Lyrics button.
- Buttons are ordered Lyrics, Auto chords, My chart.
- Draft `6aa266f898a26e5617ab7f17` returned the real current Blackbird lyric payload
  (656 characters) and served the corrected hit-target CSS.
- Full gate: 1,832 assertions, zero failures; rendered UI gate passes.

## Chords, install prompt and media follow-up

- Auto chords now opens an Ultimate Guitar title search instead of Chordify. MySet does
  not scrape or republish third-party chord sheets; decision `0022` records the boundary
  and the licensed-feed or recording-analysis path to an aligned in-app chart.
- The install prompt's supporting line is orange and the whole prompt uses the same
  gentle orange pulse as the tip actions, with reduced-motion support.
- Artist covers, gallery images and avatars now request responsive Netlify Image CDN
  sizes and layer tiny low-resolution placeholders beneath the full image.
- Community clips now paint their upload-time, globally stored poster before requesting
  video metadata, so a slow video connection does not delay the thumbnail.
- On the real draft, the transformed cover returned in about 0.70 seconds at 23,418
  bytes; all three current community poster URLs returned in about 0.99–1.99 seconds.
- Draft `6aa26ced57a49b09eddb933e`; 1,834 assertions, zero failures; rendered UI and
  served-content checks pass. Production remains unchanged pending approval.
