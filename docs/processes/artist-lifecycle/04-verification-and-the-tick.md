---
tab: Artist lifecycle
section: Verification and the tick
puzzle_section_id: 41981
sources:
  - netlify/functions/_verify.mjs (artistVerifyChecks, tryAutoVerify, ID_SLOT, idqueue), admin.mjs (verifyStatus, idUpload, idQueue, idApprove, idReject), webhook.mjs (account.updated → tryAutoVerify), img.mjs (SLOTS)
  - MYSET-MASTER-OVERVIEW.md §5.6, §3.4
  - docs/decisions/0028 (verified-only directory)
  - INVARIANTS.md (the date of birth is never stored)
status: loaded
loaded: 2026-09-12 (create_process; read back through list_steps)
verified: code read 2026-09-12 (_verify.mjs artist section header and artistVerifyChecks; admin.mjs id* actions)
---

# Verification and the tick

**Who:** an artist wanting the green **✓ Verified** chip; the server; the founder as the fallback reviewer. **Trigger:** Settings → Get verified. **Outcome:** a tick granted on the spot from Stripe's own identity check for most people, or a row in a small review queue for the founder — never a stored ID photo, never a stored date of birth.

**Paying opens the door to being checked — it never buys the tick.** A badge that claims more than it checks is worse than no badge, and this is stated wherever the feature appears. Since decision 0028, *Find artists* lists only effectively verified profiles, so the tick is also what makes an artist discoverable.

| id | step | type | executor | role (RACI) | tool | notes |
| --- | --- | --- | --- | --- | --- | --- |
| e01 | Read the checklist | notification | Automation | MySet server R · Artist I | Netlify | `verifyStatus` → `artistVerifyChecks`: **paid plan** (the tick is a premium feature), **card payments actually working** (`connectReady` — Stripe's own `charges_enabled`, so Stripe has already run a real identity check), **an ID on file**, **legal name given**. Each line says what is missing. `src: _verify.mjs artistVerifyChecks; overview §5.6` |
| e02 | Upload an ID with the legal name and date of birth | form | Person | Artist R · MySet server R | Netlify | `idUpload {photo, legalName, dob}`: it asks for the **legal** name, not the page name — the founder's page says Idyll and his passport does not; comparing display names would fail for most real people. The photo goes to `ID_SLOT` (`idcheck`), a slot deliberately absent from `img.mjs`'s `SLOTS`, so **the image endpoint refuses to serve it**. A row `{state: 'pending', legalName, …}` lands in the global `idqueue` — never the date of birth. `src: admin.mjs idUpload; _verify.mjs ID_SLOT` |
| e03 | Compare against Stripe's KYC | conditional | Automation | MySet server R | Stripe | `tryAutoVerify`: the stated legal name against the name Stripe verified on the Connect account (same names, or the same plus a middle name) and the birth date **to the day**. **Nothing reads the photo** — no text extraction, no face comparison; the automatic path leans entirely on Stripe's own check. **The date of birth is compared once and thrown away**; only the yes/no is kept, and a test asserts the stored row does not contain the date. Also tried the moment Stripe finishes onboarding (`account.updated` → *Money → Stripe events arriving* w05). `src: _verify.mjs tryAutoVerify; webhook.mjs 63–67` |
| e04 | Grant the tick on the spot | database | Automation | MySet server R · Artist I | Netlify | Match → `verified` on the registry row; the ID photo is **deleted the moment a decision is made**. The chip appears on the public page and the directory card. Most artists take this path with no human involved. `src: overview §5.6` |
| e05 | Queue for the founder | database | Automation | MySet server R · Founder I | Netlify | Anything less than a match → the row stays `pending` **with the comparison written on it** (which names matched, whether the date did), so the founder decides from the comparison, not by reading a passport. `src: _verify.mjs; overview §5.6` |
| e06 | Review the queue | conditional | Person | Founder R · Artist I | Netlify | Settings → owner-only tools → **ID review queue** (`idQueue`: the founding page **and** its owner seat — a band mate or crew signed in to the founding page is refused, decision 0099, and since decision 0100 the Studio draws the card for that seat only). `idApprove` / `idReject`; either way the photo is deleted now. Holding a stranger's government ID indefinitely is a liability nobody asked for; only the decision is kept. `src: admin.mjs idQueue, idApprove, idReject` |
| e07 | Show the chip | notification | Automation | MySet server R · Fan I | Netlify | The green **✓ Verified** chip on `/<slug>`; a verified-only entry in `/artists` (decision 0028; the API is `no-store` and never exports email, role or billing fields); discovery tags derived from existing records, style alone being new profile data (decision 0024). Losing the paid plan removes the *effective* verification without deleting the decision. `src: overview §3.4, §4.7; decisions 0024, 0028` |

## Connections

e01 → e02 → e03; e03 —match→ e04 → e07; e03 —no match→ e05 → e06; e06 —approve→ e04; e06 —reject→ *photo deleted, row closed*.
