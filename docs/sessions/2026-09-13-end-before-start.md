# 2026-09-13 — The current song has to be ended before another can start (UX-042, decision 0063)

**Asked.** After the *Peaceful Easy Feeling* investigation the founder declined the
three soft fixes and set a rule: a song must be ended before any other can start.
*End current song* filled light red (the red of the artist page's ENTER NOW TO VOTE)
with red text; a small window when ▶ is tapped while a song is playing — *End
current song?* with a red *Yes, end it* and a pink-orange-bordered *Keep playing*.
Ship it.

**Built.** `public/studio.js`: `startSong(action, extra)` — every ▶ (*Start top
voted* and each *Up next* row) goes through it; if a song is playing (and it is
not the same song) it opens `#ask` and parks the action in `ASK_GO`; *Yes, end it*
runs that same `act('play'…)` / `act('playTop')` — the server already files the
playing song and starts the new one in one write, so nothing new on the server.
`public/studio.html`: `.liveactions .endnow` is `rgba(255,59,48,.14)` on `#FF3B30`
with a red hairline; `#ask` is a centred dialog (z 66, above the sheet's 65) with
`.big.yes` (#FF3B30, white) and `.big.keep` (surface, `--accent-2` text and ring).
A tap on the dim keeps playing. `node tools/stamp.mjs` → `93bb664e`.

**Verified.** `sh test/run.sh` exit 0, 2,318 ✓ — `test/darkroom.mjs` pins the gate
(no raw `act('play'`), the window's two buttons and the three colours.
`tools/uicheck.mjs` (worktree copy) 117 ✓ / 0 ✗ with four new assertions: the End
button's computed colours, ▶ during a song opens the window instead of starting,
*Yes* red and *Keep playing* pink-orange, *Keep playing* closes it with nothing
started. Headless `studio12.mjs`: `b12-endnow.png`, `b12-ask.png`.

**Not done.** No server-side refusal (option C in 0063) — it would break the
scheduled flows and eleven test files. The interpretation of "light red" is a 14%
tint of the true red; if the founder meant the solid red, it is one line.
