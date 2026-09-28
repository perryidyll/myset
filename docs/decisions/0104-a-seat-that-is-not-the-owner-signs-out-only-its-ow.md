---
id: 0104
title: A seat that is not the owner signs out only its own devices
date: 2026-09-28
status: decided
decided_by: user-confirmed
area: auth
reverses:
superseded_by:
invariants: [0gp]
commits: []
tests: [test/accounts.mjs]
files: [netlify/functions/_session.mjs, netlify/functions/auth.mjs, netlify/functions/venueauth.mjs, test/accounts.mjs]
---

## The question

"Where you're signed in" lists every device on an account, and gives each one a Sign out button and a "Sign out my other devices" button under the list. Three actions sit behind that screen: `sessions` (the list), `sessionRevoke` (one device, by its session id) and `signOutOthers` (every device but this one). `revokeAll`, "sign out everywhere", has been owner-only since INVARIANT 0db. These three had no role check at all.

So a crew seat, or a band mate, could call `signOutOthers` and sign out every other device on the account, the owner's included. Mid-gig that bounces the artist's Studio to the sign-in screen. `sessionRevoke` signed out any session id the caller named, and `sessions` handed every id out. A scratch run against the in-memory test store showed it: the owner's token answered `planGet` 200 before a crew seat's `signOutOthers` and 401 after, while the same crew seat's `revokeAll` was correctly refused with 403. The existing test "cannot sign the owner out" only tried `revokeAll`, so it passed while the hole was open. The venue side (`venueauth.mjs`) had the same three doors open.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | For a seat that is not the owner, all three are scoped to the sessions signed in with that seat's own address. The list shows only its own devices, `sessionRevoke` refuses a session id outside it (403), and `signOutOthers` means its own other devices. The owner still reaches every device. | One optional argument on `readSessions`. No extra reads. | None. | A seat whose own session row was dropped from the list cannot sign that device out one at a time. Its own "Sign out of this device" still works, and so does the owner. |
| B | All three become owner-only. | A line each. | None. | Both Studios draw the screen for every seat, so every seat meets a list whose buttons the server refuses — unless both pages hide it for them. A band mate can no longer sign out their own lost phone. |
| C — do nothing | — | — | — | Any seat can sign the owner out mid-gig, one POST. |

## What was chosen, and why

A. The founder chose it from the two directions when asked on 2026-09-28 ("Own devices only").

It keeps the one useful thing the screen does for a seat — getting a lost phone off the account — and takes away the one harmful thing. Because the list itself is scoped, the pages needed no change: every Sign out button a seat is shown is one the server will honour (AGENTS.md rule 3). It also stops handing every seat the owner's device list, addresses and time zones. The owner's reach is unchanged: cutting off a departed band mate's phone is exactly what the owner's view is for.

A session row with no address (from before sessions carried one) belongs to nobody who asks for one, so a seat never reaches it.

## What this makes harder

The list a seat sees is no longer the account's list. A future screen that wants a seat to see who else is signed in has to ask the owner's question, on purpose.

## What would reverse it

A role, other than the owner, that is meant to manage devices for the whole account, such as a manager who runs the band's phones. That seat would get the owner's reach in this one place, by name.

## How it was verified

- Failing first: the new checks in `test/accounts.mjs` (member `sessionRevoke` of the owner's session id; crew `signOutOthers`; the venue's barman doing both) against the unfixed code printed `81 passed, 14 failed`. The owner's token went from 200 to 401, and the crew seat's `signOutOthers` reported `gone: 2`.
- With the fix: `95 passed, 0 failed` on that base; `236 passed, 0 failed` on the rebased tree, which also carries decision 0105.
- Each half knocked out alone, then restored byte for byte (checked with `shasum -c`):
  - the artist `sessionRevoke` check removed: 8 failed;
  - `signOutOthers` unscoped: 6 failed;
  - the list unscoped: 1 failed;
  - the venue `sessionRevoke` check removed: 2 failed;
  - the venue `signOutOthers` unscoped: 2 failed.
- The whole suite (`sh test/run.sh`) exited 0 on the final tree.
- Not checked: production. A preview shares production data, so it is no place to exercise a write path.
