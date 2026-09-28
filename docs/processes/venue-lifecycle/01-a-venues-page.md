---
tab: Venue lifecycle
section: A venue's page, from claim to listing
puzzle_section_id: 41983
sources:
  - netlify/functions/venueauth.mjs (start, verify, claim, me, sessions, roleSet, add, remove, revokeAll, setSlug, checkDomain), venueadmin.mjs (set, hours, amenity, photoUpload, menuSet/Add/Remove, offerSave/Remove, eventSave/Delete/Skip, stats, planGet…, accountExport/Delete/Undelete), venue.mjs, _venues.mjs, _events.mjs (isVenueOwner)
  - MYSET-MASTER-OVERVIEW.md §3.1 (routes), §3.6, §2.5 (venue ladder)
  - VERIFYING-A-VENUE.md (the two states)
  - ACCOUNTS.md §3 (venues getting paid), §6.3 (roles), §6.6
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (venueauth.mjs header and action list; venueadmin.mjs role sets)
---

# A venue's page, from claim to listing

**Who:** a bar or restaurant that books live music (role *Venue manager*, external). **Trigger:** `/venues` — the Venue Studio. **Outcome:** a public page at `/v/<slug>` with what's on, hours, offers, photos and a community page — honest about what MySet knows (an *Unverified listing* chip until earned), and reachable by artists who want to pitch.

**A venue page can be claimed by anyone with an email address. That is deliberate** — asking for proof before a page exists means no pages exist. Nothing is hidden while unverified; the chip is the whole difference. The venue ladder (two rows, Free and Pro; cuts, photos, tick) is generated into overview §2.1.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| n01 | Sign in as a venue | conditional | Person | Venue manager R · MySet server R | Resend | `venueauth`: the same email-and-a-code flow as artists, **in its own realm** — separate registry, token tag and one-time-code key, so the same address can run an artist page and a venue page without either reaching the other. `openV` is the one place a venue session opens, twinned with the artist's `open` so the two doors cannot drift. Roles: owner / manager / crew (`CREW_OK` / `MANAGER_OK` sets in `venueadmin.mjs`; the orphan `staff` retired into crew). `src: venueauth.mjs; venueadmin.mjs 37–39; ACCOUNTS.md §6.3` |
| n02 | Claim the page | form | Person | Venue manager R · MySet server R | Netlify | `claim {ticket, name, slug}` after proving the inbox: `createVenue` mints `v_<vid>`, a slug under `/v/` (the `v` namespace is reserved so artists can never shadow it), the venue registry rows. `src: venueauth.mjs claim; overview §3.1` |
| n03 | Fill in the Page tab | form | Person | Venue manager R | Netlify | Name, tagline, about, address, map link, phone, WhatsApp, links, photos (count per plan in §2.1), the amenities list. Saving a website runs the verification check on its own (→ *Getting verified*). A literal private IP in a website is refused at storage time so it is never rendered as a link. `src: venueadmin.mjs set/photoUpload/amenity; overview §3.6; VERIFYING-A-VENUE.md` |
| n04 | List what's on | form | Person | Venue manager R · Fan I | Netlify | *What's on*: the venue's own events on the same calendar engine artists use (`eventSave` / `eventDelete` / `eventSkip`, repeats, one-off cancels). **Venue-owned events are never shows** — the scheduler skips `v_…` owners — and gigs and venues are matched by **name within a city, never by a stored link**, so neither side can break the other. `src: _events.mjs isVenueOwner; _auto.mjs; overview §3.6` |
| n05 | Menu, offers and hours | form | Person | Venue manager R | Netlify | `menuSet` / `menuAdd` / `menuRemove`, `offerSave` / `offerRemove`, `hours`. Shown on the public page beside directions and the community pill. `src: venueadmin.mjs; overview §3.6` |
| n06 | See the numbers | notification | Automation | MySet server R · Venue manager I | Netlify | *Numbers*: how many people were in the room on live-music nights — read from the artists' shows matched to this venue by name and city (never fan ids). `src: venueadmin.mjs stats; overview §3.6` |
| n07 | Read the pitches | go_to | Person | Venue manager R | Netlify | → *Pitches* — only signed-in artists with a page can pitch, so a stranger cannot spam a bar. `src: venueadmin.mjs pitchList` |
| n08 | Get paid, sell merch, pay for Pro | go_to | Person | Venue manager R | Stripe | The same Stripe Connect Express flow as artists, keyed `v_<vid>`; merch and orders on the Merch tab (Pro); plans, retention and portal through the same `_billing.mjs`. → *Money → Stripe Connect Onboarding & Payments*, *Merch orders*, *Plans and billing*, *How a payment divides* (venue rows split Stripe's fee). `src: ACCOUNTS.md §3` |
| n09 | Moderate the community page | task | Person | Venue manager R | Netlify | The venue's community page (`/v/<slug>/community`): reply, pin, hide, delete (`postList`, `postReply`, `postDelete`), from the Merch tab. → *Community & media*. `src: venueadmin.mjs; overview §3.6` |
| n10 | Serve the public page | webpage | Automation | MySet server R · Fan I | Netlify | `/v/<slug>` → `venue.html`: photos, tagline, about, what's on, hours, offers, amenities, directions, the badge if earned or the grey *Unverified listing* chip with a line offering the real owner a way to claim it, a **Community** pill, the artists' *vouch* button. `src: venue.mjs; venue.html; VERIFYING-A-VENUE.md` |
| n11 | Leave | go_to | Person | Venue manager R | Netlify | Export, two-screen delete, lockdown, undo and purge exactly as artists, on `keysForVenue()`. → *Artist lifecycle → Leaving* q09. `src: ACCOUNTS.md §6.6` |

## Connections

n01 → n02 → n03 → n10; n03 → n04 → n10; n03 → n05 → n10; n10 → n06; n10 → n07; n03 → n08; n10 → n09; n01 → n11.
