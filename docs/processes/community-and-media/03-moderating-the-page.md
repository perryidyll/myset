---
tab: Community & media
section: Moderating the page
puzzle_section_id: 42001
sources:
  - netlify/functions/admin.mjs (postList, postHide, postPin, postReply, postDelete — the 402 for delete), _community.mjs (moderate, shapeForOwner, reportPost), _plan.mjs (moderateAllowed), venueadmin.mjs (the same four, CREW_OK / MANAGER_OK)
  - MYSET-MASTER-OVERVIEW.md §3.7, §2.2 (what the flag gates)
  - SECURITY.md § The threat model #2 (no platform-wide moderation queue)
  - INVARIANTS.md 15k
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections)
verified: code read 2026-09-12 (admin.mjs post actions and the 402; _community.mjs moderate — hiding strips media on the way in; venueadmin.mjs role sets)
---

# Moderating the page

**Who:** the page's owner — an artist (Studio → Profile tab) or a venue's manager/crew (Venue Studio → Merch tab). **Trigger:** a new post, a report count, or something that should not be there. **Outcome:** the page says what the owner is willing to stand behind: replied to, pinned, hidden the second it is seen — on **any** plan — or deleted for good on a paid one. **There is no platform-wide moderation queue**: if something must come off MySet itself, the founder does it by hand (SECURITY.md threat #2, Tier 2).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| g01 | Read the page as its owner | notification | Automation | MySet server R · Artist I | Netlify | `postList` → `shapeForOwner`: every post including hidden ones, with its report count — still never a device id. Moderation is **free on every plan**. `src: admin.mjs postList; _community.mjs shapeForOwner` |
| g02 | Reply | task | Person | Artist R · Fan I | Netlify | `postReply` — one reply per post, in the owner's own words, up to `MAX_REPLY`; an empty text removes it. Shown under the post on the public page. `src: _community.mjs moderate postReply` |
| g03 | Pin | task | Person | Artist R | Netlify | `postPin` — pinned posts lead the feed. `src: _community.mjs moderate postPin` |
| g04 | Hide — instant, undoable, on every plan | task | Person | Artist R · Fan I | Netlify | `postHide` — the post leaves the public shape at once. On the way **in**, its photos and clip are stripped and dropped from storage, so a hidden post stops costing bytes; un-hiding restores the words, not the media, and never tries to delete anything. *An artist on any plan must be able to take something offensive off their page the second they see it.* `src: _community.mjs moderate postHide; admin.mjs comment` |
| g05 | Delete for good — a paid feature | conditional | Person | Artist R · MySet server R | Netlify | `postDelete` → `moderateAllowed(aid, limits)`: refused with **402** on the free plan — *"Deleting a post for good is a Plus feature — you can hide it on any plan, and hiding is instant and undoable."* Refused here as well as greyed in the Studio, because a limit only the page enforces is not a limit (INVARIANT 15k). Which plans include it is the ladder in overview §2.1. `src: admin.mjs postDelete; _plan.mjs moderateAllowed; overview §2.2` |
| g06 | Read the report count | conditional | Person | Artist R · Fan I | Netlify | A report is one per device, a count the owner sees, **never a takedown** — nothing is hidden automatically. The owner decides with g04 or g05. `src: _community.mjs reportPost` |
| g07 | A venue moderates the same way | alias | Person | Venue manager R | Netlify | `venueadmin.mjs`: `postList` and `postReply` for crew (`CREW_OK`), `postHide`/`postPin`/`postDelete` for managers and the owner (`MANAGER_OK`), on `posts_v_<vid>`. → *Venue lifecycle → A venue's page* n09. `src: venueadmin.mjs 37–43, 539–545` |
| g08 | Take something off MySet itself | task | Person | Founder R · Artist I | — | **Draft — nothing exists.** If an artist posts something MySet must remove (or ignores a report on their own page), the only lever is the founder deleting it by hand through the owner's tools. A platform-level queue of reported posts is SECURITY.md Tier 2 — *"so removal is not the founder, by hand"*. `src: SECURITY.md § The threat model #2, Tier 2` |

## Connections

g01 → g02; g01 → g03; g01 → g06 → g04; g04 —for good→ g05; g05 —free plan→ *402, hide instead*; g07 aliases g01–g06; g06 —beyond the owner→ g08 (Draft).
