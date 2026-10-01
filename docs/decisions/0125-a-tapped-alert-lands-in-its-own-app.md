---
id: 0125
title: A tapped alert lands in its own app: a Venue Studio alert finds the Venue Studio, an artist alert the Studio
date: 2026-09-30
status: decided
decided_by: founder
area: ui
reverses:
superseded_by:
invariants: [0ha]
commits: [3c161bd]
tests: [test/sw.mjs]
files: [public/sw.js, test/sw.mjs]
---

## The question

Since decision 0124 a venue's phone gets push alerts, but `sw.js` sent every tapped alert to an open `/studio` window if there was one. On a phone with both the artist Studio and the Venue Studio open, "🎤 Juno Reed wants to play here" brought up the artist Studio. HQ (`/crm`) and factory (`/factory`) alerts had the same fault. `sw.js` is do-not-touch without the founder's word; the founder gave it ("please fix where a tap lands, you have my word on sw.js").

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Focus an open window whose first path segment matches the alert's address (`/venues` finds `/venues`, `/studio` finds `/studio`); otherwise open the alert's address | One helper and one changed line in `sw.js` | none | A tap opens a second copy of an app instead of focusing one; nothing a fan sees |
| B | A, and also navigate the focused window to the alert's `?tab=` | A reload of an open app on every tap | none | A half-typed reply or form in the open app is lost on a tap |
| C — do nothing | A venue alert can land in the artist Studio | nothing | none | The venue taps an alert and sees the wrong app |

## What was chosen, and why

A: the smallest change that puts the tap in the right app, and it keeps what the worker already did for artists (focus, never reload an open app). B would take the open app to the right tab but reloads it under the person's thumb; the gig's rule ranks a lost draft above a missing tab switch. The cache, the fetch rules and the cache name are untouched, so nothing about how pages are served changes.

## What this makes harder

A tap on an alert while that app is already open focuses it on whatever tab it was showing, not the alert's tab (as before, for artists). A tab switch without a reload would need the page to listen for a message from the worker.

## What would reverse it

People tapping an alert and not finding the thing it named, because their app was already open on another tab: then add a `postMessage` from the worker that the Studios handle by switching tab, with no reload.

## How it was verified

- **Suite:** `test/sw.mjs` gains six checks that run the real `sw.js` notificationclick in the fake browser: a venue alert focuses an open Venue Studio and not the Studio; with only the Studio open it opens `/venues?tab=shows`; the reverse for an artist alert; an alert with no address still goes to the Studio; a fan page is never mistaken for the app. Against the old worker three of them fail. `sh test/run.sh` exit 0.
- **Live as `3c161bd` (PR #171):** verified by content on myset.vip at 05:59 UTC 2026-09-30 (`/sw.js` carries `appOf`).
- **Not checked:** a real phone.
