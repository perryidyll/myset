---
tab: Artist lifecycle
section: Recovery and moving your address
puzzle_section_id: 41980
sources:
  - netlify/functions/auth.mjs (recoveryStatus, recoveryMake, recoverySignIn, emailChangeStart, emailChangeFinish, passkeyList/Start/Finish/Forget, setCode, passwordSet, passwordClear), _cred.mjs, _session.mjs
  - public/studio.js (Settings → Signing in; openPasswordSheet, openPasswordFromCode)
  - ACCOUNTS.md §6.4, §6.5, §9, §11
  - MYSET-MASTER-OVERVIEW.md §5.5 Recovery
  - docs/decisions/0070, 0073; INVARIANT 0fu
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps); 2026-09-28 (update_workflow on the section's notes — the Settings rows since decision 0070; create_process added v08 *Set a password* as step 389482; changelog 1661 and 1664 linked to it; read back through list_sections and list_steps)
verified: code read 2026-09-12 (auth.mjs action list; ACCOUNTS.md as amended in 425fb0a); 2026-09-28 (studio.js Settings → Signing in, openPasswordSheet/openPasswordFromCode; auth.mjs passwordSet/passwordClear; _cred.mjs weakPassword)
---

# Recovery and moving your address

**Who:** the owner, in Settings → Signing in. **Trigger:** setting up before it is needed, or losing the inbox. **Outcome:** an account that can be got back into without a human, and an address that can be moved without a Pro seat and without a stolen session walking off with it.

The rows under Settings → *Signing in* are always visible, set up or not: *Password · set / not set* (**Create** / **Change**) · *Face ID or fingerprint · N devices / not set up* (on a phone that supports it) · *Studio code · on / not set* · *Recovery codes · N of 8 unused / not set up yet.*

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| v01 | Make recovery codes | task | Person | Artist R · MySet server R | Netlify | `recoveryMake` (owner): eight one-time codes, Crockford-ish alphabet, hashed with the same site secret the six-digit codes use, **shown once and never again**. `recoveryStatus` reports how many are unused. Logged. `src: auth.mjs recoveryMake; ACCOUNTS.md §6.4` |
| v02 | Use one to get in | conditional | Person | Artist R · MySet server R | Netlify | `recoverySignIn {slug, code}` from the sign-in screen: the code is burned, **every other device is signed out** (`rev` bumped), a fresh session opens. Wrong code / unknown page / locked page answer identically (INVARIANT 9h). Logged. → *Signing up and signing in* g08. `src: auth.mjs recoverySignIn` |
| v03 | Set a Studio code | task | Person | Artist R | Netlify | `setCode`: the per-page code that pairs with the page name at the door (minimum length and lockout in §2.1). The *"the original code from Netlify keeps working as a backup"* line is shown only to the founder, for whom it is true (`ADMIN_CODE`). `src: admin.mjs setCode; ACCOUNTS.md §6.4` |
| v04 | Add a passkey | task | Person | Artist R · MySet server R | Netlify | `passkeyStart` / `passkeyFinish` while signed in; `passkeyList`, `passkeyForget`. Stored in `pkeys_<owner>` (already in `keysFor`, so export and deletion cover it). Rolled out to the founder first on purpose — PER-006 asks whether Face ID is actually faster mid-set. `src: auth.mjs passkey*; ACCOUNTS.md §9c, §9e; ledger PER-006` |
| v05 | Start moving the address | email | Person | Artist R · MySet server R | Resend | `emailChangeStart {newEmail}` (owner): **two proofs, never one** — a code to the NEW address and a code to the OLD one, and the old address is mailed a notice **at request time**, so if a stolen session is trying to walk off with the account the owner hears about it while there is still something they can do. `src: auth.mjs emailChangeStart; ACCOUNTS.md §6.5` |
| v06 | Finish with both codes | conditional | Person | Artist R · MySet server R | Netlify | `emailChangeFinish {newCode, oldCode}`: the second may be a **recovery code** instead — the answer to *"I can't get into the old inbox any more"*. The swap of `byEmail` rows and the session kill happen in **one** `mutateArtists`, so there is never an instant where both addresses, or neither, can sign in. Logged. `src: auth.mjs emailChangeFinish` |
| v07 | Lost everything? | conditional | Person | Artist R · Founder R | Netlify CLI | No inbox, no recovery codes, no Studio code, no passkey: the app offers nothing further by design (a back door is an enumeration oracle). **The founder's procedure is written — ACCOUNTS.md §6.4 "When everything is gone"**: prove identity outside MySet (two of: the linked Instagram/website, the Connect account's email read in the Stripe dashboard, a venue on their calendar); attach the new address by hand from the registry (`netlify blobs:get` / `blobs:set myset artists` — swap the `byEmail` row and bump the account's `rev` in one write, never during their show, diff afterwards, delete the file); get them in and straight to recovery codes. **Rehearsed:** the read half (2026-09-12). Not the write half — first rehearsal is on the founder's own account, which has no `byEmail` row on the live registry today. Proper fix: an owner-only `ownerEmailSet` (ACCOUNTS.md §10 item 6). **Draft until walked.** `src: ACCOUNTS.md §6.4, §10; _session.mjs bumpFrom` |
| v08 | Set a password | task | Person | Artist R · Artist team member R · MySet server R | Netlify | Settings → *Signing in* → **Password · set / not set** → **Create** / **Change** (`passwordSet`) — each person's own, for their own sign-in address, whatever their role. The first time needs nothing more; a change needs the current password **or a fresh six-digit code to the same address** (*Forgot it? Email me a code instead*), and **signs that address's other devices out** — not this one, not a band mate's. Refused with the reason: outside the length limits (`PW_MIN` / `PW_MAX` in `_cred.mjs`), the email address itself, one character repeated, or one of the handful everybody tries first; no breach-list call, which would be an outbound request on the sign-in path. After a code sign-in on an address with no password, the Studio offers one once (*Set a password?* · *Not now*). **From a Studio-code session** (no address of its own; decision 0073) the sheet lists the account's owner addresses: pick one, *Email me a code*, type the code and the new password — never a member or crew row, never an address off the account. `passwordClear` (server only) needs the current one. The record is in `keysFor` for deletion and never in the export. The Venue Studio has the same row. Logged. `src: auth.mjs passwordSet/passwordClear; _cred.mjs; studio.js openPasswordSheet/openPasswordFromCode; ACCOUNTS.md §11; INVARIANT 0fu; decisions 0070, 0073` |

## Connections

v01 → v02; v03; v04; v08; v05 → v06; v06 —no old inbox→ v02 (a recovery code stands in); v07 is the terminal case.
