---
id: 0176
title: The audience finds an artist through two small copies of their line of the list — one per page address, one per artist — and the list stays the truth; sign-in, roles and prices never read a copy
date: 2026-10-03
status: proposed
decided_by: agent-recommended
area: scale
reverses:
superseded_by:
invariants: [0ip, 0hp, 0im, 0hs]
commits: [2969e5c]
tests: [test/lookups.mjs, test/cost.mjs, test/storefail.mjs, test/background.mjs]
files: [netlify/functions/_lookup.mjs, netlify/functions/_auth.mjs, netlify/functions/_lib.mjs, netlify/functions/_account.mjs, netlify/functions/_mirror.mjs, netlify/functions/citycron.mjs, netlify/functions/me.mjs, test/lookups.mjs, test/cost.mjs, test/storefail.mjs, test/background.mjs, test/run.sh]
---

## The question

One document, `artists`, holds every artist: `byId`, `bySlug`, `byEmail`, `oldSlug`. The scale audit of 2 October 2026: *"The whole artist list is read on every poll, vote and Studio call. 1,000 artists: about 215 to 300 KB per request. 10,000: 2 to 3 MB, thousands of times a second."* Its fix: *"Now: cache it for 60 s inside each function instance (done, 0141). Then: one small file per slug, per artist and per email."*

After 0141 the audience path still read the whole list in two places:

- **A cold instance**, or a warm one once a minute, to turn a page address into an artist (`publicArtist`, on every poll, vote and page load).
- **Every vote and every board render**, to put the artist's name on the show (`getShow` → `artistById`, never cached). The board is drawn once per polling interval for the whole room, but a vote is one per tap.

The founder asked for as much of the audit as could be built safely overnight. This is the safe first step of the split, not the whole of it.

## Every reader of the list, and what each asks

A **lookup** asks about one artist; a **walk** needs all of them.

