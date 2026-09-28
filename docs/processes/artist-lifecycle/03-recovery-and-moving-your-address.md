---
tab: Artist lifecycle
section: Recovery and moving your address
puzzle_section_id: 41980
sources:
  - netlify/functions/auth.mjs (recoveryStatus, recoveryMake, recoverySignIn, emailChangeStart, emailChangeFinish, passkeyList/Start/Finish/Forget, setCode), _session.mjs
  - ACCOUNTS.md §6.4, §6.5, §9
  - MYSET-MASTER-OVERVIEW.md §5.5 Recovery
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (auth.mjs action list; ACCOUNTS.md as amended in 425fb0a)
---

# Recovery and moving your address

**Who:** the owner, in Settings → Signing in. **Trigger:** setting up before it is needed, or losing the inbox. **Outcome:** an account that can be got back into without a human, and an address that can be moved without a Pro seat and without a stolen session walking off with it.

The Settings row is always visible: *Password — you don't have one; MySet emails you a fresh six-digit code every time · Studio code — on / not set · Recovery codes — N of 8 unused / not set up yet.*

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| v01 | Make recovery codes | task | Person | Artist R · MySet server R | Netlify | `recoveryMake` (owner): eight one-time codes, Crockford-ish alphabet, hashed with the same site secret the six-digit codes use, **shown once and never again**. `recoveryStatus` reports how many are unused. Logged. `src: auth.mjs recoveryMake; ACCOUNTS.md §6.4` |
| v02 | Use one to get in | conditional | Person | Artist R · MySet server R | Netlify | `recoverySignIn {slug, code}` from the sign-in screen: the code is burned, **every other device is signed out** (`rev` bumped), a fresh session opens. Wrong code / unknown page / locked page answer identically (INVARIANT 9h). Logged. → *Signing up and signing in* g08. `src: auth.mjs recoverySignIn` |
| v03 | Set a Studio code | task | Person | Artist R | Netlify | `setCode`: the per-page code that pairs with the page name at the door (minimum length and lockout in §2.1). The *"the original code from Netlify keeps working as a backup"* line is shown only to the founder, for whom it is true (`ADMIN_CODE`). `src: admin.mjs setCode; ACCOUNTS.md §6.4` |
| v04 | Add a passkey | task | Person | Artist R · MySet server R | Netlify | `passkeyStart` / `passkeyFinish` while signed in; `passkeyList`, `passkeyForget`. Stored in `pkeys_<owner>` (already in `keysFor`, so export and deletion cover it). Rolled out to the founder first on purpose — PER-006 asks whether Face ID is actually faster mid-set. `src: auth.mjs passkey*; ACCOUNTS.md §9c, §9e; ledger PER-006` |
| v05 | Start moving the address | email | Person | Artist R · MySet server R | Resend | `emailChangeStart {newEmail}` (owner): **two proofs, never one** — a code to the NEW address and a code to the OLD one, and the old address is mailed a notice **at request time**, so if a stolen session is trying to walk off with the account the owner hears about it while there is still something they can do. `src: auth.mjs emailChangeStart; ACCOUNTS.md §6.5` |
| v06 | Finish with both codes | conditional | Person | Artist R · MySet server R | Netlify | `emailChangeFinish {newCode, oldCode}`: the second may be a **recovery code** instead — the answer to *"I can't get into the old inbox any more"*. The swap of `byEmail` rows and the session kill happen in **one** `mutateArtists`, so there is never an instant where both addresses, or neither, can sign in. Logged. `src: auth.mjs emailChangeFinish` |
| v07 | Lost everything? | conditional | Person | Artist R · Founder R | Netlify CLI | No inbox, no recovery codes, no Studio code, no passkey: the app offers nothing further by design (a back door is an enumeration oracle). **The founder's procedure is written — ACCOUNTS.md §6.4 "When everything is gone"**: prove identity outside MySet (two of: the linked Instagram/website, the Connect account's email read in the Stripe dashboard, a venue on their calendar); attach the new address by hand from the registry (`netlify blobs:get` / `blobs:set myset artists` — swap the `byEmail` row and bump the account's `rev` in one write, never during their show, diff afterwards, delete the file); get them in and straight to recovery codes. **Rehearsed:** the read half (2026-09-12). Not the write half — first rehearsal is on the founder's own account, which has no `byEmail` row on the live registry today. Proper fix: an owner-only `ownerEmailSet` (ACCOUNTS.md §10 item 6). **Draft until walked.** `src: ACCOUNTS.md §6.4, §10; _session.mjs bumpFrom` |

## Connections

v01 → v02; v03; v04; v05 → v06; v06 —no old inbox→ v02 (a recovery code stands in); v07 is the terminal case.
