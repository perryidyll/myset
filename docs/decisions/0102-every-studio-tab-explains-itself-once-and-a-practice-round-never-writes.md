---
id: 0102
title: Every Studio tab explains itself once in a one-sentence-a-slide deck, and a practice round runs a pretend night that never writes
date: 2026-09-28
status: decided
decided_by: user-confirmed
area: ui
reverses:
superseded_by:
invariants: [0gn]
commits: [c940a6e]
tests: [test/tipdecks.mjs, test/copy.mjs]
files: [public/tips.js, public/studio.js, public/studio.html, public/venue-studio.js, public/venue-studio.html, public/lock.css, public/sample.js, tools/stamp.mjs, netlify.toml]
---

## The question

Neither Studio said what any tab was for. The founder asked for "pop-ups on each page/tab that explain concisely and with slight excitement what it is and how to use it — maybe a carousel, one sentence each, small animations, arrows", first for sample pages, then (2026-09-28, after seeing the draft in the blueprint): "I want this for every page/tab, and it definitely needs to be added to the tour when anyone first signs up and enters their Studio, artist and venue." And, for samples especially, a practice round: "upload like 30 of the most typical bar songs and animate them getting votes, money coming in with the confetti animation from bought votes and tips, and let them tap Start song — with a clear tip deck explaining each core feature before they tap it."

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One shared carousel (`/tips.js`, stamped and immutable like `studio.js`) with every deck's words in it; the Studios decide when a deck plays. A practice round built on this phone as a stage payload and drawn by the Live tab's own `render()`. | ~500 lines of client code; one small script both Studios load. | `tips.js`; a `PRACTICE` state in `studio.js`. | A deck at the wrong moment interrupts; a practice round that leaked a write would touch a real show — held by the tests. |
| B | Coach marks pointing at individual controls. | Fragile against every layout change; unreadable on a phone. | A positioning engine. | Marks pointing at nothing after a redesign. |
| C | A practice round against the real server (a practice show). | A second kind of show in every money and history path. | Server state. | A practice night filed as a real one, or money shown that was never paid. |
| D — do nothing | — | — | — | New artists meet a Studio that explains nothing. |

## What was chosen, and why

A. A deck is a centred card: an animated picture in the brand's colours, one sentence, arrows, dots, a swipe, Esc, and a Skip on the longer ones; the last slide can carry an action ("Try a practice round"). The words keep rules the test holds: one sentence a slide (the founder's "1 sentence each"), short, four slides at most for a tab, and a paid feature names its plan so a free account is never shown a door it cannot open (0bx).

When: a tab's deck plays once per account per phone, the first time the tab opens, for a new account (the flag a signup, a first-run or a claim sets, or no night on file yet) and for a sample; an established artist is never interrupted and has the ? beside the theme switch, which plays the current tab's deck any time. The first-run's end plays a three-slide "Your Studio" deck whose last button starts a practice round — that is the tour.

The practice round never writes because it cannot: `act()`, `askDo()` and `load()` hand over to it first, its code never calls the API, it will not start over a real show, and leaving the Live tab ends it. It builds a stage payload on the phone (the shape `stage.mjs` returns) from thirty songs every bar knows, and the Live tab's own `render()` draws it — so the artist practises on the real screen with the real buttons. A pretend room votes (five favourites lead, the way a real night's list moves), tips and buys a vote pack now and then (the real tip burst, chime and confetti, labelled "Practice"), and asks for a song. A coach walks the core moves: Start the top song, End current song, End the show — each with its deck first, then its button breathing until it is tapped — and the night ends on a summary ("That's a set!") whose button is Claim your page on a sample and Add your first gig on a new account.

## What this makes harder

Every new tab or renamed feature needs its deck and the test's list updated. The practice round is a second consumer of the stage payload's shape: a field the Live tab starts to need must be given a pretend value in `practiceState()`.

## What would reverse it

Artists skipping every deck (then fewer, later ones), or asking for them back (then a Settings switch); a Live tab redesign (the practice round follows `render()` for free, but the coach's selectors do not).

## How it was verified

`node test/tipdecks.mjs` — 92 checks: every artist and venue tab has a deck, every deck the code asks for exists, every slide one short sentence with a picture that exists, plans named, the practice round's hand-overs in `act`/`askDo`/`load`, no API call in its code, thirty songs, no start over a real show, the Studio's read list equal to the server's `SAMPLE_OK`, the banner's words and one-line style. Walked in a browser (localhost, 375 px): the Live deck to its "Try a practice round" button; the round's own deck; votes climbing; a tip and a vote buy bursting with confetti; the coach pulsing Start, End current song and End the show in turn with their decks; the summary. Not checked: an iPhone's own Safari (headless and the in-app pane only), and the Venue Studio's decks, which land with the venue half of 0101.
