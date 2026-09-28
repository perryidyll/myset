---
id: 0105
title: The owner gives each band mate and crew seat, tab by tab, hidden, view or edit
date: 2026-09-28
status: decided
decided_by: user-confirmed
area: auth
reverses:
superseded_by:
invariants: [0gq]
commits: [52047cb]
tests: [test/accounts.mjs, test/seatstudio.mjs, test/structure.mjs, test/copy.mjs, test/tipdecks.mjs]
files: [netlify/functions/_session.mjs, netlify/functions/_auth.mjs, netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/auth.mjs, netlify/functions/revenue.mjs, netlify/functions/history.mjs, netlify/functions/stage.mjs, public/studio.js, public/studio.html, tools/mock.mjs]
---

## The question

Two roles sat under the owner: `member` (the page and the show, and money totals) and `crew` ("tonight only"). A read of the doors outside `admin.mjs`'s `CAPABILITY` table found three places where a crew seat reached past that. Each was then run against the in-memory test store:

- `revenue.mjs` had no role check. A crew seat read every payment with the buyer's email, the note and the merch item — the details `admin.mjs` keeps from crew by gating `orderDetail`.
- `history.mjs` had no role check on reads or writes. A crew seat read the book of nights, renamed a night, and hid one ("Delete show") from the owner's own Money tab.
- `pushOn` in `admin.mjs` is open to every seat. A crew phone got the owner's merch order alerts (with pickup codes) and inbox alerts. Eight subscriptions from one crew seat pushed the owner's phone out of the account's eight-device cap entirely.

The Studio had the same problem on the page: it drew owner-only controls for every seat. Examples were the earnings card (read as "Nothing to add up yet"), "Got a code?", Add an email, the Studio code, the page address, and delete. It drew edit controls on tabs a seat could not change, too.

Asked what to do, the founder widened it (2026-09-28): "make it so that the owner has the ability to give viewability of the money tab to each individual band/crew, as well as an additional option to allow them to edit it – same for all the tabs … maybe i play a stint of shows with some guys and give them access to my account so they can also see and interact with the setlist while on stage, but that doesn't necessarily mean i want them to have read/write access to my entire account".

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Nine Studio tabs (Setlist, Gigs, Money, Merch, Diary, Messages, Profile, Settings, Plans), each at 0 hidden, 1 view or 2 edit, per seat. The role is the seat's preset. The registry row keeps only the tabs the owner changed. One table (`_session.mjs`), enforced on the server, drawn from `planGet` on the page. | Bytes on the registry only for seats the owner has touched; no extra reads (the verifier already holds the row). | `access` on a registry row; `accessSet`; the owner's grid. | A seat is shown or refused a tab it should not be. Presets are today's reach, so nothing changes until the owner changes it. |
| B | Gate `revenue.mjs` and `history.mjs` to the two fixed roles, and hide the owner-only controls. | Smaller. | None. | The founder's case (a stint of shows with some players) has no answer between "whole band" and "tonight only". |
| C | Per-action permissions. | A grid of about eighty switches. | Much. | Nobody could set it up right between two sets. |
| D — do nothing | — | — | — | Crew read every buyer's email, rewrite the book, and the Studio keeps offering buttons it refuses. |

## What was chosen, and why

A, because it is what the founder asked for, at the grain they named: tabs, view or edit.

- **The presets are today's reach.** No seat's reach changes on deploy, except where a role reached past its own description.
  - `member`: every tab at edit, except Money at view ("sees money totals; never moves money", 0db) and Plans at view.
  - `crew`: the Setlist at view, and nothing else ("tonight only").
  - What crew loses by that: the money reads and writes above, and the room's prices and settings. Those were open to every seat because no `CAPABILITY` row named them.