| Reader | Asks | How often | Tonight |
|---|---|---|---|
| `publicArtist` (`_lib.mjs`): every audience endpoint (`me`, `vote`, `board`, `show`, `songs`, `fan`, `community`, `profile`, `diary`, `lyrics`, `request`, `rsvp`, `gift`, `feedback`, `confirm`, `bug`, `clipup`, `messages`, `pay`, the `/:slug` share card) | address → artist, and is it leaving | every poll, vote and page load | **The two copies**; the list when they cannot say yes |
| `artistById` (`_auth.mjs`) → `getShow`'s name (board, vote, legacy poll, diary, profile), `stage.mjs`, `profile.mjs`, `diary.mjs`, `pay.mjs` (the address to come back to), `messages.mjs`, `_messages.mjs`, `_gigok.mjs`, `_ordernote.mjs`, `qr.mjs`, `admin.mjs` (genre fill, owner name, and `setCode`'s rule that a code may not be the page's own name) | artist → name, address, first name, tick, plan for the tick, joined | every vote and board render; the Studio poll | **The artist's copy**; the list when it is not there. `setCode` should read the list; that one line waits for PR #150, which changes the lines beside it |
| `verifyToken` (`_auth.mjs`) | email → artist, role, seat access; the row's `rev` and `dead` | every signed-in request | **The list**: it grants access (0dd) |
| `deletionOf` (`_lib.mjs`): the Studio's leaving gate, `_auto.mjs` | artist → leaving | every Studio action | **The list**: it gates access |
| `planForArtist` (`_plan.mjs`), `_billing.mjs` `readOwner` | artist → plan | prices, limits, billing | **The list**: money (0141). `_billing.mjs` is not this session's file |
| `artistBySlug` (`_auth.mjs`): `requireArtist`'s code door, `auth.mjs` passkey and recovery sign-in, `img.mjs`, `vid.mjs`, `qr.mjs` | address → artist (no leaving check) | sign-in; an image, clip or code addressed by name (rare: pages build the id) | **The list**: the sign-in doors grant access; the three media doors keep its exact answer (a leaving page's photo still loads) |
| `auth.mjs`: codes, sign-up, password, members, address change, the Settings read-back | email, artist | sign-in and Settings | **The list** |
| `_push.mjs` `registryOf` | email → seat | who hears an alert | **The list**: who hears what is access |
| `_ordernote.mjs`, `_messages.mjs` | artist → owner email addresses | an order or a message mailed | **The list**: no email copy is built |
| `_vstats.mjs` | a city's artists → `shareStats`, name | a venue's stats | **The list**: `shareStats` is consent |
| `_verify.mjs`, `_plan.mjs` `rewardReferrer`, `admin.mjs` (ID queue, venue side, earnings start) | one artist | founder or billing, rare | **The list** |
| `venue.mjs`, `events.mjs` | the few artists a venue page or a city's feed shows → name, address | public pages, once per page (0174) | **The list**, once a page. Next: the artists' copies, by id |
| `keysFor`, `exportArtist` (`_account.mjs`) | artist → address, emails | purge, export, the nightly copy | **The list**; `keysFor` now also names the copies |
| `pickSlug` / `createArtist`, `pickSampleSlug`, `claimSampleArtist` | is a name free | sign-up, sample pages | walk (every name) |
| `_auto.mjs` daily pass, `_lifecycle.mjs` `walkLive`, `_register.mjs`, `_warehouse.mjs` sheet sync, `_events.mjs` `healCityIndex`, `mirrorcron`, `hq.mjs`, `artists.mjs` (Find artists), `auth.mjs` invited count | every artist | bells, founder tools, one public directory | walk |
| `healLookups` (new, `_lookup.mjs`) | every artist | `citycron` | walk |
| `tools/`: `localhost.mjs`, `roomsim.mjs`, `metrics.mjs`, `prod.py`, `backup.py`, `actuals.py` | every artist | the founder's laptop | walk |

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | Two small kinds of copy, `aslug_<slug>` and `arow_<aid>`, written by `mutateArtists` after the list's write. The public address lookup and `artistById` read them first; anything missing, unreadable, disagreeing or leaving is asked of the list. A heal from `citycron` rewrites a lost copy. Sign-in, roles, the leaving gate and prices stay on the list | Up to two small reads on a cold lookup instead of the whole list; one small read for a name; one write per changed copy on every list write; a heal pass every six hours | `_lookup.mjs`; `seq` on the list; two key families and the heal's cursor | A copy whose write was lost answers a stale yes until the heal (bounded, tested, and the same kind 0141's minute allowed) |
| B | The same, and an email copy, with sign-in reading the copies | The Studio stops reading the list too | The email family, and a proof that a copy is current | A copy cannot prove it is current without reading the list. A stale `rev` or `dead` would let a signed-out device back in (breaks 0dd). Not safe tonight |
| C | Split the list for real: the copies become the truth and `artists` goes | The audit's end state | A migration of every reader in the table above, all the walks, and every sign-in path | Days of work and the sign-in path in the middle of it; not a night's change |
| D — do nothing more | 0141's minute-old copy only | — | — | Every vote reads the whole list for a name; a cold instance reads it for an address. 356 KB at 1,000 artists and 3.6 MB at 10,000 on the synthetic list below |

## What was chosen, and why

A.

- **The list stays the truth.** Every copy is written after the list's write has landed, from what that write produced. A copy that is missing, unreadable, or whose two halves disagree sends the reader to the list. Nothing reads a copy to decide who may sign in, what a seat may do, whether a leaving account may act, or what to charge.
- **One writer.** `mutateArtists` fingerprints the copies before `fn` runs, inside each attempt of its compare-and-set. Once the write lands it rewrites the copies that changed and deletes the ones that lost their row or address. Every caller is covered, including `_billing.mjs`, which this session may not edit. A copy that fails never fails the change; the caller is not told.
- **A yes needs two agreeing copies.** The address's copy names an artist. That artist's copy must exist, must not be leaving, and must list the address. So a stale address copy alone (a freed name, an undone claim) can never send a room to the wrong artist: the row copy has to be stale too.
- **Leaving is asked of the list.** A copy that says `del` is not a no. The list is asked, as 0141 asks a no, so an undone deletion comes back at once.
- **A version, not a clock.** `seq` on the list goes up with every write and never falls behind `Date.now()`. A copy carries the version it was made from, and a copy made from an older list never overwrites a newer one (`putLookup`). `rev` could not do this: it is what signs devices out, and moving it would sign out every account whose row has no `rev` of its own.
- **The copies leave out the two sign-in facts.** `rev` and `dead` stay on the list alone, so no copy can say a device is signed in. A sign-out does not rewrite a copy nobody reads it from. No copy holds an email address.
- **The heal.** `healLookups`, rung by `citycron` beside the city index's heal and caught on its own, rewrites any copy that differs from the list. It runs a pass at most every `HEAL_GAP_MS` (six hours), stops at its budget after at least one batch, and carries on from the artist after the last it finished. It never overwrites a copy newer than its read of the list, unless that copy's version is also more than `ROLLBACK_MS` older than the read. That combination cannot come from a write made since; it means the list was put back from a backup, and then the list wins. Each pass starts with the sample register: a page whose claim was undone is on that register and off the list, so its leftover copies are found and deleted. A pass over the list alone would never meet them.
- **A purge deletes them as leaves.** `keysFor` names the artist's copies (`lookupKeys`), so the purge (0173: leaves first, index last) deletes them before the row that names them goes. The final list write deletes them again if they came back.
- **Renames (0106).** An old address keeps its copy, pointing at the same artist, and the artist's copy lists every address that answers for it. Taking an old name back changes only the row copy.
- **Samples (0101).** Not on the list, so no copies. A claim writes them like any sign-up; an undo deletes them; the heal deletes what a killed undo left.
- **Never copied off-site.** FAMILIES says `skip`: the copies are rebuilt from `artists`, which is copied. A copy restored beside a list from a different moment is the one way the two could disagree.
- **0141's minute-old copy of the list is kept, as the second place to look.** Until the first heal pass has written every copy, it keeps a warm instance from reading the list once per address. A yes from either source is kept a minute per instance (`publicSlug`), so a room's polls still cost no read on a warm instance. A no read from a copy loaded during this very request is not asked twice (`publicCopyAt`): with the copies answering first, that copy is usually cold when it is needed.

### What a poll reads, measured

`test/lookups.mjs` builds a synthetic list shaped like production's rows (the fields `createArtist` writes, plus a plan, a first name, a tick and a revision; one owner address each, a band mate on one in five, an old address on one in ten). The audit measured production-shaped rows at 215 to 300 KB per 1,000.

| Artists | The list (read by a cold address lookup, and by every vote's name lookup until now) | A cold address lookup now (two files) | A name lookup now (one file) |
|---|---|---|---|
| 1,000 | 356 KB | 292 bytes | 245 bytes |
| 10,000 | 3,630 KB | 296 bytes | 248 bytes |

A warm instance still reads nothing for an address it answered in the last minute. `test/cost.mjs`: the board, the legacy poll and a vote in a slug artist's room touch no global document (the board touched the list until now); every other ceiling is unchanged (board 14, personal poll 2, vote 4, rename 10, Studio poll 21).

## What this makes harder

- **One stale yes, until the heal.** If a list write lands and its copy's write is lost (the function dies between them, or the store refuses), the copy answers for the old state until the heal rewrites it: within `HEAL_GAP_MS` at today's size, longer at 10,000 artists, where a pass spans rings. The case that matters is a deletion: the page can stay open past the day it was asked. 0141 allowed the same kind of answer for one minute; this allows it for hours, and only after a lost write. A wrong artist needs both copies wrong at once.
- **Every list write fingerprints the whole list twice:** about 14 ms each at 10,000 artists, inside the compare-and-set, so a busy list's window for a conflict is slightly longer.
- **An address nobody has still reads the whole list,** as it did under 0141. A no is never taken from a copy, because a page made a second ago, or one whose copy was lost, must still open. So a flood of made-up addresses costs what it always did: one small read more, and no less.
- **A page that is not on the list** (a sample's Studio) pays one small read before the list answers its name.
- **`setCode` read the page's name from the copy** until PR #150 landed (`e996865`, 2026-10-09), because #150 changed the lines around it; a rename whose copy write was lost would have let the new name through as a code until the heal. That rule is about a code's strength, not who may sign in, and the old name it still refuses still opens the page. Since #257, the same day, it reads the list: `(own((await readArtists()).byId, aid) || {}).slug`. `test/studiocode.mjs` loses a renamed page's copy writes and sees the new name refused.
- **A new reader of the list must choose.** Use a copy (`artistById`, `publicArtist`) only for a public answer or a name. For sign-in, a role, the leaving gate, consent or money, use `readArtists()`.
- **A new field on a row** reaches the copies with the next write to that row, or the heal. `rev` and `dead` never do.

## What would reverse it

- **The next step (C):** an email copy, and sign-in reading it, with a design that proves a copy current (for example, the copies become the truth and `artists` becomes the index). Then 0141's minute-old copy goes, and the walks move to a cursor over the copies. Until then this is a cache that heals itself.
- If a lost copy write is ever seen to keep a deleted page open, shorten `HEAL_GAP_MS`, or have `startDeletion` re-write the row copy itself.

## Found here, not changed

- `cancelDeletion` gives a freed address back only when no row has that id, and an artist's own row usually does: her id is the address she signed up with. So Undo after *Free up my address* never returns it (it reports `slugLost`). `test/lookups.mjs` shows the copies agreeing with the list either way.
- `deleteArtist` removes the row and its current address, but not the `oldSlug` entries that point at it. A purged page's old name still resolves to its id on the list path: a room with nothing in it. No copy is made for a name whose row is gone, so the copies do not change this.
- A signed-in Studio action reads the whole list three times: `verifyToken`, `deletionOf`, `planForArtist`. The first already holds the row. Reusing it is the cheapest next step for the Studio.
- `venues` has the same shape and the same growth, and is untouched.

## How it was verified

- `node --import ./test/register.mjs test/lookups.mjs`: 75 ✓, 0 ✗. Sections: the writer (version, contents, no `rev`, `dead` or email on any copy, a sign-out writes no copy), the public lookup (two small reads cold, none warm, one for a name, a no asked of the list), a rename and taking the old name back through `auth.mjs` `setSlug`, leaving, Undo and freeing the address through `_account.mjs`, the purge through `keysFor` and `deleteArtist`, a sample claimed, undone, claimed again and undone by a function that dies before its deletes (the heal removes what it left), lost and unreadable copies, two disagreeing copies, a lost deletion copy (the stale yes) and its heal, a slow writer finishing late, sign-in with wrecked copies and a device signed out, the heal (all lost, one newer kept, a list put back from a backup, no budget at all over many rings), `citycron` ringing it (and surviving its failure), and the measurement above.
- Twelve knock-outs, each red, each restored: `publicArtist` skipping the copies (17 red); `mutateArtists` writing none (3, then a crash); a leaving copy taken as a yes (2); the two copies not checked against each other (1); an older copy overwriting a newer (1); the heal overwriting a newer copy (1); the heal ignoring a restored list (1); the heal skipping the sample register (2); `keysFor` not naming the copies (1); the copy carrying `rev` and `dead` (1); a no read from the list twice (`test/cost.mjs`, 1); `artistById` reading the list (`test/cost.mjs`, 1).
- Changed tests: `test/cost.mjs` gives the founding page a row on the list, as production has (without it the founding page pays one small miss before the list, which no real page does). Its slug-room section writes "another instance's" change the way another instance now does: list, then copies. `test/storefail.mjs`: with the list unreadable a slug artist's room now answers from its copies (200). With the copies unreadable too it is 503, never "unknown artist". `test/background.mjs`: its count of what the mirror copies leaves the two new `skip` families out.
- `sh test/run.sh`: exit 0 (session note).
- **Not checked:** the real store's latency for two small reads against one large one; how often a real copy write is lost; the first heal pass against production (it writes every copy once: six artists today); a real room; how long Netlify keeps an instance warm, which decides how often the minute's yes is asked again. Nothing in `public/` changed.
