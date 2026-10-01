---
tab: Venue lifecycle
section: Pitches — "want to perform here?"
puzzle_section_id: 41985
sources:
  - netlify/functions/_pitch.mjs (sendPitch, setPitchStatus, venueReply, venueThread, venueUnread, STATUS_LINE, shapeForVenue, shapeForArtist, MAX_PITCHES, STATUS), _messages.mjs (pitchOpen, pitchAgain, pitchSay, shapeForVenueThread), admin.mjs (pitchList, pitchStatus, pitchSend — VENUE_SIDE; msgReply), venueadmin.mjs (pitchList, pitchThread — CREW_OK; pitchSet, pitchReply — MANAGER_OK)
  - docs/decisions/0123-asking-a-venue-for-a-spot-is-a-conversation-in-messages.md
  - MYSET-MASTER-OVERVIEW.md §3.3 Gigs, §3.6
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_pitch.mjs header, STATUS set, the two documents)
---

# Pitches — "want to perform here?"

**Who:** a signed-in artist asking; a venue manager answering. **Trigger:** *Pitch* on a venue's public page or from the artist's Gigs tab. **Outcome:** the venue gets a link to a real MySet page with real numbers on it — how many nights, how many people, how many votes — instead of a bio and a promise; the pitch opens a conversation in the artist's Messages (the **Venues** folder), which the venue answers from its Venue Studio; *keen* or not shows on the artist's Gigs tab and in the conversation (decision 0123).

**Only a signed-in artist can send one, deliberately.** No open contact form: that is a spam funnel, and it throws away the only thing that makes this useful. Nobody's email address is exposed.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| z01 | Is the sender a signed-in artist? | conditional | Automation | MySet server R | Netlify | `pitchSend` sits behind `requireArtist` in `admin.mjs` (the `VENUE_SIDE` set). A stranger has no door. `src: admin.mjs handleVenueSide` |
| z02 | Write the pitch | form | Person | Artist R | Netlify | Which venue (by slug; unknown → 404) and a short message. `pitchStatus` first shows whether one is already sent, its status, whether this artist can vouch for the venue, and the venue's own verified state. `src: admin.mjs pitchStatus` |
| z03 | Deliver it | database | Automation | MySet server R · Venue manager I | Netlify | `sendPitch`: one row `{id, aid, slug, name, message, at, status: 'new'}` in the venue's inbox `vpitch_<vid>` (**the canonical copy**, capped at `MAX_PITCHES`) and a pointer in the artist's `apitch_<aid>` so they can find their own. A second pitch from the same artist **updates** the first rather than adding (`already` / `updated`). The row carries `tid`, the id of a conversation opened in the artist's own inbox (`msg_<aid>_<tid>`, folder `venues`, kind `pitch`) with the artist's words as its first line; new words on a second pitch are a new line. No email is sent to anybody. `src: _pitch.mjs sendPitch; _messages.mjs pitchOpen, pitchAgain` |
| z04 | Read the inbox | notification | Automation | MySet server R · Venue manager I | Netlify | A new ask pushes every venue seat's phone that has Alerts on (decision 0124: *🎤 … wants to play here*, opening `/venues?tab=shows`; asking again is not a second alert). Venue Studio → `pitchList` (crew may read): each pitch with the artist's page link, their real numbers, and *new reply* when the artist has answered since the venue last looked (`vunread`). `src: venueadmin.mjs pitchList; _pitch.mjs shapeForVenue, tellVenue` |
| z05 | Answer keen or nope | task | Person | Venue manager R · Artist I | Netlify | `pitchSet {id, status}` — manager or owner (`MANAGER_OK`); `STATUS` is exactly `new` / `keen` / `nope`; `seenAt` stamped. Keen and nope each drop one line into the conversation (`STATUS_LINE`) and push to the artist; back to new sends nothing. `src: venueadmin.mjs pitchSet; _pitch.mjs setPitchStatus` |
| z06 | See the answer | notification | Automation | MySet server R · Artist I | Netlify | Studio → Gigs → *Venues you've asked*, each with its status and a **Messages** button that opens the conversation (`pitchList` on the artist side, `shapeForArtist` carries `tid`); a push or email about a venue's line opens Messages on Venues. `src: admin.mjs pitchList; studio.js pitchPanel; overview §3.3 Gigs` |
| z08 | Talk it through | task | Person | Artist R · Venue manager R | Netlify | The artist replies in Messages (`msgReply`; the venue's list then shows *new reply*, and each reply pushes the venue's phones — *💬 … wrote back*, decision 0124). The venue opens **Reply** on the pitch (`pitchThread`, crew may read) and answers (`pitchReply`, manager or owner), which lands unread in the artist's Venues folder with a push and a budgeted email. A pitch from before 0123 gets its conversation the first time the venue answers. Block is refused on a venue's conversation; Report still works. `src: _pitch.mjs venueReply, venueThread; _messages.mjs pitchSay, ownerReply` |
| z07 | Vouch for the venue | go_to | Person | Artist R | Netlify | If this artist has a gig at the venue on their own calendar they may also vouch for its verification — → *Getting verified* y05. `src: admin.mjs vouch` |

## Connections

z01 —artist→ z02 → z03 → z04 → z05 → z06 → z08; z04 → z08 (the venue replies without Keen); z02 → z07 (if they play there).
