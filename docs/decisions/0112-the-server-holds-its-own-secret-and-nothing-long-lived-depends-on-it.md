---
id: 0112
title: The server holds its own secret, signs with it, and keys nothing long-lived with it, so changing it strands no code
date: 2026-09-28
status: proposed
decided_by: claude
area: auth
reverses:
superseded_by:
invariants: [0gy, 0gz]
commits: [e996865]
tests: [test/secret.mjs, test/passgate.mjs, test/studiocode.mjs, test/everyshow.mjs, test/gmail.mjs, test/hq.mjs, test/serversecret.mjs]
files: [netlify/functions/_secret.mjs, netlify/functions/_auth.mjs, netlify/functions/_session.mjs, netlify/functions/_venues.mjs, netlify/functions/_lib.mjs, netlify/functions/_passgate.mjs, netlify/functions/_hqlock.mjs, netlify/functions/_showlock.mjs, netlify/functions/admin.mjs, tools/serversecret.mjs, HARDENING.md]
---

## The question

Slice C of the 2026-09-28 security pass (A is `0110`, B is `0111`; the sealing is
`0113`). The key that signs every session, ticket, six-digit code and recovery code
was generated once into the Blobs store (`authsecret`), beside the sessions and
registry it protects. Anything that can read the store — a leaked Netlify token, the
R2 mirror, a laptop backup, a deploy preview — could mint an owner session for any
account. The founder's money-model door had a default code written in this public
repository, a cookie any reader could compute offline, and no count of wrong guesses.
A Studio code was kept as a bare SHA-256, one afternoon on a graphics card from the
code for anyone holding a copy of the show record.

The cross-session review of the same day asked for one more thing before this ships:
the original design stranded recovery codes and Studio codes when a rotated secret's
previous value was removed. They were keyed with the secret.

## What was chosen

**One variable, `MYSET_SECRET`, cut into keys by purpose** (`_secret.mjs`, HKDF): `auth`
signs tokens, tickets, codes and cookies; `room` keys the network hash (`roomHash`), so
an address cannot be read back out of a document by trying all four billion; `wrap`
wraps the sealing keyring (`0113`). With no variable, nothing changes.

**The move off the store key signs nobody out.** The store key keeps verifying
short-lived things (tokens, tickets, six-digit codes, the passcode and HQ cookies) for
thirty-one days after the switch, dated once on its own document, and signs nothing.
After that it can mint nothing even if it leaks.

**Nothing long-lived is keyed with the secret.** This is the answer to the review.

| Thing | Kept as | So a new secret |
|---|---|---|
| Recovery code | `s1`: one salt per set, scrypt of each code, in a sealed document | never strands it; a set made before the switch (an HMAC under the store key) keeps working against the store key, which stays in the store |
| Studio code | `s1:<salt>:<scrypt>`, remembered per warm instance after a match | never strands it; a bare SHA-256 still opens and is rewritten on first use |
| Password | scrypt (unchanged, `_cred.mjs`) | never strands it |
| Sealed records, Gmail tokens | the keyring (`0113`) | re-wraps one document |

**A rotation signs every device out once.** `MYSET_SECRET_PREVIOUS` never verifies a
token: after a leak, the leaked key must stop opening anything at once, and a routine
rotation costs one sign-in. It exists only to re-wrap the keyring. The runbook is
HARDENING.md §0.

**The money model's door is a door.** `FINMODEL_CODE` is required on Netlify (the
door opens for nobody without it and says so); the cookie is an HMAC under the
signing key; ten wrong codes in fifteen minutes shut the door for fifteen minutes,
doubling to a day, and shut means the right code too (a cookie already held still
opens). Ported onto the box #149 had just given letters and a Show button. Since `0130`
(2026-09-30) the money model is open and nothing calls this door; it stays hardened for
the day a passcode comes back. The Show log `0130` put behind the CRM's passcode signs
its cookie like HQ's and checks it under every signing key, so the switch locks nobody
out of it either.

**The value is made on the founder's Mac and kept there.** Netlify never shows a value
marked secret again, and never hides a value in its Local development context. So
`tools/serversecret.mjs` makes it, keeps the one copy outside Netlify in the login
Keychain, sets it for Production, Deploy Previews and Branch deploys only, marked
secret, reads it back and never prints it. A rotation takes the old value from that
copy (HARDENING.md §0).

| Option | Why not |
|---|---|
| The original slice C (HMAC recovery and Studio codes under the rotating key) | Removing the previous value after a rotation made every code on paper stop working. |
| Keep `MYSET_SECRET_PREVIOUS` verifying tokens for a month | A rotation after a leak would leave the leaked key minting sessions for that month. |
| A Studio code under scrypt on every request | Tens of milliseconds on every Studio poll. Remembered per warm instance instead: one hash a cold start, and a wrong code always pays the full cost, so time says nothing. |
| Leave it as it is | Every row of the question stays true on a public repository. |

## What this makes harder

A rotation is a sign-in for everybody, so it is not done during a show. A cold Studio
instance pays one scrypt on the first poll that carries a code. A backup made after
`0110` does not carry the store key, so after a restore from one, recovery codes made
before this decision stop working: make a new set (the Studio's Security section).
Without the Keychain's copy a rotation could not re-wrap the keyring, so the copy is
kept for as long as the variable is. Since `0130` nothing waits on `FINMODEL_CODE`.

## What would reverse it

Nothing in the design; the numbers are dials. A legacy window that proves too short
for somebody (a session lives thirty days, the window is thirty-one) widens
`LEGACY_MS`. A lockout that shuts the founder out of his own model too often widens
`TRIES`.

## How it was verified

`test/secret.mjs` runs the switch and a rotation end to end: tokens, tickets, codes,
venue tokens and HQ unlocks made under the store key still work after the switch and
stop after the window; a token minted with the store key after the window is refused;
recovery codes made the old way, before the switch and before a rotation all work
after the previous value is removed; a rotation refuses tokens signed under the
previous value; a fresh store with the variable set never makes a store key.
`test/passgate.mjs` runs the lockout, the required code, letters, and a cookie from
before the switch. `test/studiocode.mjs` runs the new form, the rewrite of an old
code, and a code surviving a switch and a rotation. The whole suite also ran with
`MYSET_SECRET` set. Nothing was written to production.
