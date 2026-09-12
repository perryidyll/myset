---
id: 0056
title: Fans can RSVP to a listed show without an account
date: 2026-09-12
status: decided
decided_by: perry
area: general
reverses:
superseded_by:
invariants: [0fl]
commits: []
tests: [rsvp.mjs]
files: [netlify/functions/_rsvp.mjs, netlify/functions/rsvp.mjs, netlify/functions/events.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, public/artist.html, public/index.html]
---

## The question

The founder asked (2026-09-12) for an RSVP button on every listed night — the artist page's diary and the front door's city feed — with a "12 going" line under it, so a room has some sense of itself before the night and an artist has some sense of who is turning up. The audience never signs in (INVARIANT 9g), so the fan pressing it has nothing but the anonymous id the vote page keeps in the browser. What had to be decided is what a count made of anonymous taps IS, what gets stored to make it, and where it lives so that the two feeds can carry it without a new read per row.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | One document per owner (`rsvp_<artistId>` or `rsvp_v_<venueId>`) holding, per `eventId\|date`, a count and a set of 16-hex prefixes of the hashed fan id; toggled by `POST /api/rsvp`; the count rides on every feed row from the same `Promise.all` that reads the owner's events | one more small document per owner, one extra parallel read per owner on the diary and the city feed, one CAS write per tap that changes something | `_rsvp.mjs`, `rsvp.mjs`, a field on the row | a count nobody should trust is trusted anyway (see below) |
| B | One document per occurrence (`rsvp_<owner>_<eventId>_<date>`) | one read per ROW on the city feed — a busy city is dozens; a weekly residency is fifty-two documents with no way to find them but `list()` (INVARIANT 1) | a key per night | the feed's cost scales with rows, which is the mistake this project keeps making |
| C | Store the raw fan id, so a fan's own RSVPs can be read back from the server | nothing at write time | a per-fan read path | a document copied into every backup and read on every feed run that ties nights to phones; the vote shards never did this and the RSVP is not the place to start |
| D | Require an account or an email to RSVP | a real headcount | sign-in on the fan side | the design the whole product exists to avoid (INVARIANT 9g) |
| E — do nothing | No button | — | — | the founder's ask stays unmet |

## What was chosen, and why

A, because the founder asked for it and because it is the only shape that costs the feeds nothing extra per row. The diary and the city feed already read one `ev_<owner>` document per owner; the counts are one more document read in the same hop (`Promise.all`), so a city with thirty owners is thirty parallel pairs, not thirty plus rows.

**What is stored** is `{ v:1, occ: { '<eventId>|<date>': { n, fans: { <sha256(fanId).slice(0,16)>: <ms> } } } }`. The fan is hashed because the document is read into the public feed's function and copied by the weekly backup (decision 0046), and a raw device id in either is the one thing that could tie a night to a phone; the prefix is kept, rather than nothing, so that the same phone tapping twice counts once and tapping again takes itself off. Nights more than three days gone are pruned on write, so a residency's document stays the size of its calendar ahead. A night holds at most 5000 fans; past that a new "coming" is a no-op that still answers the count, so the button never leads to a shrug.

**What a count is:** a social signal — "some people said they are coming". **What it is not:** a headcount, a ticket, a promise, money, or identity. The id is self-chosen by the browser, so a script with a fresh id per call inflates it at will, and a cleared browser forgets it was going. INVARIANT 0fl says this once so nothing downstream — a venue's planning, a plan tier, a payout — ever leans on it.

**Why the server checks the night:** `rsvp.mjs` only counts an `(eventId, date)` that `occurrencesFor` produces for that owner, whose `endsAt` is still ahead, and whose date is no further out than the diary's own cap (`HORIZON_DAYS`, 120 — the diary reads the same constant, so the two cannot drift). A count on a gig nobody listed is a number somebody would eventually depend on by accident, the same reason `_owner` never leaves the feed; and without the far edge a weekly rule would answer for any Tuesday in 2034, a night no page offers, growing the document by one night per anonymous POST. The key is in `keysFor` and `keysForVenue` (INVARIANT 0cy), so deleting the account takes the hashes with it — the first review found them left behind.

## What this makes harder

A fan cannot see their own RSVPs from another device: the server holds only a hash, so the page keeps its own memory in `localStorage` (`myset.rsvp`) and trusts the reply. The document is per owner, so "everything this fan is going to" is not a question the store can answer, by design. The feed's row shape grew a field, which every consumer (the artist page, the front door, the vote page's countdown) now sees whether it draws it or not.

## What would reverse it

A venue or an artist asking to plan on the number — capacity, a door list, a guarantee — which would mean a real headcount and therefore option D for that feature, not a change to this one. Or a city feed whose per-owner pair of reads shows up on the bill, which would argue for folding the counts into the `ev_` document itself (one read, but a hot write path shared with the Studio's calendar edits).

## How it was verified

`test/rsvp.mjs` (`sh test/run.sh` § who says they are coming): fan A on → `{on:true,n:1}`, A again → 1, B → 2, A off → 1, A off again → 1; the diary row, the same diary through `/api/fan?what=events`, and the city-feed row all carry `rsvp:1`, and a night nobody answered carries `0`; a venue's own event via `?v=` counts under `rsvp_v_<venueId>`, separately; unknown event, finished night, wrong date, unknown artist and unknown venue are 404; a short fan id, a non-boolean `on`, a bad date, no owner, and unparseable JSON are 400; GET is 405; the stored document under `rsvp_<artistId>` contains neither fan id in full and only the 16-char prefix of the hash; a pre-filled night from 2020 is pruned by the next write; a night pre-filled to 5000 answers `{on:false,n:5000}` and stays at 5000; a weekly rule's night 200 days out is 404 and adds nothing to the document while its night inside the horizon is 200; after `deleteArtist` and `deleteVenue` no key carries either id — `45 passed, 0 failed`. Not checked: the real edge cache carrying the new field (the diary and feed replies are `jsonCached`, so a count is up to thirty or sixty seconds stale on a shared read; the tap's own reply is `json`, never cached).
