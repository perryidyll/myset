---
id: 0115
title: Every action a Studio endpoint takes is one a page sends
date: 2026-09-28
status: decided
decided_by: user-confirmed
area: general
reverses:
superseded_by:
invariants: [0hl, 0q]
commits: [e043010]
tests: [test/structure.mjs, test/seatstudio.mjs, test/e2e.mjs, test/request-payments.mjs, test/connect.mjs, test/limits.mjs, test/sheets.mjs, test/verification.mjs, test/accounts.mjs]
files: [netlify/functions/admin.mjs, netlify/functions/venueadmin.mjs, netlify/functions/stage.mjs, netlify/functions/_board.mjs, netlify/functions/_history.mjs, netlify/functions/_lib.mjs, netlify/functions/_venues.mjs, public/studio.js, public/studio.html, tools/mock.mjs, test/structure.mjs]
---

## The question

The founder's standing rule since 2026-09-28 is no redundancy and no zombie infrastructure anywhere in the code. While shipping 0104/0105, two actions in `admin.mjs` turned out to have no sender: `showTime`, which nothing sent and whose field `artist.html` called "the old placeholder", and `city`, sent only by a test. So both Studio endpoints were swept. The sweep listed every action name `admin.mjs` (with `_messages.mjs` and `_diary.mjs`, which it hands actions to) and `venueadmin.mjs` branch on, then searched `public/`, `tools/`, the other functions and the tests for a sender of each.

Of the 139 names, 128 had a sender in a page. Eleven had none:

- **`showTime`**: the show-time box, replaced by the calendar. Its field was still copied onto the stage, board and history payloads, and nothing displayed it.
- **`city`**: autoStart copies the gig's city from the calendar. Only this way of typing it had no sender.
- **`askList`, `listAll`, `learnList`**: the Studio reads requests, setlists and the to-learn list from its stage poll (`stage.mjs`). Only tests used these.
- **`lyricsGet`**: `songGet` already returns the words.
- **`chartFlags`**: the Google Sheet export calls the helper directly.
- **`verifyPreview`** (in venueadmin.mjs): a website-check preview no page offered.
- **`spotifyPeek`**: the server half of a Spotify playlist import. It had no button, and its keys were never set. The overview's §8 wrongly said the button was offered.
- **`venuePlan`**: a founder tool for hand-setting a venue's plan, reachable only by a crafted request. Venues now pay through their own Studio's checkout (`_billing.mjs`).
- **`tagRemove`**: artists could add their own genres, but no page let them delete one.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Remove the ten dead actions (and the always-empty `showTime` field), give `tagRemove` the ✕ it lacked, and fail the build when a Studio endpoint takes a name no page sends | A few test rewrites onto the stage poll | One structure check | A founder by-hand tool is gone; it comes back with a page if it is ever needed |
| B | Remove only the dead write paths (`showTime`, `city`) named in the starting evidence | Nothing | None | Nine more zombies stay, and the next ones pile up the same way |
| C | Keep the half-features (Spotify import, the venue plan setter) parked for later | Nothing now | None | They read as features that exist: §8 already claimed a Spotify button that never existed |
| D — do nothing | — | — | — | The rule is broken where everyone can see it |

## What was chosen, and why

A. The founder said yes to each item on 2026-09-28: the eight leftovers, removing Spotify import and the venue plan setter, and adding a delete button for custom genres instead of removing `tagRemove`.

- **Nothing a person sees changes,** except the new ✕. Each removed read had a live twin: the stage poll (`asks`, `lists`, `learn`), `songGet` (lyrics), or the export's direct call (`chartFlags`). The tests that used the old reads now read the stage poll, as the Studio does.
- **`show.city` stays.** It is set by autoStart and read by the board, history and stage. Only the dead way of typing it went. `test/sheets.mjs` now sets it the way a real night does, on the show record.
- **`showTime` goes end to end.** The action, the empty default in `_lib.mjs`, and the copies in `stage.mjs`, `_board.mjs`, `_history.mjs` and the mock. Old show documents that still hold the key are harmless, because nothing reads it. INVARIANT 0q now says the placeholder is gone.
- **The venue tick.** `venuePlan` cleared a venue's stored `verified` flag when it set the plan to free. `_billing.mjs`, the path a venue actually downgrades through, never did. The gate that holds is `shapeVenue`'s read (the tick shows only on a paid plan), and its comment now says so. `test/verification.mjs` sets and lapses the plan the way billing does.
- **Custom genres get their ✕.** In the song sheet, each of your own genres carries a small ✕ button beside it (it reuses a `.tgx` style that nothing used). It asks first, because deleting a genre takes it off every song. It carries `data-ed="setlist"`, so a seat that cannot edit the Setlist never sees it, and `test/seatstudio.mjs` holds that.
- **INVARIANT 0hl, the tripwire.** `test/structure.mjs` fails when a name either endpoint branches on does not appear, quoted, in `public/` outside a Set literal. Run against `main` before this change, it named nine of the ten: every one but `city`.

## What this makes harder

- **A feature is built with both halves or not at all.** A server action written ahead of its button fails the build. It waits on a branch, which is the point.
- **The check is textual.** A common word (`status`, `venue`, `city`) passes on any mention in a page. It would not have caught `city`. A founder tool with no page cannot live in these endpoints; if one is ever needed, it gets a page (the founder's console is `/factory`, HQ is `/hq`).
- **Setting a venue's plan by hand** is gone. A comp for a venue goes through a promo code, or the tool comes back with a page.

## What would reverse it

A server-to-server caller of a Studio endpoint, such as a scheduled job posting an action. The check would then need a list of internal senders, not a removal.

## How it was verified

- **The sweep.** A script listed every name each endpoint branches on and every file that quotes it. Each of the eleven was then read by hand, including senders built at runtime (`q('promoList')`, `askDo('askDone')`, `startSong('playTop')`, `vComm('postDelete')`) and names that appear only in the pages' own Set literals (`SAMPLE_READS`).
- **The tripwire.** Against `main`'s `admin.mjs` and `venueadmin.mjs`, `test/structure.mjs` printed `no sender: venuePlan, chartFlags, listAll, learnList, askList, lyricsGet, spotifyPeek, showTime` and `no sender: verifyPreview`, and failed. After the change it prints `every action admin.mjs takes is sent by a page (144)` and `(51)` for venueadmin.mjs. The files were restored and checked with `shasum -c`.
- **The rewritten tests:** e2e 71, request-payments 35, connect 69, limits 112, sheets 206, verification 57, accounts 234, seatstudio 90, all with 0 failed.
- **The whole suite.** `node tools/overview.mjs --tests` exited 0 with 4,516 ✓. The first run caught a browser `confirm()` in the new ✕ (`test/darkroom.mjs`); it now asks through the Studio's own `ask()`.
- **In a browser, on `tools/localhost.mjs` at 375 px.** A custom genre drew its ✕. Tapping it opened *Delete “Surf Rock”?*, and *Yes, delete it* removed the chip with the song sheet still open. The stage poll's `tags.own` came back empty, and the console showed no errors.
- **Live.** Merged as `e043010` (PR #134). `https://myset.vip/studio` serves `studio.js?v=1026ed88`, which holds `delOwnTag`.
