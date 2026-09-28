---
tab: Community & media
section: Photos on a page
puzzle_section_id: 42002
sources:
  - netlify/functions/_img.mjs (SLOTS, MERCH_SLOT, POST_SLOT, CLIP_SLOT, MAX_BYTES, putImage, dropImage, the idcheck exclusion), img.mjs (the ?v= stamp, a year immutable, the v_ prefix rule), admin.mjs (photoUpload, photoClear, MAX_PHOTOS), _profile.mjs normProfile (slots are addresses; trailing blanks), venueadmin.mjs photoUpload (count per plan)
  - public/studio.html (openCrop — "Position your photo")
  - MYSET-MASTER-OVERVIEW.md §5.8 Photos; §2.1 (photo counts per plan)
  - INVARIANTS.md 0bz, 0bk
status: loaded
loaded: 2026-09-12 (create_process; read back through list_sections)
verified: code read 2026-09-12 (_img.mjs slot families and MAX_BYTES; admin.mjs photoUpload; img.mjs cache headers; studio.html crop sheet)
---

# Photos on a page

**Who:** an artist or venue in their Studio; a fan on a post. **Trigger:** *Add a photo*. **Outcome:** a picture that is shrunk and framed on the phone before a byte leaves it, stored under an address the record owns, and served back cached for a year without ever going stale. A phone photo is almost never framed for a square, and letting the app centre-crop it silently cuts people's heads off — so the person positions it.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| i01 | Position the photo | form | Person | Artist R | Netlify | Studio → *Position your photo*: drag to move, pinch or slide to zoom, inside a frame that is square for an avatar or gallery slot and 16:10 for the cover. The browser then shrinks it — a camera file is 3–5 MB and none of that detail survives being drawn 130 px wide — so what arrives is a few hundred KB. `src: studio.html openCrop` |
| i02 | Refuse what is too big or not a picture | conditional | Automation | MySet server R · Artist I | Netlify | `decodeDataUrl` → `MAX_BYTES` (the server refuses anything over it — the phone's shrinking is a courtesy, not the control), and only image types. `src: _img.mjs decodeDataUrl, MAX_BYTES` |
| i03 | Store it under a slot | database | Automation | MySet server R | Netlify | `putImage(owner, slot, bytes)` → `img_<owner>_<slot>`. Slot **names** are a fixed list (`cover`, `avatar`, `p0…p11`) plus three families by pattern — merch (`m…`), post photos (`c…_0-2`), clip posters (`k…`). **The list of valid names is not a limit on anybody** — it once was by accident: widening it for venue Pro uncapped the artist endpoint (INVARIANT 0bz). The two real caps live where the answer is known: how many a record may *hold* (`normProfile` / `normVenue`) and who may *write* the next one (`MAX_PHOTOS` in `admin.mjs`; the venue's plan in `venueadmin.mjs` — counts in §2.1). `src: _img.mjs; admin.mjs photoUpload` |
| i04 | Slots are addresses, not a list | database | Automation | MySet server R | Netlify | `profile.photos[i] = url` — a photo in slot 3 with slot 2 empty stays in slot 3. Both normalisers used to `.filter(Boolean)`, which compacted the array, so a venue with slots 1 and 3 filled had slot 3's picture drawn in slot 2. Only **trailing** blanks are dropped now. `src: _profile.mjs normProfile 102–106; overview §5.8` |
| i05 | Serve it, cached for a year | webpage | Automation | MySet server R · Fan I | Netlify | `/api/img?a=<owner>&s=<slot>&v=<stamp>` — the `?v=` changes on every upload, so the bytes carry `max-age` of a year, `immutable`, durable at the edge, and still update instantly. A venue's photos live under `v_<id>`; ids and slugs are stripped to `[a-z0-9-]`, so an underscore can only ever mean a venue — nothing can dress itself up as the other kind. `src: img.mjs` |
| i06 | Never serve the ID photo | task | Automation | MySet server R | Netlify | The `idcheck` slot is excluded from every pattern `/api/img` will serve — a verification photo cannot be fetched by anyone, including us, through the web (INVARIANT 0bk). Encrypting it at rest is → *Reliability & security → The doors* h08 (Draft). `src: _img.mjs isSlot; INVARIANT 0bk` |
| i07 | Clear a slot | task | Person | Artist R | Netlify | `photoClear` → `dropImage` and the slot emptied; a hidden or removed post drops its photos the same way (→ *Moderating the page* g04). `src: admin.mjs photoClear` |
| i08 | A fan's post photos | alias | Person | Fan R | Netlify | Up to `MAX_PHOTOS` per post, shrunk on the phone, under `c<postId>_<0-2>`; → *Saying something about a night* w04. `src: _img.mjs POST_SLOT; _community.mjs addPost` |

## Connections

i01 → i02 → i03 → i04 → i05; i03 —idcheck→ i06; i07; i08 aliases i02 → i03 → i05.
