---
id: 0033
title: A clip's bytes live on Cloudflare R2 and the phone is sent there by a signed link
date: 2026-09-11
status: decided
decided_by: user-confirmed
area: media
reverses:
superseded_by:
invariants: [0fd]
commits: []
tests: [test/clips.mjs]
files: [netlify/functions/_r2.mjs, netlify/functions/_video.mjs, netlify/functions/vid.mjs, test/r2-fake.mjs]
---

## The question

Clips are the one thing in MySet that can move the bill on their own. Netlify bills
about $0.134/GB to send bytes to a phone and a cache HIT is billed like anything
else, so the year-long edge cache on `/api/vid` saves compute, never bytes: one
75MB clip watched a hundred times costs more than ten whole gigs (INVARIANT 0ev).
The 2026-09-06 session named the move — the bytes, not the app, onto a store with
no egress charge — and set a trigger of ~100GB a month. The user decided not to
wait for the trigger, opened a Cloudflare account, made the bucket `myset-clips`
(Standard class, public access off) and put the four `R2_*` variables into Netlify.
The question left was *how* a phone fetches a clip from a private bucket, and how
nothing about it can break a gig.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen: R2 for the bytes, `/api/vid` answers a 302 to a presigned GET** | Uploads go to R2; the phone is redirected to a signed link on the bucket's S3 endpoint, good for a few hours; the redirect is cached for an hour | Storage at R2's rate, no egress; one HEAD per clip per hour at the edge if Netlify's CDN caches the 302 as its headers ask (not verified), else one HEAD per view | `_r2.mjs` (SigV4 by hand), a fetch fake in the suite | A dead link in a cached redirect — guarded by a test that the link outlives the cache by an hour |
| B — a custom domain on the bucket (`clips.myset.vip`) | Plain public URLs, Cloudflare's CDN in front | Requires `myset.vip`'s DNS zone on Cloudflare; it is on Netlify DNS today (checked: NS1 nameservers) | Moving the zone of a live site | An outage of the whole site during a zone move, for a media feature |
| C — `r2.dev` public URLs | No signing, no redirect | Rate-limited; Cloudflare says not for production | None | Clips throttled in exactly the room that made one popular |
| D — proxy the bytes through the function from R2 | No redirect, same URL shape | Netlify still bills the egress — the saving is zero | None | Nothing gained, 75MB pulled through a function per view |
| E — do nothing | Clips stay in Blobs | Netlify egress on every view, for ever | None | The one line of the bill nothing else brings down grows with the feature |

## What was chosen, and why

A. It is the only option that removes the egress charge without moving the site's
DNS or accepting a rate limit. The bucket stays private and the signature is what
opens it, per object, for a few hours. The redirect is what gets cached, not the
bytes, and it is signed from the top of the hour so every request in that hour
gets the same link — one function run per clip per hour at the edge, if the CDN
honours the cache headers on a 302 (expected, not verified; if not, one HEAD per
view, which is harmless).

No third dependency: the project has exactly two and it stays that way. SigV4 is a
page of HMACs; `node:crypto` is the whole of it, and the algorithm is pinned against
Amazon's own worked example (credentials, canonical-request hash, string to sign,
final signature — all published) so the stage that goes wrong is named.

Read R2 first, then Blobs. Every clip on the site before today is in Blobs and
keeps serving as it did; nothing is copied in bulk, because `list()` is banned and
a copy that half-fails is worse than none. Every R2 failure degrades: a refused
PUT lands in Blobs, a serve that cannot reach R2 tries Blobs, a clip only R2 has
is a 404 while R2 is down. Nothing on this path can stop the room voting.

## What this makes harder

- **Two stores for one kind of thing**, for as long as pre-R2 clips exist. Every
  delete path (hide, sweep, post delete, artist delete, venue delete) has to hit
  both; `dropClip` and `dropClipKeys` do, and the suite checks each one.
