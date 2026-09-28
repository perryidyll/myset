---
tab: Venue lifecycle
section: Pitches — "want to perform here?"
puzzle_section_id: 41985
sources:
  - netlify/functions/_pitch.mjs (sendPitch, setPitchStatus, shapeForVenue, shapeForArtist, MAX_PITCHES, STATUS), admin.mjs (pitchList, pitchStatus, pitchSend — VENUE_SIDE), venueadmin.mjs (pitchList, pitchSet — MANAGER_OK)
  - MYSET-MASTER-OVERVIEW.md §3.3 Gigs, §3.6
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_pitch.mjs header, STATUS set, the two documents)
---

# Pitches — "want to perform here?"

**Who:** a signed-in artist asking; a venue manager answering. **Trigger:** *Pitch* on a venue's public page or from the artist's Gigs tab. **Outcome:** the venue gets a link to a real MySet page with real numbers on it — how many nights, how many people, how many votes — instead of a bio and a promise; the artist sees *keen* or not on their own Gigs tab and takes it from there through the links on each other's pages.

**Only a signed-in artist can send one, deliberately.** No open contact form: that is a spam funnel, and it throws away the only thing that makes this useful. Nobody's email address is exposed.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| z01 | Is the sender a signed-in artist? | conditional | Automation | MySet server R | Netlify | `pitchSend` sits behind `requireArtist` in `admin.mjs` (the `VENUE_SIDE` set). A stranger has no door. `src: admin.mjs handleVenueSide` |
| z02 | Write the pitch | form | Person | Artist R | Netlify | Which venue (by slug; unknown → 404) and a short message. `pitchStatus` first shows whether one is already sent, its status, whether this artist can vouch for the venue, and the venue's own verified state. `src: admin.mjs pitchStatus` |
| z03 | Deliver it | database | Automation | MySet server R · Venue manager I | Netlify | `sendPitch`: one row `{id, aid, slug, name, message, at, status: 'new'}` in the venue's inbox `vpitch_<vid>` (**the canonical copy**, capped at `MAX_PITCHES`) and a pointer in the artist's `apitch_<aid>` so they can find their own. A second pitch from the same artist **updates** the first rather than adding (`already` / `updated`). No email is sent to anybody. `src: _pitch.mjs sendPitch` |
| z04 | Read the inbox | notification | Automation | MySet server R · Venue manager I | Netlify | Venue Studio → `pitchList` (crew may read): each pitch with the artist's page link and their real numbers. `src: venueadmin.mjs pitchList; _pitch.mjs shapeForVenue` |
| z05 | Answer keen or nope | task | Person | Venue manager R · Artist I | Netlify | `pitchSet {id, status}` — manager or owner (`MANAGER_OK`); `STATUS` is exactly `new` / `keen` / `nope`; `seenAt` stamped. Nothing else is promised by the app — booking happens between the two of them. `src: venueadmin.mjs pitchSet; _pitch.mjs setPitchStatus` |
| z06 | See the answer | notification | Automation | MySet server R · Artist I | Netlify | Studio → Gigs → pitches sent, with their replies (`pitchList` on the artist side, `shapeForArtist`). `src: admin.mjs pitchList; overview §3.3 Gigs` |
| z07 | Vouch for the venue | go_to | Person | Artist R | Netlify | If this artist has a gig at the venue on their own calendar they may also vouch for its verification — → *Getting verified* y05. `src: admin.mjs vouch` |

## Connections

z01 —artist→ z02 → z03 → z04 → z05 → z06; z02 → z07 (if they play there).
