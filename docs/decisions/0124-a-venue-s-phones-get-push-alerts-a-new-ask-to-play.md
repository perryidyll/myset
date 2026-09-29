---
id: 0124
title: A venue's phones get push alerts: a new ask to play, an artist writing back, a merch order
date: 2026-09-29
status: decided
decided_by: founder
area: product
reverses:
superseded_by:
invariants: [0ha]
commits: []
tests: [test/venuepush.mjs, test/pushseats.mjs]
files: [netlify/functions/_push.mjs, netlify/functions/venueadmin.mjs, netlify/functions/_pitch.mjs, netlify/functions/_messages.mjs, netlify/functions/_ordernote.mjs, public/venue-studio.js, public/venue-studio.html, test/venuepush.mjs, test/run.sh]
---

## The question

Since decision 0123 an artist's ask to play is a conversation, but the venue heard about nothing: a new ask, an artist's reply and a venue merch order each waited on the What's on or Merch tab until somebody happened to open the Venue Studio. Artists have had push alerts since 0097 and per-seat alerts since 0114. The founder asked for push notifications for venues too.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The artist side's Web Push (`_push.mjs`), keyed by the owner id a venue's sign-ins already use, `v_<vid>`. `notify()` reads the venue registry for a venue's seats. An Alerts card in the Venue Studio's Settings. | About 40 server lines, 70 page lines | three venueadmin actions (`pushKey`, `pushOn`, `pushOff`); `push_v_<vid>` documents | A venue alert fails silently, as every alert does (INVARIANT 16) |
| B | Email the venue instead | A mail per event, against a budget | a venue mail budget | Mail is slow and lands in spam; a bar reads its phone |
| C — do nothing | Venues keep finding out when they open the Studio | nothing | none | An artist's ask sits unanswered for days |

## What was chosen, and why

A, because almost all of it already existed. A venue's sessions live under `v_<vid>` (venueauth.mjs), and `killSessions` / `killEverything` already call `dropDevices` on that same owner id. So a venue's sign-out, "sign out everywhere" and a removed seat end its phones' alerts with no new code (0114's rule, INVARIANT 0ha, held on the venue side for free).

- **What a venue hears:** a new ask to play ("🎤 Juno Reed wants to play here"), each artist reply in a pitch conversation ("💬 Juno Reed wrote back"), and a venue merch order (tellOrder already called `notify('v_<vid>')`, which reached nobody until now). Asks and replies open `/venues?tab=shows`; an order opens `/venues?tab=merch`. The Venue Studio now reads `?tab=`.
- **Who hears it:** every venue seat. Every venue role may read asks and orders (CREW_OK in venueadmin.mjs), so a `{ tab }` audience is every seat on a venue; `{ owner: true }` is still the owner alone, and an alert naming nobody still reaches nobody.
- **Asking again** with the same or new words is not a second alert. Each artist reply is one, collapsed on the phone by its tag (`pitch-<aid>`).
- **Time-boxed** at 1.5 s (`VENUE_NOTE_MS`): the ask or reply is saved before the alert is tried, and a slow push service never holds the artist's answer.
- **"On" means on for this venue.** One browser holds one push subscription, so a phone that also runs an artist Studio would read as on. `pushKey` takes the phone's endpoint and answers `mine`; Turn off drops only the venue's row and leaves the browser's subscription alone.
- **A sample page** cannot switch alerts on (not in SAMPLE_OK), and the card is not drawn there.

## What this makes harder

- A phone that runs both Studios shares one subscription. The artist Studio's Turn off or Sign out unsubscribes the browser, which silently ends that phone's venue alerts. The Venue Studio then honestly shows "Get alerts on this phone", and the stale row is dropped at the next alert's 410.
- The service worker (untouched, by rule) focuses an open `/studio` window when any alert is tapped, so on a phone with both Studios open, a venue alert brings up the artist Studio. With no `/studio` window it opens the Venue Studio on the right tab.
- iPhone needs the Venue Studio on the home screen first; the card says so rather than offering a button that fails.

## What would reverse it

- Venues asking to choose which alerts they get: per-kind switches on the card.
- Crew seats finding merch or ask alerts noise: a venue `{ tab }` audience that follows roles, as the artist side's does.

## How it was verified

- **Suite:** `test/venuepush.mjs` (19 checks): any seat switches its own phone on and gets the "Alerts are on" ping alone; a malformed subscription is refused; `mine` is false for the artist's endpoint; a new ask reaches both venue phones and not the artist's, asking again reaches nobody; each artist reply reaches both; a venue merch order reaches both; owner-only reaches the owner; no audience reaches nobody; Turn off, a sign-out and a removed seat each end a phone's alerts; the artist's phone is never touched. `test/pushseats.mjs`'s tripwire still finds every `notify(` naming its audience. `sh test/run.sh` exit 0.
- **Browser:** headless Chrome at 390 px against `tools/localhost.mjs`, with the service worker registered by hand (the page registers it only on https): the card reads "Get alerts on this phone", Turn on made a real Chrome push subscription and the card turned to "Alerts are on"; `/venues?tab=shows` landed on What's on. No console errors.
- **Not checked:** a real phone, and a real alert arriving on one.
