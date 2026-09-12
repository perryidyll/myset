# 2026-09-12 — Speed pass one: edge copies and "paint the last thing you saw"

Decision `0042`. Ledger row UX-011. Working tree only — not committed, not pushed.

## Why

The founder timed the site after decision 0038 and called it "manageable but
amateur" beside Airbnb. Production timings (curl, cold → warm TTFB, 2026-09-12):
HTML 0.86 → 0.63s; `/api/profile` 2.2 → 1.2s; `/api/events?days=90` 1.6 → 0.9s
and 44.7KB; `/api/board` 2.1 → 0.7s; `/api/me` 1.5 → 1.3s; `/api/community`
1.7 → 0.8s. The function calls are the wall: cold starts, then three to five
storage reads in a row inside each handler. The artist, venue and community pages
sat behind the logo screen until the first read landed.

The founder agreed to two passes: the cheap four first, a phone check, then the
riskier merge of the fan reads into one warm function only if still needed.

## What changed, for a person

- Open any artist, venue or community page you have seen before: it is drawn at
  once from the copy your phone kept, and quietly redrawn only if something
  changed. No logo screen, no wait.
- First visit to one of those pages: the page's frame appears with grey
  shimmering blocks where the photo, name, button and numbers go — instead of the
  logo screen — until the answer arrives.
- A busy artist page: everyone opening it in the same 15 seconds shares one server
  run (`/api/profile`); the diary and a venue's page share one per 30 seconds; the
  front door's city feed and picker one per minute. First opens of a popular page
  should fall from ~2s toward the edge's ~0.3s once the copy is warm.
- The artist's diary answer is now ~13KB instead of 44KB (24 nights, not 60); the
  vote page asks for 2.
- The artist still sees their own profile save instantly in the Studio (`?t=`).

## What was deliberately NOT done

- `/api/community` is not edge-cached: its reply carries the asking phone's likes
  and `canPost`. It gets the last-seen paint only.
- The vote page keeps its skeletons and does not paint a stale board (live
  tallies and the "have I voted" state should not come from yesterday).
- No browser or phone check, to save credits. The founder taps artist → vote →
  community after the push.

## Files

`netlify/functions/_lib.mjs` (`jsonCached`), `profile.mjs`, `events.mjs`
(`n=`, cached), `venue.mjs`; `public/leave.js` (`window.lastSeen`),
`artist.html`, `venue.html`, `community.html`, `vote.html` (`n=2`),
`studio.html` (`?t=`). Decision `0042`; overview regenerated.

## Verified

`sh test/run.sh`: 44 files, 2116 assertions, 0 failed. `node --check` on every
touched function and every inline script of the five pages.

## Also in the tree, not this session's

Another session's `public/app.css`, `public/lock.css`, `tools/backup.py`,
`docs/processes/*` and puzzle-mapping session notes — left untouched.

## Next

Founder's phone check after the push → pass two: storage reads side by side
inside profile/events/venue/community (medium), and the one-warm-door merge
(decision 0042 option B) only if the first tap is still slow. The open line
(P3-002) starts on the founder's word.
