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
  served-content checks pass.
- Approved and shipped to production in commit `b70c54e`. The live Studio, install
  prompt, responsive profile imagery and clip poster behavior were verified by served
  content, and the read-only production health scan completed successfully.

## Lyrics wrapping and direct chord-page follow-up

- Audience and Studio lyrics now preserve line breaks but wrap long lines and even
  unbroken text inside the sheet; neither view offers horizontal lyric scrolling.
- Auto chords reads only Ultimate Guitar search-result metadata, requires an exact
  normalized title-and-artist match, and opens the first ranked Chords page directly.
  It never fetches or displays the chart itself and falls back to filtered search when
  it cannot prove the match.
- A synchronous holding tab keeps the action inside the original tap on iOS, avoiding
  the result-list click that was losing the destination during the App Store handoff.
- The live resolver selected the direct Beatles “Blackbird” Chords URL. The rendered
  390px test proved a deliberately long lyric token stays exactly within its 350px
  pane.
- Draft `6aa27e1d472d4a69917ecba2`; 1,839 assertions, zero failures; rendered UI and
  served-content checks pass. Production remains at `b70c54e` pending approval.

## Scrollbar and public theme follow-up

- Studio queue and setlist scrollers now sit inside separate rounded, orange shells.
  The shell clips the native scrollbar while its own glow can still fade outside the
  frame, preventing the thumb from painting across either curved border.
- Restored the fan-side light/dark switch on the home page. Its choice is stored once
  and applied before paint to the home, artist, community, voting, venue and About
  pages. Both Studios remain deliberately dark for live stage use.
- The 320px rendered check proves the new theme button plus both Studio links fit the
  header; the palette changed from black to `#F5F5F7`, and the choice persisted.
- A Spanish proof of concept would be fast, but a complete first language is a medium
  localization pass: centralize public and Studio copy, dynamic labels, errors and
  payment/show states, then verify narrow layouts. Do not ship a partial language
  switch that drops back to English during the core live flow.
- Draft `6aa282fa7e7eb20c5ff29805`; 1,841 assertions, zero failures; rendered UI and
  served-content checks pass. Production remains at `b70c54e` pending approval.

## Global theme, artist discovery and Featured shows follow-up

- A single persisted light/dark choice now controls every public page plus both Studios;
  the controls are present in each real page header and the Studio palettes are no longer
  hard-wired dark. The Artist Studio's Live tab label is red in either theme.
- Home now links to `/artists`, a public directory with text, country, city,
  upcoming-show and released-music filters. Country/city come from upcoming public gigs;
  no private account location is invented or exposed. “Music released” follows public
  streaming links or linked label/management attribution.
- The requested $10 Featured shows flow was already fully implemented: three
  first-come spots per city/night, a twenty-minute pre-checkout hold, idempotent
  settlement and automatic refund if a late payment loses the race. Its Studio section
  is now named explicitly “Featured shows.”
- Full gate: 1,852 assertions, zero failures. Rendered checks prove the Studio theme
  changes the full palette and the directory filters fit at 320px. Draft
  `6aa2a605960074ede64f0f3a` served every changed page and the no-cache directory API;
  production remains at `b70c54e` pending approval.

## Gig-level featuring and signup-email audit

- Every active Coming up gig now has Feature immediately before Edit and cancel. The
  same fixed-price checkout is reused and the sheet can open scoped to that occurrence.
- The Promote a gig explanation is now larger orange copy in three bullet points.
- Featured-show bidding is explicitly deferred until real fixed-price inventory fills.
- Artist and venue signup shared a silent failure: both ignored Resend rejection and
  production fell back to the `resend.dev` test sender, which can mail only the Resend
  account owner. Both doors now require an explicit verified sender, check delivery, and
  return an honest temporary error on rejection. Address changes use the same rule.
- Production has a Resend key and a public MySet DKIM record but no `AUTH_FROM`; operator
  confirmation in Resend plus that Netlify variable is still required before unfamiliar
  inboxes can receive codes. No live signup write was used during the audit.
- Full gate: 1,863 assertions, zero failures; rendered checks verify the three gig actions
  at 320px and the scoped orange-bullet sheet. Draft `6aa2af9b3a81cc0488b757c9`
  serves the complete batch; production remains at `b70c54e`.
- Local handoff files were refreshed. The SSD mirror was attempted and stopped safely
  because the drive is not mounted; rerun it after reconnecting the drive.
