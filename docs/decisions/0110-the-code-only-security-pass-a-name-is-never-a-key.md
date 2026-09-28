---
id: 0110
title: The code-only security pass — a name is never a key, an id is never markup, a pledge comes only from Stripe
date: 2026-09-28
status: decided
decided_by: perry-confirmed
area: auth
reverses:
superseded_by:
invariants: [0gt, 0gu, 0gv, 0gw]
commits: []
tests: [test/tenancy.mjs, test/request-payments.mjs, test/unit.mjs, test/sharecard.mjs, test/foundations.mjs, test/errlog.mjs, test/accounts.mjs, test/studiocode.mjs]
files: [netlify/functions/_lib.mjs, netlify/functions/_auth.mjs, netlify/functions/_venues.mjs, netlify/functions/_requests.mjs, netlify/functions/_profile.mjs, netlify/functions/_events.mjs, netlify/functions/admin.mjs, netlify/functions/auth.mjs, netlify/functions/artistpage.mjs, netlify/functions/confirm.mjs, netlify/functions/_errlog.mjs, netlify/functions/_lyrics.mjs, netlify/functions/_mirror.mjs, netlify/functions/_img.mjs, netlify/functions/_passgate.mjs, netlify/functions/qr.mjs, netlify/functions/img.mjs, netlify/functions/vid.mjs, tools/backup.py, tools/prod.py, .github/dependabot.yml]
---

## The question

The founder asked, on 2026-09-28, for MySet to be made as secure as it can be
without slowing a gig down — *"make some have to put in some serious hacker work to
steal it"*. Seven read-only audits went over the transport, the sign-in, the data at
rest, the money, the pages, the anonymous endpoints and the repository. Most of what
they found was one pattern repeated: a lock that was real, next to a door that was
not. The pass was built as one 72-file branch; the cross-session review of the same
day (`docs/sessions/2026-09-28-cross-session-review.md`) found it collided with
`main` in fifteen files and asked for it in three slices. **This record is slice A:
everything that needed no new variable and no new limit.** The limits are `0111`;
the server's own secret and the sealing at rest are `0112` and `0113`. What #128,
`0099` and `0100` had already fixed another way (a seat signing the owner out,
`/api/revenue` and `/api/history` open to every seat, crew reaching the room's
settings) was dropped from this branch and is not here.

## The findings, and what was chosen

| Found | Chosen | Instead of |
|---|---|---|
| A public request could carry a "pledge" in its own body and be filed as a $500 offer whose acceptance minted five hundred paid votes nobody had paid for. | Only the Stripe-verified path may carry a pledge (`verified` on `createRequest`). | Deleting the field at the public door alone (the helper would stay trusting). |
| A device id of `__proto__` reached `bag[fanId] ||=` and wrote onto `Object.prototype` of the warm instance, and `?a=constructor` resolved to a function and a phantom room. | `cleanFanId` refuses the three names; every registry lookup is an own-property lookup (`own`, `_lib.mjs`); `constructor` is a reserved slug. | Freezing prototypes (a global change with unknown reach). |
| An event id kept any character and reached an `onclick` attribute in the Studio; a band mate could plant script the owner's browser ran. Profile pictures took free text into `style="url('…')"`. The share card wrote a name through `String.replace`, where `$'` means "the rest of the page". | Ids keep to the alphabet every other id keeps to; a picture is a same-origin path or an https URL (`imgUrl`); replacements are functions. | Rewriting the Studio's rendering (decision 0087's shape; no). |
| `emailChangeStart` answered 400 for a taken address and 200 for a free one — an account oracle any signed-in stranger could read. | Both answer the same "sent"; a taken address simply cannot be finished. | Nothing (9h is a rule, not a preference). |
| `setCode`'s deny-list read `show.slug`, a field that never existed, so the page's own name was never refused as a Studio code. | The slug is read from the registry before the CAS and handed to `weakCode`. | — |
| The error log kept whole URLs, query string included — a Studio code or a Stripe session id on a request that threw was written into a global plaintext document. Two upstream calls (mail, lyrics) had no deadline. | The path only. Eight-second deadlines on both (`MAIL_MS`, `LRCLIB_TIMEOUT_MS`). | — |
| The nightly mirror copied the ID photo to R2 and never deleted it: a copy outlived the owner's decision (0bk). The laptop backup carried the store-kept signing key, and `prod.py get` would print it or an ID photo. `/api/confirm` echoed the buyer's device id to anyone holding the session id. | The mirror and the backup skip `_idcheck`, `authsecret` and the session-only documents; `dropImage` removes the R2 copy; `prod.py` refuses to print a key, a credential or an ID photo; `confirm` strips the id. | — |
| A function's reply carried Netlify's bare HSTS, not the site's; the QR SVG (a document that can run script) carried no policy; served pictures and clips said nothing about sniffing. | Every reply carries the full directive; the SVG gets a `default-src 'none'` policy; `nosniff` on `/api/img`, `/api/vid`, `/api/qr` and the passcode pages, with `x-frame-options` and a `permissions-policy` on the latter. | — |
| A real fan's address, and the founder's own, sat in committed audit files and session notes; a committed fixture carried five real device ids. | Replaced with example addresses; the ids removed. Dependabot opens a pull request for a dependency fix. | History keeps them; treat as disclosed. |
| C — do nothing | — | Every row above stays true on a public repository. |

## What this makes harder

A profile picture must now be an address this app can draw: a hand-written
`http://` URL or one with a quote or a bracket in it is dropped on the next read.
(Checked against the one listed artist's live profile before merging: nothing
dropped; uploads are always `/api/img?…`.) A backup no longer carries the store-kept
signing key, so a restore from a copy made after this signs everyone out once — they
sign back in with a password or a code. Until `0112` lands, that key is still the one
the server signs with.

## What would reverse it

An artist whose profile genuinely links a picture on a plain `http://` host (widen
`imgUrl`, never remove it). A restore where signing everyone out once is worse than
a year of copies holding the key (put `authsecret` back in `SKIP_KEYS` — but read
`0112` first, which makes the question moot).

## How it was verified

`sh test/run.sh` on this branch, rebuilt on `origin/main` `5aca670`: every section
green, the count stamped by `node tools/overview.mjs --tests`. The forged pledge
minting paid votes, `__proto__` reaching the prototype and the oracle each ran red
first on the original branch; here the same assertions hold against today's `main`.
The one listed artist's public profile was read from production (read-only) and
every picture address passes `imgUrl`. Nothing was written to production.