- **Floors and ceilings.** The Setlist is never below view, because the stage needs it. Running the show and the requests stay with every seat, whatever its tabs say. Plans is never above view: changing the plan is the owner's (0dc).
- **Owner-only stays owner-only**, whatever a seat is given. `OWNER_ONLY` in `admin.mjs` and `auth.mjs` is checked before this table, and no grant reaches past it: the plan and billing, payouts, the books, the business dashboard (0065), who can sign in, the page address, the Studio code, recovery codes, passkeys, export and deletion. `accessSet` refuses what a tab cannot take (setlist hidden, plans edit) rather than clamping it. The owner's grid is drawn from the tabs and levels the server sends, so it never offers one.
- **The server is the line.**
  - Every `CAPABILITY` row now names a tab and `_view` or `_edit`, including the reads that carry private data: orders, the inbox, the calendar, the diary list, fans' posts.
  - `revenue.mjs` and `history.mjs` ask Money view to read and Money edit to change.
  - The Live poll strips tonight's tips, their notes, the vote buys and the account's all-time total for a seat without Money view, and says `money: false` so the page draws no false $0.00.
  - The team list shows a seat its own row, not every address on the page.
  - `CAN` keeps only `audit`, the one name besides the tabs that code reads. `show`, `requests` and `export` were names nothing asked for (the export is `OWNER_ONLY`'s), so they are gone, and `tools/mock.mjs` reads the presets from `_session.mjs` instead of a copy.
- **The page is honest** (AGENTS.md rule 3).
  - A hidden tab leaves the tab bar and the Menu, is never landed on, and its reads are never sent.
  - An edit control carries `data-ed="<tab>"` (or `"owner"`), and `seatPass()` removes what this seat cannot do after every paint and every sheet.
  - On a tab at view, every field shows its value and cannot be typed into, under one "View only" note.
  - `test/seatstudio.mjs` pins it. Its tripwire fails if any owner-only action is sent from a function outside the owner-gated set.
- **A sample's link (0101) looks at every tab and changes none** (preset `sample`, all view). Its Studio still draws as the owner's, because a write there opens the claim sheet and `SAMPLE_OK` refuses it first.

`toggleSong` (the eye that takes a song out of tonight's vote) stays with every seat: it is running the show, and the server has always allowed it.

## What this makes harder

- Every new Studio action now needs a tab and a level in `CAPABILITY`, or a reason it is the show's. A new edit control needs its `data-ed`.
- Two tables must agree: `PRESET` and its bounds in `_session.mjs`, and the copy in `tools/mock.mjs` (a look-only tool).
- The venue side keeps its fixed manager and crew roles. A venue owner cannot yet set tabs per seat.

## What would reverse it

A seat model the founder wants per action rather than per tab; or venues asking for the same grid (then `venueadmin.mjs`'s `CREW_OK` / `MANAGER_OK` move onto this table).

## Open, deliberately, for the next batch

**Push alerts per seat.** `pushOn` is still open to every seat, and an alert goes to every subscribed phone on the account. A crew phone still gets order and inbox alerts, and the founding page's "A conversation was reported". A seat can still crowd the owner out of the eight-device cap. The fix is to tag each subscription with its seat, send each alert only to seats whose tab covers it, and never let a seat's devices evict the owner's.

## How it was verified

- The three gaps, run before the fix against the in-memory store:
  - a crew seat's `GET /api/revenue` answered 200 with `buyer@fan.example`, the item and the note;
  - its `POST /api/history` rename and hide answered 200, and the owner's list went from one night to none;
  - its `pushOn` answered 200, a new order alert reached its endpoint, and eight more of its subscriptions left the owner's phone out.
- `test/accounts.mjs`, "EACH SEAT, EACH TAB", covers:
  - the presets, and each grant reaching the same token at once;
  - a tab taken away being refused on the server;
  - the bounds, and owner-only actions refused with every tab at its most;
  - the Live poll without money, the team list, `roleSet` resetting the tabs, stored-data guards, and the sample preset.
  - The file is 236 passed, 0 failed.
- Each server piece knocked out alone, then restored byte for byte (checked with `shasum -c`):
  - the `revenue.mjs` gate: 3 failed;
  - the `history.mjs` gate: 3 failed;
  - per-seat grants ignored, so every seat gets its preset: 9 failed;
  - the Live poll keeping its money: 1 failed;
  - the team list unfiltered: 1 failed;
  - the Settings rows gone from `CAPABILITY`: 2 failed.
- `test/seatstudio.mjs` passes 89 checks. Three knock-outs each failed it: "Got a code?" left ungated, a new ungated function sending `setCode`, and a song delete without `data-ed`.
- `sh test/run.sh`: exit 0, 4,487 checks in 64 sections, 0 failed.
- In a real browser at 375 px against `tools/mock.mjs`:
  - the owner's grid: Access sheet, tabs, levels and presets;
  - the crew's Live, Setlist, Menu and Settings: no money anywhere, no edit control;
  - a band mate's Money and Settings;
  - Settings and Profile at view, and the plans sheet for a seat;
  - a sample's Studio unchanged.
  - The mock logged no call refused to a seat.
- Not checked: production, a real phone, and the venue side, which is unchanged.
