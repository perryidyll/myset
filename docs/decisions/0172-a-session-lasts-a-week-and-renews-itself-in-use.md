---
id: 0172
title: A session lasts a week and renews itself in use
date: 2026-10-09
status: decided
decided_by: perry-confirmed
area: auth
reverses:
superseded_by:
invariants: [0hs, 0dd]
commits: []
tests: [test/sessionlife.mjs, test/accounts.mjs]
files: [netlify/functions/_auth.mjs, netlify/functions/_venues.mjs, netlify/functions/_lib.mjs, netlify/functions/_errlog.mjs, public/studio.js, public/venue-studio.js]
---

## The question

A sign-in token was good for thirty days from the moment it was minted, whatever
happened in between. The token lives in the browser's `localStorage` and travels as a
bearer header, so a copy — off a borrowed phone, a browser profile, a backup, a laptop
left open — worked for a month after the person believed they had left, unless they
knew to sign that device out. SECURITY.md had carried the fix as a line for two weeks:
*"Shortening to 7 days with silent renewal is a small win."* The founder's standing
instruction for the security pass is "as secure as possible, without slowing the site
down", and on 2026-10-09 he said "do all of this" to a list that named this item.

What forced the shape was the gig. An artist who plays every Saturday must never be
asked to sign in on stage because a week ran out at midnight; and a crew phone on a
five-seat page must not be signed out mid-set by a clock.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen** | A token lives seven days. On any authenticated request where the token is more than a day old, the server mints a fresh one for the same device (same address, same `rev`, same `sid`) and sends it back as one response header; the Studio keeps it | One HMAC a day per device; one header on one reply a day; no read, no write | `renewToken` / `renewVenueToken`; a `WeakMap` from the request to its offer (`offerRenewal`, `renewalFor`); `withRenewal` in `guard()`; three lines in each Studio's `api()` | A renewal mis-wired signs a working device out after a week — `test/sessionlife.mjs` pins a device used on day seven staying in |
| B | Seven days, no renewal | Nothing | A constant | Every artist signs in weekly, some of them on stage. Against rule 1 |
| C | Seven days, renewal by a refresh token kept server-side | A second credential, a store write per renewal, a revocation story for it | A refresh document per device | A write on the Studio's poll path; INVARIANT 0ci's one-read poll becomes two |
| D | A shorter life and renewal, but the cookie way (`HttpOnly`) | Every door and both Studios rewritten; the sample Studio and the head-start reads too | Cookies on an API that is also called cross-origin from previews | Weeks of change for a gain the `rev`/`sid` revocation already mostly gives |
| E — do nothing | A month | Nothing | None | A copied token is a month of access |

## What was chosen, and why

A. It is the smallest change that keeps every property the account system already has
and shortens the one that was too long:

- **Nobody is signed out by the change.** A token minted before it keeps its own
  expiry; the first time it is used more than a day into its life it is answered with
  a seven-day one, and from then on the device rolls forward as long as it is used.
- **A device in use never notices.** A token older than a day is renewed on its next
  use, so a weekly gig renews weekly and a daily Studio renews daily. Only a device
  left alone for a week has to sign in again — which is the point.
- **Signing out still signs out** (INVARIANT 0dd). The renewal carries the same `sid`,
  and `killSessions` keeps a dead entry for thirty-one days — longer than any token,
  old or new, can live — so a renewed token dies with the device it belongs to.
  `test/sessionlife.mjs` kills a device after a renewal and shows both tokens refused.
- **It costs nothing the poll can feel.** The verifier already has the registry row,
  the keys and the token's fields in hand; `renewToken` is an HMAC and a comparison,
  once a day per device. No document is read or written. The header is added in
  `guard()`, after the handler, on the reply it was going to send anyway.
- **A shared reply never carries a token.** `withRenewal` puts the header only on a
  reply that says `cache-control: no-store` — which is every personal reply, because
  `json()` says so — and never on `jsonCached` or a page. A cache could otherwise hand
  one phone's token to the next. The suite pins this with a renewal offered against a
  cached reply.
- **The venue side is the same code shape**, signed with its own `v|` tag, so a venue
  token renews to a venue token and is still refused at every artist door.
- **A token minted before sessions had ids** (three fields) renews to a three-field
  token: nothing old breaks, nothing old is quietly promoted.

Decided by the founder's "do all of this" against the list that named it; the week
and the day are the numbers SECURITY.md proposed, and `§2.1` of the overview now
carries them from the code.

## What this makes harder

- A device genuinely used once a week sits one day from the edge. A Saturday gig
  that slips to Sunday after a week away means signing in again — a passkey tap, or a
  six-digit code. The "left for eight days" check in the suite is the honest version
  of this cost.
- A stolen token that is *used* by the thief renews like anybody's. Shortening the
  life limits a dormant copy; it does not replace signing the device out, which the
  sessions screen is for.
- The header is one more thing the two Studios must read. A third client would have
  to do the same, or sign in weekly.
- Netlify Functions do not let a handler set headers after the fact, so the renewal
  lives in `guard()`; a handler that is not wrapped in `guard()` (the crons, the
  artist page) renews nothing — they also verify nothing, so nothing is lost today.

## What would reverse it

- A measured week of sign-in friction: artists asked to sign in on stage because a
  device fell off the week. The fix would be a longer life, not removing renewal.
- A move to `HttpOnly` cookies (option D), which would carry renewal differently.
- Netlify caching a `no-store` reply at the edge, which would make the `withRenewal`
  rule insufficient — then the header would have to move into the JSON body.

## How it was verified

`node --import ./test/register.mjs test/sessionlife.mjs` — 34 checks: a young token is
answered with nothing extra; a token a day old comes back renewed for the same
address, device and rev, good for a week from now, with `access-control-expose-headers`
naming it; the fresh token is young and renews nothing; the sign-in door (`me`)
answers a day-old token; a device used on day seven stays in and is renewed; one left
eight days is refused and handed nothing; after `killSessions` the old token and the
renewed one are both refused; a three-field token renews to a three-field token; the
venue side renews, keeps venue, device and rev, refuses at eight days, and is never
accepted at the artist door; a renewal offered against a cached reply or a page is
not sent, against `json()` or any `no-store` reply it is.

Mutation-checked: with the `no-store` rule removed, two checks fail; with the life set
back to a month, five fail. `test/accounts.mjs` (235), `test/secret.mjs` (65),
`test/cost.mjs` (30), `test/storefail.mjs` (35) unchanged and green.

Not checked: a real phone's Studio reading the header — the two `api()` edits are
three lines each and `node --check` clean, and the stamps were rewritten; the first
day on production is the proof.
