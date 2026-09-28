---
id: 0114
title: An alert reaches only the seats that can see what it is about, and a sign-out ends that phone's alerts
date: 2026-09-28
status: decided
decided_by: claude
area: auth
reverses:
superseded_by:
invariants: [0ha]
commits: []
tests: [test/pushseats.mjs, test/push.mjs, test/ordernote.mjs]
files: [netlify/functions/_push.mjs, netlify/functions/_session.mjs, netlify/functions/admin.mjs, netlify/functions/_ordernote.mjs, netlify/functions/_messages.mjs, netlify/functions/_requests.mjs, netlify/functions/_sample.mjs, public/studio.js, tools/mock.mjs, test/pushseats.mjs]
---

## The question

Web push (`_push.mjs`) kept one list of devices per page, `push_<aid>`, and `notify()` sent every alert to all of them. That was right when a page had one person. Decision 0105 gave each band mate and crew seat its own tabs, and the triage run for it against the in-memory store found three things wrong with alerts:

- A crew seat's `pushOn` answered 200, and the next merch order (the item, the total, the pickup code) reached the sound engineer's phone. So would a booking request's first words, though Messages is hidden from crew.
- The cap was eight devices per page, newest first. Eight crew subscriptions pushed the owner's phone off the list.
- No sign-out ended a device's alerts. A phone signed out, a seat removed, or "sign out everywhere" left every alert still arriving. The same held for a borrowed phone handed back, and for a phone on which the next person signs in to a different page.

Decision 0105 named this as the next batch, and the founder started it on 2026-09-28.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Each device row carries the address and sign-in (`sid`) that switched it on. `notify(aid, msg, to)` names who hears it: a tab, the owner, every seat, or one device. It reaches a seat only while the address is still a seat on the page and that seat can see the tab. An alert that names nobody reaches nobody. The cap is eight per address. `killSessions` and `killEverything` drop the devices of the sign-ins they end. | One registry read per alert, and only when the page has devices. One push-document read per sign-out. | A third argument on every `notify` call, and a tripwire that fails if one is missing. | A device is muted wrongly for a while: an alert is missed, never leaked. |
| B | `pushOn` becomes owner-only, so only the owner has alerts. | A line. | None. | The sound engineer running the show loses request alerts. Every seat's Settings would show a switch the server refuses unless the page hid it (AGENTS.md rule 3). |
| C | Stamp each device with its role when it switches on, and route by the role alone. | Cheaper: no registry read. | A role per row. | The owner's tab choices (0105) never reach alerts. A seat given Merch, or with Messages taken away, keeps its old alerts until it switches off and on. A removed seat keeps hearing. |
| D — do nothing | — | — | — | The crew seat reads every order, and the owner's phone can be pushed off the list. |

## What was chosen, and why

A. It is the one place alerts get gated, and it reads the same model as everything else. The seat's tabs come from `can(role, '<tab>_view', access)`. The address is still a seat only while its `byEmail` row points at this page. The owner's tab choices therefore reach alerts the moment they are made, and nothing about a seat is copied onto its devices except who it is.

**Where each alert goes:**

- **Merch orders**: `{ tab: 'merch' }`.
- **Messages**: `{ tab: 'messages' }`.
- **Requests** (a song, a mood, a birthday shout-out): `{ all: true }`. The requests are every seat's (0105), and the sound engineer is who most needs to hear them.
- **The founder's alerts** (a reported conversation, the sample factory): `{ owner: true }`, the founding page's owner seat alone, as 0100 has it.
- **"Alerts are on"**: `{ endpoint }`, only the phone just switched on. Before, a crew seat switching alerts on pinged the owner's phone too.

**Default-deny.** An alert with no audience reaches nobody. A new alert that forgets to say who hears it is then silent, not loud on every seat's phone. `test/pushseats.mjs` fails the build if any `notify(` call in `netlify/functions/` has no third argument.

