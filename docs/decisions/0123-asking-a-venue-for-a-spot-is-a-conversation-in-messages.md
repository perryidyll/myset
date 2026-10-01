---
id: 0123
title: Asking a venue for a spot is a conversation in Messages
date: 2026-09-29
status: decided
decided_by: founder
area: product
reverses:
superseded_by:
invariants: []
commits: [0c4bde2]
tests: [test/pitchmsgs.mjs]
files: [netlify/functions/_pitch.mjs, netlify/functions/_messages.mjs, netlify/functions/admin.mjs, netlify/functions/venueadmin.mjs, public/studio.js, public/venue-studio.js, public/venue-studio.html, public/venue.html, public/tips.js, test/pitchmsgs.mjs, test/run.sh]
---

## The question

"Want to perform here?" on a venue's page sent the venue one message. The venue could only mark it Keen or Not this time, and the artist saw that status on the Gigs tab. Neither side could reply, so after a Keen they had to find each other some other way. The founder asked for messages to venues, and their replies, to be managed in the Studio's Messages "as well, if not entirely", built the simplest way that makes sense.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | The pitch opens a conversation in the artist's own inbox (`msg_<aid>_<tid>`, a new Venues folder). The venue reads and replies to it from its pitch row in the Venue Studio. Keen and ✕ each drop one line into it. | Two modules gain about 150 lines; one new folder; two venue actions | `tid` and `vunread` on the pitch row; `kind: 'pitch'` threads | A venue sees only the pitch's own words, which is where it was before |
| B | A shared conversation store, keyed by the pair, that both Studios list | A new store, a second index, and a venue inbox tab built from nothing | a whole venue Messages tab | Two copies of "who has read what" |
| C | Keep statuses only; show the venue's email when it taps Keen | Almost nothing | none | Breaks "nobody's email is shared"; the talking leaves MySet |

## What was chosen, and why

A. The artist already has a working inbox, with folders, unread counts, the Waiting-for-you nudge, push and email. So the conversation lives there, and the pitch row carries the conversation's id. The venue reaches it only through its own pitch row, so no venue can read an artist's messages by guessing a key. For the venue, one Reply button and a sheet are enough; a full inbox would be most of a feature for a handful of conversations per venue.

- **Artist side:** the conversation is filed in a new **Venues** folder. It is never a Request, because the artist started it.
  - The kind label is "Venue".
  - The thread shows the venue's current answer (They're keen / Not this time) and links to the venue's page.
  - Block is hidden and refused, since the artist asked this venue themselves. Moving the thread to another folder or reporting it still works.
- **Venue side:** each pitch row in What's on gets a **Reply** button, which opens the conversation.
  - A pitch the artist has answered shows "new reply" until the venue opens it (`vunread`).
  - Keen sends "We're keen — let's talk.", and ✕ sends "Not this time, but thanks for asking." Undo sends nothing.
- **Asking again:** if the artist asks again with the same words, nothing is added. New words become a new line in the conversation.
- **Older pitches:** a pitch made before this change has no conversation. It gets one the first time the venue replies or taps Keen or ✕, and its original words become the first line.
- **Doors in:**
  - The Gigs tab's "Venues you've asked" rows open the conversation.
  - The venue page's card links to `/studio?tab=messages&f=venues`.
  - A push or email about a venue's reply opens the same place.
- **Deleting and exporting:** the conversation belongs to the artist. It is deleted and exported with the artist's other messages. After that, the venue still sees the pitch's own words.

## What this makes harder

- Venues get no email about an artist's reply; they see it on the What's on tab, as "new reply". (Push came with decision 0124: a venue's phones now hear each reply and each new ask.)
- A pitch conversation cannot be blocked. A venue that becomes a nuisance can still be reported, which moves the thread to Spam, or simply left unanswered.

## What would reverse it

- **A venue inbox:** if venues start receiving many conversations, they need their own inbox. That means option B, with the conversations moved into a shared store.
- **Venue notifications:** if venues ask to be told about replies, venue push comes first.

## How it was verified

- **Suite:** `test/pitchmsgs.mjs` (27 checks) covers the whole round trip.
  - The ask opens the conversation, and the same words asked again add nothing.
  - The venue reads the conversation under the artist's name and replies. The artist sees it unread, and the artist's reply shows as new on the venue's list until the venue opens it.
  - Keen sends its line and Undo sends nothing. Block is refused.
  - An older pitch gets its conversation when the venue answers.
  - `keysFor` includes the conversation, and the fallback after the artist is deleted works.
  - `sh test/run.sh` exit 0, 4,989 ✓.
- **Browser:** checked in headless Chrome at 390 px against `tools/localhost.mjs` (the real functions on an in-memory store).
  - The artist's Venues folder and thread.
  - The Gigs row's Messages button, which lands on the thread.
  - The Venue Studio's pitch row and its conversation sheet.
- **Live as `0c4bde2` (PR #167)**: verified by content on myset.vip at 14:48 UTC (`studio.js?v=e46927ab`, `venue-studio.js?v=397b7e90` carries `pitchReply`, venue.html carries "Open the conversation").
- Not yet checked on a real phone.
