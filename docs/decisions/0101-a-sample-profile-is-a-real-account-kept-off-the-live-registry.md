---
id: 0101
title: A sample profile is a real account kept off the live registry until its owner claims it from the link we sent them
date: 2026-09-28
status: decided
decided_by: user-confirmed
area: auth
reverses:
superseded_by:
invariants: [0gm]
commits: [c940a6e]
tests: [test/samples.mjs, test/tipdecks.mjs, test/factory.mjs]
files: [netlify/functions/_sample.mjs, netlify/functions/sample.mjs, netlify/functions/factory.mjs, public/factory.html, public/venue.html, public/venue-studio.js, netlify/functions/_lib.mjs, netlify/functions/admin.mjs, netlify/functions/stage.mjs, netlify/functions/auth.mjs, netlify/functions/_auth.mjs, netlify/functions/_venues.mjs, netlify/functions/venueadmin.mjs, netlify/functions/venueauth.mjs, netlify/functions/_img.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, netlify/functions/profile.mjs, netlify/functions/venue.mjs, netlify/functions/_profile.mjs, public/sample.js, public/artist.html, public/studio.js, public/studio.html]
---

## The question

The founder wants MySet to build a finished page for an artist or a venue who has never heard of it — their photos, a short bio, their links and videos — and send it to them as one private link they can claim, as the main way to bring the first hundreds of artists in. The page must be invisible to everyone else until it is claimed, carry a banner saying it is a sample, float a Claim profile button, swap Share and the Studio menu for View your Studio, and open the Studio look-only. Unclaimed after thirty days it comes down; a private copy is kept one hundred and eighty days for a second campaign. The blueprint is the artifact "Hand Over the Keys" (2026-09-27); the founder's calls came on 2026-09-28: the key in the link, a hidden real account, look-only until claimed, claims land on Hobbyist, no hard review rule.

