# Provenance markers

**Private. Never published** — `netlify.toml` publishes `./public` only (INVARIANT 10),
and this file is deliberately outside it. A marker somebody can read about is a
marker somebody can strip.

## What this is for, and what it is not

It does not stop a clone. MySet's concept fits in one sentence, and rebuilding it
from the outside is legal almost everywhere. This exists for one narrow job: turning
*"that looks like our app"* into evidence, cheaply.

There is a real trade-off worth stating once. Every hour spent on anti-copycat work
is an hour not spent making copying pointless. Far more products die of obscurity
than of clones. The markers below were chosen because they cost approximately
nothing and need no ongoing effort — that is the only reason they earn their place.

## Why there are no fake records in the live feed

The textbook version of this is a **canary row**: a plausible fake entry seeded into
public data, which can only reach a competitor by being copied. MySet cannot do that,
because of **INVARIANT 0j — never invent gig data.** A listed gig sends a real person
to a real bar on a real night, and placeholder venues had to be deleted from this app
once already before anyone saw them. A canary that strands somebody outside a bar
with no gig is a worse outcome than an unprovable clone.

So every marker here is **true**. They mark our own real output rather than inventing
anything. If a canary is ever wanted, the only safe shape is an artist profile with
**zero gigs** — reachable by enumeration, invisible in every city feed, incapable of
sending anyone anywhere. That is a decision for Perry, not a default.

## The markers

Run `./fingerprint-check.sh https://suspect.example.com` to test all of them at once.
It reports which are present and how much each one proves.

### Planted — arbitrary, no function, strongest evidence

| Marker | Where | Why it proves something |
|---|---|---|
| `--ms-k:ms-k3f9qz` | `public/app.css` `:root` | A CSS custom property referenced nowhere. There is no innocent reason for another product to define it. |
| `"src":"ms-k3f9qz"` | `/api/show`, `/api/venue`, `/api/events` | Only catches someone proxying or republishing our actual responses — not someone who wrote their own server. Kept because it costs ~18 bytes. |

Both are defined once, in `netlify/functions/_canary.mjs`. **Do not change these
values casually.** A marker is only evidence if it was demonstrably in place before
the copy, so the git history of that file is part of the proof.

### Natural — distinctive choices a copy carries by accident

These cost nothing and were already deployed. Prose is the strongest kind: nobody
independently writes *"That one isn't on tonight's list"* with a curly apostrophe.

| Marker | Reachable from outside? |
|---|---|
| `Unofficial lyrics` | Yes, always |
| `The show has ended` | Yes, always |
| `myset.fan` / `myset.token` localStorage keys | Yes, in the client source |
| `myset-runtime-v3` service worker cache name | Yes, `/sw.js` |
| `singalong` in the built-in genre list | Yes. A judgement call, not a real genre — see `_lib.mjs` |
| `That one isn't on tonight's list` | **Only during a live show** |
| `That one is playing right now` | **Only during a live show** |
| `Voting is closed right now` | **Only during a live show** |
| `that's what this gig says` (setlist fallback) | **No** — Studio-only. Needs discovery or a leak |

**Measured 2026-09-01:** `vote.mjs` checks `status === 'ended'` before it checks the
song, so the three live-show strings are unreachable while no show is running. A
clean result on those means nothing unless the suspect had a gig on when you ran it.
The checker says so rather than reporting a false all-clear.

## If the checker lights up

1. **Save the evidence first.** Keep the fetched bytes and the date. `fingerprint-check.sh`
   writes to a temp dir that it deletes — re-run it redirecting output to a file, and
   archive the raw responses separately.
2. **Do not contact them yourself.** A takedown notice sent in anger can weaken the
   claim and tips them off to strip the markers.
3. **Two or fewer hits is not a case.** Shared vocabulary and common libraries explain
   a lot. Three or more, including a planted one, is a different conversation.
4. Talk to a lawyer. Nothing in this file is legal advice.
