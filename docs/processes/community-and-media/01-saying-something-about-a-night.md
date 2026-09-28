---
tab: Community & media
section: Saying something about a night
puzzle_section_id: 41999
sources:
  - netlify/functions/community.mjs (pickableNights, the actions: post, postEdit, postRemove, like, unlike, report; the own-page refusal), _community.mjs (addPost, editPost, removeOwnPost, likePost, reportPost, shapePosts; MAX_POSTS, MAX_TEXT, MAX_PHOTOS, PER_DEVICE_PER_DAY, PER_NETWORK_PER_DAY, EDIT_WINDOW), _embeds.mjs
  - public/community.html; public/vote.html (the wrap-up link with ?show=)
  - MYSET-MASTER-OVERVIEW.md §3.7, §3.8
  - INVARIANTS.md 9g, 0bu, 17d, 15k, 9b
  - docs/decisions/0020
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections)
verified: code read 2026-09-12 (community.mjs actions and the 403 for an artist's own page; _community.mjs constants and exports; vote.html wrap-up link)
---

# Saying something about a night

**Who:** a fan, the morning after (role *Fan*, external — never signs in). **Trigger:** the voting page's wrap-up link, a QR on a table, or `/<slug>/community` typed in. **Outcome:** a post on the artist's (or venue's) community page — a sentence, stars, which night, up to three photos, a video link, one clip — that the artist can answer and the next stranger can read. One page, one request, no account.

What keeps it a room and not a wall: every limit is enforced **inside the write** (INVARIANT 15k), a device id is all a post carries and it never leaves the server (0bu), and the artist cannot post on their own page (decision 0020).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| w01 | Open the community page | webpage | Person | Fan R · MySet server R | Netlify | `/<slug>/community` or `/v/<slug>/community` → `community.html`: one GET returns the page's shape — feed, merch rail (only when there is something to sell), the pickable nights, the limits (`editHours`), and `canPost`. **The Tip button is the first thing under the name** on an artist's page: somebody who came back to say the night was good should not scroll past a shop to do something about it. A tip started here returns here — the page sends `from:'community'` and the **server** picks the return path; a caller-supplied redirect is an open redirect however innocent it looks. `src: community.mjs GET; overview §3.7` |
| w02 | Is this the artist's own page? | conditional | Automation | MySet server R · Artist I | Netlify | A signed-in artist opening their own page gets `canPost:false` and the composer hidden; the server **also** refuses `post` and `clip` with 403 *"Artists can't post on their own community page."* — a rule only the page enforces is not a rule. The founding account is the one exemption. Other artists may post on pages they do not own. `src: community.mjs ownArtistPage; decision 0020` |
| w03 | Pick the night | form | Person | Fan R · MySet server R | Netlify | *"Where did you see them?"* — the list is the artist's **calendar**, not the archive: every gig in the last 120 days up to tonight, one per venue-and-date, newest first, with the archived show attached when one exists (the archive only knows nights MySet was used, and can hold two rows for one night). The key stored is `<eventId>@<date>` — or a name the fan typed, which is only ever a label, never a show id (INVARIANT 17d). After a show ends the voting page's wrap-up link arrives here with `?show=` pre-selected. → *Money → Past shows* h04 for how nights get their real venue name. `src: community.mjs pickableNights; vote.html; overview §3.7, §3.8` |
| w04 | Write the post | form | Person | Fan R | Netlify | Up to `MAX_TEXT` characters, one to five stars, an optional name (`MAX_NAME`), up to `MAX_PHOTOS` photos (shrunk on the phone → *Photos on a page*), a **video link** (*"Paste a video link"* — YouTube embeds through the same exact-host parser the profile uses, INVARIANT 9b; Instagram and TikTok stay links), and **one clip** → *A clip, as it was filmed*. The clip and the link are two different things and both are kept: a link is free and works on any phone; a clip is a moment from the room that was never going to be on YouTube. `src: _community.mjs constants; _embeds.mjs` |
| w05 | Refuse or accept, inside the write | conditional | Automation | MySet server R · Fan I | Netlify | `addPost` runs the limits inside the CAS on `posts_<owner>`: `PER_DEVICE_PER_DAY` posts a day per device (*"That's three posts today from this phone — come back tomorrow."* — the number is the constant's), **one per show per device**, and a soft per-network ceiling (`PER_NETWORK_PER_DAY`) wide enough that a whole bar on one Wi-Fi never hits it. The feed keeps `MAX_POSTS`; older ones fall off. A device id is stored with the post and **never shown to anyone**. `src: _community.mjs addPost; INVARIANTS 15k, 0bu, 9g` |
| w06 | Read the feed | webpage | Automation | MySet server R · Fan I | Netlify | Pinned first, then newest first; a heart per phone; a report button; the artist's reply under a post. Likes live in a **separate** document (`likes_<owner>`) so a burst of hearts never fights the composer for the feed document; `MAX_LIKERS` hashes per post keep a heart idempotent. `src: _community.mjs shapePosts, readLikes` |
| w07 | Heart a post | task | Person | Fan R · MySet server R | Netlify | `like` / `unlike` — one per device, kept as a hash, never a name. `src: _community.mjs likePost` |
| w08 | Report a post | task | Person | Fan R · MySet server R · Artist I | Netlify | `report` — **a report is a count, not a takedown.** The owner sees the count in the Studio and decides; nothing is hidden automatically. → *Moderating the page*. `src: _community.mjs reportPost` |
| w09 | Change or take back your own post | conditional | Person | Fan R · MySet server R | Netlify | `postEdit` for `EDIT_WINDOW` after posting (text and stars only); `postRemove` for ever. Ownership is compared **inside the write** against the stored device id — an id in the request body proves nothing — and the window is enforced there too, so a five-star review cannot quietly become a one-star one months later under a reply the artist already wrote. Removing a post drops its photos and its clip. `src: community.mjs postEdit/postRemove; _community.mjs editPost, removeOwnPost` |

## Connections

w01 → w02; w02 —own page→ *composer hidden, 403*; w02 —a fan→ w03 → w04 → w05; w05 —accepted→ w06; w05 —refused→ *the reason, in plain words*; w06 → w07; w06 → w08; w06 —yours→ w09; w04 —a clip→ *A clip, as it was filmed* k01.
