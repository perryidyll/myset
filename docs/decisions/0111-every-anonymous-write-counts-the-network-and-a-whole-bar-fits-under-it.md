---
id: 0111
title: Every anonymous write counts the network as well as the device, and a whole bar on one wifi fits under every limit
date: 2026-09-28
status: decided
decided_by: perry-confirmed
area: auth
reverses:
superseded_by:
invariants: [0gx]
commits: []
tests: [test/email.mjs, test/request-payments.mjs, test/rsvp.mjs, test/feedback.mjs, test/errlog.mjs, test/foundations.mjs]
files: [netlify/functions/_auth.mjs, netlify/functions/auth.mjs, netlify/functions/venueauth.mjs, netlify/functions/_pay.mjs, netlify/functions/pay.mjs, netlify/functions/_rsvp.mjs, netlify/functions/rsvp.mjs, netlify/functions/_feedback.mjs, netlify/functions/feedback.mjs, netlify/functions/_errlog.mjs, netlify/functions/bug.mjs, netlify/functions/_mirror.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, tools/backup.py, tools/overview.mjs]
---

## The question

Slice B of the 2026-09-28 security pass (slice A is `0110`; the server's own secret
and the sealing are `0112`/`0113`). Every public write MySet takes from the audience
was limited per device, and the device id is a string the phone chooses. A loop that
mints a fresh id per call walked through every one of those limits:

- **Sign-in codes.** Five codes per address per hour stopped one inbox being flooded,
  and nothing stopped one script asking for a code for ten thousand addresses. Each
  is a billed email with MySet's name on it, and enough of them ruins the sender's
  reputation until real sign-ins bounce.
- **Checkout.** `/api/pay` opened a Stripe Checkout Session for every request it was
  handed, on the artist's own Stripe account, until Stripe's rate limit shut the
  door on the real buyer behind the script.
- **RSVPs, ratings, bug reports.** One per device, so one per call. RSVP counts could
  be inflated to thousands from one laptop in under a minute; every rating past two
  hundred spills into an archive that is never trimmed; every bug report costs four
  reads and a write.

## What was chosen

The network address is the one thing the caller does not choose: Netlify sets the
header. So each of these doors now counts the network too, as a hash
(`roomHash`), inside the document it already writes (decision `0030`'s shape: the
limit lives on the record, a refused write writes nothing).

| Door | Device limit (unchanged) | Network limit (new) | A refusal looks like |
|---|---|---|---|
| Sign-in code, artist and venue | five per address per hour | `NET_CODES_PER_HOUR` | the same "sent" every address gets (9h) |
| Checkout | `PAY_BURST` in a row, `PAY_PER_MIN` after | `PAY_NET_BURST` in a row, `PAY_NET_PER_MIN` after | "Too many tries — give it a minute" (429) |
| RSVP | one per device per night | `RSVP_PER_NETWORK` phones per night | the count still answered, the pill not on |
| Rating | one per device per week | `FEEDBACK_PER_NETWORK_PER_DAY` | "thanks" (`already`), the same as a repeat |
| Bug report | one per device per ten minutes | `BUG_PER_NETWORK_PER_HOUR`, judged on one read | "thanks" (`already`), the same as a repeat |

The numbers themselves are in §2.1 of the master overview, read from the code.

**Sized for the worst real night, not the average one.** The first build of this
slice set the checkout network limit at sixty in a row. The cross-session review
caught what that meant: a bar's wifi is one address with two hundred phones behind
it, and "tip jar's open" is the moment they all tap at once, so sixty would have
shown the room *Too many tries* at the buy moment. Every network number was re-sized
before shipping so that a packed bar on one wifi, every phone acting at once, fits
under it with room to spare. `test/request-payments.mjs` runs that night: two hundred
phones on one address, each tapping Buy twice, and nobody is refused.

**The retry caps went back up.** The first build also cut the compare-and-swap
retries on the RSVP and rating documents from forty to eight, to starve a script.
The network cap already does that; the retry cut would have been paid by real
phones on a packed night. Both are back at the default. A lost RSVP race still
answers with the calm 503 `/api/vote` uses, never the guard's 500.

**A limiter never refuses the real thing when it breaks.** The sign-in and checkout
limiters live in their own small documents with five tries; a limiter that cannot be
written lets the code or the sale through. The limiter documents are never mirrored
or backed up (a limiter's hour is worth nothing a day later), and the checkout
limiter's document is on the artist's and the venue's delete lists.

| Option | Why not |
|---|---|
| An edge rule on Netlify (per-IP ceiling on `/api/*`) | Still worth having as a ceiling on scripts, set well above a bar's wifi, and it is the founder's to set in the Netlify UI. It cannot say "same answer as a valid address" (9h), and it cannot tell a vote from a checkout. |
| A captcha on the audience pages | The audience never signs in and never solves anything (INVARIANT 9g). |
| Keep the device limits alone | Every one of them is a loop with a fresh id away from unlimited. |

## What this makes harder

A venue whose entire audience is on one address and does more than the network
limit in the window meets it: the 401st RSVP on one network is not counted, the
151st rating of the day is thanked and not stored, the 13th bug report in an hour is
thanked and not stored. Checkout is the one door where a refusal is visible, and it
is sized at more checkouts in a row than a bar holds phones. The hash is of the
artist id and the address; until `0112` gives the server its own secret it is not
keyed, so someone holding the store could reverse it by brute force over the address
space. `0112` keys it.

## What would reverse it

A real night that meets any of these limits: widen that number, never remove the
limit. If a venue's shared network is the problem, Netlify's traffic rules can
exempt it at the edge.

## How it was verified

`sh test/run.sh` on this branch, cut from `origin/main` `f1e1dbe`, every section
green, the count stamped by `node tools/overview.mjs --tests`. Each door is run past
its network limit with rotated device ids from one address (refused in the words
above), from a second address (untouched), and with no address at all (not counted).
The stored documents are read raw and hold no address. A refused bug report is
measured at one read and no write. Nothing was written to production.
