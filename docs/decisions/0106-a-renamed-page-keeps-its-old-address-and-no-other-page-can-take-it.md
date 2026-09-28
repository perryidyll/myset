---
id: 0106
title: A renamed page, an artist's or a venue's, keeps answering at its old address, and no other page can take that address
date: 2026-09-28
status: decided
decided_by: claude
area: auth
reverses:
superseded_by:
invariants: [0di]
commits: [c940a6e]
tests: [test/accounts.mjs, test/samples.mjs]
files: [netlify/functions/auth.mjs, netlify/functions/_auth.mjs, netlify/functions/venueauth.mjs, netlify/functions/_venues.mjs, netlify/functions/_venueaccount.mjs, netlify/functions/_sample.mjs, public/studio.js, public/venue-studio.js]
---

## The question

The founder asked whether an artist or a venue can choose their own page address, or whether it is always the name MySet picked at signup (2026-09-28, while approving the sample pages). Both Studios already had the field, sixteen sections down the artist's Settings, so the founder had never found it. Making it easy to find meant checking the promise the artist Studio makes beside it: "the old one keeps working too, so QR codes already printed still land here". That held for artists (`oldSlug`, INVARIANT 0di), but it had two holes. A venue rename deleted the old address outright, so every code a bar had printed stopped working. And INVARIANT 0di said an old address is "not claimable while it is there", but `setSlug` and `pickSlug` only checked `bySlug`. A second artist page could take a name that tables still carried on printed codes, and from then on those codes opened the wrong artist's page.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Venues get `oldSlug` like artists (written by `setSlug`, read by `venueBySlug`, cleared when the venue is deleted). Every name-picker (`pickSlug`, `pickVenueSlug`, the sample picker) and both `setSlug` doors refuse another page's old address. The page that had it can take it back | Old addresses are held for good, so a few names are never free again | One map on the venue registry | A name nobody uses stays held. Harmless, and the founder can free it by hand |
| B | Hold old addresses for a year, then free them | A clock, and a printed code that dies after a year while it is still on a table | A sweep | A room scans a code from last year and lands on a stranger's page |
| C | Hide the field so nobody renames | Contradicts what the founder asked for | — | The founder's ask is not met |
| D — do nothing | Make the field easy to find and leave the holes | — | — | A bar renames and its printed codes 404, or one artist's codes open another artist's page, mid-gig |

## What was chosen, and why

A. A printed code is the one link nobody can update, and it sits on a bar table for months. So a rename must never break one, and no other page may ever answer at an old address. The artist side already did the first half. This adds the second half there and brings both halves to venues. The Settings section is renamed **Your page link** and moved to the top of both Studios' Settings, because an address you cannot find is not really a choice. The page that owned an address can always take it back.

## What this makes harder

Names are held forever once used. A popular name renamed away from stays out of reach for newcomers, who get the next free variant. The venue registry grows by one small entry per rename.

## What would reverse it

Name scarcity that matters, for example a real act asking for a name another page abandoned years ago. Free it by hand with the owner's agreement, or add a long expiry (option B) once printed codes have a known lifetime.

## How it was verified

`test/accounts.mjs` (89 checks):
- Another artist cannot take the name Rita's printed codes carry, and those codes still land on her page.
- She can take her own old name back. The name she left then answers for her, and neither a signup nor another page is handed it.
- A venue renamed to `cornerbarkp` resolves at both the new and the old address. Another venue cannot take the old one, and the owner can take it back.

With the new check removed from `auth.mjs`, "THE BUG: another page cannot take the name her printed codes carry" fails. So the hole was real, and it was live until this ships. `test/samples.mjs` confirms that the sample picker skips old venue addresses too.

The two Settings sections were walked on `tools/localhost.mjs` at 375 px. Not checked: the live site.