- **A link is a credential.** The `Location` header carries a signature. It must
  never be logged; the error log is checked for it in the suite.
- **The four variables can no longer be simply removed.** With them gone, every
  clip already on R2 is a 404 and every later delete skips it. Rotate by replacing.
- **The sweep ring now keeps an owner while their pending list is non-empty**
  (it used to drop them after one visit and rely on the next upload). One extra
  read per ring for an owner with a clip that is not yet due; the price of
  retrying a refused delete without a new upload.
- **A second vendor.** Cloudflare's availability is now part of clip playback.
  Voting is unaffected by design, but a clip only R2 has does not play while R2
  is down.
- **The bucket's own S3 endpoint is the URL** a phone sees. Not pretty, not
  branded, and it changes if the account id changes.

## What would reverse it

- `myset.vip`'s DNS moving to Cloudflare — then a custom domain with Cloudflare's
  CDN in front (option B) is strictly better and the redirect goes away.
- R2 starting to charge for egress, or Netlify's bandwidth price falling to where
  the saving is not worth a second vendor.
- Clip playback failing on real iPhones through the redirect (not measured on a
  device; see below) — that would force option D or a custom domain.

## How it was verified

- `node tools/overview.mjs --tests`: **2,004 assertions, 0 failing** (the whole
  suite; every other suite runs with R2 off and is unchanged).
- `test/clips.mjs`: 163 assertions, of which 77 are new. Pinned: the SigV4 header
  signature `f0e8bdb8…` and canonical hash `7344ae5b…`, the presigned URL ending
  `aeeed9bb…` byte for byte, and the PUT example's payload hash `44ce7dd6…` with
  signature `98ad7217…` (the payload hash is confirmed from a reproduction of the
  guide; the signature matches recollection of the guide and an independent
  re-derivation from the bytes undici sends — the guide's page itself could not be
  fetched); an upload lands on R2 and not in Blobs; `/api/vid` is
  a 302 with `max-age=3600` and no `immutable`; `bytes=0-1` against the signed link
  is a 206 with a correct `content-range`; a forged nibble and a re-pointed link
  are 403; the link is good a second before expiry and dead a second after; a
  pre-R2 clip serves from Blobs after a HEAD to R2; with R2 answering 503,
  unreachable, or signed with a wrong secret, uploads land in Blobs and serves
  fall back; failures are logged with no key, secret or signed URL; hide, sweep,
  artist delete and venue delete all take the bytes off R2 and log no failure; a
  posted clip left on the pending list survives the sweep on R2 as in Blobs; a
  hide while R2 refuses leaves the object, re-notes the clip, keeps the owner on
  the ring, and the first sweep after R2 is back takes it off.
- An independent fresh-context review of the diff (before the fixes above) found:
  a refused R2 delete was a permanent orphan (fixed — the pending-list retry);
  `/api/vid` read the whole artist registry on every id-form request (fixed —
  slug resolved only on a miss, as before); an outage put a CAS log write on
  every uncached serve (fixed — once a minute per instance); four stale comments
  (fixed); claims about the browser carrying Range through a 302 and about the
  edge caching a function's 302 stated as fact (reworded as expectations, above);
  the suite's fake verifies with the project's own signer, so a shared
  canonicalisation bug would pass — the reviewer captured the raw TLS request
  undici sends for PUT/HEAD/DELETE and re-derived the signature with independent
  code; all three matched. Removing the variables strands clips on R2 (documented,
  not changed).
- The first run of the delete section passed while the fake was throwing on a
  204 — the object was gone before the throw. The fake was fixed and an assertion
  added that deletes leave no error row. Recorded so nobody trusts the green
  without the second check.
- **Not checked:** a real PUT/HEAD/GET/DELETE against the live bucket (the keys
  are in Netlify, not on this machine — deliberately), and playback on a real
  iPhone through the 302. The first is the deploy's job; the second needs a
  phone in a hand after the deploy.
