# 2026-09-12 — the first batch from the Airbnb design dive

Context: an Airbnb × MySet design comparison was published as a report the same
day (thirty graded integration points). The user picked the first batch and set two
things straight about the rules. Codex was working in the same checkout at the
same time (the composer fold, ten shows, faster pages); its files were built on,
not over, using exact-match edits only.

## The two rules, demoted

- **"A vote never comes back"** was never meant as a hard rule, and votes do go
  back when the artist declines a song or a request. Removed from AGENTS.md's
  ranking rules and VISION.md is untouched (it never listed it); INVARIANTS 14 /
  14b and the overview's §1.1 now say "today's behaviour, not a hard rule" and
  keep the history. The tests that pin the current behaviour (`votesstay.mjs`)
  still run — they pin what the code does, not a promise.
- **"Anything the room experiences is free"** — too strong for something
  unimportant and subject to change. Removed from VISION.md's philosophy;
  INVARIANT 0w and overview §2.8 demoted the same way.

## What changed on the pages

| Ask | Where | What |
|---|---|---|
| Leave the scroll-inside-scroll | `vote.html` | Left alone. It is deliberate: a 500-song list must keep the search and filters a short swipe away. The report's I-10 is withdrawn. |
| Studio tab bar | `studio.html` | Merch tab folded into Profile: `merchSection()` (items, lock, orders) sits under **Videos & music**, **Save profile** below it. Six tabs; `padding:8px` under 390px so nothing clips at 375. A phone that remembered `merch` lands on Profile. |
| Empty front door | `index.html` | With nothing remembered, geolocation → `/api/artists` → nearest gig with coordinates within 300 km → its city fills the pickers and the feed runs, headed "Near you · City · the closest listed gig is N km away". The guessed city is not remembered. Pickers and both buttons stay. |
| The feed search field | `index.html` | 18px side margins like every card; pill; the 1.5px orange ring "View on map" has; the doubled border (app.css ring + its own) is gone. Only refocuses while somebody is typing. |
| Artist page countdown | `artist.html` | "Live in 1d 16h 20m **(view setlist)**" — it is a link and now says so. |
| Vote page between shows | `vote.html`, `_board.mjs`, `events.mjs` | Board carries `endedAt` while ended. Within three hours of the end: "That's all — see you next time" (no "Tonight" label) + say-something link. Otherwise, and before a show starts: a **Next show** card counting down to the calendar's next gig with day, time and venue. **Up next** is drawn only while live. Header sub-line says "Between shows" when it is. `?a=` (empty) means the founding page's diary, as `publicArtist` already reads it. Decision 0038. |
| Community composer | — | Already folded by Codex in this tree; nothing to do. |
| Sign-in | `studio.html` | Email + **Email me a code** + a **Got a code already?** box (6 digits, same address, any device) + **Sign in with my code**. The page-name + Studio-code form is off the screen, behind a small "Studio code" link, so the Settings card that sets one still has a door. |
| Light mode default, choice global | `theme.js` | Every page already defaulted to light. The back-button revert was the back-forward cache restoring the page as it was left; `theme.js` now re-applies the stored choice on `pageshow`, `storage` and `visibilitychange`. |

## Verified

- `sh test/run.sh` three times during the work; the last run **2,110 ✓, 0 ✗, exit 0**
  (`test/syntax.mjs`, `split`, `cost`, `darkroom`, `copy`, `studiocode` among them).
  The very first baseline run, before any edit, stopped at one failure in the
  tagAuto suite ("it filled something", filled 0); it did not recur in three later
  runs and none of the changed files are near it.
- A scratch puppeteer script (not in the repo) at 375×812 with faked API answers:
  the front door picked Koh Phangan from a position 6 km away with nothing
  remembered, the field's left edge measured 18px with a 1.5px ring and no border;
  the vote page rendered all three states (ended long ago → countdown with "Sun,
  Sep 13 · 6:30pm · Sand & Tan"; ended 10 min ago → wrap-up; pre → countdown), none
  with an Up next box; the sign-in screen read as intended; the Studio strip held
  six tabs with **0px overflow** and the Profile tab's section order measured
  Videos (y 2370) → Your merch (2596) → Save profile (3029); a simulated bfcache
  `pageshow` with `dark` stored flipped the page to dark.
- `node tools/uicheck.mjs`: 104 ✓, one ✗ ("the popup sends the exact coordinate to
  a labeled static-map pin") — the interactive map in the other session's working
  tree, not touched here; not checked against baseline because stashing would
  have disturbed that session.
- A fresh-context review found eight things; five were fixed (the Studio-code
  door, the countdown tick dying on the wrap-up card, the feed field losing focus
  on clear, the near-me comment overstating who is listed, late replies
  repainting over a Profile field), one was documentation (§3.3), one is the
  placement the user asked for, one is trivial (a repeated End re-stamps the
  three-hour window).

## Not checked

- The three-hour boundary and the countdown on the real site — the founder's page
  is the only live account and its show state is whatever the last gig left it.
- Geolocation on a real iPhone (Safari's prompt on load; a denied permission
  simply leaves the form as it was).
- The theme fix against a real back-button on iOS Safari (bfcache); the fix is
  the standard `pageshow` re-apply and was exercised with a synthetic event only.

## Open, for the user

- Deploy: nothing was committed or pushed. Codex's work is in the same tree.
- `/api/artists` on the front door reads every listed artist's profile and
  calendar once per first visit. Fine now; a per-city coordinate in the city
  index would make it one read. Logged as P3-015.
- The report's remaining integration points (I-01 partly done here) are in the
  published artifact.
