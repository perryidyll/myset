---
id: 0070
title: the email address is the username and a password sits under it — per person, scrypt-hashed, swapped for a session; the six-digit code stays the front door for a new account and the whole of "forgot"
date: 2026-09-14
status: decided
decided_by: perry
area: auth
reverses:
superseded_by:
invariants: [0fu]
commits: []
tests: [test/password.mjs, test/accounts.mjs, test/structure.mjs, test/copy.mjs]
files: [netlify/functions/_cred.mjs, netlify/functions/auth.mjs, netlify/functions/venueauth.mjs, netlify/functions/_account.mjs, netlify/functions/_venueaccount.mjs, public/studio.js, public/studio.html, public/venue-studio.js, public/venue-studio.html, ACCOUNTS.md]
---

## The question

The founder, having read the accounts report (2026-09-14): *"i want the fully
standard shape where the email address as the username"* — a sign-in screen with
an email field and a password field beneath it, a big pink-orange "Welcome back",
a filled pink-orange "Sign in", "New here? Join the MySet family" with a ringed
"Create account" under it, the Studio code as small grey underlined text at the
foot that opens a window; a way to get a new code by typing the account's
email; and, once an account exists, the option in Settings to create a password
"that replaces that code". ACCOUNTS.md §9b had said, on 2026-09-05, *never
passwords* — a decision made by an agent under "implement the best option", not
by him. This is his call, and it revises that one.

## The options

| Option | What it does | What it costs | New moving parts | Risk if it goes wrong |
|---|---|---|---|---|
| **A — chosen (B in the report)** | A password per **email row**, never per page: `cred_<owner>_<hash of email>`, scrypt (node:crypto, salted, N=2¹⁴) checked once at sign-in and swapped for the same 30-day session token every other door mints. `passwordSignIn` public, one sentence and one cost for every failure; `passwordSet` for your own address — the current password or a fresh six-digit code to change it, and a change signs the address's other devices out; `passwordClear`. Five wrong per address, then a wait. The screen as specified, in both Studios. The code stays: it is how an account is made and the whole of "forgot". The Studio code stays as the small door. | ~1 day; a phishable secret now exists beside the phishing-proof passkey. | `_cred.mjs`, five actions, a `pw` flag on `list`, a Settings row and sheet, the sign-in screen | A weak password. Mitigated by the length floor, the deny-list, the lockout, the passkey staying the recommended door — and by the email code still being the credential that matters. |
| B | The page name as the username (the report's path A). | A page has five people on a Rock Star; "which of you is this" needs a second field anyway. | | The founder said email. |
| C | Rename the Studio code "password" and stop. | It is shared by the page, hashed without a salt, and sent on every request — a password in name only. | none | Dressing up the one non-standard door as the standard one. |
| D | Passwords beside the Studio code, both on the front. | Two shared-ish secrets on one screen; the 2026-09-12 "one way in" decision undone. | | Confusion at 9 pm. |
| E — do nothing | The code and the passkey. | The founder asked. | | |

## What was chosen, and why

A, because he asked for it, and because it can be built without giving up what
made "never" right: the password is per person and hashed like one, it is never
the root of trust (the code is), and the phone-lost / inbox-lost paths are the
ones that already exist. No new dependency. No breach-list lookup — an outbound
call on the sign-in path — the lockout is the guard against guessing.

The Studio code is left exactly as it was (SHA-256, per page, sent per request):
it is the founder's own door and a phone-with-no-email door, it now lives in a
window off the foot of the screen, and hashing it slowly would cost every Studio
poll ~40 ms, since it is checked on every request. That is the honest reason it
is not "a password".

"Replaces that code": once a password is set, sign-in is email + password and
the inbox is not needed; the code is not removed — it is "Forgot your password?"
and it is how a new account is made. After a code sign-in with no password on
the address, the Studio offers one, once, skippable.

## What this makes harder

A new sign-in address should be offered a password (it is, after its first code).
`keysFor` / `keysForVenue` enumerate the records — a hash is not data an artist
takes with them, so the export never carries it. Anyone adding a door has three to
keep in step now (code, password, passkey) plus the founder's.

## What would reverse it

A breach of the store that exposes the hashes at a scale where scrypt is not
enough — then a slower KDF or a hardware-backed one. A finding that people
forget the password more than they lose the inbox — then the prompt-once becomes
a stronger nudge toward the passkey.

## How it was verified

`test/password.mjs` 50 ✓: no password → one sentence; weak ones refused with the
reason; created without a current one the first time; stored as scrypt with a
salt and no trace of the text; email + password → a session that works in the
Studio; wrong / unknown address → the same sentence and status; five wrong →
locked, the code door still works, no lock record for an address nobody has;
change needs the current one (wrong one says so), signs the other device of the
address out and keeps this one; the six-digit code stands in for the current
password; a Studio-code session is told to sign in with its email; clear needs
the current one; the record is in `keysFor` and absent from the export; and the
screen's words and colours in both Studios. Suite exit 0 / 3,047 ✓; uicheck
239 ✓; sheetcheck 39 ✓; headless Chrome at 390 px in both themes: the heading,
the ring, the fill, the ringed "Create account" and the grey underlined foot all
compute to the pink-orange or the muted grey (`b13-*.png` in the session's
scratchpad). Not checked: a real inbox end to end — the founder's own sign-in is
run-sheet items 5 and 12.
