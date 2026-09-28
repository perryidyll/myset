---
tab: Artist lifecycle
section: Signing up and signing in
puzzle_section_id: 41978
sources:
  - netlify/functions/auth.mjs (me, start/request, verify, claim, passkeySignInStart/Finish, recoverySignIn, passwordSignIn/passwordSet/passwordClear), _auth.mjs (issueCode, checkCode, sendCode, createArtist), _cred.mjs, _passkey.mjs, _session.mjs
  - public/studio.html (the sign-in screen after commit 425fb0a)
  - MYSET-MASTER-OVERVIEW.md §5.5
  - ACCOUNTS.md §6.2, §6.4, §9, §11
  - docs/decisions/0023, 0070
  - INVARIANTS.md 9g, 9h, 0fu
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps); 2026-09-28 (update_workflow on the section's notes — a password exists since decision 0070, and PER-004's sender is set; read back through list_sections)
verified: code read 2026-09-12 (auth.mjs start/verify/claim; the byte-identical SENT answer); 2026-09-28 (_cred.mjs; auth.mjs passwordSignIn/passwordSet/passwordClear; studio.js Settings → Password; the ledger's PER-004 row)
---

# Signing up and signing in

**Who:** an artist (external) at `/studio` or `/signup`. **Trigger:** wanting in. **Outcome:** an HMAC-signed token in the browser carrying account id, expiry, revocation counter and session id — for a new page or an existing one. **The audience never signs in** (rule 2); everything here is the artist's side only.

The email address is the username, and a password can sit under it (decision 0070): one per person, scrypt-hashed, swapped for a session at sign-in and never sent again; Settings → *Password* creates or changes it. The root of trust is still one factor — an inbox. The six-digit code sent to it is how an account is made and the whole of *Forgot your password?*, and four faster doors sit on top: a password, a passkey, a Studio code, a recovery code. Sign-in mail comes from `hello@myset.vip`, the verified sender set as `AUTH_FROM` (PER-004, done 2026-09-10; decision 0023).

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| g01 | Open the sign-in screen | webpage | Person | Artist R | Netlify | Email + **Email me a code** + a *Got a code already?* box (six digits, same address, any device) + **Sign in with my code**. The page-name + Studio-code form sits behind a small *Studio code* link. The Face ID button appears only once that browser has signed in at least once — a passkey belongs to a page and the sign-in screen does not yet know which page you are. `src: studio.html (425fb0a); overview §5.5` |
| g02 | Ask for a code | email | Automation | MySet server R · Artist I | Resend | `start`: one door whether you have an account or not. The answer is **byte-identical for every valid address** — an earlier version returned `needName` only for unknown addresses, which was a way to discover who has an account. Rate-limited silently (sends per hour in overview §2.1); email not configured → 503 *"Email sign-in isn't switched on yet."*; provider failure → 502. `src: auth.mjs start; INVARIANT 9h` |
| g03 | Redeem the code | conditional | Automation | MySet server R | Netlify | `verify`: six digits, checked server-side, ten-minute life, burned on use, a small number of wrong guesses before lockout (§2.1). Wrong → **401 "Check the code and try again"** — the same sentence for a wrong code, an unknown address and a locked address. **No account for this inbox** → they now own the inbox, so it is safe to say so: `needName` + a short-lived signed ticket → g04. **Existing** → g05. `src: auth.mjs verify; _auth.mjs checkCode` |
| g04 | Claim a page | form | Person | Artist R · MySet server R | Netlify | `claim {ticket, name, slug?, ref?, src?}`: the ticket proves the inbox; a name is required (*"What should we call you?"*); `createArtist` mints the id, the slug (from the name unless chosen; `v` and anything starting with it is reserved so venue and artist namespaces never shadow), the registry rows `byId` / `bySlug` / `byEmail`, and records a referrer if there was one. Ticket expired → **401 "That took too long — ask for a new code"**. Address already has a page → **409**. `src: auth.mjs claim; _auth.mjs createArtist; overview §3.1` |
| g05 | Open a session | database | Automation | MySet server R | Netlify | `open()` — the one place a session is minted (the venue twin `openV` mirrors it so the two doors cannot drift): a new session id, a token `email|exp|rev|sid` parsed by popping fixed fields off the **end** so nothing an address could contain can shift them, a row in `sess_<owner>` holding a device **class** (*iPhone · Safari*), never the raw User-Agent, never an IP; `signin` written to the activity log. `src: auth.mjs open; _session.mjs; ACCOUNTS.md §6.2` |
| g06 | Sign in with a passkey | conditional | Person | Artist R · MySet server R | Netlify | `passkeySignInStart` / `passkeySignInFinish`: WebAuthn verified **with no npm dependency** — SHA-256, an ECDSA/RSA signature check, base64url, and enough CBOR to read two maps. *A dependency in the sign-in path is a dependency that can be taken over.* Five checks, each defeated on purpose by `test/passkeys.mjs` acting as a real authenticator; the subtle one: a synced iCloud passkey reports a counter of zero for ever, so "not greater" must not lock it out. A passkey is added to an account, never a way to create one. `src: _passkey.mjs; ACCOUNTS.md §9c–9d` |
| g07 | Sign in with the Studio code | conditional | Person | Artist R · MySet server R | Netlify | Page name + Studio code, which together behave like a username and password: at least the minimum length in §2.1, a deny-list, and the door locks after repeated failures for a fixed period. **A locked door, a wrong code and an unknown page name all answer identically.** Most artists never set one; it exists so you can get in from any phone when email is slow. The client once asked for fewer characters than the server accepted — fixed to one number. `src: overview §5.5; ACCOUNTS.md §6.4` |
| g08 | Sign in with a recovery code | conditional | Person | Artist R · MySet server R | Netlify | `recoverySignIn {slug, code}`: the page name is public and grants nothing on its own — it only says which lock to try. One of eight one-time codes (Crockford-ish alphabet: no 0/O, no 1/I/L, because they get written on the back of a setlist in a dark room), hashed with the site secret, shown once. Using one **signs out every other device**. Wrong code, unknown page and locked page answer identically. → *Recovery and moving your address*. `src: auth.mjs recoverySignIn; ACCOUNTS.md §6.4` |
| g09 | Land in the Studio | notification | Automation | MySet server R · Artist I | Netlify | `me` answers `{signedIn, email, role, artistId, slug, name}`; the Studio boots on the Live tab (six tabs). A new account gets the first-Settings notice. `src: auth.mjs me; overview §3.3` |

## Connections

g01 → g02 → g03; g03 —no account→ g04 → g05; g03 —existing→ g05; g01 → g06 → g05; g01 → g07 → g05; g01 → g08 → g05; g05 → g09.

## Why the password is not the root, and why not Google or an identity provider

Passwords were ruled out on 2026-09-05 as a second thing to steal, with a reset flow that is itself an email code. The founder revised that on 2026-09-14 (decision 0070) without giving up what made "never" right: the password is per person and hashed like one, every failure answers the same sentence, and forgetting it is the email code as before — so the inbox stays the credential that matters. Google sign-in needs a cloud project, a consent screen and a verification review, and hands the customer list to a third party. An identity provider costs per active user for ever and makes sign-in depend on a third party being up during a gig. Passkeys cost the person nothing — one look. `src: ACCOUNTS.md §9b, §11; decision 0070; overview §5.5`