**The second round, the same day, after seeing it built** (the founder's words): the link must not end in "some long string of numbers, people are going to be even less likely to click on it — just make it say sample-profile after the #"; a name somebody already has gets "-music", "-live or something similar" after it; and no button for the act to say no — "there can simply be instructions in the outreach message that say don't want it? let us know and we'll delete this preview forever – no harm no foul!"

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A real account (same `profile_<aid>`, `show_<aid>`, `vprofile_<vid>` keys) registered in its own `samplereg`, not in `artists`/`venues`, until claimed. One POST door reads it with a key; the Studio's two readers (`admin.mjs`, `stage.mjs`) accept the key under a look-only `sample` role. Claiming adds one registry row and removes the sample row. | One read of `samplereg` per sample visit, per signup (`pickSlug` skips held names) and per `setSlug`. Nothing on any audience path. | `samplereg`, `sample_<owner>`, `samplearc(_<owner>)`, `samplesup`, `samplestat`; `sample.mjs`, `factory.mjs`. | A bug in the look-only role lets a sample write — held by an allowlist and a test that tries every write. |
| B | The blueprint's first shape: a `sample` mark on the live registry row, refused beside `del` in `publicArtist`/`venueBySlug`. | Every sample adds a row to the document every phone reads on every poll; thousands would slow every gig. Every registry walk (metrics, sheet, register, the directory, heal) needs the filter. | A filter in seven walks and a structure test. | A walk that forgets the filter counts samples as artists, or lists one in the public directory. |
| C | A duplicate page and Studio at `/<name>-sample-profile` (the founder's second idea). | Every page and both Studios twice, drifting with every feature; the link changes at claim; claiming copies data. | Twin pages. | Drift. |
| D — do nothing | Pitch by DM with no page. | — | — | The lever the founder asked for does not exist. |

**The link (second round).**

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **L1 — chosen** | `myset.vip/<slug>#sample-profile`: the label, the same on every page, not a secret | Anybody who knows or guesses the address can open the page and claim it | None: the plumbing that carried the key carries the label | A stranger claims a band's page; the founder is pushed at once and has fourteen days to undo it |
| L2 | Keep the HMAC key (`#k=` + twelve characters) | The link looks like spam to the person it is for, which is the one person it must not | — | Fewer claims, which is the whole point of the feature |
| L3 | A short word-key (`#sample-profile-4821`) or a claim code in the message | Still a string to explain; a code is one more step in the claim | A code field on the claim sheet | Friction where the founder asked for none |

## What was chosen, and why

A. It keeps the founder's first idea — a real account and page nobody can find — and moves the one thing that made it expensive. In B every public door needed a check and every registry walk a filter, and the registry every phone polls grew by a row per sample. In A a sample is refused by every public door by construction, because it is not in the list they read; no walk can count one; and the hot registry never grows. Claiming still moves nothing: the data always lived under the account's own keys.

The link ends in the label `#sample-profile` (L1, the founder's call in the second round; a venue's is `/v/<slug>#sample-profile`, and `?sample-profile` works where a browser drops the `#`). It is the same on every page, so it proves nothing: the address alone opens a sample, and the address alone can claim it. Until 2026-09-28 it was an HMAC key, twelve characters, and a stranger could do neither. What stands between a stranger and a band's page now is the founder's push on every claim and the fourteen-day undo on the console, and the bare address without the label is the ordinary "no such page", so a fan typing a band's name never lands on a page nobody published. The page leaves the label on the address, so a reload or a copied link opens the same preview; a claimed page reached with the label goes to its bare address. The plumbing still calls it the key (`x-sample-key`, the claim's `key`), so a secret can come back without new doors. A wrong label and an unknown page answer the same. A door with no secret must not erase anything, so the sample door lost its `remove`.

A name somebody already has gets a word, never a number: `-music`, `-live`, `-band`, `-official` for an act, `-live`, `-music`, `-venue`, `-official` for a venue, inside the 32 characters an address may have (the second round). A revive or a rebuild keeps its old address while it is free; undoing a claim puts the page back at the same link.

The Studio is look-only through an allowlist (`SAMPLE_OK` in `admin.mjs` and `venueadmin.mjs`, the `LEAVING_OK` shape), never a list of what it may not do, and `sample` is an empty set in `CAN` so it cannot fall back to `crew`. Only the two callers that ask for it (`requireArtist(req, { sample: true })`) can be reached with a key; every other endpoint answers 401 as before. The phone keeps the same list and opens the claim sheet instead of sending a save.

A sample's photos are stored under `s` + ten random characters instead of the account id, because `/api/img` serves anything it can name: the address is the secret, and `/api/img` needed no new check. `keysFor`/`keysForVenue` and the photo replace/clear paths find them by that name.

Claiming is the door every account already uses — email, six-digit code, `verify`'s ticket — then `claimSample` with the key and a password, in one sheet: one write adds the registry row on the free plan (`src: 'sample'`), the password is set, a session opens, and the first-run resumes at the songs. An inbox that already has a page is told so (it has just proved it) and the founder is pushed to merge. The founder has fourteen days to undo a claim: the console keeps each one under *Claimed* for that window with its own **Undo claim** (a line in `samplereg.claimed`), and the sweep closes the window by removing that line and the record's copy of the old row.

The clock: thirty days, then `sweepSamples` (the factory's five-minute ring) snapshots the page into `samplearc_<owner>` — the profile, the name, the photos' bytes except YouTube frames, kept as references because YouTube's terms allow its data thirty days — erases the live keys and frees the name. The snapshot is erased at one hundred and eighty days; `reviveSample` brings it back, at its old address while that is free, with thirty more days. Nobody taps anything to say no (the second round): every message and the page's own note say "Don't want it? Let us know and we'll delete this preview forever – no harm, no foul!", and the founder's **Delete forever** on the console erases the page or the kept copy at once and suppresses the act for good (hashed identifiers in `samplesup`, which the factory checks). The messages say "30 days to claim before it comes down", and the page's own note says a private copy is kept up to six months — "deleted" would not be true of the thirty days, and is true of Delete forever.

## What this makes harder

Since the second round, anybody who knows or guesses a sample's address can open it and claim it; at thousands of pages somebody could find samples by trying band names. The undo is the defence, so the founder has to read the claim pushes. A sample can hold a name a real artist wants: a signup gets `name2` while the sample lives, and the founder is told nothing automatically (an open question — the console could flag it). A sample's Studio shows empty history, money and team (the phone answers those reads with a brand-new account's blanks), so it previews the shape, not a working night — which is what the practice round (0102) is for. Two registries hold names now, so any future name-picker must read both (`sampleSlugs`).

## What would reverse it

A claim by the wrong person that the undo did not catch, or signs of somebody trying names at the sample door: bring a secret back (L3's short code is the smallest step; `sampleKey()` and `verifySample()` are where it goes). Claim rates that justify a different funnel (a claim-first signup, or public unclaimed pages like Yelp's — which would need a legal review first); a sample volume where `samplereg` itself grows past a few hundred kilobytes (shard it by month); Meta or YouTube changing the terms the photo ladder relies on.

## How it was verified

`node --import ./test/register.mjs test/samples.mjs` — 119 checks: built with photos and links, the link ending `/thetidelines#sample-profile`; not in `artists`; 404 on the profile, the show, the directory, the share card, the QR code and the photo by page name; the door opens for the label (with its `#`, in any case), a wrong label or none answers like an unknown page; a second and third "The Tide Lines" get `-music` and `-live`, a long name keeps its word inside 32 characters, a second "Harbour Bar" gets `-live`; the door has no `remove`, and Delete forever erases the profile and the photo and suppresses; the Studio reads eight allowlisted actions and twelve writes answer `claim: true` with nothing written; the auth door refuses the key; a signup and a rename skip the held name; the founder's console is the owner seat only and its drafts carry the link, thirty days and "Don't want it? Let us know…" and no Remove, in all four; code → ticket → `claimSample` → a free-plan row, the preview gone, the page public, the password signing in, the Studio saving; the sweep archives at thirty days (YouTube frame as a reference, the rest as bytes), revives at the same link, and a revive whose address a signup took gets `-music`; erases at one hundred and eighty; the venue path end to end; undo within fourteen days, artist and venue, listed on the console until then, and refused once the sweep has closed the window.

Walked in a browser on `tools/localhost.mjs` (the real functions, an in-memory store) at 375 px, second round: `/thetidelines#sample-profile` opens the preview and keeps the label on the address, its foot note ends on "Don't want it? Let us know…" with no button, the bare `/thetidelines` is "No page here", a second one is `/thetidelines-music#sample-profile`, `/v/harbourbar#sample-profile` opens the venue's, and the console's DM draft and Review sheet (Delete forever) read right. First round: the page with the one-line banner, Claim profile at the banner's width, the header swap and the welcome deck; View your Studio into the look-only Studio; a practice round (0102) to its summary; Claim profile → email → the printed code → password → "It's yours" → the Studio as the owner at first-run step 2 of 4.

Not checked: the live site (nothing was deployed when this was written), Instagram's in-app browser keeping the `#` (the page also accepts `?sample-profile`), and push delivery to the founder's phone.