**Sign-outs.** A device's alerts end with the sign-in that switched them on. They end in the two functions every sign-out already goes through: `killSessions` (one phone, "my other devices", a removed seat, a session pushed out of the list) and `killEverything` ("sign out everywhere", a recovery code, the founder putting a claim back). Each already cleans the session list, the device's other record. A dead-session mark could not do this job alone, because it lapses when the token would have expired, and the device row does not. At send time, `notify` checks only that the address is still a seat here, which it needs anyway to read the seat's tabs. It drops a device whose address is not.

**Devices with no address.** Three kinds have none:

- a device switched on through the Studio code, which only the owner holds;
- the recovery key;
- any device switched on before this change.

Each counts as the owner's. The 2026-09-25 production backup held no push document and no seat but owners, so nothing is re-routed.

**The Studio.**

- On sign-out, the Studio drops the browser's own subscription as well. The next person on that phone finds alerts off, instead of a switch that says on for a device the server no longer writes to.
- The alerts line says what this seat will hear: a crew seat, *when someone requests a song*; the owner, *someone requests a song, writes to you or buys your merch*.

## What this makes harder

- Every alert must say who hears it. That is the point, but it is a thing to remember, and the tripwire is what remembers it.
- An alert costs one more read (the registry) when the page has devices. For song requests during a show that is one read per request, only on pages with alerts switched on. The alert is sent after the request is stored and is never awaited into the fan's response (INVARIANT 16), so the fan does not wait on it.
- The device document now holds seat addresses. It was already in the account's export and deletion (`keysFor`), and every address in it is already in the registry.
- Some sequences leave a server row behind:
  - a device switched on under one sign-in, which then expires on its own after thirty days;
  - that phone signed in again;
  - then signed out.

  That sign-out kills the new sign-in, not the old one. The Studio's sign-out drops the browser's subscription, so the push service answers 410 at the next alert and `notify` prunes the row. A lost phone that never signs out is cut off by "sign out everywhere".

## What would reverse it

- A seat that must hear about a tab it cannot open. That would be a new audience, not a wider tab.
- Venues switching alerts on. The venue side has no `pushOn` today, and `notify` reads the artist registry. A venue alert would need the venue registry's seats, the same way.
- The registry read per alert showing up in the Blobs bill at scale. Then carry the seat's reach on the device and re-stamp it on `accessSet` and `roleSet`, which are the only places it changes.

## How it was verified

- **Failing first.** `test/pushseats.mjs` against the unfixed code printed `15 passed, 18 failed`: the crew seat's order alert, the setup ping on every phone, the cap evicting the owner, and every sign-out leaving the alerts.
- **With the fix.** `33 passed, 0 failed`. The neighbours stay green: `test/push.mjs` 31, `test/ordernote.mjs` 26, `test/messages.mjs` 91, `test/accounts.mjs` 236, `test/samples.mjs` 119, all with 0 failed.
- **Each piece knocked out alone,** then restored byte for byte (checked with `shasum -c`):

  | Knock-out | Failed |
  | --- | --- |
  | tab gate off | 3 |
  | cap per page instead of per seat | 6 |
  | `killSessions` keeps the alerts | 4 |
  | `killEverything` keeps them | 1 |
  | no audience means everyone | 1 |
  | an ex-seat still hears | 5 |
  | the setup ping to every seat | 1 |
  | `pushOn` forgets the seat | 13 |

- **The whole suite.** `sh test/run.sh` exited 0 with 4,520 ✓.
- **In the app's browser, on `tools/mock.mjs`.** The alerts row is drawn for a crew seat. `pushWhat()` reads *someone requests a song* for crew and for a band mate with Merch and Messages hidden, and all three for the owner and an untouched band mate.
- **Not checked:**
  - A real push to a real phone. `VAPID_*` has been set in production since 2026-09-15, and no real push has been checked since.
  - The browser subscription dropped on sign-out. The mock runs no service worker.
  - Production.
